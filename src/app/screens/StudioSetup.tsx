import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Loader2, MapPin, Phone, Globe, Plus, Trash2,
  Sparkles, ChevronRight, ChevronLeft, Euro, CheckCircle2, ArrowLeft,
  Calendar as CalendarIcon, Check,
} from "lucide-react";
import PartnerLangPills from "@/app/components/PartnerLangPills";
import { defaultPartnerLang, applyPartnerLang, type PartnerLang } from "@/app/lib/partnerLanguage";

const MASSAGE_TYPES = ["Relax", "Therapeutic", "Swedish", "Deep Tissue", "Sports", "Thai", "Balinese", "Ayurvedic", "Lomi Lomi", "Hot Stone", "Aromatherapy", "Reflexology", "Shiatsu", "Kobido", "Craneo-Facial", "Lymphatic", "Prenatal", "Couples", "4 Hands", "Express", "Ritual", "Hammam", "Body", "Physiotherapy", "Facial", "Spa Day", "Other"];
const DAYS = [
  { num: 1, label: "Mon" }, { num: 2, label: "Tue" }, { num: 3, label: "Wed" },
  { num: 4, label: "Thu" }, { num: 5, label: "Fri" }, { num: 6, label: "Sat" }, { num: 0, label: "Sun" },
];
const DEFAULT_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

// Selectable opening times: 07:00 → 23:00, plus 00:00 treated as end-of-day close.
const HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
const FROM_OPTIONS = HOUR_OPTIONS;
const TO_OPTIONS = [...HOUR_OPTIONS.slice(1), "00:00"];

type DayRange = { open: boolean; from: string; to: string };
const DEFAULT_RANGE: DayRange = { open: true, from: "10:00", to: "21:00" };

const hourToNum = (t: string) => {
  const h = Number(t.split(":")[0]);
  return h === 0 ? 24 : h;
};

/** Expand an open range into hourly slot strings (close hour excluded). */
function rangeToSlots(r: DayRange): string[] {
  if (!r.open) return [];
  const start = hourToNum(r.from);
  const end = hourToNum(r.to);
  const out: string[] = [];
  for (let h = start; h < end; h++) out.push(`${String(h % 24).padStart(2, "0")}:00`);
  return out;
}

type Service = { name: string; type: string; duration: number; price: number; description: string };

const emptyService = (): Service => ({ name: "", type: "Swedish", duration: 60, price: 45, description: "" });

function normalizeService(raw: any): Service {
  return {
    name: raw?.name ?? raw?.title ?? "",
    type: raw?.type ?? "Swedish",
    duration: Number(raw?.duration ?? raw?.duration_minutes ?? 60),
    price: Number(raw?.price ?? raw?.price_eur ?? 45),
    description: raw?.description ?? "",
  };
}

function Stepper({ value, onChange, min = 1, max = 10, size = "lg" }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: "lg" | "sm" }) {
  const big = size === "lg";
  const btn = `${big ? "h-12 w-12 text-xl" : "h-9 w-9 text-base"} rounded-xl border-2 border-[#E5DDD3] bg-white font-bold text-[#B85C38] disabled:opacity-40 hover:border-[#B85C38] transition flex items-center justify-center`;
  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label="-" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>−</button>
      <span className={`${big ? "text-2xl w-10" : "text-lg w-8"} text-center font-bold text-[#2b2b2b] tabular-nums`}>{value}</span>
      <button type="button" aria-label="+" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>+</button>
    </div>
  );
}


function StaffChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const num = value.trim() === "" ? null : Number(value);
  const isSixPlus = num !== null && num >= 6;
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5].map(n => {
        const selected = num === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(selected ? "" : String(n))}
            className={`h-11 min-w-[44px] px-4 rounded-xl border-2 font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#B85C38]/40 ${
              selected
                ? "bg-[#B85C38] border-[#B85C38] text-white"
                : "bg-white border-[#E5DDD3] text-[#2b2b2b] hover:border-[#B85C38]"
            }`}
          >
            {n}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange(isSixPlus ? "" : "6")}
        className={`h-11 min-w-[44px] px-4 rounded-xl border-2 font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#B85C38]/40 ${
          isSixPlus
            ? "bg-[#B85C38] border-[#B85C38] text-white"
            : "bg-white border-[#E5DDD3] text-[#2b2b2b] hover:border-[#B85C38]"
        }`}
      >
        {t("app.studioHours.chip6Plus")}
      </button>
      {isSixPlus && (
        <input
          type="number"
          min={6}
          max={99}
          value={num}
          onChange={e => onChange(String(Math.max(6, Math.min(99, Number(e.target.value) || 6))))}
          className="h-11 w-20 px-2 rounded-xl border-2 border-[#B85C38] bg-white text-center font-semibold text-[#2b2b2b] focus:outline-none focus:ring-2 focus:ring-[#B85C38]/40"
        />
      )}
    </div>
  );
}

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];
const selectCls = "text-sm px-3 py-2 bg-white border border-[#E5DDD3] rounded-lg focus:outline-none text-[#2b2b2b] w-full";

function ServiceTypeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(() => !!value && !MASSAGE_TYPES.includes(value));
  if (custom) {
    return (
      <div className="flex items-center gap-1 bg-white border border-[#E5DDD3] rounded-lg px-2">
        <input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={t("partner.studioSetup.customTypePlaceholder")}
          className="w-full py-2 text-sm focus:outline-none text-[#2b2b2b] bg-transparent"
        />
        <button type="button" title={t("partner.studioSetup.useListAgain")} onClick={() => { setCustom(false); onChange("Swedish"); }} className="text-[#7A7068] hover:text-[#B85C38] px-1">×</button>
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={e => { if (e.target.value === "__custom__") { setCustom(true); onChange(""); } else onChange(e.target.value); }}
      className={selectCls}
    >
      {MASSAGE_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
      <option value="__custom__">{t("partner.studioSetup.customTypeOption")}</option>
    </select>
  );
}

function ServiceDurationField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(() => !DURATION_OPTIONS.includes(value));
  if (custom) {
    return (
      <div className="flex items-center gap-1 bg-white border border-[#E5DDD3] rounded-lg px-2 col-span-2">
        <input
          autoFocus
          type="number"
          min={10}
          max={240}
          step={5}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          placeholder={t("partner.studioSetup.customDurationPlaceholder")}
          className="w-full py-2 text-sm focus:outline-none text-[#2b2b2b] bg-transparent"
        />
        <span className="text-xs text-[#7A7068]">min</span>
        <button type="button" title={t("partner.studioSetup.useListAgain")} onClick={() => { setCustom(false); onChange(60); }} className="text-[#7A7068] hover:text-[#B85C38] px-1">×</button>
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={e => { if (e.target.value === "__custom__") { setCustom(true); } else onChange(Number(e.target.value)); }}
      className={`${selectCls} col-span-2`}
    >
      {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
      <option value="__custom__">{t("partner.studioSetup.customDurationOption")}</option>
    </select>
  );
}


function StudioSetupInner() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const draftToken = searchParams.get("draft");
  const claimToken = searchParams.get("claim");
  const mode: "invite" | "draft" | "claim" = claimToken ? "claim" : draftToken ? "draft" : "invite";

  const [step, setStep] = useState(1);
  const [lang, setLang] = useState<PartnerLang>(() => {
    const resolved = i18n.resolvedLanguage;
    return resolved === "es" || resolved === "en" ? resolved : defaultPartnerLang();
  });
  const TOTAL_STEPS = mode === "claim" ? 6 : 5;
  const DONE_STEP = TOTAL_STEPS;

  // Password creation (claim mode)
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwDone, setPwDone] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");

  const handleCreatePassword = async () => {
    setPwError("");
    if (newPassword.length < 8) { setPwError(t("partner.studioSetup.pwErrorMinLength")); return; }
    if (newPassword !== newPassword2) { setPwError(t("partner.studioSetup.pwErrorMismatch")); return; }
    setPwSaving(true);
    const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (pwErr) { setPwError(pwErr.message); return; }
    const { data: { user } } = await supabase.auth.getUser();
    setAccountEmail(user?.email ?? "");
    setPwDone(true);
    toast.success(t("partner.studioSetup.pwSavedToast"));
  };

  // Source data (invite, draft, or scraped partner)
  const [sourceData, setSourceData] = useState<any>(null);
  const [sourceError, setSourceError] = useState("");
  const [validatingSource, setValidatingSource] = useState(true);

  // Step 1: Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  // Step 2: Profile
  const [studio, setStudio] = useState({ business_name: "", address: "", phone: "", website: "", description: "", city: "Madrid", access_instructions: "" });
  const [profileLoading, setProfileLoading] = useState(false);

  // Step 3: Services
  const [services, setServices] = useState<Service[]>([emptyService()]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Step 4: Availability (invite mode only)
  const [hours, setHours] = useState<Record<number, DayRange>>({
    1: { ...DEFAULT_RANGE }, 2: { ...DEFAULT_RANGE }, 3: { ...DEFAULT_RANGE }, 4: { ...DEFAULT_RANGE },
    5: { ...DEFAULT_RANGE }, 6: { ...DEFAULT_RANGE }, 0: { open: false, from: "10:00", to: "21:00" },
  });
  const availability: Record<number, string[]> = Object.fromEntries(
    DAYS.map(d => [d.num, rangeToSlots(hours[d.num])])
  ) as Record<number, string[]>;
  const [capacity, setCapacity] = useState<number>(1);
  const [staffCount, setStaffCount] = useState<string>("");
  // Optional per-day capacity overrides (day_of_week -> capacity)
  const [showDayCapacity, setShowDayCapacity] = useState(false);
  const [dayCapacity, setDayCapacity] = useState<Record<number, number>>({});
  const dayCapFor = (day: number) => dayCapacity[day] ?? capacity;


  // Step 4: Calendar (draft/claim mode)
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [showManualAvailability, setShowManualAvailability] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  // Validate token/draft/claim on mount
  useEffect(() => {
    if (mode === "claim") {
      if (!claimToken) { setSourceError(t("partner.studioSetup.claimNoTokenError")); setValidatingSource(false); return; }
      (async () => {
        const { data: partner, error } = await supabase
          .from("partners")
          .select("*")
          .eq("claim_token", claimToken)
          .eq("status", "pending")
          .maybeSingle();
        if (error || !partner) {
          setSourceError(t("partner.studioSetup.claimInvalidError"));
          setValidatingSource(false);
          return;
        }
        const { data: svcs } = await supabase
          .from("partner_services")
          .select("*")
          .eq("partner_id", partner.id);

        setSourceData(partner);
        setEmail(partner.email || "");
        setStudio({
          business_name: partner.business_name || "",
          address: partner.address || "",
          phone: partner.phone || "",
          website: partner.website || "",
          description: partner.description || "",
          city: partner.city || "Madrid",
          access_instructions: partner.access_instructions || "",
        });
        setServices((svcs && svcs.length) ? svcs.map(normalizeService) : [emptyService()]);

        // If the studio owner already returned from Google sign-in, skip step 1.
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setPartnerId(user.id);
          setEmail(user.email || partner.email || "");
          setStep(2);
        }
        setValidatingSource(false);
      })();
      return;
    }

    if (mode === "draft") {
      if (!draftToken) { setSourceError(t("partner.studioSetup.draftNoTokenError")); setValidatingSource(false); return; }
      supabase
        .from("studio_drafts")
        .select("*")
        .eq("claim_token", draftToken)
        .neq("status", "claimed")
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) { setSourceError(t("partner.studioSetup.draftInvalidError")); }
          else {
            setSourceData(data);
            setEmail(data.email || "");
            setStudio({
              business_name: data.business_name || "",
              address: data.address || "",
              phone: data.phone || "",
              website: data.website || "",
              description: data.description || "",
              city: data.neighborhood || "Madrid",
              access_instructions: data.access_instructions || "",
            });
            const svcs = Array.isArray(data.services) ? data.services : [];
            setServices(svcs.length ? svcs.map(normalizeService) : [emptyService()]);
          }
          setValidatingSource(false);
        });
      return;
    }

    if (!token) { setSourceError(t("partner.studioSetup.inviteNoTokenError")); setValidatingSource(false); return; }
    supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setSourceError(t("partner.studioSetup.inviteInvalidError")); }
        else {
          setSourceData(data);
          setEmail(data.email || "");
          setStudio(prev => ({ ...prev, business_name: data.studio_name || "" }));
        }
        setValidatingSource(false);
      });
  }, [token, draftToken, claimToken, mode]);

  // Detect return from Google Calendar OAuth
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setCalendarConnected(true);
      setStep(5);
      toast.success(t("partner.studioSetup.calendarConnectedToast"));
    }
    if (searchParams.get("cal_error")) {
      toast.error(t("partner.studioSetup.calendarErrorToast"));
    }
  }, [searchParams]);

  const progress = (step / TOTAL_STEPS) * 100;
  const headerName = mode === "claim"
    ? sourceData?.business_name
    : mode === "draft" ? sourceData?.business_name : sourceData?.studio_name;

  // Step 1 (claim): sign in with Google — comes back to this same claim URL.
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const redirectTo = `${window.location.origin}/studio-setup?claim=${claimToken}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(error.message || t("partner.studioSetup.googleSignInFailed"));
    }
  };

  // Step 1 (claim): send magic-link email — link brings user back to this same claim URL.
  const handleMagicLink = async () => {
    if (!email) { toast.error(t("partner.studioSetup.enterEmailFirst")); return; }
    setMagicLoading(true);
    const emailRedirectTo = `${window.location.origin}/studio-setup?claim=${claimToken}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    setMagicLoading(false);
    if (error) {
      toast.error(error.message || t("partner.studioSetup.magicLinkFailed"));
      return;
    }
    setMagicSent(true);
    toast.success(t("partner.studioSetup.magicLinkSentToast"));
  };

  const handleCreateAccount = async () => {
    if (!password || password !== confirmPassword) { toast.error(t("partner.studioSetup.passwordsDontMatch")); return; }
    if (password.length < 8) { toast.error(t("partner.studioSetup.passwordMinLength")); return; }
    if (!email) { toast.error(t("partner.studioSetup.emailRequired")); return; }
    setAccountLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { business_name: studio.business_name || headerName } }
      });
      if (error) throw error;
      if (!data.user) throw new Error("No user returned");

      if (mode === "invite" && token) {
        await supabase.from("invites").update({ used: true }).eq("token", token);
      }

      setPartnerId(data.user.id);
      toast.success(t("partner.studioSetup.accountCreatedToast"));
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || t("partner.studioSetup.accountCreateFailed"));
    } finally {
      setAccountLoading(false);
    }
  };

  // Step 2: Save profile
  const handleSaveProfile = async () => {
    if (!studio.business_name.trim()) { toast.error(t("partner.studioSetup.studioNameRequired")); return; }
    setProfileLoading(true);
    try {
      await supabase.from("partners").upsert({
        id: partnerId || (await supabase.auth.getUser()).data.user?.id,
        business_name: studio.business_name,
        email,
        address: studio.address,
        access_instructions: studio.access_instructions,
        phone: studio.phone,
        website: studio.website,
        description: studio.description,
        city: studio.city,
        status: "active",
        preferred_language: lang,
      });
      toast.success(t("partner.studioSetup.profileSavedToast"));
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || t("partner.studioSetup.profileSaveFailed"));
    } finally {
      setProfileLoading(false);
    }
  };

  // Step 3: Save services
  const handleSaveServices = async () => {
    const validServices = services.filter(s => s.name.trim());
    if (validServices.length === 0) { toast.error(t("partner.studioSetup.addAtLeastOneService")); return; }
    setServicesLoading(true);
    try {
      const uid = partnerId || (await supabase.auth.getUser()).data.user?.id;
      await supabase.from("partner_services").delete().eq("partner_id", uid);
      await supabase.from("partner_services").insert(
        validServices.map(s => ({ partner_id: uid, name: s.name, type: s.type, duration: s.duration, price: s.price, description: s.description }))
      );

      // In draft mode, mark the draft as claimed now that partner + services exist.
      if (mode === "draft" && sourceData?.id) {
        await supabase.from("studio_drafts").update({ status: "claimed" }).eq("id", sourceData.id);
      }

      // In claim mode, the original pre-built partner row is keyed to the scraped uuid,
      // not the owner's auth uid, so the studio's own login can't delete it via RLS.
      // Call the SECURITY DEFINER RPC to remove that still-pending row (and its
      // services/availability) so the studio doesn't appear twice in the customer app.
      if (mode === "claim" && claimToken) {
        await supabase.rpc("claim_release_prebuilt", { p_claim_token: claimToken });
      }

      toast.success(t("partner.studioSetup.servicesSavedToast"));
      setStep(4);
    } catch (err: any) {
      toast.error(err.message || t("partner.studioSetup.servicesSaveFailed"));
    } finally {
      setServicesLoading(false);
    }
  };

  // Step 4 (invite): Save availability
  const handleSaveAvailability = async () => {
    try {
      const uid = partnerId || (await supabase.auth.getUser()).data.user?.id;
      await supabase.from("partner_availability").delete().eq("partner_id", uid);
      const rows = DAYS.flatMap(day =>
        (availability[day.num] || []).map(slot => ({ partner_id: uid, day_of_week: day.num, time_slot: slot }))
      );
      if (rows.length > 0) await supabase.from("partner_availability").insert(rows);
      await supabase.from("partners").update({ capacity: Math.max(1, Number(capacity) || 1), staff_count: staffCount.trim() === "" ? null : Math.max(1, Number(staffCount) || 1), preferred_language: lang }).eq("id", uid);
      toast.success(t("partner.studioSetup.availabilitySavedToast"));
      setStep(5);
    } catch (err: any) {
      toast.error(err.message || t("partner.studioSetup.availabilitySaveFailed"));
    }
  };

  // Step 4 (draft/claim): Save availability manually (Google Calendar alternative)
  const handleSaveManualAvailability = async () => {
    setManualSaving(true);
    try {
      const uid = partnerId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) { toast.error(t("partner.studioSetup.completePreviousSteps")); return; }
      await supabase.from("partner_availability").delete().eq("partner_id", uid);
      const rows = DAYS.flatMap(day =>
        (availability[day.num] || []).map(slot => ({ partner_id: uid, day_of_week: day.num, time_slot: slot }))
      );
      if (rows.length > 0) await supabase.from("partner_availability").insert(rows);
      await supabase.from("partners").update({ auto_confirm_bookings: false, capacity: Math.max(1, Number(capacity) || 1), staff_count: staffCount.trim() === "" ? null : Math.max(1, Number(staffCount) || 1), preferred_language: lang }).eq("id", uid);
      toast.success(t("partner.studioSetup.availabilitySavedToast"));
      setStep(5);
    } catch (err: any) {
      toast.error(err.message || t("partner.studioSetup.availabilitySaveFailed"));
    } finally {
      setManualSaving(false);
    }
  };

  // Step 4 (draft): Connect Google Calendar
  const handleConnectCalendar = async () => {
    const uid = partnerId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) { toast.error(t("partner.studioSetup.completePreviousSteps")); return; }

    const clientId =
      (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
      "550114079110-p1asbhmkpiv3q4l0oa8uvsh4osou4994.apps.googleusercontent.com";

    const redirectUri = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/google-calendar-oauth?apikey=sb_publishable_oxG5Zjo1ERmCl57_zhJ-dw_aI7jf7ky";

    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" ");

    const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("scope", scopes);
    oauthUrl.searchParams.set("access_type", "offline");
    oauthUrl.searchParams.set("prompt", "consent");
    oauthUrl.searchParams.set("state", uid);

    window.location.href = oauthUrl.toString();
  };

  const addService = () => setServices([...services, emptyService()]);
  const removeService = (i: number) => setServices(services.filter((_, idx) => idx !== i));
  const updateService = (i: number, field: keyof Service, value: any) => {
    const updated = [...services]; updated[i] = { ...updated[i], [field]: value }; setServices(updated);
  };
  const setDayRange = (day: number, patch: Partial<DayRange>) => {
    setHours(prev => {
      const next = { ...prev[day], ...patch };
      if (hourToNum(next.to) <= hourToNum(next.from)) {
        const idx = TO_OPTIONS.findIndex(t => hourToNum(t) > hourToNum(next.from));
        next.to = TO_OPTIONS[idx >= 0 ? idx : TO_OPTIONS.length - 1];
      }
      return { ...prev, [day]: next };
    });
  };
  const toggleDay = (day: number) => setDayRange(day, { open: !hours[day].open });
  const copySchedule = (day: number, weekdaysOnly: boolean) => {
    const src = hours[day];
    setHours(prev => {
      const next = { ...prev };
      for (const d of DAYS) {
        if (weekdaysOnly && (d.num === 0 || d.num === 6)) next[d.num] = { ...prev[d.num], open: false };
        else next[d.num] = { ...src };
      }
      return next;
    });
    toast.success(t("app.studioHours.copied"));
  };

  const renderHoursEditor = () => (
    <div className="space-y-3">
      <p className="text-sm text-[#7A7068]">{t("app.studioHours.helper")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copySchedule(1, false)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FAF6F1] border border-[#B85C38] text-[#B85C38] hover:bg-[#F3E9DF]">
          {t("app.studioHours.copyAll")}
        </button>
        <button type="button" onClick={() => copySchedule(1, true)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#E5DDD3] text-[#7A7068] hover:bg-[#FAF6F1]">
          {t("app.studioHours.copyWeekdays")}
        </button>
      </div>
      {DAYS.map(day => {
        const r = hours[day.num];
        const count = availability[day.num].length;
        return (
          <div key={day.num} className="rounded-xl border border-[#E5DDD3] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#2b2b2b] w-12">{day.label}</span>
              <button type="button" onClick={() => toggleDay(day.num)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${r.open ? "bg-[#B85C38] text-white" : "bg-[#ECE4D7] text-[#7A7068]"}`}>
                {r.open ? t("app.studioHours.open") : t("app.studioHours.closed")}
              </button>
              {r.open ? (
                <div className="flex items-center gap-1.5 ml-auto">
                  <select
                    aria-label={`${day.label} ${t("app.studioHours.from")}`}
                    value={r.from}
                    onChange={e => setDayRange(day.num, { from: e.target.value })}
                    className="h-9 px-2 rounded-lg border border-[#E5DDD3] bg-white text-sm text-[#2b2b2b] focus:outline-none focus:border-[#B85C38]"
                  >
                    {FROM_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="text-xs text-[#7A7068]">–</span>
                  <select
                    aria-label={`${day.label} ${t("app.studioHours.to")}`}
                    value={r.to}
                    onChange={e => setDayRange(day.num, { to: e.target.value })}
                    className="h-9 px-2 rounded-lg border border-[#E5DDD3] bg-white text-sm text-[#2b2b2b] focus:outline-none focus:border-[#B85C38]"
                  >
                    {TO_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ) : (
                <span className="ml-auto text-xs text-[#7A7068]">{t("app.studioHours.closed")}</span>
              )}
            </div>
            {r.open && (
              <p className="mt-1.5 text-xs text-[#7A7068]">{r.from}–{r.to} · {t("app.studioHours.slots", { count })}</p>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderStaffCount = () => (
    <div className="rounded-xl border border-[#E5DDD3] bg-[#FAF6F1] p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-[#2b2b2b]">{t("app.studioHours.staffTitle")}</p>
        <p className="text-xs text-[#7A7068]">{t("app.studioHours.staffHelp")} · {t("app.studioHours.staffOptional")}</p>
      </div>
      <StaffChips value={staffCount} onChange={setStaffCount} />
    </div>
  );

  if (validatingSource) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B85C38]" />
      </div>
    );
  }

  if (sourceError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF6F1]">
        <Card className="w-full max-w-md bg-white border border-[#E5DDD3] rounded-2xl shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="font-display text-xl font-bold mb-2">{t("partner.studioSetup.invalidLinkTitle")}</h2>
            <p className="text-[#7A7068] text-sm">{sourceError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepLabels = mode === "claim"
    ? [t("partner.studioSetup.stepLabelSignIn"), t("partner.studioSetup.stepLabelReview"), t("partner.studioSetup.stepLabelServices"), t("partner.studioSetup.stepLabelCalendar"), t("partner.studioSetup.stepLabelPassword"), t("partner.studioSetup.stepLabelLive")]
    : mode === "draft"
      ? [t("partner.studioSetup.stepLabelSignIn"), t("partner.studioSetup.stepLabelReview"), t("partner.studioSetup.stepLabelServices"), t("partner.studioSetup.stepLabelCalendar"), t("partner.studioSetup.stepLabelLive")]
      : [t("partner.studioSetup.stepLabelAccount"), t("partner.studioSetup.stepLabelProfile"), t("partner.studioSetup.stepLabelServices"), t("partner.studioSetup.stepLabelHours"), t("partner.studioSetup.stepLabelDone")];

  const isReviewMode = mode === "draft" || mode === "claim";

  return (
    <div className="min-h-screen bg-[#FAF6F1]">
      <div className="max-w-xl mx-auto px-4 py-8">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
          className="inline-flex items-center gap-1.5 text-sm text-[#5a4736] hover:text-[#B85C38] transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> {t("partner.studioSetup.backButton")}
        </button>

        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 bg-[#B85C38] text-[#FAF6F1] px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            {isReviewMode ? (
              <img src="/brand/mc-avatar-cream.png" alt="Massage Club" className="h-6 w-6 rounded-full object-cover -ml-1" />
            ) : (
              <Sparkles size={14} />
            )}
            {isReviewMode ? t("partner.studioSetup.claimBadgeLabel") : t("partner.studioSetup.setupBadgeLabel")}
          </div>
          {isReviewMode ? (
            <>
              <h1 className="font-display text-3xl font-bold text-[#2b2b2b]">{t("partner.studioSetup.claimHeading")}</h1>
              <p className="text-[#7A7068] text-sm mt-1">
                {t("partner.studioSetup.claimSubheading", { businessName: headerName })}
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold text-[#2b2b2b]">{t("partner.studioSetup.welcomeHeading", { businessName: headerName })}</h1>
              <p className="text-[#7A7068] text-sm mt-1">{t("partner.studioSetup.welcomeSubheading")}</p>
            </>
          )}
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-[#9E9387]">{t("partner.studioSetup.stepOf", { current: step, total: TOTAL_STEPS })}</span>
            <span className="text-xs font-medium text-[#B85C38]">{t("partner.studioSetup.percentComplete", { percent: Math.round(progress) })}</span>
          </div>
          <div className="h-2 bg-[#ECE4D7] rounded-full overflow-hidden">
            <div className="h-full bg-[#B85C38] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {stepLabels.map((label, i) => (
              <span key={label} className={`text-xs ${i + 1 === step ? "text-[#B85C38] font-semibold" : "text-[#9E9387]"}`}>{label}</span>
            ))}
          </div>
        </div>

        {/* STEP 1: LANGUAGE CHOOSER */}
        {step === 1 && (
          <div className="mb-4 rounded-2xl border border-[#E5DDD3] bg-[#FAF7F2] p-4">
            <label className="text-xs font-medium text-[#7A7068] mb-2 block">{t("partner.studioSetup.langChooserLabel")}</label>
            <PartnerLangPills value={lang} onChange={(l) => { setLang(l); applyPartnerLang(l); }} />
          </div>
        )}

        {/* STEP 1: ACCOUNT */}
        {step === 1 && mode === "claim" && (
          <Card className="bg-white border border-[#E5DDD3] shadow-[0_4px_20px_rgba(184,92,56,0.06)] rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#B85C38] text-white flex items-center justify-center text-sm font-bold">1</div>
                <h2 className="font-display text-lg font-semibold text-[#2b2b2b]">{t("partner.studioSetup.step1ClaimTitle")}</h2>
              </div>
              <p className="text-sm text-[#7A7068] mb-4">
                {t("partner.studioSetup.step1ClaimDesc", { businessName: headerName })}
              </p>
              <Button onClick={handleGoogleSignIn} disabled={googleLoading} className="w-full h-12 bg-white text-[#2b2b2b] border border-[#E5DDD3] hover:bg-[#FAF6F1]">
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {t("partner.studioSetup.continueWithGoogle")}
                  </>
                )}
              </Button>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-[#E5DDD3] flex-1" />
                <span className="text-xs text-[#7A7068]">{t("partner.studioSetup.orDivider")}</span>
                <div className="h-px bg-[#E5DDD3] flex-1" />
              </div>

              {magicSent ? (
                <div className="rounded-xl border border-[#E5DDD3] bg-[#FAF6F1] p-4 text-center">
                  <p className="text-sm font-medium text-[#2b2b2b]">{t("partner.studioSetup.checkEmailTitle")}</p>
                  <p className="text-xs text-[#7A7068] mt-1">{t("partner.studioSetup.checkEmailDesc", { email })}</p>
                </div>
              ) : (
                <>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t("partner.studioSetup.emailPlaceholder")}
                    className="h-11 mb-2"
                  />
                  <Button
                    onClick={handleMagicLink}
                    disabled={magicLoading}
                    variant="outline"
                    className="w-full h-11"
                  >
                    {magicLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("partner.studioSetup.continueWithEmail")}
                  </Button>
                </>
              )}

              <p className="text-xs text-center text-[#7A7068] mt-3">
                {t("partner.studioSetup.backAfterSignIn")}
              </p>

            </CardContent>
          </Card>
        )}

        {step === 1 && mode !== "claim" && (
          <Card className="bg-white border border-[#E5DDD3] shadow-[0_4px_20px_rgba(184,92,56,0.06)] rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#B85C38] text-white flex items-center justify-center text-sm font-bold">1</div>
                <h2 className="font-display text-lg font-semibold text-[#2b2b2b]">{t("partner.studioSetup.step1CreateAccountTitle")}</h2>
              </div>
              <p className="text-sm text-[#7A7068] mb-4">
                {mode === "draft" && !sourceData?.email
                  ? t("partner.studioSetup.step1DraftEmailDesc")
                  : t("partner.studioSetup.step1InvitePrefilledDesc")}
              </p>
              <div className="space-y-3">
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={mode === "invite" || !!sourceData?.email}
                  placeholder={t("partner.studioSetup.emailPlaceholder")}
                  className={mode === "invite" || !!sourceData?.email ? "h-11 bg-[#FAF6F1] border-[#E5DDD3] text-[#2b2b2b]" : "h-11 bg-white border-[#E5DDD3] text-[#2b2b2b] focus:border-[#B85C38]"}
                />
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("partner.studioSetup.passwordPlaceholder")} className="h-11" />
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t("partner.studioSetup.confirmPasswordPlaceholder")} className="h-11" />
              </div>
              <Button onClick={handleCreateAccount} disabled={accountLoading} className="w-full mt-4 h-11 bg-[#B85C38] hover:bg-[#9E4D22] text-white">
                {accountLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("partner.studioSetup.creatingAccount")}</> : <>{t("partner.studioSetup.continueButton")} <ChevronRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: PROFILE */}
        {step === 2 && (
          <Card className="bg-white border border-[#E5DDD3] shadow-[0_4px_20px_rgba(184,92,56,0.06)] rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#B85C38] text-white flex items-center justify-center text-sm font-bold">2</div>
                <h2 className="font-display text-lg font-semibold text-[#2b2b2b]">{isReviewMode ? t("partner.studioSetup.step2ReviewTitle") : t("partner.studioSetup.step2Title")}</h2>
              </div>
              {isReviewMode && (
                <p className="text-xs text-[#7A7068] -mt-2">{t("partner.studioSetup.step2ReviewHelper")}</p>
              )}
              <div>
                <label className="text-xs font-medium text-[#7A7068] mb-1 block">{t("partner.studioSetup.studioNameLabel")}</label>
                <Input value={studio.business_name} onChange={e => setStudio(p => ({ ...p, business_name: e.target.value }))} className="h-11" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#7A7068] mb-1 block">{t("partner.studioSetup.addressLabel")}</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7068]" />
                  <Input value={studio.address} onChange={e => setStudio(p => ({ ...p, address: e.target.value }))} placeholder={t("partner.studioSetup.addressPlaceholder")} className="pl-9 h-11" />
                </div>
                <p className="text-[11px] text-[#7A7068] mt-1.5">{t("partner.studioSetup.addressHelper")}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-[#7A7068] mb-1 block">{t("partner.studioSetup.accessInstructionsLabel")}</label>
                <textarea value={studio.access_instructions} onChange={e => setStudio(p => ({ ...p, access_instructions: e.target.value }))} placeholder={t("partner.studioSetup.accessInstructionsPlaceholder")} rows={3} className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD3] rounded-xl focus:outline-none focus:border-[#B85C38] focus:ring-2 focus:ring-[#B85C38]/15 resize-none text-[#2b2b2b]" />
                <p className="text-[11px] text-[#7A7068] mt-1.5">{t("partner.studioSetup.accessInstructionsHelper")}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-[#7A7068] mb-1 block">{t("partner.studioSetup.phoneLabel")}</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7068]" />
                  <Input value={studio.phone} onChange={e => setStudio(p => ({ ...p, phone: e.target.value }))} placeholder={t("partner.studioSetup.phonePlaceholder")} className="pl-9 h-11" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#7A7068] mb-1 block">{t("partner.studioSetup.websiteLabel")}</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7068]" />
                  <Input value={studio.website} onChange={e => setStudio(p => ({ ...p, website: e.target.value }))} placeholder={t("partner.studioSetup.websitePlaceholder")} className="pl-9 h-11" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#7A7068] mb-1 block">{t("partner.studioSetup.descriptionLabel")}</label>
                <textarea value={studio.description} onChange={e => setStudio(p => ({ ...p, description: e.target.value }))} placeholder={t("partner.studioSetup.descriptionPlaceholder")} rows={3} className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD3] rounded-xl focus:outline-none focus:border-[#B85C38] focus:ring-2 focus:ring-[#B85C38]/15 resize-none text-[#2b2b2b]" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> {t("partner.studioSetup.backButton")}</Button>
                <Button onClick={handleSaveProfile} disabled={profileLoading} className="flex-1 h-11 bg-[#B85C38] hover:bg-[#9E4D22] text-white">
                  {profileLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("partner.studioSetup.savingButton")}</> : <>{t("partner.studioSetup.nextButton")} <ChevronRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: SERVICES */}
        {step === 3 && (
          <Card className="bg-white border border-[#E5DDD3] shadow-[0_4px_20px_rgba(184,92,56,0.06)] rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#B85C38] text-white flex items-center justify-center text-sm font-bold">3</div>
                <h2 className="font-display text-lg font-semibold text-[#2b2b2b]">{isReviewMode ? t("partner.studioSetup.step3ReviewTitle") : t("partner.studioSetup.step3Title")}</h2>
              </div>
              {isReviewMode && (
                <p className="text-xs text-[#7A7068] -mt-2">{t("partner.studioSetup.step3ReviewHelper")}</p>
              )}
              <div className="space-y-3">
                {services.map((svc, i) => (
                  <div key={i} className="p-3 border border-[#E5DDD3] rounded-xl bg-[#FAF6F1]">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-[#7A7068]">{t("partner.studioSetup.serviceLabel", { index: i + 1 })}</span>
                      {services.length > 1 && <button onClick={() => removeService(i)} className="text-[#7A7068] hover:text-red-500"><Trash2 size={14} /></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={svc.name} onChange={e => updateService(i, "name", e.target.value)} placeholder={t("partner.studioSetup.servicePlaceholder")} className="col-span-2 text-sm px-3 py-2 bg-white border border-[#E5DDD3] rounded-lg focus:outline-none focus:border-[#B85C38] text-[#2b2b2b]" />
                      <ServiceTypeField value={svc.type} onChange={v => updateService(i, "type", v)} />
                      <div className="flex items-center gap-1 bg-white border border-[#E5DDD3] rounded-lg px-2">
                        <Euro size={13} className="text-[#7A7068]" />
                        <input value={svc.price} onChange={e => updateService(i, "price", Number(e.target.value))} type="number" min={0} className="w-full py-2 text-sm focus:outline-none" />
                      </div>
                      <ServiceDurationField value={svc.duration} onChange={v => updateService(i, "duration", v)} />
                    </div>
                  </div>
                ))}
              </div>
              {services.length < 8 && (
                <button onClick={addService} className="w-full py-2.5 border-2 border-dashed border-[#E5DDD3] rounded-xl text-sm text-[#7A7068] hover:border-[#B85C38] hover:text-[#B85C38] transition flex items-center justify-center gap-1">
                  <Plus size={14} /> {t("partner.studioSetup.addServiceButton")}
                </button>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> {t("partner.studioSetup.backButton")}</Button>
                <Button onClick={handleSaveServices} disabled={servicesLoading} className="flex-1 h-11 bg-[#B85C38] hover:bg-[#9E4D22] text-white">
                  {servicesLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("partner.studioSetup.savingButton")}</> : <>{t("partner.studioSetup.nextButton")} <ChevronRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4 (invite): AVAILABILITY */}
        {step === 4 && mode === "invite" && (
          <Card className="bg-white border border-[#E5DDD3] shadow-[0_4px_20px_rgba(184,92,56,0.06)] rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#B85C38] text-white flex items-center justify-center text-sm font-bold">4</div>
                <h2 className="font-display text-lg font-semibold text-[#2b2b2b]">{t("partner.studioSetup.step4AvailabilityTitle")}</h2>
              </div>
              {renderHoursEditor()}
              <div className="rounded-xl border border-[#E5DDD3] bg-[#FAF6F1] p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-[#2b2b2b]">{t("partner.studioSetup.capacityQuestion")}</p>
                  <p className="text-xs text-[#7A7068]">{t("partner.studioSetup.capacityHelper")}</p>
                </div>
                <CapacityChips value={capacity} onChange={setCapacity} />
              </div>
              {renderStaffCount()}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> {t("partner.studioSetup.backButton")}</Button>
                <Button onClick={handleSaveAvailability} className="flex-1 h-11 bg-[#B85C38] hover:bg-[#9E4D22] text-white">{t("partner.studioSetup.nextButton")} <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4 (draft): CONNECT GOOGLE CALENDAR */}
        {step === 4 && isReviewMode && (
          <Card className="bg-white border border-[#E5DDD3] shadow-[0_4px_20px_rgba(184,92,56,0.06)] rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#B85C38] text-white flex items-center justify-center text-sm font-bold">4</div>
                <h2 className="font-display text-lg font-semibold text-[#2b2b2b]">{t("partner.studioSetup.step4CalendarTitle")}</h2>
              </div>
              <p className="text-sm text-[#7A7068]">
                {t("partner.studioSetup.calendarRecommendedDesc")}
              </p>

              <div className="rounded-xl border border-[#E5DDD3] bg-[#FAF6F1] p-4 space-y-2">
                {[
                  t("partner.studioSetup.calendarBullet1"),
                  t("partner.studioSetup.calendarBullet2"),
                  t("partner.studioSetup.calendarBullet3"),
                ].map(line => (
                  <div key={line} className="flex items-start gap-2 text-sm text-[#2b2b2b]">
                    <Check className="h-4 w-4 text-[#B85C38] mt-0.5 flex-shrink-0" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleConnectCalendar}
                className="w-full h-12 bg-[#B85C38] hover:bg-[#9E4D22] text-white"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {t("partner.studioSetup.connectGoogleCalendar")}
              </Button>
              <p className="text-xs text-center text-[#7A7068]">
                {t("partner.studioSetup.oneClickNote")}
              </p>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#E5DDD3]" />
                <span className="text-xs text-[#7A7068]">{t("partner.studioSetup.orDividerEs")}</span>
                <div className="flex-1 h-px bg-[#E5DDD3]" />
              </div>

              {!showManualAvailability ? (
                <Button
                  variant="outline"
                  onClick={() => setShowManualAvailability(true)}
                  className="w-full h-11 border-[#E5DDD3] bg-white text-[#2b2b2b] hover:bg-[#FAF6F1] hover:text-[#B85C38]"
                >
                  {t("partner.studioSetup.setManuallyButton")}
                </Button>
              ) : (
                <div className="space-y-3">
                  {renderHoursEditor()}
                  {renderCapacity()}

                  {renderStaffCount()}
                  <Button
                    onClick={handleSaveManualAvailability}
                    disabled={manualSaving}
                    className="w-full h-11 bg-[#B85C38] hover:bg-[#9E4D22] text-white"
                  >
                    {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("partner.studioSetup.saveAndContinue")}
                  </Button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> {t("partner.studioSetup.backButton")}</Button>
              </div>

              <button
                onClick={() => setStep(5)}
                className="w-full text-center text-xs text-[#7A7068] hover:text-[#B85C38] underline underline-offset-2 pt-1"
              >
                {t("partner.studioSetup.skipForNow")}
              </button>

            </CardContent>
          </Card>
        )}

        {/* STEP 5 (claim): CREATE PASSWORD */}
        {step === 5 && mode === "claim" && (
          <Card className="bg-white border border-[#E5DDD3] shadow-[0_4px_20px_rgba(184,92,56,0.06)] rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-[#B85C38] text-white flex items-center justify-center text-sm font-bold">5</div>
                <h2 className="font-display text-lg font-semibold text-[#2b2b2b]">{t("partner.studioSetup.step5Title")}</h2>
              </div>
              <p className="text-sm text-[#7A7068]">
                {t("partner.studioSetup.step5Desc")}
              </p>

              {pwDone ? (
                <>
                  <div className="rounded-xl border border-[#E5DDD3] bg-[#FAF6F1] p-4 space-y-2">
                    <p className="text-sm font-semibold text-[#2b2b2b]">{t("partner.studioSetup.loginDetailsTitle")}</p>
                    <p className="text-sm text-[#2b2b2b]">
                      <span className="text-[#7A7068]">{t("partner.studioSetup.loginUrlLabel")} </span>
                      <span className="font-semibold">book.massageclub.io/partner/login</span>
                    </p>
                    <p className="text-sm text-[#2b2b2b]">
                      <span className="text-[#7A7068]">{t("partner.studioSetup.loginEmailLabel")} </span>
                      <span className="font-semibold">{accountEmail}</span>
                    </p>
                  </div>
                  <Button
                    onClick={() => setStep(DONE_STEP)}
                    className="w-full h-11 bg-[#B85C38] hover:bg-[#9E4D22] text-white"
                  >
                    {t("partner.studioSetup.continueEs")} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={t("partner.studioSetup.passwordMinPlaceholder")}
                    className="h-11 bg-white border-[#E5DDD3]"
                  />
                  <Input
                    type="password"
                    value={newPassword2}
                    onChange={e => setNewPassword2(e.target.value)}
                    placeholder={t("partner.studioSetup.repeatPasswordPlaceholder")}
                    className="h-11 bg-white border-[#E5DDD3]"
                  />
                  {pwError && (
                    <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-xl">{pwError}</p>
                  )}
                  <Button
                    onClick={handleCreatePassword}
                    disabled={pwSaving}
                    className="w-full h-11 bg-[#B85C38] hover:bg-[#9E4D22] text-white"
                  >
                    {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("partner.studioSetup.savePasswordButton")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* FINAL STEP: DONE */}
        {step === DONE_STEP && (
          <Card className="border border-[#9E4D22] shadow-[0_10px_30px_rgba(184,92,56,0.25)] rounded-2xl bg-gradient-to-br from-[#B85C38] to-[#9E4D22]">
            <CardContent className="p-8 text-center text-white">
              <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-2 text-white">{t("partner.studioSetup.doneTitle")}</h2>
              <p className="text-[#FAF6F1]/90 text-sm mb-6">
                {isReviewMode && calendarConnected
                  ? t("partner.studioSetup.doneDescCalendarConnected")
                  : isReviewMode
                    ? t("partner.studioSetup.doneDescReviewNoCalendar")
                    : t("partner.studioSetup.doneDescInvite")}
              </p>
              <Button onClick={() => navigate("/partner/dashboard")} className="w-full h-12 bg-white text-[#B85C38] hover:bg-[#FAF6F1] font-semibold text-base rounded-xl">
                {t("partner.studioSetup.goToDashboard")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function StudioSetup() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#B85C38]" /></div>}>
      <StudioSetupInner />
    </Suspense>
  );
}
