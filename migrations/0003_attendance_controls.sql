ALTER TABLE attendance_logs ADD COLUMN is_modified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance_logs ADD COLUMN is_voided INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS attendance_adjustments (
  adjustment_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  log_id TEXT NOT NULL,
  modified_by_user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  previous_values_json TEXT NOT NULL,
  new_values_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id),
  FOREIGN KEY (log_id) REFERENCES attendance_logs(log_id),
  FOREIGN KEY (modified_by_user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS correction_requests (
  request_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  target_date TEXT NOT NULL,
  requested_clock_in TEXT NOT NULL,
  requested_clock_out TEXT NOT NULL,
  employee_note TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note TEXT,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id),
  FOREIGN KEY (employee_id) REFERENCES users(user_id),
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_adjustments_org_time ON attendance_adjustments(org_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_correction_org_status ON correction_requests(org_id, status, created_at DESC);

INSERT OR REPLACE INTO correction_requests (
  request_id, org_id, employee_id, target_date, requested_clock_in, requested_clock_out,
  employee_note, status, reviewer_note, reviewed_by_user_id, reviewed_at, created_at
) VALUES (
  'REQ_8801', 'ORG_PH_001', 'USR_002', '2026-06-09', '08:00', '17:00',
  'Forgot to punch in until late, then double tapped at 2 PM.', 'pending', NULL, NULL, NULL, '2026-06-09T08:10:00Z'
);
