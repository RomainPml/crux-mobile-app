const DEFAULT_TZ = "Europe/Paris";

/** Returns the current month key (YYYY-MM) for the given date in the given timezone. */
export function currentMonth(
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

/** Returns today's date as YYYY-MM-DD in the given timezone. */
export function todayDate(
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/** Returns array of YYYY-MM-DD strings from month start to yesterday. */
export function missedDaysThisMonth(
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): string[] {
  const today = todayDate(now, tz);
  const month = currentMonth(now, tz);
  const [year, mon] = month.split("-").map(Number);
  const days: string[] = [];
  for (let d = 1; d <= 31; d++) {
    const dayStr = `${year}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dayStr >= today) break;
    // Validate it's a real date
    const parsed = new Date(dayStr);
    if (parsed.getMonth() + 1 !== mon) break;
    days.push(dayStr);
  }
  return days;
}
