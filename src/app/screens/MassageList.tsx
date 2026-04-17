import { useNavigate } from "react-router-dom";
import { Search, Star, MapPin, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MASSAGES } from "../data";
import { useBooking } from "../BookingContext";
import { useState } from "react";

export default function MassageList() {
  const navigate = useNavigate();
  const { set } = useBooking();
  const [q, setQ] = useState("");

  const filtered = MASSAGES.filter(
    (m) =>
      m.name.toLowerCase().includes(q.toLowerCase()) ||
      m.studio.toLowerCase().includes(q.toLowerCase()) ||
      m.district.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 bg-card border-b border-border">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold">Hola, Madrid</p>
        <h1 className="font-display text-2xl font-bold text-foreground mt-1">Pick today's escape</h1>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search massages, studios, neighborhoods"
            className="pl-9 h-11 bg-background"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              set({ massageId: m.id });
              navigate(`/app/massages/${m.id}`);
            }}
            className="w-full text-left rounded-2xl overflow-hidden bg-card border border-border shadow-soft hover:shadow-elegant transition-all"
          >
            <div className="relative h-40">
              <img src={m.image} alt={m.name} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-background/95 rounded-full px-2 py-1 text-xs font-semibold">
                <Star className="h-3 w-3 fill-accent text-accent" /> {m.rating}
              </div>
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="font-display text-xl font-bold text-primary-foreground">{m.name}</h3>
                <p className="text-sm text-primary-foreground/90">{m.studio}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.district}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {m.duration} min</span>
              <span>{m.reviews} reviews</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">No matches. Try another search.</p>
        )}
      </div>
    </div>
  );
}
