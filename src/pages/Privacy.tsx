export default function Privacy() {
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
              Política de Privacidad
            </h1>
            <div className="text-sm text-[#8a7460] mt-2">Privacy Policy</div>
          </div>

          <p className="text-sm text-[#8a7460] text-center mb-8">
            Última actualización: 20 de julio de 2026 · Last updated: 20 July 2026
          </p>

          <Section es="1. Quiénes somos" en="Who we are">
            Massage Club (massageclub.io) es un marketplace de reservas de masajes en Madrid operado por Massage Club.
            <br />
            Contacto: support@massageclub.io
          </Section>

          <Section es="2. Qué datos recogemos" en="What we collect">
            <ul className="list-disc pl-5 space-y-1">
              <li>Nombre, email y teléfono para gestionar tu cuenta y reservas.</li>
              <li>Detalles de cada reserva: estudio, servicio, fecha, hora y precio.</li>
              <li>Preferencias de masaje que elijas compartir (presión deseada, conversación, zonas, etc.).</li>
              <li>Reseñas que publiques tras una reserva.</li>
            </ul>
          </Section>

          <Section es="3. Para qué usamos tus datos" en="Why we use your data">
            <ul className="list-disc pl-5 space-y-1">
              <li>Crear y gestionar tus reservas.</li>
              <li>Notificar al estudio que has reservado.</li>
              <li>Enviarte confirmaciones, recordatorios y solicitudes de reseña por email.</li>
              <li>Mostrar valoraciones agregadas y anónimas para ayudar a otros clientes.</li>
            </ul>
          </Section>

          <Section es="4. Con quién compartimos tus datos" en="Who we share it with">
            Solo compartimos tus datos con:
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>El estudio que reserves para que pueda atenderte.</li>
              <li>Nuestro proveedor de email (Resend) para enviar notificaciones.</li>
              <li>Nuestro proveedor de infraestructura (Supabase) para almacenar la información.</li>
            </ul>
            No vendemos tus datos a terceros ni usamos publicidad basada en perfiles.
          </Section>

          <Section es="5. Cookies y almacenamiento local" en="Cookies and local storage">
            Solo usamos cookies y localStorage esenciales: preferencia de idioma y sesión de usuario.
            No usamos cookies de publicidad ni seguimiento de terceros.
          </Section>

          <Section es="6. Conservación" en="Retention">
            Guardamos tus datos mientras tengas una cuenta con nosotros o hasta que nos pidas que los eliminemos.
            Puedes solicitar la eliminación escribiendo a support@massageclub.io.
          </Section>

          <Section es="7. Tus derechos" en="Your rights">
            Tienes derecho a acceder, corregir o eliminar tus datos personales, así como a oponerte al tratamiento en ciertos casos.
            Escríbenos a support@massageclub.io y te ayudaremos.
          </Section>

          <Section es="8. Base legal (GDPR)" en="Legal basis (GDPR)">
            El tratamiento se basa en la ejecución del contrato de reserva y en nuestro interés legítimo de mantenerte informado sobre tu cita.
          </Section>

          <Section es="9. Cambios en esta política" en="Changes to this policy">
            Podemos actualizar esta política ocasionalmente. Publicaremos cualquier cambio en esta página con la nueva fecha de actualización.
          </Section>

          <div className="mt-8 pt-6 border-t text-center text-sm text-[#8a7460]" style={{ borderColor: "#ece4d7" }}>
            Massage Club · Madrid · support@massageclub.io
          </div>
        </div>
      </div>
    </div>
  );
}
