/**
 * Quiz result helper: find the studios closest to the visitor that actually
 * offer the recommended massage type.
 *
 * Only real data is used. Studios without coordinates are skipped, prices are
 * shown only when the service has one, and nothing is invented.
 */
import { supabase } from "@/lib/supabase";
import type { MassageType } from "@/app/data";

export type NearbyService = {
  id: string;
  name: string | null;
  name_en: string | null;
  price: number | null;
  duration: number | null;
};

export type NearbyStudio = {
  id: string;
  slug: string | null;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  km: number;
  meters: number;
  walkMinutes: number;
  service: NearbyService;
};

/** Words (ES + EN) that identify each quiz massage type in a studio menu. */
const TYPE_KEYWORDS: Record<MassageType, string[]> = {
  swedish: ["swedish", "sueco", "sueca", "relaj", "relax", "clasic", "clásic", "classic"],
  deep: ["deep", "profund", "descontractur", "tejido"],
  stone: ["stone", "piedra", "basalt", "caliente"],
  sports: ["sport", "deportiv", "recovery", "recuper"],
  thai: ["thai", "tailand", "tradicional tailand"],
  lomi: ["lomi", "hawai", "hawaii"],
};

const norm = (v: unknown) => String(v ?? "").toLowerCase();

function serviceMatchesType(s: any, type: MassageType): boolean {
  const hay = `${norm(s.type)} ${norm(s.name)} ${norm(s.name_en)} ${norm(s.description)}`;
  return TYPE_KEYWORDS[type].some((k) => hay.includes(k));
}

/** Great-circle distance in kilometres. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "650 m away, about 8 min walk" (80 m per minute). */
export function distanceLabel(meters: number, minutes: number): string {
  const dist = meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
  return `${dist} away, about ${minutes} min walk`;
}

/**
 * Studios offering `type`, sorted by distance from the visitor.
 * Returns [] when nothing matches; never throws.
 */
export async function findNearestStudios(
  type: MassageType,
  userLat: number,
  userLng: number,
  limit = 3,
): Promise<NearbyStudio[]> {
  try {
    const { data: partners } = await supabase
      .from("partners")
      .select("id, slug, business_name, address, latitude, longitude, status")
      .in("status", ["active", "pending"])
      .limit(300);
    if (!partners?.length) return [];

    const located = partners.filter(
      (p: any) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) && p.latitude != null && p.longitude != null,
    );
    if (!located.length) return [];

    const { data: services } = await supabase
      .from("partner_services")
      .select("*")
      .in("partner_id", located.map((p: any) => p.id));

    const byPartner = new Map<string, any[]>();
    for (const s of services ?? []) {
      if (!serviceMatchesType(s, type)) continue;
      const list = byPartner.get(s.partner_id) ?? [];
      list.push(s);
      byPartner.set(s.partner_id, list);
    }

    const out: NearbyStudio[] = [];
    for (const p of located as any[]) {
      const matches = byPartner.get(p.id);
      if (!matches?.length) continue;
      const km = haversineKm(userLat, userLng, Number(p.latitude), Number(p.longitude));
      const meters = km * 1000;
      const s = matches[0];
      const price = Number(s.price);
      const duration = Number(s.duration);
      out.push({
        id: p.id,
        slug: p.slug ?? null,
        name: p.business_name || "Studio",
        address: p.address ?? null,
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        km,
        meters,
        walkMinutes: Math.max(1, Math.round(meters / 80)),
        service: {
          id: s.id,
          name: s.name ?? null,
          name_en: s.name_en ?? null,
          price: Number.isFinite(price) && price > 0 ? price : null,
          duration: Number.isFinite(duration) && duration > 0 ? duration : null,
        },
      });
    }

    return out.sort((a, b) => a.km - b.km).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Studios offering `type` when we have no location (permission denied).
 * Same matching rules, no distances invented.
 */
export async function findStudiosOfferingType(
  type: MassageType,
  limit = 3,
): Promise<Omit<NearbyStudio, "km" | "meters" | "walkMinutes" | "lat" | "lng">[]> {
  try {
    const { data: partners } = await supabase
      .from("partners")
      .select("id, slug, business_name, address, status")
      .in("status", ["active", "pending"])
      .limit(300);
    if (!partners?.length) return [];

    const { data: services } = await supabase
      .from("partner_services")
      .select("*")
      .in("partner_id", partners.map((p: any) => p.id));

    const byPartner = new Map<string, any>();
    for (const s of services ?? []) {
      if (!serviceMatchesType(s, type)) continue;
      if (!byPartner.has(s.partner_id)) byPartner.set(s.partner_id, s);
    }

    const out: any[] = [];
    for (const p of partners as any[]) {
      const s = byPartner.get(p.id);
      if (!s) continue;
      const price = Number(s.price);
      const duration = Number(s.duration);
      out.push({
        id: p.id,
        slug: p.slug ?? null,
        name: p.business_name || "Studio",
        address: p.address ?? null,
        service: {
          id: s.id,
          name: s.name ?? null,
          name_en: s.name_en ?? null,
          price: Number.isFinite(price) && price > 0 ? price : null,
          duration: Number.isFinite(duration) && duration > 0 ? duration : null,
        },
      });
    }
    return out.slice(0, limit);
  } catch {
    return [];
  }
}

/** Does the studio the visitor came from also offer the recommended type? */
export async function studioOffersType(slugOrId: string, type: MassageType): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq(isUuid ? "id" : "slug", slugOrId)
      .maybeSingle();
    if (!partner?.id) return false;
    const { data: services } = await supabase
      .from("partner_services")
      .select("*")
      .eq("partner_id", partner.id);
    return (services ?? []).some((s: any) => serviceMatchesType(s, type));
  } catch {
    return false;
  }
}
