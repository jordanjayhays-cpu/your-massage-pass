import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MASSAGE_GUIDE, MASSAGES } from "../data";
import GoogleMap from "../components/GoogleMap";
import { useBooking } from "../BookingContext";

export default function Discovery() {
  const navigate = useNavigate();
  const { set } = useBooking();
  const { t } = useTranslation();


  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label={t("app.common.back")}
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-muted-foreground">{t("app.discovery.kicker")}</p>
          <h1 className="font-display text-lg font-bold">{t("app.discovery.title")}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 pb-28">
        {/* Quiz CTA */}
        <button
          onClick={() => navigate("/discovery/quiz")}
          className="w-full text-left rounded-2xl p-5 bg-gradient-royal text-primary-foreground shadow-elegant relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-accent/20 text-accent rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> {t("app.discovery.quizBadge")}
            </div>
            <h2 className="font-display text-2xl font-bold mt-3">{t("app.discovery.quizTitle")}</h2>
            <p className="text-sm text-primary-foreground/80 mt-1">
              {t("app.discovery.quizDesc")}
            </p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
              {t("app.discovery.takeQuiz")} <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </button>

        {/* Nearby map */}
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-3">{t("app.discovery.nearbyTitle")}</h3>
          <GoogleMap
            massages={MASSAGES}
            compact
            onSelect={(m) => {
              set({ massageId: m.id });
              navigate(`/massages/${m.id}`);
            }}
          />
        </div>

        <div>
          <h3 className="font-display text-2xl text-foreground">{t("app.discovery.exploreTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.discovery.exploreSub")}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {MASSAGE_GUIDE.map((g) => (
              <button
                key={g.id}
                onClick={() => navigate(`/discovery/${g.id}`)}
                className="text-left rounded-2xl overflow-hidden bg-card border border-border shadow-soft hover:shadow-elegant hover:-translate-y-0.5 transition-all"
              >
                <div className="relative h-28">
                  <img src={g.image} alt={g.name} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                  {g.bookable && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent/95 text-foreground shadow-soft">
                      {t("app.discovery.inMadrid")}
                    </span>
                  )}
                  <div className="absolute bottom-2 left-3 right-3">
                    <h4 className="font-display text-base font-bold text-primary-foreground leading-tight">{g.name}</h4>
                  </div>
                </div>
                <p className="px-3 py-2.5 text-xs text-muted-foreground leading-snug line-clamp-2">{g.tagline}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

