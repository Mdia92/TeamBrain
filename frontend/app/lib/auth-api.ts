import { apiClient, type LoginResponse, type User } from "./api";

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient.post("/api/auth/login", { email, password });
}

export function signup(data: {
  email: string;
  password: string;
  full_name: string;
  organization_name: string;
  industry?: string;
  team_size?: string;
  primary_language?: string;
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
    return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010"}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    }).then((r) => r.json());
  }
  return apiClient.get("/api/auth/me");
}

export function switchOrg(organizationId: string): Promise<LoginResponse> {
  return apiClient.post("/api/auth/switch-org", { organization_id: organizationId });
}

export function completeOnboarding(data: {
  industry?: string;
  team_size?: string;
  primary_language?: string;
  modules?: string[];
  invites?: { email: string; role: string }[];
}): Promise<{ status: string }> {
  return apiClient.post("/api/auth/onboarding", data);
}

export function previewInvite(token: string): Promise<{
  org_name: string;
  email: string;
  role: string;
  inviter_name?: string;
}> {
  return apiClient.get(`/api/auth/invite/${token}`);
}

export function acceptInviteSignup(data: {
  token: string;
  full_name: string;
  email: string;
  password: string;
}): Promise<LoginResponse> {
  return apiClient.post("/api/auth/invite/accept-signup", data);
}

export function acceptInviteLogin(data: {
  token: string;
  email: string;
  password: string;
}): Promise<LoginResponse> {
  return apiClient.post("/api/auth/invite/accept-login", data);
}
