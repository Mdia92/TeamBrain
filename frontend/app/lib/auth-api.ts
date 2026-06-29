import { apiClient, BASE_URL, type LoginResponse, type User } from "./api";

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient.post("/api/auth/login", { email, password });
}

export function validateInviteCode(code: string): Promise<{ valid: boolean; message: string }> {
  return apiClient.post("/api/auth/validate-invite-code", { code });
}

export function signup(
  data: {
    email: string;
    password: string;
    password_confirm: string;
    full_name: string;
    organization_name: string;
    industry?: string;
    team_size?: string;
    primary_language?: string;
  },
  inviteCode: string,
): Promise<LoginResponse> {
  return apiClient.post("/api/auth/signup", { ...data, invite_code: inviteCode });
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
    return fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    }).then((r) => r.json());
  }
  return apiClient.get("/api/auth/me");
}

export function switchOrg(organizationId: string): Promise<LoginResponse> {
  return apiClient.post("/api/auth/switch-org", { organization_id: organizationId });
}

export function createOrg(data: {
  organization_name: string;
  industry?: string;
  team_size?: string;
  primary_language?: string;
  modules?: string[];
  invites?: { email: string; role: string }[];
}): Promise<LoginResponse> {
  return apiClient.post("/api/auth/create-org", data);
}

export function completeOnboarding(data: {
  organization_name?: string;
  org_description?: string;
  org_goals?: string;
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
  short_code?: string;
  token?: string;
}> {
  return apiClient.get(`/api/auth/invite/${token}`);
}

export function previewInviteByCode(code: string): Promise<{
  org_name: string;
  email: string;
  role: string;
  inviter_name?: string;
  short_code?: string;
  token?: string;
}> {
  return apiClient.get(`/api/auth/invite/code/${encodeURIComponent(code.trim().toUpperCase())}`);
}

export function acceptInviteSignup(data: {
  token?: string;
  short_code?: string;
  full_name: string;
  email: string;
  password: string;
  password_confirm: string;
}): Promise<LoginResponse> {
  return apiClient.post("/api/auth/invite/accept-signup", data);
}

export function acceptInviteLogin(data: {
  token?: string;
  short_code?: string;
  email: string;
  password: string;
}): Promise<LoginResponse> {
  return apiClient.post("/api/auth/invite/accept-login", data);
}

export function patchOrgSettings(data: {
  name?: string;
  org_description?: string;
  org_goals?: string;
  modules?: string[];
}): Promise<{ name: string; settings: Record<string, unknown> }> {
  return apiClient.patch("/api/organizations/current/settings", data);
}
