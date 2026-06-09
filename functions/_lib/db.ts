type Db = D1Database;

type Role = "SuperAdmin" | "Employer" | "Employee";

interface Actor {
  user_id: string;
  org_id: string | null;
  role: Role;
}

const parseJsonArray = <T>(value: string | null, fallback: T[]): T[] => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

export const getActorById = async (db: Db, userId: string): Promise<Actor | null> => {
  const row = await db
    .prepare("SELECT user_id, org_id, role FROM users WHERE user_id = ?")
    .bind(userId)
    .first<Actor>();

  return row ?? null;
};

export const getUserByCredentials = async (db: Db, email: string, password: string) => {
  return db
    .prepare("SELECT user_id, org_id, name, email, role, payroll_mode, custom_hourly_rate, custom_monthly_rate, created_at FROM users WHERE lower(email)=lower(?) AND password=?")
    .bind(email, password)
    .first<any>();
};

const mapOrganization = (row: any) => ({
  org_id: row.org_id,
  company_name: row.company_name,
  subscription_status: row.subscription_status,
  settings: {
    currency: row.currency,
    work_days: parseJsonArray<string>(row.work_days_json, []),
    shift_start: row.shift_start,
    shift_end: row.shift_end,
    default_hourly_rate: Number(row.default_hourly_rate),
    default_monthly_rate: Number(row.default_monthly_rate),
    max_hours_per_month: Number(row.max_hours_per_month)
  },
  created_at: row.created_at,
  updated_at: row.updated_at
});

const mapUser = (row: any) => ({
  user_id: row.user_id,
  org_id: row.org_id ?? undefined,
  name: row.name,
  email: row.email,
  password: "",
  role: row.role,
  payroll_mode: row.payroll_mode ?? undefined,
  custom_hourly_rate: row.custom_hourly_rate,
  custom_monthly_rate: row.custom_monthly_rate,
  created_at: row.created_at
});

const mapLog = (row: any) => ({
  log_id: row.log_id,
  org_id: row.org_id,
  employee_id: row.employee_id,
  date: row.date,
  clock_in: row.clock_in,
  clock_out: row.clock_out,
  total_hours: row.total_hours === null ? null : Number(row.total_hours),
  flags: parseJsonArray<string>(row.flags_json, []),
  is_modified: Number(row.is_modified ?? 0) === 1,
  is_voided: Number(row.is_voided ?? 0) === 1
});

const mapAdjustment = (row: any) => ({
  adjustment_id: row.adjustment_id,
  org_id: row.org_id,
  log_id: row.log_id,
  modified_by_user_id: row.modified_by_user_id,
  timestamp: row.timestamp,
  previous_values: (() => {
    try {
      return JSON.parse(row.previous_values_json ?? "{}");
    } catch {
      return {};
    }
  })(),
  new_values: (() => {
    try {
      return JSON.parse(row.new_values_json ?? "{}");
    } catch {
      return {};
    }
  })(),
  reason: row.reason
});

const mapCorrectionRequest = (row: any) => ({
  request_id: row.request_id,
  org_id: row.org_id,
  employee_id: row.employee_id,
  target_date: row.target_date,
  requested_clock_in: row.requested_clock_in,
  requested_clock_out: row.requested_clock_out,
  employee_note: row.employee_note,
  status: row.status,
  reviewer_note: row.reviewer_note,
  reviewed_by_user_id: row.reviewed_by_user_id,
  reviewed_at: row.reviewed_at,
  created_at: row.created_at
});

export const getScopedState = async (db: Db, actor: Actor) => {
  if (actor.role === "SuperAdmin") {
    const orgRows = await db.prepare("SELECT * FROM organizations ORDER BY created_at DESC").all<any>();
    const userRows = await db.prepare("SELECT * FROM users ORDER BY created_at DESC").all<any>();
    const logRows = await db.prepare("SELECT * FROM attendance_logs ORDER BY date DESC").all<any>();
    const adjustmentRows = await db.prepare("SELECT * FROM attendance_adjustments ORDER BY timestamp DESC").all<any>();
    const correctionRows = await db.prepare("SELECT * FROM correction_requests ORDER BY created_at DESC").all<any>();

    return {
      organizations: (orgRows.results ?? []).map(mapOrganization),
      users: (userRows.results ?? []).map(mapUser),
      attendance_logs: (logRows.results ?? []).map(mapLog),
      attendance_adjustments: (adjustmentRows.results ?? []).map(mapAdjustment),
      correction_requests: (correctionRows.results ?? []).map(mapCorrectionRequest)
    };
  }

  if (!actor.org_id) {
    throw new Error("Actor has no tenant context");
  }

  const orgRows = await db.prepare("SELECT * FROM organizations WHERE org_id = ?").bind(actor.org_id).all<any>();
  const userRows = await db.prepare("SELECT * FROM users WHERE org_id = ? ORDER BY created_at DESC").bind(actor.org_id).all<any>();
  const logRows = await db.prepare("SELECT * FROM attendance_logs WHERE org_id = ? ORDER BY date DESC").bind(actor.org_id).all<any>();
  const adjustmentRows = await db
    .prepare("SELECT * FROM attendance_adjustments WHERE org_id = ? ORDER BY timestamp DESC")
    .bind(actor.org_id)
    .all<any>();
  const correctionRows = await db
    .prepare("SELECT * FROM correction_requests WHERE org_id = ? ORDER BY created_at DESC")
    .bind(actor.org_id)
    .all<any>();

  return {
    organizations: (orgRows.results ?? []).map(mapOrganization),
    users: (userRows.results ?? []).map(mapUser),
    attendance_logs: (logRows.results ?? []).map(mapLog),
    attendance_adjustments: (adjustmentRows.results ?? []).map(mapAdjustment),
    correction_requests: (correctionRows.results ?? []).map(mapCorrectionRequest)
  };
};

export const ensureActorTenant = (actor: Actor, orgId: string) => {
  if (actor.role === "SuperAdmin") return;
  if (actor.org_id !== orgId) {
    throw new Error("Tenant isolation violation");
  }
};
