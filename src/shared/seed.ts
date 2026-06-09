import { DEFAULT_ORGANIZATION_SETTINGS } from "./defaults";
import { AttendanceAdjustment, AttendanceLog, AttendanceFlag, CorrectionRequest, Organization, SeedData, User } from "./types";
import { hoursDiff } from "./payroll";

const TODAY = "2026-06-09";

const organizations: Organization[] = [
  {
    org_id: "ORG_PH_001",
    company_name: "Manila Tech Solutions",
    subscription_status: "enabled",
    settings: {
      ...DEFAULT_ORGANIZATION_SETTINGS
    },
    updated_at: TODAY,
    created_at: "2026-05-01"
  },
  {
    org_id: "ORG_PH_002",
    company_name: "Cebu Retail Group",
    subscription_status: "disabled",
    settings: {
      ...DEFAULT_ORGANIZATION_SETTINGS,
      currency: "PHP",
      shift_start: "09:00",
      shift_end: "18:00"
    },
    updated_at: TODAY,
    created_at: "2026-05-03"
  }
];

const users: User[] = [
  {
    user_id: "SA_001",
    name: "Platform Owner",
    email: "admin@platform.com",
    password: "admin123",
    role: "SuperAdmin",
    created_at: "2026-05-01"
  },
  {
    user_id: "USR_001",
    org_id: "ORG_PH_001",
    name: "Admin Employer",
    email: "employer@manila.tech",
    password: "employer123",
    role: "Employer",
    created_at: "2026-05-01"
  },
  {
    user_id: "USR_002",
    org_id: "ORG_PH_001",
    name: "Juan Dela Cruz",
    email: "juan@manila.tech",
    password: "juan123",
    role: "Employee",
    payroll_mode: "hourly",
    custom_hourly_rate: null,
    custom_monthly_rate: null,
    created_at: "2026-05-01"
  },
  {
    user_id: "USR_003",
    org_id: "ORG_PH_001",
    name: "Maria Santos",
    email: "maria@manila.tech",
    password: "maria123",
    role: "Employee",
    payroll_mode: "monthly",
    custom_hourly_rate: 320,
    custom_monthly_rate: 14500,
    created_at: "2026-05-01"
  },
  {
    user_id: "USR_101",
    org_id: "ORG_PH_002",
    name: "Disabled Employer",
    email: "owner@cebu.group",
    password: "owner123",
    role: "Employer",
    created_at: "2026-05-03"
  },
  {
    user_id: "USR_102",
    org_id: "ORG_PH_002",
    name: "Locked Employee",
    email: "locked@cebu.group",
    password: "locked123",
    role: "Employee",
    payroll_mode: "hourly",
    custom_hourly_rate: null,
    custom_monthly_rate: null,
    created_at: "2026-05-03"
  }
];

const buildLog = (
  logId: string,
  orgId: string,
  employeeId: string,
  date: string,
  clockIn: string,
  clockOut: string | null,
  flags: AttendanceFlag[] = []
): AttendanceLog => ({
  log_id: logId,
  org_id: orgId,
  employee_id: employeeId,
  date,
  clock_in: clockIn,
  clock_out: clockOut,
  total_hours: clockOut ? hoursDiff(clockIn, clockOut) : null,
  flags,
  is_modified: false,
  is_voided: false
});

const attendance_logs: AttendanceLog[] = [
  buildLog("LOG_5001", "ORG_PH_001", "USR_002", "2026-06-01", "08:00", "17:00"),
  buildLog("LOG_5002", "ORG_PH_001", "USR_002", "2026-06-02", "08:00", "17:00"),
  buildLog("LOG_5003", "ORG_PH_001", "USR_002", "2026-06-03", "08:00", "17:00"),
  buildLog("LOG_5004", "ORG_PH_001", "USR_002", "2026-06-04", "08:00", "17:00"),
  buildLog("LOG_5005", "ORG_PH_001", "USR_002", "2026-06-05", "08:00", "17:00"),
  buildLog("LOG_5006", "ORG_PH_001", "USR_002", "2026-06-06", "08:00", "17:00"),
  buildLog("LOG_5007", "ORG_PH_001", "USR_002", "2026-06-08", "08:00", "17:00"),
  buildLog("LOG_5008", "ORG_PH_001", "USR_002", "2026-06-09", "08:00", "17:00"),
  buildLog("LOG_5009", "ORG_PH_001", "USR_002", "2026-06-10", "08:00", null),
  buildLog("LOG_5010", "ORG_PH_001", "USR_003", "2026-06-01", "08:00", "17:00"),
  buildLog("LOG_5011", "ORG_PH_001", "USR_003", "2026-06-02", "08:15", "17:15"),
  buildLog("LOG_5012", "ORG_PH_001", "USR_003", "2026-06-03", "07:30", "17:00", ["Outside Shift Hours"]),
  buildLog("LOG_5013", "ORG_PH_001", "USR_003", "2026-06-04", "08:00", "17:00"),
  buildLog("LOG_6001", "ORG_PH_002", "USR_102", "2026-06-01", "09:00", "18:00")
];

const attendance_adjustments: AttendanceAdjustment[] = [];

const correction_requests: CorrectionRequest[] = [
  {
    request_id: "REQ_8801",
    org_id: "ORG_PH_001",
    employee_id: "USR_002",
    target_date: "2026-06-09",
    requested_clock_in: "08:00",
    requested_clock_out: "17:00",
    employee_note: "Forgot to punch in until late, then double tapped at 2 PM.",
    status: "pending",
    reviewer_note: null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    created_at: "2026-06-09T08:10:00Z"
  }
];

export const seedData: SeedData = {
  organizations,
  users,
  attendance_logs,
  attendance_adjustments,
  correction_requests
};
