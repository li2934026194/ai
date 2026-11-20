# 严格业务风控、9角色权限矩阵与节点级签名契约（V4 · 结构性定稿版）

> 对应流程图目录：`docs/prototypes/modules/`（共 **16 张 PNG**：`m00_rbac_matrix.png` + `m01_shop.png` ~ `m13_kb.png` + `m14_ux_principles.png` + `m15_cross_module_contract.png`）  
> 本版定死 **3 个结构性 P0 契约 + 3 个 P1 防踩坑机制 + 并发与水位线兜底**，保证后续写代码不推翻、不引发改动风暴、不死锁闭环。

---

## 一、P0 三大结构性修复（`m15_cross_module_contract.png`）

### 1. 签名全集补齐 3 个关键版本因子（共 10 个因子）
```text
org_id | shop_id | sku_ver | cost_card_ver | exchange_rate_ver | sales_cutoff_ts | inv_snapshot_id | promo_cal_id | forecast_run_id | po_ver
```
- 新增 **`exchange_rate_ver`**：防止锁汇率变动不被下游财务与补货察觉；
- 新增 **`po_ver`**：防止 PO 锁数量/单价变动不被收货与总览察觉；
- 新增 **`promo_cal_id`**：防止大促改期（如 Prime Day/双 11 调档）预测不重算。

### 2. 拆成「节点级签名子集」（彻底消灭改动风暴）
如果全链共用一个大签名，每天 `sales_cutoff_ts` 变动就会导致下游 5 个模块天天同时判失效。改按实际依赖拆分子集：
- **`sig_order (2)`** = `SHA256(org_id | shop_id | sales_cutoff_ts | order_ver)`
- **`sig_finance (3)`** = `SHA256(org_id | shop_id | cost_card_ver | exchange_rate_ver | sales_cutoff_ts)` *(不依赖大促日历和预测)*
- **`sig_product (4)`** = `SHA256(org_id | shop_id | sku_ver | inv_snapshot_id | cost_card_ver)`
- **`sig_forecast (8)`** = `SHA256(org_id | shop_id | sku_ver | sales_cutoff_ts | inv_snapshot_id | promo_cal_id)` → **每周一冻结成不可变 `forecast_run_id`**，防止日常新单震荡周预测基线；
- **`sig_replenish (9)`** = `SHA256(org_id | shop_id | sku_ver | cost_card_ver | exchange_rate_ver | inv_snapshot_id | forecast_run_id | po_ver)`
- **`sig_dashboard (10)`** = 引用各站冻结快照与 `data_as_of` 水位线对齐（若财务落后订单超 SLA 阈值，亮黄警明示「口径差」而不触发重算风暴）。

> **附加并发防抢占机制**：跨板块上游保护靠节点签名子集，同一条单据的多人并发写（如同时审批同一 PO 或改同一 CostCard）靠 **乐观锁 `row_version` + 请求头 `Idempotency-Key`** 保证不覆盖、不重单。

### 3. `9 补货 → 4 商品库存回写` 校验与环检测（Cycle Guard）
- **回写先验原签名**：`9.5` 三单匹配收货回写库存前，校验本次 `po_ver` 与收货批次 `idempotency_key`；
- **只推新不破旧**：回写成功后生成 **新一代** `inv_snapshot_id (v+1)` 并打标 **`cause = PO_RECEIPT:{po_id}`**，已锁定的旧 PO 永久绑定历史快照，不被新库存反向判失效；
- **环检测防死循环**：带 `cause = PO_RECEIPT` 的库存更新仅刷新 `4 商品` 可售库存及未提交草稿，**严禁**再次回流触发同一 `po_id` 或自动新建下一张补货单，打破 `9 → 4 → 9` 死环。

---

## 二、P1 三大防踩坑优化（`m00_rbac_matrix.png` & `m14_ux_principles.png`）

### 4. 三档审批阈值参数化（`approval_policy_config`）
- 彻底去掉图中写死的 `$3k / $30w` 硬编码，改为按 **`org_id × 站点 × 结算币种 × 业务类型`** 从系统参数表 `approval_policy_config` 动态读取 `Tier1 / Tier2 / Tier3` 阈值（示例种子：美元区默认 `≤$3k` 主管、`>$3k~$30w` 财务、`>$30w` 老板；泰铢/印尼盾/英镑站点按各自币种阈值自动换算路由），防止多币种算错审批档位。

### 5. 30 秒撤回窗口超时兜底（双状态机）
- **缓冲态（`≤ 30 秒`，`PENDING_DISPATCH`）**：退款/内容发布/商品改价/客服发送/补货提交在 30 秒倒计时内处于延迟队列缓冲，点 `[撤回]` **真正拦截不入账/不出站**；
- **超时兜底（`> 30 秒`，`COMMITTED`）**：超过 30 秒交易已入账或消息已发出，撤回按钮物理灰掉并明示「已入账不可真撤回」，强制引导走 **「红字调整单 / 退款申请单 / 公开致歉或下架更正单」** 并写入 SHA-256 哈希链审计日志。

### 6. Owner 白名单裁决（彻底防老板瓶颈）
- 日常业务 `95%` 流程完全下放财务、运营主管与合规；
- Owner 在 `03 财务 / 06 内容 / 13 知识库` 仅留 **`◎ 阅 + 争议裁决`**，在其余业务板块改为 **`★ 白名单裁决`**（仅命中以下 4 类白名单事件才路由老板）：
  1. 金额超过参数表 `Tier3` 巨额上限；
  2. 跨店铺/跨组织解绑或全局停售；
  3. 重大合规/财务争议升级裁决；
  4. 高敏角色授予或修改 `approval_policy_config` 参数阈值。
- **Admin 彻底剥离业务权**：`01~11, 13` 全部显式 `× DENY`，仅留 `12 系统管理` 配置；**Auditor** 全系统 13 板块 **`◎ 全量审计`**（全系统零写）。
