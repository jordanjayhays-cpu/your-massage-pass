import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PartnerResetPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) setHasSession(true);
      setChecking(false);
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("app.partnerAuth.errShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("app.partnerAuth.errMismatch"));
      return;
    }
    setSaving(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    navigate("/partner/dashboard");
  };

  const handleResend = async () => {
    setError("");
    if (!email) {
      setError(t("app.partnerAuth.errEmailFirst"));
      return;
    }
    const { error: resErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/partner/reset-password`,
    });
    if (resErr) {
      setError(resErr.message);
      return;
    }
    setResent(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-[#B85C38] flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#2b2b2b]">
            {t("app.partnerAuth.resetTitle")}
          </h1>
        </div>

        <Card className="bg-white border border-[#E5DDD3] rounded-2xl">
          <CardContent className="p-6">
            {checking ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#B85C38]" />
              </div>
            ) : hasSession ? (
              <form onSubmit={handleSave} className="space-y-4">
                <p className="text-sm text-[#7A7068]">{t("app.partnerAuth.resetHelp")}</p>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9E9387]" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("app.partnerAuth.newPassword")}
                    className="pl-10 h-11"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9E9387]" />
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder={t("app.partnerAuth.confirmPassword")}
                    className="pl-10 h-11"
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-xl">{error}</p>
                )}
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full h-12 bg-[#B85C38] hover:bg-[#9E4D22] text-white"
                >
                  {saving ? t("app.common.loading") : t("app.partnerAuth.savePassword")}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#7A7068]">{t("app.partnerAuth.linkExpired")}</p>
                {resent ? (
                  <div className="rounded-xl border border-[#E5DDD3] bg-[#FAF6F1] p-3 text-center">
                    <p className="text-sm font-medium text-[#2b2b2b]">
                      {t("app.partnerAuth.resetSent")}
                    </p>
                  </div>
                ) : (
                  <>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="spa@example.com"
                      className="h-11"
                    />
                    {error && (
                      <p className="text-sm text-red-600 bg-red-500/10 p-3 rounded-xl">{error}</p>
                    )}
                    <Button
                      type="button"
                      onClick={handleResend}
                      className="w-full h-11 bg-[#B85C38] hover:bg-[#9E4D22] text-white"
                    >
                      {t("app.partnerAuth.sendNewLink")}
                    </Button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/partner/login")}
                  className="w-full text-xs text-[#7A7068] hover:text-[#B85C38] underline underline-offset-2"
                >
                  {t("app.partnerAuth.backToLogin")}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
