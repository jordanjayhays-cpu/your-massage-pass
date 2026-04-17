import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, MapPin, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MASSAGES } from "../data";

export default function ShopDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const massage = MASSAGES.find((m) => m.id === id);

  if (!massage) {
    return (
      <div className="p-8 text-center">
        <p>Not found.</p>
        <Button onClick={() => navigate("/app/massages")} className="mt-4">Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Image header */}
      <div className="relative h-64 flex-shrink-0">
        <img src={massage.image} alt={massage.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-background/95 flex items-center justify-center shadow-soft"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 -mt-6 relative">
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 bg-accent/20 text-accent-foreground rounded-full px-2 py-1 font-semibold">
            <Star className="h-3 w-3 fill-accent text-accent" /> {massage.rating} · {massage.reviews}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {massage.duration} min</span>
        </div>

        <h1 className="font-display text-3xl font-bold text-foreground mt-2">{massage.name}</h1>
        <p className="text-primary font-semibold mt-1">{massage.studio}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <MapPin className="h-3 w-3" /> {massage.district}, Madrid
        </p>

        <p className="text-foreground/80 leading-relaxed mt-4">{massage.description}</p>

        <div className="flex flex-wrap gap-2 mt-4">
          {massage.tags.map((t) => (
            <span key={t} className="text-xs bg-secondary text-secondary-foreground rounded-full px-3 py-1">{t}</span>
          ))}
        </div>

        <h3 className="font-display text-lg font-semibold text-foreground mt-6 mb-3">What's included</h3>
        <ul className="space-y-2 mb-6">
          {["Welcome tea", "Premium oils", "Heated bed", "Quiet room"].map((i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" /> {i}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-6 py-4 border-t border-border bg-card">
        <Button
          onClick={() => navigate(`/app/booking/${massage.id}/calendar`)}
          className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90 shadow-elegant"
        >
          Book this massage
        </Button>
      </div>
    </div>
  );
}
