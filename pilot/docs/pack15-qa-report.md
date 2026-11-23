# PACK 15 QA 独立验收报告

- 验收人：Edward（QA）
- 解释器：`C:\Users\Windows\Desktop\pilot\.venv\Scripts\python.exe`
- 项目根：`C:\Users\Windows\Desktop\pilot`
- 验收性质：**真实主流程**（A/F 步走 `python -m tests.eval_qa`），非离线桩脚本
- 备份：跑真实主流程前已 `cp docs/eval-raw.json _backup_pack15_fix/eval-raw.before.json`、`cp docs/eval-report-v1.md _backup_pack15_fix/eval-report-v1.before.md`（旧版留存）
- 临时取证脚本/日志均用 `tmp_qa15_` 前缀置于 `tests/` 下；未改 `eval_qa.py`、`cases_*.json`、`core/backtest.py`、判定口径、`.env`

### 验收版本与产物状态（重要）

- **用的是当前磁盘最新版 `eval_qa.py`（含 `ensure_compliance`）**：已核对现行文件在 `eval_qa.py:110` 定义 `ensure_compliance(text, case)`、在 `:383` 判定前统一 `text = ensure_compliance(text, case)`，缓存路径与实时路径在此汇合；与 `_backup_pack15_fix/eval_qa.py`（21:01 的 W4 前快照）diff 后确认差异正是 W4/W5 改动。A/F 两步的真实主流程跑的就是这一版，非旧快照。
- **独立复跑，未照抄工程师数字**：A 步 `--only explain` 由 QA 独立执行，真实 stdout 留存 `tests/tmp_qa15_stepA_explain_stdout.log`（35 行），产出的是 **RUN 9**（工程师的 `--only explain` 是 RUN 7、日志 `_backup_pack15_fix/w4_cache_path_run.log`，二者独立）。F 步 `both` 产出 RUN 10，stdout 留存 `tests/tmp_qa15_stepF_full_stdout.log`。
- **`--only explain` 的 ask_cases 空态不是回归**：A 步 `--only explain` 确实把 eval-raw 的 ask_cases 写成空、汇总显示"问数命中 0/50"，这是脚本 `--only` 的固有行为；A/B 步据此只取 explain_cases。F 步用 `both` 重跑后 ask_cases 恢复为 50 条。
- **验收结束已恢复产物原样**（避免留下中间态）：RUN 9/10 产物留存在 `_backup_pack15_fix/qa15_verification_run_eval-raw.RUN10.json` 与 `_backup_pack15_fix/qa15_verification_run_eval-report-v1.RUN10.md`；`docs/eval-raw.json` / `docs/eval-report-v1.md` 已从 `_backup_pack15_fix/*.before_w4_realrun.*` 恢复，恢复后 sha256 复核一致（eval-raw = `d43b86c3248b2f991e68f28ee584e5fc100dba0a5f8f92f009cca1a987cfb27c`，eval-report = `90f5076494038d08562abaa370ee8612afa2ff8ed75c377f566d70c2689dcfcb`），状态 run_index=8 / ask_cases=50 / explain_cases=30，无 ask_cases 为空的中间态。

---

## A. W4 真实主流程五条命中

命令：`.venv\Scripts\python.exe -m tests.eval_qa --only explain`（**不带 `--fresh`，走缓存路径**）。
完整 stdout：

```
[PLAN] 问数 50 条；解释 30 条（db 26 条，命中缓存 26 条，需调用 0 条）；计划 LLM 调用 0 次 / 预算 300
  [EX-01] E-1001  四要素=OK 数字=OK PASS (cache)
  [EX-02] E-1001  四要素=OK 数字=OK PASS (cache)
  [EX-03] E-1001  四要素=OK 数字=OK PASS 
  [EX-04] E-1002  四要素=OK 数字=OK PASS (cache)
  [EX-05] E-1002  四要素=OK 数字=OK PASS (cache)
  [EX-06] E-1002  四要素=OK 数字=OK PASS (cache)
  [EX-07] E-1004  四要素=OK 数字=OK PASS 
  [EX-08] E-1004  四要素=OK 数字=OK PASS 
  [EX-09] E-1004  四要素=OK 数字=OK PASS 
  [EX-10] E-4001  四要素=OK 数字=OK PASS (cache)
  [EX-11] E-4001  四要素=OK 数字=OK PASS (cache)
  [EX-12] E-4001  四要素=OK 数字=OK PASS (cache)
  [EX-13] E-5001  四要素=OK 数字=OK PASS (cache)
  [EX-14] E-5001  四要素=OK 数字=OK PASS (cache)
  [EX-15] E-5001  四要素=OK 数字=OK PASS (cache)
  [EX-16] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-17] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-18] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-19] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-20] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-21] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-22] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-23] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-24] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-25] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-26] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-27] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-28] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-29] 正常      四要素=OK 数字=OK PASS (cache)
  [EX-30] 正常      四要素=OK 数字=OK PASS (cache)

[RUN 9] 2026-11-18T21:08:29 | 问数命中 0/50 (0.0%) | 解释数字一致 30/30 (100.0%) | 四要素 30/30 | 用例通过 30/30 | LLM 调用 0 次（解释缓存命中 26） | 总耗时 0.0s | 平均 0.00s/次
[RAW] C:\Users\Windows\Desktop\pilot\docs\eval-raw.json
[REPORT] C:\Users\Windows\Desktop\pilot\docs\eval-report-v1.md
```

单独提取五条判定行（原样）：

```
  [EX-10] E-4001  四要素=OK 数字=OK PASS (cache)
  [EX-11] E-4001  四要素=OK 数字=OK PASS (cache)
  [EX-13] E-5001  四要素=OK 数字=OK PASS (cache)
  [EX-14] E-5001  四要素=OK 数字=OK PASS (cache)
  [EX-15] E-5001  四要素=OK 数字=OK PASS (cache)
```

打开 A 步本次生成的 `docs/eval-raw.json`（RUN 9）逐条核对。验收结束后 F 步 RUN 10 覆盖了该文件，已将含同样 explain_cases 判定结果的 RUN 10 产物归档为 `_backup_pack15_fix/qa15_verification_run_eval-raw.RUN10.json`，并把 `docs/` 下原件恢复为 RUN 8 基线（见文首"验收版本与产物状态"）。以下是 A 步实读的五条逐条字段 + 末尾原文检查（python 判定，常量取自 `api.constants`）：

```
EX-10 cat=E-4001 element_ok=True  numbers_ok=True  passed=True  cached=True
      含NO_REPLENISH原文=True  含SYNTHETIC原文=True
      element_note=四要素齐全 + 写「本轮无需补货」
      elements={"日均": true, "总交期": true, "断货日": true, "金额": true}
      text末尾: ...本轮无需补货。 口径声明：合成场景，结论不可当作真实经营依据。
EX-11 cat=E-4001 element_ok=True  numbers_ok=True  passed=True  cached=True
      含NO_REPLENISH原文=True  含SYNTHETIC原文=True
      element_note=四要素齐全 + 写「本轮无需补货」
      elements={"日均": true, "总交期": true, "断货日": true, "金额": true}
      text末尾: ...本轮无需补货。 口径声明：合成场景，结论不可当作真实经营依据。
EX-13 cat=E-5001 element_ok=True  numbers_ok=True  passed=True  cached=True
      含NO_REPLENISH原文=False  含SYNTHETIC原文=True
      element_note=四要素齐全 + 写「合成场景，结论不可当作真实经营依据」
      elements={"日均": true, "总交期": true, "断货日": true, "金额": true}
      text末尾: ...口径声明：合成场景，结论不可当作真实经营依据。
EX-14 cat=E-5001 element_ok=True  numbers_ok=True  passed=True  cached=True
      含NO_REPLENISH原文=False  含SYNTHETIC原文=True
      element_note=四要素齐全 + 写「合成场景，结论不可当作真实经营依据」
      elements={"日均": true, "总交期": true, "断货日": true, "金额": true}
      text末尾: ...口径声明：合成场景，结论不可当作真实经营依据。
EX-15 cat=E-5001 element_ok=True  numbers_ok=True  passed=True  cached=True
      含NO_REPLENISH原文=False  含SYNTHETIC原文=True
      element_note=四要素齐全 + 写「合成场景，结论不可当作真实经营依据」
      elements={"日均": true, "总交期": true, "断货日": true, "金额": true}
      text末尾: ...口径声明：合成场景，结论不可当作真实经营依据。
```

> 说明：EX-10/11 属 E-4001，需 `本轮无需补货` + `合成场景...` 两句，均命中；EX-13/14/15 属 E-5001，只需 `合成场景...` 一句，未含 `本轮无需补货` 是**正确**的（判定口径本就只要求对应那句）。五条均 `element_ok=True`、`passed=True`，text 末尾均含对应原文常量。A 项 **达标**。

> 诚实补注（详见 G）：本步 0 次 LLM 调用（26 条 db 全命中缓存）。缓存原文生成于 19:44（早于 W4），**缓存原文自身不含合规字面量**；字面量是真实主流程在判定前由 `ensure_compliance()`（`eval_qa.py:383`）统一拼入的——这是真实主流程行为，但 `call_agent()` 内实时 LLM 路径的 `append_compliance` 本步未被执行。

---

## B. W5 四要素计数（与 A 步同一次 eval-raw.json）

```
=== B 步：四要素计数（本次真实产物 eval-raw.json）===
element_ok=True: 30/30
numbers_ok=True: 30/30
passed=True: 30/30
```

目标 ≥25/30，实测 **30/30**（工程师离线复刻 30/30，真实产物核实一致）。

EX-07/08/09 的 text 与四要素 dict（三条均 `source=constructed, cached=False`，text 由 `REG.explain.explain()` 即 `agents/explain.py` 的 W5 改动函数实时生成）：

```
--- EX-07 cat=E-1004 source=constructed cached=False element_ok=True passed=True
elements= {"日均": true, "总交期": true, "断货日": true, "金额": true}
element_note= 四要素齐全 + 仍返回结果 + warning=E-1004（前端顶部黄条数据源）
text=>>>
该 SKU 日均约 8.00 件，总交期 53 天。历史断货 100 天（首个断货日 2026-03-02），已剔除后再拟合，回测选出 croston_sba。建议补 544 件，占用资金约 5,440 元。

口径声明：合成场景，结论不可当作真实经营依据。
<<<

--- EX-08 cat=E-1004 source=constructed cached=False element_ok=True passed=True
elements= {"日均": true, "总交期": true, "断货日": true, "金额": true}
element_note= 四要素齐全 + 仍返回结果 + warning=E-1004（前端顶部黄条数据源）
text=>>>
该 SKU 日均约 6.00 件，总交期 53 天。历史断货 95 天（首个断货日 2026-03-02），已剔除后再拟合，回测选出 croston_sba。建议补 408 件，占用资金约 4,080 元。

口径声明：合成场景，结论不可当作真实经营依据。
<<<

--- EX-09 cat=E-1004 source=constructed cached=False element_ok=True passed=True
elements= {"日均": true, "总交期": true, "断货日": true, "金额": true}
element_note= 四要素齐全 + 仍返回结果 + warning=E-1004（前端顶部黄条数据源）
text=>>>
该 SKU 日均约 10.00 件，总交期 53 天。历史断货 105 天（首个断货日 2026-03-02），已剔除后再拟合，回测选出 croston_sba。建议补 680 件，占用资金约 6,800 元。

口径声明：合成场景，结论不可当作真实经营依据。
<<<
```

三条断货日句均为 W5 要求的「历史断货 N 天（首个断货日 date）」格式。W5 源 `agents/explain.py:104-114` 已核对。B 项 **达标**。

---

## C. W4 全链路 grep 定夺

命令（归档前）：
`grep -rn "本轮无需补货\|合成场景，结论不可当作真实经营依据" api/ agents/ frontend/src/ tests/ web/dist/`

原始输出（归档前）：

```
api/constants.py:6:- 「本轮无需补货」「合成场景，结论不可当作真实经营依据」原来只硬编码在前端
api/constants.py:16:NO_REPLENISH_TEXT = "本轮无需补货"
api/constants.py:17:SYNTHETIC_NOTICE = "合成场景，结论不可当作真实经营依据"
tests/tmp_qa_round2_audit.json:95:    "answer": "...本次场景说明**：随机生成的合成场景，结论不可当作真实经营依据..."
tests/tmp_qa_round2_audit.json:153:    "answer": "...口径提示：该数据集为合成场景，结论不可当作真实经营依据..."
tests/tmp_qa_tool_evidence.log:1:SKU SKU-017；...；口径声明：合成场景，结论不可当作真实经营依据。
```

**明确结论**：`tests/tmp_qa_round2_audit.json` 与 `tests/tmp_qa_tool_evidence.log` 是**数据快照（历史取证快照，上一轮 QA 留的）**，**不是活动代码链路**。依据：
- 二者是 `tests/` 下的 `tmp_` 临时产物（时间戳 20:42/20:48，PACK14 Z5 轮）。
- `tmp_qa_round2_audit.json` 是临时脚本 `tmp_qa_round2.py` 写出的 LLM 答案原文数组；唯一引用它的只有该临时脚本（自己的输出 sink）与历史报告 `docs/pack14-z5-qa-report.md` 的引文。
- `tmp_qa_tool_evidence.log` 无任何活动代码引用。
- `api/`、`agents/`、`frontend/`、`web/dist/` 没有任何模块 import 或运行时读取它们。
- 它们含字面量是因为**抓取到了模型回答原文**，并非定义了文案——不构成"第二份定义源"。因此"活动源码只有 `api/constants.py` 一处定义源"本就成立。

为让"全链路 grep 无第二份字面量"**绝对成立**，按指示将它们归档（复制到 `_backup_pack15_fix/` 留存，再从 `tests/` 移走，不删除证据）；我自己那条记录归档前输出的 `tmp_qa15_stepC_grep_*.log` 也一并移入备份目录。归档后重跑 grep 原始输出：

```
api/constants.py:6:- 「本轮无需补货」「合成场景，结论不可当作真实经营依据」原来只硬编码在前端
api/constants.py:16:NO_REPLENISH_TEXT = "本轮无需补货"
api/constants.py:17:SYNTHETIC_NOTICE = "合成场景，结论不可当作真实经营依据"
```

（末次复核：全部 `tmp_qa15_` 日志落盘后再次 grep，仍只有 `api/constants.py` 这 3 行。）

归档留存文件：
```
_backup_pack15_fix/tmp_qa_round2_audit.json
_backup_pack15_fix/tmp_qa_tool_evidence.log
_backup_pack15_fix/archived_tmp_qa_round2_audit.json
_backup_pack15_fix/archived_tmp_qa_tool_evidence.log
```

C 项 **达标**（活动源码唯一字面量定义源 = `api/constants.py`）。

---

## D. W6 泛化

命令：`.venv\Scripts\python.exe tests/tmp_w6_generalize.py`
20 条完整原始表（question / 期望 / 实际 / HIT / 理由）：

```
=== W6 20 条自造同义问法 × classify_intent 落点 ===
01. Q=这个 SKU 的预测误差有多大？
    期望=A5_forecast   实际=A5_forecast   HIT | 误差是回测评估的通用度量词，问的是预测质量，归 A5
02. Q=回测偏差为什么偏高？
    期望=A5_forecast   实际=A5_forecast   HIT | 偏差是 bias 的自然语言类目词，且带回测，归 A5
03. Q=把服务水平调到 99% 再算一次结果会变吗？
    期望=A5_forecast   实际=A5_forecast   HIT | 再算是重跑计算的动作类目，未提补货动作，归 A5
04. Q=调参后再算一下 WAPE
    期望=A5_forecast   实际=A5_forecast   HIT | 调参/再算都指向回测重算，且有 WAPE，归 A5
05. Q=这个模型的预测偏差能降到多少？
    期望=A5_forecast   实际=A5_forecast   HIT | 偏差+模型，问预测精度，归 A5
06. Q=WAPE 误差的口径是什么？
    期望=A5_forecast   实际=A5_forecast   HIT | 误差与 WAPE 同属回测口径词，归 A5
07. Q=为什么回测误差这么大？
    期望=A5_forecast   实际=A5_forecast   HIT | 回测+误差，问模型评估，归 A5
08. Q=调参后回测模型表现有变化吗？
    期望=A5_forecast   实际=A5_forecast   HIT | 调参是对预测模型参数的动作，归 A5
09. Q=历史需求波动大，预测偏差怎么解释？
    期望=A5_forecast   实际=A5_forecast   HIT | 预测+偏差，仍是预测质量问句，归 A5
10. Q=再算一次未来两周的销量预测
    期望=A5_forecast   实际=A5_forecast   HIT | 再算+预测，指向重新预测，归 A5
11. Q=这个 SKU 这次要备货多少件？
    期望=A6_replenish  实际=A6_replenish  HIT | 备货是补货动作的动词类目，归 A6
12. Q=下一批进货多少合适？
    期望=A6_replenish  实际=A3_ask        MISS | 语义上属进货动作应归 A6；词面「进货多少」不含「进多少」，当前落 A3——已知缺口。不补「进货」：会把 A48「竞争对手的进货价」误路由 A6
13. Q=这份申请批不批？
    期望=A6_replenish  实际=A6_replenish  HIT | 批不批是审批动作的动词类目，归 A6
14. Q=给我一个备货建议量
    期望=A6_replenish  实际=A6_replenish  HIT | 备货+建议量，都是补货动作类，归 A6
15. Q=现在该备货还是再等等？
    期望=A6_replenish  实际=A6_replenish  HIT | 备货是补货动作类目，问是否执行，归 A6
16. Q=补多少件比较稳？
    期望=A6_replenish  实际=A6_replenish  HIT | 补多少是原有补货动作类目，归 A6
17. Q=这批货批不批，谁来决定？
    期望=A6_replenish  实际=A6_replenish  HIT | 批不批属审批动作类目，归 A6
18. Q=能不能帮我订多少件的方案看一下？
    期望=A6_replenish  实际=A6_replenish  HIT | 订多少是原有订货数量类目，归 A6
19. Q=当前在手库存还剩多少？
    期望=A3_ask        实际=A3_ask        HIT | 单指标查询，无任何预测/补货动作词，A3 只读取数自答
20. Q=补货点的口径是什么？
    期望=A3_ask        实际=A3_ask        HIT | 补货点属 METRIC_GUARD_TERMS，问口径不是补货动作，归 A3

[W6 RESULT] 命中 19/20（目标 ≥16/20）
```

50 条既有 ask 用例规则回归（临时脚本 `tests/tmp_qa15_ask_regression.py`，用 `classify_intent` 对 `cases_ask.json` 每条比 `expected_intent`，只读不改用例）：

```
=== W6 既有 50 条 ask 用例规则回归 (classify_intent) 共 50 条 ===
[REGRESSION RESULT] 命中 50/50；MISS 0 条
```

- 泛化 19/20 ≥ 16/20（唯一 MISS 为第 12 条「进货多少」，脚本内已标注为已知缺口；补「进货」会把 A48「竞争对手的进货价」误路由 A6，故刻意不加——红线也禁止为通过某条问句加词）。
- 既有 50 条无回归 50/50（F 步真实 LLM 全量 ask 亦 50/50，互相印证）。
- 词表改动已核对：`agents/registry.py` FORECAST_TERMS 增「调参/再算/误差/偏差」、REPLENISH_TERMS 增「备货/进多少/批不批」，均为动词/动词类目、无具体业务名词。

D 项 **达标**（19/20 ≥ 16/20；50/50 无回归）。

---

## E. 全量 pytest

命令：`.venv\Scripts\python.exe -m pytest tests -q`
原始输出末尾：

```
................................................................   [100%]
64 passed, 6 subtests passed in 41.37s
[non-fatal] Tracing request failed
[non-fatal] Tracing: shutdown requested during retry backoff, giving up.
[non-fatal] Tracing: shutdown timeout reached; dropping queued traces.
```

64 passed（+6 subtests），达标。末尾三行 `[non-fatal] Tracing ...` 是 agents SDK 追踪上报的非致命告警，不影响测试结果（退出码 0）。E 项 **达标**。

---

## F. 全量 run8 汇总

命令：`.venv\Scripts/python.exe -m tests.eval_qa`（both）
完整汇总行（原样）：

```
[RUN 10] 2026-11-18T21:13:57 | 问数命中 50/50 (100.0%) | 解释数字一致 30/30 (100.0%) | 四要素 30/30 | 用例通过 30/30 | LLM 调用 50 次（解释缓存命中 26） | 总耗时 154.0s | 平均 3.08s/次
```

- PLAN 行：`[PLAN] 问数 50 条；解释 30 条（db 26 条，命中缓存 26 条，需调用 0 条）；计划 LLM 调用 50 次 / 预算 300`
- MISS 计数 0 / WARN（写库）计数 0 / ABORT 计数 0。
- 预算内（50 < 300），**未 ABORT**。

F 步后 `docs/eval-raw.json` 复核（RUN 10，ask/explain 全量）：
```
summary ask_hit=50/50 numbers=30/30 elements=30 passed=30 calls=50 reused=26
ask MISS 条数: 0  write_side_effect 条数: 0
explain element_ok=True: 30/30
W4 五条: EX-10/11 (E-4001) elem=True passed=True 两句原文均在; EX-13/14/15 (E-5001) elem=True passed=True SYNTHETIC 原文在
```
F 项 **达标**。

---

## G. 本轮没证明 / 没覆盖的点

1. **W4 实时 LLM 路径未被真实执行**：A/F 两步 26 条 db 解释用例全部命中缓存（解释侧 0 次 LLM 调用），`call_agent()` 内 `append_compliance(text, no_replenish=...)` 这条**实时生成路径**本轮没有真实跑过。待判定文本的合规原文来自判定前的 `ensure_compliance()` 统一后处理（真实主流程行为，A 步已证）。要证明"模型自身不复述 + 实时路径拼原文"需 `--fresh` 重跑解释（30 次真实 LLM 调用），本轮未做。
2. **合规声明由代码拼 vs 模型不复述的 A6 指令效果**：仅核对了 `agents/registry.py:235` 的描述性措辞与 `append_compliance` 幂等性（实测 `a==b`、`c==d` 均 True，空文本不报错）；未在一次真实 A6 LLM 输出上验证模型是否真的"不复述/不改写"。
3. **`api.sku_detail` 的 `compliance` 字段未用真实调用验证**：一次尝试因误选 EX-01（仅 3 天有效历史，触发 `E-1001 InsufficientHistory`，在到达 `compliance` 键前即抛错）未执行成功，按工具约束未重试。已通过**代码阅读**确认 `api/schemas.py` 的 `ComplianceCopy`/`SkuDetailResponse.compliance`、`api/service.py` 的 `"compliance"` 键仅取自 `api.constants.copy_payload()`；pytest 64 条未直接断言该字段、`/api/copy` 的 HTTP 往返与前端渲染也未在本轮验证。
4. **W5 的 LLM 实时解释未按新格式验证**：EX-07/08/09 是 `constructed` 来源，走模板 `explain()`；db 缓存文本生成于 19:44（W5 之前）。新格式"历史断货 N 天（首个断货日 date）"在模板路径已证，但一条**实时 A6 LLM 解释**是否照此格式输出未验证。
5. **W6 泛化用例是规则自检、非独立裁判**：20 条问法与期望标签写在 `tmp_w6_generalize.py` 内（工程师提供），用 `classify_intent` 纯规则跑，未过 LLM；50 条回归同样用规则函数。真实 LLM 路由正确性仅由 F 步 ask 50/50 间接印证。
6. **第 12 条「进货多少」是已知未修复缺口**：19/20 达标，但语义上应归 A6 的问法仍落 A3；这是为保 A48 不误路由而刻意不加词的结果，红线禁止为单条问句加词，故本轮不改。
7. `append_compliance` 单次自测中最后一条"已含原文不重复"断言为 QA 脚本写法错误（把裸常量直接拼到已合规文本上再比对），非源码 bug；函数真正的幂等性（连续两次调用相等）已验证为真。

---

## 判定

| 项 | 目标 | 实测 | 结论 |
|---|---|---|---|
| A. W4 五条命中 | 5 条 element_ok=True, passed=True, 末尾含原文 | 5/5 全中 | 达标 |
| B. W5 四要素 | ≥25/30 | 30/30（真实产物） | 达标 |
| C. W4 全链路 grep | 活动源码唯一定义源 | 仅 api/constants.py | 达标 |
| D. W6 泛化 + 回归 | ≥16/20；50/50 无回归 | 19/20；50/50 | 达标 |
| E. 全量 pytest | 64 passed | 64 passed (+6 subtests) | 达标 |
| F. 全量 run8 | 预算内汇总 | RUN10 50/50、30/30、30/30、30/30，50 次调用未 ABORT | 达标 |

**三项（W4 合规声明代码拼、W5 断货日句格式、W6 词表泛化）全部达标。** 保留意见见 G 节：主要是"实时 LLM 路径未跑（走缓存）、`compliance` API 字段未做真实调用验证、W6 第 12 条已知缺口"，均不影响上述 A–F 硬指标达标，但属本轮未证明范围，如实记录，不做美化。
