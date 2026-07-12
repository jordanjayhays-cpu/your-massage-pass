import { useNavigate } from "react-router-dom";
import { Mail, User, ChevronRight, MessageCircle, Search, CalendarCheck, Sparkles, Star, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { saveLead, supabase } from "@/lib/supabase";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import { useTranslation } from "react-i18next";

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

export default function Login() {
  const { t } = useTranslation(undefined, { keyPrefix: "app.login" });
  const navigate = useNavigate();
  const [step, setStep] = useState<"choice" | "name" | "email">("choice");
  const [name, setName] = useState(getStoredUser()?.name ?? "");
  const [email, setEmail] = useState(getStoredUser()?.email ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) navigate("/app/massages", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate("/app/massages", { replace: true });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleEmailContinue = async () => {
    if (!email.includes("@")) {
      toast.error(t("toasts.invalidEmail"));
      return;
    }
    setStep("name");
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app/massages` },
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
    navigate("/app/massages");
  };

  // Shared shell with fonts + warm sand base
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{
        background: "linear-gradient(180deg,#F7F4F0 0%,#EFE7DD 100%)",
        color: "#211C1A",
        fontFamily: "'Work Sans', system-ui, sans-serif",
      }}
    >
      <link href={FONT_CSS} rel="stylesheet" />
      {children}
    </div>
  );

  const serif = { fontFamily: "'Instrument Serif', serif", fontWeight: 400 };

  if (step === "name") {
    return (
      <Shell>
        <div className="flex-1 flex flex-col p-7 pt-10">
          <button
            onClick={() => setStep("choice")}
            className="self-start h-9 w-9 rounded-full border border-[#E5DDD3] bg-white/60 flex items-center justify-center text-[#7A7068]"
          >←</button>
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[11px] tracking-[0.25em] uppercase text-[#7A7068] mb-3">{t("steps.step2")}</p>
            <h2 style={serif} className="text-5xl leading-[1.05] mb-3">{t("nameStep.title")}</h2>
            <p className="text-[#7A7068] mb-8">{t("nameStep.subtitle")}</p>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-2 block">{t("nameStep.label")}</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={t("nameStep.placeholder")}
                  className="w-full h-12 rounded-xl bg-white border border-[#E5DDD3] px-4 text-[#211C1A] placeholder:text-[#9E9387]"
                />
              </div>
              <div>
                <label className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-2 block">{t("nameStep.phoneLabel")}</label>
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
            <p className="text-[11px] tracking-[0.25em] uppercase text-[#7A7068] mb-3">{t("steps.step1")}</p>
            <h2 style={serif} className="text-5xl leading-[1.05] mb-3">{t("emailStep.title")}</h2>
            <p className="text-[#7A7068] mb-8">{t("emailStep.subtitle")}</p>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailStep.placeholder")}
              className="w-full h-12 rounded-xl bg-white border border-[#E5DDD3] px-4 text-[#211C1A] placeholder:text-[#9E9387] mb-3"
            />
            <Button
              onClick={handleEmailContinue}
              className="w-full h-13 rounded-full text-base font-medium"
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
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-full flex items-center justify-center text-[11px]"
                style={{ background: "#C4622D", color: "#F7F4F0", ...serif, fontSize: 14 }}>M</span>
          <span className="text-[13px] font-medium tracking-tight text-[#211C1A]">Massage Club</span>
        </div>
        <button
          onClick={() => navigate("/partner/login")}
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-[#7A7068] hover:text-[#C4622D]"
        >
          {t("actions.forStudios")} →
        </button>
      </div>

      {/* Language picker — single flag, tap to choose */}
      <div className="px-6 mt-5 flex justify-center">
        <LanguageFlagToggle variant="compact" />
      </div>

      {/* Hero — editorial split */}
      <div className="px-6 pt-8">
        <p className="text-[11px] tracking-[0.3em] uppercase text-[#7A7068] mb-4">{t("hero.established")}</p>
        <h1 style={serif} className="text-[56px] leading-[0.95] tracking-tight text-[#211C1A]">
          {t("hero.title1")}<br/>
          <em className="text-[#C4622D]">{t("hero.title2")}</em><br/>
          {t("hero.title3")}
        </h1>

        {/* Hero image card */}
        <div className="mt-6 relative rounded-[28px] overflow-hidden shadow-[0_20px_50px_-20px_rgba(122,48,0,0.35)]">
          <img src={HERO_IMG} alt={t("hero.imageAlt")} className="w-full h-52 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-[#E0A458] text-[#E0A458]" /> 4.8</span>
              <span className="opacity-50">·</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {t("hero.studiosCount")}</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] bg-white/15 backdrop-blur px-2 py-1 rounded-full">{t("hero.payAtStudio")}</span>
          </div>
        </div>

        <p className="text-[15px] text-[#7A7068] mt-5 leading-relaxed">
          {t("hero.description")}
        </p>
      </div>

      {/* CTAs */}
      <div className="px-6 mt-6 space-y-3">
        <Button
          onClick={() => navigate("/app/massages")}
          className="w-full h-14 rounded-full text-base font-medium shadow-[0_10px_30px_-10px_rgba(122,48,0,0.5)]"
          style={{ background: "#C4622D", color: "#F7F4F0" }}
        >
          <Search className="h-5 w-5 mr-1" /> {t("actions.browse")}
        </Button>
        <Button
          onClick={handleGoogle}
          variant="outline"
          className="w-full h-14 rounded-full text-base font-medium bg-white border-[#E5DDD3] text-[#211C1A] hover:bg-[#F7F4F0]"
        >
          <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          {t("actions.google")}
        </Button>
        <button
          onClick={() => navigate("/partner/onboarding")}
          className="w-full text-center text-[13px] text-[#7A7068] hover:text-[#C4622D] pt-1"
        >
          {t("actions.ownStudio")} <span className="text-[#C4622D] font-medium">{t("actions.listFree")} →</span>
        </button>
      </div>

      {/* How it works — editorial three column */}
      <div className="px-6 mt-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#7A7068] mb-5">{t("howItWorks.title")}</p>
        <div className="space-y-5">
          {[
            { n: "01", icon: Search, title: t("howItWorks.step1.title"), sub: t("howItWorks.step1.subtitle") },
            { n: "02", icon: CalendarCheck, title: t("howItWorks.step2.title"), sub: t("howItWorks.step2.subtitle") },
            { n: "03", icon: Sparkles, title: t("howItWorks.step3.title"), sub: t("howItWorks.step3.subtitle") },
          ].map(({ n, icon: Icon, title, sub }) => (
            <div key={n} className="flex items-start gap-4 pb-4 border-b border-[#E5DDD3] last:border-0">
              <div style={serif} className="text-[32px] leading-none text-[#E0A458] w-10">{n}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-[#C4622D]" />
                  <p style={serif} className="text-xl text-[#211C1A]">{title}</p>
                </div>
                <p className="text-sm text-[#7A7068]">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Studio CTA — refined card */}
      <div className="px-6 mt-10">
        <div
          className="rounded-[24px] p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#211C1A 0%,#211C1A 100%)", color: "#F7F4F0" }}
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full" style={{ background: "rgba(212,161,85,0.18)", filter: "blur(20px)" }} />
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#E0A458] mb-2">{t("studioCard.label")}</p>
          <h3 style={serif} className="text-[28px] leading-tight mb-2">{t("studioCard.title")}</h3>
          <p className="text-sm text-[#F7F4F0]/70 mb-4">{t("studioCard.subtitle")}</p>
          <button
            onClick={() => navigate("/partner/onboarding")}
            className="inline-flex items-center gap-2 bg-[#F7F4F0] text-[#211C1A] px-5 h-11 rounded-full text-sm font-medium hover:bg-white"
          >
            {t("studioCard.button")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Save details — quiet */}
      <div className="px-6 mt-8 pt-6 border-t border-[#E5DDD3]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#7A7068] mb-3 text-center">{t("saveDetails.title")}</p>
        <div className="flex gap-2">
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
        className="w-full flex items-center justify-center gap-2 mt-4 mb-6 py-2 text-[11px] text-[#7A7068] hover:text-[#C4622D]"
      >
        <MessageCircle className="h-3 w-3" />
        {t("feedback")}
      </button>
    </Shell>
  );
}
