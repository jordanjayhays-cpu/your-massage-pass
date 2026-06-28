import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * SOAP clinical note editor + per-client history.
 * Drop this inside the booking detail popup (or a client profile).
 *
 * It saves to the existing `soap_notes` table:
 *   partner_id, booking_id, client_email, client_name,
 *   subjective, objective, assessment, plan, created_at, updated_at
 * RLS already restricts every row to the logged-in studio (auth.uid() = partner_id).
 */

type SoapNote = {
  id: string;
  partner_id: string;
  booking_id: number | null;
  client_email: string | null;
  client_name: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  created_at: string;
  updated_at: string | null;
};

type Props = {
  bookingId?: number | null;
  clientEmail?: string | null;
  clientName?: string | null;
};

const FIELDS: { key: keyof SoapNote; letter: string; label: string; hint: string }[] = [
  { key: "subjective", letter: "S", label: "Subjective", hint: "What the client reports — pain, stress, goals in their words" },
  { key: "objective", letter: "O", label: "Objective", hint: "What you observe — tension, posture, range of motion" },
  { key: "assessment", letter: "A", label: "Assessment", hint: "Your interpretation of the findings" },
  { key: "plan", letter: "P", label: "Plan", hint: "What you did + recommendations / next session" },
];

export default function SoapNoteSection({ bookingId, clientEmail, clientName }: Props) {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [s, setS] = useState("");
  const [o, setO] = useState("");
  const [a, setA] = useState("");
  const [p, setP] = useState("");
  const [history, setHistory] = useState<SoapNote[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false); // collapse the panel by default

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }
      setPartnerId(user.id);

      // Existing note for THIS booking (if any)
      if (bookingId != null) {
        const { data } = await supabase
          .from("soap_notes")
          .select("*")
          .eq("partner_id", user.id)
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && data) {
          const n = data as SoapNote;
          setNoteId(n.id);
          setS(n.subjective ?? "");
          setO(n.objective ?? "");
          setA(n.assessment ?? "");
          setP(n.plan ?? "");
          setUpdatedAt(n.updated_at ?? n.created_at);
        }
      }

      // Past notes for this client (the history)
      if (clientEmail) {
        const { data } = await supabase
          .from("soap_notes")
          .select("*")
          .eq("partner_id", user.id)
          .eq("client_email", clientEmail)
          .order("created_at", { ascending: false });
        if (!cancelled && data) setHistory(data as SoapNote[]);
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookingId, clientEmail]);

  const save = async () => {
    if (!partnerId) { toast.error("Please sign in again."); return; }
    setSaving(true);
    const row = {
      partner_id: partnerId,
      booking_id: bookingId ?? null,
      client_email: clientEmail ?? null,
      client_name: clientName ?? null,
      subjective: s.trim() || null,
      objective: o.trim() || null,
      assessment: a.trim() || null,
      plan: p.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (noteId) {
      ({ error } = await supabase.from("soap_notes").update(row).eq("id", noteId));
    } else {
      const res = await supabase.from("soap_notes").insert(row).select("id").single();
      error = res.error;
      if (res.data) setNoteId((res.data as { id: string }).id);
    }

    setSaving(false);
    if (error) {
      console.error("SOAP save error:", error);
      toast.error("Couldn't save the note. Try again.");
      return;
    }
    setUpdatedAt(new Date().toISOString());
    toast.success("SOAP note saved");
  };

  const prettyDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  // Past notes excluding the one we're currently editing
  const pastNotes = history.filter((n) => n.id !== noteId);

  return (
    <div className="border-t border-border pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          📋 SOAP note{updatedAt ? " · saved" : ""}
        </span>
        <span className="text-xs text-primary font-semibold">{open ? "Hide" : noteId ? "View / edit" : "Add note"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <>
              {FIELDS.map((f) => {
                const val = f.key === "subjective" ? s : f.key === "objective" ? o : f.key === "assessment" ? a : p;
                const setter = f.key === "subjective" ? setS : f.key === "objective" ? setO : f.key === "assessment" ? setA : setP;
                return (
                  <div key={f.key}>
                    <label className="flex items-baseline gap-2 mb-1">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                        {f.letter}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{f.label}</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground mb-1.5 ml-7">{f.hint}</p>
                    <textarea
                      value={val}
                      onChange={(e) => setter(e.target.value)}
                      rows={2}
                      placeholder={`${f.label}…`}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                    />
                  </div>
                );
              })}

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  {updatedAt ? `Last saved ${prettyDate(updatedAt)}` : "Private — only your studio can see this."}
                </p>
                <button
                  onClick={save}
                  disabled={saving}
                  className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? "Saving…" : noteId ? "Update note" : "Save note"}
                </button>
              </div>

              {pastNotes.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Previous notes for {clientName || "this client"}
                  </p>
                  {pastNotes.map((n) => (
                    <div key={n.id} className="rounded-xl bg-secondary/60 border border-border/60 p-3">
                      <p className="text-[11px] text-muted-foreground mb-1.5">{prettyDate(n.created_at)}</p>
                      <div className="space-y-1 text-xs text-foreground/85">
                        {n.subjective && <p><span className="font-semibold text-primary">S</span> {n.subjective}</p>}
                        {n.objective && <p><span className="font-semibold text-primary">O</span> {n.objective}</p>}
                        {n.assessment && <p><span className="font-semibold text-primary">A</span> {n.assessment}</p>}
                        {n.plan && <p><span className="font-semibold text-primary">P</span> {n.plan}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/80 leading-snug">
                Clinical notes for your records. Keep them factual and professional.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
