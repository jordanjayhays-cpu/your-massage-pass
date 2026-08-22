/**
 * Legacy /s/:studioId links. We keep them alive forever, but only as a
 * redirect to the one canonical studio URL: book.massageclub.io/{slug}.
 */
import { useEffect, useState } from "react";
import { useParams, useLocation, Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function StudioIdRedirect() {
  const { studioId } = useParams();
  const { search, hash } = useLocation();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!studioId) return;
    if (!UUID.test(studioId)) {
      setTarget(`/${studioId}${search}${hash}`);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("partners")
        .select("slug")
        .eq("id", studioId)
        .maybeSingle();
      if (cancelled) return;
      const key = (data as any)?.slug || studioId;
      setTarget(`/${key}${search}${hash}`);
    })();
    return () => { cancelled = true; };
  }, [studioId, search, hash]);

  if (!target) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FBF7F2", color: "#8a7460" }}>
        <p className="text-sm">Loading studio...</p>
      </div>
    );
  }
  return <Navigate to={target} replace />;
}
