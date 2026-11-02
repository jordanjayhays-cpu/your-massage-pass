import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type scale and shadows added in tailwind.config.ts (design system 3.2,
// 3.5). Without this, tailwind-merge reads "text-label" as a text colour and
// drops it next to "text-foreground".
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "lead", "body", "label", "small", "caption", "button", "price"] }],
      shadow: [{ shadow: ["card", "sheet"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
