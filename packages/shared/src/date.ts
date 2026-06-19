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
