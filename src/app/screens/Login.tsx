import { useNavigate } from "react-router-dom";
import { Mail, User, ChevronRight, MessageCircle, Search, CalendarCheck, Sparkles, Star, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { saveLead, supabase } from "@/lib/supabase";


// Store user info in localStorage for booking flow
const USER_KEY = "mm-user";

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch { return null; }
}

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"choice" | "name" | "email">("choice");
  const [name, setName] = useState(getStoredUser()?.name ?? "");
  const [email, setEmail] = useState(getStoredUser()?.email ?? "");
  const [loading, setLoading] = useState(false);

  // If the user is already signed in (or completes Google OAuth and lands back here),
  // route them straight to the studios map.
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
      toast.error("Please enter a valid email");
      return;
    }
    setStep("name");
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app/massages` },
    });
    // If the Google provider isn't enabled in Supabase yet, fail gracefully.
    if (error) toast.error("Google sign-in isn't switched on yet — browse as guest for now.");
  };

  const handleFinalContinue = async () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setLoading(true);

    // Save to localStorage for booking flow
    const user = { name: name.trim(), email: email.trim() };
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    // Also save to Supabase leads
    await saveLead(email, name, "app_login");

    setLoading(false);
    toast.success(`Welcome, ${name}!`);
    navigate("/app/massages");
  };

  if (step === "name") {
    return (
      <div className="flex flex-col h-full bg-gradient-hero text-primary-foreground p-8">
        <div className="flex-1 flex flex-col justify-center">
          <button
            onClick={() => setStep("choice")}
            className="absolute top-6 left-6 h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center"
          >
            ←
          </button>
          <div className="mb-8">
            <div className="h-16 w-16 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold mb-6">
              <User className="h-8 w-8 text-foreground" />
            </div>
            <h2 className="font-display text-3xl font-bold mb-2">Almost there!</h2>
            <p className="text-primary-foreground/80">Just need your name.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-primary-foreground/60 mb-2 block">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Martinez"
              className="w-full h-12 rounded-xl bg-primary-foreground/10 border border-primary-foreground/30 px-4 text-primary-foreground placeholder:text-primary-foreground/50 text-base"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-primary-foreground/60 mb-2 block">
              Phone (for SMS confirmations)
            </label>
            <input
              type="tel"
              placeholder="+34 600 000 000"
              className="w-full h-12 rounded-xl bg-primary-foreground/10 border border-primary-foreground/30 px-4 text-primary-foreground placeholder:text-primary-foreground/50 text-base"
            />
          </div>
          <Button
            onClick={handleFinalContinue}
            disabled={loading}
            className="w-full h-12 bg-foreground text-primary-foreground hover:bg-foreground/90"
          >
            {loading ? "Setting up…" : "Start booking →"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "email") {
    return (
      <div className="flex flex-col h-full bg-gradient-hero text-primary-foreground p-8">
        <div className="flex-1 flex flex-col justify-center">
          <button
            onClick={() => setStep("choice")}
            className="absolute top-6 left-6 h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center"
          >
            ←
          </button>
          <div className="mb-8">
            <div className="h-16 w-16 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold mb-6">
              <Mail className="h-8 w-8 text-foreground" />
            </div>
            <h2 className="font-display text-3xl font-bold mb-2">Your email</h2>
            <p className="text-primary-foreground/80">For booking confirmations and receipts.</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full h-12 rounded-xl bg-primary-foreground/10 border border-primary-foreground/30 px-4 text-primary-foreground placeholder:text-primary-foreground/50 text-base"
          />
          <Button
            onClick={handleEmailContinue}
            className="w-full h-12 bg-foreground text-primary-foreground hover:bg-foreground/90"
          >
            Continue <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gradient-hero text-primary-foreground">
      <div className="px-7 pt-12 pb-8 min-h-full flex flex-col">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold mb-5">
            <span className="font-display font-bold text-foreground text-2xl">M</span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Madrid's best massages,<br />booked in seconds.
          </h1>
          <p className="text-primary-foreground/80 max-w-xs mt-3">
            Discover top studios near you and book instantly. Free to browse — no account needed to look around.
          </p>

          {/* Social proof */}
          <div className="flex items-center gap-3 mt-5 text-sm text-primary-foreground/80">
            <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-accent text-accent" /> 4.8</span>
            <span className="opacity-40">·</span>
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> 12+ studios</span>
            <span className="opacity-40">·</span>
            <span>Madrid</span>
          </div>
        </div>

        {/* CTAs — Google or guest */}
        <div className="mt-8 space-y-3">
          <Button
            onClick={handleGoogle}
            className="w-full h-14 bg-white text-gray-800 hover:bg-white/90 text-base font-semibold rounded-2xl"
          >
            <svg className="h-5 w-5 mr-1" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continue with Google
          </Button>
          <Button
            onClick={() => navigate("/app/massages")}
            variant="outline"
            className="w-full h-14 bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground text-base font-semibold rounded-2xl"
          >
            <Search className="h-5 w-5" /> Browse as guest — no account
          </Button>
        </div>

        {/* How it works */}
        <div className="mt-8 space-y-4">
          <p className="text-xs uppercase tracking-widest text-primary-foreground/50 text-center">How it works</p>
          {[
            { icon: Search, title: "Find a studio", sub: "Browse top-rated spots near you." },
            { icon: CalendarCheck, title: "Pick a time", sub: "Book instantly — pressure, focus, add-ons." },
            { icon: Sparkles, title: "Show up & relax", sub: "Get a confirmation. That's it." },
          ].map(({ icon: Icon, title, sub }, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-2xl bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-primary-foreground/70">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {/* Optional: save details (light, not a wall) */}
        <div className="mt-8 pt-5 border-t border-primary-foreground/20">
          <p className="text-xs text-primary-foreground/60 text-center mb-3">Save your details for faster booking (optional)</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full h-12 rounded-xl bg-primary-foreground/10 border border-primary-foreground/30 px-4 text-primary-foreground placeholder:text-primary-foreground/50 text-base mb-3"
          />
          <Button
            onClick={handleEmailContinue}
            variant="outline"
            className="w-full h-12 bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            Save & continue <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Feedback link — for early users */}
        <button
          onClick={() => navigate("/survey")}
          className="w-full flex items-center justify-center gap-2 mt-4 py-2 text-xs text-primary-foreground/50 hover:text-primary-foreground/80 transition"
        >
          <MessageCircle className="h-3 w-3" />
          Share feedback — help us build this
        </button>
      </div>
    </div>
  );
}
