const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8010";

export type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  organization_id?: string;
  org_slug?: string;
  org_name?: string;
  onboarding_completed?: boolean;
  settings?: Record<string, unknown>;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  user: User;
};

type AuthConfig = {
  getToken: () => string | null;
  onAuthFailure: () => void;
  setToken: (token: string | null) => void;
};

let authConfig: AuthConfig | null = null;

export function configureApiAuth(config: AuthConfig): void {
  authConfig = config;
}

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data?.detail) return String(data.detail);
  } catch {
    /* ignore */
  }
  return response.statusText || "Request failed";
}

async function refreshAccessToken(): Promise<string | null> {
  const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) return null;
  const data = await response.json();
  authConfig?.setToken(data.access_token);
  return data.access_token;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
  tokenOverride?: string | null,
): Promise<T> {
  const token = tokenOverride ?? authConfig?.getToken() ?? null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !isRetry && authConfig) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(method, path, body, true, newToken);
    authConfig.onAuthFailure();
    throw new ApiRequestError(401, await parseError(response));
  }

  if (!response.ok) throw new ApiRequestError(response.status, await parseError(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export async function uploadFile(
  path: string,
  formData: FormData,
): Promise<unknown> {
  const token = authConfig?.getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  });
  if (!response.ok) throw new ApiRequestError(response.status, await parseError(response));
  return response.json();
}

export { BASE_URL };
