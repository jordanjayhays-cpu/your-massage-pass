import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function ThanksToast() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  useEffect(() => {
    if (searchParams.get("thanks") === "1") {
      toast.success(t("thanks_toast.message"));
      const next = new URLSearchParams(searchParams);
      next.delete("thanks");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  return null;
}
