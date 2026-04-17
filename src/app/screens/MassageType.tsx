import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MASSAGE_TYPES, MASSAGES } from "../data";

export default function MassageTypePage() {
  const navigate = useNavigate();
  const { type } = useParams();
  const info = MASSAGE_TYPES.find((t) => t.id === type);
  const studios = MASSAGES.filter((m) => m.type === type);

  if (!info) {
    return (
      <div className="p-8 text-center">
        <p>Not found.</p>
        <Button onClick={() => navigate("/discovery")} className="mt-4">Back to discovery</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="relative h-56 flex-shrink-0">
        <img src={info.image} alt={info.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-foreground/30" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-background/95 flex items-center justify-center shadow-soft"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute bottom-4 left-6 right-6">
          <h1 className="font-display text-3xl font-bold text-primary-foreground">{info.name}</h1>
          <p className="text-primary-foreground/90 text-sm">{info.short}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <p className="text-foreground/85 leading-relaxed">{info.description}</p>

        <div className="rounded-2xl bg-secondary p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-gold flex items-center justify-center">
            <Gauge className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Typical pressure</p>
            <p className="font-semibold">{info.pressure}</p>
          </div>
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold mb-2">Best for</h3>
          <ul className="space-y-2">
            {info.bestFor.map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" /> {b}
              </li>
            ))}
          </ul>
        </div>

        {studios.length > 0 && (
          <div>
            <h3 className="font-display text-lg font-semibold mb-3">Available in Madrid</h3>
            <div className="space-y-2">
              {studios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/massages/${s.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary transition text-left"
                >
                  <img src={s.image} alt={s.studio} className="h-14 w-14 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{s.studio}</p>
                    <p className="text-xs text-muted-foreground">{s.district} · {s.duration} min</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
