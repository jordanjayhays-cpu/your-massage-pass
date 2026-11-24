import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysIso, isTooSoon, madridDays, madridNow, madridTodayIso } from "../madridTime";

describe("madridTime at Mon 2 Nov 2026, 15:39 UTC (16:39 in Madrid)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T15:39:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("knows the Madrid date and clock", () => {
    expect(madridTodayIso()).toBe("2026-11-02");
    const now = madridNow();
    expect([now.getHours(), now.getMinutes()]).toEqual([16, 39]);
  });

  it("17:00 today is too soon (needs an hour's notice)", () => {
    expect(isTooSoon("2026-11-02", "17:00")).toBe(true);
  });

  it("18:00 today is fine", () => {
    expect(isTooSoon("2026-11-02", "18:00")).toBe(false);
  });

  it("10:00 tomorrow is fine", () => {
    expect(isTooSoon("2026-11-03", "10:00")).toBe(false);
  });

  it("anything earlier today, or on a past day, is too soon", () => {
    expect(isTooSoon("2026-11-02", "10:00")).toBe(true);
    expect(isTooSoon("2026-11-01", "20:00")).toBe(true);
  });

  it("accepts HH:MM:SS from the database", () => {
    expect(isTooSoon("2026-11-02", "17:30:00")).toBe(true);
    expect(isTooSoon("2026-11-02", "17:39:00")).toBe(false);
  });

  it("lists days from Madrid today", () => {
    expect(madridDays(3)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
  });
});

describe("madridTime near midnight and across the DST change", () => {
  afterEach(() => vi.useRealTimers());

  it("23:30 UTC on 2 Nov is already 3 Nov in Madrid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T23:30:00Z"));
    expect(madridTodayIso()).toBe("2026-11-03");
    expect(isTooSoon("2026-11-03", "10:00")).toBe(false);
  });

  it("uses UTC+2 before 25 Oct 2026 and UTC+1 after it", () => {
    vi.useFakeTimers();
    // Sat 24 Oct, summer time: 15:39 UTC is 17:39 in Madrid.
    vi.setSystemTime(new Date("2026-10-24T15:39:00Z"));
    expect(isTooSoon("2026-10-24", "18:00")).toBe(true);
    expect(isTooSoon("2026-10-24", "19:00")).toBe(false);
    // Sun 25 Oct, the clocks went back at 03:00: 15:39 UTC is 16:39 in Madrid.
    vi.setSystemTime(new Date("2026-10-25T15:39:00Z"));
    expect(isTooSoon("2026-10-25", "17:00")).toBe(true);
    expect(isTooSoon("2026-10-25", "18:00")).toBe(false);
  });

  it("adds days across month ends and the DST change", () => {
    expect(addDaysIso("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDaysIso("2026-10-31", 1)).toBe("2026-11-01");
  });
});
