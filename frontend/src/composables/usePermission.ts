import { computed } from "vue";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

export const ALL_9_ROLES = [
  {
    key: "creator",
    label: "内容创作 / 审核人员 (林设计)",
    actorId: "u-lin",
    badge: "内容创作",
    focusDesc: "M7 图文/视频/A+ 创作与合规送检",
    homeRoute: "/m7/copy",
  },
  {
    key: "approver",
    label: "主管 / 审批人 (陈主管)",
    actorId: "u-chen",
    badge: "终审放行",
    focusDesc: "选品/调价/售后/补货/发布终审与权限管理",
    homeRoute: "/m4/approval",
  },
  {
    key: "manager",
    label: "大屏浏览者 / 管理者 (王总监)",
    actorId: "u-wang",
    badge: "全盘监督",
    focusDesc: "经营大屏总览、店铺授权与组织治理",
    homeRoute: "/m2/overview",
  },
  {
    key: "planner",
    label: "驾驶舱设计者 / 业务运营 (张运营)",
    actorId: "u-zhang",
    badge: "运营+驾驶舱",
    focusDesc: "驾驶舱布局设计、补货测算、广告投放与改价",
    homeRoute: "/m2/overview",
  },
  {
    key: "selector",
    label: "选品研究员 (吴选品)",
    actorId: "u-wu",
    badge: "选品评估",
    focusDesc: "候选导入、五维打分与利润测算",
    homeRoute: "/m4/workbench",
  },
  {
    key: "bi_analyst",
    label: "数据分析 / BI 人员 (周分析)",
    actorId: "u-zhou",
    badge: "BI问数+竞品",
    focusDesc: "驾驶舱配置、竞品监控、智能问数与周复盘",
    homeRoute: "/m3/ask",
  },
  {
    key: "warehouse",
    label: "采购 / 仓库 / 物流人员 (赵仓管)",
    actorId: "u-zhao",
    badge: "仓储+收货",
    focusDesc: "人工盘点、PO 发货与分批质检收货",
    homeRoute: "/m6/receiving",
  },
  {
    key: "cs",
    label: "客服 (李客服)",
    actorId: "u-li",
    badge: "客服+售后",
    focusDesc: "买家会话回复与售后退款建单",
    homeRoute: "/m1/sessions",
  },
  {
    key: "mock_buyer",
    label: "测试买家 (测试买家)",
    actorId: "u-buyer",
    badge: "模拟联调",
    focusDesc: "安全模拟买家进线测试（MOCK 隔离）",
    homeRoute: "/m1/simulator",
  },
] as const;

const PERMS_MAP: Record<string, Set<string>> = {
  approver: new Set([
    "m0:read", "m0:cost:approve",
    "m1:read", "m1:aftersales:approve",
    "m2:read",
    "m3:read",
    "m4:read", "m4:approve",
    "m5:read",
    "m6:read", "m6:approve",
    "m7:content:read", "m7:content:edit", "m7:compliance:run",
    "m7:rule:maintain", "m7:publish:approve", "m7:package:export",
    "m8:read", "m8:manage",
  ]),
  creator: new Set([
    "m0:read",
    "m1:read",
    "m7:content:read", "m7:content:edit", "m7:compliance:run", "m7:package:export",
  ]),
  manager: new Set([
    "m0:read", "m0:shop:manage",
    "m1:read", "m2:read", "m3:read", "m4:read", "m5:read", "m6:read",
    "m7:content:read", "m8:read", "m8:manage",
  ]),
  planner: new Set([
    "m0:read", "m0:cost:propose",
    "m1:read", "m1:faq:edit",
    "m2:read", "m2:edit",
    "m3:read", "m4:read",
    "m5:read", "m5:run",
    "m6:read", "m6:draft",
    "m7:content:read",
  ]),
  selector: new Set([
    "m0:read", "m4:read", "m4:edit", "m5:read", "m7:content:read",
  ]),
  bi_analyst: new Set([
    "m0:read",
    "m2:read", "m2:edit",
    "m3:read", "m3:edit", "m3:ask",
    "m4:read",
    "m5:read", "m5:review",
  ]),
  warehouse: new Set([
    "m0:read", "m0:inventory:edit",
    "m5:read", "m6:read", "m6:receive",
  ]),
  cs: new Set([
    "m0:read", "m1:read", "m1:session:edit", "m1:aftersales:submit", "m1:simulator:run",
  ]),
  mock_buyer: new Set(["m1:simulator:run"]),
};

export function usePermission() {
  const ws = useM7WorkspaceStore();
  const perms = computed(() => PERMS_MAP[ws.currentRole] || new Set<string>());

  const hasPerm = (code: string) => perms.value.has(code);

  return {
    perms,
    hasPerm,
    roleMeta: computed(
      () => ALL_9_ROLES.find((r) => r.key === ws.currentRole) || ALL_9_ROLES[0]
    ),
    canRead: computed(() => hasPerm("m7:content:read")),
    canEdit: computed(() => hasPerm("m7:content:edit")),
    canRunCompliance: computed(() => hasPerm("m7:compliance:run")),
    canMaintainRules: computed(() => hasPerm("m7:rule:maintain")),
    canApprove: computed(() => hasPerm("m7:publish:approve")),
    canExport: computed(() => hasPerm("m7:package:export")),
    canDesignCockpit: computed(() => hasPerm("m2:edit")),
  };
}
