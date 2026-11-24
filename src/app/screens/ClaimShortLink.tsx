import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

// Short branded claim link: /claim/<slug> (the link in the approved
// lead-to-studio email) opens the claim flow by slug.
//
// Since 24 Nov 2026 the slug no longer turns into the studio's claim token:
// tokens were readable with the public key, so a token proves nothing.
// /studio-setup reads the studio's public fields by slug, and the merge of
// the pre-built row needs proof of the email on file
// (claim_release_verified, migration 20261124d).
export default function ClaimShortLink() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setError("Invalid link."); return; }
    navigate(`/studio-setup?claim_slug=${encodeURIComponent(slug)}`, { replace: true });
  }, [slug, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      {error ? (
        <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
      <Link
        to="/for-studios"
        className="mt-8 text-xs font-medium text-primary hover:underline"
      >
        Terms for studios / Condiciones para centros
      </Link>
    </div>
  );
}
