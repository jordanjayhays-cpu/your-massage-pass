import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Building2, Mail, Send, Loader2, CheckCircle, Link2, ArrowLeft } from "lucide-react";

const APP_URL = "https://your-massage-pass-o5fo.vercel.app";

export default function AdminInviteStudio() {
  const [email, setEmail] = useState("");
  const [studioName, setStudioName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !studioName) { toast.error("Fill in all fields"); return; }

    setLoading(true);
    setError("");

    try {
      // 1. Create invite row
      const { data, error: insertError } = await supabase
        .from("invites")
        .insert({ email, studio_name: studioName })
        .select("token")
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error("No token returned");

      const link = `${APP_URL}/studio-setup?token=${data.token}`;
      setInviteLink(link);

      // 2. Send email via Resend
      const response = await fetch("https://api.resend.com/emails/parse", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Massage Club <onboarding@massagepass.app>",
          to: [email],
          subject: `You're invited to join Massage Club, ${studioName}`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #211C1A;">You're invited! 🎉</h2>
              <p>Hi team at <strong>${studioName}</strong>,</p>
              <p>You've been invited to join <strong>Massage Club</strong> — the €79/month unlimited massage subscription for Madrid.</p>
              <p>Click below to set up your studio profile and start receiving bookings:</p>
              <a href="${link}" style="display: inline-block; background: #C4622D; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Set Up My Studio →</a>
              <p style="font-size: 12px; color: #666; margin-top: 24px;">This link expires in 30 days. If you didn't expect this email, ignore it.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Email failed to send");
      }

      setSent(true);
      toast.success(`Invite sent to ${email}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Link copied!");
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
        <Card className="bg-card border-border shadow-elegant w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">Invite Sent!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {studioName} ({email}) can now complete their setup.
            </p>

            <div className="bg-muted rounded-xl p-4 text-left mb-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Invite link</p>
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a href={inviteLink} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all">
                  {inviteLink}
                </a>
              </div>
            </div>

            <Button onClick={handleCopyLink} variant="outline" className="w-full mb-3">
              Copy Link
            </Button>
            <Button onClick={() => { setSent(false); setEmail(""); setStudioName(""); }} variant="outline" className="w-full">
              Send Another Invite
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-royal flex items-center justify-center mx-auto mb-4 shadow-elegant">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Invite a Studio</h1>
          <p className="text-muted-foreground mt-2">Send an invite link to onboard a new studio partner</p>
        </div>

        <Card className="bg-card border-border shadow-elegant">
          <CardContent className="p-8">
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Studio Name</label>
                <Input
                  value={studioName}
                  onChange={e => setStudioName(e.target.value)}
                  placeholder="e.g. Casa Delfines Spa"
                  required
                  className="h-11"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Studio Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="studio@example.com"
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
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Send Invite</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}