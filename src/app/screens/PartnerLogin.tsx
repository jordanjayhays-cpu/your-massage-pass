import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Mail, Lock, ArrowRight, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PartnerLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState("");

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
        setError("Invalid email or password");
        setLoading(false);
        return;
      }
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

  const handleMagicLink = async () => {
    if (!email) { setError("Enter your email first"); return; }
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
          <h1 className="font-display text-3xl font-bold text-foreground">Partner Portal</h1>
          <p className="text-muted-foreground mt-2">List your spa on Massage Pass</p>
        </div>

        <Card className="bg-card border-border shadow-elegant">
          <CardContent className="p-8">
            {/* Mode toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                  mode === "login" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                  mode === "register" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                List My Spa
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">
                    Business Name
                  </label>
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Wellness Center Madrid"
                    required
                    className="h-11"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="spa@example.com"
                    required
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Password
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
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-xl">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
              >
                {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-border flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
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
                  Continue with Google
                </>
              )}
            </Button>

            {magicSent ? (
              <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3 text-center">
                <p className="text-sm font-medium text-foreground">Check your email for a login link.</p>
                <p className="text-xs text-muted-foreground mt-1">Sent to {email}.</p>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleMagicLink}
                disabled={magicLoading}
                variant="outline"
                className="w-full h-11 mt-3"
              >
                {magicLoading ? "Sending…" : "Continue with email"}
              </Button>
            )}

            {mode === "login" && (
              <p className="text-xs text-center text-muted-foreground mt-4">
                Demo: sign up first, then sign in with that account.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Benefits for registering */}
        {mode === "register" && (
          <div className="mt-6 space-y-3">
            {[
              "Reach 12,000+ digital nomads in Madrid",
              "Commission-only — no upfront cost",
              "Get bookings 24/7 automatically",
            ].map((b) => (
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
