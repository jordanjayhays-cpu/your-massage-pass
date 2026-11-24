import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Marketing studio count.
 *
 * We never want to overstate how many studios we list, so we take the SAME
 * live count that /studios renders and round it DOWN to the nearest ten.
 * 60 listable studios -> "60+", 58 -> "50+". /studios (fetchShops) lists
 * partners with status active|pending, not opted out, with at least one
 * service; counting status alone said "160+" while the list showed 62.
 *
 * Fallback while loading / on error is a deliberately conservative 50.
 */
const FALLBACK = 50;

export function floorToTen(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return FALLBACK;
  return Math.max(10, Math.floor(n / 10) * 10);
}

export async function fetchStudioCount(): Promise<number | null> {
  const { count, error } = await supabase
    .from("partners")
    // !inner keeps only partners with at least one service, as fetchShops does.
    .select("id, partner_services!inner(id)", { count: "exact", head: true })
    .in("status", ["active", "pending"])
    .is("opted_out_at", null);
  if (error || count == null) return null;
  return count;
}

/** Rounded-down marketing number, e.g. 50 or 60. Safe to render as `{n}+`. */
export function useStudioCount(): number {
  const [n, setN] = useState<number>(FALLBACK);

  useEffect(() => {
    let alive = true;
    fetchStudioCount().then((c) => {
      if (alive && c != null) setN(floorToTen(c));
    });
    return () => {
      alive = false;
    };
  }, []);

  return n;
}
