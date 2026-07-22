import { createClient } from "@supabase/supabase-js";

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
      .insert([booking])
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
  name: string;
  type: string;
  duration: number;
  price: number;
  description: string;
}

export interface Shop {
  id: string;
  name: string;           // service name (Massage.name)
  studio: string;         // business_name
  district: string;       // derived from address city
  address: string;
  duration: number;
  rating: number;
  reviews: number;
  image: string;
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
  partner_services: ShopService[];
  partner_availability?: Record<string, string[]>;
  google_rating?: number | null;
  google_reviews?: number | null;
}

/** Fetch all active shops with their services from Supabase.
 *  Falls back to the hardcoded MASSAGES array if the table is empty. */
export async function fetchShops(): Promise<Shop[]> {
  // Try real data first
  const { data: partners, error } = await supabase
    .from("partners")
    .select("*")
    .in("status", ["active", "pending"])
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

  // One card PER STUDIO (not per service) — the card opens the studio's page.
  const DEFAULT_IMG = "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80";
  const shops: Shop[] = [];
  for (const p of partners) {
    const svcs = servicesByPartner[p.id] ?? [];
    if (svcs.length === 0) continue;
    const types = [...new Set(svcs.map(s => s.type).filter(Boolean))];
    const prices = svcs.map(s => Number(s.price)).filter(n => !isNaN(n));
    shops.push({
      id: p.id,                                   // studio id → routes to /s/<id>
      name: p.business_name || "Studio",
      studio: p.business_name || "Studio",
      district: p.city ?? "Madrid",
      address: p.address ?? "",
      duration: svcs[0]?.duration ?? 60,
      rating: 4.5,
      reviews: 0,
      image: p.cover_url || (Array.isArray(p.gallery) && p.gallery[0]) || p.logo_url || DEFAULT_IMG,
      description: p.description || svcs[0]?.description || "",
      tags: types.length ? types : ["Massage"],
      type: (svcs[0]?.type || "Massage").toLowerCase(),
      lat: p.latitude ?? 40.4168,
      lng: p.longitude ?? -3.7033,
      whatsapp: p.phone ? `+34 ${p.phone.replace(/\s+/g, "")}` : undefined,
      phone: p.phone,
      email: p.email,
      services: svcs.map(s => s.name || "Massage"),
      basePrice: prices.length ? Math.min(...prices) : undefined,
      partner_id: p.id,
      partner_services: svcs,
      partner_availability: availabilityByPartner[p.id],
      google_rating: p.google_rating ?? null,
      google_reviews: p.google_reviews ?? null,
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
  // Demo (hardcoded) ids don't, so let the caller fall back to MASSAGES.
  if (!id || !id.includes("__")) return null;
  const partnerId = id.split("__")[0];
  const slug = id.split("__").slice(1).join("__");
  if (!partnerId) return null;

  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", partnerId)
    .in("status", ["active", "pending"])
    .single();

  if (!partner) return null;

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
    district: partner.city ?? "Madrid",
    address: partner.address ?? "",
    duration: matchedSvc.duration ?? 60,
    rating: 4.5,
    reviews: 0,
    image: `https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80`,
    description: matchedSvc.description || partner.description || "",
    tags: [matchedSvc.type || "Massage"],
    type: (matchedSvc.type || "Massage").toLowerCase(),
    lat: partner.latitude ?? 40.4168,
    lng: partner.longitude ?? -3.7033,
    whatsapp: partner.phone ? `+34 ${partner.phone.replace(/\s+/g, "")}` : undefined,
    phone: partner.phone,
    email: partner.email,
    services: services?.map(s => s.name || "Massage") ?? [],
    basePrice: matchedSvc.price,
    partner_id: partner.id,
    partner_services: services ?? [],
    partner_availability: av,
  };
}
