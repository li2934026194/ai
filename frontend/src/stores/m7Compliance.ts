import { defineStore } from "pinia";
import { ref } from "vue";
import { M7ApiError } from "@/api/client";
import { m7Api, type CertRecordDTO, type ComplianceRuleDTO } from "@/api/m7";
import { useM7WorkspaceStore } from "./m7Workspace";

export const useM7ComplianceStore = defineStore("m7Compliance", () => {
  const rules = ref<ComplianceRuleDTO[]>([]);
  const certs = ref<CertRecordDTO[]>([]);
  const errorMsg = ref("");
  const busy = ref(false);
  const buyerDrawerOpen = ref(false);
  const approveNote = ref("核验通过，准予离线交付导出");

  async function loadMatrix() {
    const ws = useM7WorkspaceStore();
    try {
      const res = await m7Api.getComplianceMatrix(ws.currentSku);
      rules.value = res.rules;
      certs.value = res.certs;
    } catch (e) {
      if (e instanceof M7ApiError) errorMsg.value = `${e.code}: ${e.message}`;
    }
  }

  async function saveRule(rule: ComplianceRuleDTO) {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    errorMsg.value = "";
    try {
      await m7Api.updateComplianceRule(rule.rule_id, {
        title_max_chars: rule.title_max_chars,
        bullet_max_chars: rule.bullet_max_chars,
        search_terms_max_bytes: rule.search_terms_max_bytes,
        lexicon_json: rule.lexicon_json,
        required_certs_json: rule.required_certs_json,
      });
      await loadMatrix();
      ws.showToast(`规则 ${rule.platform} / ${rule.category} 已更新`);
    } catch (e) {
      if (e instanceof M7ApiError) errorMsg.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function renewCert(payload: {
    sku: string;
    cert_type: string;
    cert_no: string;
    expire_date: string;
  }) {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    errorMsg.value = "";
    try {
      await m7Api.renewCert(payload);
      await loadMatrix();
      await ws.hydrateSummary();
      ws.showToast(`资质 ${payload.cert_type} 已更新至 ${payload.expire_date}`);
    } catch (e) {
      if (e instanceof M7ApiError) errorMsg.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function run5Checks() {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    errorMsg.value = "";
    try {
      const res = await m7Api.runComplianceCheck({
        sku: ws.currentSku,
        platform: ws.platform,
      });
      await ws.hydrateSummary();
      ws.showToast(res.overall_pass ? "5 项上架合规检查全部通过！" : "合规检查存在阻断项，请按提示跳转修复");
    } catch (e) {
      if (e instanceof M7ApiError) errorMsg.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function approve(decision: "APPROVED" | "REJECTED") {
    const ws = useM7WorkspaceStore();
    if (!approveNote.value.trim()) {
      errorMsg.value = "请填写主管审批意见";
      return;
    }
    busy.value = true;
    errorMsg.value = "";
    try {
      await m7Api.approvePackage({
        sku: ws.currentSku,
        platform: ws.platform,
        decision,
        note: approveNote.value.trim(),
      });
      await ws.hydrateSummary();
      ws.showToast(decision === "APPROVED" ? "主管已批准发布包，现可导出离线包" : "已驳回发布包");
    } catch (e) {
      if (e instanceof M7ApiError) errorMsg.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function exportFile(format: "zip" | "html") {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    errorMsg.value = "";
    try {
      const { blob, filename } = await m7Api.exportPackage(ws.currentSku, ws.platform, format);
      // 兼容受限环境（TC-CMP-06）安全判空
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      }
      await ws.hydrateSummary();
      ws.showToast(`已生成并下载离线交付包 ${filename}`);
    } catch (e) {
      if (e instanceof M7ApiError) errorMsg.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  return {
    rules,
    certs,
    errorMsg,
    busy,
    buyerDrawerOpen,
    approveNote,
    loadMatrix,
    saveRule,
    renewCert,
    run5Checks,
    approve,
    exportFile,
  };
});
