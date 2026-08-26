import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

const FN_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/confirm-hours";

type Day = { dow: number; closed: boolean; open: number; close: number };

type ApiOk = {
  ok: true;
  studio: string;
  slug: string;
  address?: string | null;
  lang?: string | null;
  has_hours: boolean;
  confirmed_at?: string | null;
  days: Day[];
};

const DAY_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const hh = (n: number) => `${String(n).padStart(2, "0")}:00`;
const OPEN_HOURS = Array.from({ length: 23 - 7 + 1 }, (_, i) => 7 + i);
const CLOSE_HOURS = Array.from({ length: 24 - 8 + 1 }, (_, i) => 8 + i);

export default function StudioHours() {
  const { studioId } = useParams<{ studioId?: string }>();
  const [params] = useSearchParams();
  const code = params.get("c") || "";
  const token = params.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiOk | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [days, setDays] = useState<Day[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Never index this page.
  useEffect(() => {
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex";
    document.head.appendChild(m);
    return () => { document.head.removeChild(m); };
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (token) p.set("token", token);
    else {
      if (studioId) p.set("slug", studioId);
      if (code) p.set("c", code);
    }
    p.set("format", "json");
    return p.toString();
  }, [studioId, code, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${FN_URL}?${query}`);
        const json = await res.json();
        if (cancelled) return;
        if (!json?.ok) { setInvalid(true); return; }
        setData(json as ApiOk);
        const sorted = [...(json.days || [])].sort((a: Day, b: Day) => (a.dow === 0 ? 7 : a.dow) - (b.dow === 0 ? 7 : b.dow));
        setDays(sorted);
        setEditing(!json.has_hours);
      } catch {
        if (!cancelled) setInvalid(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  const patch = (dow: number, next: Partial<Day>) =>
    setDays(prev => prev.map(d => {
      if (d.dow !== dow) return d;
      const merged = { ...d, ...next };
      if (merged.close <= merged.open) merged.close = Math.min(24, merged.open + 1);
      return merged;
    }));

  const submit = async (action: "confirm" | "save") => {
    setSaving(true);
    setError(null);
    try {
      const body: any = token ? { token, action } : { slug: studioId, c: code, action };
      if (action === "save") body.days = days;
      const res = await fetch(`${FN_URL}?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error("failed");
      setDone(true);
    } catch {
      setError("No se ha podido guardar. Inténtalo otra vez. / Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-sm text-[#7A7068]">Cargando… / Loading…</p>
      </div>
    );
  }

  if (invalid || !data) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] px-4 py-10">
        <div className="max-w-md mx-auto rounded-2xl border border-[#E5DDD3] bg-white p-6 text-center">
          <h1 className="font-display text-xl font-bold text-[#2b2b2b]">Enlace no válido</h1>
          <p className="text-sm text-[#7A7068] mt-1">Invalid link</p>
          <p className="text-sm text-[#7A7068] mt-3">
            Escríbenos por WhatsApp y te mandamos uno nuevo. / Message us on WhatsApp and we will send a new one.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] px-4 py-10">
        <div className="max-w-md mx-auto rounded-2xl border border-[#E5DDD3] bg-white p-6 text-center">
          <h1 className="font-display text-xl font-bold text-[#2b2b2b]">Listo. Ya podéis recibir reservas en ese horario.</h1>
          <p className="text-sm text-[#7A7068] mt-1">Done. You can now receive bookings in those hours.</p>
          <a
            href={`https://book.massageclub.io/${data.slug}`}
            className="inline-block mt-5 rounded-xl bg-[#B85C38] px-5 py-3 text-sm font-semibold text-[#FAF6F1]"
          >
            Ver vuestra página / View your page
          </a>
        </div>
      </div>
    );
  }

  const primaryLabel = data.has_hours && !editing
    ? "Sí, es correcto / Yes, this is correct"
    : "Guardar horario / Save schedule";

  return (
    <div className="min-h-screen bg-[#FAF6F1] px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <header className="text-center">
          <h1 className="font-display text-2xl font-bold text-[#2b2b2b]">{data.studio}</h1>
          {data.address && <p className="text-sm text-[#7A7068] mt-1">{data.address}</p>}
        </header>

        <div className="rounded-2xl border border-[#E5DDD3] bg-[#FAF7F2] p-4">
          {data.has_hours ? (
            <>
              <p className="text-sm text-[#2b2b2b]">Este es el horario con el que aparecéis ahora mismo. Solo os llegarán reservas dentro de estas horas.</p>
              <p className="text-xs text-[#8a7460] mt-1">This is the schedule you currently appear with. You will only receive bookings inside these hours.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-[#2b2b2b]">Todavía no tenemos vuestro horario. Esto es una sugerencia, revisadla y guardad.</p>
              <p className="text-xs text-[#8a7460] mt-1">We do not have your schedule yet. This is a suggestion, please check it and save.</p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[#E5DDD3] bg-white divide-y divide-[#F0E9E0]">
          {days.map(d => (
            <div key={d.dow} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#2b2b2b]">{DAY_ES[d.dow]}</p>
                  <p className="text-xs text-[#8a7460]">{DAY_EN[d.dow]}</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-[#7A7068]">
                  <input
                    type="checkbox"
                    checked={d.closed}
                    disabled={!editing}
                    onChange={e => patch(d.dow, { closed: e.target.checked })}
                  />
                  Cerrado / Closed
                </label>
              </div>
              {!d.closed && (
                <div className="mt-2 flex items-center gap-2">
                  <select
                    aria-label={`${DAY_EN[d.dow]} open`}
                    value={d.open}
                    disabled={!editing}
                    onChange={e => patch(d.dow, { open: Number(e.target.value) })}
                    className="flex-1 rounded-lg border border-[#E5DDD3] bg-white px-2 py-2 text-sm text-[#2b2b2b] disabled:opacity-70"
                  >
                    {OPEN_HOURS.map(h => <option key={h} value={h}>{hh(h)}</option>)}
                  </select>
                  <span className="text-xs text-[#8a7460]">→</span>
                  <select
                    aria-label={`${DAY_EN[d.dow]} close`}
                    value={d.close}
                    disabled={!editing}
                    onChange={e => patch(d.dow, { close: Number(e.target.value) })}
                    className="flex-1 rounded-lg border border-[#E5DDD3] bg-white px-2 py-2 text-sm text-[#2b2b2b] disabled:opacity-70"
                  >
                    {CLOSE_HOURS.filter(h => h > d.open).map(h => <option key={h} value={h}>{hh(h)}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-[#E0B4A4] bg-[#FBEFE8] p-3 text-sm text-[#8A3B1C]">{error}</div>
        )}

        <div className="space-y-2">
          <button
            disabled={saving}
            onClick={() => submit(data.has_hours && !editing ? "confirm" : "save")}
            className="w-full rounded-xl bg-[#B85C38] px-5 py-3.5 text-sm font-semibold text-[#FAF6F1] disabled:opacity-60"
          >
            {saving ? "Guardando… / Saving…" : primaryLabel}
          </button>
          {data.has_hours && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="w-full rounded-xl border border-[#E5DDD3] bg-white px-5 py-3 text-sm font-semibold text-[#5a4736]"
            >
              Ajustar horario / Adjust schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
