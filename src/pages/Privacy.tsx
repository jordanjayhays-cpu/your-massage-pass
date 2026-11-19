import { useState, type ReactNode } from "react";
import { useFlowLang } from "@/lib/flowLang";

/**
 * Privacy policy (rewritten 19 Nov 2026 for the Kelly rule): the information
 * GDPR art. 13 and LSSI art. 22 require, in Spanish and in English.
 *
 * Square brackets are facts only Jordan can give (legal name, NIF, postal
 * address, retention periods). They are marked on the page on purpose and
 * must be filled before this goes live: a consent is only valid if people
 * know who is asking.
 *
 * Links stay on massageclub.io (house rule): the AEPD's website is named, not
 * linked.
 */

type L = "es" | "en";

/** A fact still to be filled in, visibly marked. */
const Ph = ({ children }: { children: ReactNode }) => (
  <mark className="rounded bg-[#FFF1C2] px-1 font-semibold text-[#5a4736]">{children}</mark>
);
const Mail = () => (
  <a href="mailto:support@massageclub.io" className="font-semibold underline underline-offset-2">support@massageclub.io</a>
);
const List = ({ children }: { children: ReactNode }) => <ul className="mt-2 list-disc space-y-1.5 pl-5">{children}</ul>;

const UPDATED: Record<L, string> = {
  es: "Última actualización: 19 de noviembre de 2026",
  en: "Last updated: 19 November 2026",
};

const SECTIONS: { id: string; title: Record<L, string>; body: Record<L, ReactNode> }[] = [
  {
    id: "who",
    title: { es: "1. Quién es el responsable", en: "1. Who is responsible for your data" },
    body: {
      es: (
        <>
          <p>
            Massage Club (massageclub.io), servicio gestionado por <Ph>[NOMBRE LEGAL]</Ph>, NIF <Ph>[NIF]</Ph>, con
            domicilio en <Ph>[DIRECCIÓN POSTAL]</Ph>, Madrid, España.
          </p>
          <p className="mt-2">Contacto para todo lo relacionado con tus datos: <Mail />.</p>
          <p className="mt-2">
            Massage Club es un servicio gratuito: preguntamos por ti a centros de masaje de Madrid si tienen hueco, tú
            eliges y pagas en el centro.
          </p>
        </>
      ),
      en: (
        <>
          <p>
            Massage Club (massageclub.io), run by <Ph>[LEGAL NAME]</Ph>, tax number (NIF) <Ph>[NIF]</Ph>, address{" "}
            <Ph>[POSTAL ADDRESS]</Ph>, Madrid, Spain.
          </p>
          <p className="mt-2">Contact for anything about your data: <Mail />.</p>
          <p className="mt-2">
            Massage Club is a free service: we ask massage studios in Madrid for a time on your behalf, you choose,
            and you pay at the studio.
          </p>
        </>
      ),
    },
  },
  {
    id: "what",
    title: { es: "2. Qué datos usamos", en: "2. What data we use" },
    body: {
      es: (
        <List>
          <li>Tu nombre, tu email y, si nos lo das, tu teléfono o WhatsApp.</li>
          <li>Tu solicitud: el masaje, el día, la hora, la zona, cuántas personas y lo que escribas para el centro.</li>
          <li>Tu ubicación, solo si tocas "Usar mi ubicación", para buscar centros cerca de ti.</li>
          <li>Datos de salud solo si decides contárnoslos (por ejemplo una lesión o una alergia), para que el centro lo sepa.</li>
          <li>Tus mensajes, si nos escribes por WhatsApp o por email.</li>
          <li>Tus reservas, tus opiniones y tu respuesta a la pregunta sobre ofertas.</li>
          <li>Cómo se usa la web (páginas y toques, sin tu nombre ni tu email). Cookies solo si las aceptas.</li>
        </List>
      ),
      en: (
        <List>
          <li>Your name, your email and, if you give it, your phone or WhatsApp number.</li>
          <li>Your request: the massage, day, time, area, number of people and anything you write for the studio.</li>
          <li>Your location, only if you tap "Use my location", to find studios near you.</li>
          <li>Health information only if you choose to tell us (for example an injury or an allergy), so the studio knows.</li>
          <li>Your messages, if you write to us on WhatsApp or by email.</li>
          <li>Your bookings, your reviews and your answer to the offers question.</li>
          <li>How the website is used (pages and taps, without your name or email). Cookies only if you accept them.</li>
        </List>
      ),
    },
  },
  {
    id: "why",
    title: { es: "3. Para qué los usamos y con qué base legal", en: "3. Why we use your data, and the legal basis" },
    body: {
      es: (
        <List>
          <li>
            <b>Tu solicitud y tu reserva:</b> preguntar a los centros, enviarte sus horas, reservar cuando dices que sí,
            escribirte sobre esa reserva y, después del masaje, pedirte tu opinión. Base: las medidas que nos pides antes
            de reservar y la gestión de la reserva (art. 6.1.b RGPD).
          </li>
          <li>
            <b>Datos de salud que nos cuentes:</b> solo para pasárselos al centro. Base: tu consentimiento explícito (art.
            9.2.a RGPD), que puedes retirar cuando quieras.
          </li>
          <li>
            <b>Ofertas y recordatorios para volver a reservar, por email y WhatsApp:</b> solo si tocaste "Sí, quiero
            ofertas". Base: tu consentimiento (art. 6.1.a RGPD y art. 21 de la Ley 34/2002, LSSI). Puedes retirarlo en
            cualquier momento y retirarlo no afecta a tus reservas. Tu reserva nunca depende de esta respuesta: si dices
            que no o no contestas, reservas igual y no te enviamos ofertas.
          </li>
          <li>
            <b>El recordatorio dentro de un mes,</b> solo si lo activaste. Base: tu consentimiento.
          </li>
          <li>
            <b>Demostrar tu respuesta:</b> guardamos tu respuesta (sí, no o baja), el texto exacto que viste, el idioma y
            la hora, para poder demostrar lo que aceptaste (art. 7.1 RGPD). Si te das de baja, guardamos tu email o
            teléfono en una lista de exclusión para no volver a escribirte (art. 23 de la Ley Orgánica 3/2018, LOPDGDD).
            Base: obligación legal (art. 6.1.c RGPD).
          </li>
          <li>
            <b>Estadísticas de la web</b> sin tu nombre ni tu email, para que la web funcione bien. Base: interés legítimo
            (art. 6.1.f RGPD). Las cookies de medición, solo si tocas "Aceptar" (art. 22.2 LSSI).
          </li>
        </List>
      ),
      en: (
        <List>
          <li>
            <b>Your request and your booking:</b> asking the studios, sending you their times, booking when you say yes,
            writing to you about that booking and, after the massage, asking for your review. Basis: the steps you ask for
            before booking and handling the booking (GDPR art. 6.1.b).
          </li>
          <li>
            <b>Health information you tell us:</b> only to pass it to the studio. Basis: your explicit consent (GDPR art.
            9.2.a), which you can withdraw at any time.
          </li>
          <li>
            <b>Offers and reminders to book again, by email and WhatsApp:</b> only if you tapped "Yes, send me offers".
            Basis: your consent (GDPR art. 6.1.a and art. 21 of Spain's Law 34/2002, LSSI). You can withdraw it at any
            time, and withdrawing it does not affect your bookings. Your booking never depends on this answer: if you say
            no or do not answer, you book all the same and we send you no offers.
          </li>
          <li>
            <b>The reminder in a month,</b> only if you switched it on. Basis: your consent.
          </li>
          <li>
            <b>Proving your answer:</b> we keep your answer (yes, no or stop), the exact words you saw, the language and
            the time, so we can show what you agreed to (GDPR art. 7.1). If you stop offers, we keep your email or phone
            on a do-not-contact list so we never write to you again (art. 23 of Spain's Organic Law 3/2018, LOPDGDD).
            Basis: legal obligation (GDPR art. 6.1.c).
          </li>
          <li>
            <b>Website statistics</b> without your name or email, to keep the website working well. Basis: legitimate
            interest (GDPR art. 6.1.f). Measurement cookies only if you tap "Accept" (LSSI art. 22.2).
          </li>
        </List>
      ),
    },
  },
  {
    id: "recipients",
    title: { es: "4. Con quién compartimos tus datos", en: "4. Who we share your data with" },
    body: {
      es: (
        <>
          <List>
            <li>
              <b>Los centros a los que preguntamos por tu solicitud</b> (normalmente varios): los datos de la solicitud
              (masaje, día, hora, zona, personas y lo que escribas para el centro).
            </li>
            <li>
              <b>El centro que reservas, o desde cuya página envías la solicitud:</b> además, tu nombre y cómo contactarte,
              para atenderte.
            </li>
          </List>
          <p className="mt-3">Proveedores que tratan datos por encargo nuestro:</p>
          <List>
            <li>Meta Platforms (WhatsApp), si nos escribes por WhatsApp y para escribir a los centros.</li>
            <li>Resend, para enviar los emails.</li>
            <li>Supabase, base de datos y funciones del servidor.</li>
            <li>Vercel, alojamiento de la web.</li>
            <li>Anthropic, inteligencia artificial que lee los mensajes de WhatsApp y prepara las respuestas.</li>
            <li>Telegram, avisos internos a Massage Club sobre nuevas solicitudes.</li>
            <li>Google (medición de anuncios de Google Ads) y Microsoft (Clarity), solo si aceptas las cookies.</li>
          </List>
          <p className="mt-3">No vendemos tus datos.</p>
        </>
      ),
      en: (
        <>
          <List>
            <li>
              <b>The studios we ask about your request</b> (usually several): the request details (massage, day, time,
              area, people and anything you write for the studio).
            </li>
            <li>
              <b>The studio you book, or whose page you send the request from:</b> also your name and how to contact you,
              so it can look after you.
            </li>
          </List>
          <p className="mt-3">Providers that handle data on our behalf:</p>
          <List>
            <li>Meta Platforms (WhatsApp), if you write to us on WhatsApp, and to write to the studios.</li>
            <li>Resend, to send the emails.</li>
            <li>Supabase, the database and server functions.</li>
            <li>Vercel, website hosting.</li>
            <li>Anthropic, the AI that reads WhatsApp messages and drafts the replies.</li>
            <li>Telegram, internal alerts to Massage Club about new requests.</li>
            <li>Google (Google Ads measurement) and Microsoft (Clarity), only if you accept cookies.</li>
          </List>
          <p className="mt-3">We do not sell your data.</p>
        </>
      ),
    },
  },
  {
    id: "transfers",
    title: { es: "5. Transferencias fuera de la Unión Europea", en: "5. Transfers outside the European Union" },
    body: {
      es: (
        <p>
          Varios de estos proveedores tienen su sede fuera del Espacio Económico Europeo, sobre todo en Estados Unidos.
          Cuando tus datos salen del Espacio Económico Europeo, la transferencia se basa en el Marco de Privacidad de
          Datos UE-EE. UU. si el proveedor está adherido, o en las cláusulas contractuales tipo de la Comisión Europea.
          Puedes pedirnos más información en <Mail />.
        </p>
      ),
      en: (
        <p>
          Several of these providers are based outside the European Economic Area, mainly in the United States. When
          your data leaves the European Economic Area, the transfer relies on the EU-US Data Privacy Framework where the
          provider is certified, or on the European Commission's standard contractual clauses. You can ask us for
          details at <Mail />.
        </p>
      ),
    },
  },
  {
    id: "retention",
    title: { es: "6. Cuánto tiempo los guardamos", en: "6. How long we keep your data" },
    body: {
      es: (
        <List>
          <li>Solicitudes y reservas: mientras uses Massage Club y <Ph>[PLAZO]</Ph> desde tu última reserva, o más solo si la ley lo exige.</li>
          <li>Tu respuesta sobre ofertas y el texto que viste: mientras esté vigente y <Ph>[PLAZO]</Ph> después de que te des de baja, para poder demostrarlo.</li>
          <li>La lista de exclusión: el tiempo necesario para no volver a escribirte.</li>
          <li>Tus opiniones: mientras estén publicadas o hasta que nos pidas borrarlas.</li>
        </List>
      ),
      en: (
        <List>
          <li>Requests and bookings: while you use Massage Club and <Ph>[PERIOD]</Ph> after your last booking, or longer only if the law requires it.</li>
          <li>Your offers answer and the words you saw: while it is in force and <Ph>[PERIOD]</Ph> after you stop offers, so we can prove it.</li>
          <li>The do-not-contact list: as long as needed so we never write to you again.</li>
          <li>Your reviews: while they are published or until you ask us to delete them.</li>
        </List>
      ),
    },
  },
  {
    id: "rights",
    title: { es: "7. Tus derechos", en: "7. Your rights" },
    body: {
      es: (
        <>
          <p>
            Puedes pedir acceso a tus datos, corregirlos, borrarlos, oponerte a su uso, limitarlo y llevártelos (portabilidad),
            y retirar cualquier consentimiento en cualquier momento, sin que afecte a lo hecho antes. Escríbenos a <Mail /> y
            te contestamos en un mes como máximo.
          </p>
          <p className="mt-2">
            Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos
            (AEPD), en www.aepd.es o en C/ Jorge Juan 6, 28001 Madrid.
          </p>
        </>
      ),
      en: (
        <>
          <p>
            You can ask to see your data, correct it, delete it, object to its use, restrict it and take it with you
            (portability), and you can withdraw any consent at any time, without affecting what was done before. Write to{" "}
            <Mail /> and we answer within one month.
          </p>
          <p className="mt-2">
            If you think we have not handled your data properly, you can complain to Spain's data protection authority,
            the Agencia Española de Protección de Datos (AEPD), at www.aepd.es or C/ Jorge Juan 6, 28001 Madrid.
          </p>
        </>
      ),
    },
  },
  {
    id: "stop",
    title: { es: "8. Cómo dejar de recibir ofertas", en: "8. How to stop offers" },
    body: {
      es: (
        <>
          <p>Cuando quieras, de cualquiera de estas formas:</p>
          <List>
            <li>Con un toque en el enlace de baja que llevan todos nuestros emails de ofertas.</li>
            <li>Respondiendo STOP por WhatsApp.</li>
            <li>Escribiendo a <Mail />.</li>
            <li>Si tienes cuenta, tocando "No, gracias" en tu perfil.</li>
          </List>
          <p className="mt-2">Los mensajes sobre una reserva que hagas te seguirán llegando.</p>
        </>
      ),
      en: (
        <>
          <p>Whenever you want, in any of these ways:</p>
          <List>
            <li>With one tap on the unsubscribe link in every offers email we send.</li>
            <li>By replying STOP on WhatsApp.</li>
            <li>By writing to <Mail />.</li>
            <li>If you have an account, by tapping "No thanks" on your profile.</li>
          </List>
          <p className="mt-2">Messages about a booking you make still reach you.</p>
        </>
      ),
    },
  },
  {
    id: "cookies",
    title: { es: "9. Cookies y almacenamiento local", en: "9. Cookies and local storage" },
    body: {
      es: (
        <>
          <p>Usamos almacenamiento local esencial: tu idioma, tu sesión si entras en tu cuenta y tu elección sobre cookies.</p>
          <p className="mt-2">
            Si tocas "Aceptar" en el aviso de cookies, Google Ads mide qué anuncios nuestros llevan a una visita o a una
            solicitud, y Microsoft Clarity graba sesiones enmascaradas (sin los textos que escribes) y mapas de calor para
            ver qué no funciona en la web. Si tocas "Rechazar", no se carga ninguno de los dos.
          </p>
        </>
      ),
      en: (
        <>
          <p>We use essential local storage: your language, your session if you sign in, and your cookie choice.</p>
          <p className="mt-2">
            If you tap "Accept" on the cookie notice, Google Ads measures which of our ads lead to a visit or a request,
            and Microsoft Clarity records masked sessions (without the text you type) and heatmaps so we can see what does
            not work on the website. If you tap "Decline", neither is loaded.
          </p>
        </>
      ),
    },
  },
  {
    id: "changes",
    title: { es: "10. Cambios en esta política", en: "10. Changes to this policy" },
    body: {
      es: <p>Si cambiamos esta política, lo publicamos aquí con la nueva fecha.</p>,
      en: <p>If we change this policy, we publish it here with the new date.</p>,
    },
  },
];

export default function Privacy() {
  const flowLang = useFlowLang();
  const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("lang") : null;
  const [lang, setLang] = useState<L>((fromUrl || flowLang) === "es" ? "es" : "en");

  return (
    <div className="min-h-screen" style={{ background: "#FAF6F1" }}>
      <div
        className="flex items-center gap-2.5 px-5 py-3.5 border-b desk:hidden"
        style={{ borderColor: "#ece4d7", background: "#FAF6F1" }}
      >
        <img
          src="/brand/mc-avatar-terracotta.png"
          alt="Massage Club"
          width={28}
          height={28}
          className="rounded-lg"
        />
        <span className="font-semibold text-[#3d2b1f]" style={{ letterSpacing: 0.2 }}>
          Massage Club
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-10">
        <div
          className="w-full bg-white rounded-2xl shadow-sm p-6 md:p-10 text-[#3d2b1f]"
          style={{ boxShadow: "0 6px 24px rgba(80, 44, 20, 0.08)" }}
        >
          <div className="text-center mb-6">
            <div
              className="text-xs font-bold uppercase tracking-[2.5px] mb-3 desk:text-caption desk:font-semibold desk:normal-case desk:tracking-normal"
              style={{ color: "#B85C38" }}
            >
              Massage Club
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-[#2b2b2b]">
              {lang === "es" ? "Política de privacidad" : "Privacy policy"}
            </h1>
            <p className="text-sm text-[#8a7460] mt-2">{UPDATED[lang]}</p>
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

          <div lang={lang}>
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="mb-8 text-left">
                <h2 className="text-lg font-semibold mb-2" style={{ color: "#B85C38" }}>
                  {s.title[lang]}
                </h2>
                <div className="text-[15px] leading-relaxed text-[#5a4736]">{s.body[lang]}</div>
              </section>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t text-center text-sm text-[#8a7460]" style={{ borderColor: "#ece4d7" }}>
            Massage Club · Madrid · support@massageclub.io
          </div>
        </div>
      </div>
    </div>
  );
}
