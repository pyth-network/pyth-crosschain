// Parser for the Pyth `schedule` field, format: "Timezone;WeeklySchedule;Holidays".
// Grammar reference: /price-feeds/core/pythnet-reference/schedule-format
//
// Targets the current (semicolon-delimited, HHMM) grammar only. The deprecated
// comma-delimited `weekly_schedule` grammar is intentionally rejected (it has no
// `;`), so callers fall back to rendering the raw string.

export type TimeRange = { open: string; close: string };

export type DaySchedule =
  | { kind: "open" }
  | { kind: "closed" }
  | { kind: "ranges"; ranges: TimeRange[] };

export type Holiday = {
  monthDay: string;
  label: string;
  schedule: DaySchedule;
};

export type ParsedSchedule = {
  timezone: string;
  /** Seven entries, Monday through Sunday. */
  week: DaySchedule[];
  holidays: Holiday[];
};

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatTime = (hhmm: string): string => {
  if (!/^\d{4}$/.test(hhmm)) {
    throw new Error(`invalid time: ${hhmm}`);
  }
  const hours = Number(hhmm.slice(0, 2));
  const minutes = Number(hhmm.slice(2));
  // Hours run 00-24; 24 is only valid as 2400 (end of day), never 24xx.
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) {
    throw new Error(`invalid time: ${hhmm}`);
  }
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
};

const parseDaySchedule = (token: string): DaySchedule => {
  if (token === "O") {
    return { kind: "open" };
  }
  if (token === "C") {
    return { kind: "closed" };
  }
  const ranges = token.split("&").map((segment) => {
    const [open, close, extra] = segment.split("-");
    if (open === undefined || close === undefined || extra !== undefined) {
      throw new Error(`invalid range: ${segment}`);
    }
    return { close: formatTime(close), open: formatTime(open) };
  });
  return { kind: "ranges", ranges };
};

const formatMonthDay = (monthDay: string): string => {
  const month = Number(monthDay.slice(0, 2));
  const day = Number(monthDay.slice(2));
  const name = MONTHS[month - 1];
  return name === undefined ? monthDay : `${name} ${String(day)}`;
};

/**
 * Parse a Pyth `schedule` string. Returns `null` on any malformed input so
 * callers can fall back to rendering the raw string verbatim rather than a
 * half-parsed (and possibly wrong) result.
 */
export const parseSchedule = (input: string): ParsedSchedule | null => {
  try {
    const segments = input.split(";");
    // Exactly: Timezone ; WeeklySchedule ; Holidays (holidays may be empty).
    if (segments.length !== 3) {
      return null;
    }
    const [timezone, weekly, holidaysRaw] = segments;
    if (
      timezone === undefined ||
      weekly === undefined ||
      holidaysRaw === undefined ||
      timezone.length === 0 ||
      weekly.length === 0
    ) {
      return null;
    }
    const dayTokens = weekly.split(",");
    if (dayTokens.length !== 7) {
      return null;
    }
    const week = dayTokens.map((token) => parseDaySchedule(token));

    const holidays: Holiday[] = [];
    const holidayText = holidaysRaw.trim();
    if (holidayText.length > 0) {
      for (const entry of holidayText.split(",")) {
        const slash = entry.indexOf("/");
        if (slash === -1) {
          return null;
        }
        const monthDay = entry.slice(0, slash);
        if (!/^\d{4}$/.test(monthDay)) {
          return null;
        }
        const month = Number(monthDay.slice(0, 2));
        const day = Number(monthDay.slice(2));
        if (month < 1 || month > 12 || day < 1 || day > 31) {
          return null;
        }
        holidays.push({
          label: formatMonthDay(monthDay),
          monthDay,
          schedule: parseDaySchedule(entry.slice(slash + 1)),
        });
      }
    }

    return { holidays, timezone, week };
  } catch {
    return null;
  }
};

/** Human-readable one-line summary of a single day's schedule. */
export const describeDay = (day: DaySchedule): string => {
  switch (day.kind) {
    case "open": {
      return "Open 24h";
    }
    case "closed": {
      return "Closed";
    }
    case "ranges": {
      return day.ranges.map((r) => `${r.open} to ${r.close}`).join(", ");
    }
  }
};
