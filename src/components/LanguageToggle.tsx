import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

export const LanguageToggle = () => {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage === "es" ? "es" : "en";
  const next = current === "en" ? "es" : "en";

  return (
    <Button
      type="button"
      onClick={() => i18n.changeLanguage(next)}
      variant="ghost"
      size="sm"
      aria-label={`Switch language to ${next.toUpperCase()}`}
      className="text-primary-foreground hover:text-accent hover:bg-foreground/20 gap-1.5"
    >
      <Languages className="h-4 w-4" />
      <span className="text-xs font-semibold tracking-wider">
        <span className={current === "en" ? "text-accent" : "opacity-60"}>EN</span>
        <span className="opacity-40 mx-1">/</span>
        <span className={current === "es" ? "text-accent" : "opacity-60"}>ES</span>
      </span>
    </Button>
  );
};
