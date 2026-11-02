import { describe, expect, it } from "vitest";
import { hoursOn } from "../openingHours";

// 0 = Sunday ... 6 = Saturday
const SUN = 0, MON = 1, FRI = 5, SAT = 6;

describe("hoursOn: every format studios wrote on 2 Nov 2026", () => {
  it("Daily and Todos los días", () => {
    expect(hoursOn("Daily 10:00-22:00", SUN)).toEqual({ open: true, from: "10:00", to: "22:00" });
    expect(hoursOn("Todos los días 12:00-20:00", MON)).toEqual({ open: true, from: "12:00", to: "20:00" });
  });

  it("a day range, closed outside it", () => {
    expect(hoursOn("Mon-Sat 10:00-20:00", SAT)).toEqual({ open: true, from: "10:00", to: "20:00" });
    expect(hoursOn("Mon-Sat 10:00-20:00", SUN)).toEqual({ open: false });
    expect(hoursOn("Mon-Sun 10:00-21:00", SUN)).toEqual({ open: true, from: "10:00", to: "21:00" });
  });

  it("two parts, and a range that wraps past Saturday", () => {
    const t = "Sun-Thu 10:00-21:30, Fri-Sat 10:00-22:00";
    expect(hoursOn(t, SUN)).toEqual({ open: true, from: "10:00", to: "21:30" });
    expect(hoursOn(t, FRI)).toEqual({ open: true, from: "10:00", to: "22:00" });
    expect(hoursOn("Mon-Fri 9:00-20:00, Sat 9:00-14:00", SAT)).toEqual({ open: true, from: "9:00", to: "14:00" });
  });

  it("Spanish day names with accents (Calma, Sinergia38)", () => {
    const calma = "Lun-Vie 10:00-20:00, Sáb 10:00-14:00";
    expect(hoursOn(calma, MON)).toEqual({ open: true, from: "10:00", to: "20:00" });
    expect(hoursOn(calma, SAT)).toEqual({ open: true, from: "10:00", to: "14:00" });
    expect(hoursOn(calma, SUN)).toEqual({ open: false });
    expect(hoursOn("Lun a Vie 10:00 a 21:00", FRI)).toEqual({ open: true, from: "10:00", to: "21:00" });
  });

  it("returns null instead of guessing", () => {
    expect(hoursOn(null, MON)).toBeNull();
    expect(hoursOn("", MON)).toBeNull();
    expect(hoursOn("Call us", MON)).toBeNull();
    // One unreadable part: never claim "closed" from the rest.
    expect(hoursOn("Mon-Fri 10:00-20:00, weekends by appointment", SUN)).toBeNull();
    expect(hoursOn("Mon-Fri 25:00-20:00", MON)).toBeNull();
  });
});
