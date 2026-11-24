import { apiDownloadBinary, apiRequest } from "./client";

export type PlatformCode = "amazon_us" | "shopee_th" | "tiktok_us";
export type CategoryCode = "kitchen_appliance" | "bags_travel" | "3c_accessories" | "beauty_skincare";

export interface ProductAvailableItem {
  sku: string;
  name: string;
  category: CategoryCode;
  category_label_zh: string;
  platform: PlatformCode;
  sale_price_usd: number | null;
  strike_price_usd: number | null;
  origin: "M4_APPROVED" | "IN_STORE_REFRESH";
  approver: string;
  decision_reason: string;
  brand_name: string;
  specs: Record<string, string>;
  selling_points: string[];
  faq: {
    pain_points: string[];
    faq_pairs: Array<{ q: string; a: string }>;
  };
  progress_hint: {
    core_copy_done: number;
    ext_copy_done: number;
  };
}

export interface CopyScanResult {
  char_count: number;
  utf8_bytes: number;
  max_limit: number;
  limit_unit: "chars" | "bytes";
  over_len: boolean;
  must_hits: string[];
  must_missing: string[];
  ban_hits: string[];
  trademark_hits: string[];
  regulatory_hits: string[];
  all_caps_words: string[];
  suggestions: Record<string, string>;
  passed: boolean;
}

export interface CopyAssetDTO {
  asset_id: string;
  org_id: string;
  sku: string;
  job_id: string;
  asset_slot: string;
  platform: PlatformCode;
  lang: string;
  variant_idx: number;
  version: number;
  is_selected: boolean;
  edit_status: "AI_GENERATED" | "MANUALLY_EDITED" | "RESTORED_ORIGINAL";
  content_json: { text?: string; bullets?: string[]; style_label?: string };
  orig_content_json: { text?: string; bullets?: string[]; style_label?: string };
  scan_result_json: CopyScanResult;
  last_edited_by: string;
  updated_at: string;
}

export interface ImageSlotDTO {
  asset_id: string;
  media_id: string;
  asset_slot: string;
  slot_idx: number;
  version: number;
  is_selected: boolean;
  mime_type: string;
  file_size: number;
  sha256: string;
  width?: number;
  height?: number;
  ai_person_flag: boolean;
  iptc_verified: boolean;
  iptc_tags_json: Record<string, string>;
  media_url: string;
  before_media_url?: string;
  content_json: Record<string, unknown>;
}

export interface VideoSegmentDTO {
  seg_idx: number;
  title: string;
  slot_idx: number;
  duration_sec: number;
  motion: string;
  sub_en: string;
  sub_cn: string;
}

export interface PackageSummaryDTO {
  sku: string;
  platform: PlatformCode;
  product_name: string;
  done_cnt: number;
  ext_done_cnt: number;
  core_items: Array<{ slot: string; label: string; done: boolean; jump_route: string }>;
  ext_items: Array<{ slot: string; done: boolean; jump_route: string }>;
  missing_items: Array<{ slot: string; label: string; done: boolean; jump_route: string }>;
  last_editor_id: string;
  approval_status: "PENDING_CHECK" | "CHECK_FAILED" | "CHECK_PASSED" | "APPROVED" | "INVALIDATED";
  selected_copy_assets: Record<string, Partial<CopyAssetDTO>>;
  latest_check: {
    check_id: string;
    overall_pass: boolean;
    deliverable_count: number;
    checks: Array<{ code: string; name: string; passed: boolean; detail: string; jump_route: string }>;
  } | null;
  active_approval: {
    approval_id: string;
    approver_id: string;
    decision: string;
    note: string | null;
    approved_at: string;
  } | null;
  buyer_preview: {
    banner: string;
    is_mock: boolean;
    title: string;
    bullets: string[];
    description: string;
    aplus_html: string;
    sale_price_usd: number | null;
    strike_price_usd: number | null;
    discount_pct: number | null;
    specs: Record<string, string>;
    images: ImageSlotDTO[];
    video: {
      asset_id: string;
      version: number;
      media_id: string;
      media_url: string;
      duration_sec: number;
      bgm: string;
      segments: VideoSegmentDTO[];
    } | null;
  };
}

export interface ComplianceRuleDTO {
  rule_id: string;
  platform: PlatformCode;
  category: CategoryCode;
  rule_version: string;
  effective_date: string;
  title_max_chars: number;
  bullet_max_chars: number;
  search_terms_max_bytes: number;
  lexicon_json: {
    must: string[];
    ban: string[];
    trademark: string[];
    regulatory: string[];
  };
  required_certs_json: string[];
  image_policy_json: Record<string, unknown>;
  updated_by: string;
}

export interface CertRecordDTO {
  cert_id: string;
  sku: string;
  cert_type: string;
  cert_no: string;
  expire_date: string;
  status: "VALID" | "EXPIRING" | "EXPIRED";
}

export interface AuditEventDTO {
  event_id: string;
  sku: string | null;
  action: string;
  actor_id: string;
  actor_role: string;
  ok: boolean;
  sentence_zh: string;
  created_at: string;
}

export const m7Api = {
  getHealth: () =>
    apiRequest<{
      cloud_provider: string;
      dashscope_key_configured: boolean;
      ffmpeg_available: boolean;
      video_engine_enabled: boolean;
      video_ready: boolean;
      strict_separation_of_duties: boolean;
    }>("GET", "/health"),

  listAuditEvents: (sku?: string) =>
    apiRequest<{ items: AuditEventDTO[]; total: number }>("GET", "/audit", {
      params: { sku, limit: 40 },
    }),

  listAvailableProducts: () =>
    apiRequest<{ items: ProductAvailableItem[]; total: number }>("GET", "/products/available"),

  generateCopy: (
    payload: {
      sku: string;
      platform: PlatformCode;
      lang: string;
      asset_slot: string;
      extra_must?: string[];
      extra_ban?: string[];
    },
    idempotencyKey: string
  ) =>
    apiRequest<{ job_id: string; variants: CopyAssetDTO[] }>("POST", "/copy/generate", {
      data: payload,
      idempotencyKey,
    }),

  scanCopy: (payload: {
    sku: string;
    platform: PlatformCode;
    category: CategoryCode;
    asset_slot: string;
    text: string;
    extra_must?: string[];
    extra_ban?: string[];
  }) => apiRequest<CopyScanResult>("POST", "/copy/scan", { data: payload }),

  selectCopyAsset: (assetId: string) =>
    apiRequest<CopyAssetDTO>("POST", `/copy/assets/${encodeURIComponent(assetId)}/select`),

  editCopyAsset: (
    assetId: string,
    payload: { text: string; version: number; extra_must?: string[]; extra_ban?: string[] }
  ) => apiRequest<CopyAssetDTO>("PUT", `/copy/assets/${encodeURIComponent(assetId)}`, { data: payload }),

  restoreCopyAsset: (assetId: string) =>
    apiRequest<CopyAssetDTO>("POST", `/copy/assets/${encodeURIComponent(assetId)}/restore`),

  getEnginesStatus: () =>
    apiRequest<{
      engines: Array<{ id: string; name: string; configured: boolean; mode: string }>;
    }>("GET", "/engines/status"),

  submitImageBatch: (
    payload: {
      sku: string;
      platform: PlatformCode;
      style: string;
      aspect: "1:1" | "4:5" | "3:4" | "16:9";
      avoid_terms: string[];
      ai_person_slots: number[];
      slot_notes: Record<string, string>;
    },
    idempotencyKey: string
  ) =>
    apiRequest<{ job_id: string; status: string; progress: number }>("POST", "/images/batch", {
      data: payload,
      idempotencyKey,
    }),

  syncJob: (jobId: string) =>
    apiRequest<{ job_id: string; status: string; progress: number; slots: ImageSlotDTO[] }>(
      "POST",
      `/jobs/${encodeURIComponent(jobId)}/sync`
    ),

  regenerateImageSlot: (
    slotIdx: number,
    payload: {
      sku: string;
      platform: PlatformCode;
      style: string;
      aspect: "1:1" | "4:5" | "3:4" | "16:9";
      instruction: string;
      ai_person_flag: boolean;
    },
    idempotencyKey: string
  ) =>
    apiRequest<ImageSlotDTO>("POST", `/images/slots/${slotIdx}/regenerate`, {
      data: payload,
      idempotencyKey,
    }),

  inpaintImageSlot: (
    slotIdx: number,
    payload: {
      sku: string;
      platform: PlatformCode;
      style: string;
      aspect: "1:1" | "4:5" | "3:4" | "16:9";
      instruction: string;
      ai_person_flag: boolean;
    },
    idempotencyKey: string
  ) =>
    apiRequest<ImageSlotDTO>("POST", `/images/slots/${slotIdx}/inpaint`, {
      data: payload,
      idempotencyKey,
    }),

  verifyIptc: (payload: {
    sku: string;
    platform: PlatformCode;
    mode: "verify" | "simulate_strip" | "rewrite";
    slot_idx?: number;
  }) =>
    apiRequest<{
      all_verified: boolean;
      items: Array<{
        asset_slot: string;
        media_id: string;
        ai_person_flag: boolean;
        iptc_verified: boolean;
        iptc_tags_json: Record<string, string>;
      }>;
    }>("POST", "/images/iptc/verify", { data: payload }),

  generateVideo: (
    payload: {
      sku: string;
      platform: PlatformCode;
      bgm: string;
      use_m7_copy: boolean;
      segments?: VideoSegmentDTO[];
    },
    idempotencyKey: string
  ) =>
    apiRequest<{
      job_id: string;
      asset_id: string;
      media_id: string;
      version: number;
      media_url: string;
      duration_sec: number;
      segments: VideoSegmentDTO[];
    }>("POST", "/videos/generate", { data: payload, idempotencyKey }),

  editVideoSegment: (
    segIdx: number,
    payload: {
      sku: string;
      platform: PlatformCode;
      version: number;
      slot_idx?: number;
      motion?: string;
      sub_en?: string;
      sub_cn?: string;
    }
  ) =>
    apiRequest<{ asset_id: string; version: number; segments: VideoSegmentDTO[] }>(
      "PUT",
      `/videos/segments/${segIdx}`,
      { data: payload }
    ),

  regenerateVideoSegment: (segIdx: number, payload: { sku: string; platform: PlatformCode }) =>
    apiRequest<{ asset_id: string; version: number; segments: VideoSegmentDTO[] }>(
      "POST",
      `/videos/segments/${segIdx}/regenerate`,
      { data: payload }
    ),

  generateAplus: (
    payload: { sku: string; platform: PlatformCode; theme?: string },
    idempotencyKey: string
  ) =>
    apiRequest<{
      asset_id: string;
      job_id: string;
      theme: string;
      html: string;
      modules: Array<{ title: string; summary?: string }>;
    }>("POST", "/aplus/generate", { data: payload, idempotencyKey }),

  getComplianceMatrix: (sku?: string) =>
    apiRequest<{ rules: ComplianceRuleDTO[]; certs: CertRecordDTO[] }>(
      "GET",
      "/compliance/matrix",
      { params: { sku } }
    ),

  updateComplianceRule: (
    ruleId: string,
    payload: {
      title_max_chars: number;
      bullet_max_chars: number;
      search_terms_max_bytes: number;
      lexicon_json: ComplianceRuleDTO["lexicon_json"];
      required_certs_json: string[];
    }
  ) =>
    apiRequest<{ rule_id: string; updated_by: string }>(
      "PUT",
      `/compliance/matrix/${encodeURIComponent(ruleId)}`,
      { data: payload }
    ),

  renewCert: (payload: { sku: string; cert_type: string; cert_no: string; expire_date: string }) =>
    apiRequest<{ cert_id: string; status: string; expire_date: string }>(
      "POST",
      "/certs/renew",
      { data: payload }
    ),

  runComplianceCheck: (payload: { sku: string; platform: PlatformCode }) =>
    apiRequest<{
      check_id: string;
      deliverable_count: number;
      overall_pass: boolean;
      checks: Array<{ code: string; name: string; passed: boolean; detail: string; jump_route: string }>;
      warnings: string[];
    }>("POST", "/compliance/check", { data: payload }),

  getPackageSummary: (sku: string, platform: PlatformCode) =>
    apiRequest<PackageSummaryDTO>("GET", `/packages/${encodeURIComponent(sku)}/summary`, {
      params: { platform },
    }),

  approvePackage: (payload: {
    sku: string;
    platform: PlatformCode;
    decision: "APPROVED" | "REJECTED";
    note: string;
  }) =>
    apiRequest<{ approval_id: string; decision: string; is_active: boolean }>(
      "POST",
      "/packages/approve",
      { data: payload }
    ),

  exportPackage: (sku: string, platform: PlatformCode, format: "zip" | "html") =>
    apiDownloadBinary(`/packages/${encodeURIComponent(sku)}/export`, { platform, format }),
};
