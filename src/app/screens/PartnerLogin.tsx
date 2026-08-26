import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Mail, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loadPartnerLang } from "@/app/lib/partnerLanguage";

export default function PartnerLogin() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [view, setView] = useState<"login" | "recover">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState("");

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "register") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { business_name: businessName }
        }
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      if (data.user) {
        // Create partner record in DB
        await supabase.from("partners").insert({
          id: data.user.id,
          business_name: businessName,
          email,
          status: "pending"
        });
        navigate("/partner/onboarding");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(t("partner.login.errInvalidCredentials"));
        setLoading(false);
        return;
      }
      await loadPartnerLang();
      navigate("/partner/dashboard");
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/partner/dashboard` },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setGoogleLoading(false);
    }
  };

  const switchToRecovery = () => {
    setRecoveryEmail(email);
    setView("recover");
    setRecoverySent(false);
    setError("");
  };

  const sendResetLink = async () => {
    const trimmed = recoveryEmail.trim();
    if (!trimmed) {
      setError(t("partner.login.recovery.errEmailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("partner.login.recovery.errInvalidEmail"));
      return;
    }
    setRecoveryLoading(true);
    setError("");
    const { error: resErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/partner/reset-password`,
    });
    setRecoveryLoading(false);
    if (resErr) {
      setError(resErr.message);
      return;
    }
    setRecoverySent(true);
    setResendCountdown(30);
  };

  const handleSendReset = (e: React.FormEvent) => {
    e.preventDefault();
    sendResetLink();
  };

  const handleResend = () => {
    if (resendCountdown > 0 || recoveryLoading) return;
    sendResetLink();
  };

  const handleMagicLink = async () => {
    if (!email) { setError(t("partner.login.errEmailFirst")); return; }
    setMagicLoading(true);
    setError("");
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    setMagicLoading(false);
    if (otpErr) { setError(otpErr.message); return; }
    setMagicSent(true);
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-royal flex items-center justify-center mx-auto mb-4 shadow-elegant">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">{t("partner.login.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("partner.login.subtitle")}</p>
          <Link
            to="/for-studios"
            className="inline-block mt-3 text-xs font-medium text-primary hover:underline"
          >
            Read the terms for studios / Lee las condiciones para centros
          </Link>
        </div>

        <Card className="bg-card border-border shadow-elegant">
          <CardContent className="p-8">
            {view === "login" ? (
              <>
                {/* Mode toggle */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setMode("login")}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                      mode === "login" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    {t("partner.login.signInTab")}
                  </button>
                  <button
                    onClick={() => setMode("register")}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                      mode === "register" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    {t("partner.login.registerTab")}
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "register" && (
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1.5 block">
                        {t("partner.login.businessNameLabel")}
                      </label>
                      <Input
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder={t("partner.login.businessNamePlaceholder")}
                        required
                        className="h-11"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">
                      {t("partner.login.emailLabel")}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("partner.login.emailPlaceholder")}
                        required
                        className="pl-10 h-11"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">
                      {t("partner.login.passwordLabel")}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="pl-10 h-11"
                      />
                    </div>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={switchToRecovery}
                        className="text-xs text-primary hover:underline mt-2"
                      >
                        {t("app.partnerAuth.forgotPassword")}
                      </button>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-xl">{error}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
                  >
                    {loading ? t("partner.login.pleaseWait") : mode === "login" ? t("partner.login.signInTab") : t("partner.login.createAccount")}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>

                <div className="flex items-center gap-3 my-4">
                  <div className="h-px bg-border flex-1" />
                  <span className="text-xs text-muted-foreground">{t("partner.login.or")}</span>
                  <div className="h-px bg-border flex-1" />
                </div>

                <Button
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleLoading}
                  className="w-full h-11 bg-white text-foreground border border-border hover:bg-secondary"
                >
                  {googleLoading ? "…" : (
                    <>
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {t("partner.login.continueWithGoogle")}
                    </>
                  )}
                </Button>

                {magicSent ? (
                  <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3 text-center">
                    <p className="text-sm font-medium text-foreground">{t("partner.login.magicLinkSentTitle")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("partner.login.magicLinkSentTo", { email })}</p>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={magicLoading}
                    variant="outline"
                    className="w-full h-11 mt-3"
                  >
                    {magicLoading ? t("partner.login.sending") : t("app.partnerAuth.magicLinkOption")}
                  </Button>
                )}

                {mode === "login" && (
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    {t("partner.login.demoHint")}
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {!recoverySent ? (
                  <form onSubmit={handleSendReset} className="space-y-4">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-foreground">
                        {t("partner.login.recovery.title")}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("partner.login.recovery.subtitle")}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1.5 block">
                        {t("partner.login.emailLabel")}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          placeholder={t("partner.login.emailPlaceholder")}
                          required
                          className="pl-10 h-11"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-xl">{error}</p>
                    )}

                    <Button
                      type="submit"
                      disabled={recoveryLoading}
                      className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
                    >
                      {recoveryLoading ? t("partner.login.sending") : t("partner.login.recovery.send")}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setView("login");
                        setRecoverySent(false);
                        setError("");
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      ← {t("partner.login.recovery.back")}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-secondary/40 p-4 text-center">
                      <p className="text-sm font-medium text-foreground">
                        {t("partner.login.recovery.sentTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("partner.login.recovery.sentSubtitle")}
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCountdown > 0 || recoveryLoading}
                      variant="outline"
                      className="w-full h-11"
                    >
                      {resendCountdown > 0
                        ? t("partner.login.recovery.resendIn", { seconds: resendCountdown })
                        : t("partner.login.recovery.resend")}
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setView("login");
                        setRecoverySent(false);
                        setError("");
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      ← {t("partner.login.recovery.back")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Benefits for registering */}
        {mode === "register" && view === "login" && (
          <div className="mt-6 space-y-3">
            {(t("partner.login.benefits", { returnObjects: true }) as string[]).map((b) => (
              <div key={b} className="flex items-center gap-3 text-sm text-foreground/80">
                <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent text-sm">✓</span>
                </div>
                {b}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
