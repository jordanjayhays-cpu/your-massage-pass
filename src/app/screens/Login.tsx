import { useNavigate } from "react-router-dom";
import { Apple, Mail, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { saveLead } from "@/lib/supabase";

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

  const handleEmailContinue = async () => {
    if (!email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    setStep("name");
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
    <div className="flex flex-col h-full bg-gradient-hero text-primary-foreground p-8">
      <div className="flex-1 flex flex-col justify-center items-center text-center">
        <div className="h-20 w-20 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold mb-8">
          <span className="font-display font-bold text-foreground text-3xl">M</span>
        </div>
        <h1 className="font-display text-4xl font-bold mb-3">Massage Madrid</h1>
        <p className="text-primary-foreground/80 max-w-xs">
          Unlimited massages at the best studios in the capital.
        </p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => navigate("/app/massages")}
          className="w-full h-12 bg-foreground text-primary-foreground hover:bg-foreground/90"
        >
          <Apple className="h-5 w-5" /> Continue with Apple
        </Button>
        <Button
          onClick={() => setStep("email")}
          variant="outline"
          className="w-full h-12 bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <Mail className="h-5 w-5" /> Continue with Email
        </Button>

        {/* Quick entry */}
        <div className="mt-4 pt-4 border-t border-primary-foreground/20">
          <p className="text-xs text-primary-foreground/60 text-center mb-3">Or enter your details to get started</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full h-12 rounded-xl bg-primary-foreground/10 border border-primary-foreground/30 px-4 text-primary-foreground placeholder:text-primary-foreground/50 text-base mb-3"
          />
          <Button
            onClick={handleEmailContinue}
            className="w-full h-12 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          >
            Get Started <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <p className="text-center text-xs text-primary-foreground/60 pt-4">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
