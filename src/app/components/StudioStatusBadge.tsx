import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { StudioBadgeVariant } from "@/lib/studioStatus";

const LABEL_KEY: Record<StudioBadgeVariant, string> = {
  available_today: "app.massageList.availableToday",
  book_online: "app.massageList.bookOnline",
  ask_whatsapp: "app.massageList.askOnWhatsapp",
};

const FALLBACK: Record<StudioBadgeVariant, string> = {
  available_today: "Available today",
  book_online: "Book online",
  ask_whatsapp: "Ask on WhatsApp",
};

const STYLES: Record<StudioBadgeVariant, string> = {
  available_today: "bg-primary/10 text-primary",
  book_online: "bg-accent/15 text-foreground",
  ask_whatsapp: "bg-secondary text-muted-foreground",
};

export default function StudioStatusBadge({
  variant,
  className,
}: {
  variant: StudioBadgeVariant | null;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!variant) return null;
  const label = t(LABEL_KEY[variant], { defaultValue: FALLBACK[variant] });

  return (
    <span
      className={cn(
        "text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-1 rounded-full",
        STYLES[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
