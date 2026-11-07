import { createClient } from "@supabase/supabase-js";
import { STOCK_PHOTOS, assignStockSlots, type StockSlotInput } from "./studioImages";
import { getSource } from "./attribution";

// ─── Config ───────────────────────────────────────────────────────────────────
// Your Supabase project URL (safe to expose).
const supabaseUrl = "https://jglftdstrowwckwqmpue.supabase.co";

// 👇 Your Supabase publishable (public) key. Safe to expose in frontend code.
// Hardcoded on purpose so no stale environment variable can override it.
const supabaseKey = "sb_publishable_oxG5Zjo1ERmCl57_zhJ-dw_aI7jf7ky";

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Booking {
  id?: number;
  client_name: string;
  client_email: string;
  client_phone?: string;
  spa_name: string;
  massage_type: string;
  booking_date: string;
  booking_time: string;
  duration: number;
  pressure?: string;
  focus_areas?: string[];
  add_ons?: string[];
  notes?: string;
  status: "pending" | "confirmed" | "cancelled";
  client_preferences?: any;
  created_at?: string;
  user_id?: string | null;
  partner_id?: string | null;
  service_id?: string | null;
  price?: number | null;
  lang?: string | null;
  comfort_prefs?: Record<string, any> | null;
  marketing_opt_in?: boolean | null;
  marketing_opt_in_at?: string | null;
}


export interface Lead {
  id?: number;
  email: string;
  name?: string;
  source: string;
  created_at?: string;
}

export async function saveBooking(booking: Omit<Booking, "id" | "created_at">): Promise<{ success: boolean; ref?: string; id?: number }> {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .insert([{ ...booking, ...getSource() }])
      .select("id")
      .single();

    if (error) {
      console.error("Supabase booking error:", error);
      return { success: false };
    }

    const ref = `MR-2026-${String(data.id).padStart(4, "0")}`;
    return { success: true, ref, id: data.id as number };
  } catch (err) {
    console.error("Booking save error:", err);
    return { success: false };
  }
}


export async function saveLead(email: string, name: string, source: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("leads").insert([{ email, name, source }]);
    if (error) {
      // Duplicate email is fine
      if (error.code !== "23505") console.error("Lead save error:", error);
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Shop / Partner data ──────────────────────────────────────────────────────

export interface ShopService {
  id?: string;
  name: string;            // Spanish name — the one the studio uses. Sent in WhatsApp/email.
  name_en?: string | null; // English name — shown to visitors as the primary line.
  description_en?: string | null; // reserved, not populated yet
  type: string;
  duration: number;
  price: number;
  description: string;
}

export interface Shop {
  id: string;
  name: string;           // service name (Massage.name)
  studio: string;         // business_name
  district: string;       // partners.neighbourhood, else city, else "Madrid"
  address: string;
  duration: number;
  /** Real Google rating, or null when we do not have one. Never defaulted. */
  rating: number | null;
  /** Real Google review count, or null. Never defaulted. */
  reviews: number | null;
  /** `ownImage`, else `stockImage`, else "". Render it with StudioPhoto, which labels stock. */
  image: string;
  /**
   * The studio's OWN photo (cover, else the first gallery image), or null.
   * It stands for the place (2 Nov: 165 of 166 studios have none).
   */
  ownImage?: string | null;
  /**
   * The studio's stock photo (7 Nov), unique to it; see assignStockSlots.
   * Only ever shown with the "Stock photo" label (StudioPhoto component).
   */
  stockImage?: string | null;
  description: string;
  tags: string[];
  type: string;           // massage type from partner_service
  lat: number;
  lng: number;
  whatsapp?: string;
  bookingUrl?: string;
  phone?: string;
  email?: string;
  services: string[];
  basePrice?: number;
  km?: number;
  walkingText?: string;
  // raw partner data (for detail view)
  partner_id: string;
  /** Clean URL slug for the studio page (book.massageclub.io/{slug}). */
  slug?: string | null;
  partner_services: ShopService[];
  partner_availability?: Record<string, string[]>;
  google_rating?: number | null;
  google_reviews?: number | null;
  status?: string;
  /** Languages the studio speaks, as stored on the partner row. */
  languages?: string[] | null;
  /** Raw opening hours JSON from the partner row, when the studio set them. */
  opening_hours?: Record<string, any> | null;
  /** True when the studio confirms bookings automatically. */
  auto_confirm_bookings?: boolean | null;
}

/** In-memory cache of the last successful studio list.
 *  Back-navigation remounts the discovery screen; without this a hung or
 *  aborted request would leave it stuck on "Loading studios…" with 0 found. */
let shopsCache: Shop[] | null = null;
let shopsInFlight: Promise<Shop[]> | null = null;

/** Last successful result, if any. Used to paint instantly on remount. */
export function cachedShops(): Shop[] | null {
  return shopsCache;
}

/**
 * The studio's own photo: its cover, else the first gallery image that is not
 * a video. Same rule as the studio page (StudioBookingPage studioPhoto). A
 * logo is not a photo of the place, and stock images never count.
 */
export function ownStudioPhoto(p: { cover_url?: string | null; gallery?: unknown } | null | undefined): string | null {
  if (!p) return null;
  if (typeof p.cover_url === "string" && p.cover_url.trim()) return p.cover_url;
  if (Array.isArray(p.gallery)) {
    const g = p.gallery.find((u: unknown) => typeof u === "string" && u.trim() && !/\.(mp4|webm)(\?.*)?$/i.test(u));
    if (typeof g === "string") return g;
  }
  return null;
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => { window.clearTimeout(timer); resolve(v); },
      (e) => { window.clearTimeout(timer); reject(e); },
    );
  });
}

// ─── Stock photos (7 Nov) ───
// One studio, one stock photo, the same on every page. The slots come from
// the full studio list (the same filter as the studio pages), loaded once per
// visit and kept in memory; assignStockSlots (studioImages.ts) has the rule.
// Single-studio pages (the studio page, "Book again") read the same slots.

let stockSlots: Map<string, number> | null = null;
let stockSlotsFailed = false;
let stockSlotsInFlight: Promise<Map<string, number> | null> | null = null;
const stockListeners = new Set<() => void>();

function notifyStock() {
  stockListeners.forEach((fn) => fn());
}

function setStockSlots(next: Map<string, number>) {
  stockSlots = next;
  stockSlotsFailed = false;
  notifyStock();
}

/** For useStockPhoto: `fn` runs once the slots are known, or their load failed. */
export function subscribeStockPhotos(fn: () => void): () => void {
  stockListeners.add(fn);
  return () => { stockListeners.delete(fn); };
}

/** The stock photo for a studio id; null while the slots are unknown, or for an unknown id. */
export function stockPhotoFor(id?: string | null): string | null {
  if (!id || !stockSlots) return null;
  const slot = stockSlots.get(String(id));
  return slot == null ? null : STOCK_PHOTOS[slot] ?? null;
}

/** True once the slots are known, or once their load failed (nothing more will come). */
export function stockPhotosSettled(): boolean {
  return stockSlots != null || stockSlotsFailed;
}

/**
 * Load the studio list behind the stock photo slots, once per visit. Light:
 * id, created_at and a service count per studio. Resolves to null when it
 * cannot load; pages then show the studio's tile or map, as before.
 */
export function loadStockPhotos(): Promise<Map<string, number> | null> {
  if (stockSlots) return Promise.resolve(stockSlots);
  if (stockSlotsInFlight) return stockSlotsInFlight;
  stockSlotsInFlight = (async () => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("partners")
          .select("id, created_at, partner_services(count)")
          .in("status", ["active", "pending"])
          .is("opted_out_at", null)
          .limit(1000),
        12000,
      );
      if (error || !Array.isArray(data)) throw error ?? new Error("no rows");
      type LightRow = { id: string; created_at: string | null; partner_services: { count: number }[] | null };
      const rows: StockSlotInput[] = (data as unknown as LightRow[]).map((p) => ({
        id: String(p.id),
        createdAt: p.created_at ?? null,
        listed: Number(p.partner_services?.[0]?.count ?? 0) > 0,
      }));
      setStockSlots(assignStockSlots(rows));
    } catch (err) {
      console.warn("[loadStockPhotos] failed:", err);
      if (!stockSlots) {
        stockSlotsFailed = true;
        notifyStock();
      }
    } finally {
      stockSlotsInFlight = null;
    }
    return stockSlots;
  })();
  return stockSlotsInFlight;
}

/** Always-resolving studio loader: dedupes concurrent calls, times out,
 *  and falls back to the last good result instead of hanging. */
export async function loadShops(): Promise<Shop[]> {
  if (shopsInFlight) return shopsInFlight;
  shopsInFlight = (async () => {
    try {
      const shops = await withTimeout(fetchShops(), 15000);
      // Never let a transient empty/error result wipe a good cache.
      if (shops.length || !shopsCache) shopsCache = shops;
      return shopsCache ?? shops;
    } catch (err) {
      console.error("[loadShops] failed:", err);
      return shopsCache ?? [];
    } finally {
      shopsInFlight = null;
    }
  })();
  return shopsInFlight;
}

/** Fetch all active shops with their services from Supabase.
 *  Returns an empty list when the table is empty (no hardcoded demo studios). */

export async function fetchShops(): Promise<Shop[]> {
  // The stock photo slots load alongside (once per visit).
  const stockReady = loadStockPhotos();
  // Try real data first
  const { data: partners, error } = await supabase
    .from("partners")
    .select("*")
    .in("status", ["active", "pending"])
    // 31 Oct (Jordan: "deploy all of them"): a studio that told us it is not
    // interested ("No me interesa", "BAJA") is never shown with a Book button.
    .is("opted_out_at", null)
    .limit(200);

  if (error) {
    console.error("[fetchShops] could not read partners:", error.message);
    return [];
  }
  if (!partners || partners.length === 0) {
    return [];
  }

  // Fetch services for all these partners in one shot
  const partnerIds = partners.map(p => p.id);
  const { data: allServices } = await supabase
    .from("partner_services")
    .select("*")
    .in("partner_id", partnerIds);

  // Fetch availability
  const { data: allAvailability } = await supabase
    .from("partner_availability")
    .select("*")
    .in("partner_id", partnerIds);

  // Group
  const servicesByPartner: Record<string, ShopService[]> = {};
  for (const s of allServices ?? []) {
    if (!servicesByPartner[s.partner_id]) servicesByPartner[s.partner_id] = [];
    servicesByPartner[s.partner_id].push(s);
  }

  const availabilityByPartner: Record<string, Record<string, string[]>> = {};
  for (const a of allAvailability ?? []) {
    if (!availabilityByPartner[a.partner_id]) availabilityByPartner[a.partner_id] = {};
    if (!availabilityByPartner[a.partner_id][a.day_of_week]) availabilityByPartner[a.partner_id][a.day_of_week] = [];
    availabilityByPartner[a.partner_id][a.day_of_week].push(a.time_slot);
  }

  // Stock photo slots. If the light list could not load, the same rule runs
  // on this list, which holds the same studios while there are under 200.
  await stockReady;
  if (!stockSlots && partners.length < 200) {
    setStockSlots(assignStockSlots(partners.map((p) => ({
      id: String(p.id),
      createdAt: p.created_at ?? null,
      listed: (servicesByPartner[p.id]?.length ?? 0) > 0,
    }))));
  }

  // One card PER STUDIO (not per service) — the card opens the studio's page.
  const shops: Shop[] = [];
  for (const p of partners) {
    const svcs = servicesByPartner[p.id] ?? [];
    if (svcs.length === 0) continue;
    const types = [...new Set(svcs.map(s => s.type).filter(Boolean))];
    const prices = svcs.map(s => Number(s.price)).filter(n => !isNaN(n));
    const ownImage = ownStudioPhoto(p);
    const stockImage = stockPhotoFor(p.id);
    shops.push({
      id: p.id,                                   // studio id → resolved to /{slug}
      name: p.business_name || "Studio",
      studio: p.business_name || "Studio",
      // The neighbourhood ("Chamberí") is what people pick a studio by; city is always Madrid.
      district: p.neighbourhood || p.city || "Madrid",
      address: p.address ?? "",
      duration: svcs[0]?.duration ?? 60,
      rating: p.google_rating != null ? Number(p.google_rating) : null,
      reviews: p.google_reviews != null ? Number(p.google_reviews) : null,
      image: ownImage || stockImage || "",
      ownImage,
      stockImage,
      description: p.description || svcs[0]?.description || "",
      tags: types.length ? types : ["Massage"],
      type: (svcs[0]?.type || "Massage").toLowerCase(),
      lat: p.latitude ?? 40.4168,
      lng: p.longitude ?? -3.7033,
      whatsapp: (p as any).whatsapp || p.phone || undefined,
      phone: p.phone,
      email: p.email,
      services: svcs.map(s => s.name || "Massage"),
      basePrice: prices.length ? Math.min(...prices) : undefined,
      partner_id: p.id,
      slug: p.slug ?? null,
      partner_services: svcs,
      partner_availability: availabilityByPartner[p.id],
      google_rating: p.google_rating ?? null,
      google_reviews: p.google_reviews ?? null,
      status: p.status ?? "pending",
      languages: Array.isArray((p as any).languages) ? (p as any).languages : null,
      opening_hours: (p as any).opening_hours ?? null,
      auto_confirm_bookings: (p as any).auto_confirm_bookings ?? null,
    });
  }

  return shops;
}

/** Full studio profile for the shareable booking page (by partner UUID). */
export interface StudioProfile {
  partner: any;
  services: any[];
  availability: any[];
  therapists: any[];
  addons: any[];
}

export async function fetchStudioProfile(partnerId: string): Promise<StudioProfile | null> {
  if (!partnerId) return null;
  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", partnerId)
    .in("status", ["active", "pending"])
    .is("opted_out_at", null)
    .single();
  if (!partner) return null;

  const [{ data: services }, { data: availability }, { data: therapists }, { data: addons }] = await Promise.all([
    supabase.from("partner_services").select("*").eq("partner_id", partnerId),
    supabase.from("partner_availability").select("*").eq("partner_id", partnerId),
    supabase.from("therapists").select("*").eq("partner_id", partnerId),
    supabase.from("partner_addons").select("*").eq("partner_id", partnerId),
  ]);

  return {
    partner,
    services: services ?? [],
    availability: availability ?? [],
    therapists: therapists ?? [],
    addons: addons ?? [],
  };
}

/** Fetch a single shop by its composite ID (partnerUUID__serviceSlug). */
export async function fetchShopById(id: string): Promise<Shop | null> {
  // Real-studio ids use "__" between the partner UUID and the service slug.
  // Unknown ids simply resolve to null; there is no hardcoded fallback.
  if (!id || !id.includes("__")) return null;
  const partnerId = id.split("__")[0];
  const slug = id.split("__").slice(1).join("__");
  if (!partnerId) return null;

  const stockReady = loadStockPhotos();
  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", partnerId)
    .in("status", ["active", "pending"])
    .is("opted_out_at", null)
    .single();

  if (!partner) return null;
  await stockReady;
  const ownImage = ownStudioPhoto(partner);
  const stockImage = stockPhotoFor(partner.id);

  const { data: services } = await supabase
    .from("partner_services")
    .select("*")
    .eq("partner_id", partnerId);

  const { data: availability } = await supabase
    .from("partner_availability")
    .select("*")
    .eq("partner_id", partnerId);

  const svc = services?.[0];
  const av: Record<string, string[]> = {};
  for (const a of availability ?? []) {
    if (!av[a.day_of_week]) av[a.day_of_week] = [];
    av[a.day_of_week].push(a.time_slot);
  }

  if (!svc) return null;

  const matchedSvc = services?.find(s =>
    (s.name || "").toLowerCase().replace(/\s+/g, "-") === slug
  ) ?? svc;

  return {
    id,
    name: matchedSvc.name || "Massage",
    studio: partner.business_name || "Studio",
    district: partner.neighbourhood || partner.city || "Madrid",
    address: partner.address ?? "",
    duration: matchedSvc.duration ?? 60,
    rating: partner.google_rating != null ? Number(partner.google_rating) : null,
    reviews: partner.google_reviews != null ? Number(partner.google_reviews) : null,
    image: ownImage || stockImage || "",
    ownImage,
    stockImage,
    description: matchedSvc.description || partner.description || "",
    tags: [matchedSvc.type || "Massage"],
    type: (matchedSvc.type || "Massage").toLowerCase(),
    lat: partner.latitude ?? 40.4168,
    lng: partner.longitude ?? -3.7033,
    whatsapp: (partner as any).whatsapp || partner.phone || undefined,
    phone: partner.phone,
    email: partner.email,
    services: services?.map(s => s.name || "Massage") ?? [],
    basePrice: matchedSvc.price,
    partner_id: partner.id,
    partner_services: services ?? [],
    partner_availability: av,
    status: partner.status ?? "pending",
  };
}
