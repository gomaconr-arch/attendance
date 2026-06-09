import React, { useEffect, useMemo, useState } from "react";
import { AttendanceLog, Organization, User } from "../shared/types";
import { formatFixed } from "../shared/format";
import { toMoney } from "../shared/payroll";
import { manilaDate, manilaTime } from "../shared/timezone";

interface Props {
  user: User;
  organization: Organization;
  logs: AttendanceLog[];
  onPunch: () => void;
  onLogout: () => void;
}

type EmployeeTab = "clock" | "history";

export default function EmployeeConsole({ user, organization, logs, onPunch, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<EmployeeTab>("clock");
  const [nowDate, setNowDate] = useState(manilaDate());
  const [nowTime, setNowTime] = useState(manilaTime());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowDate(manilaDate());
      setNowTime(manilaTime());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const activeLog = useMemo(() => logs.find((log) => log.clock_out === null) ?? null, [logs]);

  const payPeriodLogs = useMemo(() => {
    return [...logs].sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);

  const approvedHours = useMemo(() => {
    return toMoney(
      logs.reduce((acc, log) => {
        if (log.clock_out === null || log.total_hours === null) {
          return acc;
        }
        return acc + log.total_hours;
      }, 0)
    );
  }, [logs]);

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Employee Console</p>
          <h2 className="text-lg font-semibold text-slate-900">{user.name}</h2>
        </div>
        <button onClick={onLogout} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-slate-100">
          Logout
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border bg-white p-3">
        <button
          type="button"
          onClick={() => setActiveTab("clock")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            activeTab === "clock" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Clock
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            activeTab === "history" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          History
        </button>
      </div>

      {activeTab === "clock" && (
        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">Current Manila Date and Time</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{nowDate}</p>
            <p className="text-3xl font-black text-slate-900">{nowTime}</p>
          </div>

          <div className="rounded-xl border bg-white p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Hours This Pay Period</p>
            <p className="mt-1 text-5xl font-black text-slate-900">{formatFixed(approvedHours)}</p>
            <p className="text-xs text-slate-500">Hours tracked under {organization.settings.currency} payroll cycle</p>
          </div>

          <div className="rounded-xl border bg-white p-5 text-center">
            <button
              onClick={onPunch}
              className={`h-36 w-36 rounded-full text-sm font-semibold text-white ${
                activeLog ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
              }`}
              aria-label={activeLog ? "Clock Out" : "Clock In"}
            >
              {activeLog ? "Clock Out" : "Clock In"}
            </button>
            <p className="mt-3 text-xs text-slate-500">
              {activeLog ? `Shift started at ${activeLog.clock_in}` : "One tap starts your shift"}
            </p>
          </div>
        </section>
      )}

      {activeTab === "history" && (
        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Shift History</h3>
          <div className="space-y-2">
            {payPeriodLogs.map((log) => (
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
            {payPeriodLogs.length === 0 && <p className="text-xs text-slate-500">No logs for this pay period.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
