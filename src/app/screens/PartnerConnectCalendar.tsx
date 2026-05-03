import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Check, Loader2, AlertCircle, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function PartnerConnectCalendar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [partner, setPartner] = useState<any>(null);

  // Check connection status from URL params (set by OAuth callback)
  const connected = searchParams.get("connected") === "true";
  const error = searchParams.get("error");

  useEffect(() => {
    loadPartner();
  }, []);

  useEffect(() => {
    if (connected) {
      toast.success("Google Calendar connected!");
      loadPartner();
    }
    if (error) {
      toast.error(`Connection failed: ${error}`);
    }
  }, [connected, error]);

  const loadPartner = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/partner/login"); return; }

    const { data } = await supabase
      .from("partners")
      .select("business_name, google_calendar_connected, google_calendar_id, auto_confirm_bookings")
      .eq("id", user.id)
      .single();

    setPartner(data);
    setLoading(false);
  };

  const handleConnect = () => {
    if (!partner) return;
    setConnecting(true);

    // Build Google OAuth URL
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";
    const redirectUri = `${window.location.origin}/partner/connect-calendar`;
    const state = partner.id;

    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" ");

    const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("scope", scopes);
    oauthUrl.searchParams.set("access_type", "offline");
    oauthUrl.searchParams.set("prompt", "consent");
    oauthUrl.searchParams.set("state", state);

    window.location.href = oauthUrl.toString();
  };

  const handleDisconnect = async () => {
    if (!partner) return;
    if (!confirm("Disconnect Google Calendar? Your manual availability will still work.")) return;

    setDisconnecting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("partners")
      .update({
        google_calendar_connected: false,
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_calendar_id: null,
      })
      .eq("id", user.id);

    setDisconnecting(false);
    if (error) {
      toast.error("Failed to disconnect");
    } else {
      toast.success("Google Calendar disconnected");
      loadPartner();
    }
  };

  const handleAutoConfirm = async (enabled: boolean) => {
    if (!partner) return;
    const { error } = await supabase
      .from("partners")
      .update({ auto_confirm_bookings: enabled })
      .eq("id", partner.id);

    if (error) {
      toast.error("Failed to update");
    } else {
      toast.success(enabled ? "Auto-confirm enabled" : "Auto-confirm disabled");
      loadPartner();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = partner?.google_calendar_connected;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/partner/dashboard")}
              className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
            >
              ←
            </button>
            <div>
              <p className="text-xs text-muted-foreground">Calendar Settings</p>
              <h1 className="font-display text-lg font-bold">Connect Your Calendar</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-5">
        {/* Status Card */}
        <Card className={`border-2 ${isConnected ? "border-green-500/50 bg-green-50/50" : "border-border"}`}>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${isConnected ? "bg-green-500" : "bg-secondary"}`}>
                <Calendar className={`h-6 w-6 ${isConnected ? "text-white" : "text-foreground"}`} />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-base">
                  {isConnected ? "Google Calendar Connected" : "No Calendar Connected"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isConnected
                    ? `Synced with ${partner.google_calendar_id || "your Google Calendar"}. Bookings will appear automatically.`
                    : "Connect your Google Calendar to get real-time availability and instant booking notifications."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error message */}
        {error && (
          <Card className="border-red-500/50 bg-red-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-600">Connection failed</p>
                <p className="text-xs text-red-500/80">{error.replace(/_/g, " ")}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connect / Disconnect Button */}
        {!isConnected ? (
          <div className="space-y-3">
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                  </svg>
                  Connect Google Calendar
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              One click — no password stored. Read-only access to your calendar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              onClick={handleDisconnect}
              disabled={disconnecting}
              variant="outline"
              className="w-full h-11 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-2" /> Disconnect Google Calendar</>}
            </Button>
          </div>
        )}

        {/* How it works */}
        <Card className="bg-card border-border">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-display font-bold text-sm">How it works</h3>

            <div className="space-y-3">
              {[
                {
                  step: "1",
                  title: "Connect in one click",
                  desc: "Sign in with Google. We get read-only access to your calendar.",
                  done: isConnected,
                },
                {
                  step: "2",
                  title: "We read your busy times",
                  desc: "Massage Club automatically sees when you're already booked in Google Calendar.",
                  done: isConnected,
                },
                {
                  step: "3",
                  title: "Customers see real availability",
                  desc: "Only open slots are shown. No double bookings.",
                  done: isConnected,
                },
                {
                  step: "4",
                  title: "Bookings land in your calendar",
                  desc: "New bookings from Massage Club appear as events in your Google Calendar instantly.",
                  done: isConnected,
                },
              ].map(({ step, title, desc, done }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    done ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"
                  }`}>
                    {done ? <Check className="h-3 w-3" /> : step}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${done ? "" : "text-muted-foreground"}`}>{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Auto-confirm setting */}
        {isConnected && (
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-4">
              <div>
                <h3 className="font-display font-bold text-sm mb-1">Auto-confirm bookings</h3>
                <p className="text-xs text-muted-foreground">
                  When enabled, bookings appear confirmed immediately. When off, you manually approve each one.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {partner?.auto_confirm_bookings ? "On — bookings confirmed automatically" : "Off — you confirm each booking"}
                  </p>
                </div>
                <button
                  onClick={() => handleAutoConfirm(!partner?.auto_confirm_bookings)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    partner?.auto_confirm_bookings ? "bg-green-500" : "bg-secondary"
                  }`}
                >
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    partner?.auto_confirm_bookings ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual availability note */}
        <div className="text-center">
          <button
            onClick={() => navigate("/partner/calendar")}
            className="text-sm text-muted-foreground hover:text-primary underline"
          >
            Set manual availability instead
          </button>
        </div>
      </div>
    </div>
  );
}
