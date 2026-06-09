export const formatMoney = (value: number, currency: string): string => {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export const formatFixed = (value: number): string => {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export const formatTimeAmPm = (hhmm: string): string => {
  const [hourText, minuteText] = hhmm.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return hhmm;
  }

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
};

export const formatCalendarDate = (isoDate: string): string => {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
    weekday: "short"
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";

  return `${lookup("month")}-${lookup("day")}, ${lookup("year")}, ${lookup("weekday")}`;
};

export const formatDateTimeAmPm = (isoTs: string): string => {
  try {
    const date = new Date(isoTs);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).formatToParts(date);

    const lookup = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";
    const time = `${lookup("hour").padStart(2, "0")}:${lookup("minute").padStart(2, "0")} ${lookup("dayPeriod")}`;
    return `${lookup("month")}-${lookup("day")}, ${lookup("year")}, ${lookup("weekday")} ${time}`;
  } catch {
    return isoTs;
  }
};

export const formatShortDate = (isoDate: string): string => {
  // expects YYYY-MM-DD and returns MM/DD
  try {
    const parts = isoDate.split("-");
    if (parts.length < 3) return isoDate;
    const month = parts[1];
    const day = parts[2];
    return `${month}/${day}`;
  } catch {
    return isoDate;
  }
};
