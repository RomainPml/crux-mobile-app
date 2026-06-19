import { describe, it, expect } from "vitest";
import { currentMonth, todayDate } from "../date.js";

describe("currentMonth", () => {
  it("returns YYYY-MM format", () => {
    const result = currentMonth(new Date("2026-03-15T10:00:00Z"), "Europe/Paris");
    expect(result).toBe("2026-03");
  });

  it("respects timezone for month boundaries", () => {
    // March 31 at 23:30 UTC = April 1 at 01:30 Paris (CEST = UTC+2)
    const result = currentMonth(new Date("2026-03-31T23:30:00Z"), "Europe/Paris");
    expect(result).toBe("2026-04");
  });

  it("handles December/January boundary", () => {
    // Dec 31 at 23:30 UTC = Jan 1 at 00:30 Paris (CET = UTC+1)
    const result = currentMonth(new Date("2025-12-31T23:30:00Z"), "Europe/Paris");
    expect(result).toBe("2026-01");
  });

  it("works with UTC timezone", () => {
    const result = currentMonth(new Date("2026-06-15T12:00:00Z"), "UTC");
    expect(result).toBe("2026-06");
  });

  it("defaults to Europe/Paris", () => {
    const result = currentMonth(new Date("2026-06-15T12:00:00Z"));
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("todayDate", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = todayDate(new Date("2026-07-04T15:00:00Z"), "Europe/Paris");
    expect(result).toBe("2026-07-04");
  });

  it("respects timezone for day boundaries", () => {
    // July 3 at 23:30 UTC = July 4 at 01:30 Paris (CEST = UTC+2)
    const result = todayDate(new Date("2026-07-03T23:30:00Z"), "Europe/Paris");
    expect(result).toBe("2026-07-04");
  });

  it("stays same day in UTC", () => {
    const result = todayDate(new Date("2026-07-03T23:30:00Z"), "UTC");
    expect(result).toBe("2026-07-03");
  });
});
