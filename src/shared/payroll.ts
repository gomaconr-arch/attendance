import { AttendanceFlag, AttendanceLog, OrganizationSettings, PayrollMode, User } from "./types";
import { dayNameFromIsoDate, toMinutes } from "./timezone";

const MONTHLY_HOURS_BASE = 160;

export const toMoney = (value: number): number => Number(value.toFixed(2));

export const hoursDiff = (clockIn: string, clockOut: string): number => {
  const [inHour, inMinute] = clockIn.split(":").map(Number);
  const [outHour, outMinute] = clockOut.split(":").map(Number);

  let minutes = outHour * 60 + outMinute - (inHour * 60 + inMinute);
  if (minutes < 0) {
    minutes += 24 * 60;
  }

  return toMoney(minutes / 60);
};

export const effectiveHourlyRate = (user: User): number => {
  if (user.role !== "Employee" || typeof user.rate !== "number") {
    return 0;
  }

  if (user.compensation_type === "monthly") {
    return toMoney(user.rate / MONTHLY_HOURS_BASE);
  }

  return toMoney(user.rate);
};

export const dailyShiftDuration = (settings: OrganizationSettings): number => {
  return hoursDiff(settings.shift_start, settings.shift_end);
};

export const validWorkdaysInMonth = (monthKey: string, settings: OrganizationSettings): number => {
  const [year, month] = monthKey.split("-").map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  let count = 0;

  for (let day = 1; day <= totalDays; day += 1) {
    const isoDate = `${monthKey}-${String(day).padStart(2, "0")}`;
    const dayName = dayNameFromIsoDate(isoDate);
    if (settings.work_days.includes(dayName)) {
      count += 1;
    }
  }

  return count;
};

export const monthlyExpectedHours = (monthKey: string, settings: OrganizationSettings): number => {
  return toMoney(validWorkdaysInMonth(monthKey, settings) * dailyShiftDuration(settings));
};

export const effectiveRates = (employee: User, settings: OrganizationSettings) => {
  const hourly = employee.custom_hourly_rate ?? settings.default_hourly_rate;
  const monthly = employee.custom_monthly_rate ?? settings.default_monthly_rate;
  return {
    hourly: toMoney(hourly),
    monthly: toMoney(monthly)
  };
};

export const payoutForMode = (
  mode: PayrollMode,
  employee: User,
  approvedHours: number,
  monthKey: string,
  settings: OrganizationSettings
): number => {
  const rates = effectiveRates(employee, settings);

  if (mode === "hourly") {
    return toMoney(approvedHours * rates.hourly);
  }

  const expectedHours = monthlyExpectedHours(monthKey, settings);
  const factor = expectedHours > 0 ? rates.monthly / expectedHours : 0;
  return toMoney(approvedHours * factor);
};

export const isClosedLog = (log: AttendanceLog): boolean => log.clock_out !== null && log.total_hours !== null;

export const sumApprovedHours = (logs: AttendanceLog[]): number => {
  const approved = logs
    .filter(isClosedLog)
    .reduce((acc, log) => acc + (log.total_hours ?? 0), 0);

  return toMoney(approved);
};

export const payrollForPeriod = (user: User, logs: AttendanceLog[]): number => {
  const hours = sumApprovedHours(logs);
  return toMoney(hours * effectiveHourlyRate(user));
};

export const isWithinRange = (date: string, start: string, end: string): boolean => {
  return date >= start && date <= end;
};

export const outsideShiftFlag = (flags: AttendanceFlag[]): AttendanceFlag[] => {
  if (flags.includes("Outside Shift Hours")) {
    return flags;
  }
  return [...flags, "Outside Shift Hours"];
};

export const hoursForPayroll = (totalHours: number, maxHours: number, overrideCap: boolean): number => {
  if (overrideCap) {
    return totalHours;
  }
  return Math.min(totalHours, maxHours);
};

export const monthFromDate = (isoDate: string): string => isoDate.slice(0, 7);

export const timeOutsideShift = (time: string, settings: OrganizationSettings): boolean => {
  const t = toMinutes(time);
  const start = toMinutes(settings.shift_start);
  const end = toMinutes(settings.shift_end);

  if (start <= end) {
    return t < start || t > end;
  }

  return !(t >= start || t <= end);
};
