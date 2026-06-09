import React, { useMemo, useState } from "react";
import { AttendanceLog, CorrectionRequest, DateRange, Organization, OrganizationSettings, PayrollMode, User, WorkDayName } from "../shared/types";
import { formatCalendarDate, formatFixed, formatMoney, formatTimeAmPm, formatDateTimeAmPm, formatShortDate } from "../shared/format";
import { hoursForPayroll, isWithinRange, monthFromDate, payoutForMode, toMoney } from "../shared/payroll";

interface AddEmployeePayload {
  name: string;
  email: string;
  password: string;
  payroll_mode: PayrollMode;
}

interface Props {
  employer: User;
  organization: Organization;
  users: User[];
  logs: AttendanceLog[];
  correctionRequests: CorrectionRequest[];
  dateRange: DateRange;
  onChangeDateRange: (range: DateRange) => void;
  onAddEmployee: (payload: AddEmployeePayload) => void;
  onUpdateOrganizationSettings: (settings: OrganizationSettings) => void;
  onFinalizeDraft: (runtimeModes: Record<string, PayrollMode>) => void;
  onOverwriteLog: (payload: {
    log_id: string;
    clock_in: string;
    clock_out: string;
    reason: string;
    void_log: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onReviewCorrectionRequest: (payload: {
    request_id: string;
    decision: "approve" | "reject";
    reason?: string;
    reviewer_note?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onEditEmployee?: (payload: { user_id: string; name?: string; email?: string; payroll_mode?: PayrollMode }) => Promise<{ ok: boolean; error?: string }>;
  onRemoveEmployee?: (user_id: string) => Promise<{ ok: boolean; error?: string }>;
  onToggleDisableEmployee?: (user_id: string) => Promise<{ ok: boolean; error?: string }>;
  onResetEmployeePassword?: (user_id: string) => Promise<{ ok: boolean; password?: string; error?: string }>;
  onLogout: () => void;
}

const WEEK_DAYS: WorkDayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type EmployerTab = "setup" | "payroll" | "logs" | "disputes";

export default function EmployerDashboard({
  employer,
  organization,
  users,
  logs,
  correctionRequests,
  dateRange,
  onChangeDateRange,
  onAddEmployee,
  onUpdateOrganizationSettings,
  onFinalizeDraft,
  onOverwriteLog,
  onReviewCorrectionRequest,
  onEditEmployee,
  onRemoveEmployee,
  onToggleDisableEmployee,
  onResetEmployeePassword,
  onLogout
}: Props) {
  const [activeTab, setActiveTab] = useState<EmployerTab>("payroll");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [runtimeModes, setRuntimeModes] = useState<Record<string, PayrollMode>>({});
  const [capOverrides, setCapOverrides] = useState<Record<string, boolean>>({});
  const [editTarget, setEditTarget] = useState<AttendanceLog | null>(null);
  const [editClockIn, setEditClockIn] = useState<string>("");
  const [editClockOut, setEditClockOut] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [approvalReasons, setApprovalReasons] = useState<Record<string, string>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [approvalError, setApprovalError] = useState<string>("");
  const [employeeForm, setEmployeeForm] = useState<AddEmployeePayload>({
    name: "",
    email: "",
    password: "",
    payroll_mode: "hourly"
  });

  const staff = useMemo(
    () => users.filter((u) => u.org_id === employer.org_id && u.role === "Employee"),
    [users, employer.org_id]
  );

  const currentMonthKey = monthFromDate(dateRange.end);

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => isWithinRange(log.date, dateRange.start, dateRange.end))
      .filter((log) => selectedEmployeeId === "all" || log.employee_id === selectedEmployeeId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [logs, dateRange, selectedEmployeeId]);

  const groupedEmployeeLogs = useMemo(() => {
    const staffLookup = new Map(staff.map((employee) => [employee.user_id, employee.name]));
    const grouped = new Map<
      string,
      {
        employeeId: string;
        employeeName: string;
        entries: AttendanceLog[];
        totalHours: number;
        pendingCount: number;
      }
    >();

    filteredLogs.forEach((log) => {
      const employeeName = staffLookup.get(log.employee_id) ?? "Unknown Employee";
      const row = grouped.get(log.employee_id) ?? {
        employeeId: log.employee_id,
        employeeName,
        entries: [],
        totalHours: 0,
        pendingCount: 0
      };

      row.entries.push(log);
      if (!log.is_voided && log.total_hours !== null && log.clock_out !== null) {
        row.totalHours += log.total_hours;
      }
      if (!log.is_voided && log.clock_out === null) {
        row.pendingCount += 1;
      }

      grouped.set(log.employee_id, row);
    });

    return Array.from(grouped.values())
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
      .map((row) => ({
        ...row,
        entries: [...row.entries].sort((a, b) => b.date.localeCompare(a.date)),
        totalHours: toMoney(row.totalHours)
      }));
  }, [filteredLogs, staff]);

  const flatLogs = useMemo(() => {
    return filteredLogs
      .slice()
      .sort((a, b) => {
        const aKey = `${a.date} ${a.clock_in}`;
        const bKey = `${b.date} ${b.clock_in}`;
        return bKey.localeCompare(aKey);
      })
      .map((log) => ({ log, employeeName: staff.find((s) => s.user_id === log.employee_id)?.name ?? "Unknown" }));
  }, [filteredLogs, staff]);

  const payrollRows = useMemo(() => {
    return staff.map((employee) => {
      const employeeLogs = logs.filter(
        (log) => log.employee_id === employee.user_id && log.date.startsWith(currentMonthKey) && !log.is_voided
      );

      const approvedHours = toMoney(
        employeeLogs.reduce((acc, log) => {
          if (log.clock_out === null || log.total_hours === null) {
            return acc;
          }
          return acc + log.total_hours;
        }, 0)
      );

      const pendingCount = employeeLogs.filter((log) => log.clock_out === null).length;
      const mode = runtimeModes[employee.user_id] ?? employee.payroll_mode ?? "hourly";
      const overrideCap = capOverrides[employee.user_id] ?? false;
      const maxHours = organization.settings.max_hours_per_month;
      const capExceeded = approvedHours > maxHours;
      const payableHours = hoursForPayroll(approvedHours, maxHours, overrideCap);
      const payout = payoutForMode(mode, employee, payableHours, currentMonthKey, organization.settings);

      return {
        employee,
        approvedHours,
        pendingCount,
        mode,
        overrideCap,
        capExceeded,
        payout,
        payableHours
      };
    });
  }, [staff, logs, currentMonthKey, runtimeModes, capOverrides, organization.settings]);

  const rollup = useMemo(() => {
    const totalHours = toMoney(payrollRows.reduce((acc, row) => acc + row.payableHours, 0));
    const totalPayout = toMoney(payrollRows.reduce((acc, row) => acc + row.payout, 0));
    return { totalHours, totalPayout };
  }, [payrollRows]);

  const settings = organization.settings;
  const pendingRequests = useMemo(
    () => correctionRequests.filter((request) => request.status === "pending").sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [correctionRequests]
  );

  const openEditModal = (entry: AttendanceLog) => {
    setEditTarget(entry);
    setEditClockIn(entry.clock_in);
    setEditClockOut(entry.clock_out ?? entry.clock_in);
    setEditReason("");
    setEditError("");
  };

  const submitEdit = async (voidLog: boolean) => {
    if (!editTarget) {
      return;
    }

    if (editReason.trim().length < 10) {
      setEditError("Adjustment reason must be at least 10 characters.");
      return;
    }

    const result = await onOverwriteLog({
      log_id: editTarget.log_id,
      clock_in: editClockIn,
      clock_out: editClockOut,
      reason: editReason,
      void_log: voidLog
    });

    if (!result.ok) {
      setEditError(result.error ?? "Unable to save log adjustment.");
      return;
    }

    setEditTarget(null);
    setEditReason("");
    setEditClockIn("");
    setEditClockOut("");
    setEditError("");
  };

  const TabButton = ({ id, label }: { id: EmployerTab; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`py-3 text-[10px] font-bold ${
        activeTab === id ? "border-b-2 border-indigo-500 bg-indigo-500/5 text-indigo-400" : "text-slate-400"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-full bg-slate-950 p-4 text-slate-100">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Employer Workspace</p>
          <h2 className="text-lg font-black text-white">{organization.company_name}</h2>
        </div>
        <button onClick={onLogout} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">
          Logout
        </button>
      </header>

      <div className="mb-4 grid grid-cols-4 border-b border-slate-800 bg-slate-900/40 text-center">
        <TabButton id="payroll" label="Payroll" />
        <TabButton id="logs" label="Time Logs" />
        <TabButton id="disputes" label="Disputes" />
        <TabButton id="setup" label="Setup" />
      </div>

      {activeTab === "setup" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Tenant Configuration Panel</h3>
            <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-[10px] font-semibold uppercase text-indigo-400">
              Configure parameters
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
              Currency
              <input
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                value={settings.currency}
                onChange={(event) => onUpdateOrganizationSettings({ ...settings, currency: event.target.value.toUpperCase() })}
                placeholder="Currency"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
              Max Hours Per Month
              <input
                type="number"
                min={1}
                step={0.01}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                value={settings.max_hours_per_month}
                onChange={(event) =>
                  onUpdateOrganizationSettings({
                    ...settings,
                    max_hours_per_month: Number(event.target.value)
                  })
                }
                placeholder="Max hours per month"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
              Shift Start
              <input
                type="time"
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                value={settings.shift_start}
                onChange={(event) => onUpdateOrganizationSettings({ ...settings, shift_start: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
              Shift End
              <input
                type="time"
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                value={settings.shift_end}
                onChange={(event) => onUpdateOrganizationSettings({ ...settings, shift_end: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
              Default Hourly Rate
              <input
                type="number"
                min={0}
                step={0.01}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                value={settings.default_hourly_rate}
                onChange={(event) =>
                  onUpdateOrganizationSettings({
                    ...settings,
                    default_hourly_rate: Number(event.target.value)
                  })
                }
                placeholder="Default hourly rate"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
              Default Monthly Rate
              <input
                type="number"
                min={0}
                step={0.01}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                value={settings.default_monthly_rate}
                onChange={(event) =>
                  onUpdateOrganizationSettings({
                    ...settings,
                    default_monthly_rate: Number(event.target.value)
                  })
                }
                placeholder="Default monthly rate"
              />
            </label>
          </div>

          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-400">Operational Workdays</p>
            <div className="grid grid-cols-4 gap-2">
              {WEEK_DAYS.map((day) => {
                const active = settings.work_days.includes(day);
                const shortDay = day.slice(0, 3);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (active) {
                        onUpdateOrganizationSettings({
                          ...settings,
                          work_days: settings.work_days.filter((item) => item !== day)
                        });
                      } else {
                        onUpdateOrganizationSettings({
                          ...settings,
                          work_days: [...settings.work_days, day]
                        });
                      }
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs ${
                      active ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 ring-1 ring-slate-700"
                    }`}
                  >
                    {shortDay}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onUpdateOrganizationSettings(settings)}
            className="mt-3 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Save Organization Configurations
          </button>
        </section>
      )}

      {activeTab === "setup" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-white">Manage Team Members</h3>
          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              onAddEmployee(employeeForm);
              setEmployeeForm({ name: "", email: "", password: "", payroll_mode: "hourly" });
            }}
          >
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Full Name"
              value={employeeForm.name}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              type="email"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Email"
              value={employeeForm.email}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
            <input
              type="password"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Default Password"
              value={employeeForm.password}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={employeeForm.payroll_mode}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, payroll_mode: event.target.value as PayrollMode }))}
            >
              <option value="hourly">Hourly Rate</option>
              <option value="monthly">Monthly Rate</option>
            </select>
            <button className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Add Employee
            </button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Created</th>
                  <th className="py-2">Last Modified</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.user_id} className="border-b border-slate-800">
                    <td className="py-3 font-medium text-slate-100">{s.name}</td>
                    <td className="py-3 text-slate-400">{s.email}</td>
                    <td className="py-3 font-mono text-xs text-slate-400">{formatDateTimeAmPm(s.created_at)}</td>
                    <td className="py-3 font-mono text-xs text-slate-400">{formatDateTimeAmPm(s.created_at)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            // quick reset password
                            // eslint-disable-next-line @typescript-eslint/no-floating-promises
                            onResetEmployeePassword?.(s.user_id);
                          }}
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-300"
                        >
                          Reset PW
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // toggle disable
                            // eslint-disable-next-line @typescript-eslint/no-floating-promises
                            onToggleDisableEmployee?.(s.user_id);
                          }}
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-300"
                        >
                          {s.name.includes("(disabled)") ? "Enable" : "Disable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remove employee ${s.name}? This cannot be undone.`)) {
                              // eslint-disable-next-line @typescript-eslint/no-floating-promises
                              onRemoveEmployee?.(s.user_id);
                            }
                          }}
                          className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {staff.length === 0 && <p className="mt-3 text-xs text-slate-500">No employees found.</p>}
          </div>
        </section>
      )}

      {activeTab === "payroll" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Dynamic Payroll Drafting Console</h3>
            <button
              onClick={() => onFinalizeDraft(runtimeModes)}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Finalize Draft
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">Draft Hours</p>
              <p className="text-lg font-semibold text-slate-100">{formatFixed(rollup.totalHours)}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">Draft Payroll</p>
              <p className="text-lg font-semibold text-emerald-400">
                {organization.settings.currency} {formatMoney(rollup.totalPayout, organization.settings.currency)}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {payrollRows.map((row) => (
              <div key={row.employee.user_id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-100">{row.employee.name}</p>
                    <p className="text-slate-500">Tracked Hours: {formatFixed(row.approvedHours)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRuntimeModes((prev) => ({
                        ...prev,
                        [row.employee.user_id]: row.mode === "hourly" ? "monthly" : "hourly"
                      }))
                    }
                    className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 font-medium text-slate-300"
                  >
                    {row.mode === "hourly" ? "Hourly" : "Monthly"}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <p className="font-medium text-slate-300">
                    Draft: {organization.settings.currency} {formatMoney(row.payout, organization.settings.currency)}
                  </p>
                  <p className="text-slate-500">Payable Hours: {formatFixed(row.payableHours)}</p>
                </div>

                {row.capExceeded && (
                  <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
                    <p className="font-semibold text-amber-400">Cap Exceeded</p>
                    <label className="mt-1 flex items-center gap-2 text-slate-300">
                      <input
                        type="checkbox"
                        checked={row.overrideCap}
                        onChange={(event) =>
                          setCapOverrides((prev) => ({
                            ...prev,
                            [row.employee.user_id]: event.target.checked
                          }))
                        }
                      />
                      Override Cap
                    </label>
                  </div>
                )}

                {row.pendingCount > 0 && <p className="mt-2 text-amber-400">Pending Clock-out Logs: {row.pendingCount}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "logs" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-white">Mobile Employer Logs Management</h3>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="date"
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              value={dateRange.start}
              onChange={(event) => onChangeDateRange({ ...dateRange, start: event.target.value })}
            />
            <input
              type="date"
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              value={dateRange.end}
              onChange={(event) => onChangeDateRange({ ...dateRange, end: event.target.value })}
            />
          </div>

          <select
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
          >
            <option value="all">All Employees</option>
            {staff.map((employee) => (
              <option key={employee.user_id} value={employee.user_id}>
                {employee.name}
              </option>
            ))}
          </select>

          <div className="mt-3 overflow-x-auto">
            <div className="hidden sm:block">
              <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Details</th>
                  <th className="py-2 pr-3 text-right">Total Hours</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flatLogs.map(({ log, employeeName }) => (
                  <tr key={log.log_id} className="border-b border-slate-800 align-top">
                    <td className="py-3 pr-3 align-top font-mono text-xs">{formatShortDate(log.date)}</td>
                    <td className="py-3 pr-3 align-top">{formatTimeAmPm(log.clock_in)} - {log.clock_out ? formatTimeAmPm(log.clock_out) : "Open"}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">{(() => {
                            const parts = employeeName.split(" ").filter(Boolean);
                            const initials = parts.map((p) => p[0]).slice(0, 2).join("").toUpperCase();
                            return initials;
                          })()}</span>
                        <div className="text-slate-400">{log.is_voided ? "Voided" : log.is_modified ? "Modified" : ""}</div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right font-semibold text-slate-100">{formatFixed(log.total_hours ?? 0)} hrs</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(log)}
                        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        aria-label="Edit log"
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-2">
              {flatLogs.map(({ log, employeeName }) => {
                const parts = employeeName.split(" ").filter(Boolean);
                const initials = parts.map((p) => p[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <div key={log.log_id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-slate-100">{initials}</div>
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{employeeName}</div>
                          <div className="text-xs text-slate-500">{formatShortDate(log.date)} • {formatTimeAmPm(log.clock_in)}{log.clock_out ? ` - ${formatTimeAmPm(log.clock_out)}` : ''}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-100">{formatFixed(log.total_hours ?? 0)} hrs</div>
                        <button onClick={() => openEditModal(log)} className="mt-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs">✏️</button>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">{log.is_voided ? 'Voided' : log.is_modified ? 'Modified' : ''}</div>
                  </div>
                );
              })}
            </div>
            {flatLogs.length === 0 && <p className="mt-3 text-xs text-slate-500">No records in selected range.</p>}
          </div>
        </section>
      )}

      {activeTab === "disputes" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-white">Approval Center</h3>

          <div className="mt-3 space-y-3">
            {pendingRequests.map((request) => {
              const employeeName = staff.find((member) => member.user_id === request.employee_id)?.name ?? request.employee_id;
              return (
                <article key={request.request_id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-100">{employeeName}</p>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-amber-400">
                      Pending
                    </span>
                  </div>
                  <p className="mt-1 text-slate-400">Date: {formatCalendarDate(request.target_date)}</p>
                  <p className="text-slate-400">
                    Requested: {formatTimeAmPm(request.requested_clock_in)} - {formatTimeAmPm(request.requested_clock_out)}
                  </p>
                  <p className="mt-1 text-slate-400">Employee Note: {request.employee_note}</p>

                  <textarea
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                    value={approvalReasons[request.request_id] ?? ""}
                    onChange={(event) =>
                      setApprovalReasons((prev) => ({
                        ...prev,
                        [request.request_id]: event.target.value
                      }))
                    }
                    placeholder="Adjustment Reason (required for approval, min 10 chars)"
                  />

                  <textarea
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                    value={rejectNotes[request.request_id] ?? ""}
                    onChange={(event) =>
                      setRejectNotes((prev) => ({
                        ...prev,
                        [request.request_id]: event.target.value
                      }))
                    }
                    placeholder="Optional feedback note for rejection"
                  />

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-emerald-600 px-3 py-1.5 font-semibold text-white"
                      onClick={async () => {
                        const result = await onReviewCorrectionRequest({
                          request_id: request.request_id,
                          decision: "approve",
                          reason: approvalReasons[request.request_id],
                          reviewer_note: rejectNotes[request.request_id]
                        });
                        if (!result.ok) {
                          setApprovalError(result.error ?? "Unable to approve request.");
                          return;
                        }
                        setApprovalError("");
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-rose-600 px-3 py-1.5 font-semibold text-white"
                      onClick={async () => {
                        const result = await onReviewCorrectionRequest({
                          request_id: request.request_id,
                          decision: "reject",
                          reviewer_note: rejectNotes[request.request_id]
                        });
                        if (!result.ok) {
                          setApprovalError(result.error ?? "Unable to reject request.");
                          return;
                        }
                        setApprovalError("");
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              );
            })}
            {approvalError && <p className="text-xs font-medium text-rose-400">{approvalError}</p>}
            {pendingRequests.length === 0 && <p className="text-xs text-slate-500">No pending correction requests.</p>}
          </div>
        </section>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Edit Logs</h4>
              <button type="button" onClick={() => setEditTarget(null)} className="text-xs font-semibold text-slate-500">
                Close
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <label className="flex flex-col gap-1">
                Clock-In
                <input type="time" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" value={editClockIn} onChange={(event) => setEditClockIn(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                Clock-Out
                <input type="time" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" value={editClockOut} onChange={(event) => setEditClockOut(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                Adjustment Reason
                <textarea
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
                  value={editReason}
                  onChange={(event) => setEditReason(event.target.value)}
                  placeholder="Explain why this log is being adjusted"
                />
              </label>
              {editError && <p className="text-rose-400">{editError}</p>}
            </div>

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void submitEdit(false)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
                Save Edit
              </button>
              <button type="button" onClick={() => void submitEdit(true)} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">
                Void Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
