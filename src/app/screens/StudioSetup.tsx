import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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

const MASSAGE_TYPES = ["Relax", "Therapeutic", "Swedish", "Deep Tissue", "Sports", "Thai", "Balinese", "Ayurvedic", "Lomi Lomi", "Hot Stone", "Aromatherapy", "Reflexology", "Shiatsu", "Kobido", "Craneo-Facial", "Lymphatic", "Prenatal", "Couples", "4 Hands", "Express", "Ritual", "Hammam", "Body", "Physiotherapy", "Facial", "Spa Day", "Other"];
const DAYS = [
  { num: 1, label: "Mon" }, { num: 2, label: "Tue" }, { num: 3, label: "Wed" },
  { num: 4, label: "Thu" }, { num: 5, label: "Fri" }, { num: 6, label: "Sat" }, { num: 0, label: "Sun" },
];
const DEFAULT_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

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

function StudioSetupInner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const draftToken = searchParams.get("draft");
  const claimToken = searchParams.get("claim");
  const mode: "invite" | "draft" | "claim" = claimToken ? "claim" : draftToken ? "draft" : "invite";

  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;

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
  const [availability, setAvailability] = useState<Record<number, string[]>>({
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [],
  });
  const [capacity, setCapacity] = useState<number>(1);

  // Step 4: Calendar (draft/claim mode)
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [showManualAvailability, setShowManualAvailability] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  // Validate token/draft/claim on mount
  useEffect(() => {
    if (mode === "claim") {
      if (!claimToken) { setSourceError("No claim token provided"); setValidatingSource(false); return; }
      (async () => {
        const { data: partner, error } = await supabase
          .from("partners")
          .select("*")
          .eq("claim_token", claimToken)
          .eq("status", "pending")
          .maybeSingle();
        if (error || !partner) {
          setSourceError("This claim link is invalid or the studio has already been claimed.");
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
      if (!draftToken) { setSourceError("No draft token provided"); setValidatingSource(false); return; }
      supabase
        .from("studio_drafts")
        .select("*")
        .eq("claim_token", draftToken)
        .neq("status", "claimed")
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) { setSourceError("This claim link is invalid or already used."); }
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

    if (!token) { setSourceError("No token provided"); setValidatingSource(false); return; }
    supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setSourceError("Invalid or expired invite link"); }
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
      toast.success("Google Calendar connected!");
    }
    if (searchParams.get("cal_error")) {
      toast.error("Calendar connection failed. Please try again.");
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
      toast.error(error.message || "Google sign-in failed");
    }
  };

  // Step 1 (claim): send magic-link email — link brings user back to this same claim URL.
  const handleMagicLink = async () => {
    if (!email) { toast.error("Enter your email first"); return; }
    setMagicLoading(true);
    const emailRedirectTo = `${window.location.origin}/studio-setup?claim=${claimToken}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    setMagicLoading(false);
    if (error) {
      toast.error(error.message || "Could not send magic link");
      return;
    }
    setMagicSent(true);
    toast.success("Check your email for a login link.");
  };

  const handleCreateAccount = async () => {
    if (!password || password !== confirmPassword) { toast.error("Passwords don't match"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!email) { toast.error("Please provide an email"); return; }
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
      toast.success("Account created!");
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setAccountLoading(false);
    }
  };

  // Step 2: Save profile
  const handleSaveProfile = async () => {
    if (!studio.business_name.trim()) { toast.error("Studio name is required"); return; }
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
      });
      toast.success("Profile saved!");
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setProfileLoading(false);
    }
  };

  // Step 3: Save services
  const handleSaveServices = async () => {
    const validServices = services.filter(s => s.name.trim());
    if (validServices.length === 0) { toast.error("Add at least one service"); return; }
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

      toast.success("Services saved!");
      setStep(4);
    } catch (err: any) {
      toast.error(err.message || "Failed to save services");
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
      await supabase.from("partners").update({ capacity: Math.max(1, Number(capacity) || 1) }).eq("id", uid);
      toast.success("Availability saved!");
      setStep(5);
    } catch (err: any) {
      toast.error(err.message || "Failed to save availability");
    }
  };

  // Step 4 (draft/claim): Save availability manually (Google Calendar alternative)
  const handleSaveManualAvailability = async () => {
    setManualSaving(true);
    try {
      const uid = partnerId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) { toast.error("Please complete previous steps"); return; }
      await supabase.from("partner_availability").delete().eq("partner_id", uid);
      const rows = DAYS.flatMap(day =>
        (availability[day.num] || []).map(slot => ({ partner_id: uid, day_of_week: day.num, time_slot: slot }))
      );
      if (rows.length > 0) await supabase.from("partner_availability").insert(rows);
      await supabase.from("partners").update({ auto_confirm_bookings: false, capacity: Math.max(1, Number(capacity) || 1) }).eq("id", uid);
      toast.success("Availability saved!");
      setStep(5);
    } catch (err: any) {
      toast.error(err.message || "Failed to save availability");
    } finally {
      setManualSaving(false);
    }
  };

  // Step 4 (draft): Connect Google Calendar
  const handleConnectCalendar = async () => {
    const uid = partnerId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) { toast.error("Please complete previous steps"); return; }

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
  const toggleDay = (day: number) => {
    setAvailability(prev => ({ ...prev, [day]: prev[day].length > 0 ? [] : [...DEFAULT_SLOTS] }));
  };
  const toggleSlot = (day: number, slot: string) => {
    setAvailability(prev => ({
      ...prev, [day]: prev[day].includes(slot) ? prev[day].filter(s => s !== slot) : [...prev[day], slot].sort(),
    }));
  };

  if (validatingSource) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sourceError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Invalid Link</h2>
            <p className="text-muted-foreground text-sm">{sourceError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepLabels = mode === "draft" || mode === "claim"
    ? ["Sign in", "Review", "Services", "Calendar", "Live"]
    : ["Account", "Profile", "Services", "Hours", "Done"];

  const isReviewMode = mode === "draft" || mode === "claim";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background">
      <div className="max-w-xl mx-auto px-4 py-8">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
          className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 bg-primary text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            {isReviewMode ? (
              <img src="/brand/mc-avatar-cream.png" alt="Massage Club" className="h-6 w-6 rounded-full object-cover -ml-1" />
            ) : (
              <Sparkles size={14} />
            )}
            {isReviewMode ? "Claim Your Studio" : "Studio Setup"}
          </div>
          {isReviewMode ? (
            <>
              <h1 className="text-2xl font-bold text-foreground">We built your Massage Club page</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Review it for <span className="font-semibold text-foreground">{headerName}</span>, then connect your calendar to go live.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">Welcome, {headerName}</h1>
              <p className="text-muted-foreground text-sm mt-1">Complete all steps to go live on Massage Club</p>
            </>
          )}
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-xs font-medium text-primary">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {stepLabels.map((label, i) => (
              <span key={label} className={`text-xs ${i + 1 === step ? "text-primary font-semibold" : "text-muted-foreground"}`}>{label}</span>
            ))}
          </div>
        </div>

        {/* STEP 1: ACCOUNT */}
        {step === 1 && mode === "claim" && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center text-sm font-bold">1</div>
                <h2 className="font-semibold text-foreground">Sign in with Google</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Sign in with the Google account you want to use to manage <span className="font-semibold text-foreground">{headerName}</span>. This is the same account we'll connect your calendar to.
              </p>
              <Button onClick={handleGoogleSignIn} disabled={googleLoading} className="w-full h-12 bg-white text-foreground border border-border hover:bg-secondary">
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
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px bg-border flex-1" />
              </div>

              {magicSent ? (
                <div className="rounded-xl border border-border bg-secondary/40 p-4 text-center">
                  <p className="text-sm font-medium text-foreground">Check your email for a login link.</p>
                  <p className="text-xs text-muted-foreground mt-1">We sent it to {email}. Open it on this device to continue.</p>
                </div>
              ) : (
                <>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@studio.com"
                    className="h-11 mb-2"
                  />
                  <Button
                    onClick={handleMagicLink}
                    disabled={magicLoading}
                    variant="outline"
                    className="w-full h-11"
                  >
                    {magicLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with email"}
                  </Button>
                </>
              )}

              <p className="text-xs text-center text-muted-foreground mt-3">
                We'll bring you right back here after sign-in.
              </p>

            </CardContent>
          </Card>
        )}

        {step === 1 && mode !== "claim" && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center text-sm font-bold">1</div>
                <h2 className="font-semibold text-foreground">Create your account</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {mode === "draft" && !sourceData?.email
                  ? "Enter the email you want to use to manage your studio."
                  : "Email is pre-filled from your invite."}
              </p>
              <div className="space-y-3">
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={mode === "invite" || !!sourceData?.email}
                  placeholder="you@studio.com"
                  className={mode === "invite" || !!sourceData?.email ? "bg-secondary/60" : "h-11"}
                />
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password (min 8 chars)" className="h-11" />
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="h-11" />
              </div>
              <Button onClick={handleCreateAccount} disabled={accountLoading} className="w-full mt-4 h-11 bg-primary hover:bg-[#9E4D22]">
                {accountLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account…</> : <>Continue <ChevronRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: PROFILE */}
        {step === 2 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center text-sm font-bold">2</div>
                <h2 className="font-semibold text-foreground">{isReviewMode ? "Review studio details" : "Studio details"}</h2>
              </div>
              {isReviewMode && (
                <p className="text-xs text-muted-foreground -mt-2">Everything is pre-filled from the page we built for you. Edit anything that's wrong.</p>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Studio Name</label>
                <Input value={studio.business_name} onChange={e => setStudio(p => ({ ...p, business_name: e.target.value }))} className="h-11" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Address</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={studio.address} onChange={e => setStudio(p => ({ ...p, address: e.target.value }))} placeholder="Calle Gran Vía 15, Madrid" className="pl-9 h-11" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Shown to customers on their booking confirmation.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Instrucciones de llegada (opcional)</label>
                <textarea value={studio.access_instructions} onChange={e => setStudio(p => ({ ...p, access_instructions: e.target.value }))} placeholder="Ej.: 'Portal 1A — pulsa el telefonillo y te abrimos. Primera planta, puerta derecha.'" rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:border-primary resize-none" />
                <p className="text-[11px] text-muted-foreground mt-1.5">Se incluye en el email de confirmación del cliente.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={studio.phone} onChange={e => setStudio(p => ({ ...p, phone: e.target.value }))} placeholder="+34 600 000 000" className="pl-9 h-11" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Website (optional)</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={studio.website} onChange={e => setStudio(p => ({ ...p, website: e.target.value }))} placeholder="https://yourstudio.com" className="pl-9 h-11" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <textarea value={studio.description} onChange={e => setStudio(p => ({ ...p, description: e.target.value }))} placeholder="Tell members about your studio…" rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:border-primary resize-none" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={handleSaveProfile} disabled={profileLoading} className="flex-1 h-11 bg-primary hover:bg-[#9E4D22]">
                  {profileLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : <>Next <ChevronRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: SERVICES */}
        {step === 3 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center text-sm font-bold">3</div>
                <h2 className="font-semibold text-foreground">{isReviewMode ? "Review your services" : "Your services"}</h2>
              </div>
              {isReviewMode && (
                <p className="text-xs text-muted-foreground -mt-2">We pre-filled the services we found. Adjust names, durations, or prices as needed.</p>
              )}
              <div className="space-y-3">
                {services.map((svc, i) => (
                  <div key={i} className="p-3 border border-border rounded-xl bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Service {i + 1}</span>
                      {services.length > 1 && <button onClick={() => removeService(i)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={svc.name} onChange={e => updateService(i, "name", e.target.value)} placeholder="Service name" className="col-span-2 text-sm px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary" />
                      <select value={svc.type} onChange={e => updateService(i, "type", e.target.value)} className="text-sm px-3 py-2 border border-border rounded-lg focus:outline-none">
                        {svc.type && !MASSAGE_TYPES.includes(svc.type) && <option value={svc.type}>{svc.type}</option>}
                        {MASSAGE_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <div className="flex items-center gap-1 border border-border rounded-lg px-2">
                        <Euro size={13} className="text-muted-foreground" />
                        <input value={svc.price} onChange={e => updateService(i, "price", Number(e.target.value))} type="number" min={0} className="w-full py-2 text-sm focus:outline-none" />
                      </div>
                      <select value={svc.duration} onChange={e => updateService(i, "duration", Number(e.target.value))} className="text-sm px-3 py-2 border border-border rounded-lg focus:outline-none col-span-2">
                        {[30,45,60,75,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              {services.length < 8 && (
                <button onClick={addService} className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition flex items-center justify-center gap-1">
                  <Plus size={14} /> Add service
                </button>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={handleSaveServices} disabled={servicesLoading} className="flex-1 h-11 bg-primary hover:bg-[#9E4D22]">
                  {servicesLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : <>Next <ChevronRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4 (invite): AVAILABILITY */}
        {step === 4 && mode === "invite" && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center text-sm font-bold">4</div>
                <h2 className="font-semibold text-foreground">Availability</h2>
              </div>
              <p className="text-sm text-muted-foreground">Tap a day to toggle on/off. Tap times to adjust.</p>
              <div className="space-y-3">
                {DAYS.map(day => (
                  <div key={day.num}>
                    <div className="flex items-center justify-between mb-1.5">
                      <button onClick={() => toggleDay(day.num)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${availability[day.num].length > 0 ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
                        {day.label}
                      </button>
                      <span className="text-xs text-muted-foreground">{availability[day.num].length > 0 ? `${availability[day.num].length} slots` : "Closed"}</span>
                    </div>
                    {availability[day.num].length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-1">
                        {DEFAULT_SLOTS.map(slot => (
                          <button key={slot} onClick={() => toggleSlot(day.num, slot)} className={`px-2 py-1 rounded-md text-xs font-medium transition ${availability[day.num].includes(slot) ? "bg-secondary text-primary border border-primary/40" : "bg-secondary/60 text-muted-foreground border border-border"}`}>
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
              </div>
              <div className="rounded-xl border border-border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">¿Cuántas reservas puedes atender a la vez?</p>
                  <p className="text-xs text-muted-foreground">Nº de masajistas o salas trabajando en paralelo. Ej.: 5</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={capacity}
                  onChange={e => setCapacity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="h-10 w-20 px-2 rounded-lg border border-border bg-background text-sm text-center font-semibold"
                />
              </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={handleSaveAvailability} className="flex-1 h-11 bg-primary hover:bg-[#9E4D22]">Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4 (draft): CONNECT GOOGLE CALENDAR */}
        {step === 4 && isReviewMode && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center text-sm font-bold">4</div>
                <h2 className="font-semibold text-foreground">Connect Google Calendar</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Connecting Google Calendar is recommended — we'll show your real availability and drop new bookings straight into your calendar automatically. You can also set your opening hours manually below.
              </p>

              <div className="rounded-xl border border-border p-4 space-y-2 bg-secondary/40">
                {[
                  "Read-only access to your busy times",
                  "New bookings appear as events in your calendar",
                  "Customers only ever see truly free slots",
                ].map(line => (
                  <div key={line} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleConnectCalendar}
                className="w-full h-12 bg-primary hover:bg-[#9E4D22] text-white"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Connect Google Calendar
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                One click — no password stored.
              </p>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">o</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {!showManualAvailability ? (
                <Button
                  variant="outline"
                  onClick={() => setShowManualAvailability(true)}
                  className="w-full h-11"
                >
                  Set availability manually
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Tap a day to toggle on/off. Tap times to adjust.</p>
                  {DAYS.map(day => (
                    <div key={day.num}>
                      <div className="flex items-center justify-between mb-1.5">
                        <button onClick={() => toggleDay(day.num)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${availability[day.num].length > 0 ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
                          {day.label}
                        </button>
                        <span className="text-xs text-muted-foreground">{availability[day.num].length > 0 ? `${availability[day.num].length} slots` : "Closed"}</span>
                      </div>
                      {availability[day.num].length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-1">
                          {DEFAULT_SLOTS.map(slot => (
                            <button key={slot} onClick={() => toggleSlot(day.num, slot)} className={`px-2 py-1 rounded-md text-xs font-medium transition ${availability[day.num].includes(slot) ? "bg-secondary text-primary border border-primary/40" : "bg-secondary/60 text-muted-foreground border border-border"}`}>
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={handleSaveManualAvailability}
                    disabled={manualSaving}
                    className="w-full h-11 bg-primary hover:bg-[#9E4D22] text-white"
                  >
                    {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & continue"}
                  </Button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-11"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              </div>

              <button
                onClick={() => setStep(5)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 pt-1"
              >
                Saltar por ahora — podrás conectarlo más tarde desde tu portal
              </button>

            </CardContent>
          </Card>
        )}

        {/* STEP 5: DONE */}
        {step === 5 && (
          <Card className="border-0 shadow-sm bg-gradient-to-br from-primary to-[#9E4D22]">
            <CardContent className="p-8 text-center text-white">
              <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-2">You're live on Massage Club! 🎉</h2>
              <p className="text-primary-foreground/80 text-sm mb-6">
                {isReviewMode && calendarConnected
                  ? "Your calendar is connected and your studio is now visible to members in Madrid."
                  : isReviewMode
                    ? "Your studio is now visible to members in Madrid. Puedes conectar Google Calendar cuando quieras desde tu portal de estudio."
                    : "Your studio is now visible to thousands of members in Madrid."}
              </p>
              <Button onClick={() => navigate("/partner/dashboard")} className="w-full h-12 bg-white text-primary hover:bg-secondary font-semibold text-base rounded-xl">
                Go to your dashboard →
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <StudioSetupInner />
    </Suspense>
  );
}
