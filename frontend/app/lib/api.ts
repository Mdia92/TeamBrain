import { isOnline, OfflineQueuedError, tryQueueOfflineWrite } from "@/app/lib/offline-sync";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8010";

const REQUEST_TIMEOUT_MS = 30_000;

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
  organizations?: { id: string; name: string; slug: string; role: string }[];
  billing?: {
    pricing_tier: string;
    trial_days_left: number | null;
    is_read_only: boolean;
    trial_ends_at?: string | null;
  };
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

export { OfflineQueuedError } from "@/app/lib/offline-sync";

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data?.detail) return String(data.detail);
    if (Array.isArray(data?.errors) && data.errors[0]?.msg) {
      return String(data.errors[0].msg);
    }
  } catch {
    /* ignore */
  }
  if (response.status === 403) {
    return "Votre essai est terminé — mode lecture seule.";
  }
  return response.statusText || "Requête échouée";
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiRequestError(0, "Délai dépassé — réessayez.");
    }
    throw new ApiRequestError(0, "Connexion perdue, réessayez.");
  } finally {
    clearTimeout(timer);
  }

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

async function writeRequest<T>(
  method: "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!isOnline()) {
    const queued = await tryQueueOfflineWrite(
      method,
      path,
      body as Record<string, unknown> | undefined,
    );
    if (queued) throw new OfflineQueuedError(queued);
  }
  return request<T>(method, path, body);
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => writeRequest<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => writeRequest<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

function cloneFormData(source: FormData): FormData {
  const copy = new FormData();
  for (const [key, value] of source.entries()) {
    copy.append(key, value);
  }
  return copy;
}

export async function uploadFile(
  path: string,
  formData: FormData,
  isRetry = false,
): Promise<unknown> {
  const body = isRetry ? formData : cloneFormData(formData);
  const token = authConfig?.getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 2);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    const hint =
      err instanceof TypeError
        ? " — vérifiez que l'API tourne sur le port 8010 et que CORS autorise cette origine"
        : "";
    throw new ApiRequestError(0, `Connexion perdue, réessayez.${hint}`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 && !isRetry && authConfig) {
    const newToken = await refreshAccessToken();
    if (newToken) return uploadFile(path, cloneFormData(formData), true);
    authConfig.onAuthFailure();
    throw new ApiRequestError(401, await parseError(response));
  }

  if (!response.ok) throw new ApiRequestError(response.status, await parseError(response));
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

export { BASE_URL };
