import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, MapPin, MessageCircle } from "lucide-react";
import { trackEvent } from "@/lib/siteVisit";
import { trackFunnel } from "@/lib/funnel";
import { MADRID_AREAS } from "@/lib/locationConsent";
import { haversineKm } from "@/lib/nearestStudios";
import { contactOk, CONTACT_COPY } from "@/lib/contactValidation";
import { DealsConfirmationLine } from "@/components/DealsLink";
import ExitCaptureBlock from "@/components/ExitCaptureBlock";
import AccountOfferBlock from "@/components/AccountOfferBlock";
import { supabase } from "@/lib/supabase";
import { useLastBooking } from "@/lib/useLastBooking";
import { linkRequestToUser } from "@/lib/pendingAccount";
import { useFlowLang, type FlowLang } from "@/lib/flowLang";
import { shortDate, localeOf } from "@/lib/localeFormat";


const LEAD_ENDPOINT = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/lead";

export type PageLang = FlowLang;

export const BOOK_FLOW_COPY = {
  en: {
    brand: "Massage Club · Madrid",
    steps: ["Massage", "When", "Where", "Details"],
    step: "Step",
    of: "of",
    back: "Back",
    continue: "Continue",
    s1Title: "What massage?",
    s1Miss: "Pick a massage to continue.",
    specificLabel: "Anything specific?",
    specificPh: "e.g. strong pressure, 90 minutes",
    massages: [
      "Deep tissue",
      "Relaxing",
      "Thai",
      "Sports recovery",
      "Hot stone",
      "Couples",
      "Not sure",
    ],
    s2Title: "When?",
    s2MissDay: "Pick a day to continue.",
    s2MissTime: "Pick a time of day to continue.",
    dayLabel: "Which day",
    timeLabel: "Time of day",
    s2Helper: "The more times you give us, the faster we confirm with the studio.",
    addTime: "+ Add another time (recommended)",
    option: "Option",
    today: "Today",
    tomorrow: "Tomorrow",
    flexible: "Flexible",
    morning: "Morning (10-13)",
    afternoon: "Afternoon (13-18)",
    evening: "Evening (18-21)",
    s3Title: "Where?",
    s3Label: "Area",
    s3Miss: "Choose an area to continue.",
    s3MissOther: "Tell us where you'd like it.",
    s3Helper: "We'll find you something close.",
    otherPh: "Which area or address?",
    areaPlaceholder: "Choose an area",
    other: "Somewhere else",
    useLocation: "Use my location",
    locating: "Locating you...",
    locationDenied: "No problem, pick your area below",
    s4Title: "Your details",
    peopleLabel: "How many people?",
    peopleLink: "Booking for more than one person?",
    peopleHelp: "We will check the studio can take your group at the same time.",
    sumPeople: "People",
    name: "Name",
    firstName: "First name",
    lastName: "Last name",
    whatsapp: "WhatsApp",
    email: "Email",
    missName: "We need your first and last name.",
    missContact: "Add a WhatsApp number or an email so we can reply.",
    consent: "By booking you agree we can contact you about this request.",
    submit: "Request my massage",
    sending: "Sending...",
    sendError: "Could not send. Message us on WhatsApp at +34 613 97 79 00.",
    promiseTitle: "We are checking with the studio now",
    promiseBody:
      "You will hear from us within 30 minutes with your confirmed time. If they cannot fit you, we will send you other studios nearby.",
    successTitle: "Almost done - send it to us",
    successSub: "Tap send in WhatsApp and we'll confirm your time with the studio.",
    sendWhatsApp: "Send my request on WhatsApp",
    noWhatsApp: "No WhatsApp? We'll reply to {contact}.",
    sumMassage: "Massage",
    sumWhen: "When",
    sumWhere: "Where",
    seoTitle: "Book a massage in Madrid | Massage Club",
    seoDesc:
      "Tell us the massage you want, when and where. We confirm the time with the studio and message you back the same day.",
    sameAsLast: "same as last time",
    or: " or ",
    waMessage: "Hi, I'm {name}. I'd like to book a {want} massage{people} in {area}. I can do {when}.",
    waPeopleSuffix: " for {people} people",
  },
  es: {
    brand: "Massage Club · Madrid",
    steps: ["Masaje", "Cuándo", "Dónde", "Datos"],
    step: "Paso",
    of: "de",
    back: "Atrás",
    continue: "Continuar",
    s1Title: "¿Qué masaje?",
    s1Miss: "Elige un masaje para continuar.",
    specificLabel: "¿Algo concreto?",
    specificPh: "p. ej. presión fuerte, 90 minutos",
    massages: [
      "Masaje descontracturante",
      "Relajante",
      "Tailandés",
      "Recuperación deportiva",
      "Piedras calientes",
      "En pareja",
      "No lo sé",
    ],
    s2Title: "¿Cuándo?",
    s2MissDay: "Elige un día para continuar.",
    s2MissTime: "Elige una franja horaria para continuar.",
    dayLabel: "Qué día",
    timeLabel: "Franja horaria",
    s2Helper: "Cuantas más horas nos des, antes te confirmamos con el centro.",
    addTime: "+ Añadir otra hora (recomendado)",
    option: "Opción",
    today: "Hoy",
    tomorrow: "Mañana",
    flexible: "Flexible",
    morning: "Mañana (10-13)",
    afternoon: "Tarde (13-18)",
    evening: "Noche (18-21)",
    s3Title: "¿Dónde?",
    s3Label: "Zona",
    s3Miss: "Elige una zona para continuar.",
    s3MissOther: "Dinos dónde lo quieres.",
    s3Helper: "Te buscamos algo cerca.",
    otherPh: "¿Qué zona o dirección?",
    areaPlaceholder: "Elige una zona",
    other: "Otra zona",
    useLocation: "Usar mi ubicación",
    locating: "Localizándote...",
    locationDenied: "Sin problema, elige tu zona abajo",
    s4Title: "Tus datos",
    peopleLabel: "¿Cuántas personas?",
    peopleLink: "¿Reservas para más de una persona?",
    peopleHelp: "Confirmamos con el centro que pueden atender a todo el grupo a la vez.",
    sumPeople: "Personas",
    name: "Nombre",
    firstName: "Nombre",
    lastName: "Apellido",
    whatsapp: "WhatsApp",
    email: "Email",
    missName: "Necesitamos tu nombre y apellido.",
    missContact: "Añade un WhatsApp o un email para poder responderte.",
    consent: "Al reservar aceptas que te contactemos sobre esta solicitud.",
    submit: "Pedir mi masaje",
    sending: "Enviando...",
    sendError: "No se pudo enviar. Escríbenos por WhatsApp al +34 613 97 79 00.",
    promiseTitle: "Estamos confirmando con el centro",
    promiseBody:
      "Te escribimos en menos de 30 minutos con tu hora confirmada. Si no pueden, te mandamos otros centros cerca.",
    successTitle: "Casi listo - envíanoslo",
    successSub: "Dale a enviar en WhatsApp y confirmamos tu hora con el centro.",
    sendWhatsApp: "Enviar mi solicitud por WhatsApp",
    noWhatsApp: "¿No tienes WhatsApp? Te respondemos a {contact}.",
    sumMassage: "Masaje",
    sumWhen: "Cuándo",
    sumWhere: "Dónde",
    seoTitle: "Reserva un masaje en Madrid | Massage Club",
    seoDesc:
      "Dinos qué masaje quieres, cuándo y dónde. Confirmamos la hora con el centro y te escribimos el mismo día.",
    sameAsLast: "como la última vez",
    or: " o ",
    waMessage: "Hola, soy {name}. Quiero reservar: {want}{people} en {area}. Me va bien {when}.",
    waPeopleSuffix: " para {people} personas",
  },
  fr: {
    brand: "Massage Club · Madrid",
    steps: ["Massage", "Quand", "Où", "Détails"],
    step: "Étape",
    of: "sur",
    back: "Retour",
    continue: "Continuer",
    s1Title: "Quel massage ?",
    s1Miss: "Choisissez un massage pour continuer.",
    specificLabel: "Une demande particulière ?",
    specificPh: "ex. pression forte, 90 minutes",
    massages: [
      "Tissus profonds",
      "Relaxant",
      "Thaï",
      "Récupération sportive",
      "Pierres chaudes",
      "En duo",
      "Je ne sais pas",
    ],
    s2Title: "Quand ?",
    s2MissDay: "Choisissez un jour pour continuer.",
    s2MissTime: "Choisissez un créneau pour continuer.",
    dayLabel: "Quel jour",
    timeLabel: "Créneau horaire",
    s2Helper: "Plus vous nous donnez de créneaux, plus vite nous confirmons avec le centre.",
    addTime: "+ Ajouter un autre créneau (recommandé)",
    option: "Option",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    flexible: "Flexible",
    morning: "Matin (10h-13h)",
    afternoon: "Après-midi (13h-18h)",
    evening: "Soir (18h-21h)",
    s3Title: "Où ?",
    s3Label: "Quartier",
    s3Miss: "Choisissez un quartier pour continuer.",
    s3MissOther: "Dites-nous où vous le souhaitez.",
    s3Helper: "Nous vous trouvons quelque chose à proximité.",
    otherPh: "Quel quartier ou adresse ?",
    areaPlaceholder: "Choisissez un quartier",
    other: "Ailleurs",
    useLocation: "Utiliser ma position",
    locating: "Localisation en cours...",
    locationDenied: "Pas de souci, choisissez votre quartier ci-dessous",
    s4Title: "Vos coordonnées",
    peopleLabel: "Combien de personnes ?",
    peopleLink: "Réservation pour plusieurs personnes ?",
    peopleHelp: "Nous vérifions que le centre peut prendre votre groupe en même temps.",
    sumPeople: "Personnes",
    name: "Nom",
    firstName: "Prénom",
    lastName: "Nom",
    whatsapp: "WhatsApp",
    email: "Email",
    missName: "Il nous faut votre prénom et votre nom.",
    missContact: "Ajoutez un numéro WhatsApp ou un email pour qu'on puisse vous répondre.",
    consent: "En réservant, vous acceptez que nous vous contactions à propos de cette demande.",
    submit: "Demander mon massage",
    sending: "Envoi...",
    sendError: "Envoi impossible. Écrivez-nous sur WhatsApp au +34 613 97 79 00.",
    promiseTitle: "Nous confirmons avec le centre",
    promiseBody:
      "Vous aurez de nos nouvelles sous 30 minutes avec votre horaire confirmé. S'ils ne peuvent pas vous prendre, nous vous proposerons d'autres centres à proximité.",
    successTitle: "Presque terminé - envoyez-le nous",
    successSub: "Appuyez sur envoyer dans WhatsApp et nous confirmons votre horaire avec le centre.",
    sendWhatsApp: "Envoyer ma demande sur WhatsApp",
    noWhatsApp: "Pas de WhatsApp ? Nous répondrons à {contact}.",
    sumMassage: "Massage",
    sumWhen: "Quand",
    sumWhere: "Où",
    seoTitle: "Réserver un massage à Madrid | Massage Club",
    seoDesc:
      "Dites-nous quel massage vous voulez, quand et où. Nous confirmons l'horaire avec le centre et vous répondons le jour même.",
    sameAsLast: "comme la dernière fois",
    or: " ou ",
    waMessage: "Bonjour, je suis {name}. Je voudrais réserver un massage {want}{people} à {area}. Je suis disponible {when}.",
    waPeopleSuffix: " pour {people} personnes",
  },
  de: {
    brand: "Massage Club · Madrid",
    steps: ["Massage", "Wann", "Wo", "Angaben"],
    step: "Schritt",
    of: "von",
    back: "Zurück",
    continue: "Weiter",
    s1Title: "Welche Massage?",
    s1Miss: "Wähle eine Massage, um fortzufahren.",
    specificLabel: "Etwas Bestimmtes?",
    specificPh: "z. B. starker Druck, 90 Minuten",
    massages: [
      "Tiefengewebsmassage",
      "Entspannend",
      "Thai",
      "Sportliche Erholung",
      "Hot Stone",
      "Für Paare",
      "Nicht sicher",
    ],
    s2Title: "Wann?",
    s2MissDay: "Wähle einen Tag, um fortzufahren.",
    s2MissTime: "Wähle eine Tageszeit, um fortzufahren.",
    dayLabel: "Welcher Tag",
    timeLabel: "Tageszeit",
    s2Helper: "Je mehr Zeiten du uns nennst, desto schneller können wir mit dem Studio bestätigen.",
    addTime: "+ Weitere Zeit hinzufügen (empfohlen)",
    option: "Option",
    today: "Heute",
    tomorrow: "Morgen",
    flexible: "Flexibel",
    morning: "Vormittag (10-13 Uhr)",
    afternoon: "Nachmittag (13-18 Uhr)",
    evening: "Abend (18-21 Uhr)",
    s3Title: "Wo?",
    s3Label: "Gegend",
    s3Miss: "Wähle eine Gegend, um fortzufahren.",
    s3MissOther: "Sag uns, wo du es möchtest.",
    s3Helper: "Wir finden etwas in deiner Nähe.",
    otherPh: "Welche Gegend oder Adresse?",
    areaPlaceholder: "Gegend wählen",
    other: "Woanders",
    useLocation: "Meinen Standort verwenden",
    locating: "Standort wird ermittelt...",
    locationDenied: "Kein Problem, wähle deine Gegend unten",
    s4Title: "Deine Angaben",
    peopleLabel: "Wie viele Personen?",
    peopleLink: "Buchung für mehr als eine Person?",
    peopleHelp: "Wir prüfen, ob das Studio deine Gruppe zur gleichen Zeit aufnehmen kann.",
    sumPeople: "Personen",
    name: "Name",
    firstName: "Vorname",
    lastName: "Nachname",
    whatsapp: "WhatsApp",
    email: "E-Mail",
    missName: "Wir brauchen deinen Vor- und Nachnamen.",
    missContact: "Gib eine WhatsApp-Nummer oder eine E-Mail-Adresse an, damit wir antworten können.",
    consent: "Mit der Buchung stimmst du zu, dass wir dich zu dieser Anfrage kontaktieren dürfen.",
    submit: "Meine Massage anfragen",
    sending: "Wird gesendet...",
    sendError: "Konnte nicht gesendet werden. Schreib uns auf WhatsApp an +34 613 97 79 00.",
    promiseTitle: "Wir klären das gerade mit dem Studio",
    promiseBody:
      "Wir melden uns innerhalb von 30 Minuten mit deiner bestätigten Zeit. Falls es nicht klappt, schicken wir dir andere Studios in der Nähe.",
    successTitle: "Fast fertig - schick es uns ab",
    successSub: "Tippe in WhatsApp auf Senden, und wir bestätigen deine Zeit mit dem Studio.",
    sendWhatsApp: "Meine Anfrage per WhatsApp senden",
    noWhatsApp: "Kein WhatsApp? Wir antworten dir an {contact}.",
    sumMassage: "Massage",
    sumWhen: "Wann",
    sumWhere: "Wo",
    seoTitle: "Massage in Madrid buchen | Massage Club",
    seoDesc:
      "Sag uns, welche Massage, wann und wo. Wir bestätigen die Zeit mit dem Studio und melden uns noch am selben Tag.",
    sameAsLast: "wie beim letzten Mal",
    or: " oder ",
    waMessage: "Hallo, ich bin {name}. Ich möchte eine {want}-Massage{people} in {area} buchen. Ich kann {when}.",
    waPeopleSuffix: " für {people} Personen",
  },
  it: {
    brand: "Massage Club · Madrid",
    steps: ["Massaggio", "Quando", "Dove", "Dati"],
    step: "Passo",
    of: "di",
    back: "Indietro",
    continue: "Continua",
    s1Title: "Che massaggio?",
    s1Miss: "Scegli un massaggio per continuare.",
    specificLabel: "Qualcosa di specifico?",
    specificPh: "es. pressione forte, 90 minuti",
    massages: [
      "Tessuti profondi",
      "Rilassante",
      "Thailandese",
      "Recupero sportivo",
      "Pietre calde",
      "Di coppia",
      "Non lo so",
    ],
    s2Title: "Quando?",
    s2MissDay: "Scegli un giorno per continuare.",
    s2MissTime: "Scegli una fascia oraria per continuare.",
    dayLabel: "Quale giorno",
    timeLabel: "Fascia oraria",
    s2Helper: "Più orari ci dai, più velocemente confermiamo con il centro.",
    addTime: "+ Aggiungi un altro orario (consigliato)",
    option: "Opzione",
    today: "Oggi",
    tomorrow: "Domani",
    flexible: "Flessibile",
    morning: "Mattina (10-13)",
    afternoon: "Pomeriggio (13-18)",
    evening: "Sera (18-21)",
    s3Title: "Dove?",
    s3Label: "Zona",
    s3Miss: "Scegli una zona per continuare.",
    s3MissOther: "Dicci dove lo vorresti.",
    s3Helper: "Ti troviamo qualcosa vicino.",
    otherPh: "Quale zona o indirizzo?",
    areaPlaceholder: "Scegli una zona",
    other: "Un'altra zona",
    useLocation: "Usa la mia posizione",
    locating: "Localizzazione in corso...",
    locationDenied: "Nessun problema, scegli la tua zona qui sotto",
    s4Title: "I tuoi dati",
    peopleLabel: "Quante persone?",
    peopleLink: "Prenoti per più di una persona?",
    peopleHelp: "Verifichiamo che il centro possa accogliere il tuo gruppo nello stesso momento.",
    sumPeople: "Persone",
    name: "Nome",
    firstName: "Nome",
    lastName: "Cognome",
    whatsapp: "WhatsApp",
    email: "Email",
    missName: "Ci servono il tuo nome e cognome.",
    missContact: "Aggiungi un numero WhatsApp o un'email per poterti rispondere.",
    consent: "Prenotando accetti che ti contattiamo riguardo a questa richiesta.",
    submit: "Richiedi il mio massaggio",
    sending: "Invio in corso...",
    sendError: "Impossibile inviare. Scrivici su WhatsApp al +34 613 97 79 00.",
    promiseTitle: "Stiamo confermando con il centro",
    promiseBody:
      "Ti risponderemo entro 30 minuti con il tuo orario confermato. Se non riescono, ti proponiamo altri centri vicini.",
    successTitle: "Quasi fatto - invialo",
    successSub: "Tocca invia su WhatsApp e confermiamo il tuo orario con il centro.",
    sendWhatsApp: "Invia la mia richiesta su WhatsApp",
    noWhatsApp: "Non hai WhatsApp? Ti risponderemo a {contact}.",
    sumMassage: "Massaggio",
    sumWhen: "Quando",
    sumWhere: "Dove",
    seoTitle: "Prenota un massaggio a Madrid | Massage Club",
    seoDesc:
      "Dicci che massaggio vuoi, quando e dove. Confermiamo l'orario con il centro e ti rispondiamo lo stesso giorno.",
    sameAsLast: "come l'ultima volta",
    or: " o ",
    waMessage: "Ciao, sono {name}. Vorrei prenotare un massaggio {want}{people} a {area}. Sono disponibile {when}.",
    waPeopleSuffix: " per {people} persone",
  },
  pt: {
    brand: "Massage Club · Madrid",
    steps: ["Massagem", "Quando", "Onde", "Dados"],
    step: "Passo",
    of: "de",
    back: "Voltar",
    continue: "Continuar",
    s1Title: "Que massagem?",
    s1Miss: "Escolhe uma massagem para continuar.",
    specificLabel: "Algo em específico?",
    specificPh: "ex. pressão forte, 90 minutos",
    massages: [
      "Tecidos profundos",
      "Relaxante",
      "Tailandesa",
      "Recuperação desportiva",
      "Pedras quentes",
      "Casal",
      "Não sei",
    ],
    s2Title: "Quando?",
    s2MissDay: "Escolhe um dia para continuar.",
    s2MissTime: "Escolhe um período do dia para continuar.",
    dayLabel: "Que dia",
    timeLabel: "Período do dia",
    s2Helper: "Quanto mais horários nos deres, mais rápido confirmamos com o estúdio.",
    addTime: "+ Adicionar outro horário (recomendado)",
    option: "Opção",
    today: "Hoje",
    tomorrow: "Amanhã",
    flexible: "Flexível",
    morning: "Manhã (10-13h)",
    afternoon: "Tarde (13-18h)",
    evening: "Noite (18-21h)",
    s3Title: "Onde?",
    s3Label: "Zona",
    s3Miss: "Escolhe uma zona para continuar.",
    s3MissOther: "Diz-nos onde queres.",
    s3Helper: "Encontramos algo perto de ti.",
    otherPh: "Que zona ou morada?",
    areaPlaceholder: "Escolhe uma zona",
    other: "Outra zona",
    useLocation: "Usar a minha localização",
    locating: "A localizar...",
    locationDenied: "Sem problema, escolhe a tua zona abaixo",
    s4Title: "Os teus dados",
    peopleLabel: "Quantas pessoas?",
    peopleLink: "Reserva para mais de uma pessoa?",
    peopleHelp: "Vamos confirmar que o estúdio pode receber o teu grupo ao mesmo tempo.",
    sumPeople: "Pessoas",
    name: "Nome",
    firstName: "Nome próprio",
    lastName: "Apelido",
    whatsapp: "WhatsApp",
    email: "Email",
    missName: "Precisamos do teu nome e apelido.",
    missContact: "Adiciona um número de WhatsApp ou um email para podermos responder.",
    consent: "Ao reservar, aceitas que te contactemos sobre este pedido.",
    submit: "Pedir a minha massagem",
    sending: "A enviar...",
    sendError: "Não foi possível enviar. Escreve-nos no WhatsApp para +34 613 97 79 00.",
    promiseTitle: "Estamos a confirmar com o estúdio",
    promiseBody:
      "Vamos responder-te em menos de 30 minutos com o teu horário confirmado. Se não conseguirem, enviamos-te outros estúdios perto.",
    successTitle: "Quase pronto - envia-nos",
    successSub: "Toca em enviar no WhatsApp e confirmamos o teu horário com o estúdio.",
    sendWhatsApp: "Enviar o meu pedido no WhatsApp",
    noWhatsApp: "Não tens WhatsApp? Respondemos para {contact}.",
    sumMassage: "Massagem",
    sumWhen: "Quando",
    sumWhere: "Onde",
    seoTitle: "Reserva uma massagem em Madrid | Massage Club",
    seoDesc:
      "Diz-nos que massagem queres, quando e onde. Confirmamos o horário com o estúdio e respondemos no mesmo dia.",
    sameAsLast: "como da última vez",
    or: " ou ",
    waMessage: "Olá, sou {name}. Gostava de reservar uma massagem {want}{people} em {area}. Tenho disponibilidade {when}.",
    waPeopleSuffix: " para {people} pessoas",
  },
  zh: {
    brand: "Massage Club · 马德里",
    steps: ["按摩", "时间", "地点", "详情"],
    step: "第",
    of: "步，共",
    back: "返回",
    continue: "继续",
    s1Title: "想要什么按摩？",
    s1Miss: "请选择一种按摩以继续。",
    specificLabel: "有具体要求吗？",
    specificPh: "例如：力度大一点，90分钟",
    massages: [
      "深层组织按摩",
      "放松按摩",
      "泰式按摩",
      "运动恢复按摩",
      "热石按摩",
      "情侣按摩",
      "不确定",
    ],
    s2Title: "什么时候？",
    s2MissDay: "请选择日期以继续。",
    s2MissTime: "请选择时间段以继续。",
    dayLabel: "哪一天",
    timeLabel: "时间段",
    s2Helper: "提供的时间越多，我们就能越快帮你确认门店。",
    addTime: "+ 添加另一个时间（推荐）",
    option: "选项",
    today: "今天",
    tomorrow: "明天",
    flexible: "时间灵活",
    morning: "上午 (10-13点)",
    afternoon: "下午 (13-18点)",
    evening: "晚上 (18-21点)",
    s3Title: "在哪里？",
    s3Label: "区域",
    s3Miss: "请选择一个区域以继续。",
    s3MissOther: "告诉我们你想要的地点。",
    s3Helper: "我们会为你找附近的门店。",
    otherPh: "哪个区域或地址？",
    areaPlaceholder: "选择一个区域",
    other: "其他地方",
    useLocation: "使用我的位置",
    locating: "正在定位...",
    locationDenied: "没关系，请在下方选择你的区域",
    s4Title: "你的信息",
    peopleLabel: "有多少人？",
    peopleLink: "为多人预订？",
    peopleHelp: "我们会确认门店能否同时接待你们一行人。",
    sumPeople: "人数",
    name: "姓名",
    firstName: "名",
    lastName: "姓",
    whatsapp: "WhatsApp",
    email: "邮箱",
    missName: "请填写你的名和姓。",
    missContact: "请填写WhatsApp号码或邮箱以便我们回复你。",
    consent: "预订即表示你同意我们就此请求与你联系。",
    submit: "提交我的按摩请求",
    sending: "发送中...",
    sendError: "发送失败，请通过WhatsApp联系我们：+34 613 97 79 00。",
    promiseTitle: "我们正在与门店确认",
    promiseBody: "我们会在30分钟内告诉你确认的时间。如果门店无法安排，我们会为你推荐附近其他门店。",
    successTitle: "快好了 - 发送给我们",
    successSub: "点击WhatsApp中的发送，我们会与门店确认你的时间。",
    sendWhatsApp: "通过WhatsApp发送我的请求",
    noWhatsApp: "没有WhatsApp？我们会回复到{contact}。",
    sumMassage: "按摩",
    sumWhen: "时间",
    sumWhere: "地点",
    seoTitle: "在马德里预订按摩 | Massage Club",
    seoDesc: "告诉我们你想要的按摩、时间和地点。我们会与门店确认时间，并在当天回复你。",
    sameAsLast: "和上次一样",
    or: " 或 ",
    waMessage: "你好，我是{name}。我想预订{want}按摩{people}，地点在{area}。我方便的时间是{when}。",
    waPeopleSuffix: "（{people}人）",
  },
} as const;

const PEOPLE_OPTIONS = ["2", "3", "4", "5+"];

const AREAS_BASE = [
  "Centro",
  "Chamberí",
  "Malasaña",
  "Chueca",
  "Salamanca",
  "La Latina",
  "Lavapiés",
  "Argüelles/Moncloa",
  "Chamartín",
  "Tetuán",
  "Retiro",
];

export function useBookFlowLang(): PageLang {
  const lang = useFlowLang();

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("mc_lang", lang); } catch { /* ignore */ }
  }, [lang]);

  return lang;
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-11 px-4 rounded-full border text-base whitespace-nowrap transition ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-soft font-semibold"
          : "bg-card text-foreground border-border hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The 4-step concierge booking wizard (Massage -> When -> Where -> Details).
 * Shared by /book and the /fb landing page; `source` tags the lead row.
 */
export default function BookFlowWizard({
  source,
  lang,
  showBrand = true,
  scrollTopOnStep = true,
  preselect = null,
}: {
  source: string;
  lang: PageLang;
  showBrand?: boolean;
  scrollTopOnStep?: boolean;
  /** Preselect a massage in step 1 from outside. Bump `nonce` to re-apply. */
  preselect?: { value: string; nonce: number } | null;
}) {
  const t = BOOK_FLOW_COPY[lang] ?? BOOK_FLOW_COPY.en;
  const cc = CONTACT_COPY[lang as "en" | "es"] ?? CONTACT_COPY.en;


  const [step, setStep] = useState(1);
  const [massage, setMassage] = useState("");
  const [specific, setSpecific] = useState("");
  const [people, setPeople] = useState("1");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [day2, setDay2] = useState("");
  const [time2, setTime2] = useState("");
  const [day3, setDay3] = useState("");
  const [time3, setTime3] = useState("");
  const [slots, setSlots] = useState(1);
  const [area, setArea] = useState("");
  const [areaOther, setAreaOther] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  // Returning users: never type anything they have already given us.
  const [signedIn, setSignedIn] = useState(false);
  const [sameAsLast, setSameAsLast] = useState<string | null>(null);
  const { lastBooking } = useLastBooking();

  // One Continue at a time: while the inline button is in the viewport the
  // sticky bottom bar stays hidden; once it scrolls away the bar appears.
  const continueWrapRef = useRef<HTMLDivElement | null>(null);
  const [inlineContinueVisible, setInlineContinueVisible] = useState(true);
  useEffect(() => {
    const el = continueWrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => setInlineContinueVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [step]);


  useEffect(() => {
    let cancelled = false;
    const prefill = async (user: any) => {
      if (!user || cancelled) return;
      setSignedIn(true);
      const meta = (user.user_metadata || {}) as Record<string, string>;
      const metaName = (meta.full_name || meta.name || "").trim();
      setEmail((prev) => prev || user.email || "");
      if (metaName) {
        const [f, ...rest] = metaName.split(/\s+/);
        setFirstName((prev) => prev || f || "");
        setLastName((prev) => prev || rest.join(" "));
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (cancelled || !data) return;
      const p = data as any;
      const full = (p.full_name || "").trim();
      const [pf, ...pr] = full ? full.split(/\s+/) : [];
      setFirstName((prev) => prev || p.first_name || pf || "");
      setLastName((prev) => prev || p.last_name || pr.join(" ") || "");
      setEmail((prev) => prev || p.email || "");
      setPhone((prev) => prev || p.phone || "");
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) prefill(data.session.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) prefill(session.user);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // "Same as last time": preselect the massage they booked before.
  useEffect(() => {
    if (!lastBooking?.serviceName) return;
    const want = lastBooking.serviceName.toLowerCase();
    const match = (t.massages as readonly string[]).find(
      (m) => want.includes(m.toLowerCase()) || m.toLowerCase().includes(want),
    );
    if (!match) return;
    setSameAsLast(match);
    setMassage((prev) => prev || match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastBooking?.serviceName, lang]);

  const rootRef = useRef<HTMLDivElement>(null);
  const massageRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  // Today in Europe/Madrid, as a local-noon Date so date maths stay stable.
  const madridToday = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [y, m, d] = parts.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }, []);

  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const dayOptions = useMemo(() => {
    const out: { label: string; iso: string }[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(madridToday);
      d.setDate(madridToday.getDate() + i);
      const label = i === 0 ? t.today : i === 1 ? t.tomorrow : shortDate(d, lang);
      out.push({ label, iso: toIso(d) });
    }
    out.push({ label: t.flexible, iso: "Flexible" });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, madridToday]);

  const dayChips = useMemo(() => dayOptions.map((o) => o.label), [dayOptions]);

  const isoForDay = (label: string) => dayOptions.find((o) => o.label === label)?.iso ?? "Flexible";

  /** "Saturday 29 Aug" / "sábado 29 ago" - or "Flexible". */
  const prettyDay = (label: string) => {
    const iso = isoForDay(label);
    if (iso === "Flexible") return t.flexible;
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat(localeOf(lang), {
      weekday: "long",
      day: "numeric",
      month: "short",
    }).format(new Date(y, m - 1, d, 12));
  };

  const prettySlot = (dayLabel: string, timeLabel: string) => {
    if (!dayLabel && !timeLabel) return "";
    const parts = [dayLabel ? prettyDay(dayLabel) : "", timeLabel ? timeLabel.toLowerCase() : ""].filter(Boolean);
    return parts.join(", ");
  };


  useEffect(() => {
    if (!preselect) return;
    setMassage(preselect.value);
    setStep(1);
    setHint(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect?.nonce]);

  const timeChips = [t.morning, t.afternoon, t.evening, t.flexible];
  const areas = [...AREAS_BASE, t.other];

  const contact = contactOk(phone, email);
  const nameComplete = !!firstName.trim() && !!lastName.trim();
  const canSubmit = nameComplete && contact.ok;



  const fail = (msg: string, ref: React.RefObject<HTMLDivElement>) => {
    setHint(msg);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const afterStep = () => {
    if (scrollTopOnStep) window.scrollTo({ top: 0, behavior: "smooth" });
    else rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goNext = () => {
    setHint(null);
    if (step === 1) {
      if (!massage) return fail(t.s1Miss, massageRef);
      setStep(2);
    } else if (step === 2) {
      if (!day) return fail(t.s2MissDay, dayRef);
      if (!time) return fail(t.s2MissTime, timeRef);
      setStep(3);
    } else if (step === 3) {
      if (!area) return fail(t.s3Miss, areaRef);
      if (area === t.other && !areaOther.trim()) return fail(t.s3MissOther, areaRef);
      setStep(4);
    }
    afterStep();
  };

  const areaValue = area === t.other ? areaOther.trim() || t.other : area;
  const baseWant = specific.trim() ? `${massage} + ${specific.trim()}` : massage;
  const isGroup = people !== "1";
  const wantValue = isGroup ? `${baseWant} - Personas: ${people}` : baseWant;

  const mapAreaNameToOption = (name: string): string => {
    if (name === "Argüelles") return "Argüelles/Moncloa";
    return name;
  };

  // Funnel: each step becoming visible, with whatever they have chosen so far.
  useEffect(() => {
    trackFunnel(`wizard_step_${step}`, {
      source,
      lang,
      massage: massage || null,
      area: area ? areaValue : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleUseLocation = () => {
    setLocationDenied(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      trackEvent("locate_denied");
      setLocationDenied(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        trackEvent("locate_granted");
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        let nearest = MADRID_AREAS[0];
        let bestKm = Infinity;
        for (const a of MADRID_AREAS) {
          const km = haversineKm(userLat, userLng, a.lat, a.lng);
          if (km < bestKm) {
            bestKm = km;
            nearest = a;
          }
        }
        const option = mapAreaNameToOption(nearest.name);
        if (areas.includes(option)) {
          setArea(option);
          trackFunnel("wizard_area_selected", { area: option, via: "geolocation", massage: massage || null, source });
        } else if (areas.includes(nearest.name)) {
          setArea(nearest.name);
          trackFunnel("wizard_area_selected", { area: nearest.name, via: "geolocation", massage: massage || null, source });
        }
        setHint(null);
      },
      () => {
        setLocating(false);
        trackEvent("locate_denied");
        setLocationDenied(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  const whenValue = prettySlot(day, time);
  const when2Value = prettySlot(day2, time2);
  const when3Value = prettySlot(day3, time3);

  const submit = async () => {
    setHint(null);
    trackFunnel("wizard_submit_attempt", { source, lang, massage: massage || null, area: areaValue || null, people });
    if (!firstName.trim() || !lastName.trim()) return fail(t.missName, nameRef);
    if (contact.phoneValid === false) return fail(cc.badPhone, contactRef);
    if (contact.emailValid === false) return fail(cc.badEmail, contactRef);
    if (!contact.ok) return fail(cc.needContact, contactRef);


    setStatus("loading");
    try {
      const res = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          want: wantValue,
          day1: day ? isoForDay(day) : undefined,
          time1: time || undefined,
          day2: day2 ? isoForDay(day2) : undefined,
          time2: time2 || undefined,
          day3: day3 ? isoForDay(day3) : undefined,
          time3: time3 || undefined,
          when: whenValue,
          when2: when2Value || undefined,
          when3: when3Value || undefined,

          area: areaValue,
          people,
          name: name,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          lang,
          source,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        trackFunnel("wizard_submit_ok", {
          source,
          lang,
          massage: massage || null,
          area: areaValue || null,
          request_id: (data as { id?: string | number }).id ?? null,
        });
        // Already signed in: attach the request to their account, no offer.
        if (signedIn) void linkRequestToUser(null, email.trim() || null);
        setStatus("success");
        afterStep();
      } else {
        trackFunnel("wizard_submit_error", {
          source,
          massage: massage || null,
          area: areaValue || null,
          status: res.status,
          error: String((data as { error?: unknown }).error ?? `http_${res.status}`).slice(0, 200),
        });
        setStatus("error");
      }
    } catch (e) {
      trackFunnel("wizard_submit_error", {
        source,
        massage: massage || null,
        area: areaValue || null,
        error: String((e as Error)?.message || e || "network_error").slice(0, 200),
      });
      setStatus("error");
    }
  };

  if (status === "success") {
    const slotList = [whenValue, when2Value, when3Value].filter(Boolean);
    const slotsText = slotList.join(t.or);
    const peopleSuffix = isGroup ? t.waPeopleSuffix.replace("{people}", people) : "";
    const waText = t.waMessage
      .replace("{name}", name)
      .replace("{want}", baseWant)
      .replace("{people}", peopleSuffix)
      .replace("{area}", areaValue)
      .replace("{when}", slotsText);
    const waLink = `https://wa.me/34613977900?text=${encodeURIComponent(waText)}`;
    const fallbackContact = email.trim() || phone.trim();

    return (
      <div ref={rootRef}>
        <div className="text-center">
          <h2 className="font-display text-3xl text-foreground mt-4">{t.promiseTitle}</h2>
          <p className="text-base text-muted-foreground mt-3 leading-snug">{t.promiseBody}</p>
          <p className="mt-4 text-base font-semibold text-foreground">{t.successTitle}</p>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{t.successSub}</p>
        </div>
        <div className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-soft space-y-3">
          {[
            [t.sumMassage, baseWant],
            ...(isGroup ? [[t.sumPeople, people]] : []),
            [t.sumWhen, slotList.join(" · ")],
            [t.sumWhere, areaValue],
            [t.name, name],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4">
              <span className="text-sm text-muted-foreground">{k}</span>
              <span className="text-base text-foreground font-medium text-right">{v}</span>
            </div>
          ))}
        </div>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            trackEvent("wizard_whatsapp_click", { meta: { source, lang } });
            trackFunnel("wizard_wa_handoff", { source, lang, massage: massage || null, area: areaValue || null });
          }}
          className="mt-6 w-full h-14 rounded-full bg-[#25D366] text-white text-base font-semibold shadow-soft hover:bg-[#128C7E] transition inline-flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5 fill-current" /> {t.sendWhatsApp}
        </a>
        {fallbackContact && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t.noWhatsApp.replace("{contact}", fallbackContact)}
          </p>
        )}
        <AccountOfferBlock
          className="mt-6"
          firstName={firstName.trim()}
          lastName={lastName.trim()}
          email={email.trim()}
          phone={phone.trim()}
          source={`wizard:${source}`}
        />
        <DealsConfirmationLine className="mt-6" />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      {showBrand && (
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">{t.brand}</p>
      )}

      {/* Progress */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        {t.steps.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div
              key={label}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs whitespace-nowrap ${
                active
                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                  : done
                    ? "bg-secondary text-foreground border-border"
                    : "bg-card text-muted-foreground border-border/70"
              }`}
            >
              <span className="font-bold">{n}</span>
              {label}
            </div>
          );
        })}
      </div>

      {step > 1 && (
        <button
          type="button"
          onClick={() => { setHint(null); setStep((s) => s - 1); }}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition"
        >
          <ArrowLeft className="h-4 w-4" /> {t.back}
        </button>
      )}

      {step === 1 && (
        <section className="mt-5">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">{t.s1Title}</h2>
          <div ref={massageRef} className="mt-4 grid gap-3 sm:grid-cols-2">
            {(t.massages.includes(massage as never) || !massage
              ? t.massages
              : [...t.massages, massage]
            ).map((m) => {
              const active = massage === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMassage(m); setHint(null); }}
                  aria-pressed={active}
                  className={`text-left rounded-2xl border p-4 text-base transition ${
                    active
                      ? "border-primary bg-secondary/60 shadow-soft font-semibold text-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/50"
                  }`}
                >
                  {m}
                  {sameAsLast === m && (
                    <span className="block mt-1 text-xs font-normal text-muted-foreground">
                      {t.sameAsLast}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <Label htmlFor="specific" className="text-sm text-foreground">{t.specificLabel}</Label>
            <Input
              id="specific"
              value={specific}
              onChange={(e) => setSpecific(e.target.value)}
              placeholder={t.specificPh}
              className="mt-1.5 h-12 text-base"
            />
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-5">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">{t.s2Title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.s2Helper}</p>

          {([
            [day, setDay, time, setTime],
            [day2, setDay2, time2, setTime2],
            [day3, setDay3, time3, setTime3],
          ] as const).slice(0, slots).map(([dVal, setD, tVal, setT], idx) => (
            <div key={idx} className={idx === 0 ? "" : "mt-8 pt-6 border-t border-border"}>
              {idx > 0 && (
                <p className="text-xs font-bold tracking-wider uppercase text-primary">{t.option} {idx + 1}</p>
              )}
              <div ref={idx === 0 ? dayRef : undefined} className="mt-4">
                <p className="text-sm text-muted-foreground">{t.dayLabel}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dayChips.map((d) => (
                    <Chip key={d} active={dVal === d} onClick={() => { setD(d); setHint(null); trackFunnel("wizard_day_selected", { day: d, iso: isoForDay(d), option: idx + 1, massage: massage || null, source }); }}>{d}</Chip>
                  ))}
                </div>
              </div>

              <div ref={idx === 0 ? timeRef : undefined} className="mt-6">
                <p className="text-sm text-muted-foreground">{t.timeLabel}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {timeChips.map((x) => (
                    <Chip key={x} active={tVal === x} onClick={() => { setT(x); setHint(null); trackFunnel("wizard_time_selected", { time: x, option: idx + 1, massage: massage || null, source }); }}>{x}</Chip>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {slots < 3 && day && time && (
            <button
              type="button"
              onClick={() => setSlots((n) => Math.min(3, n + 1))}
              className="mt-6 text-base font-semibold text-primary underline underline-offset-4"
            >
              {t.addTime}
            </button>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="mt-5">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">{t.s3Title}</h2>
          <div ref={areaRef} className="mt-4 space-y-3">
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating}
              className="w-full h-12 rounded-xl border border-border bg-card text-foreground font-semibold inline-flex items-center justify-center gap-2 hover:border-primary/50 transition disabled:opacity-70"
            >
              {locating ? (
                <>
                  <span className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  {t.locating}
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 text-primary" /> {t.useLocation}
                </>
              )}
            </button>

            {locationDenied && (
              <p className="text-sm text-muted-foreground">{t.locationDenied}</p>
            )}

            <div>
              <Label htmlFor="area" className="text-sm text-foreground">{t.s3Label}</Label>
              <select
                id="area"
                value={area}
                onChange={(e) => { setArea(e.target.value); setHint(null); setLocationDenied(false); if (e.target.value) trackFunnel("wizard_area_selected", { area: e.target.value, via: "select", massage: massage || null, source }); }}
                className="mt-1.5 w-full h-12 rounded-xl border border-border bg-card px-3 text-base text-foreground"
              >
                <option value="">{t.areaPlaceholder}</option>
                {areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            {area === t.other && (
              <Input
                value={areaOther}
                onChange={(e) => setAreaOther(e.target.value)}
                placeholder={t.otherPh}
                className="h-12 text-base"
              />
            )}
            <p className="text-sm text-muted-foreground">{t.s3Helper}</p>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="mt-5">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">{t.s4Title}</h2>
          <div className="mt-4 space-y-4">
            <div>
              {!peopleOpen ? (
                <button
                  type="button"
                  onClick={() => setPeopleOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t.peopleLink}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {PEOPLE_OPTIONS.map((n) => {
                    const active = people === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPeople(n)}
                        className={`h-9 min-w-[2.5rem] px-3 rounded-lg border text-sm font-medium transition ${
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <p className="w-full mt-1 text-xs text-muted-foreground">{t.peopleHelp}</p>
                </div>
              )}
            </div>
            <div ref={nameRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bf-first-name" className="text-sm text-foreground">{t.firstName}</Label>
                <Input id="bf-first-name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1.5 h-12 text-base" />
              </div>
              <div>
                <Label htmlFor="bf-last-name" className="text-sm text-foreground">{t.lastName}</Label>
                <Input id="bf-last-name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1.5 h-12 text-base" />
              </div>
            </div>
            <div ref={contactRef} className="space-y-4">
              <div>
                <Label htmlFor="bf-phone" className="text-sm text-foreground">{t.whatsapp}</Label>
                <Input
                  id="bf-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+34 600 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={contact.phoneValid === false}
                  className={`mt-1.5 h-12 text-base ${contact.phoneValid === false ? "border-2 border-destructive" : ""}`}
                />
                {contact.phoneValid === false && (
                  <p className="mt-1.5 text-sm text-destructive">{cc.badPhone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="bf-email" className="text-sm text-foreground">{t.email}</Label>
                <Input
                  id="bf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={contact.emailValid === false}
                  className={`mt-1.5 h-12 text-base ${contact.emailValid === false ? "border-2 border-destructive" : ""}`}
                />
                {contact.emailValid === false && (
                  <p className="mt-1.5 text-sm text-destructive">{cc.badEmail}</p>
                )}
              </div>
            </div>

          </div>
        </section>
      )}

      {hint && <p role="alert" className="mt-4 text-sm text-destructive">{hint}</p>}
      {status === "error" && (
        <p role="alert" className="mt-3 text-sm text-destructive">{t.sendError}</p>
      )}

      {step === 4 && <p className="mt-6 text-xs text-muted-foreground">{t.consent}</p>}

      <div className="mt-4" ref={continueWrapRef}>
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            className="w-full h-14 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-soft hover:opacity-90 transition inline-flex items-center justify-center gap-2"
          >
            {t.continue} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={submit}
              disabled={status === "loading" || !canSubmit}
              className="w-full h-14 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-soft hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? t.sending : t.submit}
            </button>
            {!canSubmit && (
              <p className="mt-2 text-center text-sm text-muted-foreground">{cc.needContact}</p>
            )}
          </>
        )}

      </div>

      {/* Sticky Continue: only appears once the inline one has scrolled away,
          so exactly one actionable Continue is visible at any scroll position. */}
      {!inlineContinueVisible && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto">
            {stickySummary && (
              <p className="mb-1.5 text-center text-xs font-semibold text-muted-foreground truncate">{stickySummary}</p>
            )}
            <button
              type="button"
              onClick={step < 4 ? goNext : submit}
              disabled={step === 4 && (status === "loading" || !canSubmit)}
              className="w-full h-13 min-h-[52px] rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-soft hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {step < 4 ? (
                <>{t.continue} <ArrowRight className="h-4 w-4" /></>
              ) : status === "loading" ? t.sending : t.submit}
            </button>
          </div>
        </div>
      )}

      {step >= 2 && (
        <ExitCaptureBlock
          source="wizard-exit"
          step={step}
          want={massage || null}
          area={area ? (area === t.other ? areaOther || null : area) : null}
          className="mt-8"
        />
      )}
    </div>
  );
}
