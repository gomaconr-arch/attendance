export type SubscriptionStatus = "enabled" | "disabled";
export type Role = "SuperAdmin" | "Employer" | "Employee";
export type CompensationType = "hourly" | "monthly";
export type PayrollMode = "hourly" | "monthly";
export type AttendanceFlag = "Outside Shift Hours" | "ADMIN_OVERWRITE" | "LATE_ENTRY" | "VOIDED";
export type CorrectionRequestStatus = "pending" | "approved" | "rejected";
export type WorkDayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface OrganizationSettings {
  currency: string;
  work_days: WorkDayName[];
  shift_start: string;
  shift_end: string;
  default_hourly_rate: number;
  default_monthly_rate: number;
  max_hours_per_month: number;
}

export interface Organization {
  org_id: string;
  company_name: string;
  subscription_status: SubscriptionStatus;
  settings: OrganizationSettings;
  updated_at: string;
  created_at: string;
}

export interface User {
  user_id: string;
  org_id?: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  payroll_mode?: PayrollMode;
  compensation_type?: CompensationType;
  rate?: number;
  custom_hourly_rate?: number | null;
  custom_monthly_rate?: number | null;
  created_at: string;
}

export interface AttendanceLog {
  log_id: string;
  org_id: string;
  employee_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: number | null;
  flags: AttendanceFlag[];
  is_modified: boolean;
  is_voided: boolean;
}

export interface AttendanceAdjustment {
  adjustment_id: string;
  org_id: string;
  log_id: string;
  modified_by_user_id: string;
  timestamp: string;
  previous_values: {
    clock_in: string;
    clock_out: string | null;
    is_voided: boolean;
  };
  new_values: {
    clock_in: string;
    clock_out: string | null;
    is_voided: boolean;
  };
  reason: string;
}

export interface CorrectionRequest {
  request_id: string;
  org_id: string;
  employee_id: string;
  target_date: string;
  requested_clock_in: string;
  requested_clock_out: string;
  employee_note: string;
  status: CorrectionRequestStatus;
  reviewer_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Session {
  user_id: string;
  role: Role;
  org_id?: string;
  login_at: string;
  org_session_rev?: number;
}

export interface SeedData {
  organizations: Organization[];
  users: User[];
  attendance_logs: AttendanceLog[];
  attendance_adjustments: AttendanceAdjustment[];
  correction_requests: CorrectionRequest[];
}

export interface DateRange {
  start: string;
  end: string;
}
