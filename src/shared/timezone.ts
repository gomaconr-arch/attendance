import { WorkDayName } from "./types";

const MANILA_TZ = "Asia/Manila";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: MANILA_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TZ,
  weekday: "long"
});

export const manilaDate = (date = new Date()): string => DATE_FORMATTER.format(date);

export const manilaTime = (date = new Date()): string => TIME_FORMATTER.format(date);

export const manilaMonthKey = (date = new Date()): string => manilaDate(date).slice(0, 7);

export const dayNameFromIsoDate = (isoDate: string): WorkDayName => {
  const safeDate = new Date(`${isoDate}T12:00:00Z`);
  return DAY_FORMATTER.format(safeDate) as WorkDayName;
};

export const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

export const timeWithinShift = (time: string, shiftStart: string, shiftEnd: string): boolean => {
  const t = toMinutes(time);
  const start = toMinutes(shiftStart);
  const end = toMinutes(shiftEnd);

  if (start <= end) {
    return t >= start && t <= end;
  }

  return t >= start || t <= end;
};
