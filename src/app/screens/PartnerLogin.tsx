import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Mail, Lock, ArrowRight, Loader2, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PartnerLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);

  // Collapsed options
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [showGoogleLogin, setShowGoogleLogin] = useState(false);

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // ─── OTP: Send code ───
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: mode === "register" },
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setOtpSent(true);
    setLoading(false);
  };

  // ─── OTP: Verify code ───
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) return;
    setLoading(true);
    setError("");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "email",
    });

    if (verifyError) {
      setError("Código inválido. Inténtalo de nuevo.");
      setLoading(false);
      return;
    }

    // Always go to dashboard after successful auth
    navigate("/partner/dashboard");
  };

  // ─── Password login (collapsed option) ───
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Email o contraseña incorrectos");
      setLoading(false);
      return;
    }
    navigate("/partner/dashboard");
  };

  // ─── Google login (collapsed option) ───
  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/partner/dashboard` },
    });
    if (googleError) {
      setError(googleError.message);
      setLoading(false);
    }
  };

  // ─── Register (OTP) ───
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setError("Enter your business name");
      return;
    }
    setLoading(true);
    setError("");

    // Sign up with password (needed for partner record creation)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { business_name: businessName } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("partners").insert({
        id: data.user.id,
        business_name: businessName,
        email,
        status: "pending",
      });
      navigate("/partner/dashboard");
    }
    setLoading(false);
  };

  // ─── Forgot password ───
  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email first");
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/partner/reset-password`,
    });
    if (resetError) {
      setError(resetError.message);
    } else {
      setError("Check your email to reset your password");
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

            {/* ─── OTP STEP 1: Email ─── */}
            {!otpSent ? (
              <>
                {/* Mode toggle */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => { setMode("login"); setShowPasswordField(false); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                      mode === "login" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    onClick={() => { setMode("register"); setShowPasswordField(false); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                      mode === "register" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    Dar de alta mi spa
                  </button>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  {mode === "register" && (
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1.5 block">
                        Nombre del negocio
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

                  {error && (
                    <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-xl">{error}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Enviarme código de acceso</>
                    )}
                  </Button>
                </form>

                {/* Forgot password link */}
                {mode === "login" && (
                  <button
                    onClick={handleForgotPassword}
                    className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground transition"
                  >
                    ¿Olvidaste la contraseña?
                  </button>
                )}

                {/* ─── Collapsed: Password login ─── */}
                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => { setShowPasswordLogin(!showPasswordLogin); setShowGoogleLogin(false); }}
                    className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    <span>Usar contraseña</span>
                    {showPasswordLogin ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showPasswordLogin && (
                    <form onSubmit={handlePasswordLogin} className="mt-3 space-y-3">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Contraseña"
                          className="pl-10 h-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 bg-secondary text-foreground hover:bg-secondary/80"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar sesión"}
                      </Button>
                    </form>
                  )}
                </div>

                {/* ─── Collapsed: Google login ─── */}
                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => { setShowGoogleLogin(!showGoogleLogin); setShowPasswordLogin(false); }}
                    className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continuar con Google</span>
                    {showGoogleLogin ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showGoogleLogin && (
                    <Button
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      variant="outline"
                      className="w-full h-11 mt-3"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar con Google"}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              /* ─── OTP STEP 2: Verify code ─── */
              <>
                <div className="text-center mb-6">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="font-semibold text-lg">Código enviado</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hemos enviado un código a<br />
                    <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block text-center">
                      Introduce el código de 6 dígitos
                    </label>
                    <Input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="h-14 text-center text-2xl tracking-widest font-mono"
                      autoFocus
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-xl text-center">{error}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Verificar y entrar</>
                    )}
                  </Button>
                </form>

                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => { setOtpSent(false); setOtpCode(""); }}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    Usar otro email
                  </button>
                  <button
                    onClick={handleSendOtp}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    Reenviar código
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Benefits for registering */}
        {mode === "register" && !otpSent && (
          <div className="mt-6 space-y-3">
            {[
              "Alcanza a 12,000+ nómadas digitales en Madrid",
              "Solo comisión — sin coste inicial",
              "Recibe reservas 24/7 automáticamente",
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
