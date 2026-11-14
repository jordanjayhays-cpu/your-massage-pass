import { describe, expect, it } from "vitest";
import { STOCK_PHOTOS, assignStockSlots, hashId, sizedPhoto, type StockSlotInput } from "../studioImages";

const ids = (n: number, prefix = "s") =>
  Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(4, "0")}-${hashId(prefix + i).toString(16)}`);

const rows = (list: string[], listed: (i: number) => boolean = () => true): StockSlotInput[] =>
  list.map((id, i) => ({ id, createdAt: `2026-0${1 + (i % 9)}-1${i % 10}T10:00:00Z`, listed: listed(i) }));

describe("stock photo pool", () => {
  it("has 129 different https photos from Pexels or Unsplash, 800px wide", () => {
    expect(STOCK_PHOTOS.length).toBe(129);
    expect(new Set(STOCK_PHOTOS).size).toBe(STOCK_PHOTOS.length);
    for (const u of STOCK_PHOTOS) {
      expect(u).toMatch(/^https:\/\/images\.(pexels|unsplash)\.com\//);
      expect(u).toMatch(/[?&]w=800(&|$)/);
    }
  });

  it("resizes on the w parameter only", () => {
    const u = STOCK_PHOTOS[0];
    expect(sizedPhoto(u, 320)).toBe(u.replace("w=800", "w=320"));
    expect(sizedPhoto("https://example.org/a.jpg?w=800", 320)).toBe("https://example.org/a.jpg?w=800");
  });
});

describe("assignStockSlots", () => {
  it("gives every studio a different photo while there are at most 129", () => {
    const slots = assignStockSlots(rows(ids(129)));
    expect(slots.size).toBe(129);
    expect(new Set(slots.values()).size).toBe(129);
  });

  it("does not depend on the order of the input", () => {
    const r = rows(ids(80));
    const a = assignStockSlots(r);
    const b = assignStockSlots([...r].reverse());
    expect([...b.entries()].sort()).toEqual([...a.entries()].sort());
  });

  it("keeps every existing studio's photo when a newer studio is added", () => {
    const r = rows(ids(70));
    const before = assignStockSlots(r);
    const after = assignStockSlots([...r, { id: "brand-new", createdAt: "2026-12-01T00:00:00Z", listed: true }]);
    for (const [id, slot] of before) expect(after.get(id)).toBe(slot);
    expect([...before.values()]).not.toContain(after.get("brand-new"));
  });

  it("past 129 studios, listed studios still never share: the extra unlisted ones reuse unlisted photos", () => {
    // Today's shape: 62 listed, 105 unlisted (167 in all).
    const r = rows(ids(167), (i) => i % 8 < 3);
    const listed = r.filter((x) => x.listed);
    expect(listed.length).toBe(63);
    const slots = assignStockSlots(r);
    expect(slots.size).toBe(167);
    const listedSlots = listed.map((x) => slots.get(x.id)!);
    expect(new Set(listedSlots).size).toBe(listed.length);
    const counts = new Map<number, number>();
    for (const s of slots.values()) counts.set(s, (counts.get(s) ?? 0) + 1);
    for (const s of listedSlots) expect(counts.get(s)).toBe(1);
  });

  it("ignores duplicate ids and empty input", () => {
    expect(assignStockSlots([]).size).toBe(0);
    const slots = assignStockSlots([
      { id: "a", listed: true },
      { id: "a", listed: false },
      { id: "b", listed: true },
    ]);
    expect(slots.size).toBe(2);
    expect(slots.get("a")).not.toBe(slots.get("b"));
  });
});
