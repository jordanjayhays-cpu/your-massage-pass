import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, CalendarCheck, Bookmark, Heart, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { trackAccountCreatedConversion } from "@/lib/adsConversion";
import { useFlowLang, toFlowLang, type FlowLang } from "@/lib/flowLang";

const FUNCTION_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/account-setup";
const SUPPORT_WHATSAPP = "https://wa.me/34613977900";

type Copy = {
  hello: string; // {name} optional
  title: string;
  sub: string;
  benefitsTitle: string;
  benefits: string[];
  email: string;
  password: string;
  confirm: string;
  show: string;
  hide: string;
  submit: string;
  submitting: string;
  errEmail: string;
  errShort: string;
  errMismatch: string;
  errWeak: string;
  inUse: string;
  signIn: string;
  expiredTitle: string;
  expiredBody: string;
  home: string;
  whatsapp: string;
  loading: string;
  genericError: string;
};

const COPY: Record<FlowLang, Copy> = {
  en: {
    hello: "Hi {name},",
    title: "Create your account",
    sub: "One password and your bookings get a lot easier.",
    benefitsTitle: "What you get",
    benefits: [
      "Book faster next time: your details prefilled and one-tap rebooking",
      "All your bookings and confirmations in one place",
      "Preferences remembered: favourite studios, pressure, massage types",
      "First to hear about new studios and member perks",
    ],
    email: "Email",
    password: "Password",
    confirm: "Confirm password",
    show: "Show",
    hide: "Hide",
    submit: "Create my account",
    submitting: "Creating your account...",
    errEmail: "Enter a valid email address",
    errShort: "At least 8 characters",
    errMismatch: "Passwords don't match",
    errWeak: "That password is too weak - try a longer one with a mix of characters",
    inUse: "This email already has an account.",
    signIn: "Sign in instead",
    expiredTitle: "This link has expired",
    expiredBody: "No worries - it happens. Head to the homepage or message us and we'll sort you out.",
    home: "Go to homepage",
    whatsapp: "Message us on WhatsApp",
    loading: "Loading your details...",
    genericError: "Something went wrong. Please try again.",
  },
  es: {
    hello: "Hola {name},",
    title: "Crea tu cuenta",
    sub: "Una contraseña y tus reservas serán mucho más fáciles.",
    benefitsTitle: "Lo que obtienes",
    benefits: [
      "Reserva más rápido la próxima vez: tus datos ya rellenos y repetir en un toque",
      "Todas tus reservas y confirmaciones en un solo lugar",
      "Tus preferencias guardadas: centros favoritos, presión, tipos de masaje",
      "Entérate antes que nadie de nuevos centros y ventajas para miembros",
    ],
    email: "Email",
    password: "Contraseña",
    confirm: "Confirmar contraseña",
    show: "Mostrar",
    hide: "Ocultar",
    submit: "Crear mi cuenta",
    submitting: "Creando tu cuenta...",
    errEmail: "Introduce un email válido",
    errShort: "Mínimo 8 caracteres",
    errMismatch: "Las contraseñas no coinciden",
    errWeak: "Esa contraseña es demasiado débil - prueba una más larga y variada",
    inUse: "Este email ya tiene una cuenta.",
    signIn: "Iniciar sesión",
    expiredTitle: "Este enlace ha caducado",
    expiredBody: "No pasa nada. Ve a la página principal o escríbenos y lo solucionamos.",
    home: "Ir a la página principal",
    whatsapp: "Escríbenos por WhatsApp",
    loading: "Cargando tus datos...",
    genericError: "Algo salió mal. Inténtalo de nuevo.",
  },
  fr: {
    hello: "Bonjour {name},",
    title: "Crée ton compte",
    sub: "Un mot de passe et tes réservations deviennent beaucoup plus simples.",
    benefitsTitle: "Ce que tu y gagnes",
    benefits: [
      "Réserve plus vite la prochaine fois : tes infos préremplies et réservation en un clic",
      "Toutes tes réservations et confirmations au même endroit",
      "Tes préférences enregistrées : studios favoris, pression, types de massage",
      "Sois le premier informé des nouveaux studios et avantages membres",
    ],
    email: "Email",
    password: "Mot de passe",
    confirm: "Confirmer le mot de passe",
    show: "Afficher",
    hide: "Masquer",
    submit: "Créer mon compte",
    submitting: "Création de ton compte...",
    errEmail: "Entre une adresse email valide",
    errShort: "8 caractères minimum",
    errMismatch: "Les mots de passe ne correspondent pas",
    errWeak: "Ce mot de passe est trop faible - essaie un plus long et varié",
    inUse: "Cet email a déjà un compte.",
    signIn: "Se connecter",
    expiredTitle: "Ce lien a expiré",
    expiredBody: "Pas d'inquiétude. Retourne à l'accueil ou écris-nous et on s'en occupe.",
    home: "Aller à l'accueil",
    whatsapp: "Écris-nous sur WhatsApp",
    loading: "Chargement de tes infos...",
    genericError: "Une erreur est survenue. Réessaie.",
  },
  de: {
    hello: "Hallo {name},",
    title: "Erstelle dein Konto",
    sub: "Ein Passwort und deine Buchungen werden viel einfacher.",
    benefitsTitle: "Das bekommst du",
    benefits: [
      "Beim nächsten Mal schneller buchen: deine Daten vorausgefüllt, Nachbuchen mit einem Tipp",
      "Alle Buchungen und Bestätigungen an einem Ort",
      "Präferenzen gespeichert: Lieblingsstudios, Druck, Massagearten",
      "Als Erster von neuen Studios und Mitglieder-Vorteilen erfahren",
    ],
    email: "E-Mail",
    password: "Passwort",
    confirm: "Passwort bestätigen",
    show: "Anzeigen",
    hide: "Verbergen",
    submit: "Konto erstellen",
    submitting: "Dein Konto wird erstellt...",
    errEmail: "Gib eine gültige E-Mail-Adresse ein",
    errShort: "Mindestens 8 Zeichen",
    errMismatch: "Passwörter stimmen nicht überein",
    errWeak: "Dieses Passwort ist zu schwach - versuch ein längeres, gemischtes",
    inUse: "Zu dieser E-Mail gibt es bereits ein Konto.",
    signIn: "Stattdessen anmelden",
    expiredTitle: "Dieser Link ist abgelaufen",
    expiredBody: "Kein Problem. Geh zur Startseite oder schreib uns - wir kümmern uns darum.",
    home: "Zur Startseite",
    whatsapp: "Schreib uns auf WhatsApp",
    loading: "Deine Daten werden geladen...",
    genericError: "Etwas ist schiefgelaufen. Bitte versuch es erneut.",
  },
  it: {
    hello: "Ciao {name},",
    title: "Crea il tuo account",
    sub: "Una password e le tue prenotazioni diventano molto più semplici.",
    benefitsTitle: "Cosa ottieni",
    benefits: [
      "Prenota più velocemente la prossima volta: dati precompilati e riprenotazione con un tocco",
      "Tutte le prenotazioni e conferme in un unico posto",
      "Preferenze salvate: studi preferiti, pressione, tipi di massaggio",
      "Primo a scoprire nuovi studi e vantaggi per i membri",
    ],
    email: "Email",
    password: "Password",
    confirm: "Conferma password",
    show: "Mostra",
    hide: "Nascondi",
    submit: "Crea il mio account",
    submitting: "Creazione dell'account...",
    errEmail: "Inserisci un'email valida",
    errShort: "Minimo 8 caratteri",
    errMismatch: "Le password non coincidono",
    errWeak: "Questa password è troppo debole - provane una più lunga e varia",
    inUse: "Questa email ha già un account.",
    signIn: "Accedi",
    expiredTitle: "Questo link è scaduto",
    expiredBody: "Nessun problema. Vai alla home o scrivici e lo risolviamo.",
    home: "Vai alla home",
    whatsapp: "Scrivici su WhatsApp",
    loading: "Caricamento dei tuoi dati...",
    genericError: "Qualcosa è andato storto. Riprova.",
  },
  pt: {
    hello: "Olá {name},",
    title: "Cria a tua conta",
    sub: "Uma palavra-passe e as tuas reservas ficam muito mais fáceis.",
    benefitsTitle: "O que ganhas",
    benefits: [
      "Reserva mais rápido da próxima vez: dados preenchidos e nova reserva com um toque",
      "Todas as reservas e confirmações num só lugar",
      "Preferências guardadas: estúdios favoritos, pressão, tipos de massagem",
      "Sê o primeiro a saber de novos estúdios e vantagens para membros",
    ],
    email: "Email",
    password: "Palavra-passe",
    confirm: "Confirmar palavra-passe",
    show: "Mostrar",
    hide: "Ocultar",
    submit: "Criar a minha conta",
    submitting: "A criar a tua conta...",
    errEmail: "Introduz um email válido",
    errShort: "Mínimo de 8 caracteres",
    errMismatch: "As palavras-passe não coincidem",
    errWeak: "Essa palavra-passe é demasiado fraca - tenta uma mais longa e variada",
    inUse: "Este email já tem uma conta.",
    signIn: "Iniciar sessão",
    expiredTitle: "Este link expirou",
    expiredBody: "Sem problema. Vai à página inicial ou envia-nos mensagem e resolvemos.",
    home: "Ir para a página inicial",
    whatsapp: "Fala connosco no WhatsApp",
    loading: "A carregar os teus dados...",
    genericError: "Algo correu mal. Tenta novamente.",
  },
  zh: {
    hello: "你好 {name}，",
    title: "创建你的账户",
    sub: "设置一个密码，预约从此更简单。",
    benefitsTitle: "你将获得",
    benefits: [
      "下次预约更快：信息自动填好，一键再次预约",
      "所有预约和确认集中在一处",
      "记住你的偏好：喜爱的按摩店、力度、按摩类型",
      "第一时间了解新入驻按摩店和会员福利",
    ],
    email: "邮箱",
    password: "密码",
    confirm: "确认密码",
    show: "显示",
    hide: "隐藏",
    submit: "创建我的账户",
    submitting: "正在创建账户…",
    errEmail: "请输入有效的邮箱地址",
    errShort: "至少 8 个字符",
    errMismatch: "两次输入的密码不一致",
    errWeak: "密码太简单 - 请使用更长、更复杂的组合",
    inUse: "该邮箱已有账户。",
    signIn: "直接登录",
    expiredTitle: "此链接已过期",
    expiredBody: "没关系。回到首页或通过 WhatsApp 联系我们，我们会帮你解决。",
    home: "前往首页",
    whatsapp: "通过 WhatsApp 联系我们",
    loading: "正在加载你的信息…",
    genericError: "出错了，请重试。",
  },
};

const BENEFIT_ICONS = [CalendarCheck, Bookmark, Heart, Bell];

type Stage = "loading" | "form" | "expired";

export default function AccountSetup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const siteLang = useFlowLang();
  const token = params.get("t") || "";

  const [stage, setStage] = useState<Stage>("loading");
  const [lang, setLang] = useState<FlowLang>(siteLang);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailInUse, setEmailInUse] = useState(false);
  const [weakPw, setWeakPw] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const t = COPY[lang];

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) {
        if (!cancelled) setStage("expired");
        return;
      }
      try {
        const res = await fetch(`${FUNCTION_URL}?t=${encodeURIComponent(token)}`);
        if (!res.ok) {
          if (!cancelled) setStage("expired");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.lang) setLang(toFlowLang(data.lang));
        if (typeof data.name === "string") setName(data.name.trim());
        if (typeof data.email === "string") setEmail(data.email.trim());
        setStage("form");
      } catch {
        if (!cancelled) setStage("expired");
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const pwValid = password.length >= 8;
  const matchValid = confirm === password && confirm.length > 0;
  const formValid = emailValid && pwValid && matchValid;

  const submit = async () => {
    setTouched({ email: true, password: true, confirm: true });
    if (!formValid || submitting) return;
    setSubmitting(true);
    setEmailInUse(false);
    setWeakPw(false);
    setServerError(false);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          try { trackAccountCreatedConversion(); } catch { /* ignore */ }
          navigate("/studios", { replace: true });
          return;
        }
        setServerError(true);
        return;
      }
      if (res.status === 409 || data?.error === "email_in_use") {
        setEmailInUse(true);
      } else if (data?.error === "weak_password") {
        setWeakPw(true);
      } else if (res.status === 404 || data?.error === "invalid_token") {
        setStage("expired");
      } else {
        setServerError(true);
      }
    } catch {
      setServerError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldErr = (msg: string) => (
    <p className="mt-1 text-xs" style={{ color: "#B4432E" }}>{msg}</p>
  );

  return (
    <main className="min-h-screen px-5 py-10 flex items-start justify-center" style={{ background: "#FAF6F1" }}>
      <div className="w-full max-w-md">
        {stage === "loading" && (
          <div className="rounded-3xl bg-white border p-8 text-center" style={{ borderColor: "#E6DCCF" }}>
            <Loader2 size={26} className="mx-auto animate-spin" style={{ color: "#B85C38" }} />
            <p className="mt-3 text-sm" style={{ color: "#7A7068" }}>{t.loading}</p>
          </div>
        )}

        {stage === "expired" && (
          <div className="rounded-3xl bg-white border p-8 text-center" style={{ borderColor: "#E6DCCF" }}>
            <h1 className="text-xl font-semibold" style={{ color: "#2b2b2b" }}>{t.expiredTitle}</h1>
            <p className="mt-2 text-sm" style={{ color: "#7A7068" }}>{t.expiredBody}</p>
            <Link
              to="/"
              className="mt-5 inline-flex items-center justify-center w-full h-12 rounded-2xl font-semibold"
              style={{ background: "#B85C38", color: "#fff" }}
            >
              {t.home}
            </Link>
            <a
              href={SUPPORT_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center w-full h-12 rounded-2xl font-semibold border"
              style={{ borderColor: "#E6DCCF", color: "#B85C38" }}
            >
              {t.whatsapp}
            </a>
          </div>
        )}

        {stage === "form" && (
          <div className="rounded-3xl bg-white border p-6 sm:p-8" style={{ borderColor: "#E6DCCF" }}>
            {name ? (
              <p className="text-sm font-medium" style={{ color: "#B85C38" }}>
                {t.hello.replace("{name}", name)}
              </p>
            ) : null}
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: "#2b2b2b" }}>{t.title}</h1>
            <p className="mt-1 text-sm" style={{ color: "#7A7068" }}>{t.sub}</p>

            <div className="mt-5 rounded-2xl p-4" style={{ background: "#FAF6F1" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#7A7068" }}>
                {t.benefitsTitle}
              </p>
              <ul className="mt-2 space-y-2">
                {t.benefits.map((b, i) => {
                  const Icon = BENEFIT_ICONS[i] ?? Heart;
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#2b2b2b" }}>
                      <Icon size={16} className="mt-0.5 shrink-0" style={{ color: "#B85C38" }} />
                      <span>{b}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium" style={{ color: "#2b2b2b" }}>{t.email}</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailInUse(false); }}
                  onBlur={() => setTouched((s) => ({ ...s, email: true }))}
                  className="mt-1 w-full h-12 rounded-2xl border px-4 text-sm outline-none"
                  style={{ borderColor: "#E6DCCF", background: "#fff", color: "#2b2b2b" }}
                />
                {touched.email && !emailValid && fieldErr(t.errEmail)}
                {emailInUse && (
                  <p className="mt-1 text-xs" style={{ color: "#B4432E" }}>
                    {t.inUse}{" "}
                    <Link to="/login" className="font-semibold underline" style={{ color: "#B85C38" }}>
                      {t.signIn}
                    </Link>
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: "#2b2b2b" }}>{t.password}</label>
                <div className="relative mt-1">
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setWeakPw(false); }}
                    onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                    className="w-full h-12 rounded-2xl border px-4 pr-12 text-sm outline-none"
                    style={{ borderColor: "#E6DCCF", background: "#fff", color: "#2b2b2b" }}
                  />
                  <button
                    type="button"
                    aria-label={showPw ? t.hide : t.show}
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "#7A7068" }}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {touched.password && !pwValid && fieldErr(t.errShort)}
                {weakPw && fieldErr(t.errWeak)}
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: "#2b2b2b" }}>{t.confirm}</label>
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onBlur={() => setTouched((s) => ({ ...s, confirm: true }))}
                  className="mt-1 w-full h-12 rounded-2xl border px-4 text-sm outline-none"
                  style={{ borderColor: "#E6DCCF", background: "#fff", color: "#2b2b2b" }}
                />
                {touched.confirm && !matchValid && fieldErr(t.errMismatch)}
              </div>

              {serverError && <p className="text-xs" style={{ color: "#B4432E" }}>{t.genericError}</p>}

              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="w-full h-12 rounded-2xl font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "#B85C38", color: "#fff" }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? t.submitting : t.submit}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
