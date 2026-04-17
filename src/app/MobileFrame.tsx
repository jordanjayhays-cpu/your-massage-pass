import { ReactNode } from "react";

/**
 * MobileFrame: phone-sized container that works on real mobile (full-bleed)
 * and shows a centered phone shell on desktop.
 */
export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-warm md:py-8">
      <div className="mx-auto w-full md:max-w-[420px] md:rounded-[2.5rem] md:border-8 md:border-foreground/90 md:shadow-elegant md:overflow-hidden bg-background min-h-screen md:min-h-[860px] md:max-h-[860px] md:h-[860px] flex flex-col relative">
        {children}
      </div>
    </div>
  );
}
