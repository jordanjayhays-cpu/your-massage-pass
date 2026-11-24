import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trackEvent } from "@/lib/siteVisit";

// "Use AI" on /partner/onboarding (24 Nov, Jordan): the studio pastes its
// website (or its Treatwell, Fresha or Booksy page), partner-autofill reads it
// and returns only what the pages state, and the form fills the empty fields.
// The studio checks everything before going live; nothing is saved here.

const FN = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/partner-autofill";

export type AutofillService = { name: string; duration: number | null; price: number | null; description: string; type: string; category: string };
export type AutofillFields = {
  business_name?: string; address?: string; postal_code?: string; city?: string;
  phone?: string; whatsapp?: string; email?: string; instagram?: string; website?: string;
  description?: string; service_location?: "in_studio" | "mobile" | "both";
  opening_hours?: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", { closed: boolean; open: string; close: string }>;
  services?: AutofillService[]; languages?: string[]; amenities?: string[];
};

export default function OnboardingAiFill({ initialUrl, onFill }: {
  initialUrl: string;
  /** Applies what came back and returns the names of what it actually filled. */
  onFill: (fields: AutofillFields) => string[];
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async () => {
    if (busy) return;
    const raw = url.trim();
    if (!/\.[a-z]{2,}/i.test(raw)) { setMsg({ ok: false, text: t("partner.onboarding.aiBadUrl") }); return; }
    setBusy(true);
    setMsg(null);
    trackEvent("onboarding_ai_fill_start");
    try {
      const res = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: raw }) });
      const j = await res.json().catch(() => ({}));
      if (!j?.ok) {
        const why = String(j?.why || "error");
        setMsg({ ok: false, text: t(why === "bad_url" ? "partner.onboarding.aiBadUrl" : why === "too_many" ? "partner.onboarding.aiTooMany" : "partner.onboarding.aiError") });
        trackEvent("onboarding_ai_fill_fail", { meta: { why } });
        return;
      }
      const filled = onFill(j.fields || {});
      let host = raw;
      try { host = new URL(String(j.sources?.[0] || (/^https?:/i.test(raw) ? raw : `https://${raw}`))).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
      setMsg(filled.length
        ? { ok: true, text: t("partner.onboarding.aiDone", { host, list: filled.join(", ") }) }
        : { ok: false, text: t("partner.onboarding.aiNothing") });
      trackEvent("onboarding_ai_fill_done", { meta: { filled: filled.length } });
    } catch {
      setMsg({ ok: false, text: t("partner.onboarding.aiError") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4 border-0 shadow-sm bg-[#FFF8F3]">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">{t("partner.onboarding.aiTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{t("partner.onboarding.aiHelp")}</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("partner.onboarding.aiPlaceholder")} className="h-11 flex-1" inputMode="url" autoCapitalize="none" autoCorrect="off" />
          <Button type="submit" disabled={busy} className="h-11 px-4 gap-1.5">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? t("partner.onboarding.aiLoading") : t("partner.onboarding.aiButton")}
          </Button>
        </form>
        {msg && <p role="status" className={`text-sm mt-3 ${msg.ok ? "text-foreground" : "text-[#B03A2E]"}`}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}
