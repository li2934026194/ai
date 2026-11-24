import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { M7ApiError, setApiActorState } from "@/api/client";
import {
  m7Api,
  type AuditEventDTO,
  type PackageSummaryDTO,
  type PlatformCode,
  type ProductAvailableItem,
} from "@/api/m7";
import { ALL_9_ROLES } from "@/composables/usePermission";

export const useM7WorkspaceStore = defineStore("m7Workspace", () => {
  const currentOrgId = ref("org_demo");
  const currentRole = ref("creator");
  const currentActorId = ref("u-lin");
  const currentSku = ref("SKU-00704");
  const platform = ref<PlatformCode>("amazon_us");

  const products = ref<ProductAvailableItem[]>([]);
  const summary = ref<PackageSummaryDTO | null>(null);
  const auditEvents = ref<AuditEventDTO[]>([]);
  const engines = ref<Array<{ id: string; name: string; configured: boolean; mode: string }>>([]);
  const healthInfo = ref<{
    dashscope_key_configured: boolean;
    video_ready: boolean;
    strict_separation_of_duties: boolean;
  } | null>(null);

  const loading = ref(false);
  const accessError = ref("");
  const toastMessage = ref("");
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const currentProduct = computed(
    () => products.value.find((p) => p.sku === currentSku.value) || products.value[0] || null
  );

  const doneCnt = computed(() => summary.value?.done_cnt ?? 0);
  const extDoneCnt = computed(() => summary.value?.ext_done_cnt ?? 0);

  function showToast(msg: string) {
    toastMessage.value = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastMessage.value = "";
    }, 3200);
  }

  function syncActorHeaders() {
    setApiActorState({
      orgId: currentOrgId.value,
      role: currentRole.value,
      actorId: currentActorId.value,
    });
  }

  async function switchRole(roleKey: string) {
    const found = ALL_9_ROLES.find((r) => r.key === roleKey);
    currentRole.value = roleKey;
    currentActorId.value = found ? found.actorId : `u-${roleKey}`;
    syncActorHeaders();
    await bootstrap();
    showToast(`已切换岗位：${found ? found.label : roleKey}`);
  }

  async function selectProduct(sku: string, targetPlatform?: PlatformCode) {
    currentSku.value = sku;
    if (targetPlatform) platform.value = targetPlatform;
    await hydrateSummary();
  }

  async function hydrateSummary() {
    accessError.value = "";
    try {
      const [sumRes, audRes] = await Promise.all([
        m7Api.getPackageSummary(currentSku.value, platform.value),
        m7Api.listAuditEvents(currentSku.value),
      ]);
      summary.value = sumRes;
      auditEvents.value = audRes.items;
    } catch (e) {
      if (e instanceof M7ApiError && e.httpStatus === 403) {
        accessError.value = `${e.code}: ${e.message}`;
        summary.value = null;
      } else if (e instanceof M7ApiError) {
        showToast(`${e.code}: ${e.message}`);
      }
    }
  }

  async function bootstrap() {
    syncActorHeaders();
    loading.value = true;
    accessError.value = "";
    try {
      const [h, pRes, eRes] = await Promise.all([
        m7Api.getHealth(),
        m7Api.listAvailableProducts(),
        m7Api.getEnginesStatus(),
      ]);
      healthInfo.value = h;
      products.value = pRes.items;
      engines.value = eRes.engines;
      if (pRes.items.length > 0 && !pRes.items.some((x) => x.sku === currentSku.value)) {
        currentSku.value = pRes.items[0].sku;
      }
      await hydrateSummary();
    } catch (e) {
      if (e instanceof M7ApiError && e.httpStatus === 403) {
        accessError.value = `${e.code}: ${e.message}`;
        products.value = [];
        summary.value = null;
      } else if (e instanceof M7ApiError) {
        showToast(`${e.code}: ${e.message}`);
      }
    } finally {
      loading.value = false;
    }
  }

  return {
    currentOrgId,
    currentRole,
    currentActorId,
    currentSku,
    platform,
    products,
    currentProduct,
    summary,
    auditEvents,
    engines,
    healthInfo,
    doneCnt,
    extDoneCnt,
    loading,
    accessError,
    toastMessage,
    showToast,
    switchRole,
    selectProduct,
    hydrateSummary,
    bootstrap,
  };
});
