import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/**
 * People land back on the site with ?thanks=1 after replying to our follow up
 * email. Say thanks once, then clean the URL.
 */
export default function ThanksToast() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (searchParams.get("thanks") !== "1") return;
    const es = (i18n.language || "en").slice(0, 2) === "es";
    toast(es ? "¡Gracias!" : "Thanks, noted!");
    const next = new URLSearchParams(searchParams);
    next.delete("thanks");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
