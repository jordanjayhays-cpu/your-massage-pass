import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flowLang", () => ({ useFlowLang: () => "en" }));

import Privacy from "@/pages/Privacy";

// GDPR art. 13 and LSSI art. 22 (the Kelly rule, 19 Nov): what the page must say.
const MUST = {
  en: [
    /Who is responsible/, /\[LEGAL NAME\]/, /\[NIF\]/, /\[POSTAL ADDRESS\]/,
    /Offers and reminders to book again, by email and WhatsApp:/, /GDPR art\. 6\.1\.a/, /withdrawing it does not affect your bookings/,
    /GDPR art\. 6\.1\.b/, /The studios we ask about your request/, /Meta Platforms \(WhatsApp\)/, /Resend/, /Supabase/, /Vercel/, /Google Ads/,
    /outside the European Economic Area/, /How long we keep your data/, /Agencia Española de Protección de Datos/, /How to stop offers/, /replying STOP on WhatsApp/,
  ],
  es: [
    /Quién es el responsable/, /\[NOMBRE LEGAL\]/, /\[NIF\]/, /\[DIRECCIÓN POSTAL\]/,
    /Ofertas y recordatorios para volver a reservar, por email y WhatsApp:/, /art\. 6\.1\.a RGPD/, /retirarlo no afecta a tus reservas/,
    /Los centros a los que preguntamos/, /Agencia Española de Protección de Datos/, /Cómo dejar de recibir ofertas/, /Respondiendo STOP por WhatsApp/,
  ],
};

describe("Privacy page", () => {
  it("says everything GDPR art. 13 asks for, in English and in Spanish", () => {
    const { container } = render(<Privacy />);
    for (const re of MUST.en) expect(container.textContent, String(re)).toMatch(re);
    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    for (const re of MUST.es) expect(container.textContent, String(re)).toMatch(re);
  });

  it("marks the facts still to be filled in", () => {
    const { container } = render(<Privacy />);
    const marks = [...container.querySelectorAll("mark")].map((m) => m.textContent);
    expect(marks).toEqual(expect.arrayContaining(["[LEGAL NAME]", "[NIF]", "[POSTAL ADDRESS]", "[PERIOD]"]));
  });

  it("links only to massageclub.io (house rule)", () => {
    const { container } = render(<Privacy />);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") || "");
    for (const h of hrefs) expect(h.startsWith("/") || h === "mailto:support@massageclub.io", h).toBe(true);
  });
});
