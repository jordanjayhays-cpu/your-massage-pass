// Edge function: sitemap
// Returns a dynamic sitemap.xml for search engines.
// Includes static pages plus every studio that meets the public-listing quality bar.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SITE = "https://book.massageclub.io";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://jglftdstrowwckwqmpue.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STATIC_ROUTES = [
  "/",
  "/web",
  "/studios",
  "/partner",
  "/privacy",
  "/terms",
  "/massage-in-english-madrid",
  "/guides/massage-prices-madrid",
  "/guides/massage-prices-madrid-study",
  "/guides/your-first-massage-in-madrid",
  "/guides/deep-tissue-massage-madrid",
  "/guides/is-massage-good-for-you",
  "/madrid/chamberi",
  "/madrid/salamanca",
  "/madrid/chamartin",
  "/madrid/chueca",
  "/madrid/centro",
  "/madrid/malasana",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    const partnersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/partners?select=id,slug,status,outreach_status&neq(status,suspended)&limit=2000`,
      { headers },
    );
    const partners = (await partnersRes.json()) as any[];

    const eligible = (partners ?? []).filter(
      (p) => !["rejected", "skipped_not_massage"].includes(p.outreach_status ?? "")
    );

    let slugs: string[] = [];
    if (eligible.length) {
      const ids = eligible.map((p) => p.id).join(",");
      const servicesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/partner_services?select=partner_id&in=partner_id,(${ids})&limit=2000`,
        { headers },
      );
      const services = (await servicesRes.json()) as any[];
      const counts: Record<string, number> = {};
      for (const s of services ?? []) {
        counts[s.partner_id] = (counts[s.partner_id] ?? 0) + 1;
      }
      slugs = eligible
        .filter((p) => counts[p.id] >= 3 && p.slug)
        .map((p) => `/${p.slug}`);
    }

    const urls = [...STATIC_ROUTES, ...slugs];
    const today = new Date().toISOString().split("T")[0];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map(
        (path) =>
          `  <url>\n    <loc>${escapeXml(`${SITE}${path}`)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${path === "/" ? "1.0" : "0.7"}</priority>\n  </url>`
      )
      .join("\n")}\n</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeXml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
