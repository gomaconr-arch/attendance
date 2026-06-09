import { AttendanceLog, Organization, PayrollMode, User } from "./types";

export interface ScopedState {
  organizations: Organization[];
  users: User[];
  attendance_logs: AttendanceLog[];
}

interface LoginResponse {
  ok: boolean;
  user?: User;
  state?: ScopedState;
  suspended?: boolean;
  org?: { org_id: string; company_name: string; subscription_status: string };
  error?: string;
}

const postJson = async <T>(url: string, payload: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<T>;
};

export const apiLogin = async (email: string, password: string): Promise<LoginResponse> => {
  return postJson<LoginResponse>("/api/login", { email, password });
};

export const apiCommand = async (
  actor_user_id: string,
  action: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; state?: ScopedState; error?: string }> => {
  return postJson<{ ok: boolean; state?: ScopedState; error?: string }>("/api/command", {
    actor_user_id,
    action,
    payload
  });
};

export const normalizeRuntimeModes = (modes: Record<string, PayrollMode>): Record<string, string> => {
  return Object.fromEntries(Object.entries(modes));
};
