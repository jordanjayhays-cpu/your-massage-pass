/**
 * Studios the visitor already opened this session.
 * Used to dim their map pins so the eye goes to what is still unexplored.
 */
const SS_KEY = "mc_visited_studios";
const EVT = "mc-visited-change";

export function visitedStudios(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markStudioVisited(...keys: (string | null | undefined)[]) {
  const clean = keys.map((k) => (k || "").toString().trim()).filter(Boolean);
  if (clean.length === 0) return;
  const set = visitedStudios();
  clean.forEach((k) => set.add(k));
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

export function isStudioVisited(...keys: (string | null | undefined)[]): boolean {
  const set = visitedStudios();
  return keys.some((k) => k && set.has(String(k)));
}
