import { useState } from "react";
import { useFlowLang } from "@/lib/flowLang";
import { LEGAL_ENTITY, postalAddress } from "@/lib/legalEntity";

/**
 * Aviso legal / Legal notice (19 Nov 2026): who runs the website, as LSSI
 * (Ley 34/2002) art. 10.1 asks of a service offered in Spain. The facts come
 * from src/lib/legalEntity.ts, the same place the privacy page reads, and a
 * fact still missing (entity number, tax number) prints nothing rather than a
 * placeholder.
 */
type L = "es" | "en";
const E = LEGAL_ENTITY;

export const LEGAL_COPY = {
  es: {
    title: "Aviso legal",
    intro: `Este sitio web (${E.website} y book.${E.website}) y el servicio Massage Club los gestiona:`,
    owner: "Titular",
    trading: "Nombre comercial",
    kind: "Forma jurídica y registro",
    entityId: "Número de registro",
    taxId: "Número fiscal",
    address: "Domicilio",
    contact: "Contacto",
    service:
      "Massage Club pregunta por ti a centros de masaje de Madrid si tienen hueco y te envía sus horas. El masaje lo presta el centro que eliges, y se paga en el centro. Massage Club es gratuito para ti.",
    more: "Cómo usamos tus datos:",
    privacy: "Política de privacidad",
    terms: "Términos del servicio",
  },
  en: {
    title: "Legal notice",
    intro: `This website (${E.website} and book.${E.website}) and the Massage Club service are run by:`,
    owner: "Owner",
    trading: "Trading name",
    kind: "Legal form and registration",
    entityId: "Entity number",
    taxId: "Tax number",
    address: "Address",
    contact: "Contact",
    service:
      "Massage Club asks massage studios in Madrid for a time on your behalf and sends you their times. The massage is given by the studio you choose, and you pay at the studio. Massage Club is free for you.",
    more: "How we use your data:",
    privacy: "Privacy policy",
    terms: "Terms of service",
  },
} as const;

export default function LegalNotice() {
  const flowLang = useFlowLang();
  const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("lang") : null;
  const [lang, setLang] = useState<L>((fromUrl || flowLang) === "es" ? "es" : "en");
  const c = LEGAL_COPY[lang];
  const rows: Array<[string, string]> = [
    [c.owner, E.name],
    [c.trading, E.tradingAs],
    [c.kind, E.registered[lang]],
    ...(E.entityId ? ([[c.entityId, E.entityId]] as Array<[string, string]>) : []),
    ...(E.taxId ? ([[c.taxId, E.taxId]] as Array<[string, string]>) : []),
    [c.address, postalAddress(lang)],
  ];

  return (
    <div className="min-h-screen" style={{ background: "#FAF6F1" }}>
      <div className="max-w-2xl mx-auto px-5 py-10">
        <div
          className="w-full bg-white rounded-2xl p-6 md:p-10 text-[#3d2b1f]"
          style={{ boxShadow: "0 6px 24px rgba(80, 44, 20, 0.08)" }}
        >
          <div className="text-center mb-6">
            <div className="text-xs font-bold uppercase tracking-[2.5px] mb-3" style={{ color: "#B85C38" }}>Massage Club</div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-[#2b2b2b]">{c.title}</h1>
          </div>

          <div role="group" aria-label="Idioma / Language" className="mb-8 flex justify-center gap-2">
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                lang={l}
                onClick={() => setLang(l)}
                className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${
                  lang === l ? "border-[#B85C38] bg-[#FDF3EC] text-[#3d2b1f]" : "border-gray-300 bg-white text-[#5a4736]"
                }`}
              >
                {l === "es" ? "Español" : "English"}
              </button>
            ))}
          </div>

          <div lang={lang} className="text-[15px] leading-relaxed text-[#5a4736]">
            <p>{c.intro}</p>
            <dl className="mt-4 space-y-3">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm font-semibold text-[#3d2b1f]">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div>
                <dt className="text-sm font-semibold text-[#3d2b1f]">{c.contact}</dt>
                <dd>
                  <a href={`mailto:${E.email}`} className="font-semibold underline underline-offset-2">{E.email}</a>
                </dd>
              </div>
            </dl>
            <p className="mt-6">{c.service}</p>
            <p className="mt-6">
              {c.more}{" "}
              <a href="/privacy" className="font-semibold underline underline-offset-2">{c.privacy}</a>
              {" · "}
              <a href="/terms" className="font-semibold underline underline-offset-2">{c.terms}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
