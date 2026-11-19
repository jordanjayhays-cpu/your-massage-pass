import { useState, type ReactNode } from "react";
import { useFlowLang } from "@/lib/flowLang";
import { LEGAL_ENTITY, postalAddress } from "@/lib/legalEntity";

/**
 * Privacy policy (rewritten 19 Nov 2026 for the Kelly rule): the information
 * GDPR art. 13 and LSSI art. 22 require, in Spanish and in English.
 *
 * The controller is Kinsol LLC, trading as Massage Club (CLAUDE.md, "Legal
 * entity", 19 Nov). Its details live in src/lib/legalEntity.ts, shared with
 * the legal notice (/legal). The page never shows a placeholder: a fact still
 * missing (the EU representative, the entity number) prints nothing, and the
 * test fails if any "[...]" or <mark> appears.
 *
 * Before this page goes live (each is outside this file):
 *   - the EU representative (GDPR art. 27) is named in legalEntity.ts;
 *   - Telegram alerts carry only the request number (notify-whatsapp-request
 *     and notify-booking still send the name and WhatsApp number);
 *   - the processor agreements with the providers in section 4 are in place
 *     (Supabase's is signed in its dashboard);
 *   - a Spanish data-protection adviser has read sections 3 (health data) and
 *     6 (the retention periods proposed here).
 *
 * Every statement must be true of the live site: section 9 is true because
 * neither the Google tag nor Clarity loads before "Accept" (index.html,
 * public/go.html, src/lib/clarity.ts).
 *
 * Links stay on massageclub.io (house rule): the AEPD's website is named, not
 * linked.
 */

type L = "es" | "en";

const Mail = () => (
  <a href="mailto:support@massageclub.io" className="font-semibold underline underline-offset-2">support@massageclub.io</a>
);
const Lnk = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className="font-semibold underline underline-offset-2">{children}</a>
);
const List = ({ children }: { children: ReactNode }) => <ul className="mt-2 list-disc space-y-1.5 pl-5">{children}</ul>;

const UPDATED: Record<L, string> = {
  es: "Última actualización: 19 de noviembre de 2026",
  en: "Last updated: 19 November 2026",
};

const E = LEGAL_ENTITY;

/** Clears the cookie choice, so the notice asks again on the next page. */
function resetCookieChoice() {
  try { localStorage.removeItem("mc_consent"); } catch { /* blocked storage: nothing was saved */ }
  window.location.reload();
}

export const SECTIONS: { id: string; title: Record<L, string>; body: Record<L, ReactNode> }[] = [
  {
    id: "who",
    title: { es: "1. Quién es el responsable", en: "1. Who is responsible for your data" },
    body: {
      es: (
        <>
          <p>
            El responsable de tus datos es <b>{E.name}</b>, que opera con el nombre comercial {E.tradingAs} ({E.website}).{" "}
            {E.name} es una {E.registered.es}
            {E.entityId ? `, con número de registro ${E.entityId}` : ""}
            {E.taxId ? ` y número fiscal ${E.taxId}` : ""}. Domicilio: {postalAddress("es")}.
          </p>
          <p className="mt-2">Contacto para todo lo relacionado con tus datos, en español o en inglés: <Mail />.</p>
          {E.euRepresentative && (
            <p className="mt-2">Nuestro representante en la Unión Europea (art. 27 RGPD): {E.euRepresentative}.</p>
          )}
          <p className="mt-2">
            Massage Club es un servicio gratuito para ti: preguntamos por ti a centros de masaje de Madrid si tienen
            hueco, tú eliges y pagas en el centro. Más datos sobre nosotros en el <Lnk href="/legal">aviso legal</Lnk>.
          </p>
        </>
      ),
      en: (
        <>
          <p>
            The controller of your data is <b>{E.name}</b>, trading as {E.tradingAs} ({E.website}). {E.name} is{" "}
            {E.registered.en}
            {E.entityId ? `, entity number ${E.entityId}` : ""}
            {E.taxId ? `, tax number ${E.taxId}` : ""}. Address: {postalAddress("en")}.
          </p>
          <p className="mt-2">Contact for anything about your data, in English or Spanish: <Mail />.</p>
          {E.euRepresentative && (
            <p className="mt-2">Our representative in the European Union (GDPR art. 27): {E.euRepresentative}.</p>
          )}
          <p className="mt-2">
            Massage Club is free for you: we ask massage studios in Madrid for a time on your behalf, you choose, and
            you pay at the studio. More about us in the <Lnk href="/legal">legal notice</Lnk>.
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
          <li>
            Tu nombre, tu email y, si nos lo das, tu teléfono o WhatsApp. En la web necesitamos tu email para gestionar
            la solicitud: sin él no podemos reservar. Por WhatsApp te lo pedimos, pero si prefieres no darlo seguimos
            solo por WhatsApp.
          </li>
          <li>Tu solicitud: el masaje, el día, la hora, la zona, cuántas personas y la nota que escribas para el centro.</li>
          <li>Tu ubicación, solo si tocas "Usar mi ubicación", para buscar centros cerca de ti.</li>
          <li>No te pedimos datos de salud. Si escribes alguno en la nota, mira el punto 3.</li>
          <li>Tus mensajes, si nos escribes por WhatsApp o por email.</li>
          <li>Tus reservas, tus opiniones y tu respuesta a la pregunta sobre ofertas.</li>
          <li>Cómo se usa la web (páginas y toques, sin tu nombre ni tu email). Cookies solo si las aceptas.</li>
        </List>
      ),
      en: (
        <List>
          <li>
            Your name, your email and, if you give it, your phone or WhatsApp number. On the website we need your email
            to handle the request: without it we cannot book. On WhatsApp we ask for it, but if you would rather not give
            it, we carry on by WhatsApp only.
          </li>
          <li>Your request: the massage, day, time, area, number of people and the note you write for the studio.</li>
          <li>Your location, only if you tap "Use my location", to find studios near you.</li>
          <li>We do not ask for health information. If you write some in the note, see section 3.</li>
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
            <b>Datos de salud en la nota:</b> no los necesitamos para buscarte hora, así que te pedimos que no los escribas;
            puedes contárselo al terapeuta en el centro. Si aun así escribes algo sobre tu salud, la nota va tal cual a los
            centros a los que preguntamos por tu solicitud y no la usamos para nada más. Si quieres que la borremos,
            escríbenos a <Mail />.
          </li>
          <li>
            <b>Ofertas y recordatorios para volver a reservar, por email y WhatsApp:</b> solo si tocaste "Sí, quiero
            ofertas". Base: tu consentimiento (art. 6.1.a RGPD y art. 21 de la Ley 34/2002, LSSI). Puedes retirarlo en
            cualquier momento y retirarlo no afecta a tus reservas. Tu reserva nunca depende de esta respuesta: si dices
            que no o no contestas, reservas igual y no te enviamos ofertas. Las ofertas pueden ser de los centros con los
            que trabajamos, pero te las enviamos nosotros: nunca damos tu contacto a un centro para que te envíe publicidad.
          </li>
          <li>
            <b>El recordatorio dentro de un mes,</b> solo si lo activaste. Base: tu consentimiento.
          </li>
          <li>
            <b>Demostrar tu respuesta y respetar tu baja:</b> guardamos tu respuesta (sí, no o baja), el texto exacto que
            viste, el idioma y la hora, para poder demostrar lo que aceptaste (art. 7.1 RGPD). Si te das de baja, guardamos
            tu email o teléfono en una lista de exclusión para no volver a escribirte. Base: nuestro interés legítimo en
            poder demostrarlo y en no volver a escribirte (art. 6.1.f RGPD y art. 23 de la Ley Orgánica 3/2018, LOPDGDD).
          </li>
          <li>
            <b>Estadísticas de la web</b> sin tu nombre ni tu email, para que la web funcione bien. Base: interés legítimo
            (art. 6.1.f RGPD). Las cookies de medición, solo si tocas "Aceptar" (art. 22.2 LSSI).
          </li>
          <li>
            No tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti o que te afecten de forma
            parecida (art. 22 RGPD).
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
            <b>Health information in the note:</b> we do not need it to find you a time, so please do not write it; you
            can tell the therapist at the studio. If you still write something about your health, the note goes as it is to
            the studios we ask about your request, and we use it for nothing else. If you want it deleted, write to{" "}
            <Mail />.
          </li>
          <li>
            <b>Offers and reminders to book again, by email and WhatsApp:</b> only if you tapped "Yes, send me offers".
            Basis: your consent (GDPR art. 6.1.a and art. 21 of Spain's Law 34/2002, LSSI). You can withdraw it at any
            time, and withdrawing it does not affect your bookings. Your booking never depends on this answer: if you say
            no or do not answer, you book all the same and we send you no offers. The offers may be from the studios we
            work with, but we send them to you: we never give a studio your contact so it can send you advertising.
          </li>
          <li>
            <b>The reminder in a month,</b> only if you switched it on. Basis: your consent.
          </li>
          <li>
            <b>Proving your answer and respecting your stop:</b> we keep your answer (yes, no or stop), the exact words
            you saw, the language and the time, so we can show what you agreed to (GDPR art. 7.1). If you stop offers, we
            keep your email or phone on a do-not-contact list so we never write to you again. Basis: our legitimate
            interest in being able to prove it and in never writing to you again (GDPR art. 6.1.f and art. 23 of Spain's
            Organic Law 3/2018, LOPDGDD).
          </li>
          <li>
            <b>Website statistics</b> without your name or email, to keep the website working well. Basis: legitimate
            interest (GDPR art. 6.1.f). Measurement cookies only if you tap "Accept" (LSSI art. 22.2).
          </li>
          <li>
            We make no automated decisions that have legal effects on you or affect you in a similar way (GDPR art. 22).
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
              (masaje, día, hora, zona, personas y la nota que escribas para el centro, con todo lo que pongas en ella).
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
            <li>Telegram, avisos internos a Massage Club: solo el número de la solicitud, sin tu nombre ni tus datos de contacto.</li>
            <li>Google (Google Fonts), que sirve los tipos de letra de la web y recibe la dirección IP de tu dispositivo al abrir la página.</li>
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
              area, people and the note you write for the studio, with everything you put in it).
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
            <li>Telegram, internal alerts to Massage Club: only the request number, without your name or contact details.</li>
            <li>Google (Google Fonts), which serves the website's typefaces and receives your device's IP address when the page opens.</li>
            <li>Google (Google Ads measurement) and Microsoft (Clarity), only if you accept cookies.</li>
          </List>
          <p className="mt-3">We do not sell your data.</p>
        </>
      ),
    },
  },
  {
    id: "transfers",
    title: { es: "5. Dónde se tratan tus datos", en: "5. Where your data is handled" },
    body: {
      es: (
        <>
          <p>
            Massage Club lo gestiona {E.name}, una empresa de Estados Unidos, así que tus datos se tratan desde Estados
            Unidos. El Reglamento General de Protección de Datos (RGPD) se aplica igualmente, porque ofrecemos el servicio
            a personas en España, y tienes todos los derechos del punto 7.
          </p>
          <p className="mt-2">
            Varios de los proveedores del punto 4 también tienen su sede fuera del Espacio Económico Europeo, sobre todo
            en Estados Unidos. Con cada uno trabajamos con su contrato de tratamiento de datos y, cuando tus datos salen
            del Espacio Económico Europeo, con el Marco de Privacidad de Datos UE-EE. UU. si el proveedor está adherido, o
            con las cláusulas contractuales tipo de la Comisión Europea. Puedes pedirnos una copia de estas garantías en{" "}
            <Mail />.
          </p>
        </>
      ),
      en: (
        <>
          <p>
            Massage Club is run by {E.name}, a United States company, so your data is handled from the United States.
            The EU General Data Protection Regulation (GDPR) still applies, because we offer the service to people in
            Spain, and you have all the rights in section 7.
          </p>
          <p className="mt-2">
            Several of the providers in section 4 are also based outside the European Economic Area, mainly in the United
            States. With each one we work under its data processing agreement and, when your data leaves the European
            Economic Area, under the EU-US Data Privacy Framework where the provider is certified, or the European
            Commission's standard contractual clauses. You can ask us for a copy of these safeguards at <Mail />.
          </p>
        </>
      ),
    },
  },
  {
    id: "retention",
    title: { es: "6. Cuánto tiempo los guardamos", en: "6. How long we keep your data" },
    body: {
      es: (
        <List>
          <li>
            Solicitudes, reservas y mensajes: mientras uses Massage Club y hasta 3 años después de tu última solicitud o
            reserva, por si hay que atender una reclamación. Después los borramos o los anonimizamos.
          </li>
          <li>
            Tu respuesta sobre ofertas y el texto que viste: mientras sea tu última respuesta y hasta 3 años después de
            que la cambies o te des de baja, para poder demostrarla si hay una reclamación.
          </li>
          <li>La lista de exclusión: el tiempo necesario para no volver a escribirte.</li>
          <li>Tus opiniones: mientras estén publicadas o hasta que nos pidas borrarlas.</li>
        </List>
      ),
      en: (
        <List>
          <li>
            Requests, bookings and messages: while you use Massage Club and up to 3 years after your last request or
            booking, in case a complaint has to be handled. After that we delete or anonymise them.
          </li>
          <li>
            Your offers answer and the words you saw: while it is your latest answer and up to 3 years after you change it
            or stop offers, so we can prove it if there is a complaint.
          </li>
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
            <li>En <Lnk href="/unsubscribe">book.massageclub.io/unsubscribe</Lnk>, escribiendo tu email o tu teléfono.</li>
            <li>Respondiendo STOP o BAJA por WhatsApp.</li>
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
            <li>At <Lnk href="/unsubscribe">book.massageclub.io/unsubscribe</Lnk>, by typing your email or phone.</li>
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
            ver qué no funciona en la web. Mientras no elijas, o si tocas "Rechazar", no se carga ninguno de los dos.
          </p>
          <p className="mt-2">
            <button type="button" onClick={resetCookieChoice} className="font-semibold underline underline-offset-2">
              Cambiar mi elección de cookies
            </button>
          </p>
        </>
      ),
      en: (
        <>
          <p>We use essential local storage: your language, your session if you sign in, and your cookie choice.</p>
          <p className="mt-2">
            If you tap "Accept" on the cookie notice, Google Ads measures which of our ads lead to a visit or a request,
            and Microsoft Clarity records masked sessions (without the text you type) and heatmaps so we can see what does
            not work on the website. Until you choose, or if you tap "Decline", neither is loaded.
          </p>
          <p className="mt-2">
            <button type="button" onClick={resetCookieChoice} className="font-semibold underline underline-offset-2">
              Change my cookie choice
            </button>
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
            {E.name} · {E.tradingAs} · {E.email} · <a href="/legal" className="underline underline-offset-2">{lang === "es" ? "Aviso legal" : "Legal notice"}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
