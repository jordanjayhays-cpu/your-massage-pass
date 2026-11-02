import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MASSAGE_GUIDE } from "../data";
import StudioMap from "../components/StudioMap";
import ExploreMassageTypes from "../components/ExploreMassageTypes";
import { QuizPromoVideo } from "@/components/QuizPromoVideo";
import { trackEvent } from "@/lib/siteVisit";
import { clarityEvent } from "@/lib/clarity";
import { studioPath } from "@/lib/studioHref";


/**
 * From 900px the page sits in the 1120px browse container (1072px of content
 * inside 24px), however wide the app shell is: the side padding grows.
 */
const DESK_PAGE = "min-[900px]:px-[max(1.5rem,calc((100%_-_1072px)/2))]";

export default function Discovery() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [geoState, setGeoState] = useState<"pending" | "ready" | "fallback">("pending");

  const startQuiz = () => {
    clarityEvent("quiz_start");
    trackEvent("quiz_start");
    navigate("/discovery/quiz");
  };



  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3 ${DESK_PAGE}`}>
        <button
          onClick={() => navigate(-1)}
          aria-label={t("app.common.back")}
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-muted-foreground min-[900px]:text-[13px]">{t("app.discovery.kicker")}</p>
          <h1 className="font-display text-lg font-bold min-[900px]:text-2xl">{t("app.discovery.title")}</h1>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto px-6 py-5 space-y-6 pb-28 ${DESK_PAGE} min-[900px]:pt-8 min-[900px]:space-y-10 min-[900px]:pb-16`}>
        {/* Quiz CTA — full-card clickable */}
        <button
          onClick={() => navigate("/discovery/quiz")}
          aria-label={t("app.discovery.quizCardAria")}
          className="group w-full text-left rounded-2xl p-5 min-[900px]:p-8 bg-gradient-royal text-primary-foreground shadow-elegant relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-all motion-safe:hover:shadow-elegant motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.99]"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-accent/20 text-accent rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider min-[900px]:text-[13px] min-[900px]:font-semibold min-[900px]:normal-case min-[900px]:tracking-normal min-[900px]:px-2.5">
              <Sparkles className="h-3 w-3" /> {t("app.discovery.quizBadge")}
            </div>
            <h2 className="font-display text-2xl font-bold mt-3 min-[900px]:text-[28px] min-[900px]:leading-[34px]">{t("app.discovery.quizTitle")}</h2>
            <p className="text-sm text-primary-foreground/80 mt-1 min-[900px]:text-base min-[900px]:max-w-[40rem]">
              {t("app.discovery.quizDesc")}
            </p>
            <div className="mt-4 inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-full bg-accent text-accent-foreground text-sm font-semibold shadow-soft group-hover:bg-accent/90 transition-colors">
              {t("app.discovery.takeQuiz")} <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </button>

        {/* Nearby map */}
        <StudioMap
          heading={geoState === "ready" ? t("app.discovery.nearbyTitle") : t("app.discovery.nearbyTitleMadrid")}
          heightClass="h-[260px] md:h-[360px]"
          onGeoStateChange={setGeoState}
          onSelect={(shop) => navigate(studioPath(shop))}
        />

        {/* Mid-page quiz entry point */}
        <button
          onClick={() => navigate("/discovery/quiz")}
          aria-label={t("app.discovery.quizCardAria")}
          className="group w-full text-center min-h-11 inline-flex items-center justify-center gap-2 text-accent text-sm font-medium min-[900px]:w-auto min-[900px]:text-[15px] hover:text-accent-foreground hover:bg-accent/10 rounded-xl px-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 motion-safe:transition-colors"
        >
          {t("app.discovery.quizMidPrompt")}
        </button>

        <ExploreMassageTypes />


        <div>
          <h3 className="font-display text-2xl text-foreground min-[900px]:text-[28px] min-[900px]:leading-[34px]">{t("app.discovery.exploreTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-1 min-[900px]:text-[15px] min-[900px]:max-w-[40rem]">
            {t("app.discovery.exploreSub")}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4 min-[900px]:gap-4">
            {MASSAGE_GUIDE.map((g) => (
              <button
                key={g.id}
                onClick={() => navigate(`/discovery/${g.id}`)}
                className="text-left rounded-2xl overflow-hidden bg-card border border-border shadow-soft hover:shadow-elegant hover:-translate-y-0.5 transition-all md:hover:border-primary/60"
              >
                <div className="relative h-28 md:h-auto md:aspect-[4/3]">
                  <img src={g.image} alt={g.name} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                  {g.bookable && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent/95 text-foreground shadow-soft min-[900px]:text-[13px] min-[900px]:font-semibold min-[900px]:normal-case min-[900px]:tracking-normal min-[900px]:px-2.5 min-[900px]:top-3 min-[900px]:right-3">
                      {t("app.discovery.inMadrid")}
                    </span>
                  )}
                  <div className="absolute bottom-2 left-3 right-3">
                    <h4 className="font-display text-base font-bold text-primary-foreground leading-tight min-[900px]:text-lg">{g.name}</h4>
                  </div>
                </div>
                <p className="px-3 py-2.5 text-xs text-muted-foreground leading-snug line-clamp-2 md:text-sm md:px-4 md:py-3">{g.tagline}</p>
              </button>
            ))}
          </div>

          {/* Second quiz entry point — after the styles list */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex flex-col items-center gap-5 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-center min-[900px]:gap-8">
              {/* mx-0 from 900px: the clip's own auto margins otherwise soak up the
                  row's free space and push the text to the far right. */}
              <QuizPromoVideo onClick={startQuiz} className="min-[900px]:mx-0" />
              <div className="text-center min-[900px]:text-left">
                <p className="text-sm text-muted-foreground mb-3 min-[900px]:text-[15px]">{t("app.discovery.quizBottomTitle")}</p>
                <button
                  onClick={startQuiz}
                  className="inline-flex items-center justify-center gap-1.5 min-h-11 px-5 rounded-full border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {t("app.discovery.quizBottomCta")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

