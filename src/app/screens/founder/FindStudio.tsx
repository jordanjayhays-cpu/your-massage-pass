import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { waDigits, telHref } from "@/app/lib/whatsapp";

const serif = { fontFamily: "'Fraunces', serif" };
const LS_KEY = "mc_find_studio_inputs";

const TYPE_CHIPS = [
  "Thai", "Deep Tissue", "Relax", "Sports", "Hot Stone", "Shiatsu",
  "Balinese", "Couples", "Prenatal", "Reflexology", "Lymphatic", "Kobido",
];

type P = {
  id: string;
  business_name?: string | null;
  neighbourhood?: string | null;
  city?: string | null;
  google_rating?: number | null;
  google_reviews?: number | null;
  phone?: string | null;
  whatsapp?: string | null;
};
type S = {
  id?: string;
  partner_id: string;
  name?: string | null;
  type?: string | null;
  duration?: number | null;
  price?: number | null;
};

export function relayMessage(want: string, when: string): string {
  const w = (want || "").trim() || "un masaje";
  const pref = (when || "").trim() ? ` Preferencia: ${when.trim()}.` : "";
  return `Hola! Soy Jordan, de Massage Club. Tengo un cliente que quiere reservar ${w}.${pref} El cliente paga directamente en el centro, nosotros no cobramos comision. ¿Tenéis hueco?`;
}

const norm = (s?: string | null) => (s || "").toLowerCase().trim();
const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const TYPE_KEYWORDS: Array<[string, string[]]> = [
  ["Deep Tissue", ["deep tissue", "descontracturante"]],
  ["Relax", ["relax", "relajante", "relajacion", "relajación"]],
  ["Thai", ["thai", "tailandes", "tailandés"]],
  ["Sports", ["sport", "deportivo"]],
  ["Hot Stone", ["hot stone", "piedras"]],
  ["Shiatsu", ["shiatsu"]],
  ["Balinese", ["balinese", "balines", "balinés"]],
  ["Couples", ["couples", "pareja", "parejas"]],
  ["Prenatal", ["prenatal", "embarazada", "embarazo"]],
  ["Reflexology", ["reflexology", "reflexologia", "reflexología"]],
  ["Lymphatic", ["lymphatic", "linfatico", "linfático", "drenaje"]],
  ["Kobido", ["kobido"]],
];

function parsePaste(raw: string, areaList: string[]): { type: string; area: string; when: string } {
  const words = stripAccents(raw.toLowerCase()).replace(/[.,;:!?]/g, " ").split(/\s+/).filter(Boolean);
  let type = "";
  let area = "";
  const used = new Set<number>();

  // multi-word type phrases first (check consecutive pairs)
  outer:
  for (const [chip, kws] of TYPE_KEYWORDS) {
    for (const kw of kws) {
      const kwWords = stripAccents(kw.toLowerCase()).split(/\s+/);
      if (kwWords.length > 1) {
        for (let i = 0; i + kwWords.length <= words.length; i++) {
          if (kwWords.every((w, j) => words[i + j] === w)) {
            type = chip;
            kwWords.forEach((_, j) => used.add(i + j));
            break outer;
          }
        }
      } else {
        const idx = words.findIndex((w) => w === kwWords[0]);
        if (idx >= 0) { type = chip; used.add(idx); break outer; }
      }
    }
  }

  // area match (accent-insensitive, whole-word)
  for (const a of areaList) {
    const aWords = stripAccents(a.toLowerCase()).split(/\s+/).filter(Boolean);
    for (let i = 0; i + aWords.length <= words.length; i++) {
      if (aWords.every((w, j) => words[i + j] === w)) {
        area = a;
        aWords.forEach((_, j) => used.add(i + j));
        i = words.length;
        break;
      }
    }
  }

  const when = words.filter((_, i) => !used.has(i)).join(" ");
  return { type, area, when };
}

export default function FindStudio({ refreshTick }: { refreshTick?: number }) {
  const [partners, setPartners] = useState<P[]>([]);
  const [services, setServices] = useState<S[]>([]);
  const [loading, setLoading] = useState(true);

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
  })();
  const [want, setWant] = useState<string>(saved.want || "");
  const [when, setWhen] = useState<string>(saved.when || "");
  const [area, setArea] = useState<string>(saved.area || "");
  const [type, setType] = useState<string>(saved.type || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ want, when, area, type }));
  }, [want, when, area, type]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: ps }, { data: svcs }] = await Promise.all([
        supabase.from("partners").select("id,business_name,neighbourhood,city,google_rating,google_reviews,phone,whatsapp").limit(500),
        supabase.from("partner_services").select("id,partner_id,name,type,duration,price").gt("price", 0).limit(2000),
      ]);
      if (!alive) return;
      setPartners((ps as P[]) || []);
      setServices((svcs as S[]) || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [refreshTick]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const p of partners) {
      if (p.neighbourhood?.trim()) set.add(p.neighbourhood.trim());
      if (p.city?.trim()) set.add(p.city.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [partners]);

  const svcByPartner = useMemo(() => {
    const m: Record<string, S[]> = {};
    for (const s of services) {
      if (!s.partner_id) continue;
      (m[s.partner_id] ||= []).push(s);
    }
    return m;
  }, [services]);

  const results = useMemo(() => {
    const t = norm(type);
    const rows = partners
      .map((p) => {
        let svcs = svcByPartner[p.id] || [];
        if (t) svcs = svcs.filter((s) => norm(s.type).includes(t) || norm(s.name).includes(t));
        return { p, svcs };
      })
      .filter(({ p, svcs }) => {
        if (svcs.length === 0) return false;
        if (area) return norm(p.neighbourhood) === norm(area) || norm(p.city) === norm(area);
        return true;
      });
    rows.sort((a, b) => (Number(b.p.google_reviews) || 0) - (Number(a.p.google_reviews) || 0));
    return rows;
  }, [partners, svcByPartner, area, type]);

  const msg = relayMessage(want, when);

  const waHref = (p: P) => {
    const d = waDigits(p.whatsapp || p.phone || "");
    return d ? `https://wa.me/${d}?text=${encodeURIComponent(msg)}` : null;
  };

  const copyOptions = async () => {
    const top = results.slice(0, 3);
    const nums = ["1️⃣", "2️⃣", "3️⃣"];
    const lines = top.map(({ p, svcs }, i) => {
      const cheapest = [...svcs].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))[0];
      const areaLabel = p.neighbourhood || p.city || "Madrid";
      const rating = p.google_rating != null ? `⭐${p.google_rating}` : "⭐—";
      return `${nums[i]} ${p.business_name || "Studio"} · ${areaLabel} · ${rating} · ${cheapest?.type || cheapest?.name || "Massage"} ${cheapest?.duration || 60} min · €${cheapest?.price ?? "—"}`;
    });
    const text = `${lines.join("\n")}\n\nReply 1, 2 or 3 and I'll confirm your time with them.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const input = "w-full h-11 px-3 rounded-2xl border border-[#E5DDD3] bg-white text-sm outline-none";

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 pb-3" style={{ background: "linear-gradient(180deg,#F7F4F0 70%,rgba(247,244,240,0))" }}>
        <div className="rounded-3xl bg-white border border-[#E5DDD3] p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <input className={input} placeholder="What they want (deep tissue 60 min)" value={want} onChange={(e) => setWant(e.target.value.slice(0, 200))} />
            <input className={input} placeholder="When (saturday evening)" value={when} onChange={(e) => setWhen(e.target.value.slice(0, 120))} />
            <select className={input} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All Madrid</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {TYPE_CHIPS.map((c) => {
              const on = type === c;
              return (
                <button
                  key={c}
                  onClick={() => setType(on ? "" : c)}
                  className="shrink-0 px-3 h-8 rounded-full text-xs font-medium border"
                  style={{
                    background: on ? "#C4622D" : "#FFFFFF",
                    color: on ? "#F7F4F0" : "#211C1A",
                    borderColor: on ? "#C4622D" : "#E5DDD3",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl bg-[#F7F4F0] border border-[#E5DDD3] p-3">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#7A7068] mb-1">Message preview</p>
            <p className="text-[13px] leading-snug">{msg}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[#7A7068]">{loading ? "Loading…" : `${results.length} studios`}</p>
            <button onClick={copyOptions} disabled={results.length === 0} className="px-4 h-9 rounded-full text-xs font-semibold border border-[#E5DDD3] bg-white disabled:opacity-40">
              {copied ? "Copied ✓" : "Copy options (top 3)"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {!loading && results.length === 0 && (
          <p className="text-sm text-[#7A7068] px-1">No studios match these filters.</p>
        )}
        {results.map(({ p, svcs }) => {
          const wa = waHref(p);
          const tel = telHref(p.phone || p.whatsapp);
          return (
            <div key={p.id} className="rounded-3xl bg-white border border-[#E5DDD3] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 style={serif} className="text-lg leading-tight">{p.business_name || "Studio"}</h3>
                <span className="text-xs text-[#7A7068] whitespace-nowrap">
                  {p.google_rating != null ? `★ ${p.google_rating}` : "★ —"}
                  {p.google_reviews != null ? ` (${p.google_reviews})` : ""}
                </span>
              </div>
              <p className="text-xs text-[#7A7068] mt-0.5">{p.neighbourhood || p.city || "Madrid"}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {svcs.slice(0, 4).map((s, i) => (
                  <span key={s.id || i} className="px-2.5 h-7 inline-flex items-center rounded-full bg-[#F7F4F0] border border-[#E5DDD3] text-[11px]">
                    {(s.type || s.name || "Massage")} {s.duration || 60}·min €{s.price}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center h-9 px-4 rounded-full text-xs font-semibold text-white" style={{ background: "#25D366" }}>
                    WhatsApp
                  </a>
                )}
                {tel && (
                  <a href={tel} className="inline-flex items-center h-9 px-4 rounded-full text-xs font-semibold border border-[#E5DDD3]">
                    Call
                  </a>
                )}
                <button onClick={copyOptions} className="inline-flex items-center h-9 px-4 rounded-full text-xs font-semibold border border-[#E5DDD3]">
                  {copied ? "Copied ✓" : "Copy options"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
