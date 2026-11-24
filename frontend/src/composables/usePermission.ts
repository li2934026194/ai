import { computed } from "vue";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

export const ALL_9_ROLES = [
  { key: "creator", label: "内容创作 / 审核人员 (林设计)", actorId: "u-lin", badge: "创作+送检" },
  { key: "approver", label: "主管 / 审批人 (陈主管)", actorId: "u-chen", badge: "终审放行" },
  { key: "manager", label: "大屏浏览者 / 管理者 (王总监)", actorId: "u-wang", badge: "仅查看" },
  { key: "planner", label: "驾驶舱设计者 / 业务运营 (张运营)", actorId: "u-zhang", badge: "仅查看" },
  { key: "selector", label: "选品研究员 (吴选品)", actorId: "u-wu", badge: "仅查看" },
  { key: "bi_analyst", label: "数据分析 / BI 人员 (周分析)", actorId: "u-zhou", badge: "无M7权限" },
  { key: "warehouse", label: "采购 / 仓库 / 物流人员 (赵仓管)", actorId: "u-zhao", badge: "无M7权限" },
  { key: "cs", label: "客服 (李客服)", actorId: "u-li", badge: "无M7权限" },
  { key: "mock_buyer", label: "测试买家 (测试买家)", actorId: "u-buyer", badge: "无M7权限" },
] as const;

const PERMS_MAP: Record<string, Set<string>> = {
  approver: new Set([
    "m7:content:read",
    "m7:content:edit",
    "m7:compliance:run",
    "m7:rule:maintain",
    "m7:publish:approve",
    "m7:package:export",
  ]),
  creator: new Set([
    "m7:content:read",
    "m7:content:edit",
    "m7:compliance:run",
    "m7:package:export",
  ]),
  manager: new Set(["m7:content:read"]),
  planner: new Set(["m7:content:read"]),
  selector: new Set(["m7:content:read"]),
  bi_analyst: new Set(),
  warehouse: new Set(),
  cs: new Set(),
  mock_buyer: new Set(),
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
  };
}
