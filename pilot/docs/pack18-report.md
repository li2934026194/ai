# PACK 18 报告：证据块 + 契约测试 + 双壳一致 + 五闸脚本

- 时间：2026-11-19
- 结论：**五闸 5/5 通过**；对外每个建议数字现在自带出处；API 与 Agent 两壳在 3 个 SKU 上逐项对数一致。

---

## 一、为什么做这一包

前面每一包都靠“我记得我验过”来收尾，这是不可复用的。本包把“怎么算过”写成脚本，任何人（包括验收时的你）跑一条命令就能复现：`python -m tests.gates`。

## 二、证据块（每个数字都要能回答“哪来的”）

`GET /api/p3/sku/{sku}` 新增 `evidence`，内容全部来自本次计算的真实上下文：

| 字段 | 含义 |
|---|---|
| `engine_version` | 固定 `pilot-1.3` |
| `dataset_id` / `dataset_name` | 用的是哪个数据集（不是默认兜底） |
| `sku` | 哪条 SKU |
| `as_of` | 数据截止日（不是“今天”） |
| `source_type` | 实际 / 公开参考 / 合成 / 测试输入 |
| `method` / `best_model` | 回测方法与选中的最优模型 |
| `sigma_source` / `sigma_residual_points` / `ar1` | σ 的来源、残差点数、AR(1) 系数 |
| `route_code` / `objective_mode` / `lead_time_basis` | 按哪条路线、哪个目标算的；交期口径 |
| `generated_at` | 本次计算时间 |

响应模型 `SkuDetailResponse` 增加 `evidence: Optional[dict]`（只加字段，老响应仍能解析）。前端不消费该字段，因此界面零变化。

## 三、五闸脚本（`tests/gates.py`）

| 闸门 | 判定 | 失败含义 |
|---|---|---|
| G01 红线哈希（diff 代理） | 5 个红线文件的 SHA256 必须等于登记值 | 有人悄悄改了评测集/回测/工具层/状态机 |
| G02 契约闸门 | 14 个端点全在册、无未登记端点；SKU 详情 12 个顶层键齐全；`evidence` 14 个字段齐全 | 接口被改名、字段被删 |
| G03 双壳闸门 | SKU-002 / SKU-005 / SKU-017 走 API 与 Agent `run_replenish`，建议量与占用资金必须相等 | 两套入口给出两个数 |
| G04 库闸门 | `replenish_apply=3`、`purchase_order=1`、采购单 13 列、CHECK 约束存在 | 测试弄脏了演示库，或迁移没做 |
| G05 口径闸门（全量测试代理） | `pytest tests` 退出码 0 | 任何回归 |

### 实跑结果（2026-11-19）

```
[G01 红线哈希（diff 代理）] PASS
[G02 契约闸门] PASS      端点数 14/14
[G03 双壳闸门] PASS      SKU-002 0/0、SKU-005 0/0、SKU-017 360 件/3600 元，两壳一致
[G04 库闸门] PASS        行数 3/1，列数 13
[G05 口径闸门（全量测试代理）] PASS   87 passed, 6 subtests passed in 41.97s

结果：5/5 通过
```

### 红线哈希登记值（PACK 19 收尾）

```
tests/cases_ask.json     E2EF2A5EAB693844FCA83857C1457D42996B60E2E6B23DC7DE1181630C237D1D
tests/cases_explain.json C240F6EF22F120F3FE4E5F5E895D43D8B0EC217897AE2478C97EB7E1BC033026
core/backtest.py         985BBDD92057051A37A8CAB3B33FAD9CF96CEE5ACB6A4F22A21EDAECF238A422
agents/tools.py          F2950CFD348698510EE553251EE2BE831292CF95342C2D746D95F62399E87DEB
core/replenish_flow.py   543B3F566DCC8D64BEA2610AFCE48DEF459158722A35B1055690E221E8A976A0
```

> 注意：`cases_explain.json` 是 16c 按新口径重算后的版本；`backtest.py` / `tools.py` 是 16a/16b 改后的版本。这里登记的是“当前 accepted 状态”，不是最初基线——最初基线仍留在 `_backup_pack16a/`、`_backup_pack16c/`。

## 四、双壳一致的边界（别夸大）

- 已验证：默认路线 / 默认目标下，3 个 SKU 的建议量与占用资金一致。
- **未验证**：`route=air` 等非默认路线——Agent 工具 `run_replenish` 当前不接路线参数，只有 API 支持。这不是“两壳不一致”，而是“Agent 壳没有这个能力”；要在文档里写成能力差，不写成 bug 已修。
- 未验证：并发、事务回滚、LLM 实时路径。

## 五、残余风险

1. G01 用哈希代替 diff：能发现“变了”，不能说明“改了哪几行”；对照仍靠 `_backup_packNN`。
2. G02 只校验结构，不校验语义（例如字段在、值为空仍算过）。
3. G03 只覆盖 3 个 SKU × 默认口径，且靠文本正则从 Agent 回执里抠数字；回执文案一改，闸门会误报——这是有意的“文案即契约”。
4. G05 的 pytest 含 `tests/test_replenish_flow.py`，会读写演示库；`tearDownClass` 清理后计数回到 3/1（G04 已验证）。
