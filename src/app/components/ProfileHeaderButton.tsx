import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

/**
 * Top-left header control on the app screens.
 *
 * Signed out: a soft white pill ("Create profile / Crea tu perfil") matching the
 * language selector on the right, opening the create-profile flow.
 * Signed in: the avatar circle linking to the profile screen.
 */
export default function ProfileHeaderButton({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const es = (i18n.language || "en").startsWith("es");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setSignedIn(!!user);
      if (!user) {
        setAvatarUrl(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setAvatarUrl(data?.avatar_url ?? null);
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (signedIn === false) {
    return (
      <button
        onClick={() => navigate("/login?create=1")}
        className={`inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full border border-[#E5DDD3] bg-white/95 backdrop-blur shadow-sm hover:border-[#C4622D]/50 transition ${className}`}
      >
        <UserPlus className="h-4 w-4 text-[#C4622D]" />
        <span className="text-[11px] font-semibold text-[#211C1A]">
          {es ? "Crea tu perfil" : "Create profile"}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate("/app/profile")}
      aria-label={t("app.massageList.profile")}
      className={`h-10 w-10 rounded-full overflow-hidden bg-card border border-border flex items-center justify-center hover:border-primary/50 transition shadow-soft ${className}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={t("app.massageList.profile")} className="h-full w-full object-cover" />
      ) : (
        <UserCircle className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  );
}
