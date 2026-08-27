import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

const LEAD_ENDPOINT = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/lead";
const SUPPORT_WHATSAPP = "https://wa.me/34612474827";

const BUDGET_OPTIONS = [
  { value: "", label: "Sin preferencia / No preference" },
  { value: "Hasta 40€", label: "Hasta 40€" },
  { value: "40–60€", label: "40–60€" },
  { value: "60–90€", label: "60–90€" },
  { value: "Más de 90€", label: "Más de 90€" },
];

type Status = "idle" | "loading" | "success" | "error";

export default function Notify() {
  const [want, setWant] = useState("");
  const [area, setArea] = useState("");
  const [budget, setBudget] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [validationMsg, setValidationMsg] = useState("");

  const canSubmit = phone.trim() || email.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationMsg("");

    if (!phone.trim() && !email.trim()) {
      setValidationMsg("Necesitamos un WhatsApp o un email / We need a WhatsApp or email to reach you");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "waitlist",
          want: want.trim() || undefined,
          area: area.trim() || undefined,
          budget: budget || undefined,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          source: "web-notify",
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "Unknown error" }));
      if (res.ok && data.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Could not send");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    }
  };

  return (
    <>
      <Helmet>
        <title>Avísame cuando haya plaza · Massage Club</title>
        <meta name="description" content="Te avisamos cuando tengamos un masaje que encaje contigo. Sin spam, sin compromiso." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="flex items-center justify-between gap-2.5 px-5 py-3.5 border-b border-border bg-background sticky top-0 z-10">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/brand/mc-avatar-terracotta.png"
              alt="Massage Club"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="font-semibold text-foreground" style={{ letterSpacing: 0.2 }}>
              Massage Club
            </span>
          </Link>
        </header>

        <main className="max-w-xl mx-auto px-4 py-6 md:py-10">
          <Card className="rounded-2xl shadow-soft border-border/60">
            <CardContent className="p-6 md:p-8">
              {status === "success" ? (
                <div className="text-center py-8 animate-fade-up">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-5">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-2">
                    ¡Hecho!
                  </h1>
                  <p className="text-[15px] text-muted-foreground">
                    Te escribimos cuando tengamos algo bueno cerca de ti.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We'll message you when we have something good near you.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="text-center mb-2">
                    <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-2">
                      Te avisamos cuando tengamos algo para ti
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Dinos qué buscas y te escribimos cuando encontremos un hueco que encaje.
                    </p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">
                      Tell us what you're after and we'll message you when we find a slot that fits.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="want" className="text-[15px]">
                        Qué masaje te interesa
                        <span className="block text-xs font-normal text-muted-foreground mt-0.5">What massage</span>
                      </Label>
                      <Input
                        id="want"
                        value={want}
                        onChange={(e) => setWant(e.target.value)}
                        placeholder="Descontracturante, tailandés, relajante…"
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="area" className="text-[15px]">
                        Zona <span className="block text-xs font-normal text-muted-foreground mt-0.5">Area</span>
                      </Label>
                      <Input
                        id="area"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder="Chamberí"
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="budget" className="text-[15px]">
                        Presupuesto <span className="block text-xs font-normal text-muted-foreground mt-0.5">Budget</span>
                      </Label>
                      <Select value={budget} onValueChange={setBudget}>
                        <SelectTrigger id="budget" className="h-12 text-base md:text-sm rounded-xl">
                          <SelectValue placeholder="Sin preferencia / No preference" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUDGET_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[15px]">
                        Nombre <span className="block text-xs font-normal text-muted-foreground mt-0.5">Name</span>
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder=""
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-[15px]">
                          WhatsApp
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+34 600 000 000"
                          className="h-12 text-base md:text-sm rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-[15px]">
                          O email <span className="block text-xs font-normal text-muted-foreground mt-0.5">Or email</span>
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="tu@email.com"
                          className="h-12 text-base md:text-sm rounded-xl"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground -mt-2">
                      Con uno de los dos vale. <span className="opacity-70">/ Either one is enough.</span>
                    </p>
                  </div>

                  {validationMsg && (
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {validationMsg}
                    </div>
                  )}

                  {status === "error" && (
                    <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                      <p className="font-medium mb-1">
                        No se pudo enviar. Escríbenos por WhatsApp al +34 612 474 827.
                      </p>
                      <p className="opacity-90">
                        Could not send.{" "}
                        <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="underline">
                          Message us on WhatsApp
                        </a>{" "}
                        at +34 612 474 827.
                      </p>
                      {errorMsg && <p className="mt-2 text-xs opacity-80">{errorMsg}</p>}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 text-base rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                    loading={status === "loading"}
                    disabled={!canSubmit}
                  >
                    {status === "loading" ? "Enviando…" : "Avisadme / Keep me posted"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Puedes decirnos que paremos cuando quieras. <span className="opacity-70">/ You can tell us to stop any time.</span>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
