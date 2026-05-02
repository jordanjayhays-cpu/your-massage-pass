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
      navigate("/partner/onboarding");
    }
    setLoading(false);
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
