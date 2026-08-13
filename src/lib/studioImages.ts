/**
 * Deterministic studio imagery.
 *
 * Sources are license-free only: verified Unsplash CDN photos (each URL checked
 * to return HTTP 200) plus our own generated brand assets. We never scrape or
 * hotlink Google Places / Maps photos or a studio's own website images.
 *
 * The same studio always resolves to the same photo (hash of its id), so cards
 * and detail pages stay in sync across visits.
 */

import thaiRoom from "@/assets/studios/thai-room.jpg";
import thaiStretch from "@/assets/studios/thai-stretch.jpg";
import spaInteriorAsset from "@/assets/studios/spa-interior.jpg";
import oilMassageAsset from "@/assets/studios/oil-massage.jpg";
import ambienceAsset from "@/assets/studios/ambience-candles.jpg";
import hammamAsset from "@/assets/studios/hammam.jpg";

const U = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

/** An entry is either a local asset URL or an Unsplash photo id. */
type Entry = { asset: string } | { photo: string };

const a = (asset: string): Entry => ({ asset });
const p = (photo: string): Entry => ({ photo });

const resolve = (e: Entry, width: number) =>
  "asset" in e ? e.asset : U(e.photo, width);

export type StudioTheme =
  | "thai"
  | "hammam"
  | "oil"
  | "stone"
  | "facial"
  | "sports"
  | "wellness"
  | "ambience";

/**
 * 28 distinct warm, terracotta/cream-friendly images, grouped by theme.
 * Several themes intentionally overlap so that no theme has a single option.
 */
const THEME_IMAGES: Record<StudioTheme, Entry[]> = {
  thai: [
    a(thaiRoom),
    a(thaiStretch),
    p("photo-1591343395082-e120087004b4"),
    p("photo-1519824145371-296894a0daa9"),
    p("photo-1542848284-8afa78a08ccb"),
    p("photo-1519823551278-64ac92734fb1"),
  ],
  wellness: [
    a(spaInteriorAsset),
    p("photo-1560750588-73207b1ef5b8"),
    p("photo-1515377905703-c4788e51af15"),
    p("photo-1507652313519-d4e9174996dd"),
    p("photo-1590439471364-192aa70c0b53"),
    p("photo-1532926381893-7542290edf1d"),
  ],
  oil: [
    a(oilMassageAsset),
    p("photo-1544161515-4ab6ce6db874"),
    p("photo-1515377905703-c4788e51af15"),
    p("photo-1608571423902-eed4a5ad8108"),
    p("photo-1620733723572-11c53f73a416"),
  ],
  hammam: [
    a(hammamAsset),
    p("photo-1583416750470-965b2707b355"),
    p("photo-1532926381893-7542290edf1d"),
  ],
  stone: [
    p("photo-1600334089648-b0d9d3028eb2"),
    p("photo-1600334129128-685c5582fd35"),
    p("photo-1519823551278-64ac92734fb1"),
  ],
  facial: [
    p("photo-1616394584738-fc6e612e71b9"),
    p("photo-1570172619644-dfd03ed5d881"),
    p("photo-1552693673-1bf958298935"),
    p("photo-1519415387722-a1c3bbef716c"),
    p("photo-1512290923902-8a9f81dc236c"),
  ],
  sports: [
    p("photo-1591343395082-e120087004b4"),
    p("photo-1542848284-8afa78a08ccb"),
    p("photo-1519824145371-296894a0daa9"),
  ],
  ambience: [
    a(ambienceAsset),
    p("photo-1540555700478-4be289fbecef"),
    p("photo-1590439471364-192aa70c0b53"),
    p("photo-1620733723572-11c53f73a416"),
  ],
};

/** Flat, de-duplicated pool used for the no-theme-match rotation + fallbacks. */
const POOL: Entry[] = (() => {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const key of Object.keys(THEME_IMAGES) as StudioTheme[]) {
    for (const e of THEME_IMAGES[key]) {
      const k = "asset" in e ? e.asset : e.photo;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
  }
  return out;
})();

/**
 * Widened candidate list per theme: the theme's own images first, then the
 * rest of the pool. With ~28 images this gives every theme 14 options so
 * lists dominated by one theme (e.g. Thai studios) still look varied.
 */
const THEME_CANDIDATES: Record<StudioTheme, Entry[]> = (() => {
  const out = {} as Record<StudioTheme, Entry[]>;
  for (const key of Object.keys(THEME_IMAGES) as StudioTheme[]) {
    const seen = new Set<string>();
    const list: Entry[] = [];
    for (const e of [...THEME_IMAGES[key], ...POOL]) {
      const k = "asset" in e ? e.asset : e.photo;
      if (seen.has(k)) continue;
      seen.add(k);
      list.push(e);
      if (list.length >= 14) break;
    }
    out[key] = list;
  }
  return out;
})();

const THEME_RULES: { theme: StudioTheme; re: RegExp }[] = [
  { theme: "thai", re: /\b(thai|tailand|bangkok|siam|asia|asi[aá]tic|shiatsu|nuad)\b/i },
  { theme: "hammam", re: /\b(hammam|hamam|[aá]rabe|arab|marroqu|moroc|baños|banos|medina|zoco)\b/i },
  { theme: "stone", re: /\b(stone|piedra|volcan|basalt|hot ?stone)\b/i },
  { theme: "facial", re: /\b(facial|kobido|est[eé]tica|beauty|belleza|skin|piel)\b/i },
  { theme: "sports", re: /\b(sport|deportiv|fisio|physio|quiro|osteo|descontractur|terap[eé]utic)\b/i },
  { theme: "oil", re: /\b(oil|aceite|aromaterap|aroma|ayurv|balin|bali|lomi|sueco|swedish|relajante|relax)\b/i },
  { theme: "wellness", re: /\b(spa|wellness|urban ?spa|nature|zen)\b/i },
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Avalanche mix so nearby ids spread evenly across small candidate lists.
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return Math.abs(h);
}

/**
 * Google Places / Maps photos and scraped studio-site photos are not licensed
 * for us to display, so they never win over our own pool.
 */
const BLOCKED_HOSTS = /(googleusercontent\.com|ggpht\.com|google\.com|gstatic\.com|maps\.googleapis\.com)/i;

function isAllowedImage(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  return !BLOCKED_HOSTS.test(url);
}

export interface StudioImageInput {
  id?: string | number | null;
  name?: string | null;
  /** Existing legitimate image already stored for the studio (preferred). */
  imageUrl?: string | null;
  /** Service names / tags / types used for theme matching. */
  services?: (string | null | undefined)[];
  description?: string | null;
}

/**
 * Resolve the image for a studio.
 * Priority: stored legitimate image → theme match (spread across that theme's
 * images by hashing the studio id) → hash rotation over the whole pool.
 */
export function studioImage(input: StudioImageInput, width = 800): string {
  if (input.imageUrl && isAllowedImage(input.imageUrl)) return input.imageUrl;

  const id = String(input.id ?? input.name ?? "studio");
  const haystack = [input.name, input.description, ...(input.services ?? [])]
    .filter(Boolean)
    .join(" ");

  const match = THEME_RULES.find(r => r.re.test(haystack));
  if (match) {
    const candidates = THEME_CANDIDATES[match.theme];
    if (candidates?.length) {
      // Salt the hash with the theme so two different themes that share an
      // image don't systematically land on the same one.
      return resolve(candidates[hash(match.theme + ":" + id) % candidates.length], width);
    }
  }

  return resolve(POOL[hash("pool:" + id) % POOL.length], width);
}

/**
 * onError handler: if an image ever fails to load, rotate to another pool
 * image instead of showing a broken-image icon.
 */
export function studioImageFallback(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  width = 800,
) {
  const img = e.currentTarget;
  const tries = Number(img.dataset.imgTry ?? "0");
  if (tries >= 3) return;
  img.dataset.imgTry = String(tries + 1);
  const seed = hash(img.src) + tries + 1;
  img.src = resolve(POOL[seed % POOL.length], width);
}
