# PACK 21 报告：把“验证”从抽样升级为全文与全路径

日期：2026-11-19　状态：已完成（6 个子项，全量 102 项测试绿、五闸 5/5）

## 21a 数字全文 diff

**问题**：评测只比对抽取出来的 3–4 个字段，回答正文里多写一个数（把 19.55 写成 25.19、把 360 件写成 420 件）不会被发现。

**做法**：`tests/check_numbers.py` 把回答里的每个数字抠出来，逐个对照同数据集同 SKU 的 `_sku_detail()` 返回的全部数字，允许四舍五入与千分位变体；数据集名称里的数字（如「断货14天」）、45 天持有期、年份等作为白名单。拒答类按错误文案里的数字建池。

**证据**：
- `python -m tests.check_numbers` → **30 条解释回答全部通过，0 个无法解释的数字**。
- `tests/test_check_numbers.py` 做反向自检：给真实回答注入「9999 件」，检查器必须报错——**2 passed**，证明不是“空跑通过”。

**边界**：白名单允许了常见常量；这不是“语义校验”，只保证“回答里的数都能在 detail 里找到出处”，不能判断一句话是否把数字用错了对象。

## 21b 拒答矩阵

**做法**：`docs/reject-matrix.md` 按数据层 / 履约层 / 系统层列出 16 个码的语义、触发条件、页面表现与证据；新增 `tests/test_reject_matrix.py` 钉住最容易被模型糊过去的四类：
- E-1001 数据不足：不返回 qty/capital/derivation；
- E-1002 缺成本：可给量，`capital=None`，`service_level_source=default_missing_cost`；
- E-1003 SKU 不存在：不返回任何业务数字；
- E-4001 无需补货：qty=0，统一文案「本轮无需补货」；
- E-5001：合成声明来自单一常量，detail 的 `evidence.source_type=SYNTHETIC`。
**5 passed**。

## 21c 写库双路径

**问题**：HTTP 与 Agent 工具各自单测，没人证明两条入口落到同一结果。

**做法**：`tests/test_write_dual_path.py` 对同一 SKU 各提交一笔申请，一笔走 `POST /api/p3/apply`，一笔走 `submit_replenish_apply` 工具；再分别用 HTTP 与 `approve_apply` 工具审批；逐字段比对申请数量/金额/路线/目标、采购单订单量/状态，并核对工具回执里的数字。
**1 passed**，两单均 360 件 / 3600 元、状态一致。

## 21d 并发行锁

**问题**：审批/收货/取消都是读-改-写，两个人同时点“通过”可能生成两张采购单。

**做法**：`_get_apply` / `_get_po` 增 `for_update` 参数，写路径全部 `SELECT ... FOR UPDATE`；新增 `tests/test_concurrency.py`：两个线程同时审批同一申请。
**结果**：成功 1、E-1103 1、采购单只有 1 张、申请 approved。**1 passed**。

## 21e 路线到货日

**问题**：选空运（14 天）的申请，采购单仍按产品四段 53 天写到货日。

**做法**：`_lead_time_for_route()`：有路线按 `lead_prod + transit_days`，无路线才回落四段之和；`approve_apply` 传入申请的 `route_code`。
**证据**：`tests/test_route_po.py` 用「合成-正在缺货」SKU-005 各提交海运/空运，审批后到货日 **52 天 vs 14 天**，订单量 **660 vs 300**。**1 passed**。

## 21f 观测面板

**做法**：新增 `GET /api/ops/summary`（库计数 / 最近评测 / 最近五闸），五闸脚本每次运行写 `docs/gates-latest.json`；P6 工坊页加「验收面板」，直接渲染这份快照，并写明“页面不触发重跑”。
**证据**：`tests/test_ops_summary.py` 1 passed；页面 `npm run build` 通过。

## 收尾数字

- `python -m pytest tests -q` = **102 passed, 6 subtests passed**（39.49s，收尾复跑）
- `python -m tests.gates` = **5/5**（G02 端点 16/16）
- `python -m tests.check_numbers` = **30/30**
- `python -m tests.eval_qa` = **RUN 5：问数 50/50、解释 30/30、四要素 30/30，155.5s**
- 前端 `npm run build` = 578 modules 通过
- 库计数复核：`datasets=6`、`replenish_apply=3`、`purchase_order=1`，采购单 13 列
- 新增文件：`tests/check_numbers.py`、`tests/test_check_numbers.py`、`tests/test_reject_matrix.py`、`tests/test_write_dual_path.py`、`tests/test_concurrency.py`、`tests/test_route_po.py`、`tests/test_ops_summary.py`、`docs/reject-matrix.md`

## 仍然没做的（不许在答辩里说成已做）

1. 真实店铺数据验证（CSV 只证明“格式能进”，不证明“真实需求可预测”）。
2. 生产级鉴权与部署：HTTP 写接口无鉴权；无 git 仓库。
3. 模型微调 / 多仓调拨 / 供应商协同。
4. 答辩日期仍未确定，无法倒排彩排。
