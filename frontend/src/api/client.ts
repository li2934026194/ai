import axios, { type AxiosInstance } from "axios";

export interface ApiEnvelope<T = unknown> {
  code: string;
  message: string;
  trace_id: string;
  data: T;
}

export class M7ApiError extends Error {
  code: string;
  httpStatus: number;
  data: unknown;

  constructor(code: string, message: string, httpStatus = 400, data: unknown = null) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.data = data;
  }
}

export interface ActorHeadersState {
  orgId: string;
  role: string;
  actorId: string;
}

let actorState: ActorHeadersState = {
  orgId: "org_demo",
  role: "creator",
  actorId: "u-lin",
};

export function setApiActorState(next: ActorHeadersState): void {
  actorState = { ...next };
}

export function getApiActorState(): ActorHeadersState {
  return { ...actorState };
}

export const httpClient: AxiosInstance = axios.create({
  baseURL: "",
  timeout: 45000,
});

httpClient.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  config.headers["X-Actor-Role"] = actorState.role;
  config.headers["X-Actor-Id"] = actorState.actorId;
  config.headers["X-Org-Id"] = actorState.orgId;
  return config;
});

export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options?: {
    data?: unknown;
    params?: Record<string, string | number | undefined>;
    idempotencyKey?: string;
  }
): Promise<T> {
  const url = `/api/v1/orgs/${encodeURIComponent(actorState.orgId)}/m7${path}`;
  try {
    const resp = await httpClient.request<ApiEnvelope<T>>({
      method,
      url,
      data: options?.data,
      params: options?.params,
      headers: options?.idempotencyKey
        ? { "X-Idempotency-Key": options.idempotencyKey }
        : undefined,
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

export async function apiDownloadBinary(
  path: string,
  params?: Record<string, string>
): Promise<{ blob: Blob; filename: string; contentType: string }> {
  const url = `/api/v1/orgs/${encodeURIComponent(actorState.orgId)}/m7${path}`;
  try {
    const resp = await httpClient.get<Blob>(url, {
      params,
      responseType: "blob",
    });
    const cd = String(resp.headers["content-disposition"] || "");
    const m = cd.match(/filename="?([^"]+)"?/i);
    return {
      blob: resp.data,
      filename: m ? m[1] : "deliverable.bin",
      contentType: String(resp.headers["content-type"] || "application/octet-stream"),
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const parsed = JSON.parse(text) as Partial<ApiEnvelope>;
        throw new M7ApiError(
          parsed.code || `HTTP-${err.response.status}`,
          parsed.message || "导出失败",
          err.response.status,
          parsed.data ?? null
        );
      } catch (e) {
        if (e instanceof M7ApiError) throw e;
      }
    }
    throw new M7ApiError("EXPORT_ERROR", (err as Error)?.message || "下载失败", 500);
  }
}
