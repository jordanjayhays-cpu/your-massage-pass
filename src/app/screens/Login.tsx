import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, User, ChevronRight, MessageCircle, Search, CalendarCheck, Sparkles, MapPin, ArrowRight, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveLead, supabase } from "@/lib/supabase";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import { useTranslation } from "react-i18next";
import { useStudioCount } from "@/lib/studioCount";
import { trackAccountCreatedConversion, isFreshlyCreatedUser } from "@/lib/adsConversion";
import { trackFunnel } from "@/lib/funnel";



const USER_KEY = "mm-user";

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch { return null; }
}

const HERO_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDxeaNyLnXkeBT2dbpMX2zYNIXLilfjVHy2-ZYdxxt-Qz96RWXVq8ByRIFbypkRZAFsvCYxOUnaj7G0ehW0VPaxP8RE0nks98I9JHL5vxlzFO8kSNuYBqf7wSkzD54uJ3PIN5137TDMdzYAkcbmQPLOi3N4Mlkt8VMgYCPUThkf5Um1vQ4HcYfR17UMpgGa0FTsHTlyXvD5STZOzFyet02k1u8FhrOLN2JiHK8_1dsZNOF_D_oZXuxWZj7hXSJr2j8I4jsAuy49e3mK";

// Editorial spa aesthetic: warm sand palette + Instrument Serif display
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@400;500;600&display=swap";

/**
 * Area names in copy are real links: people tap "Chamberi" expecting to filter,
 * so send them to the studios list preselected to that area.
 */
const AREA_NAMES = [
  "Chamberí", "Chueca", "Salamanca", "Malasaña", "Chamartín", "Centro",
  "Retiro", "La Latina", "Lavapiés", "Argüelles", "Tetuán",
];

function linkifyAreas(text: string) {
  const pattern = new RegExp(`(${AREA_NAMES.join("|")})`, "g");
  return text.split(pattern).map((part, i) =>
    AREA_NAMES.includes(part) ? (
      <Link
        key={`${part}-${i}`}
        to={`/studios?area=${encodeURIComponent(part)}`}
        className="text-[#C4622D] underline underline-offset-2 hover:opacity-80 transition"
      >
        {part}
      </Link>
    ) : (
      <span key={`t-${i}`}>{part}</span>
    ),
  );
}

/**
 * Shared shell with fonts and the warm sand base. Defined at module level: as a
 * component created inside Login it was a new type on every render, so React
 * remounted the whole page on each keystroke and the email field lost focus
 * after one letter.
 *
 * From 900px: one centred 672px column, no scroller of its own (the app
 * shell scrolls) and no sand panel behind it. It also uses the site's own
 * type there, Outfit for text and Fraunces for titles (the serif titles read
 * --login-serif, see `serif` below), so /login matches every other desktop
 * page. Phones keep Work Sans and Instrument Serif.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col h-full overflow-y-auto [font-family:'Work_Sans',system-ui,sans-serif] min-[900px]:h-auto min-[900px]:min-h-full min-[900px]:overflow-visible min-[900px]:!bg-none min-[900px]:font-body min-[900px]:[--login-serif:Fraunces,'EB_Garamond',Georgia,serif] min-[900px]:[--login-serif-w:600]"
      style={{
        background: "linear-gradient(180deg,#F7F4F0 0%,#EFE7DD 100%)",
        color: "#211C1A",
      }}
    >
      <link href={FONT_CSS} rel="stylesheet" />
      <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto min-[900px]:pt-4 min-[900px]:pb-10">{children}</div>
    </div>
  );
}

/** Desktop: tracked uppercase labels read as sentence case at 13px. */
const DESK_LABEL = "min-[900px]:text-[13px] min-[900px]:normal-case min-[900px]:tracking-normal";
/** Desktop: sign-in controls share one 440px column instead of 624px bars. */
const DESK_AUTH_W = "min-[900px]:max-w-[440px]";

export default function Login() {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "app.login" });
  const studioCount = useStudioCount();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createMode = searchParams.get("create") === "1";
  const [step, setStep] = useState<"choice" | "name" | "email">("choice");
  const [name, setName] = useState(getStoredUser()?.name ?? "");
  const [email, setEmail] = useState(getStoredUser()?.email ?? "");
  const [loading, setLoading] = useState(false);

  // Email code (OTP) sign-in
  const [otpEmail, setOtpEmail] = useState(getStoredUser()?.email ?? "");
  const [otpStage, setOtpStage] = useState<"idle" | "code">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const handlingOtp = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const dest = createMode ? "/app/profile" : "/studios";
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) navigate(dest, { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && !handlingOtp.current) navigate(dest, { replace: true });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, createMode]);

  useEffect(() => {
    if (!createMode) return;
    const id = window.setTimeout(() => {
      document.getElementById("mc-email-auth")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("mc-otp-email")?.focus({ preventScroll: true });
    }, 250);
    return () => window.clearTimeout(id);
  }, [createMode]);

  const otpErrorMessage = (raw: string, status?: number) => {
    if (status === 429 || /too_many_requests|rate/i.test(raw)) return t("emailAuth.errors.rateLimited");
    if (/expired/i.test(raw)) return t("emailAuth.errors.expired");
    if (/no_active_code|no active/i.test(raw)) return t("emailAuth.errors.noActiveCode");
    if (/too_many_attempts|attempts/i.test(raw)) return t("emailAuth.errors.tooManyAttempts");
    if (/invalid|wrong|incorrect/i.test(raw)) return t("emailAuth.errors.wrongCode");
    return t("emailAuth.errors.generic");
  };

  const sendCode = async () => {
    if (!otpEmail.includes("@")) {
      toast.error(t("toasts.invalidEmail"));
      return;
    }
    setOtpBusy(true);
    const lang = (i18n.resolvedLanguage || "en").slice(0, 2);
    const { data, error } = await supabase.functions.invoke("email-auth", {
      body: { action: "send", email: otpEmail.trim().toLowerCase(), lang },
    });
    setOtpBusy(false);
    if (error) {
      const status = (error as any)?.context?.status;
      toast.error(otpErrorMessage(`${(error as any)?.message ?? ""} ${JSON.stringify(data ?? {})}`, status));
      return;
    }
    setOtpCode("");
    setOtpStage("code");
    toast.success(t("emailAuth.codeSent", { email: otpEmail.trim().toLowerCase() }));
  };

  const verifyCode = async () => {
    if (otpCode.length !== 6) return;
    setOtpBusy(true);
    handlingOtp.current = true;
    try {
      const { data, error } = await supabase.functions.invoke("email-auth", {
        body: { action: "verify", email: otpEmail.trim().toLowerCase(), code: otpCode },
      });
      if (error || !(data as any)?.token_hash) {
        const status = (error as any)?.context?.status;
        toast.error(otpErrorMessage(`${(error as any)?.message ?? ""} ${JSON.stringify(data ?? {})}`, status));
        return;
      }
      const { error: otpError } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: (data as any).token_hash,
      });
      if (otpError) {
        toast.error(otpErrorMessage(otpError.message));
        return;
      }
      // New email users have no name yet: send them to the profile step first.
      let needsName = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
        // Only a brand-new auth user counts as an account creation conversion.
        const isNew = isFreshlyCreatedUser(user?.created_at);
        if (isNew) trackAccountCreatedConversion();
        trackFunnel(isNew ? "account_created" : "account_signin", { how: "email" });
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, full_name")
            .eq("id", user.id)
            .maybeSingle();
          needsName = !((profile as any)?.first_name || (profile as any)?.full_name || metaName);
        }
      } catch {
        needsName = false;
      }

      navigate(createMode || needsName ? "/app/profile" : "/studios", { replace: true });
    } finally {
      handlingOtp.current = false;
      setOtpBusy(false);
    }
  };

  const handleEmailContinue = async () => {
    if (!email.includes("@")) {
      toast.error(t("toasts.invalidEmail"));
      return;
    }
    setStep("name");
  };

  const handleGoogle = async () => {
    trackFunnel("account_signin", { how: "google" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/studios` },
    });
    if (error) toast.error(t("toasts.googleError"));
  };


  const handleFinalContinue = async () => {
    if (!name.trim()) {
      toast.error(t("toasts.missingName"));
      return;
    }
    setLoading(true);
    const user = { name: name.trim(), email: email.trim() };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    await saveLead(email, name, "app_login");
    setLoading(false);
    toast.success(t("toasts.welcome", { name }));
    navigate("/studios");
  };

  // Phones: Instrument Serif 400 (the variables are unset). From 900px Shell
  // sets them to Fraunces 600, the site's display face.
  const serif = {
    fontFamily: "var(--login-serif, 'Instrument Serif', serif)",
    fontWeight: "var(--login-serif-w, 400)",
  } as React.CSSProperties;

  if (step === "name") {
    return (
      <Shell>
        <div className="flex-1 flex flex-col p-7 pt-10">
          <button
            onClick={() => setStep("choice")}
            className="self-start h-9 w-9 rounded-full border border-[#E5DDD3] bg-white/60 flex items-center justify-center text-[#7A7068]"
          >←</button>
          <div className="flex-1 flex flex-col justify-center">
            <p className={`text-[11px] tracking-[0.25em] uppercase text-[#7A7068] mb-3 ${DESK_LABEL}`}>{t("steps.step2")}</p>
            <h2 style={serif} className="text-5xl leading-[1.05] mb-3 min-[900px]:text-[36px] min-[900px]:leading-[42px]">{t("nameStep.title")}</h2>
            <p className="text-[#7A7068] mb-8">{t("nameStep.subtitle")}</p>
            <div className={`space-y-4 ${DESK_AUTH_W}`}>
              <div>
                <label className={`text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-2 block ${DESK_LABEL}`}>{t("nameStep.label")}</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={t("nameStep.placeholder")}
                  className="w-full h-12 rounded-xl bg-white border border-[#E5DDD3] px-4 text-[#211C1A] placeholder:text-[#9E9387]"
                />
              </div>
              <div>
                <label className={`text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-2 block ${DESK_LABEL}`}>{t("nameStep.phoneLabel")}</label>
                <input
                  type="tel" placeholder={t("nameStep.phonePlaceholder")}
                  className="w-full h-12 rounded-xl bg-white border border-[#E5DDD3] px-4 text-[#211C1A] placeholder:text-[#9E9387]"
                />
              </div>
              <Button
                onClick={handleFinalContinue} disabled={loading}
                className="w-full h-13 mt-2 rounded-full text-base font-medium"
                style={{ background: "#C4622D", color: "#F7F4F0" }}
              >
                {loading ? t("nameStep.loading") : t("nameStep.submit")} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (step === "email") {
    return (
      <Shell>
        <div className="flex-1 flex flex-col p-7 pt-10">
          <button
            onClick={() => setStep("choice")}
            className="self-start h-9 w-9 rounded-full border border-[#E5DDD3] bg-white/60 flex items-center justify-center text-[#7A7068]"
          >←</button>
          <div className="flex-1 flex flex-col justify-center">
            <p className={`text-[11px] tracking-[0.25em] uppercase text-[#7A7068] mb-3 ${DESK_LABEL}`}>{t("steps.step1")}</p>
            <h2 style={serif} className="text-5xl leading-[1.05] mb-3 min-[900px]:text-[36px] min-[900px]:leading-[42px]">{t("emailStep.title")}</h2>
            <p className="text-[#7A7068] mb-8">{t("emailStep.subtitle")}</p>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailStep.placeholder")}
              className={`w-full h-12 rounded-xl bg-white border border-[#E5DDD3] px-4 text-[#211C1A] placeholder:text-[#9E9387] mb-3 ${DESK_AUTH_W}`}
            />
            <Button
              onClick={handleEmailContinue}
              className={`w-full h-13 rounded-full text-base font-medium ${DESK_AUTH_W}`}
              style={{ background: "#C4622D", color: "#F7F4F0" }}
            >
              {t("emailStep.submit")} <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Top bar. From 900px it steps aside when the shared site header (a
          <header> element) is on the page, so the logo and language picker
          are not shown twice. */}
      <div className="flex items-center justify-between px-6 pt-5 min-[900px]:[body:has(header)_&]:hidden">
        <div className="flex items-center gap-2">
          <img src="/brand/mc-avatar-terracotta.png" alt="Massage Club" className="h-8 w-8 rounded-full object-cover" />
          <span className="text-[13px] font-medium tracking-tight text-[#211C1A] min-[900px]:text-[15px]">Massage Club</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageFlagToggle variant="compact" />
          <button
            onClick={() => navigate("/partner/login")}
            className={`text-[11px] font-medium uppercase tracking-[0.15em] text-[#7A7068] hover:text-[#C4622D] ${DESK_LABEL} min-[900px]:text-[14px] min-[900px]:min-h-10`}
          >
            {t("actions.forStudios")} →
          </button>
        </div>
      </div>

      {/* Hero — editorial split */}
      <div className="px-6 pt-6">
        <p className={`text-[11px] tracking-[0.3em] uppercase text-[#7A7068] mb-3 ${DESK_LABEL}`}>{t("hero.established")}</p>
        <h1 style={serif} className="text-[56px] leading-[0.95] tracking-tight text-[#211C1A] min-[900px]:text-[48px] min-[900px]:leading-[54px] min-[900px]:tracking-normal">
          {t("hero.title1")}<br/>
          <em className="text-[#C4622D]">{t("hero.title2")}</em><br/>
          {t("hero.title3")}
        </h1>

        {/* Hero image card. A stock photo, so it is decorative (alt=""), never
            "a Madrid studio". From 900px it is not shown at all (desktop fix
            F2; design system 3.8): its two facts sit in a plain line instead. */}
        <div className="mt-6 relative rounded-[28px] overflow-hidden shadow-[0_20px_50px_-20px_rgba(122,48,0,0.35)] min-[900px]:hidden">
          <img src={HERO_IMG} alt="" className="w-full h-52 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-2 text-xs min-[900px]:text-[13px]">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {t("hero.studiosCount", { studios: studioCount })}</span>
            </div>
            <span className={`text-[10px] uppercase tracking-[0.2em] bg-white/15 backdrop-blur px-2 py-1 rounded-full ${DESK_LABEL} min-[900px]:px-3`}>{t("hero.payAtStudio")}</span>
          </div>
        </div>

        <p className="hidden min-[900px]:flex mt-6 items-center gap-5 text-[15px] text-[#6B615B]">
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#A34A22]" aria-hidden="true" /> {t("hero.studiosCount", { studios: studioCount })}</span>
          <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-[#A34A22]" aria-hidden="true" /> {t("hero.payAtStudio")}</span>
        </p>

        <p className="text-[15px] text-[#7A7068] mt-5 leading-relaxed min-[900px]:text-base min-[900px]:max-w-[36rem] min-[900px]:mt-4">
          {t("hero.description", { studios: studioCount })}
        </p>
      </div>

      {/* CTAs */}
      <div className="px-6 mt-6 space-y-3">
        <Button
          onClick={() => navigate("/studios")}
          className="w-full h-14 rounded-full text-base font-medium shadow-[0_10px_30px_-10px_rgba(122,48,0,0.5)] min-[900px]:w-auto min-[900px]:px-10 min-[900px]:hover:!bg-[#A34A22]"
          style={{ background: "#C4622D", color: "#F7F4F0" }}
        >
          <Search className="h-5 w-5 mr-1" /> {t("actions.browse")}
        </Button>
        <p className="text-[13px] text-[#7A7068] text-center leading-relaxed min-[900px]:text-left min-[900px]:text-sm">
          {t("hero.ctaNote")}
        </p>
        <button
          onClick={() => {
            navigate("/login?create=1");
            requestAnimationFrame(() => document.getElementById("mc-email-auth")?.scrollIntoView({ behavior: "smooth", block: "center" }));
          }}
          className="mx-auto block text-[13px] text-[#7A7068] underline underline-offset-4 hover:text-[#C4622D] min-h-11 min-[900px]:mx-0 min-[900px]:text-sm"
        >
          {i18n.language?.startsWith("es") ? "Crea tu perfil gratis" : "Create a free profile"}
        </button>
        <Button
          onClick={handleGoogle}
          variant="outline"
          className={`w-full h-14 rounded-full text-base font-medium bg-white border-[#E5DDD3] text-[#211C1A] hover:bg-[#F7F4F0] ${DESK_AUTH_W}`}
        >
          <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          {t("actions.google")}
        </Button>

        {/* Email code sign-in */}
        <div className={`flex items-center gap-3 pt-1 ${DESK_AUTH_W}`}>
          <div className="h-px flex-1 bg-[#E5DDD3]" />
          <span className={`text-[11px] uppercase tracking-[0.2em] text-[#9E9387] ${DESK_LABEL} min-[900px]:text-[#7A7068]`}>{t("emailAuth.or")}</span>
          <div className="h-px flex-1 bg-[#E5DDD3]" />
        </div>

        {otpStage === "idle" ? (
          <div id="mc-email-auth" className={`rounded-[20px] bg-white border border-[#E5DDD3] p-4 space-y-3 ${DESK_AUTH_W} min-[900px]:p-5`}>
            {createMode && (
              <div>
                <h2 style={serif} className="text-[26px] leading-tight text-[#211C1A]">{t("emailAuth.createHeading")}</h2>
                <p className="text-[13px] text-[#7A7068] mt-1">{t("emailAuth.createSubheading")}</p>
              </div>
            )}
            <label htmlFor="mc-otp-email" className={`text-[11px] uppercase tracking-[0.2em] text-[#7A7068] block ${DESK_LABEL} min-[900px]:text-sm min-[900px]:font-medium min-[900px]:text-[#211C1A]`}>
              {createMode ? t("emailAuth.createSubmit") : t("emailAuth.continueWithEmail")}
            </label>
            <input
              id="mc-otp-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendCode(); }}
              placeholder={t("emailStep.placeholder")}
              className="w-full h-12 rounded-xl bg-[#F7F4F0] border border-[#E5DDD3] px-4 text-[#211C1A] placeholder:text-[#9E9387] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/40"
            />
            <Button
              onClick={sendCode}
              disabled={otpBusy}
              className="w-full h-12 rounded-full text-base font-medium"
              style={{ background: "#211C1A", color: "#F7F4F0" }}
            >
              {otpBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4 mr-2" />{createMode ? t("emailAuth.createSubmit") : t("emailAuth.continueWithEmail")}</>}
            </Button>
          </div>
        ) : (
          <div className={`rounded-[20px] bg-white border border-[#E5DDD3] p-4 space-y-3 ${DESK_AUTH_W} min-[900px]:p-5`}>
            <p className="text-[13px] text-[#7A7068] leading-relaxed min-[900px]:text-sm">
              {t("emailAuth.codeSent", { email: otpEmail.trim().toLowerCase() })}
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              name="one-time-code"
              pattern="[0-9]*"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onPaste={(e) => {
                const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
                if (!pasted) return;
                e.preventDefault();
                setOtpCode(pasted);
                const el = e.currentTarget;
                requestAnimationFrame(() => {
                  el.focus();
                  el.setSelectionRange(pasted.length, pasted.length);
                });
              }}
              onKeyDown={(e) => { if (e.key === "Enter") verifyCode(); }}
              placeholder="000000"
              aria-label={t("emailAuth.codeLabel")}
              className="w-full h-16 rounded-xl bg-[#F7F4F0] border border-[#E5DDD3] text-center text-[30px] tracking-[0.45em] font-medium text-[#211C1A] placeholder:text-[#D6CCC0] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/40"
            />

            <Button
              onClick={verifyCode}
              disabled={otpBusy || otpCode.length !== 6}
              className="w-full h-12 rounded-full text-base font-medium"
              style={{ background: "#C4622D", color: "#F7F4F0" }}
            >
              {otpBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("emailAuth.signIn")}
            </Button>
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setOtpStage("idle"); setOtpCode(""); }}
                className="text-[12px] text-[#7A7068] hover:text-[#C4622D] min-h-11 min-[900px]:text-[13px]"
              >
                {t("emailAuth.changeEmail")}
              </button>
              <button
                onClick={sendCode}
                disabled={otpBusy}
                className="text-[12px] font-medium text-[#C4622D] hover:underline min-h-11 min-[900px]:text-[13px]"
              >
                {t("emailAuth.resend")}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate("/partner/onboarding")}
          className="w-full text-center text-[13px] text-[#7A7068] hover:text-[#C4622D] pt-1 min-[900px]:w-auto min-[900px]:text-left min-[900px]:text-sm min-[900px]:min-h-10"
        >
          {t("actions.ownStudio")} <span className="text-[#C4622D] font-medium">{t("actions.listFree")} →</span>
        </button>
      </div>

      {/* New in Madrid */}
      <div className="px-6 mt-10">

        <div className="rounded-[24px] bg-white border border-[#E5DDD3] p-6 min-[900px]:p-8">
          <p className={`text-[10px] uppercase tracking-[0.3em] text-[#C4622D] mb-2 ${DESK_LABEL} min-[900px]:font-medium`}>{t("newInMadrid.eyebrow")}</p>
          <h2 style={serif} className="text-[26px] leading-tight text-[#211C1A] mb-3">{t("newInMadrid.heading")}</h2>
          <p className="text-[15px] text-[#7A7068] leading-relaxed min-[900px]:text-base min-[900px]:max-w-[36rem]">{t("newInMadrid.body")}</p>
        </div>
      </div>


      {/* How it works — editorial three column */}
      <div className="px-6 mt-10">
        <p className={`text-[11px] uppercase tracking-[0.3em] text-[#7A7068] mb-5 ${DESK_LABEL} min-[900px]:text-[15px] min-[900px]:font-semibold min-[900px]:text-[#211C1A]`}>{t("howItWorks.title")}</p>
        <div className="space-y-5 min-[900px]:space-y-0 min-[900px]:grid min-[900px]:grid-cols-3 min-[900px]:gap-6">
          {[
            { n: "01", icon: Search, title: t("howItWorks.step1.title"), sub: t("howItWorks.step1.subtitle") },
            { n: "02", icon: CalendarCheck, title: t("howItWorks.step2.title"), sub: t("howItWorks.step2.subtitle") },
            { n: "03", icon: Sparkles, title: t("howItWorks.step3.title"), sub: t("howItWorks.step3.subtitle") },
          ].map(({ n, icon: Icon, title, sub }) => (
            <div key={n} className="flex items-start gap-4 pb-4 border-b border-[#E5DDD3] last:border-0 min-[900px]:flex-col min-[900px]:gap-3 min-[900px]:pb-0 min-[900px]:border-b-0 min-[900px]:border-t min-[900px]:pt-4">
              <div style={serif} className="text-[32px] leading-none text-[#E0A458] w-10">{n}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-[#C4622D]" />
                  <p style={serif} className="text-xl text-[#211C1A]">{title}</p>
                </div>
                <p className="text-sm text-[#7A7068] min-[900px]:leading-relaxed">{linkifyAreas(sub)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust */}
      <div className="px-6 mt-8">
        <div className="space-y-3">
          {[t("trust.line1"), t("trust.line2"), t("trust.line3")].map((line, i) => (
            <p key={i} className="text-sm text-[#7A7068] leading-relaxed min-[900px]:text-[15px] min-[900px]:max-w-[36rem]">{line}</p>
          ))}
        </div>
      </div>


      {/* Studio CTA — refined card */}
      <div className="px-6 mt-10">
        <div
          className="rounded-[24px] p-6 relative overflow-hidden min-[900px]:p-8"
          style={{ background: "linear-gradient(135deg,#211C1A 0%,#211C1A 100%)", color: "#F7F4F0" }}
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full" style={{ background: "rgba(212,161,85,0.18)", filter: "blur(20px)" }} />
          <p className={`text-[10px] uppercase tracking-[0.3em] text-[#E0A458] mb-2 ${DESK_LABEL} min-[900px]:font-medium`}>{t("studioCard.label")}</p>
          <h3 style={serif} className="text-[28px] leading-tight mb-2">{t("studioCard.title")}</h3>
          <p className="text-sm text-[#F7F4F0]/70 mb-4 min-[900px]:text-[15px] min-[900px]:max-w-[34rem] min-[900px]:text-[#F7F4F0]/80">{t("studioCard.subtitle")}</p>
          <button
            onClick={() => navigate("/partner/onboarding")}
            className="inline-flex items-center gap-2 bg-[#F7F4F0] text-[#211C1A] px-5 h-11 rounded-full text-sm font-medium hover:bg-white"
          >
            {t("studioCard.button")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Save details — quiet */}
      <div className="px-6 mt-8 pt-6 border-t border-[#E5DDD3] min-[900px]:mx-6 min-[900px]:px-0">
        <p className={`text-[11px] uppercase tracking-[0.2em] text-[#7A7068] mb-3 text-center ${DESK_LABEL} min-[900px]:text-left min-[900px]:text-sm`}>{t("saveDetails.title")}</p>
        <div className={`flex gap-2 ${DESK_AUTH_W}`}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailStep.placeholder")}
            className="flex-1 h-11 rounded-full bg-white border border-[#E5DDD3] px-4 text-sm text-[#211C1A] placeholder:text-[#9E9387]"
          />
          <button
            onClick={handleEmailContinue}
            className="h-11 px-5 rounded-full bg-[#211C1A] text-[#F7F4F0] text-sm font-medium hover:bg-[#211C1A]"
          >
            {t("saveDetails.button")}
          </button>
        </div>
      </div>

      {/* Feedback */}
      <button
        onClick={() => navigate("/survey")}
        className="w-full flex items-center justify-center gap-2 mt-4 mb-6 py-2 text-[11px] text-[#7A7068] hover:text-[#C4622D] min-[900px]:w-auto min-[900px]:self-start min-[900px]:mx-6 min-[900px]:text-[13px] min-[900px]:mb-0"
      >
        <MessageCircle className="h-3 w-3" />
        {t("feedback")}
      </button>
    </Shell>
  );
}
