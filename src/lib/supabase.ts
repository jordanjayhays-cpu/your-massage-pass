import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jglftdstrowwckwqmpue.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnbGZ0ZHN0cm93d2Nrd3FtcHVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0ODQ2MTg3NywiZXhwIjoxOTY0MDM3ODc3fQ.DpLS2hS3a6JNFtSvLNJcL-T6M3F0Rp3Fz8lTQT5VxJQ";

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
  created_at?: string;
}

export interface Lead {
  id?: number;
  email: string;
  name?: string;
  source: string;
  created_at?: string;
}

export async function saveBooking(booking: Omit<Booking, "id" | "created_at">): Promise<{ success: boolean; ref?: string }> {
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
    return { success: true, ref };
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
}

/** Fetch all active shops with their services from Supabase.
 *  Falls back to the hardcoded MASSAGES array if the table is empty. */
export async function fetchShops(): Promise<Shop[]> {
  // Try real data first
  const { data: partners, error } = await supabase
    .from("partners")
    .select("*")
    .eq("status", "active")
    .limit(50);

  if (error || !partners || partners.length === 0) {
    // No real data yet — return empty; caller falls back to MASSAGES
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

  // Flatten into Shop entries (one per service type)
  const shops: Shop[] = [];
  for (const p of partners) {
    const svcs = servicesByPartner[p.id] ?? [];
    if (svcs.length === 0) {
      // Partner with no services — skip, or show a default entry
      continue;
    }
    for (const svc of svcs) {
      shops.push({
        id: `${p.id}-${svc.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: svc.name,
        studio: p.business_name,
        district: p.city ?? "Madrid",
        address: p.address ?? "",
        duration: svc.duration,
        rating: 4.5,      // defaults until real reviews exist
        reviews: 0,
        image: `https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80`,
        description: svc.description || p.description || "",
        tags: [svc.type],
        type: svc.type.toLowerCase(),
        lat: p.latitude ?? 40.4168,
        lng: p.longitude ?? -3.7033,
        whatsapp: p.phone ? `+34 ${p.phone.replace(/\s+/g, "")}` : undefined,
        phone: p.phone,
        email: p.email,
        services: svcs.map(s => s.name),
        basePrice: svc.price,
        partner_id: p.id,
        partner_services: svcs,
        partner_availability: availabilityByPartner[p.id],
      });
    }
  }

  return shops;
}

/** Fetch a single shop by its composite ID (partner_id + service name slug). */
export async function fetchShopById(id: string): Promise<Shop | null> {
  const [partnerId, ...rest] = id.split("-");
  if (!partnerId) return null;

  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", partnerId)
    .eq("status", "active")
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

  const serviceNameSlug = rest.join("-").replace(/-/g, " ");
  const matchedSvc = services?.find(s =>
    s.name.toLowerCase().replace(/\s+/g, "-") === id.split("-").slice(1).join("-")
  ) ?? svc;

  return {
    id,
    name: matchedSvc.name,
    studio: partner.business_name,
    district: partner.city ?? "Madrid",
    address: partner.address ?? "",
    duration: matchedSvc.duration,
    rating: 4.5,
    reviews: 0,
    image: `https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80`,
    description: matchedSvc.description || partner.description || "",
    tags: [matchedSvc.type],
    type: matchedSvc.type.toLowerCase(),
    lat: partner.latitude ?? 40.4168,
    lng: partner.longitude ?? -3.7033,
    whatsapp: partner.phone ? `+34 ${partner.phone.replace(/\s+/g, "")}` : undefined,
    phone: partner.phone,
    email: partner.email,
    services: services?.map(s => s.name) ?? [],
    basePrice: matchedSvc.price,
    partner_id: partner.id,
    partner_services: services ?? [],
    partner_availability: av,
  };
}
