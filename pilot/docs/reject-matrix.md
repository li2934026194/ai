# 拒答与降级矩阵（PACK 21b）

口径：**“拒答”指系统明确不给数字并说明原因；“降级”指给数字但标注限制；“声明”指合成场景提示。**
任何一条都不允许出现“编一个数糊过去”。

## 1. 数据层

| 码 | 语义 | 触发条件 | 返回/页面表现 | 证据 |
|---|---|---|---|---|
| E-1001 | 数据不足 | 有效历史 < 60 天（如「合成-新品零历史」SKU-017 仅 3 天） | `code=E-1001`，正文说明不足天数与 60 天门槛，不返回 qty/金额 | `tests/test_api.py::test_s4_new_sku_e1001`；EX-01 |
| E-1002 | 缺成本 | 产品 `unit_cost IS NULL`（慢动 SKU，刻意不填 0） | 仍给建议量，`capital=null`，文案「成本未填，金额无法计算」，服务水平用默认值 | `tests/test_api.py` 慢动用例；`api/constants.py` |
| E-1003 | SKU/数据集不存在 | 数据集中无该 SKU 订单记录，或 dataset_id 不存在 | `code=E-1003`，不回任何业务数字 | `tests/test_api.py::test_unknown_sku_e1003` |
| E-1004 | 断货占比高（warning，不是拒答） | 历史断货天占比超过阈值 | 照常给建议，`meta.warnings` 带 E-1004，文案说明参考性质 | `tests/test_core.py::test_t08_stockout_ratio_warning` |
| E-4001 | 无需补货 | 建议量算出 0（库存够 / 在途够） | `qty=0`，统一文案「本轮无需补货」，**不显示 0 件** | `test_api.py::test_s1_hero_sku_as_of_no_replenishment`；`constants.NO_REPLENISH_TEXT` |
| E-5001 | 合成场景声明 | 所有 `source_type=SYNTHETIC` 的数据集 | 每个对外回答/页面带「合成场景，结论不可当作真实经营依据」 | `constants.SYNTHETIC_NOTICE`；EX-13 等 30 条解释答案均含声明 |
| E-6001 | CSV 格式错误 | 空内容、缺列、日期/数字非法、日期重复、超限、名称为空 | 整批不写库，返回具体行号/原因 | `test_csv_import.py::test_02/03` |
| E-6002 | 未知 SKU / 缺少商品主数据 | 新 SKU 不在产品主数据且 CSV 未提供任何主数据列 | 整批拒绝，message 明确提示补主数据列 | `test_csv_master_data.py::test_02` |
| E-6003 | 历史不足 | 任一 SKU < 60 天 | 整批拒绝，列出 SKU 与天数 | `test_csv_import.py::test_02` |
| E-6004 | 数据集重名 | 导入名称已存在 | 拒绝，提示换名，不覆盖旧数据集 | `test_csv_master_data.py::test_06` |
| E-6005（PACK 24） | 同 SKU 主数据冲突 | 同一 SKU 多行同一主数据字段值不一致 | 整批拒绝，message 定位字段与两处行号 | `test_csv_master_data.py::test_05/07` |
| E-6006（PACK 24） | 缺少主数据字段 | 新 SKU 填了部分主数据列但没填全 | 整批拒绝，message 定位缺哪个字段 | `test_csv_master_data.py::test_03` |
| E-6007（PACK 24） | 主数据非法值 | 空标题 / 0 或负值 / 非整数 MOQ·箱规·交期 / 非法数字 | 整批拒绝，message 定位行号与列名 | `test_csv_master_data.py::test_04` |

## 2. 履约层

| 码 | 语义 | 触发条件 | 表现 | 证据 |
|---|---|---|---|---|
| E-1101 | 申请不存在 | apply_id 查不到 | 明确说查不到，不改库 | `test_replenish_flow.py` |
| E-1102 | 采购单不存在 | po_id 查不到 | 明确说查不到，不改库 | 同上 |
| E-1103 | 非法流转 | 草稿直接审批、驳回后再审批、终态再收货/再取消 | 拒绝并说明当前状态 | 15 格矩阵 `test_09_po_state_matrix_all_cells` |
| E-1104 | 理由必填 | 驳回/取消原因为空或全空白 | 拒绝，状态不动 | `test_07_cancel_purchase_order`、`test_02_reject_branch` |
| E-1105 | 数量/参数非法 | 收 0 件、不良 > 实收、累计超订单、未知路线/目标 | 拒绝并给出边界 | `test_03_partial_receive_accumulate_and_overflow`、`test_routes.py` |
| E-1106 | 无需补货不能提申请 | 建议量 0 时提交申请 | 拒绝，不产生申请行 | `test_replenish_flow.py` |

## 3. 系统层

| 码 | 语义 | 触发条件 | 表现 | 证据 |
|---|---|---|---|---|
| E-2001 | AI 不可用 | 语义路由/LLM 超时或返回非法 JSON | 回落规则路由或模板草稿，**不编造工具结果** | `test_router_semantic.py`（模型失败回落 A3）、`registry` 兜底 |
| E-3001 | 数据源连不上 | FastAPI 未启动 / 端口不可达 | 前端整页降级提示，不显示任何兜底业务数字 | P1 `alert-missing`；`DataBadge` 在线状态 |

## 4. 一条都不许“答非所问”

拒答类回答必须同时满足：① 明确说不能算；② 说清缺什么（天数/成本/SKU/状态）；③ 不切换数据集替算；④ 仍带合成声明（若适用）。
评测 `tests/cases_explain.json` 的 30 条已逐条校验这四条；`docs/eval-report-v1.md` 四要素 30/30。

## 5. 复跑

```bash
python -m pytest tests/test_api.py tests/test_replenish_flow.py tests/test_csv_import.py -q
python -m pytest tests/test_core.py -q
python -m pytest tests/test_router_semantic.py -q
```
