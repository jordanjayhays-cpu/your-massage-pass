/**
 * Studio compare selection.
 *
 * Selection is a short list of studio keys (slug, falling back to partner id),
 * capped at 3 and kept in sessionStorage so it survives navigation inside the
 * session without leaking into the next one.
 */
import { useEffect, useState } from "react";

export const COMPARE_MAX = 3;
const SS_KEY = "mc_compare";
const EVT = "mc-compare-change";

export type CompareEntry = { key: string; name: string };

type StudioLike = {
  slug?: string | null;
  partner_id?: string | null;
  id?: string | null;
  studio?: string | null;
  name?: string | null;
};

/** Canonical key for a studio: its slug, else the partner id. */
export function compareKey(s: StudioLike | null | undefined): string {
  if (!s) return "";
  return ((s.slug || "").trim() || s.partner_id || s.id || "").toString();
}

export function compareName(s: StudioLike | null | undefined): string {
  return (s?.studio || s?.name || "Studio").toString();
}

export function loadCompare(): CompareEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.key === "string" && e.key)
      .slice(0, COMPARE_MAX)
      .map((e) => ({ key: String(e.key), name: String(e.name || "Studio") }));
  } catch {
    return [];
  }
}

export function saveCompare(list: CompareEntry[]) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(list.slice(0, COMPARE_MAX)));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

export function clearCompare() {
  saveCompare([]);
}

export function setCompareEntries(entries: CompareEntry[]) {
  saveCompare(entries);
}

/** Adds or removes a studio. Silently ignores adds beyond the cap. */
export function toggleCompare(studio: StudioLike): CompareEntry[] {
  const key = compareKey(studio);
  if (!key) return loadCompare();
  const current = loadCompare();
  const exists = current.some((e) => e.key === key);
  const next = exists
    ? current.filter((e) => e.key !== key)
    : current.length >= COMPARE_MAX
    ? current
    : [...current, { key, name: compareName(studio) }];
  saveCompare(next);
  return next;
}

export function removeCompare(key: string): CompareEntry[] {
  const next = loadCompare().filter((e) => e.key !== key);
  saveCompare(next);
  return next;
}

/** Live view of the current selection. */
export function useCompare() {
  const [items, setItems] = useState<CompareEntry[]>(() => loadCompare());

  useEffect(() => {
    const sync = () => setItems(loadCompare());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    items,
    keys: items.map((i) => i.key),
    has: (s: StudioLike) => items.some((e) => e.key === compareKey(s)),
    isFull: items.length >= COMPARE_MAX,
    toggle: (s: StudioLike) => setItems(toggleCompare(s)),
    remove: (key: string) => setItems(removeCompare(key)),
    clear: () => {
      clearCompare();
      setItems([]);
    },
  };
}

/** /compare?s=slug-a,slug-b */
export function comparePath(keys: string[]): string {
  return `/compare?s=${keys.filter(Boolean).map(encodeURIComponent).join(",")}`;
}

export function parseCompareParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => decodeURIComponent(v.trim()))
    .filter(Boolean)
    .slice(0, COMPARE_MAX);
}

// ─── Quiz handoff ────────────────────────────────────────────────────────────

const SS_QUIZ_TYPE = "mc_quiz_type";

/** Quiz internal ids → massage type slugs used by the education library. */
const QUIZ_TYPE_TO_SLUG: Record<string, string> = {
  swedish: "swedish",
  deep: "deep-tissue",
  stone: "hot-stone",
  sports: "sports",
  thai: "thai",
  lomi: "swedish",
};

export function saveQuizRecommendedType(quizType: string | null | undefined) {
  const slug = QUIZ_TYPE_TO_SLUG[String(quizType || "")] || "";
  if (!slug) return;
  try {
    sessionStorage.setItem(SS_QUIZ_TYPE, slug);
  } catch {
    /* ignore */
  }
}

export function readQuizRecommendedType(): string | null {
  try {
    return sessionStorage.getItem(SS_QUIZ_TYPE);
  } catch {
    return null;
  }
}
