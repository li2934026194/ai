# PACK 19 报告：履约状态机补 `cancelled` 动作（含前端入口与全矩阵）

- 时间：2026-11-19
- 结论：`cancelled` 由“只在枚举里”变成“真能取消、真能留痕、真能挡住非法情况”，全量测试 **87 passed + 6 subtests**。
- 性质：补缺口，不是新功能扩面。

---

## 一、补之前是什么样（先证明缺口）

`cancelled` 当时只活在四处：

1. `core/replenish_flow.py` 的 `PO_STATUSES`；
2. 同文件的 `PO_TRANSITIONS`（`created / shipping / partial_received → cancelled`，`fully_received / cancelled → ∅`）；
3. `STATUS_LABELS` 里的中文“已取消”；
4. 文件头注释里的状态列表。

**没有**取消动作函数、没有 service、没有 HTTP 入口、`purchase_order` 表没有取消留痕字段。也就是说：前端就算想画“取消”按钮，也没有任何一条链路能落地，`cancelled` 是一句空话。这是本次要补的真实缺口。

## 二、改了什么

### 2.1 核心状态机（`core/replenish_flow.py`）

新增 `cancel_purchase_order(po_row, *, cancel_user, now, reason)`，并加入 `__all__`：

- `created / shipping / partial_received` 可取消；`fully_received / cancelled` 走 `check_transition` 挡回 `F-2001`；
- 原因 `strip()` 后为空 → `F-2002`（取消必须写理由）；
- 操作人为空 → `F-2003`；
- 返回 `{status: cancelled, cancel_user, cancel_reason, cancel_at}`；
- **已部分收货的已收数量不冲销**（货已到仓，账不能抹）；
- **不自动改补货申请状态**（申请仍为 `approved`）。申请链与采购单链分开，是否连申请一起关，是业务决策，不在函数里偷偷做。

### 2.2 表结构与库

`schema.py` 的 `PurchaseOrder` 增三列（均可空）：

| 列 | 类型 | 说明 |
|---|---|---|
| `cancel_user` | `String(64)` | 取消操作人 |
| `cancel_reason` | `String(500)` | 取消原因（必填，后端强校验） |
| `cancel_at` | `DateTime` | 取消时间 |

既有库表不会被 `create_all` 自动改，故显式执行三条 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`。执行后复核：

- `information_schema.columns` 列数 **10 → 13**，新列在尾部；
- `purchase_order` 行数执行前后均为 **1**，未动既有数据。

### 2.3 服务层与接口

- `api/service.py`：新增 `cancel_po(po_id, *, reason, operator="demo_operator")`；`_po_as_dict` / `_po_dict` 带上 `cancel_user / cancel_reason / cancel_at`；回执 message 在“已收 > 0”时追加「已收 N 件仍计入库存，不冲销」。
- `api/schemas.py`：新增 `PoCancelRequest`（`po_id / reason / operator`）；`PurchaseOrderItem` 增三个可选留痕字段。
- `api/main.py`：新增 `POST /api/p3/po/cancel`（与 ship / receive 同风格，`async def` 直接调 service，业务错误交给既有异常处理器返回 HTTP 200 结构化码）。
- 错误码映射沿用 `_FLOW_ERROR_CODE`：`F-2001 → E-1103`（非法流转）、`F-2002 → E-1104`（必填理由）、`F-2003 → E-1105`。

### 2.4 前端入口（`frontend/src`）

- `api.js`：新增 `cancelPo(poId, reason, operator)`。
- `P3SkuDetail.vue`：采购单履约操作列在“收货质检”旁新增「取消采购单」；点开后是行内输入框（`p3CancelReason`）+「确认取消」，空原因前端先挡一次（`E-1104` 文案），提交后刷新列表并展示后端 message；`startReceive` / `startCancel` 互斥，避免两个面板同时展开。
- `npm run build` 通过（578 modules，仅 chunk>500kB 的既有提示，无语法错误）。

## 三、验收证据（不是“我认为对”，是可复跑的数）

### 3.1 用例 7：取消与终态

新建申请 → 审批生成 PO：

1. 空原因取消 → `E-1104`，`status` 仍为 `created`；
2. 正常取消 → `action=cancel`、`status=cancelled`、`cancel_user=pytest_operator`、`cancel_reason` 与 `cancel_at` 均非空，直连库复核三字段已落盘；
3. 终态再取消 → `E-1103`；
4. 已取消再收货 → `E-1103`。

### 3.2 用例 8：部分收货后取消

先收 `order_qty // 3`（含 1 件不良）→ `partial_received`；再取消：

- 状态 `cancelled`；
- `receive_qty` **保持不变**（不冲销）；
- message 含「仍计入库存」。

### 3.3 用例 9：履约全矩阵（5 状态 × 3 动作 = 15 格）

纯核心逻辑测试（不碰库），以 `PO_TRANSITIONS` 本身作期望，逐格验证 `mark_shipping / receive_goods / cancel_purchase_order` 的放行与拦截是否与流转表一致；另加终态 2 × 3 全挡断言。

结果：**15/15 一致，终态 6/6 全挡**。

### 3.4 测试与库计数

| 项 | 结果 |
|---|---|
| `pytest tests/test_replenish_flow.py -q` | **9 passed in 4.27s** |
| `pytest tests -q` | **87 passed + 6 subtests passed in 40.34s**（上一包基线 84 + 本次 3 条） |
| 测试后库计数 | `replenish_apply=3`、`purchase_order=1`、`cancelled` 行 **0**（`tearDownClass` 按 `apply_id` 清理有效） |

## 四、已知残余风险（必须写在明面上）

1. **申请状态未定**：采购单取消后，对应申请仍是 `approved`。是否应一并 `closed`，业务没拍板；当前刻意不自动改，避免“取消采购单”被误解为“申请作废”。这条留作待决策项。
2. **不可恢复**：没有“取消后重开”动作，取消是单向的；如需重订，只能重新走申请。
3. **只做了 P3 详情页入口**：P2 补货页的采购单列仍是只读展示，未加入取消按钮；接口已可用，属前端覆盖不全，不算后端缺口。
4. **并发**：`cancel_po` 与其他流转一样是“读-改-写”，没有行锁；单机演示场景可接受，生产需加 `SELECT ... FOR UPDATE`。
5. **无基线快照**：本次改前未建 `_backup_pack19`（改前原样已在 §一 逐点记录），如需回滚按 §二 逐条反做。
