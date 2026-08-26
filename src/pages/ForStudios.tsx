import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function ForStudios() {
  return (
    <>
      <Helmet>
        <title>For studios · Massage Club</title>
        <meta
          name="description"
          content="No fees, no commission, no lock-in. Massage Club terms for Madrid massage studios."
        />
      </Helmet>

      <div className="min-h-screen" style={{ background: "#FAF6F1" }}>
        {/* Simple header */}
        <div
          className="flex items-center justify-between gap-2.5 px-5 py-3.5 border-b"
          style={{ borderColor: "#ece4d7", background: "#FAF6F1" }}
        >
          <Link to="/" className="flex items-center gap-2.5">
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
          </Link>
          <Link
            to="/partner/login"
            className="text-xs font-semibold text-[#B85C38] hover:underline"
          >
            Partner login
          </Link>
        </div>

        <div className="max-w-2xl mx-auto px-5 py-10">
          <div
            className="w-full bg-white rounded-2xl shadow-sm p-8 md:p-10 text-[#3d2b1f]"
            style={{ boxShadow: "0 6px 24px rgba(80, 44, 20, 0.08)" }}
          >
            <div className="text-center mb-8">
              <div
                className="text-xs font-bold uppercase mb-3"
                style={{ color: "#B85C38", letterSpacing: "2.5px" }}
              >
                For studios <span className="font-normal opacity-70">/ Para centros</span>
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-semibold text-[#2b2b2b]">
                No fees, no commission, no lock-in
              </h1>
              <div className="text-sm text-[#8a7460] mt-2">
                Sin cuotas, sin comisión, sin permanencia
              </div>
            </div>

            <p className="text-sm text-[#8a7460] text-center mb-8">
              The terms we offer every studio. Plain and simple. / Las condiciones que ofrecemos a todos los centros. Claras y simples.
            </p>

            <TopCta />

            {/* Terms panel */}
            <section className="mt-10 mb-10 rounded-2xl border border-[#EADFD2] bg-[#FBF7F2] p-6 md:p-8">
              <h2 className="font-display text-lg font-semibold text-[#2b2b2b] mb-5">
                What it costs / Lo que cuesta
              </h2>
              <ul className="space-y-5">
                <TermItem
                  en="Cost: 0 euros. No monthly fee, no setup fee."
                  es="Coste: 0 euros. Sin cuota mensual ni de alta."
                />
                <TermItem
                  en="Commission: 0 percent. We take nothing from your bookings."
                  es="Comisión: 0%. No nos llevamos nada de vuestras reservas."
                />
                <TermItem
                  en="The client pays you directly at the studio, exactly as they do today. We never handle the money."
                  es="El cliente paga directamente en el estudio, como siempre. Nosotros no tocamos el dinero."
                />
                <TermItem
                  en="No exclusivity, no lock-in. Leave whenever you want."
                  es="Sin exclusividad y sin permanencia. Podéis salir cuando queráis."
                />
                <TermItem
                  en="Free this year because we need real studios and real bookings, not revenue. If we ever charge, we will tell you well in advance."
                  es="Gratis este año porque necesitamos estudios y reservas reales, no ingresos. Si algún día cobramos algo, os avisaremos con mucha antelación."
                />
              </ul>
            </section>

            {/* How it works */}
            <section className="mb-10">
              <h2 className="font-display text-lg font-semibold text-[#2b2b2b] mb-5">
                How it works / Cómo funciona
              </h2>
              <div className="space-y-4">
                <Step number={1} en="A client books on Massage Club." es="Un cliente reserva en Massage Club." />
                <Step number={2} en="You get an email with the day, time and client details." es="Recibes un email con el día, la hora y los datos del cliente." />
                <Step number={3} en="You confirm or decline with one click. Nothing new to learn, no login required to confirm." es="Confirmas o rechazas con un clic. Nada nuevo que aprender, no hace falta iniciar sesión para confirmar." />
              </div>
            </section>

            {/* FAQ */}
            <section className="mb-10">
              <h2 className="font-display text-lg font-semibold text-[#2b2b2b] mb-5">
                FAQ / Preguntas frecuentes
              </h2>
              <div className="space-y-5">
                <FaqItem
                  qEn="Do I need to change my current booking system?"
                  qEs="¿Tengo que cambiar mi sistema de reservas actual?"
                  aEn="No."
                  aEs="No."
                />
                <FaqItem
                  qEn="What if I am full?"
                  qEs="¿Y si estoy lleno?"
                  aEn="Decline in one click, the client is told immediately."
                  aEs="Rechazas con un clic y el cliente lo sabe enseguida."
                />
                <FaqItem
                  qEn="Who owns the client?"
                  qEs="¿De quién es el cliente?"
                  aEn="You do, they pay you and come back to you."
                  aEs="Tuyo: paga a ti y vuelve a ti."
                />
                <FaqItem
                  qEn="How do I get listed?"
                  qEs="¿Cómo salgo listado?"
                  aEn="You already are, claim your page."
                  aEs="Ya lo estás, reclama tu página."
                />
              </div>
            </section>

            <TopCta />

            <div className="mt-8 pt-6 border-t text-center text-sm text-[#8a7460]" style={{ borderColor: "#ece4d7" }}>
              Massage Club · Madrid · support@massageclub.io
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TermItem({ en, es }: { en: string; es: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-[#B85C38] text-white flex items-center justify-center text-xs font-bold">✓</span>
      <div>
        <p className="text-[15px] leading-relaxed text-[#3d2b1f]">{en}</p>
        <p className="text-sm text-[#8a7460] mt-0.5">{es}</p>
      </div>
    </li>
  );
}

function Step({ number, en, es }: { number: number; en: string; es: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#B85C38] text-white flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div>
        <p className="text-[15px] leading-relaxed text-[#3d2b1f]">{en}</p>
        <p className="text-sm text-[#8a7460] mt-0.5">{es}</p>
      </div>
    </div>
  );
}

function FaqItem({ qEn, qEs, aEn, aEs }: { qEn: string; qEs: string; aEn: string; aEs: string }) {
  return (
    <div>
      <p className="font-semibold text-[#3d2b1f] text-[15px]">{qEn}</p>
      <p className="text-sm text-[#8a7460] mt-0.5">{qEs}</p>
      <p className="text-sm text-[#5a4736] mt-1.5">{aEn}</p>
      <p className="text-sm text-[#8a7460] mt-0.5">{aEs}</p>
    </div>
  );
}

function TopCta() {
  return (
    <div className="flex justify-center">
      <Link
        to="/partner/onboarding"
        className="inline-flex items-center justify-center px-8 py-3 rounded-2xl font-semibold text-white shadow-sm hover:opacity-95 transition"
        style={{ background: "#B85C38" }}
      >
        Claim your page <span className="font-normal opacity-90 ml-1.5">/ Reclama tu página</span>
      </Link>
    </div>
  );
}
