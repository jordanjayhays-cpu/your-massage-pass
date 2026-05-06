import { createContext, useContext, useState, ReactNode } from "react";
import type { Shop } from "@/lib/supabase";
import type { Massage } from "./data";

type BookingState = {
  massageId: string | null;
  shop: Shop | Massage | null; // full shop object for real shops
  date: string | null;
  time: string | null;
  pressure: string;
  focusAreas: string[];
  addOns: string[];
  notes: string;
};

type Ctx = BookingState & {
  set: (patch: Partial<BookingState>) => void;
  reset: () => void;
  toggleFocus: (v: string) => void;
  toggleAddOn: (v: string) => void;
};

const initial: BookingState = {
  massageId: null,
  shop: null,
  date: null,
  time: null,
  pressure: "Medium",
  focusAreas: [],
  addOns: [],
  notes: "",
};

const BookingCtx = createContext<Ctx | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(initial);

  const set = (patch: Partial<BookingState>) => setState((s) => ({ ...s, ...patch }));
  const reset = () => setState(initial);
  const toggleFocus = (v: string) =>
    setState((s) => ({
      ...s,
      focusAreas: s.focusAreas.includes(v) ? s.focusAreas.filter((x) => x !== v) : [...s.focusAreas, v],
    }));
  const toggleAddOn = (v: string) =>
    setState((s) => ({
      ...s,
      addOns: s.addOns.includes(v) ? s.addOns.filter((x) => x !== v) : [...s.addOns, v],
    }));

  return <BookingCtx.Provider value={{ ...state, set, reset, toggleFocus, toggleAddOn }}>{children}</BookingCtx.Provider>;
}

export const useBooking = () => {
  const ctx = useContext(BookingCtx);
  if (!ctx) throw new Error("useBooking must be used inside BookingProvider");
  return ctx;
};
