import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, LogOut, ArrowLeft, Camera, UserCircle, Gift, Copy, Share2 } from "lucide-react";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import { useTranslation } from "react-i18next";
import {
  REFERRAL_REWARD_EUR,
  getOrCreateReferralCode,
  getUnusedCredits,
} from "@/lib/referral";


const PRESSURES = ["Light", "Medium", "Firm", "Deep"];
const PRESSURE_KEYS: Record<string, string> = { Light: "light", Medium: "medium", Firm: "firm", Deep: "deep" };
const FOCUS = ["Neck", "Shoulders", "Upper Back", "Lower Back", "Legs", "Feet", "Arms", "Hands"];
const FOCUS_KEYS: Record<string, string> = { Neck: "neck", Shoulders: "shoulders", "Upper Back": "upperBack", "Lower Back": "lowerBack", Legs: "legs", Feet: "feet", Arms: "arms", Hands: "hands" };
const MEDICALS = ["High blood pressure", "Heart condition", "Diabetes", "Blood clots / DVT", "Pregnant", "Recent surgery", "Cancer", "Epilepsy", "Skin condition"];
const MEDICAL_KEYS: Record<string, string> = { "High blood pressure": "highBloodPressure", "Heart condition": "heartCondition", Diabetes: "diabetes", "Blood clots / DVT": "bloodClots", Pregnant: "pregnant", "Recent surgery": "recentSurgery", Cancer: "cancer", Epilepsy: "epilepsy", "Skin condition": "skinCondition" };
const GENDERS = ["Female", "Male", "Other", "Prefer not to say"];
const GENDER_KEYS: Record<string, string> = { Female: "female", Male: "male", Other: "other", "Prefer not to say": "preferNotToSay" };
const THERAPIST_GENDERS: { label: string; value: string }[] = [
  { label: "No preference", value: "any" },
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
];
const MASSAGE_TYPES: { label: string; value: string }[] = [
  { label: "Swedish", value: "swedish" },
  { label: "Deep Tissue", value: "deep" },
  { label: "Thai", value: "thai" },
  { label: "Sports", value: "sports" },
  { label: "Hot Stone", value: "stone" },
  { label: "Aromatherapy", value: "aromatherapy" },
  { label: "Reflexology", value: "reflexology" },
  { label: "Shiatsu", value: "shiatsu" },
  { label: "Balinese", value: "balinese" },
  { label: "Lymphatic", value: "lymphatic" },
  { label: "Prenatal", value: "prenatal" },
];
const DURATIONS = [30, 60, 90, 120];
const BUDGETS: { label: string; value: string }[] = [
  { label: "Under €40", value: "under_40" },
  { label: "€40–60", value: "40_60" },
  { label: "€60–90", value: "60_90" },
  { label: "€90+", value: "90_plus" },
];
const ADDONS: { label: string; value: string }[] = [
  { label: "Aromatherapy", value: "aromatherapy" },
  { label: "Hot stones", value: "hot_stones" },
  { label: "Scalp massage", value: "scalp" },
  { label: "Foot scrub", value: "foot_scrub" },
  { label: "CBD oil", value: "cbd" },
  { label: "Cupping", value: "cupping" },
  { label: "Extra 15 min", value: "extra_time" },
];
const FREQUENCIES: { label: string; value: string }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "A few times a year", value: "few_times_year" },
  { label: "Rarely / first time", value: "rarely" },
];
const GOALS: { label: string; value: string }[] = [
  { label: "Relaxation", value: "relaxation" },
  { label: "Pain & tension relief", value: "pain_relief" },
  { label: "Sports recovery", value: "sports_recovery" },
  { label: "Better sleep", value: "sleep" },
  { label: "Stress & anxiety", value: "stress" },
  { label: "Injury rehab", value: "injury_rehab" },
  { label: "Pampering", value: "pampering" },
];
const CONVERSATION: { label: string; value: string }[] = [
  { label: "🤫 Silence please", value: "silence" },
  { label: "A little chat", value: "minimal" },
  { label: "Happy to chat", value: "chatty" },
];
const MUSIC: { label: string; value: string }[] = [
  { label: "Spa music", value: "spa" },
  { label: "No music", value: "none" },
  { label: "Whatever's on", value: "any" },
];
const TEMPERATURE: { label: string; value: string }[] = [
  { label: "Warmer", value: "warmer" },
  { label: "Neutral", value: "neutral" },
  { label: "Cooler", value: "cooler" },
];
const SCENT: { label: string; value: string }[] = [
  { label: "Aromatherapy", value: "aroma" },
  { label: "Unscented", value: "unscented" },
];
const LIGHTING: { label: string; value: string }[] = [
  { label: "Dim", value: "dim" },
  { label: "Normal", value: "normal" },
];

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState("");

  // Personal details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");

  // New preferences
  const [preferredMassageTypes, setPreferredMassageTypes] = useState<string[]>([]);
  const [preferredDuration, setPreferredDuration] = useState<number | null>(null);
  const [typicalBudget, setTypicalBudget] = useState("");
  const [usualAddons, setUsualAddons] = useState<string[]>([]);
  const [massageFrequency, setMassageFrequency] = useState("");
  const [massageGoals, setMassageGoals] = useState<string[]>([]);

  // Comfort & experience
  const [conversationPref, setConversationPref] = useState("");
  const [musicPref, setMusicPref] = useState("");
  const [temperaturePref, setTemperaturePref] = useState("");
  const [scentPref, setScentPref] = useState("");
  const [lightingPref, setLightingPref] = useState("");
  const [comfortNotes, setComfortNotes] = useState("");

  // Massage preferences
  const [pressure, setPressure] = useState("");
  const [preferredTherapistGender, setPreferredTherapistGender] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [allergies, setAllergies] = useState("");
  const [healthNotes, setHealthNotes] = useState("");

  // Health & safety
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState("");
  const [pastSurgeries, setPastSurgeries] = useState("");
  const [avoidAreas, setAvoidAreas] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [isFirstMassage, setIsFirstMassage] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Referral
  const [referralCode, setReferralCode] = useState("");
  const [creditBalanceCents, setCreditBalanceCents] = useState(0);

  // Last booking (for "Book again" card)
  const [lastBooking, setLastBooking] = useState<any>(null);

  // Studio suggestions
  const [suggestStudio, setSuggestStudio] = useState("");
  const [suggestArea, setSuggestArea] = useState("");
  const [suggestReason, setSuggestReason] = useState("");
  const [suggestSubmitting, setSuggestSubmitting] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<any[]>([]);


  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        // Referral code + credit balance (best-effort — tables may not exist yet)
        try {
          const code = await getOrCreateReferralCode(user.id);
          setReferralCode(code);
          const credits = await getUnusedCredits(user.id);
          setCreditBalanceCents(credits.reduce((s, c) => s + (c.amount_cents ?? 0), 0));
        } catch { /* referral tables not migrated yet */ }


        const metaFull = user.user_metadata?.full_name || user.user_metadata?.name || "";
        const derivedFirst = metaFull.split(" ")[0] || "";
        const derivedLast = metaFull.split(" ").slice(1).join(" ") || "";

        setFirstName(data?.first_name || derivedFirst);
        setLastName(data?.last_name || derivedLast);
        setAvatarUrl(data?.avatar_url || "");
        setPhone(data?.phone || "");
        setDateOfBirth(data?.date_of_birth || "");
        setGender(data?.gender || "");
        setCity(data?.city || "");
        setPreferredLanguage(data?.preferred_language || "");

        setPressure(data?.preferred_pressure || "");
        setPreferredTherapistGender(data?.preferred_therapist_gender || "");
        setFocusAreas(data?.focus_areas || []);
        setAllergies(data?.allergies || "");
        setHealthNotes(data?.health_notes || "");

        setReasonForVisit(data?.reason_for_visit || "");
        setMedicalConditions(data?.medical_conditions || []);
        setMedications(data?.medications || "");
        setPastSurgeries(data?.past_surgeries || "");
        setAvoidAreas(data?.avoid_areas || "");
        setEmergencyName(data?.emergency_contact_name || "");
        setEmergencyPhone(data?.emergency_contact_phone || "");
        setIsFirstMassage(!!data?.is_first_massage);
        setConsentAccepted(!!data?.consent_accepted);

        setPreferredMassageTypes(data?.preferred_massage_types || []);
        setPreferredDuration(typeof data?.preferred_duration === "number" ? data.preferred_duration : null);
        setTypicalBudget(data?.typical_budget || "");
        setUsualAddons(data?.usual_addons || []);
        setMassageFrequency(data?.massage_frequency || "");
        setMassageGoals(data?.massage_goals || []);

        setConversationPref(data?.conversation_pref || "");
        setMusicPref(data?.music_pref || "");
        setTemperaturePref(data?.temperature_pref || "");
        setScentPref(data?.scent_pref || "");
        setLightingPref(data?.lighting_pref || "");
        setComfortNotes(data?.comfort_notes || "");

        // Fetch most recent booking for "Book again" card
        try {
          const email = user.email || "";
          const filter = email
            ? `user_id.eq.${user.id},client_email.eq.${email}`
            : `user_id.eq.${user.id}`;
          const { data: lb } = await supabase
            .from("bookings")
            .select("id, partner_id, massage_type, booking_date, partners(business_name, slug)")
            .or(filter)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lb && lb.partner_id && (lb as any).partners) setLastBooking(lb);
        } catch { /* ignore */ }

        try {
          const { data: sug } = await supabase
            .from("studio_suggestions")
            .select("id, studio_name, area, reason, status, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
          if (sug) setMySuggestions(sug);
        } catch { /* ignore */ }

      }
      setLoading(false);
    })();
  }, []);

  const toggleFocus = (v: string) =>
    setFocusAreas(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const toggleMedical = (v: string) =>
    setMedicalConditions(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upError) {
      toast.error(t("app.profile.toasts.photoUploadFailed", { message: upError.message }));
      setUploadingPhoto(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData?.publicUrl || "";
    setAvatarUrl(publicUrl);
    const { error: dbError } = await supabase.from("profiles").upsert({
      id: user.id,
      avatar_url: publicUrl || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (dbError) {
      toast.error(t("app.profile.toasts.photoSavedProfileFailed", { message: dbError.message }));
    } else {
      toast.success(t("app.profile.toasts.photoUpdated"));
    }
    setUploadingPhoto(false);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const full_name = `${firstName} ${lastName}`.trim();
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: full_name || null,
      avatar_url: avatarUrl || null,
      phone: phone || null,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      city: city || null,
      preferred_language: preferredLanguage || null,
      preferred_pressure: pressure || null,
      preferred_therapist_gender: preferredTherapistGender || null,
      focus_areas: focusAreas.length ? focusAreas : null,
      allergies: allergies || null,
      health_notes: healthNotes || null,
      reason_for_visit: reasonForVisit || null,
      medical_conditions: medicalConditions.length ? medicalConditions : null,
      medications: medications || null,
      past_surgeries: pastSurgeries || null,
      avoid_areas: avoidAreas || null,
      emergency_contact_name: emergencyName || null,
      emergency_contact_phone: emergencyPhone || null,
      is_first_massage: isFirstMassage,
      consent_accepted: consentAccepted,
      consent_at: consentAccepted ? new Date().toISOString() : null,
      preferred_massage_types: preferredMassageTypes.length ? preferredMassageTypes : null,
      preferred_duration: preferredDuration ?? null,
      typical_budget: typicalBudget || null,
      usual_addons: usualAddons.length ? usualAddons : null,
      massage_frequency: massageFrequency || null,
      massage_goals: massageGoals.length ? massageGoals : null,
      conversation_pref: conversationPref || null,
      music_pref: musicPref || null,
      temperature_pref: temperaturePref || null,
      scent_pref: scentPref || null,
      lighting_pref: lightingPref || null,
      comfort_notes: comfortNotes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(t("app.profile.toasts.profileSaved"));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-full text-sm font-medium border transition ${
      active
        ? "bg-[#C4622D] text-white border-[#C4622D]"
        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
    }`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4F0]">
        <Loader2 className="h-7 w-7 animate-spin text-[#C4622D]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F4F0] text-center px-6">
        <div className="h-16 w-16 rounded-full bg-[#C4622D]/10 flex items-center justify-center mb-4">
          <UserCircle className="h-8 w-8 text-[#C4622D]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{t("app.profile.signedOut.title")}</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          {t("app.profile.signedOut.subtitle")}
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 h-12 px-6 rounded-full bg-[#C4622D] text-white font-semibold shadow-lg"
        >
          {t("app.profile.signedOut.signInButton")}
        </button>
      </div>
    );
  }

  const avatarLetter = (firstName || user.user_metadata?.full_name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="h-full overflow-y-auto bg-[#F7F4F0]">
      <div className="max-w-lg mx-auto px-5 pt-6 pb-8">
        <button
          onClick={() => navigate("/app/bookings")}
          className="flex items-center gap-1 text-sm text-gray-500 mb-3"
        >
          <ArrowLeft size={14} /> {t("app.profile.header.back")}
        </button>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{t("app.profile.header.title")}</h1>
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-sm text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 bg-white"
          >
            <LogOut size={14} /> {t("app.profile.header.signOut")}
          </button>
        </div>

        {/* Language picker — prominent in profile */}
        <div className="mt-4 rounded-2xl border border-[#E5DDD3] bg-white p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#7A7068]">{t("app.profile.language.label")}</p>
            <p className="text-xs text-[#9E9387] mt-0.5">{t("app.profile.language.hint")}</p>
          </div>
          <LanguageFlagToggle />
        </div>

        {/* Book again card */}
        {lastBooking && (lastBooking.partners?.slug || lastBooking.partner_id) && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t("app.profile.bookAgain.title")}</p>
              <p className="text-xs text-muted-foreground truncate">
                {t("app.profile.bookAgain.subtitle", {
                  service: lastBooking.massage_type || "Massage",
                  date: lastBooking.booking_date || "",
                })}
              </p>
            </div>
            <button
              onClick={() => {
                const target = lastBooking.partners?.slug
                  ? `/book/${lastBooking.partners.slug}?rebook=${lastBooking.id}`
                  : `/app/booking/${lastBooking.partner_id}`;
                navigate(target);
              }}
              className="shrink-0 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              {t("app.profile.bookAgain.cta")}
            </button>
          </div>
        )}

        {/* Recomienda un estudio */}
        <div className="mt-4 rounded-2xl border border-[#E5DDD3] bg-white p-4">
          <p className="text-sm font-semibold text-foreground">{t("app.profile.suggest.title")}</p>
          <p className="text-xs text-[#7A7068] mt-1">{t("app.profile.suggest.subtitle")}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const name = suggestStudio.trim();
              if (!name || !user) return;
              if (name.length > 200) return;
              setSuggestSubmitting(true);
              const { data, error } = await supabase
                .from("studio_suggestions")
                .insert({
                  user_id: user.id,
                  client_email: user.email || null,
                  studio_name: name,
                  area: suggestArea.trim() || null,
                  reason: suggestReason.trim() || null,
                })
                .select("id, studio_name, area, reason, status, created_at")
                .single();
              setSuggestSubmitting(false);
              if (error) {
                toast.error(error.message);
                return;
              }
              toast.success(t("app.profile.suggest.thanks"));
              setSuggestStudio(""); setSuggestArea(""); setSuggestReason("");
              if (data) setMySuggestions((prev) => [data, ...prev]);
            }}
            className="mt-3 space-y-2"
          >
            <input
              value={suggestStudio}
              onChange={(e) => setSuggestStudio(e.target.value)}
              maxLength={200}
              required
              placeholder={t("app.profile.suggest.studioName")}
              className="w-full h-10 px-3 rounded-xl border border-[#E5DDD3] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              value={suggestArea}
              onChange={(e) => setSuggestArea(e.target.value)}
              maxLength={200}
              placeholder={t("app.profile.suggest.area")}
              className="w-full h-10 px-3 rounded-xl border border-[#E5DDD3] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <textarea
              value={suggestReason}
              onChange={(e) => setSuggestReason(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder={t("app.profile.suggest.reason")}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DDD3] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="submit"
              disabled={suggestSubmitting || !suggestStudio.trim()}
              className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {t("app.profile.suggest.submit")}
            </button>
          </form>

          {mySuggestions.filter((s) => s.status !== "rejected").length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#7A7068] mb-2">
                {t("app.profile.suggest.yours")}
              </p>
              <ul className="space-y-1.5">
                {mySuggestions.filter((s) => s.status !== "rejected").map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground">
                      {s.studio_name}
                      {s.area ? <span className="text-[#9E9387]"> · {s.area}</span> : null}
                    </span>
                    <span
                      className={
                        "shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold " +
                        (s.status === "added"
                          ? "bg-green-100 text-green-800"
                          : "bg-[#F5EFE7] text-[#7A5A3F]")
                      }
                    >
                      {s.status === "added"
                        ? t("app.profile.suggest.statusAdded")
                        : t("app.profile.suggest.statusNew")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>



        {/* Refer & Earn card */}
        {referralCode && (() => {
          const referralUrl = `${window.location.origin}/?ref=${referralCode}`;
          const shareText = t("app.profile.referral.shareText", { amount: REFERRAL_REWARD_EUR, url: referralUrl });
          const copy = async () => {
            try {
              await navigator.clipboard.writeText(referralUrl);
              toast.success(t("app.profile.toasts.linkCopied"));
            } catch {
              toast.error(t("app.profile.toasts.copyFailed"));
            }
          };
          const share = async () => {
            if ((navigator as any).share) {
              try {
                await (navigator as any).share({
                  title: t("app.profile.referral.shareTitle"),
                  text: shareText,
                  url: referralUrl,
                });
                return;
              } catch { /* user cancelled */ }
            }
            copy();
          };
          return (
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#C4622D] to-[#8B3E1A] p-5 text-white shadow-lg">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold">{t("app.profile.referral.title", { amount: REFERRAL_REWARD_EUR })}</h3>
                  <p className="text-sm text-white/85 mt-0.5">
                    {t("app.profile.referral.subtitle", { amount: REFERRAL_REWARD_EUR })}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-white/15 backdrop-blur px-3 py-2.5 flex items-center gap-2">
                <span className="text-xs text-white/70 uppercase tracking-wider">{t("app.profile.referral.yourLink")}</span>
                <span className="text-sm font-mono truncate flex-1">/?ref={referralCode}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={copy}
                  className="h-11 rounded-full bg-white/15 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/25"
                >
                  <Copy size={15} /> {t("app.profile.referral.copyLink")}
                </button>
                <button
                  onClick={share}
                  className="h-11 rounded-full bg-white text-[#C4622D] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/90"
                >
                  <Share2 size={15} /> {t("app.profile.referral.share")}
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-white/70">{t("app.profile.referral.creditBalance")}</span>
                <span className="text-xl font-bold">€{(creditBalanceCents / 100).toFixed(0)}</span>
              </div>
            </div>
          );
        })()}



        {/* Photo header */}
        <div className="mt-6 flex flex-col items-center">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-[#C4622D] text-white flex items-center justify-center text-3xl font-bold border-2 border-[#C4622D]">
                {avatarLetter}
              </div>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#C4622D] bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50"
          >
            <Camera size={16} /> {t("app.profile.photo.changePhoto")}
          </button>
        </div>

        {/* Personal details card */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-gray-900">{t("app.profile.personal.title")}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.personal.firstName")}</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.personal.lastName")}</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.personal.email")}</label>
            <input
              value={user.email || ""}
              readOnly
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.personal.phone")}</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder={t("app.profile.personal.phonePlaceholder")}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.personal.dateOfBirth")}</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.personal.gender")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {GENDERS.map(g => (
                <button key={g} type="button" onClick={() => setGender(g)} className={chip(gender === g)}>
                  {t(`app.profile.options.genders.${GENDER_KEYS[g]}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.personal.city")}</label>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder={t("app.profile.personal.cityPlaceholder")}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.personal.preferredLanguage")}</label>
            <input
              value={preferredLanguage}
              onChange={e => setPreferredLanguage(e.target.value)}
              placeholder={t("app.profile.personal.preferredLanguagePlaceholder")}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>
        </div>

        {/* Massage preferences card */}
        <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-gray-900">{t("app.profile.massagePrefs.title")}</h2>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.preferredPressure")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESSURES.map(p => (
                <button key={p} type="button" onClick={() => setPressure(p)} className={chip(pressure === p)}>
                  {t(`app.profile.options.pressures.${PRESSURE_KEYS[p]}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.preferredTherapist")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {THERAPIST_GENDERS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setPreferredTherapistGender(opt.value)} className={chip(preferredTherapistGender === opt.value)}>
                  {t(`app.profile.options.therapistGenders.${opt.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.focusAreas")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FOCUS.map(f => (
                <button key={f} type="button" onClick={() => toggleFocus(f)} className={chip(focusAreas.includes(f))}>
                  {t(`app.profile.options.focus.${FOCUS_KEYS[f]}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.allergies")}</label>
            <input
              value={allergies}
              onChange={e => setAllergies(e.target.value)}
              placeholder={t("app.profile.massagePrefs.allergiesPlaceholder")}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.healthNotes")}</label>
            <textarea
              value={healthNotes}
              onChange={e => setHealthNotes(e.target.value)}
              rows={4}
              placeholder={t("app.profile.massagePrefs.healthNotesPlaceholder")}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.preferredMassageTypes")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {MASSAGE_TYPES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setPreferredMassageTypes(prev =>
                      prev.includes(opt.value) ? prev.filter(x => x !== opt.value) : [...prev, opt.value]
                    )
                  }
                  className={chip(preferredMassageTypes.includes(opt.value))}
                >
                  {t(`app.profile.options.massageTypes.${opt.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.typicalSessionLength")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPreferredDuration(preferredDuration === d ? null : d)}
                  className={chip(preferredDuration === d)}
                >
                  {t("app.profile.massagePrefs.minutes", { count: d })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.typicalBudget")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {BUDGETS.map(b => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setTypicalBudget(typicalBudget === b.value ? "" : b.value)}
                  className={chip(typicalBudget === b.value)}
                >
                  {t(`app.profile.options.budgets.${b.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.usualAddons")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ADDONS.map(a => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() =>
                    setUsualAddons(prev =>
                      prev.includes(a.value) ? prev.filter(x => x !== a.value) : [...prev, a.value]
                    )
                  }
                  className={chip(usualAddons.includes(a.value))}
                >
                  {t(`app.profile.options.addons.${a.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.massageFrequency")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FREQUENCIES.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setMassageFrequency(massageFrequency === f.value ? "" : f.value)}
                  className={chip(massageFrequency === f.value)}
                >
                  {t(`app.profile.options.frequencies.${f.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.massagePrefs.mainGoals")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {GOALS.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() =>
                    setMassageGoals(prev =>
                      prev.includes(g.value) ? prev.filter(x => x !== g.value) : [...prev, g.value]
                    )
                  }
                  className={chip(massageGoals.includes(g.value))}
                >
                  {t(`app.profile.options.goals.${g.value}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Comfort & experience card */}
        <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t("app.profile.comfort.title")}</h2>
            <p className="text-xs text-gray-500">{t("app.profile.comfort.subtitle")}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-900">{t("app.profile.comfort.conversation")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CONVERSATION.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setConversationPref(conversationPref === o.value ? "" : o.value)}
                  className={chip(conversationPref === o.value)}
                >
                  {t(`app.profile.options.conversation.${o.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.comfort.music")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {MUSIC.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setMusicPref(musicPref === o.value ? "" : o.value)}
                  className={chip(musicPref === o.value)}
                >
                  {t(`app.profile.options.music.${o.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.comfort.temperature")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEMPERATURE.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setTemperaturePref(temperaturePref === o.value ? "" : o.value)}
                  className={chip(temperaturePref === o.value)}
                >
                  {t(`app.profile.options.temperature.${o.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.comfort.scent")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SCENT.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setScentPref(scentPref === o.value ? "" : o.value)}
                  className={chip(scentPref === o.value)}
                >
                  {t(`app.profile.options.scent.${o.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.comfort.lighting")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {LIGHTING.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setLightingPref(lightingPref === o.value ? "" : o.value)}
                  className={chip(lightingPref === o.value)}
                >
                  {t(`app.profile.options.lighting.${o.value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.comfort.notes")}</label>
            <textarea
              value={comfortNotes}
              onChange={e => setComfortNotes(e.target.value)}
              rows={3}
              placeholder={t("app.profile.comfort.notesPlaceholder")}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white"
            />
          </div>
        </div>

        {/* Health & safety card */}
        <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t("app.profile.health.title")}</h2>
            <p className="text-xs text-gray-500">{t("app.profile.health.subtitle")}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.health.reasonForVisit")}</label>
            <textarea
              value={reasonForVisit}
              onChange={e => setReasonForVisit(e.target.value)}
              rows={3}
              placeholder={t("app.profile.health.reasonForVisitPlaceholder")}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.health.medicalConditions")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {MEDICALS.map(m => (
                <button key={m} type="button" onClick={() => toggleMedical(m)} className={chip(medicalConditions.includes(m))}>
                  {t(`app.profile.options.medicals.${MEDICAL_KEYS[m]}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.health.medications")}</label>
            <input
              value={medications}
              onChange={e => setMedications(e.target.value)}
              placeholder={t("app.profile.health.medicationsPlaceholder")}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.health.pastSurgeries")}</label>
            <textarea
              value={pastSurgeries}
              onChange={e => setPastSurgeries(e.target.value)}
              rows={3}
              placeholder={t("app.profile.health.pastSurgeriesPlaceholder")}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.health.avoidAreas")}</label>
            <input
              value={avoidAreas}
              onChange={e => setAvoidAreas(e.target.value)}
              placeholder={t("app.profile.health.avoidAreasPlaceholder")}
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("app.profile.health.emergencyContact")}</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <input
                value={emergencyName}
                onChange={e => setEmergencyName(e.target.value)}
                placeholder={t("app.profile.health.emergencyNamePlaceholder")}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
              />
              <input
                value={emergencyPhone}
                onChange={e => setEmergencyPhone(e.target.value)}
                placeholder={t("app.profile.health.emergencyPhonePlaceholder")}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="firstMassage"
              type="checkbox"
              checked={isFirstMassage}
              onChange={e => setIsFirstMassage(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-[#C4622D] focus:ring-[#C4622D]"
            />
            <label htmlFor="firstMassage" className="text-sm text-gray-700">{t("app.profile.health.isFirstMassage")}</label>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <input
              id="consent"
              type="checkbox"
              checked={consentAccepted}
              onChange={e => setConsentAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300 text-[#C4622D] focus:ring-[#C4622D]"
            />
            <label htmlFor="consent" className="text-sm text-gray-700 leading-relaxed">
              {t("app.profile.health.consent")}
            </label>
          </div>
        </div>
      </div>

      {/* Sticky Save */}
      <div className="sticky bottom-0 inset-x-0 bg-[#F7F4F0]/95 backdrop-blur border-t border-gray-200 px-5 py-3">
        <div className="max-w-lg mx-auto">
          <button
            onClick={save}
            disabled={saving}
            className="w-full h-12 rounded-full bg-[#C4622D] text-white font-semibold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("app.profile.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
