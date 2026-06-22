import { apiClient, type LoginResponse, type User } from "./api";

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient.post("/api/auth/login", { email, password });
}

export function signup(data: {
  email: string;
  password: string;
  full_name: string;
  organization_name: string;
}): Promise<LoginResponse> {
  return apiClient.post("/api/auth/signup", data);
}

export async function refresh(): Promise<{ access_token: string } | null> {
  try {
    return await apiClient.post("/api/auth/refresh");
  } catch {
    return null;
  }
}

export function logout(): Promise<{ status: string }> {
  return apiClient.post("/api/auth/logout");
}

export function me(token?: string): Promise<User> {
  if (token) {
    return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    }).then((r) => r.json());
  }
  return apiClient.get("/api/auth/me");
}

export function completeOnboarding(data: {
  org_type: string;
  team_size: string;
  work_style: string;
  primary_language: string;
  key_pain: string;
}): Promise<{ status: string }> {
  return apiClient.post("/api/auth/onboarding", data);
}
