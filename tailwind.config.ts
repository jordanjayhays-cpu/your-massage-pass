import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    // Full list, not `extend`: Tailwind appends extended screens after 2xl, which
    // would let desk: override lg: and xl:. The order here is the CSS order.
    // desk (900px) is the one desktop breakpoint for new code; it equals the
    // min-[900px]: classes already in use (design system 3.3 and 3.10).
    screens: { sm: "640px", md: "768px", desk: "900px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        // Selected or hovered surface (design system 3.1). There is no brand colour.
        brand: {
          tint: "hsl(var(--brand-tint))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["Fraunces", "EB Garamond", "Georgia", "serif"],
        body: ["Outfit", "Inter", "system-ui", "sans-serif"],
        serif: ["Fraunces", "EB Garamond", "Georgia", "serif"],
      },
      // Type scale (design system 3.2). The heading sizes switch at desk through
      // the --fs-* variables in index.css, so one class covers phone and desktop.
      fontSize: {
        display: ["var(--fs-display)", { lineHeight: "var(--lh-display)", letterSpacing: "-0.02em", fontWeight: "700" }],
        h1: ["var(--fs-h1)", { lineHeight: "var(--lh-h1)", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["var(--fs-h2)", { lineHeight: "var(--lh-h2)", letterSpacing: "-0.01em", fontWeight: "700" }],
        h3: ["var(--fs-h3)", { lineHeight: "var(--lh-h3)", fontWeight: "600" }],
        lead: ["var(--fs-lead)", { lineHeight: "var(--lh-lead)" }],
        body: ["16px", { lineHeight: "24px" }],
        label: ["15px", { lineHeight: "20px", fontWeight: "500" }],
        small: ["14px", { lineHeight: "20px" }],
        caption: ["13px", { lineHeight: "18px", fontWeight: "500" }],
        button: ["17px", { lineHeight: "20px", fontWeight: "600" }],
        price: ["16px", { lineHeight: "20px", fontWeight: "600" }],
      },
      // Layout widths (design system 3.3): booking flow, reading column, page.
      maxWidth: {
        flow: "480px",
        read: "640px",
        page: "1120px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        sheet: "var(--shadow-sheet)",
      },
      zIndex: {
        header: "30",
        consent: "50",
      },
      transitionDuration: {
        state: "200ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-once": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "35%": { transform: "scale(1.04)", opacity: "0.92" },
        },
        // Review wizard: one question slides in as the previous one leaves.
        "wizard-in-right": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "wizard-in-left": {
          from: { opacity: "0", transform: "translateX(-24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.8s ease-out forwards",
        "pulse-once": "pulse-once 0.9s ease-in-out 2",
        "wizard-in-right": "wizard-in-right 0.26s cubic-bezier(0.22,1,0.36,1)",
        "wizard-in-left": "wizard-in-left 0.26s cubic-bezier(0.22,1,0.36,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
