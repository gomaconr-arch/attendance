INSERT OR REPLACE INTO organizations (
  org_id, company_name, subscription_status, currency, work_days_json, shift_start, shift_end,
  default_hourly_rate, default_monthly_rate, max_hours_per_month, created_at, updated_at
) VALUES
('ORG_PH_001', 'Manila Tech Solutions', 'enabled', 'PHP', '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]', '08:00', '17:00', 300.00, 12000.00, 40.00, '2026-05-01', '2026-06-09'),
('ORG_PH_002', 'Cebu Retail Group', 'disabled', 'PHP', '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]', '09:00', '18:00', 300.00, 12000.00, 40.00, '2026-05-03', '2026-06-09');

INSERT OR REPLACE INTO users (
  user_id, org_id, name, email, password, role, payroll_mode, custom_hourly_rate, custom_monthly_rate, created_at
) VALUES
('SA_001', NULL, 'Platform Owner', 'admin@platform.com', 'admin123', 'SuperAdmin', NULL, NULL, NULL, '2026-05-01'),
('USR_001', 'ORG_PH_001', 'Admin Employer', 'employer@manila.tech', 'employer123', 'Employer', NULL, NULL, NULL, '2026-05-01'),
('USR_002', 'ORG_PH_001', 'Juan Dela Cruz', 'juan@manila.tech', 'juan123', 'Employee', 'hourly', NULL, NULL, '2026-05-01'),
('USR_003', 'ORG_PH_001', 'Maria Santos', 'maria@manila.tech', 'maria123', 'Employee', 'monthly', 320.00, 14500.00, '2026-05-01'),
('USR_101', 'ORG_PH_002', 'Disabled Employer', 'owner@cebu.group', 'owner123', 'Employer', NULL, NULL, NULL, '2026-05-03'),
('USR_102', 'ORG_PH_002', 'Locked Employee', 'locked@cebu.group', 'locked123', 'Employee', 'hourly', NULL, NULL, '2026-05-03');

INSERT OR REPLACE INTO attendance_logs (
  log_id, org_id, employee_id, date, clock_in, clock_out, total_hours, flags_json
) VALUES
('LOG_5001', 'ORG_PH_001', 'USR_002', '2026-06-01', '08:00', '17:00', 9.00, '[]'),
('LOG_5002', 'ORG_PH_001', 'USR_002', '2026-06-02', '08:00', '17:00', 9.00, '[]'),
('LOG_5003', 'ORG_PH_001', 'USR_002', '2026-06-03', '08:00', '17:00', 9.00, '[]'),
('LOG_5004', 'ORG_PH_001', 'USR_002', '2026-06-04', '08:00', '17:00', 9.00, '[]'),
('LOG_5005', 'ORG_PH_001', 'USR_002', '2026-06-05', '08:00', '17:00', 9.00, '[]'),
('LOG_5006', 'ORG_PH_001', 'USR_002', '2026-06-06', '08:00', '17:00', 9.00, '[]'),
('LOG_5007', 'ORG_PH_001', 'USR_002', '2026-06-08', '08:00', '17:00', 9.00, '[]'),
('LOG_5008', 'ORG_PH_001', 'USR_002', '2026-06-09', '08:00', '17:00', 9.00, '[]'),
('LOG_5009', 'ORG_PH_001', 'USR_002', '2026-06-10', '08:00', NULL, NULL, '[]'),
('LOG_5010', 'ORG_PH_001', 'USR_003', '2026-06-01', '08:00', '17:00', 9.00, '[]'),
('LOG_5011', 'ORG_PH_001', 'USR_003', '2026-06-02', '08:15', '17:15', 9.00, '[]'),
('LOG_5012', 'ORG_PH_001', 'USR_003', '2026-06-03', '07:30', '17:00', 9.50, '["Outside Shift Hours"]'),
('LOG_5013', 'ORG_PH_001', 'USR_003', '2026-06-04', '08:00', '17:00', 9.00, '[]');
