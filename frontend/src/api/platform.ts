import axios from "axios";
import { getApiActorState, httpClient, M7ApiError, type ApiEnvelope } from "@/api/client";

async function platReq<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options?: { data?: unknown; params?: Record<string, string | number | undefined> }
): Promise<T> {
  const { orgId } = getApiActorState();
  const url = `/api/v1/orgs/${encodeURIComponent(orgId)}${path}`;
  try {
    const resp = await httpClient.request<ApiEnvelope<T>>({
      method,
      url,
      data: options?.data,
      params: options?.params,
    });
    const body = resp.data;
    if (body && body.code && body.code !== "OK") {
      throw new M7ApiError(body.code, body.message, resp.status, body.data);
    }
    return body.data;
  } catch (err) {
    if (err instanceof M7ApiError) throw err;
    if (axios.isAxiosError(err) && err.response) {
      const payload = err.response.data as Partial<ApiEnvelope> | undefined;
      throw new M7ApiError(
        payload?.code || `HTTP-${err.response.status}`,
        payload?.message || err.message,
        err.response.status,
        payload?.data ?? null
      );
    }
    throw new M7ApiError("NETWORK_ERROR", (err as Error)?.message || "网络请求失败", 0);
  }
}

export const platformApi = {
  // Home
  getHomeWorkbench: () =>
    platReq<{
      kpis: {
        active_skus: number;
        connected_shops: number;
        gmv_usd: number;
        open_alerts: number;
        pending_replenish: number;
        pending_aftersales: number;
      };
      todos: Array<{ id: string; module: string; title: string; desc: string; route: string }>;
    }>("GET", "/home/workbench"),

  // M0
  listShops: () => platReq<{ items: any[] }>("GET", "/m0/shops"),
  createShop: (data: {
    shop_code: string;
    name: string;
    platform: string;
    currency: string;
    credential_mask?: string;
    is_mock: boolean;
  }) => platReq<any>("POST", "/m0/shops", { data }),
  syncShop: (shopId: string) => platReq<any>("POST", `/m0/shops/${shopId}/sync`),
  listFxRates: () => platReq<{ items: any[] }>("GET", "/m0/fx-rates"),
  listProducts: () => platReq<{ items: any[] }>("GET", "/m0/products"),
  upsertProduct: (data: any) => platReq<any>("POST", "/m0/products", { data }),
  getLedger: () =>
    platReq<{ orders: any[]; quotes: any[]; cost_requests: any[] }>("GET", "/m0/ledger"),
  proposeCost: (data: { sku: string; new_cost_usd: number; reason: string }) =>
    platReq<any>("POST", "/m0/cost-requests", { data }),
  decideCost: (reqId: string, decision: "APPROVED" | "REJECTED") =>
    platReq<any>("POST", `/m0/cost-requests/${reqId}/decide`, { data: { decision } }),
  listInventory: () => platReq<{ items: any[] }>("GET", "/m0/inventory"),
  submitStocktake: (data: {
    warehouse_code: string;
    sku: string;
    counted_qty: number;
    reason: string;
  }) => platReq<any>("POST", "/m0/inventory/stocktake", { data }),
  importOrdersCsv: (csv_text: string, filename = "", source_type = "auto") =>
    platReq<any>("POST", "/m0/orders/import-csv", { data: { csv_text, filename, source_type } }),

  // M1
  listFaqs: () => platReq<{ items: any[] }>("GET", "/m1/faqs"),
  upsertFaq: (data: {
    sku: string;
    pain_points: string[];
    faq_pairs: Array<{ q: string; a: string }>;
  }) => platReq<any>("POST", "/m1/faqs", { data }),
  listSessions: (params?: { is_mock?: boolean; status?: string }) =>
    platReq<{ items: any[] }>("GET", "/m1/sessions", {
      params: params
        ? {
            is_mock: params.is_mock === undefined ? undefined : String(params.is_mock),
            status: params.status,
          }
        : undefined,
    }),
  replySession: (sessionId: string, reply: string) =>
    platReq<any>("POST", `/m1/sessions/${sessionId}/reply`, { data: { reply } }),
  simulateInquiry: (sku: string, question: string) =>
    platReq<{
      session_id: string;
      suggested_reply: string;
      matched_q?: string;
      confidence?: number;
      handoff_required?: boolean;
    }>("POST", "/m1/simulator/ask", {
      data: { sku, question },
    }),
  listAftersales: (status?: string) =>
    platReq<{ items: any[] }>("GET", "/m1/aftersales", {
      params: status ? { status } : undefined,
    }),
  createAftersales: (data: {
    sku: string;
    order_ref: string;
    platform: string;
    issue_type: string;
    refund_usd: number;
    evidence_note: string;
  }) => platReq<any>("POST", "/m1/aftersales", { data }),
  decideAftersales: (ticketId: string, decision: "APPROVED" | "REJECTED", note: string) =>
    platReq<any>("POST", `/m1/aftersales/${ticketId}/decide`, { data: { decision, note } }),

  // M2 & M3
  getM2Overview: (params?: { include_mock?: boolean; shop_id?: string }) =>
    platReq<any>("GET", "/m2/overview", {
      params: params
        ? {
            include_mock: params.include_mock === undefined ? undefined : String(params.include_mock),
            shop_id: params.shop_id || undefined,
          }
        : undefined,
    }),
  listAds: () => platReq<{ items: any[] }>("GET", "/m2/ads"),
  createAd: (data: {
    sku: string;
    platform: string;
    campaign_name: string;
    daily_budget_usd: number;
  }) => platReq<any>("POST", "/m2/ads", { data }),
  adjustAd: (campaignId: string, daily_budget_usd: number, status: "ACTIVE" | "PAUSED") =>
    platReq<any>("POST", `/m2/ads/${campaignId}/adjust`, {
      data: { daily_budget_usd, status },
    }),
  listCompetitors: () => platReq<{ items: any[] }>("GET", "/m3/competitors"),
  createCompetitor: (data: {
    sku: string;
    competitor_brand: string;
    asin_or_ref: string;
    price_usd: number;
    rating: number;
    bsr_rank: number;
  }) => platReq<any>("POST", "/m3/competitors", { data }),
  updateCompetitor: (
    watchId: string,
    data: { price_usd: number; rating: number; bsr_rank: number; negative_topics?: string[] }
  ) => platReq<any>("PATCH", `/m3/competitors/${watchId}`, { data }),
  askBiAssistant: (question: string, include_mock = false) =>
    platReq<{
      answer: string;
      lineage_sources: string[];
      metrics: any;
      open_alerts_count: number;
      pending_applies_count: number;
    }>("POST", "/m3/ask", { data: { question, include_mock } }),

  // M4
  listCandidates: () => platReq<{ items: any[] }>("GET", "/m4/candidates"),
  importCandidate: (data: {
    sku: string;
    name: string;
    category: string;
    source_channel: string;
    source_nature?: string;
    fulfillment_mode?: string;
    ip_risk_note?: string;
    target_price_usd: number;
    est_cost_rmb: number;
    est_shipping_rmb: number;
  }) => platReq<any>("POST", "/m4/candidates", { data }),
  importCandidatesCsv: (csv_text: string, filename = "", source_nature = "internal_live") =>
    platReq<any>("POST", "/m4/candidates/import-csv", {
      data: { csv_text, filename, source_nature },
    }),
  evaluateCandidate: (candidateId: string, data: any) =>
    platReq<any>("POST", `/m4/candidates/${candidateId}/evaluate`, { data }),
  decideCandidate: (
    candidateId: string,
    decision: "APPROVED" | "REJECTED",
    note: string,
    trigger_m7_draft = false
  ) =>
    platReq<any>("POST", `/m4/candidates/${candidateId}/decide`, {
      data: { decision, note, trigger_m7_draft },
    }),

  // M5 & M6
  getForecast: (sku: string, route_code?: string, objective_mode?: string) =>
    platReq<any>("GET", `/supply/forecast/${encodeURIComponent(sku)}`, {
      params: { route_code, objective_mode },
    }),
  runSandbox: (data: any) => platReq<any>("POST", "/supply/sandbox", { data }),
  listApplies: () => platReq<{ items: any[] }>("GET", "/supply/applies"),
  createApply: (data: {
    sku: string;
    route_code: string;
    objective_mode: string;
    qty_propose: number;
  }) => platReq<any>("POST", "/supply/applies", { data }),
  submitApply: (applyId: string) => platReq<any>("POST", `/supply/applies/${applyId}/submit`),
  approveApply: (applyId: string) => platReq<any>("POST", `/supply/applies/${applyId}/approve`),
  rejectApply: (applyId: string, reason: string) =>
    platReq<any>("POST", `/supply/applies/${applyId}/reject`, { data: { reason } }),
  listPos: () => platReq<{ items: any[] }>("GET", "/supply/pos"),
  shipPo: (poId: string) => platReq<any>("POST", `/supply/pos/${poId}/ship`),
  receivePo: (poId: string, receive_qty: number, defect_qty: number) =>
    platReq<any>("POST", `/supply/pos/${poId}/receive`, {
      data: { receive_qty, defect_qty },
    }),
  cancelPo: (poId: string, reason: string) =>
    platReq<any>("POST", `/supply/pos/${poId}/cancel`, { data: { reason } }),
  listAlerts: () => platReq<{ items: any[] }>("GET", "/supply/alerts"),
  scanAlerts: () => platReq<{ created: number }>("POST", "/supply/alerts/scan"),
  ackAlert: (alertId: string) => platReq<any>("POST", `/supply/alerts/${alertId}/ack`),
  importSalesCsv: (csv_text: string, filename = "") =>
    platReq<{ imported: number; errors: any[] }>("POST", "/supply/sales-history/import-csv", {
      data: { csv_text, filename },
    }),
  updateSkuSupplyParams: (
    sku: string,
    data: { moq: number; pack_size: number; lead_time_days: number }
  ) => platReq<any>("PATCH", `/supply/sku-params/${encodeURIComponent(sku)}`, { data }),
  listWeeklyReviews: () => platReq<{ items: any[] }>("GET", "/supply/weekly-reviews"),
  createWeeklyReview: (week_label: string, summary_text: string) =>
    platReq<any>("POST", "/supply/weekly-reviews", { data: { week_label, summary_text } }),

  // M8
  authLogin: async (org_id: string, user_id: string, password: string) => {
    const resp = await httpClient.post<ApiEnvelope<any>>("/api/v1/auth/login", {
      org_id,
      user_id,
      password,
    });
    return resp.data.data;
  },
  listUsers: () => platReq<{ items: any[] }>("GET", "/m8/users"),
  createUser: (data: {
    user_id: string;
    display_name: string;
    role_code: string;
    email: string;
    password?: string;
    allowed_shop_ids?: string[];
  }) => platReq<any>("POST", "/m8/users", { data }),
  updateUser: (
    userId: string,
    role_code: string,
    is_active: boolean,
    allowed_shop_ids?: string[]
  ) =>
    platReq<any>("PUT", `/m8/users/${userId}`, {
      data: { role_code, is_active, allowed_shop_ids },
    }),
  listRoles: () => platReq<{ items: any[] }>("GET", "/m8/roles"),
  listPolicies: () => platReq<{ items: any[] }>("GET", "/m8/policies"),
  togglePolicy: (policyId: string, is_enabled: boolean, enforce_sod: boolean) =>
    platReq<any>("POST", `/m8/policies/${policyId}/toggle`, {
      data: { is_enabled, enforce_sod },
    }),
  listAudits: (module?: string) =>
    platReq<{ items: any[] }>("GET", "/m8/audits", { params: { module } }),
};
