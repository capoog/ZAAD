/**
 * Opening-hours logic in the restaurant's time zone (Africa/Cairo, which
 * observes DST again since 2023 — so never hard-code +02:00).
 * Shifts may cross midnight: 12:00 → 02:00 means "until 2 AM the next day".
 */
export const RESTAURANT_TZ = "Africa/Cairo";

export interface OpeningHoursRow {
  dayOfWeek: number; // 0 = Sunday
  opensAt: string; // "HH:MM" or "HH:MM:SS"
  closesAt: string;
  isClosed: boolean;
}

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: RESTAURANT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toCairoWallClock(date: Date): WallClock {
  const p: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    dayOfWeek: WEEKDAYS.indexOf(p.weekday ?? "Sun"),
  };
}

/** Offset (ms) of Cairo from UTC at a given instant. */
function cairoOffsetMs(instant: Date): number {
  const w = toCairoWallClock(instant);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, instant.getUTCSeconds());
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Convert a Cairo wall-clock time to an absolute Date. */
export function fromCairoWallClock(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(guess - cairoOffsetMs(new Date(guess)));
  // Second pass settles DST edges.
  instant = new Date(guess - cairoOffsetMs(instant));
  return instant;
}

export function parseTime(t: string): number {
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function addDays(w: { year: number; month: number; day: number }, n: number) {
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), dayOfWeek: d.getUTCDay() };
}

interface Shift {
  start: Date;
  end: Date;
}

/** Shifts that start on the given Cairo calendar day (by offset from `date`). */
function shiftForDay(date: Date, dayOffset: number, rows: OpeningHoursRow[]): Shift | null {
  const today = toCairoWallClock(date);
  const d = addDays(today, dayOffset);
  const row = rows.find((r) => r.dayOfWeek === d.dayOfWeek);
  if (!row || row.isClosed) return null;
  const open = parseTime(row.opensAt);
  const close = parseTime(row.closesAt);
  const start = fromCairoWallClock(d.year, d.month, d.day, Math.floor(open / 60), open % 60);
  const endDay = close <= open ? addDays(d, 1) : d;
  const end = fromCairoWallClock(endDay.year, endDay.month, endDay.day, Math.floor(close / 60), close % 60);
  return { start, end };
}

export interface OpenStatus {
  isOpen: boolean;
  /** When open: when the current shift ends. */
  closesAt: Date | null;
  /** When closed: the next time we open (within a week). */
  opensAt: Date | null;
}

export function getOpenStatus(date: Date, rows: OpeningHoursRow[]): OpenStatus {
  for (const offset of [-1, 0]) {
    const s = shiftForDay(date, offset, rows);
    if (s && date >= s.start && date < s.end) return { isOpen: true, closesAt: s.end, opensAt: null };
  }
  for (let offset = 0; offset <= 7; offset++) {
    const s = shiftForDay(date, offset, rows);
    if (s && s.start > date) return { isOpen: false, closesAt: null, opensAt: s.start };
  }
  return { isOpen: false, closesAt: null, opensAt: null };
}

export function isOpenAt(date: Date, rows: OpeningHoursRow[]): boolean {
  return getOpenStatus(date, rows).isOpen;
}

/** "12:00" → "12:00 م" / "12:00 PM" */
export function formatClock(date: Date, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
    timeZone: RESTAURANT_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
