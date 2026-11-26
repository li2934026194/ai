# CrossPilot 原型图与交互前端索引（仅保留最新 SRS V6/对齐版本）

为保持仓库整洁，本目录仅保留最新对齐 `docs/requirements/AI跨境电商平台V1.0-软件需求规格说明书.md` 的四套最新成果与配套说明文档：

1. **可点击交互式 Web 前端原型（最新）**：[`docs/prototypes/web/`](./web/index.html)（离线单文件包：[`crosspilot_standalone.html`](./web/crosspilot_standalone.html)）
   - 左侧手风琴二级下拉菜单（M0~M8 共 **27 个独立子页面**：M0 3页、M1 4页、M2 2页、M3 2页、M4 3页、M5 3页、M6 4页、M7 4页、M8 2页）；默认全屏 SaaS 工作台，右侧「SRS注释与来源台账」收进抽屉按需展开。
   - 左上角 **SRS V1.0 §1.5 原文 9 大业务角色**实时切换，联动左侧角色待办角标；覆盖 M0-3 三店铺×仓库独立盘点、M4 卡片筛选分页工作台、M5/M6 实时算式旁注与普通/智能补货分支分离（含 `FORECAST_REQUIRED` 阻断）、M7 1大+4小套图局部修改与 8 类整套交付清单、M8 员工名册与9角色矩阵。
2. **高保真带注释分屏 UI 原型图（20 页按钮跳转拆分布局）**：[`docs/prototypes/ui_v6/`](./ui_v6/README.md)
3. **通俗版 1→2→3 业务与数据流程图（10 张）**：[`docs/prototypes/simple_v6/`](./simple_v6/)
   - 配套通俗说明文档：[`docs/plans/业务与数据通俗说明_123步骤.md`](../plans/业务与数据通俗说明_123步骤.md)
4. **SRS 对齐版标准数据流图 V6（11 张，含 9 角色细颗粒权限矩阵）**：[`docs/prototypes/dfd_v6/`](./dfd_v6/)
   - 配套需求分析与偏差报告：[`docs/plans/需求分析文档_V2_对齐SRS与V6数据流.md`](../plans/需求分析文档_V2_对齐SRS与V6数据流.md) · [`docs/plans/srs-deviation-analysis.md`](../plans/srs-deviation-analysis.md)
