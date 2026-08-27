import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

const LEAD_ENDPOINT = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/lead";
const SUPPORT_WHATSAPP = "https://wa.me/34612474827";

type Status = "idle" | "loading" | "success" | "error";

export default function Request() {
  const [want, setWant] = useState("");
  const [when, setWhen] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [validationMsg, setValidationMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationMsg("");

    if (!want.trim()) {
      setValidationMsg("Please tell us what massage you want");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setValidationMsg("We need a WhatsApp or email to reach you");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          want: want.trim(),
          when: when.trim() || undefined,
          area: area.trim() || undefined,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
          source: "web-request",
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
        <title>Request a massage · Massage Club</title>
        <meta name="description" content="Tell us what massage you want and we will book it for you. No booking fee, you pay the studio directly." />
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
                    Got it.
                  </h1>
                  <p className="text-[15px] text-muted-foreground">
                    We'll come back shortly with options and real prices.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="text-center mb-2">
                    <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-2">
                      Tell us what you want. We book it.
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      No booking fee. You pay the studio directly.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="want" className="text-[15px]">
                        What massage <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="want"
                        value={want}
                        onChange={(e) => setWant(e.target.value)}
                        placeholder="Deep tissue, or just: my back hurts"
                        className="text-base md:text-sm min-h-[88px] rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground">
                        If you're not sure, just tell us what hurts.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="when" className="text-[15px]">
                        When
                      </Label>
                      <Input
                        id="when"
                        value={when}
                        onChange={(e) => setWhen(e.target.value)}
                        placeholder="Tomorrow evening"
                        className="h-12 text-base md:text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="area" className="text-[15px]">
                        Area
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
                      <Label htmlFor="name" className="text-[15px]">
                        Name
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
                          Or email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@email.com"
                          className="h-12 text-base md:text-sm rounded-xl"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground -mt-2">
                      Either one is enough. We'll come back with options and prices.
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-[15px]">
                        Notes
                      </Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Allergies, pressure preference, anything else"
                        className="text-base md:text-sm min-h-[80px] rounded-xl"
                      />
                    </div>
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
                        Could not send. Message us on WhatsApp at +34 612 474 827.
                      </p>
                      <p className="opacity-90">
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
                    disabled={status === "loading"}
                  >
                    {status === "loading" ? "Sending…" : "Send"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
