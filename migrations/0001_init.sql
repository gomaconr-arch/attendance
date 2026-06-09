CREATE TABLE IF NOT EXISTS organizations (
  org_id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  subscription_status TEXT NOT NULL CHECK (subscription_status IN ('enabled', 'disabled')),
  currency TEXT NOT NULL,
  work_days_json TEXT NOT NULL,
  shift_start TEXT NOT NULL,
  shift_end TEXT NOT NULL,
  default_hourly_rate REAL NOT NULL,
  default_monthly_rate REAL NOT NULL,
  max_hours_per_month REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  org_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SuperAdmin', 'Employer', 'Employee')),
  payroll_mode TEXT,
  custom_hourly_rate REAL,
  custom_monthly_rate REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id)
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  log_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  clock_in TEXT NOT NULL,
  clock_out TEXT,
  total_hours REAL,
  flags_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (org_id) REFERENCES organizations(org_id),
  FOREIGN KEY (employee_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_logs_org_date ON attendance_logs(org_id, date);
CREATE INDEX IF NOT EXISTS idx_logs_emp_date ON attendance_logs(employee_id, date);
