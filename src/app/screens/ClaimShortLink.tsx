import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Short branded claim link: /claim/<slug> → resolves the partner by slug and
// forwards to the existing claim flow at /studio-setup?claim=<claim_token>.
export default function ClaimShortLink() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setError("Invalid link."); return; }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("partners")
        .select("claim_token, status")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (err || !data?.claim_token) {
        // RLS only exposes pending partners to anon, so an already-claimed
        // studio resolves to "not found" here.
        setError("This link is invalid or the studio has already been claimed. If that's you, log in at massageclub → Partner login.");
        return;
      }
      navigate(`/studio-setup?claim=${data.claim_token}`, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [slug, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      {error ? (
        <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
