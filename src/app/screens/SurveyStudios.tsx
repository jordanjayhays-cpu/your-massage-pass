import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const FONT_CSS = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Outfit:wght@400;500;600&display=swap";

type Opt = { value: string; label: string };
type ChoiceQ = { type: "choice"; key: string; question: string; options: Opt[] };
type TextQ = { type: "text"; key: string; question: string; placeholder?: string };
type Q = ChoiceQ | TextQ;

const QUESTIONS: Q[] = [
  {
    type: "choice",
    key: "role",
    question: "¿Cuál es tu rol?",
    options: [
      { value: "owner", label: "Propietario/a" },
      { value: "manager", label: "Gerente" },
      { value: "therapist", label: "Terapeuta" },
    ],
  },
  {
    type: "choice",
    key: "booking_channel",
    question: "¿Cómo reservan tus clientes hoy?",
    options: [
      { value: "whatsapp", label: "WhatsApp" },
      { value: "phone", label: "Teléfono" },
      { value: "walkin", label: "Sin cita (walk-in)" },
      { value: "platform", label: "Treatwell o Booksy" },
      { value: "website", label: "Web propia" },
    ],
  },
  {
    type: "text",
    key: "platform_cost",
    question: "¿Usas alguna plataforma de reservas? ¿Cuánto te cuesta al mes (cuotas + comisiones)?",
    placeholder: "Ej: Treatwell, ~€200/mes",
  },
  {
    type: "choice",
    key: "pain",
    question: "¿Cuál es tu mayor problema de negocio?",
    options: [
      { value: "noshows", label: "Ausencias (no-shows)" },
      { value: "empty_hours", label: "Horas vacías" },
      { value: "new_clients", label: "Conseguir clientes nuevos" },
      { value: "admin_time", label: "Tiempo en gestión" },
      { value: "fees", label: "Comisiones altas" },
    ],
  },
  {
    type: "choice",
    key: "foreign_pct",
    question: "¿Qué porcentaje de tus clientes son extranjeros o turistas?",
    options: [
      { value: "pct_0_10", label: "0–10%" },
      { value: "pct_10_30", label: "10–30%" },
      { value: "pct_30_50", label: "30–50%" },
      { value: "pct_50_plus", label: "Más del 50%" },
    ],
  },
  {
    type: "choice",
    key: "noshows_week",
    question: "¿Cuántas ausencias tienes por semana?",
    options: [
      { value: "zero", label: "0" },
      { value: "one_two", label: "1–2" },
      { value: "three_five", label: "3–5" },
      { value: "five_plus", label: "Más de 5" },
    ],
  },
  {
    type: "choice",
    key: "would_list",
    question: "¿Listarías tu estudio gratis y sin comisión en una web para extranjeros y turistas?",
    options: [
      { value: "yes", label: "Sí" },
      { value: "maybe", label: "Quizás" },
      { value: "no", label: "No" },
    ],
  },
  {
    type: "text",
    key: "blocker",
    question: "¿Qué te lo impediría o qué te haría decir que sí?",
    placeholder: "Cuéntanos…",
  },
];

const MULTI_KEYS = new Set(["booking_channel", "pain"]);

export default function SurveyStudios() {
  const [searchParams] = useSearchParams();
  const source = (searchParams.get("src") || "").trim() || "direct";
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [studio, setStudio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const choiceQs = QUESTIONS.filter((q) => q.type === "choice") as ChoiceQ[];
  const isAnswered = (q: ChoiceQ) => {
    const v = answers[q.key];
    if (Array.isArray(v)) return v.length > 0;
    return !!v;
  };
  const canSubmit = choiceQs.every(isAnswered);

  const toggle = (q: ChoiceQ, value: string) => {
    if (MULTI_KEYS.has(q.key)) {
      const cur = (answers[q.key] as string[] | undefined) || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      setAnswers({ ...answers, [q.key]: next });
    } else {
      setAnswers({ ...answers, [q.key]: value });
    }
  };

  const isSelected = (q: ChoiceQ, value: string) => {
    const v = answers[q.key];
    if (Array.isArray(v)) return v.includes(value);
    return v === value;
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const contact = [studio.trim(), whatsapp.trim()].filter(Boolean).join(" — ") || null;
    const payloadAnswers: Record<string, string | string[]> = { ...answers };
    if (comments.trim()) {
      payloadAnswers.comments = comments.trim();
    }
    const { error } = await supabase.from("validation_responses").insert([
      { survey_type: "b2b", answers: payloadAnswers, contact, source },
    ]);
    setSubmitting(false);
    if (error) {
      console.error(error);
      alert("Algo salió mal. Inténtalo de nuevo.");
      return;
    }
    try {
      await supabase.functions.invoke("notify-survey-response", {
        body: { record: { survey_type: "b2b", answers: payloadAnswers, contact, source } },
      });
    } catch (e) {
      console.error("notify failed", e);
    }
    setDone(true);
  };

  const shellStyle: React.CSSProperties = {
    background: "linear-gradient(180deg,#F7F4F0 0%,#EFE7DD 100%)",
    color: "#211C1A",
    fontFamily: "'Outfit', system-ui, sans-serif",
    minHeight: "100vh",
  };
  const serif = { fontFamily: "'Fraunces', serif" };

  if (done) {
    return (
      <div style={shellStyle} className="flex items-center justify-center px-6">
        <link href={FONT_CSS} rel="stylesheet" />
        <div className="max-w-md w-full text-center py-16">
          <div className="text-5xl mb-4">🙏</div>
          <h1 style={serif} className="text-4xl mb-3">¡Mil gracias!</h1>
          <p className="text-[#7A7068]">Te escribiremos pronto.</p>
        </div>
      </div>
    );
  }

  const answered = choiceQs.filter((q) => answers[q.key]).length;
  const progress = Math.round((answered / choiceQs.length) * 100);

  return (
    <div style={shellStyle}>
      <link href={FONT_CSS} rel="stylesheet" />
      <div className="max-w-xl mx-auto px-5 py-10">
        <p className="text-[11px] tracking-[0.3em] uppercase text-[#7A7068] mb-3">Estudios de masaje · Madrid</p>
        <h1 style={serif} className="text-4xl leading-[1.05] mb-2">Ayúdanos a construir algo útil para tu estudio.</h1>
        <p className="text-[#7A7068] mb-6">Menos de 90 segundos. Sin compromiso.</p>

        <div className="h-1.5 rounded-full bg-[#E5DDD3] mb-8 overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "#C4622D" }}
          />
        </div>

        <div className="space-y-8">
          {QUESTIONS.map((q, i) => {
            const isMulti = q.type === "choice" && MULTI_KEYS.has(q.key);
            return (
            <div key={q.key}>
              <p style={serif} className="text-xl mb-1">
                <span className="text-[#E0A458] mr-2">{String(i + 1).padStart(2, "0")}</span>
                {q.question}
              </p>
              {isMulti ? (
                <p className="text-xs text-[#7A7068] mb-3">(elige todas las que apliquen)</p>
              ) : (
                <div className="mb-3" />
              )}
              {q.type === "choice" ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const selected = isSelected(q, opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggle(q, opt.value)}
                        className="px-4 py-2 rounded-full text-sm border transition"
                        style={{
                          background: selected ? "#C4622D" : "#FFFFFF",
                          color: selected ? "#F7F4F0" : "#211C1A",
                          borderColor: selected ? "#C4622D" : "#E5DDD3",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={(answers[q.key] as string) || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                  placeholder={q.placeholder}
                  rows={3}
                  className="w-full rounded-xl bg-white border border-[#E5DDD3] p-3 placeholder:text-[#9E9387]"
                />
              )}
            </div>
            );
          })}

          <div>
            <p style={serif} className="text-xl mb-3">¿Algo más? (opcional)</p>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Cuéntanos lo que quieras — ideas, dudas, lo que sea."
              rows={3}
              className="w-full rounded-xl bg-white border border-[#E5DDD3] p-3 placeholder:text-[#9E9387]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-2 block">Nombre del estudio</label>
              <input
                type="text"
                value={studio}
                onChange={(e) => setStudio(e.target.value)}
                placeholder="Studio X"
                className="w-full h-12 rounded-xl bg-white border border-[#E5DDD3] px-4 placeholder:text-[#9E9387]"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-2 block">WhatsApp</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+34 6XX XXX XXX"
                className="w-full h-12 rounded-xl bg-white border border-[#E5DDD3] px-4 placeholder:text-[#9E9387]"
              />
            </div>
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="w-full h-13 py-3 rounded-full text-base font-medium disabled:opacity-50 mt-4"
            style={{ background: "#C4622D", color: "#F7F4F0" }}
          >
            {submitting ? "Enviando…" : canSubmit ? "Enviar respuestas" : "Contesta todas las preguntas"}
          </button>
        </div>
      </div>
    </div>
  );
}
