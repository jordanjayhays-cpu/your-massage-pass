// wa-bot-copy: copy strings, service tables and lexicon for wa-bot. No secrets.
// Generated from wa-bot-v39.ts by split_bot.py; edit the source, not this file.
export const JORDAN_MAIN_NUMBER = "+34 612 474 827";
export const AD_OPENER_RE = /^hi,? i'?d like to book a massage\.? i saw you on (facebook|instagram)\.?$/i;
// v39: people write whole sentences ("Tailandés en Centro, lunes noche"). Read them.
export const UNSURE_RE = /(no s[eé] (qu[eé]|cu[aá]l)|not sure|don'?t know|no tengo claro|cualquiera me vale|recomi[eé]nda|recommend|ay[uú]dame a elegir|help me (choose|pick|figure))/i;
export const ZONEQ_RE = /(d[oó]nde est[aá]is|en qu[eé] zona est[aá]is|d[oó]nde (est[aá]n|se encuentran)|where are you (located|based)|which area are you|your address|vuestra direcci[oó]n|qu[eé] zonas)/i;
export function detectDay(t: string, L: string): string {
  const s = stripAcc(t);
  if (/\b(hoy|today|tonight|esta noche|esta tarde)\b/.test(s)) return L === "es" ? "Hoy" : "Today";
  if (/\b(manana|tomorrow)\b/.test(s) && !/\bpor la manana\b|\bde la manana\b|\bin the morning\b/.test(s)) return L === "es" ? "Mañana" : "Tomorrow";
  const days: Array<[RegExp, string, string]> = [
    [/\b(lunes|monday)\b/, "Lunes", "Monday"], [/\b(martes|tuesday)\b/, "Martes", "Tuesday"], [/\b(miercoles|wednesday)\b/, "Miércoles", "Wednesday"],
    [/\b(jueves|thursday)\b/, "Jueves", "Thursday"], [/\b(viernes|friday)\b/, "Viernes", "Friday"], [/\b(sabado|saturday)\b/, "Sábado", "Saturday"], [/\b(domingo|sunday)\b/, "Domingo", "Sunday"],
  ];
  for (const [re, es, en] of days) if (re.test(s)) return L === "es" ? es : en;
  const m = s.match(/\b(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|ene|feb|mar|abr|jun|jul|ago|sep|sept|oct|nov|dic|jan|apr|aug|dec)\b/);
  if (m) return `${m[1]} ${m[2]}`;
  return "";
}
export function detectTime(t: string, L: string): string {
  const s = stripAcc(t);
  const hm = s.match(/\b(?:a las?\s*)?([01]?\d|2[0-3])[:.h]([0-5]\d)\b/) || s.match(/\ba las?\s*([01]?\d|2[0-3])\b(?![:.\d])/) || s.match(/\b([01]?\d|2[0-3])\s*(pm|am|h)\b/);
  if (hm) { let h = parseInt(hm[1], 10); const mm = /^\d{2}$/.test(hm[2] || "") ? hm[2] : "00"; if (/pm/.test(hm[2] || "") && h < 12) h += 12; return `${String(h).padStart(2, "0")}:${mm}`; }
  if (/\b(noche|evening|tarde-noche|after work|por la tarde noche)\b/.test(s)) return L === "es" ? HOURS.time_evening.labelEs : HOURS.time_evening.label;
  if (/\b(tarde|afternoon|mediodia|midday|lunch)\b/.test(s)) return L === "es" ? HOURS.time_afternoon.labelEs : HOURS.time_afternoon.label;
  if (/\b(por la manana|de la manana|morning|temprano|early)\b/.test(s)) return L === "es" ? HOURS.time_morning.labelEs : HOURS.time_morning.label;
  return "";
}
export function strongSpanish(t: string): boolean {
  const s = String(t).toLowerCase();
  if (AD_OPENER_RE.test(s.trim())) return false; // the ad's canned line, not the person's words
  const words = ["hola", "buenas", "quiero", "masaje", "reservar", "cuanto", "cuánto", "precio", "gracias", "por", "favor", "mañana", "hoy", "para", "una", "cita", "hora", "tarde", "noche", "zona", "donde", "dónde"];
  const strong = ["hola", "buenas", "quiero", "masaje", "masajes", "reservar", "precio", "gracias", "español", "espanol", "castellano", "cuánto", "cuanto", "mañana", "hoy", "quisiera", "necesito", "busco", "ofrecen", "tenéis", "teneis", "hacéis", "haceis"];
  const toks = s.split(/[^a-záéíóúñü]+/).filter(Boolean);
  const found = new Set<string>();
  for (const w of toks) if (words.includes(w)) found.add(w);
  if (found.size >= 3) return true;
  // v39: a short message with one unmistakably Spanish word is Spanish ("Hola", "Buenos días", "¿Qué tipo de masaje ofrecen?")
  if (toks.length <= 7 && toks.some((w) => strong.includes(w))) return true;
  return /[¿¡]/.test(s);
}
export const isEmail = (t: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.trim());
export const stripAcc = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const TIME_RE = /^\d{1,2}([:.h]\d{2})?\s*(am|pm)?$/i;
export const BACK_RE = /^(back|atras|atrás|volver)$/i;
export const HI_RE = /^(hi|hello|hey|hola|start|reset|empezar)$/i;
export const BOOKAGAIN_RE = /\b(book again|another massage|otra vez|otro masaje|quiero reservar)\b/i;
export const digitsOf = (s: string) => String(s || "").replace(/[^0-9]/g, "");
export const CHANGE_RE = /\b(tomorrow|ma[nñ]ana|another (day|time)|otro d[ií]a|otra hora|change|cambiar|cambio|reschedule|postpone|move it|m[aá]s tarde|can'?t make it|cannot make it|no puedo|no voy a poder|not today|hoy no)\b/i;
// "hasta mañana", "see you tomorrow", "thanks" are goodbyes, not changes.
export const GOODBYE_RE = /(hasta (ma[nñ]ana|luego|pronto|ahora)|see you|nos vemos|thank|gracias|perfect|great|genial)/i;
export const CANCEL_RE = /\b(cancel|cancelar|cancela|anular|forget it|no longer|ya no)\b/i;
export const ARRIVED_RE = /(ha llegado|ya est[aá] aqu[ií]|ya ha venido|ya vino|en cabina|ya est[aá] con nosotros|acaba de llegar)/i;
export const NOSHOW_RE = /(no ha llegado|no ha venido|no vino|no aparece|no se ha presentado|no puedas venir|no vais a venir|plant[oó]n|sin venir)/i;
// v36: studio offers. A studio answering with a time ("a las 12:15", "12:15",
// "16.30") is an offer for the customer, not a note for Jordan.
export const mcMadridHour = (): number => parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date()), 10);
export function parseOfferedTime(t: string): string {
  const s = String(t || "");
  if (/\bde\s+\d{1,2}[:.h]?\d{0,2}\s+a\s+\d{1,2}[:.h]?\d{0,2}/i.test(s)) return ""; // opening hours range, not an offer
  let m = s.match(/\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  m = s.match(/\ba\s+las?\s+([01]?\d|2[0-3])(?![:.\d])/i) || s.match(/\b([01]?\d|2[0-3])\s*h\b/i);
  if (m) return `${m[1].padStart(2, "0")}:00`;
  return "";
}
export const AUTOREPLY_RE = /gracias por (contactar|comunicarte|comunicarse|escribir|tu mensaje)|te responderemos|responderemos lo antes|te atenderemos|nos pondremos en contacto|contestar lo antes|hemos recibido tu mensaje|ahora no podemos responder|en este momento estamos ocupados|get back to you|currently busy|horario de atenci[o\u00f3]n|thank you for contacting|thanks for your message/i;
export const EMAIL_IN_TEXT_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// "Special massage" probes - one standard line, then permanent silence.
export const EROTIC_RE = /\b(er[oó]tic\w*|sensual\w*|sensitiv[oa]s?\b|t[aá]ntr\w*|nuru|happy\s*end\w*|final\s*feliz|con\s*extras?|servicio\s*completo|body\s*(2|to)\s*body|lingam|yoni|prostat\w*)\b/i;
// Asking about clothing is often a genuine modesty question, so it gets a
// straight answer about how professional studios work rather than a block. If
// the next message crosses the line, EROTIC_RE catches it.
export const MODESTY_RE = /\b(desnud\w*|sin\s*ropa|naked|nude|undress\w*|ropa\s*interior)\b/i;
export const BLOCK_LINE_EN = "We only arrange professional therapeutic massages at licensed studios. We do not offer anything else, so we cannot help with this request.";
export const BLOCK_LINE_ES = "Solo gestionamos masajes profesionales y terapéuticos en centros con licencia. No ofrecemos nada más, así que no podemos ayudarte con esta petición.";
// People asking for a job, not a massage (the ads reach therapists too).
export const JOB_RE = /(\b(hiring|apply|applying|job|vacancy|vacancies|cv|resume|curriculum)\b|massage therapist\b.*\b(available|looking)|\b(soy|busco)\s+(masajista|trabajo|empleo)|\bcontrat(ais|an|amos)\b|\bcurriculum\b)/i;
// "Any of them" / "you choose" typed instead of tapped.
export const ANY_RE = /^(any|anyone|any of them|anywhere|whichever|whatever|you (choose|pick|decide)|the best|best one|cualquiera|el que sea|elige tu|elegid|lo que sea|me da igual)\b/i;
// "I want a different type of massage" at the studio step.
export const OTHERTYPE_RE = /(different|another|other|specific|change).{0,20}(massage|type|kind|service)|(otro|distinto|diferente|especifico|específico).{0,20}(masaje|tipo)/i;
// A question asked in the middle of the flow must be answered, not stored as
// an answer. MRB asked "How much for 90 minutes?" at the area step and the bot
// filed it as his neighbourhood.
export const PRICEQ_RE = /(how much|price|cost|charges|rates?|cu[aá]nto|precio|cuesta|tarifa)/i;
export const QUESTION_RE = /(how much|how many|how long|price|cost|charges|what (is|are|do)|do you|can i|is it|cu[aá]nto|precio|cuesta|tarifa|qu[eé] incluye|puedo|se puede)/i;
export const looksLikeQuestion = (t: string): boolean => {
  const q = String(t || "").trim();
  if (!q) return false;
  if (QUESTION_RE.test(q)) return true;
  return q.includes("?") && q.split(/\s+/).length >= 3;
};
// "How does this work?" in its many forms - deserves an answer, not a menu.
export const HOWWORKS_RE = /(how (does (this|it) work|this works?|do (you|i))|how it works|what is this|what do you do|who are you|is this real|qu[eé] es esto|c[oó]mo funciona|qui[eé]nes sois|qu[eé] hac[eé]is|es real)/i;

export const MAIN_SERVICES = [
  { id: "svc_relax", en: "Relaxing massage", tEn: "Relaxing", tEs: "Relajante" },
  { id: "svc_deep", en: "Deep tissue massage", tEn: "Deep tissue", tEs: "Descontracturante" },
  { id: "svc_thai", en: "Thai massage", tEn: "Thai", tEs: "Tailandés" },
  { id: "svc_sports", en: "Sports massage", tEn: "Sports", tEs: "Deportivo" },
  { id: "svc_stone", en: "Hot stone massage", tEn: "Hot stone", tEs: "Piedras calientes" },
  { id: "svc_unsure", en: "Not sure", tEn: "Help me figure it out", tEs: "Ayúdame a elegir" },
];
export const MORE_SERVICES = [
  { id: "svc_bali", en: "Balinese massage", tEn: "Balinese", tEs: "Balinés" },
  { id: "svc_shiatsu", en: "Shiatsu", tEn: "Shiatsu", tEs: "Shiatsu" },
  { id: "svc_reflex", en: "Reflexology", tEn: "Reflexology", tEs: "Reflexología" },
  { id: "svc_lymph", en: "Lymphatic drainage", tEn: "Lymphatic drainage", tEs: "Drenaje linfático" },
  { id: "svc_couples", en: "Couples massage", tEn: "Couples", tEs: "En pareja" },
  { id: "svc_kobido", en: "Kobido facial massage", tEn: "Kobido facial", tEs: "Kobido facial" },
];
export const ALL_SERVICES = [...MAIN_SERVICES, ...MORE_SERVICES];

// DB service names are English; translate them when shown inside a Spanish chat.
export const SVC_ES: Array<[RegExp, string]> = [
  [/deep tissue|descontracturante/i, "Masaje descontracturante"],
  [/thai|tailand/i, "Masaje tailandés"],
  [/hot stone|piedras/i, "Masaje de piedras calientes"],
  [/sport|deportivo/i, "Masaje deportivo"],
  [/balin/i, "Masaje balinés"],
  [/shiatsu/i, "Shiatsu"],
  [/reflexolog/i, "Reflexología"],
  [/lymphatic|drenaje|linfatic/i, "Drenaje linfático"],
  [/couples|pareja/i, "Masaje en pareja"],
  [/kobido/i, "Masaje facial Kobido"],
  [/relax|swedish|sueco/i, "Masaje relajante"],
  [/stress|antiestr/i, "Masaje antiestrés"],
  [/massage|masaje/i, "Masaje"],
];
export const trSvc = (name: string, L: string): string => {
  const n = String(name || "");
  if (L !== "es" || !n) return n;
  for (const [re, es] of SVC_ES) if (re.test(n)) return es;
  return n;
};
// Mid-sentence variant: "tu masaje tailandés", not "tu Masaje tailandés".
export const trSvcLow = (name: string, L: string): string => L === "es" ? trSvc(name, L).toLowerCase() : String(name || "");
export const AREAS = ["Centro", "Chamberí", "Salamanca", "Retiro", "La Latina", "Malasaña", "Chamartín"];
// Tappable areas: typing a neighbourhood was where most people went quiet.
export const AREA_ROWS = [
  { id: "area_centro", area: "Centro", en: "Centro / Sol", es: "Centro / Sol" },
  { id: "area_chamberi", area: "Chamberí", en: "Chamberí", es: "Chamberí" },
  { id: "area_salamanca", area: "Salamanca", en: "Salamanca", es: "Salamanca" },
  { id: "area_retiro", area: "Retiro", en: "Retiro", es: "Retiro" },
  { id: "area_chamartin", area: "Chamartín", en: "Chamartín", es: "Chamartín" },
  { id: "area_malasana", area: "Malasaña", en: "Malasaña / Chueca", es: "Malasaña / Chueca" },
];

export const HOURS: Record<string, { hours: string[]; label: string; labelEs: string }> = {
  time_morning: { hours: ["10:00", "11:00", "12:00"], label: "Morning (10-13)", labelEs: "Mañana (10-13)" },
  time_afternoon: { hours: ["13:00", "14:00", "15:00", "16:00", "17:00"], label: "Afternoon (13-18)", labelEs: "Tarde (13-18)" },
  time_evening: { hours: ["18:00", "19:00", "20:00"], label: "Evening (18-21)", labelEs: "Noche (18-21)" },
};
export const COPY: Record<string, any> = {
  en: {
    intro: "Massage Club here. We book massages at Madrid's best studios and you pay the studio directly, no fee from us.\n\nWhich massage would you like?",
    introBtn: "Choose massage",
    moreTitle: "More massages:",
    moreRow: { title: "More massages", desc: "Balinese, shiatsu, reflexology..." },
    backRow: { title: "Back", desc: "main massage list" },
    day: "Good choice. Which day suits you?",
    dayUnsure: "No problem, that's what we're here for. We'll match you with the right massage and studio. Which day suits you?",
    dayBtns: [{ id: "day_today", title: "Today" }, { id: "day_tomorrow", title: "Tomorrow" }, { id: "day_other", title: "Another day" }],
    dayAsk: "Which day? Just type it, for example Saturday or 3 September.",
    time: "What time of day works best?",
    timeBtn: "Pick a window",
    timeCustomRow: { title: "Custom time", desc: "type your exact time" },
    timeAsk: "What time? Type it, for example 16:30 or 9pm.",
    hour: "And what exact time? The studio confirms faster with a precise time.",
    hourBtn: "Pick a time",
    hourFlex: "Flexible",
    hourFlexDesc: "any time in this window",
    area: "Last question: which part of Madrid suits you? Tap one, or type any other area.",
    areaBtn: "Choose area",
    areaAnyTitle: "Anywhere in Madrid",
    areaAnyDesc: "we pick the best studio for you",
    areaOtherTitle: "Another area",
    areaOtherDesc: "type it or share your location",
    areaShare: "Type your area, for example Arganzuela or Tetuán, or share your location.",
    gotItSvc: (svc: string) => `Got it, ${svc}. 👌`,
    jobSeeker: "Thanks for writing! We do not hire directly, but we work with Madrid's best studios and sometimes they look for good therapists. Send your name, experience and the neighbourhoods you cover, and we will keep you in mind. 🙏",
    otherTypeAck: "Of course, let us change the massage. Your day, time and area are saved.",
    areaAgain: "Type your area, for example Chamberí, Sol or Retiro. Or tap share location.",
    modesty: "Good question. Our studios are professional therapeutic studios: you are covered with a towel the whole time and underwear stays on. The therapist only uncovers the area being worked on. If that works for you, let us carry on with your booking.",
    studios: "Best matches near you, with real prices. Pick one and we ask them to confirm your time.\n\nType *back* anytime to change an earlier answer.",
    topPick: (name: string, svcN: string, dur: number, price: number, area: string) =>
      `Best match for you:\n\n*${name}*\n${svcN} · ${dur} min · ${price} EUR\n${area}\n\nShall we ask them to confirm your time?`,
    topPickBtns: [{ id: "pick_yes", title: "Yes, book it" }, { id: "pick_more", title: "See other options" }],
    bookedLink: (name: string, url: string) => `${name}: ${url}`,
    studiosBtn: "Choose studio",
    studioLinks: "Want a closer look first? Photos, full menus and reviews:",
    anyStudio: "Any of them",
    anyStudioDesc: "we pick the best fit",
    otherStudio: "A different studio",
    otherStudioDesc: "type the studio's name",
    otherStudioAsk: "Which studio? Type its name and we will ask them for your time.",
    name: "Almost done: what is your name?",
    email: "And your email? You get your confirmation there and it creates your Massage Club account.",
    emailBad: "That does not look like an email. Try again.",
    emailAskPost: "One more thing: want this confirmation by email, plus your bookings saved so next time takes one tap? Reply with your email and your free account is ready.",
    emailSaved: "Done! Check your inbox: your confirmation and account link are on their way. 📫",
    rebookLater: "No problem, we'll be here when you need us. 🙌",
    howItWorks: "Happy to explain! It is simple:\n\n1. Tell us what massage you would like and when\n2. We confirm the time and price with one of Madrid's best studios for you, everything in English\n3. You just show up and pay the studio directly. No fee from us, and your time is only booked once the studio confirms.\n\nAll our studios with photos and prices: book.massageclub.io - but you're very welcome to keep everything right here in the chat, we handle it for you.",
    human: `No problem. A Massage Club representative will message you personally in a few minutes from our main number ${JORDAN_MAIN_NUMBER}. You can also just reply here, we see everything.`,
    menuTitle: "What would you like to do?",
    menuBtn: "Open menu",
    menuRows: [
      { id: "menu_status", title: "My booking", description: "check where your booking is" },
      { id: "menu_book", title: "Book a massage", description: "start a new booking" },
      { id: "lang_es", title: "Español", description: "cambiar a español" },
    ],
    noBooking: "No bookings yet under this number. Want to make one? Type *book*.",
    welcomeBack: (n: string, svcN: string, studio: string) =>
      `Welcome back${n ? " " + n : ""}! Massage Club here.\n\nLast time you booked ${svcN}${studio ? " at " + studio : ""}. Same again, or something new?`,
    welcomeBackBtns: [{ id: "rebook_same", title: "Same again" }, { id: "menu_book", title: "New booking" }, { id: "menu_status", title: "My booking" }],
    welcomeBackPlain: (n: string) => `Welcome back${n ? " " + n : ""}! Massage Club here. What would you like to do?`,
    welcomeBackPlainBtns: [{ id: "menu_book", title: "Book a massage" }, { id: "menu_status", title: "My booking" }],
    stages: { new: "Received. We are checking with the studio now.", studio_asked: "Sent to the studio. Waiting for them to confirm your time.", studio_replied: "The studio replied. We are finalising your time.", offered: "We sent you options. Reply with your choice.", confirmed: "Confirmed! Check the details in this chat or your email.", dismissed: "Closed.", cancelled: "Cancelled.", no_show: "Missed. Write here whenever you want to rebook." },
    statusLine: (svcN: string, when: string, studio: string, stage: string) => `${svcN}${when ? " · " + when : ""}${studio ? "\nStudio: " + studio : ""}\nStatus: ${stage}`,
    confirm: (n: string, sN: string, w: string, st: string, id: number | null) =>
      `Thanks ${n}, got it.\n\n${sN}\n${w}\n${st}\n\n⏳ *Your time is not booked yet.* Every studio confirms availability with us first. We are asking them right now and will message you here the moment they say yes - during opening hours that is usually quick. If they cannot fit you, we bring you alternatives.\n\nYou pay the studio directly. No fee from us.\n\nType *menu* anytime to check your booking.\nYour bookings and all our studios: book.massageclub.io` + (id ? `\nRef #${id}` : ""),
    studioConfirmed: (n: string, studio: string, svcN: string, when: string) =>
      `Good news ${n}! *${studio}* confirmed your ${svcN} for *${when}*.\n\nYou pay the studio directly. Enjoy!\n\nMassage Club · book.massageclub.io`,
    priceInfo: "Good question. At our studios 60 minutes is usually between 40 and 85 EUR, and 90 minutes between 60 and 100 EUR, depending on the studio and the type of massage. We always send you the exact price before you confirm, and you pay the studio directly. No fee from us.",
    ackReply: "🙌 We'll update you here as soon as the studio replies.",
    cardIntro: (url: string) => `Massage Club here. Book in three taps, no login, and watch the studios reply live:\n${url}\n\nOr just tell me what you would like and I will handle it right here.`,
    confirmLater: (n: string, sN: string, w: string, st: string, id: number | null) =>
      `Thanks ${n}, got it.\n\n${sN}\n${w}\n${st}\n\n⏳ *Your time is not booked yet.* Studios are closed right now, so we will ask them the moment they open at 09:00 and message you here as soon as one says yes. If they cannot fit you, we bring you alternatives.\n\nYou pay the studio directly. No fee from us.\n\nType *menu* anytime to check your booking.\nYour bookings and all our studios: book.massageclub.io` + (id ? `\nRef #${id}` : ""),
    offer: (n: string, studio: string, where: string, svcN: string, time: string, day: string, asked: string) =>
      `Update on your ${svcN}${n ? ", " + n : ""}: *${studio}*${where ? " (" + where + ")" : ""} can take you at *${time}* ${day}${asked ? " instead of " + asked : ""}. Does that work?`,
    offerYes: (t: string) => `Yes, book ${t}`,
    offerNo: "Another time",
    offerAccepted: (studio: string, when: string, addr: string, phone: string) =>
      `Booked! *${studio}* confirmed your massage for *${when}*.${addr ? "\nAddress: " + addr : ""}${phone ? "\nStudio phone: " + phone : ""}\n\nYou pay the studio directly. Enjoy!\n\nMassage Club · book.massageclub.io`,
    offerDeclined: "No problem, we keep asking the other studios and will message you with the next option.",
    offerGone: "That slot has just been taken, sorry. We are still on it and will message you with the next option.",
    offerRemind: (studio: string, time: string) => `Just so we do not lose it: *${studio}* can do *${time}*. Tap Yes to book it, or Another time and we keep looking.`,
    sameDay: "Quick heads-up: most Madrid studios open at 11:00 or 12:00, so the earliest they can usually confirm today is around 12:00. What would you prefer?",
    sameDayBtns: (t: string) => [{ id: "sd_earliest", title: "Earliest today" }, { id: "sd_tomorrow", title: "Tomorrow morning" }, { id: "sd_keep", title: `Keep ${t}`.slice(0, 20) }],
    earliestToday: "Earliest available (from 12:00)",
    timeChange: (studio: string, time: string, day: string, old: string) =>
      `Change from the studio: *${studio}* now says *${time}* ${day}${old ? " instead of " + old : ""}. Does that still work?`,
    timeChangeDeclined: (old: string) => `Understood. We have asked the studio to keep your original time${old ? " (" + old + ")" : ""} and will confirm here. If they cannot, we find you another option.`,
    reconfirmYes: (studio: string, time: string, addr: string) => `Great, see you at *${time}*${studio ? " at " + studio : ""}.${addr ? "\n" + addr : ""}\nWe have told the studio you are coming.`,
    changeAsk: (studio: string, time: string) => `Understood, we will not hold you to ${time}${studio ? " at " + studio : ""}. What day and time would work instead? Type it here and we check with the studio right away.`,
    changeNoted: (studio: string) => `Got it. We are checking that with ${studio || "the studio"} now and will confirm here. Nothing is booked until you say yes.`,
    cancelled: (studio: string) => `Cancelled, no problem. We have let ${studio || "the studio"} know. Whenever you want another one, just write here.`,
    missedYou: (studio: string) => `We are sorry we missed you today at ${studio || "the studio"}. If something came up, just reply here and we will find you another time.`,
    studioReaching: (studio: string, time: string, text: string) => `${studio} is trying to reach you about your ${time} appointment${text ? ': "' + text.slice(0, 120) + '"' : ""}. Are you on your way? Reply here and we will let them know.`,
    reconfirmRemind: (studio: string, time: string) => `Quick one: are you still coming to ${studio} at ${time}? Reply *yes*, or tell us what to change.`,
    noHuman: "I can sort this out right here. Tell me the massage you would like, the day, and the part of Madrid, in one message if you like. 60 minutes is 40 to 85 EUR depending on the studio, paid directly there, no fee from us.",
    zoneAnswer: "We are not a single studio. We book you into professional studios all over Madrid (Centro, Salamanca, Chamberí, Retiro, Chamartín, Malasaña and more) and you pick the area that suits you.",
  },
  es: {
    intro: "Somos Massage Club. Reservamos masajes en los mejores centros de Madrid y pagas directamente en el centro, sin comisión.\n\n¿Qué masaje quieres?",
    introBtn: "Elegir masaje",
    moreTitle: "Más masajes:",
    moreRow: { title: "Más masajes", desc: "balinés, shiatsu, reflexología..." },
    backRow: { title: "Volver", desc: "lista principal" },
    day: "Buena elección. ¿Qué día te viene bien?",
    dayUnsure: "Sin problema, para eso estamos. Te buscamos el masaje y el centro perfectos. ¿Qué día te viene bien?",
    dayBtns: [{ id: "day_today", title: "Hoy" }, { id: "day_tomorrow", title: "Mañana" }, { id: "day_other", title: "Otro día" }],
    dayAsk: "¿Qué día? Escríbelo, por ejemplo sábado o 3 de septiembre.",
    time: "¿Qué franja te va mejor?",
    timeBtn: "Elegir franja",
    timeCustomRow: { title: "Otra hora", desc: "escribe tu hora exacta" },
    timeAsk: "¿A qué hora? Escríbela, por ejemplo 16:30 o 21:00.",
    hour: "¿Y a qué hora exacta? El centro confirma antes con una hora concreta.",
    hourBtn: "Elegir hora",
    hourFlex: "Flexible",
    hourFlexDesc: "cualquier hora de esta franja",
    area: "Última pregunta: ¿qué zona de Madrid te viene bien? Toca una, o escribe otra zona.",
    areaBtn: "Elegir zona",
    areaAnyTitle: "Cualquier zona",
    areaAnyDesc: "elegimos el mejor centro para ti",
    areaOtherTitle: "Otra zona",
    areaOtherDesc: "escríbela o comparte tu ubicación",
    areaShare: "Escribe tu zona, por ejemplo Arganzuela o Tetuán, o comparte tu ubicación.",
    gotItSvc: (svc: string) => `Perfecto, ${svc}. 👌`,
    jobSeeker: "¡Gracias por escribir! No contratamos directamente, pero trabajamos con los mejores centros de Madrid y a veces buscan buenos masajistas. Envíanos tu nombre, experiencia y las zonas que cubres, y te tendremos en cuenta. 🙏",
    otherTypeAck: "Claro, cambiamos el masaje. Tu día, hora y zona quedan guardados.",
    areaAgain: "Escribe tu zona, por ejemplo Chamberí, Sol o Retiro. O toca compartir ubicación.",
    modesty: "Buena pregunta. Nuestros centros son profesionales y terapéuticos: te cubren con una toalla durante toda la sesión y la ropa interior se mantiene puesta. El terapeuta solo descubre la zona que está trabajando. Si te parece bien, seguimos con tu reserva.",
    studios: "Las mejores opciones cerca de ti, con precios reales. Elige una y pedimos al centro que confirme tu hora.\n\nEscribe *volver* cuando quieras para cambiar una respuesta anterior.",
    topPick: (name: string, svcN: string, dur: number, price: number, area: string) =>
      `Tu mejor opción:\n\n*${name}*\n${svcN} · ${dur} min · ${price} EUR\n${area}\n\n¿Les pedimos que confirmen tu hora?`,
    topPickBtns: [{ id: "pick_yes", title: "Sí, resérvalo" }, { id: "pick_more", title: "Ver otras opciones" }],
    bookedLink: (name: string, url: string) => `${name}: ${url}`,
    studiosBtn: "Elegir centro",
    studioLinks: "¿Quieres verlos antes? Fotos, menús completos y opiniones:",
    anyStudio: "Cualquiera",
    anyStudioDesc: "elegimos el mejor para ti",
    otherStudio: "Otro centro",
    otherStudioDesc: "escribe el nombre del centro",
    otherStudioAsk: "¿Qué centro? Escribe su nombre y les pedimos tu hora.",
    name: "Casi listo: ¿cómo te llamas?",
    email: "¿Y tu email? Ahí te llega la confirmación y crea tu cuenta de Massage Club.",
    emailBad: "Eso no parece un email. Prueba otra vez.",
    emailAskPost: "Una cosa más: ¿quieres la confirmación por email y tus reservas guardadas para repetir en un toque? Responde con tu email y tu cuenta gratis queda lista.",
    emailSaved: "¡Listo! Mira tu correo: te llegan la confirmación y el enlace de tu cuenta. 📫",
    rebookLater: "Sin problema, aquí estaremos cuando te apetezca. 🙌",
    howItWorks: "¡Te lo explicamos! Es muy fácil:\n\n1. Dinos qué masaje quieres y cuándo\n2. Confirmamos hora y precio con uno de los mejores centros de Madrid por ti\n3. Solo tienes que ir y pagar directamente en el centro. Sin comisión, y tu hora queda reservada cuando el centro confirma.\n\nTodos nuestros centros con fotos y precios: book.massageclub.io - aunque puedes seguirlo todo por aquí mismo, nosotros nos encargamos.",
    human: `Sin problema. Un representante de Massage Club te escribe personalmente en unos minutos desde nuestro número principal ${JORDAN_MAIN_NUMBER}. También puedes responder aquí, lo vemos todo.`,
    menuTitle: "¿Qué quieres hacer?",
    menuBtn: "Abrir menú",
    menuRows: [
      { id: "menu_status", title: "Mi reserva", description: "ver el estado de tu reserva" },
      { id: "menu_book", title: "Reservar masaje", description: "empezar una reserva nueva" },
      { id: "lang_en", title: "English", description: "switch to English" },
    ],
    noBooking: "No hay reservas con este número todavía. ¿Quieres hacer una? Escribe *reservar*.",
    welcomeBack: (n: string, svcN: string, studio: string) =>
      `¡Hola de nuevo${n ? " " + n : ""}! Somos Massage Club.\n\nLa última vez reservaste ${svcN}${studio ? " en " + studio : ""}. ¿Repetimos, o algo nuevo?`,
    welcomeBackBtns: [{ id: "rebook_same", title: "Repetir" }, { id: "menu_book", title: "Nueva reserva" }, { id: "menu_status", title: "Mi reserva" }],
    welcomeBackPlain: (n: string) => `¡Hola de nuevo${n ? " " + n : ""}! Somos Massage Club. ¿Qué quieres hacer?`,
    welcomeBackPlainBtns: [{ id: "menu_book", title: "Reservar masaje" }, { id: "menu_status", title: "Mi reserva" }],
    stages: { new: "Recibida. Estamos consultando con el centro.", studio_asked: "Enviada al centro. Esperando que confirmen tu hora.", studio_replied: "El centro ha respondido. Estamos cerrando tu hora.", offered: "Te enviamos opciones. Responde con tu elección.", confirmed: "¡Confirmada! Mira los detalles en este chat o tu email.", dismissed: "Cerrada.", cancelled: "Cancelada.", no_show: "No asististe. Escríbenos cuando quieras otra hora." },
    statusLine: (svcN: string, when: string, studio: string, stage: string) => `${svcN}${when ? " · " + when : ""}${studio ? "\nCentro: " + studio : ""}\nEstado: ${stage}`,
    confirm: (n: string, sN: string, w: string, st: string, id: number | null) =>
      `Gracias ${n}, apuntado.\n\n${sN}\n${w}\n${st}\n\n⏳ *Tu hora aún no está reservada.* Cada centro nos confirma primero su disponibilidad. Se lo estamos pidiendo ahora mismo y te escribimos aquí en cuanto digan que sí; en horario de apertura suele ser rápido. Si no pueden, te traemos alternativas.\n\nPagas directamente en el centro. Sin comisión.\n\nEscribe *menu* cuando quieras para ver tu reserva.\nTus reservas y todos nuestros centros: book.massageclub.io` + (id ? `\nRef #${id}` : ""),
    studioConfirmed: (n: string, studio: string, svcN: string, when: string) =>
      `¡Buenas noticias ${n}! *${studio}* ha confirmado tu ${svcN} para *${when}*.\n\nPagas directamente en el centro. ¡Disfruta!\n\nMassage Club · book.massageclub.io`,
    priceInfo: "Buena pregunta. En nuestros centros 60 minutos suele costar entre 40 y 85 EUR, y 90 minutos entre 60 y 100 EUR, según el centro y el tipo de masaje. Te enviamos el precio exacto antes de confirmar y pagas directamente en el centro. Sin comisión.",
    ackReply: "🙌 Te avisamos por aquí en cuanto responda el centro.",
    cardIntro: (url: string) => `Somos Massage Club. Reserva en tres toques, sin registro, y mira cómo responden los centros en directo:\n${url}\n\nO dime qué quieres y lo gestiono por aquí mismo.`,
    confirmLater: (n: string, sN: string, w: string, st: string, id: number | null) =>
      `Gracias ${n}, apuntado.\n\n${sN}\n${w}\n${st}\n\n⏳ *Tu hora aún no está reservada.* Los centros están cerrados ahora, así que se lo pedimos en cuanto abran a las 09:00 y te escribimos aquí en cuanto uno diga que sí. Si no pueden, te traemos alternativas.\n\nPagas directamente en el centro. Sin comisión.\n\nEscribe *menu* cuando quieras para ver tu reserva.\nTus reservas y todos nuestros centros: book.massageclub.io` + (id ? `\nRef #${id}` : ""),
    offer: (n: string, studio: string, where: string, svcN: string, time: string, day: string, asked: string) =>
      `Novedades sobre tu ${svcN}${n ? ", " + n : ""}: *${studio}*${where ? " (" + where + ")" : ""} puede atenderte a las *${time}* ${day}${asked ? " en vez de " + asked : ""}. ¿Te va bien?`,
    offerYes: (t: string) => `Sí, reserva ${t}`,
    offerNo: "Otra hora",
    offerAccepted: (studio: string, when: string, addr: string, phone: string) =>
      `¡Reservado! *${studio}* ha confirmado tu masaje para *${when}*.${addr ? "\nDirección: " + addr : ""}${phone ? "\nTeléfono del centro: " + phone : ""}\n\nPagas directamente en el centro. ¡Disfruta!\n\nMassage Club · book.massageclub.io`,
    offerDeclined: "Sin problema, seguimos preguntando a los demás centros y te escribimos con la siguiente opción.",
    offerGone: "Esa hora acaba de ocuparse, lo sentimos. Seguimos en ello y te escribimos con la siguiente opción.",
    offerRemind: (studio: string, time: string) => `Para que no se pierda: *${studio}* puede a las *${time}*. Toca Sí para reservarla, u Otra hora y seguimos buscando.`,
    sameDay: "Aviso rápido: la mayoría de los centros de Madrid abren a las 11:00 o 12:00, así que lo más temprano que suelen confirmar hoy es sobre las 12:00. ¿Qué prefieres?",
    sameDayBtns: (t: string) => [{ id: "sd_earliest", title: "Lo antes posible hoy" }, { id: "sd_tomorrow", title: "Mañana por la mañana" }, { id: "sd_keep", title: `Mantener ${t}`.slice(0, 20) }],
    earliestToday: "Lo antes posible (desde 12:00)",
    timeChange: (studio: string, time: string, day: string, old: string) =>
      `Cambio del centro: *${studio}* ahora propone *${time}* ${day}${old ? " en vez de " + old : ""}. ¿Te sigue viniendo bien?`,
    timeChangeDeclined: (old: string) => `Entendido. Le hemos pedido al centro que mantenga tu hora original${old ? " (" + old + ")" : ""} y te confirmamos por aquí. Si no pueden, te buscamos otra opción.`,
    reconfirmYes: (studio: string, time: string, addr: string) => `Genial, nos vemos a las *${time}*${studio ? " en " + studio : ""}.${addr ? "\n" + addr : ""}\nYa le hemos dicho al centro que vas.`,
    changeAsk: (studio: string, time: string) => `Entendido, no te comprometemos a las ${time}${studio ? " en " + studio : ""}. ¿Qué día y hora te vendrían bien? Escríbelo aquí y lo consultamos con el centro ahora mismo.`,
    changeNoted: (studio: string) => `Apuntado. Lo estamos consultando con ${studio || "el centro"} y te confirmamos por aquí. No hay nada reservado hasta que digas que sí.`,
    cancelled: (studio: string) => `Cancelado, sin problema. Ya hemos avisado a ${studio || "el centro"}. Cuando quieras otro, escríbenos por aquí.`,
    missedYou: (studio: string) => `Sentimos no haberte visto hoy en ${studio || "el centro"}. Si surgió algo, responde aquí y te buscamos otra hora.`,
    studioReaching: (studio: string, time: string, text: string) => `${studio} intenta contactarte sobre tu cita de las ${time}${text ? ': "' + text.slice(0, 120) + '"' : ""}. ¿Estás de camino? Responde aquí y se lo decimos.`,
    reconfirmRemind: (studio: string, time: string) => `Una cosa rápida: ¿sigues contando con ir a ${studio} a las ${time}? Responde *sí*, o dinos qué cambiar.`,
    noHuman: "Te lo resuelvo aquí mismo. Dime qué masaje quieres, qué día y en qué zona de Madrid, en un solo mensaje si quieres. 60 minutos cuesta entre 40 y 85 EUR según el centro, se paga allí directamente, sin comisión.",
    zoneAnswer: "No somos un solo centro. Te reservamos en centros profesionales de todo Madrid (Centro, Salamanca, Chamberí, Retiro, Chamartín, Malasaña y más) y tú eliges la zona que te venga bien.",
  },
};
export const SERVICE_HINTS: Array<[RegExp, string]> = [
  [/deep tissue|descontracturante|deep-tissue|profundo/i, "svc_deep"],
  [/thai|tailand/i, "svc_thai"],
  [/sports?|deportivo/i, "svc_sports"],
  [/hot stone|piedras calientes|piedras/i, "svc_stone"],
  [/balin|balines/i, "svc_bali"],
  [/shiatsu/i, "svc_shiatsu"],
  [/reflexolog|reflexolog[ií]a/i, "svc_reflex"],
  [/lymphatic|linf[aá]tic|drenaje/i, "svc_lymph"],
  [/couples?|pareja|for two|two people/i, "svc_couples"],
  [/kobido|facial/i, "svc_kobido"],
  [/relax|relaxing|relajante|sueco|swedish|stress|estr[eé]s/i, "svc_relax"],
];
export function detectService(t: string): string {
  const s = String(t || "");
  if (!s) return "";
  for (const [re, id] of SERVICE_HINTS) if (re.test(s)) return id;
  return "";
}
export function detectArea(t: string): string {
  const s = stripAcc(String(t || ""));
  if (!s) return "";
  for (const a of AREAS) if (s.includes(stripAcc(a))) return a;
  if (/\bsol\b|gran via|puerta del sol/i.test(s)) return "Centro";
  return "";
}
