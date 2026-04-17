import { useNavigate } from "react-router-dom";
import { Apple, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Login() {
  const navigate = useNavigate();

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
          onClick={() => navigate("/app/massages")}
          variant="outline"
          className="w-full h-12 bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <Mail className="h-5 w-5" /> Continue with Email
        </Button>
        <p className="text-center text-xs text-primary-foreground/60 pt-4">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
