import React, { useEffect, useMemo, useState } from "react";
import { AttendanceLog, CorrectionRequest, Organization, User } from "../shared/types";
import { formatCalendarDate, formatFixed, formatTimeAmPm } from "../shared/format";
import { toMoney } from "../shared/payroll";
import { manilaDate, manilaTime } from "../shared/timezone";

interface Props {
  user: User;
  organization: Organization;
  logs: AttendanceLog[];
  correctionRequests: CorrectionRequest[];
  onPunch: () => Promise<{ ok: boolean; error?: string }>;
  onSubmitCorrectionRequest: (payload: {
    target_date: string;
    requested_clock_in: string;
    requested_clock_out: string;
    employee_note: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onLogout: () => void;
}

type EmployeeTab = "clock" | "history" | "dispute";

export default function EmployeeConsole({
  user,
  organization,
  logs,
  correctionRequests,
  onPunch,
  onSubmitCorrectionRequest,
  onLogout
}: Props) {
  const [activeTab, setActiveTab] = useState<EmployeeTab>("clock");
  const [nowDate, setNowDate] = useState(manilaDate());
  const [nowTime, setNowTime] = useState(manilaTime());
  const [punchLockUntil, setPunchLockUntil] = useState<number>(0);
  const [lockCountdown, setLockCountdown] = useState<number>(0);
  const [punchError, setPunchError] = useState<string>("");
  const [requestDate, setRequestDate] = useState<string>("");
  const [requestClockIn, setRequestClockIn] = useState<string>("08:00");
  const [requestClockOut, setRequestClockOut] = useState<string>("17:00");
  const [requestNote, setRequestNote] = useState<string>("");
  const [requestMessage, setRequestMessage] = useState<string>("");
  const [requestError, setRequestError] = useState<string>("");
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowDate(manilaDate());
      setNowTime(manilaTime());
      const remaining = punchLockUntil - Date.now();
      setLockCountdown(Math.max(0, Math.ceil(remaining / 1000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [punchLockUntil]);

  const activeLog = useMemo(() => logs.find((log) => log.clock_out === null) ?? null, [logs]);

  const payPeriodLogs = useMemo(() => {
    return [...logs].sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);

  const dailyCalendarRows = useMemo(() => {
    const rowsByDate = new Map<
      string,
      {
        date: string;
        totalHours: number;
        pendingCount: number;
        firstClockIn: string | null;
        lastClockOut: string | null;
      }
    >();

    payPeriodLogs.forEach((log) => {
      const row = rowsByDate.get(log.date) ?? {
        date: log.date,
        totalHours: 0,
        pendingCount: 0,
        firstClockIn: null,
        lastClockOut: null
      };

      if (log.total_hours !== null && log.clock_out !== null) {
        row.totalHours += log.total_hours;
      }

      if (log.clock_out === null) {
        row.pendingCount += 1;
      }

      if (row.firstClockIn === null || log.clock_in < row.firstClockIn) {
        row.firstClockIn = log.clock_in;
      }

      if (log.clock_out && (row.lastClockOut === null || log.clock_out > row.lastClockOut)) {
        row.lastClockOut = log.clock_out;
      }

      rowsByDate.set(log.date, row);
    });

    return Array.from(rowsByDate.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((row) => ({
        ...row,
        totalHours: toMoney(row.totalHours)
      }));
  }, [payPeriodLogs]);

  const historyCalendar = useMemo(() => {
    const hoursByDate = new Map(dailyCalendarRows.map((row) => [row.date, row]));
    const anchorDate = payPeriodLogs[0]?.date ?? manilaDate();
    const [yearText, monthText] = anchorDate.split("-");
    const year = Number(yearText);
    const month = Number(monthText);

    const totalDays = new Date(year, month, 0).getDate();
    const firstDayWeekIndex = new Date(`${yearText}-${monthText}-01T12:00:00Z`).getUTCDay();
    const cells: Array<{ date: string; day: number; totalHours: number; pendingCount: number } | null> = [];

    for (let i = 0; i < firstDayWeekIndex; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const isoDate = `${yearText}-${monthText}-${String(day).padStart(2, "0")}`;
      const summary = hoursByDate.get(isoDate);
      cells.push({
        date: isoDate,
        day,
        totalHours: summary?.totalHours ?? 0,
        pendingCount: summary?.pendingCount ?? 0
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const weeks: Array<Array<{ date: string; day: number; totalHours: number; pendingCount: number } | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const monthLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      month: "long",
      year: "numeric"
    }).format(new Date(`${yearText}-${monthText}-01T12:00:00Z`));

    return { weeks, monthLabel };
  }, [dailyCalendarRows, payPeriodLogs]);

  const todayIso = useMemo(() => manilaDate(), []);

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

  const estimatedComp = useMemo(() => {
    const hourlyRate = user.custom_hourly_rate ?? organization.settings.default_hourly_rate;
    return toMoney(approvedHours * hourlyRate);
  }, [approvedHours, user.custom_hourly_rate, organization.settings.default_hourly_rate]);

  const latestRequestsByDate = useMemo(() => {
    const map = new Map<string, CorrectionRequest>();
    correctionRequests.forEach((request) => {
      const existing = map.get(request.target_date);
      if (!existing || request.created_at > existing.created_at) {
        map.set(request.target_date, request);
      }
    });
    return map;
  }, [correctionRequests]);

  const timelineLogs = useMemo(() => [...logs].sort((a, b) => b.date.localeCompare(a.date)), [logs]);

  const canPunch = lockCountdown <= 0;

  const handlePunch = async () => {
    setPunchError("");
    if (!canPunch) {
      return;
    }

    setPunchLockUntil(Date.now() + 180_000);
    const result = await onPunch();
    if (!result.ok) {
      setPunchError(result.error ?? "Unable to process punch action.");
    }
  };

  const openCorrectionForm = (log: AttendanceLog) => {
    setActiveTab("dispute");
    setRequestDate(log.date);
    setRequestClockIn(log.clock_in);
    setRequestClockOut(log.clock_out ?? log.clock_in);
    setRequestNote("");
    setRequestError("");
    setRequestMessage("");
    setShowRequestModal(true);
  };

  const submitCorrection = async () => {
    setRequestError("");
    setRequestMessage("");

    if (!requestDate) {
      setRequestError("Select a date from your shift timeline first.");
      return;
    }

    if (requestNote.trim().length < 5) {
      setRequestError("Please add a short note describing what needs correction.");
      return;
    }

    const result = await onSubmitCorrectionRequest({
      target_date: requestDate,
      requested_clock_in: requestClockIn,
      requested_clock_out: requestClockOut,
      employee_note: requestNote.trim()
    });

    if (!result.ok) {
      setRequestError(result.error ?? "Unable to submit correction request.");
      return;
    }

    setRequestMessage("Correction request submitted for review.");
    setRequestNote("");
    setShowRequestModal(false);
  };

  return (
    <div className="min-h-full bg-slate-950 p-4 text-slate-100">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-black uppercase text-white">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">Console</p>
            <h2 className="text-sm font-black text-white">{user.name}</h2>
          </div>
        </div>
        <button onClick={onLogout} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">
          Logout
        </button>
      </header>

      <div className="mb-4 grid grid-cols-3 border-b border-slate-800 bg-slate-900/40 text-center text-[10px] font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("clock")}
          className={`py-3 ${
            activeTab === "clock" ? "border-b-2 border-indigo-500 bg-indigo-500/5 text-indigo-400" : "text-slate-400"
          }`}
        >
          Clock
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`py-3 ${
            activeTab === "history" ? "border-b-2 border-indigo-500 bg-indigo-500/5 text-indigo-400" : "text-slate-400"
          }`}
        >
          History
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("dispute")}
          className={`py-3 ${
            activeTab === "dispute" ? "border-b-2 border-indigo-500 bg-indigo-500/5 text-indigo-400" : "text-slate-400"
          }`}
        >
          Dispute Day
        </button>
      </div>

      {activeTab === "clock" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-indigo-900/40 bg-gradient-to-br from-indigo-950/60 to-slate-900 p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-indigo-400">Est. Accrued Comp</p>
            <p className="mt-1 text-3xl font-black text-slate-100">
              {organization.settings.currency === "PHP" ? "P" : "$"}{formatFixed(estimatedComp)}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">Based on {formatFixed(approvedHours)} hrs</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
            <button
              onClick={() => void handlePunch()}
              disabled={!canPunch}
              className={`h-32 w-32 rounded-full border-4 text-sm font-semibold text-white shadow-xl transition active:scale-95 ${
                !canPunch
                  ? "cursor-not-allowed border-slate-700 bg-slate-950 text-slate-500"
                  : activeLog
                    ? "border-rose-500 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    : "border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              }`}
              aria-label={activeLog ? "Clock Out" : "Clock In"}
            >
              {!canPunch ? (
                <span className="text-xs font-black uppercase">Wait {lockCountdown}s</span>
              ) : activeLog ? (
                <span className="text-2xl">■</span>
              ) : (
                <span className="text-2xl">▶</span>
              )}
            </button>
            <p className="mt-3 text-xs text-slate-500">
              {activeLog ? `Shift started at ${formatTimeAmPm(activeLog.clock_in)}` : "One tap starts your shift"}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Normal Shift: {formatTimeAmPm(organization.settings.shift_start)} - {formatTimeAmPm(organization.settings.shift_end)}
            </p>
            {!canPunch && <p className="mt-1 text-xs font-medium text-amber-400">Punch cool-down active for 180 seconds.</p>}
            {punchError && <p className="mt-1 text-xs font-medium text-rose-400">{punchError}</p>}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-[10px] text-slate-400">
            <p className="flex items-start gap-2">
              <span className="text-indigo-400">i</span>
              A strict 3-minute cool-down buffer is enforced on successive punches to prevent accidental double taps.
            </p>
          </div>


        </section>
      )}

      {activeTab === "history" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Daily Hours Calendar</h3>
            <span className="text-xs font-medium text-slate-500">{historyCalendar.monthLabel}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] border-collapse text-xs sm:min-w-[560px]">
              <thead>
                <tr className="text-slate-500">
                  {[
                    "S",
                    "M",
                    "T",
                    "W",
                    "T",
                    "F",
                    "S"
                  ].map((dayName, dayIndex) => (
                      <th key={`${dayName}-${dayIndex}`} className="border border-slate-800 px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide sm:text-xs">
                      {dayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyCalendar.weeks.map((week, index) => (
                  <tr key={`week-${index}`}>
                    {week.map((cell, cellIndex) => (
                      <td key={`cell-${index}-${cellIndex}`} className="h-12 border border-slate-800 align-top sm:h-14">
                        {cell ? (
                          <div
                            className={`flex h-full flex-col justify-between px-1 py-1 ${
                              cell.totalHours === 0 ? "bg-slate-950 text-slate-500" : "text-slate-100"
                            } ${cell.date === todayIso ? "bg-indigo-600 text-white" : ""}`}
                          >
                            <p className={`text-[10px] font-semibold sm:text-xs ${cell.date === todayIso ? "text-white" : ""}`}>{cell.day}</p>
                            <p
                              className={`text-sm font-medium leading-none sm:text-base ${cell.date === todayIso ? "text-white" : ""}`}
                              title={formatCalendarDate(cell.date)}
                            >
                              {formatFixed(cell.totalHours)}
                            </p>
                            {cell.pendingCount > 0 && (
                              <p className={`text-[10px] ${cell.date === todayIso ? "text-amber-200" : "text-amber-700"}`}>
                                P:{cell.pendingCount}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="h-full bg-slate-950" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dailyCalendarRows.length === 0 && <p className="mt-3 text-xs text-slate-500">No logs for this pay period.</p>}

          <div className="mt-4 border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Shift History Timeline</h4>
            <div className="mt-2 space-y-2">
              {timelineLogs.map((log) => {
                const latestRequest = latestRequestsByDate.get(log.date);
                return (
                  <div key={log.log_id} className="rounded-md border border-slate-800 bg-slate-950 p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-100">{formatCalendarDate(log.date)}</p>
                        <p className="text-slate-400">
                          {formatTimeAmPm(log.clock_in)} - {log.clock_out ? formatTimeAmPm(log.clock_out) : "Open Shift"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCorrectionForm(log)}
                        className="text-[11px] font-semibold text-indigo-400 underline"
                      >
                        Dispute/Correct This Day
                      </button>
                    </div>
                    {latestRequest && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Latest request: <span className="font-semibold uppercase">{latestRequest.status}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {showRequestModal ? (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
                <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">Correction Request</h4>
                    <button type="button" onClick={() => setShowRequestModal(false)} className="text-xs font-semibold text-slate-500">
                      Cancel
                    </button>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <label className="flex flex-col gap-1">
                      Target Date
                      <input type="date" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        Requested Clock-In
                        <input type="time" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" value={requestClockIn} onChange={(event) => setRequestClockIn(event.target.value)} />
                      </label>
                      <label className="flex flex-col gap-1">
                        Requested Clock-Out
                        <input type="time" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" value={requestClockOut} onChange={(event) => setRequestClockOut(event.target.value)} />
                      </label>
                    </div>

                    <label className="flex flex-col gap-1">
                      Notes
                      <textarea
                        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
                        placeholder="Describe what happened"
                        value={requestNote}
                        onChange={(event) => setRequestNote(event.target.value)}
                      />
                    </label>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => void submitCorrection()} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
                        Submit
                      </button>
                      <button type="button" onClick={() => setShowRequestModal(false)} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">
                        Cancel
                      </button>
                    </div>

                    {requestError && <p className="mt-2 text-rose-400">{requestError}</p>}
                    {requestMessage && <p className="mt-2 text-emerald-700">{requestMessage}</p>}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {activeTab === "dispute" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-white">Submit Time Correction</h3>
          <p className="mt-1 text-xs text-slate-500">Use this form to request employer correction for a missed or incorrect punch.</p>

          <div className="mt-3 space-y-2 text-xs">
            <label className="flex flex-col gap-1 text-slate-400">
              Target Date
              <input type="date" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-slate-400">
                Requested Clock-In
                <input type="time" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" value={requestClockIn} onChange={(event) => setRequestClockIn(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-slate-400">
                Requested Clock-Out
                <input type="time" className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" value={requestClockOut} onChange={(event) => setRequestClockOut(event.target.value)} />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-slate-400">
              Notes
              <textarea
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
                placeholder="Describe what happened"
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
              />
            </label>

            <button type="button" onClick={() => void submitCorrection()} className="w-full rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
              Submit Correction Request
            </button>

            {requestError && <p className="mt-2 text-rose-400">{requestError}</p>}
            {requestMessage && <p className="mt-2 text-emerald-400">{requestMessage}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
