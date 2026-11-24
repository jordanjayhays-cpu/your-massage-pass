import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flowLang", () => ({ useFlowLang: () => "en" }));

import Privacy from "@/pages/Privacy";

// GDPR art. 13 and LSSI art. 22 (the Kelly rule, 19 Nov): what the page must say.
const MUST = {
  en: [
    /Who is responsible/, /Kinsol LLC/, /trading as Massage Club/, /1500 N Grant St, Ste N, Denver, CO 80203, United States/,
    /registered in the State of Colorado/,
    /Offers and reminders to book again, by email and WhatsApp:/, /GDPR art\. 6\.1\.a/, /withdrawing it does not affect your bookings/,
    /GDPR art\. 6\.1\.b/, /The studios we ask about your request/, /Meta Platforms \(WhatsApp\)/, /Resend/, /Supabase/, /Vercel/, /Google Ads/,
    /Google Fonts/, /handled from the United States/, /outside the European Economic Area/, /ask us for a copy of these safeguards/,
    /How long we keep your data/, /up to 3 years after your last request/, /Agencia Española de Protección de Datos/,
    /How to stop offers/, /replying STOP on WhatsApp/, /we need your email/, /no automated decisions/,
    /we never give a studio your contact so it can send you advertising/, /GDPR art\. 6\.1\.f and art\. 23/,
    /Until you choose, or if you tap "Decline", neither is loaded/,
  ],
  es: [
    /Quién es el responsable/, /Kinsol LLC/, /nombre comercial Massage Club/, /1500 N Grant St, Ste N, Denver, CO 80203, Estados Unidos/,
    /Ofertas y recordatorios para volver a reservar, por email y WhatsApp:/, /art\. 6\.1\.a RGPD/, /retirarlo no afecta a tus reservas/,
    /Los centros a los que preguntamos/, /se tratan desde Estados\s+Unidos/, /hasta 3 años después de tu última solicitud/,
    /Agencia Española de Protección de Datos/, /Cómo dejar de recibir ofertas/, /Respondiendo STOP o BAJA por WhatsApp/,
    /necesitamos tu email/, /No tomamos decisiones automatizadas/, /nunca damos tu contacto a un centro/,
  ],
};

// Things the page must never say again (19 Nov review): a claim no flow
// backs up, or a country that is not the controller's.
const MUST_NOT = [
  /consentimiento explícito/i, /explicit consent/i, /9\.2\.a/,
  /Madrid, España/, /Madrid, Spain/, /NIF/, /obligación legal/, /legal obligation/,
];

describe("Privacy page", () => {
  it("says everything GDPR art. 13 asks for, in English and in Spanish", () => {
    const { container } = render(<Privacy />);
    for (const re of MUST.en) expect(container.textContent, String(re)).toMatch(re);
    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    for (const re of MUST.es) expect(container.textContent, String(re)).toMatch(re);
  });

  it("has no placeholder left: the page cannot ship unfilled", () => {
    const { container } = render(<Privacy />);
    for (const lang of ["English", "Español"]) {
      fireEvent.click(screen.getByRole("button", { name: lang }));
      expect(container.querySelectorAll("mark").length, lang).toBe(0);
      expect(container.textContent, lang).not.toMatch(/\[[^\]]*\]/);
      expect(container.textContent, lang).not.toMatch(/PLAZO|PERIOD\b|LEGAL NAME|NOMBRE LEGAL|POSTAL ADDRESS|DIRECCIÓN POSTAL/);
    }
  });

  it("makes none of the claims the review found untrue", () => {
    const { container } = render(<Privacy />);
    for (const lang of ["English", "Español"]) {
      fireEvent.click(screen.getByRole("button", { name: lang }));
      for (const re of MUST_NOT) expect(container.textContent, `${lang} ${re}`).not.toMatch(re);
    }
  });

  it("links only to massageclub.io (house rule), including the legal notice and the stop page", () => {
    const { container } = render(<Privacy />);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") || "");
    for (const h of hrefs) expect(h.startsWith("/") || h === "mailto:support@massageclub.io", h).toBe(true);
    expect(hrefs).toContain("/legal");
    expect(hrefs).toContain("/unsubscribe");
  });
});
