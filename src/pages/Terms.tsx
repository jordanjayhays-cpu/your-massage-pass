export default function Terms() {
  const Section = ({ es, en, children }: { es: string; en: string; children: React.ReactNode }) => (
    <section className="mb-8 text-left">
      <h2 className="text-lg font-semibold mb-2" style={{ color: "#B85C38" }}>
        {es}
      </h2>
      <div className="text-[15px] leading-relaxed text-[#5a4736]">{children}</div>
      <p className="mt-2 text-sm italic text-[#8a7460]">{en}</p>
    </section>
  );

  return (
    <div className="min-h-screen" style={{ background: "#FAF6F1" }}>
      <div
        className="flex items-center gap-2.5 px-5 py-3.5 border-b"
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
          className="w-full bg-white rounded-2xl shadow-sm p-8 md:p-10 text-[#3d2b1f]"
          style={{ boxShadow: "0 6px 24px rgba(80, 44, 20, 0.08)" }}
        >
          <div className="text-center mb-8">
            <div
              className="text-xs font-bold uppercase mb-3"
              style={{ color: "#B85C38", letterSpacing: "2.5px" }}
            >
              Massage Club
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-[#2b2b2b]">
              Términos del Servicio
            </h1>
            <div className="text-sm text-[#8a7460] mt-2">Terms of Service</div>
          </div>

          <p className="text-sm text-[#8a7460] text-center mb-8">
            Última actualización: 20 de julio de 2026 · Last updated: 20 July 2026
          </p>

          <Section es="1. Naturaleza del servicio" en="Nature of the service">
            Massage Club es un intermediario de reservas entre clientes y estudios independientes de masajes en Madrid. Facilitamos la reserva, pero el servicio se presta directamente por el estudio que elijas.
          </Section>

          <Section es="2. Pagos" en="Payments">
            El pago se realiza en el estudio salvo que el estudio ofrezca una opción de pago online o pago en el momento de la reserva. Massage Club no procesa pagos directamente.
          </Section>

          <Section es="3. Cancelaciones y cambios" en="Cancellations and rescheduling">
            Puedes cancelar o cambiar tu reserva gratis a través de los enlaces del email de confirmación o desde tu apartado "Mis reservas".
          </Section>

          <Section es="4. Responsabilidad de los estudios" en="Studio responsibility">
            Cada estudio es responsable de los servicios que ofrece, de su calidad, de su personal cualificado y de cumplir la normativa aplicable. Massage Club no asume responsabilidad por los servicios prestados.
          </Section>

          <Section es="5. Reseñas" en="Reviews">
            Las reseñas deben ser honestas, veraces y respetuosas. Nos reservamos el derecho de eliminar contenido abusivo, spam o que no cumpla con nuestras normas.
          </Section>

          <Section es="6. Cuentas y uso aceptable" en="Accounts and acceptable use">
            Debes proporcionar información veraz al registrarte. No está permitido usar la plataforma para fines ilegales, fraudulentos o que perturben el funcionamiento de los estudios.
          </Section>

          <Section es="7. Modificaciones" en="Modifications">
            Podemos actualizar estos términos ocasionalmente. Te notificaremos cambios importantes y publicaremos la nueva fecha de actualización en esta página.
          </Section>

          <Section es="8. Contacto" en="Contact">
            Para cualquier duda, escribe a support@massageclub.io.
          </Section>

          <div className="mt-8 pt-6 border-t text-center text-sm text-[#8a7460]" style={{ borderColor: "#ece4d7" }}>
            Massage Club · Madrid · support@massageclub.io
          </div>
        </div>
      </div>
    </div>
  );
}
