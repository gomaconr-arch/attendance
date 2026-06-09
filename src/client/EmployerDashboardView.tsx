import React, { useMemo, useState } from "react";
import { AttendanceLog, DateRange, Organization, OrganizationSettings, PayrollMode, User, WorkDayName } from "../shared/types";
import { formatFixed, formatMoney } from "../shared/format";
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
  dateRange: DateRange;
  onChangeDateRange: (range: DateRange) => void;
  onAddEmployee: (payload: AddEmployeePayload) => void;
  onUpdateOrganizationSettings: (settings: OrganizationSettings) => void;
  onFinalizeDraft: (runtimeModes: Record<string, PayrollMode>) => void;
  onLogout: () => void;
}

const WEEK_DAYS: WorkDayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type EmployerTab = "config" | "team" | "payroll" | "logs";

export default function EmployerDashboard({
  employer,
  organization,
  users,
  logs,
  dateRange,
  onChangeDateRange,
  onAddEmployee,
  onUpdateOrganizationSettings,
  onFinalizeDraft,
  onLogout
}: Props) {
  const [activeTab, setActiveTab] = useState<EmployerTab>("config");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [runtimeModes, setRuntimeModes] = useState<Record<string, PayrollMode>>({});
  const [capOverrides, setCapOverrides] = useState<Record<string, boolean>>({});
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

  const payrollRows = useMemo(() => {
    return staff.map((employee) => {
      const employeeLogs = logs.filter((log) => log.employee_id === employee.user_id && log.date.startsWith(currentMonthKey));

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

  const TabButton = ({ id, label }: { id: EmployerTab; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
        activeTab === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Employer Workspace</p>
          <h2 className="text-lg font-semibold text-slate-900">{organization.company_name}</h2>
        </div>
        <button onClick={onLogout} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-slate-100">
          Logout
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border bg-white p-3">
        <TabButton id="config" label="Configuration" />
        <TabButton id="team" label="Team" />
        <TabButton id="payroll" label="Payroll Draft" />
        <TabButton id="logs" label="Logs" />
      </div>

      {activeTab === "config" && (
        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Tenant Configuration Panel</h3>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold uppercase text-indigo-700">
              Tenant Defaults Label
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              className="rounded-md border px-2 py-2 text-sm"
              value={settings.currency}
              onChange={(event) => onUpdateOrganizationSettings({ ...settings, currency: event.target.value.toUpperCase() })}
              placeholder="Currency"
            />
            <input
              type="number"
              min={1}
              step={0.01}
              className="rounded-md border px-2 py-2 text-sm"
              value={settings.max_hours_per_month}
              onChange={(event) =>
                onUpdateOrganizationSettings({
                  ...settings,
                  max_hours_per_month: Number(event.target.value)
                })
              }
              placeholder="Max hours per month"
            />
            <input
              type="time"
              className="rounded-md border px-2 py-2 text-sm"
              value={settings.shift_start}
              onChange={(event) => onUpdateOrganizationSettings({ ...settings, shift_start: event.target.value })}
            />
            <input
              type="time"
              className="rounded-md border px-2 py-2 text-sm"
              value={settings.shift_end}
              onChange={(event) => onUpdateOrganizationSettings({ ...settings, shift_end: event.target.value })}
            />
            <input
              type="number"
              min={0}
              step={0.01}
              className="rounded-md border px-2 py-2 text-sm"
              value={settings.default_hourly_rate}
              onChange={(event) =>
                onUpdateOrganizationSettings({
                  ...settings,
                  default_hourly_rate: Number(event.target.value)
                })
              }
              placeholder="Default hourly rate"
            />
            <input
              type="number"
              min={0}
              step={0.01}
              className="rounded-md border px-2 py-2 text-sm"
              value={settings.default_monthly_rate}
              onChange={(event) =>
                onUpdateOrganizationSettings({
                  ...settings,
                  default_monthly_rate: Number(event.target.value)
                })
              }
              placeholder="Default monthly rate"
            />
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">Operational Workdays</p>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map((day) => {
                const active = settings.work_days.includes(day);
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
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-300"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {activeTab === "team" && (
        <section className="rounded-xl border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Team Provisioning</h3>
          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              onAddEmployee(employeeForm);
              setEmployeeForm({ name: "", email: "", password: "", payroll_mode: "hourly" });
            }}
          >
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Full Name"
              value={employeeForm.name}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Email"
              value={employeeForm.email}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Password"
              value={employeeForm.password}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={employeeForm.payroll_mode}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, payroll_mode: event.target.value as PayrollMode }))}
            >
              <option value="hourly">Hourly baseline</option>
              <option value="monthly">Monthly baseline</option>
            </select>
            <button className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Add Employee
            </button>
          </form>
        </section>
      )}

      {activeTab === "payroll" && (
        <section className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Dynamic Payroll Drafting Console</h3>
            <button
              onClick={() => onFinalizeDraft(runtimeModes)}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Finalize Draft
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Draft Hours</p>
              <p className="text-lg font-semibold text-slate-900">{formatFixed(rollup.totalHours)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Draft Payroll</p>
              <p className="text-lg font-semibold text-emerald-700">
                {organization.settings.currency} {formatMoney(rollup.totalPayout, organization.settings.currency)}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {payrollRows.map((row) => (
              <div key={row.employee.user_id} className="rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{row.employee.name}</p>
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
                    className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
                  >
                    {row.mode === "hourly" ? "Hourly" : "Monthly"}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <p className="font-medium text-slate-700">
                    Draft: {organization.settings.currency} {formatMoney(row.payout, organization.settings.currency)}
                  </p>
                  <p className="text-slate-500">Payable Hours: {formatFixed(row.payableHours)}</p>
                </div>

                {row.capExceeded && (
                  <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                    <p className="font-semibold text-amber-700">Cap Exceeded</p>
                    <label className="mt-1 flex items-center gap-2 text-slate-700">
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

                {row.pendingCount > 0 && <p className="mt-2 text-amber-700">Pending Clock-out Logs: {row.pendingCount}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "logs" && (
        <section className="rounded-xl border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Employee Deep-Dive Timeline</h3>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="date"
              className="rounded-md border px-2 py-2 text-sm"
              value={dateRange.start}
              onChange={(event) => onChangeDateRange({ ...dateRange, start: event.target.value })}
            />
            <input
              type="date"
              className="rounded-md border px-2 py-2 text-sm"
              value={dateRange.end}
              onChange={(event) => onChangeDateRange({ ...dateRange, end: event.target.value })}
            />
          </div>

          <select
            className="mt-2 w-full rounded-md border px-2 py-2 text-sm"
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

          <div className="mt-3 space-y-2">
            {filteredLogs.map((log) => (
              <div key={log.log_id} className="rounded-lg border px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{log.date}</span>
                  {log.clock_out === null ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">Pending Clock-out</span>
                  ) : (
                    <span className="font-semibold text-slate-800">{formatFixed(log.total_hours ?? 0)} hrs</span>
                  )}
                </div>
                <p className="mt-1 text-slate-500">
                  {log.clock_in} - {log.clock_out ?? "Open Shift"}
                </p>
                {log.flags.length > 0 && <p className="mt-1 text-amber-700">Flags: {log.flags.join(", ")}</p>}
              </div>
            ))}
            {filteredLogs.length === 0 && <p className="text-xs text-slate-500">No records in selected range.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
