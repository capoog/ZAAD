import { getOpenStatus, toCairoWallClock, type OpeningHoursRow } from "./hours";

export interface ScheduleDay {
  key: string; // yyyy-mm-dd (Cairo)
  date: Date; // first slot of the day
  slots: Date[];
}

const SLOT_MIN = 15;

/** Bookable 15-minute slots inside opening hours, after the lead time, within the window. */
export function scheduleSlots(now: Date, hours: OpeningHoursRow[], leadMinutes: number, maxDays: number): ScheduleDay[] {
  const start = Math.ceil((now.getTime() + leadMinutes * 60_000) / (SLOT_MIN * 60_000)) * SLOT_MIN * 60_000;
  const end = now.getTime() + Math.max(1, maxDays) * 86_400_000;
  const days = new Map<string, ScheduleDay>();
  for (let t = start; t <= end; t += SLOT_MIN * 60_000) {
    const d = new Date(t);
    // A slot is valid if the restaurant is open then and still open 15 min later.
    if (!getOpenStatus(d, hours).isOpen) continue;
    const w = toCairoWallClock(d);
    const key = `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
    let day = days.get(key);
    if (!day) {
      day = { key, date: d, slots: [] };
      days.set(key, day);
    }
    day.slots.push(d);
  }
  return [...days.values()];
}
