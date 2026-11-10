/** Phần của problem+json (RFC 9457) mà UI dùng. */
interface Problem {
  code?: string;
  detail?: string;
  requestId?: string;
}

interface ApiErrorInit {
  status: number;
  code?: string;
  detail?: string;
  requestId?: string;
}

/** Lỗi từ gateway (problem+json) hoặc từ mạng (status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor({ status, code, detail, requestId }: ApiErrorInit) {
    super(detail || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }

  /** 503 AUTHZ_UNAVAILABLE / mất kết nối: lỗi tạm thời, KHÔNG phải bị từ chối quyền. */
  get retryable(): boolean {
    return this.status === 503 || this.status === 502 || this.status === 504 || this.status === 0;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: Problem = {};
  try {
    problem = (await response.json()) as Problem;
  } catch {
    // body không phải JSON
  }
  return new ApiError({
    status: response.status,
    code: problem.code,
    detail: problem.detail,
    requestId: problem.requestId || response.headers.get('x-request-id') || undefined,
  });
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string>;
  forceRefresh: () => Promise<boolean>;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  get: <T = unknown>(path: string) => Promise<T>;
  post: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  patch: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  put: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  delete: <T = unknown>(path: string) => Promise<T>;
}

/**
 * Client gọi gateway.
 *  - Gắn Authorization: Bearer và X-Request-Id.
 *  - 401: làm mới token và thử lại ĐÚNG MỘT lần; vẫn 401 thì báo phiên hết hạn.
 *  - 403: KHÔNG đăng xuất; báo onForbidden (để tải lại quyền) rồi ném lỗi cho nơi gọi.
 *  - 502/503/504: ném lỗi có `retryable`.
 */
export function createApiClient({
  baseUrl,
  getToken,
  forceRefresh,
  onUnauthorized,
  onForbidden,
  fetchImpl,
}: ApiClientOptions): ApiClient {
  const doFetch: typeof fetch = fetchImpl ?? ((...args) => fetch(...args));

  async function send(method: string, path: string, body?: unknown): Promise<Response> {
    const token = await getToken();
    try {
      return await doFetch(`${baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          'x-request-id': crypto.randomUUID(),
          ...(body !== undefined && { 'content-type': 'application/json' }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError({ status: 0, detail: 'Không kết nối được máy chủ' });
    }
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response = await send(method, path, body);
    if (response.status === 401) {
      if (await forceRefresh()) response = await send(method, path, body);
      if (response.status === 401) {
        onUnauthorized?.();
        throw await toApiError(response);
      }
    }
    if (response.status === 403) {
      onForbidden?.();
      throw await toApiError(response);
    }
    if (!response.ok) throw await toApiError(response);
    return (response.status === 204 ? null : await response.json()) as T;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
  };
}
