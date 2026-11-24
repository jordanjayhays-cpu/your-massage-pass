// partner-autofill (24 Nov, Jordan: "we need a 'use ai' button to fill out all
// their info; the button will go to their website and scan everything and fill
// it in").
//
// POST { url } -> { ok: true, fields, sources } | { ok: false, why }
//
// The onboarding page is used before a studio has an account, so this is
// public (verify_jwt false) and guarded instead:
//  - at most PER_IP_HOUR runs per visitor per hour and PER_DAY in total a day
//    (autofill_runs, which stores a salted hash of the IP, never the IP);
//  - http(s) only, default ports, no IP literals, no local or internal names,
//    at most 3 redirects, each checked the same way;
//  - at most 4 pages, 400 KB and 8 s each.
// It never invents: the model may only return what the pages state, every
// field is checked again here, and the studio reviews all of it before saving.
// No health claims in the description (CLAUDE.md: never detox, toxins, cure,
// immunity), no em dashes.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const H = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };
const MODEL = "claude-haiku-4-5-20251001";
const PER_IP_HOUR = 6;
const PER_DAY = 300;
const PAGE_BYTES = 400_000;
const PAGE_MS = 8000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MASSAGE_TYPES = ["Swedish", "Deep Tissue", "Hot Stone", "Sports", "Aromatherapy", "Thai", "Shiatsu", "Couples", "Facial", "Other"];
const CATEGORIES = ["Massage", "Facial", "Body Treatment", "Wellness"];
const LANGUAGES = ["Spanish", "English", "French", "German", "Portuguese", "Italian", "Chinese"];
const AMENITIES = ["Parking", "Wifi", "Showers", "Towels provided", "Wheelchair access", "Card payment", "Changing rooms", "Tea / water"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

async function aiKey(): Promise<string> {
  const env = Deno.env.get("ANTHROPIC_API_KEY");
  if (env) return env;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_secrets?key=eq.ANTHROPIC_API_KEY&select=value&limit=1`, { headers: H });
  const j = await r.json().catch(() => []);
  return String(j?.[0]?.value || "");
}

// ---------- safety on the URL ----------
export function hostAllowed(u: URL): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.port && u.port !== "80" && u.port !== "443") return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!h.includes(".")) return false;
  if (h.startsWith("[") || /^[\d.]+$/.test(h) || /^[0-9a-f:]+$/.test(h)) return false; // IP literals
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|arpa)$/.test(h)) return false;
  if (h.endsWith(".supabase.co") || h.endsWith(".supabase.in")) return false;
  return true;
}

export function normaliseUrl(raw: string): URL | null {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return hostAllowed(u) ? u : null;
  } catch { return null; }
}

async function fetchPage(start: URL): Promise<{ url: string; html: string } | null> {
  let u = start;
  for (let hop = 0; hop < 4; hop++) {
    if (!hostAllowed(u)) return null;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), PAGE_MS);
    try {
      const res = await fetch(u.toString(), {
        redirect: "manual",
        signal: ctl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MassageClubOnboarding/1.0)", Accept: "text/html,application/xhtml+xml" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        await res.body?.cancel();
        if (!loc) return null;
        u = new URL(loc, u);
        continue;
      }
      if (!res.ok) { await res.body?.cancel(); return null; }
      const type = res.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml/i.test(type)) { await res.body?.cancel(); return null; }
      const reader = res.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        chunks.push(value);
        if (size >= PAGE_BYTES) { await reader.cancel(); break; }
      }
      const buf = new Uint8Array(Math.min(size, PAGE_BYTES));
      let off = 0;
      for (const c of chunks) { const n = Math.min(c.length, buf.length - off); buf.set(c.subarray(0, n), off); off += n; if (off >= buf.length) break; }
      return { url: u.toString(), html: new TextDecoder("utf-8", { fatal: false }).decode(buf) };
    } catch { return null; } finally { clearTimeout(timer); }
  }
  return null;
}

// ---------- page to text ----------
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", ordm: "º", ordf: "ª", middot: "·" };
const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n] ?? m);

export function pageFacts(html: string, base: string) {
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim()).join("\n").slice(0, 6000);
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim()).slice(0, 200);
  const metaDesc = decode((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] || "").trim()).slice(0, 400);
  const hrefs = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1].trim(), text: decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 80) }));
  const contacts = hrefs.filter((l) => /^(tel:|mailto:)|wa\.me\/|api\.whatsapp\.com|instagram\.com\//i.test(l.href)).map((l) => l.href).slice(0, 20);
  const text = decode(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t\f\v]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, 14000);
  let host = "";
  try { host = new URL(base).hostname; } catch { /* keep empty */ }
  const internal = hrefs.map((l) => { try { const u = new URL(l.href, base); return u.hostname === host ? { u, text: l.text } : null; } catch { return null; } })
    .filter(Boolean) as Array<{ u: URL; text: string }>;
  return { title, metaDesc, jsonLd, contacts, text, internal };
}

const PAGE_HINT = /(precio|tarifa|servicio|masaje|carta|menu|men%C3%BA|tratamiento|contact|horario|nosotros|about|price|service|treatment|massage|booking|reserva)/i;

export function pickMore(internal: Array<{ u: URL; text: string }>, start: string): URL[] {
  const seen = new Set([start.replace(/[#?].*$/, "").replace(/\/$/, "")]);
  const scored: Array<{ u: URL; s: number }> = [];
  for (const l of internal) {
    const key = l.u.toString().replace(/[#?].*$/, "").replace(/\/$/, "");
    if (seen.has(key) || /\.(pdf|jpg|jpeg|png|webp|gif|zip|mp4)$/i.test(l.u.pathname)) continue;
    seen.add(key);
    const s = (PAGE_HINT.test(l.u.pathname) ? 2 : 0) + (PAGE_HINT.test(l.text) ? 2 : 0);
    if (s > 0) scored.push({ u: l.u, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.u);
}

// ---------- the model ----------
const TOOL = {
  name: "studio_profile",
  description: "The studio's details, exactly as stated on its own pages. Leave out anything the pages do not state.",
  input_schema: {
    type: "object",
    properties: {
      business_name: { type: "string" },
      address: { type: "string", description: "Street and number only" },
      postal_code: { type: "string" },
      city: { type: "string" },
      phone: { type: "string" },
      whatsapp: { type: "string" },
      email: { type: "string" },
      instagram: { type: "string", description: "Handle or URL" },
      description: { type: "string", description: "One or two short factual sentences in English about the studio. No health or medical claims." },
      service_location: { type: "string", enum: ["in_studio", "mobile", "both"] },
      opening_hours: {
        type: "object",
        description: "Only days the pages give. closed=true for a day they say is closed.",
        properties: Object.fromEntries(DAYS.map((d) => [d, { type: "object", properties: { closed: { type: "boolean" }, open: { type: "string", description: "HH:MM" }, close: { type: "string", description: "HH:MM" } } }])),
      },
      services: {
        type: "array",
        description: "Treatments with the duration and price the pages state. One entry per duration.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            duration_min: { type: "number" },
            price_eur: { type: "number" },
            description: { type: "string" },
            type: { type: "string", enum: MASSAGE_TYPES },
            category: { type: "string", enum: CATEGORIES },
          },
          required: ["name"],
        },
      },
      languages: { type: "array", items: { type: "string", enum: LANGUAGES }, description: "Only languages the pages say are spoken." },
      amenities: { type: "array", items: { type: "string", enum: AMENITIES } },
    },
  },
};

async function extract(pages: Array<{ url: string; facts: ReturnType<typeof pageFacts> }>): Promise<Record<string, unknown> | null> {
  const key = await aiKey();
  if (!key) return null;
  const body = pages.map((p) => [
    `=== PAGE ${p.url}`,
    p.facts.title && `TITLE: ${p.facts.title}`,
    p.facts.metaDesc && `META: ${p.facts.metaDesc}`,
    p.facts.jsonLd && `STRUCTURED DATA: ${p.facts.jsonLd}`,
    p.facts.contacts.length ? `CONTACT LINKS: ${p.facts.contacts.join(" ")}` : "",
    `TEXT:\n${p.facts.text}`,
  ].filter(Boolean).join("\n")).join("\n\n").slice(0, 45000);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "studio_profile" },
      system: "You read a massage studio's own web pages and fill in its profile for a booking site. Use only facts the pages state. If something is not stated, leave it out. Never guess a price, a duration, opening hours or a language. Prices are in euros as numbers, durations in minutes. Times are 24 hour HH:MM. The description is one or two short, plain, factual sentences in English; never repeat health claims (detox, toxins, immune system, curing or healing), never use dashes as punctuation. At most 20 services; keep massage and body treatments, skip gift cards and products.",
      messages: [{ role: "user", content: `Fill in the studio profile from these pages.\n\n${body}` }],
    }),
  });
  if (!res.ok) { console.log("[autofill] model", res.status, (await res.text()).slice(0, 300)); return null; }
  const j = await res.json();
  const block = (j?.content || []).find((c: any) => c.type === "tool_use");
  return block?.input && typeof block.input === "object" ? block.input : null;
}

// ---------- checking what came back ----------
const noDash = (s: string) => s.replace(/\s*[—–]\s*/g, ", ").replace(/\s+,/g, ",");
const CLAIM = /\b(detox|desintox|toxin|t[oó]xic|immun|inmun|cure|cura|heal|sana)/i;
const str = (v: unknown, max = 200) => (typeof v === "string" ? noDash(v.replace(/\s+/g, " ").trim()).slice(0, max) : "");
const hhmm = (v: unknown) => { const m = String(v || "").trim().match(/^(\d{1,2})[:.h](\d{2})$/); if (!m) return ""; const h = Number(m[1]), mm = Number(m[2]); return h <= 24 && mm < 60 ? `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : ""; };

export function clean(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ["business_name", "address", "postal_code", "city", "phone", "whatsapp", "email", "instagram"]) {
    const v = str(raw[k], k === "address" ? 160 : 120);
    if (v) out[k] = v;
  }
  if (out.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(out.email))) delete out.email;
  if (out.postal_code && !/^\d{5}$/.test(String(out.postal_code))) delete out.postal_code;
  const desc = str(raw.description, 400);
  if (desc && !CLAIM.test(desc)) out.description = desc;
  if (["in_studio", "mobile", "both"].includes(String(raw.service_location))) out.service_location = raw.service_location;
  const oh = (raw.opening_hours || {}) as Record<string, any>;
  const hours: Record<string, { closed: boolean; open: string; close: string }> = {};
  for (const d of DAYS) {
    const x = oh[d];
    if (!x || typeof x !== "object") continue;
    if (x.closed === true) { hours[d] = { closed: true, open: "", close: "" }; continue; }
    const open = hhmm(x.open), close = hhmm(x.close);
    if (open && close && open < close) hours[d] = { closed: false, open, close };
  }
  if (Object.keys(hours).length) out.opening_hours = hours;
  const services = (Array.isArray(raw.services) ? raw.services : []).map((s: any) => {
    const name = str(s?.name, 80);
    const duration = Math.round(Number(s?.duration_min));
    const price = Math.round(Number(s?.price_eur) * 100) / 100;
    if (!name) return null;
    const descr = str(s?.description, 200);
    return {
      name,
      duration: duration >= 10 && duration <= 300 ? duration : null,
      price: price >= 5 && price <= 2000 ? price : null,
      description: descr && !CLAIM.test(descr) ? descr : "",
      type: MASSAGE_TYPES.includes(s?.type) ? s.type : "Other",
      category: CATEGORIES.includes(s?.category) ? s.category : "Massage",
    };
  }).filter(Boolean).slice(0, 20);
  if (services.length) out.services = services;
  const langs = (Array.isArray(raw.languages) ? raw.languages : []).filter((l: unknown) => LANGUAGES.includes(String(l)));
  if (langs.length) out.languages = [...new Set(langs)];
  const ams = (Array.isArray(raw.amenities) ? raw.amenities : []).filter((a: unknown) => AMENITIES.includes(String(a)));
  if (ams.length) out.amenities = [...new Set(ams)];
  return out;
}

// ---------- rate limits ----------
async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
async function allowed(ipHash: string): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const dayAgo = new Date(Date.now() - 86400e3).toISOString();
  const count = async (q: string) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/autofill_runs?${q}&select=id`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
    const cr = r.headers.get("content-range") || "";
    const n = Number(cr.split("/")[1]);
    return r.ok && Number.isFinite(n) ? n : Infinity;
  };
  return (await count(`ip_hash=eq.${ipHash}&created_at=gte.${hourAgo}`)) < PER_IP_HOUR && (await count(`created_at=gte.${dayAgo}`)) < PER_DAY;
}
async function logRun(row: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/autofill_runs`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(row) }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, why: "method" }, 405);
  const t0 = Date.now();
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const start = normaliseUrl(String(body?.url || ""));
  if (!start) return json({ ok: false, why: "bad_url" });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ipHash = await sha(`${ip}|${new Date().toISOString().slice(0, 10)}|partner-autofill`);
  if (!(await allowed(ipHash))) return json({ ok: false, why: "too_many" });

  const first = await fetchPage(start);
  if (!first) { await logRun({ ip_hash: ipHash, url_host: start.hostname, ok: false, why: "fetch", ms: Date.now() - t0 }); return json({ ok: false, why: "fetch" }); }
  const facts0 = pageFacts(first.html, first.url);
  const pages = [{ url: first.url, facts: facts0 }];
  const more = await Promise.all(pickMore(facts0.internal, first.url).map((u) => fetchPage(u)));
  for (const p of more) if (p) pages.push({ url: p.url, facts: pageFacts(p.html, p.url) });

  const raw = await extract(pages);
  if (!raw) { await logRun({ ip_hash: ipHash, url_host: start.hostname, ok: false, why: "model", ms: Date.now() - t0 }); return json({ ok: false, why: "model" }); }
  const fields = clean(raw);
  if (!fields.website) fields.website = `${start.protocol}//${start.hostname}`;
  await logRun({ ip_hash: ipHash, url_host: start.hostname, ok: true, fields_found: Object.keys(fields).length, ms: Date.now() - t0 });
  return json({ ok: true, fields, sources: pages.map((p) => p.url) });
});
