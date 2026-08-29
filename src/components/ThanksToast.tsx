import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useFlowLang } from "@/lib/flowLang";

const COPY = {
  en: "Thanks, noted!", es: "¡Gracias!", fr: "Merci, c'est noté !", de: "Danke, notiert!",
  it: "Grazie, annotato!", pt: "Obrigado, anotado!", zh: "谢谢，已记录！",
} as const;

/**
 * People land back on the site with ?thanks=1 after replying to our follow up
 * email. Say thanks once, then clean the URL.
 */
export default function ThanksToast() {
  const [searchParams, setSearchParams] = useSearchParams();
  const lang = useFlowLang();

  useEffect(() => {
    if (searchParams.get("thanks") !== "1") return;
    toast(COPY[lang]);
    const next = new URLSearchParams(searchParams);
    next.delete("thanks");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
