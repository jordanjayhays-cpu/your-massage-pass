import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { supabase, fetchStudioProfile, type StudioProfile } from "@/lib/supabase";
import { studioImage, studioImageFallback } from "@/lib/studioImages";
import { resolveWhatsappNumber, telHref, conciergeWhatsappUrl, conciergePrefill } from "@/app/lib/whatsapp";
import WhatsAppAskButton from "@/components/WhatsAppAskButton";
import MassageTypeInfoButton from "@/app/components/MassageTypeInfo";
import StudioReviews from "@/app/components/StudioReviews";
import { haversineKm, distanceLabel, walkingDirectionsUrl, type LatLng } from "@/lib/distance";
import { useLocationAsk, savedLocationResult, originSuffix } from "@/lib/locationConsent";
import { sendTrack, trackEvent } from "@/lib/siteVisit";
import { trackFunnel } from "@/lib/funnel";
import { logWhatsappRequest, logWhatsappRequestResult } from "@/lib/whatsappLog";
import { setWaBubbleContext, clearWaBubbleContext } from "@/app/components/WhatsAppBubble";
import { clarityEvent } from "@/lib/clarity";
import { requestAccountSignup } from "@/lib/accountSignup";
import { contactOk, CONTACT_COPY } from "@/lib/contactValidation";
import { useFlowLang, pickCopy, type FlowLang } from "@/lib/flowLang";
import { shortWeekday, longWeekday, shortDate, longDate, timeLabel, formatPrice, formatMinutes, parseISODate, localeOf } from "@/lib/localeFormat";
import { localizedServiceName } from "@/lib/serviceTypeI18n";

import { captureSource, getSource } from "@/lib/attribution";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import AccountHeaderLink from "@/components/AccountHeaderLink";
import AccountOfferBlock from "@/components/AccountOfferBlock";
import { BookAgainBanner } from "@/app/components/BookAgain";
import { tagLabel } from "@/lib/tagLabel";
import { isInstantConfirm } from "@/lib/instantConfirm";
import { markStudioVisited } from "@/lib/visitedStudios";
import AbandonedBookingSheet, { useAbandonedBookingCapture } from "@/app/components/AbandonedBookingSheet";
import MarketingOptInCard from "@/app/components/MarketingOptInCard";
import { DealsConfirmationLine } from "@/components/DealsLink";
import ExitCaptureBlock from "@/components/ExitCaptureBlock";
import HowBookingWorksVideo from "@/components/HowBookingWorksVideo";
import StudioGallery from "@/app/components/StudioGallery";



import { servicePrimaryName, serviceSecondaryName, serviceNameForStudio, serviceInlineLabel } from "@/lib/serviceName";
import {
  SPOKEN_LANGS, SPOKEN_LANG_NATIVE, SPOKEN_LANG_FLAG,
  loadSpokenLangs, saveSpokenLangs, normalizeSpokenLangs,
  spanishLanguageOffer, speaksSpanish, isSpokenLang,
  type SpokenLang,
} from "@/lib/spokenLanguages";
import {
  MapPin, Clock, Euro, Check, Loader2, Star, Sparkles,
  Phone, Instagram, MessageCircle, CalendarDays
} from "lucide-react";

// Canonical (English) keys kept for storage/logic; display labels are localized below.
const PRESSURE_LEVELS = ["Light", "Medium", "Firm", "Deep"];
const FOCUS_AREAS = ["Neck", "Shoulders", "Upper Back", "Lower Back", "Legs", "Feet", "Arms", "Hands"];
const PEOPLE_OPTIONS = ["2", "3", "4", "5+"];

// Fixed options for the unclaimed-studio handoff, where real availability is unknown.
const HANDOFF_TIMES = Array.from({ length: 11 }, (_, i) => `${String(10 + i).padStart(2, "0")}:00`);

const PRESSURE_LABEL_COPY: Record<FlowLang, Record<string, string>> = {
  en: { Light: "Light", Medium: "Medium", Firm: "Firm", Deep: "Deep" },
  es: { Light: "Suave", Medium: "Media", Firm: "Firme", Deep: "Profunda" },
  fr: { Light: "Légère", Medium: "Moyenne", Firm: "Ferme", Deep: "Profonde" },
  de: { Light: "Leicht", Medium: "Mittel", Firm: "Fest", Deep: "Tief" },
  it: { Light: "Leggera", Medium: "Media", Firm: "Decisa", Deep: "Profonda" },
  pt: { Light: "Leve", Medium: "Média", Firm: "Firme", Deep: "Profunda" },
  zh: { Light: "轻柔", Medium: "适中", Firm: "有力", Deep: "深层" },
};

const FOCUS_AREA_LABEL_COPY: Record<FlowLang, Record<string, string>> = {
  en: { Neck: "Neck", Shoulders: "Shoulders", "Upper Back": "Upper back", "Lower Back": "Lower back", Legs: "Legs", Feet: "Feet", Arms: "Arms", Hands: "Hands" },
  es: { Neck: "Cuello", Shoulders: "Hombros", "Upper Back": "Espalda alta", "Lower Back": "Espalda baja", Legs: "Piernas", Feet: "Pies", Arms: "Brazos", Hands: "Manos" },
  fr: { Neck: "Nuque", Shoulders: "Épaules", "Upper Back": "Haut du dos", "Lower Back": "Bas du dos", Legs: "Jambes", Feet: "Pieds", Arms: "Bras", Hands: "Mains" },
  de: { Neck: "Nacken", Shoulders: "Schultern", "Upper Back": "Oberer Rücken", "Lower Back": "Unterer Rücken", Legs: "Beine", Feet: "Füße", Arms: "Arme", Hands: "Hände" },
  it: { Neck: "Collo", Shoulders: "Spalle", "Upper Back": "Schiena alta", "Lower Back": "Schiena bassa", Legs: "Gambe", Feet: "Piedi", Arms: "Braccia", Hands: "Mani" },
  pt: { Neck: "Pescoço", Shoulders: "Ombros", "Upper Back": "Costas superiores", "Lower Back": "Costas inferiores", Legs: "Pernas", Feet: "Pés", Arms: "Braços", Hands: "Mãos" },
  zh: { Neck: "颈部", Shoulders: "肩部", "Upper Back": "上背部", "Lower Back": "下背部", Legs: "腿部", Feet: "脚部", Arms: "手臂", Hands: "手部" },
};

// Wizard steps, shown in the header on every screen.
const BOOKING_STEPS_COPY: Record<FlowLang, string[]> = {
  en: ["Service", "Day and time", "Customize", "Your details", "Confirm"],
  es: ["Servicio", "Día y hora", "Personaliza", "Tus datos", "Confirmar"],
  fr: ["Service", "Jour et heure", "Personnaliser", "Vos infos", "Confirmer"],
  de: ["Leistung", "Tag und Uhrzeit", "Anpassen", "Deine Daten", "Bestätigen"],
  it: ["Servizio", "Giorno e ora", "Personalizza", "I tuoi dati", "Conferma"],
  pt: ["Serviço", "Dia e hora", "Personalizar", "Os teus dados", "Confirmar"],
  zh: ["服务", "日期和时间", "个性化", "您的信息", "确认"],
};
const BOOKING_STEPS_ARIA: Record<FlowLang, string> = {
  en: "Booking steps", es: "Pasos de la reserva", fr: "Étapes de réservation", de: "Buchungsschritte",
  it: "Passaggi della prenotazione", pt: "Etapas da reserva", zh: "预订步骤",
};
const HANDOFF_STEPS_COPY: Record<FlowLang, string[]> = {
  en: ["Service", "Day and time", "Your details", "WhatsApp"],
  es: ["Servicio", "Día y hora", "Tus datos", "WhatsApp"],
  fr: ["Service", "Jour et heure", "Vos infos", "WhatsApp"],
  de: ["Leistung", "Tag und Uhrzeit", "Deine Daten", "WhatsApp"],
  it: ["Servizio", "Giorno e ora", "I tuoi dati", "WhatsApp"],
  pt: ["Serviço", "Dia e hora", "Os teus dados", "WhatsApp"],
  zh: ["服务", "日期和时间", "您的信息", "WhatsApp"],
};
const CONVERSATION_LABEL_COPY: Record<FlowLang, Record<string, string>> = {
  en: { silence: "Silence", minimal: "A little chat", chatty: "Happy to chat" },
  es: { silence: "Silencio", minimal: "Charla ligera", chatty: "Me gusta hablar" },
  fr: { silence: "Silence", minimal: "Un peu de conversation", chatty: "J'aime discuter" },
  de: { silence: "Stille", minimal: "Etwas Small Talk", chatty: "Ich rede gerne" },
  it: { silence: "Silenzio", minimal: "Un po' di chiacchiere", chatty: "Mi piace parlare" },
  pt: { silence: "Silêncio", minimal: "Uma conversa leve", chatty: "Gosto de conversar" },
  zh: { silence: "安静", minimal: "简单聊聊", chatty: "喜欢聊天" },
};

const PAGE_COPY: Record<FlowLang, Record<string, string>> = {
  en: {
    showDistance: "Show distance", directions: "Directions",
    yourAppointmentAt: "Your appointment at", checkingWithStudio: "We are checking with the studio now",
    bookingDone: "You're booked!", waitTime: "You will hear from us within 30 minutes with your confirmed time. If they cannot fit you, we will send you other studios nearby.",
    addToCalendar: "Add to my calendar", waSetItUp: "WhatsApp us and we set it up", visitWebsite: "Visit their website",
    timeConfirmedPay: "Your time is confirmed. You pay at the studio, no card needed.",
    studioConfirmsPay: "The studio usually confirms within a few hours and you will get an email. You pay at the studio, no card needed.",
    almostDone: "Almost done. WhatsApp us and we set it up.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "This studio isn't on Massage Club yet. We can still set up your booking for you.",
    howWeBook: "This is how we book it for you",
    bookMassage: "Book a massage", pickServiceFirst: "Pick a service below first",
    servicesLabel: "Services", takeQuiz: "Not sure which massage? Take the 60 second quiz",
    chooseServiceContinue: "Choose a service to continue", continueLabel: "Continue",
    contactStep: "This studio isn't on Massage Club yet, so we'll contact them for you. Pick 2-3 times that could work - the more you give us, the faster we confirm.",
    addSecondChoice: "+ Add a second choice", addThirdChoice: "+ Add a third choice", thirdChoice: "Third choice",
    moreThanOne: "Booking for more than one person?", groupCheck: "We will check the studio can take your group at the same time.",
    firstName: "First name", lastName: "Last name", waPhone: "WhatsApp / Phone (+34 600 123 456)", email: "Email",
    anythingElse: "Anything else we should know?", optional: "Optional",
    needContact: "Add your name and a way to reach you",
    reachYouWa: "So we can confirm your time on WhatsApp.",
    service: "Service", day: "Day", secondChoice: "Second choice", name: "Name", contact: "Contact", price: "Price",
    pickAService: "Pick a service", anyDay: "Any day", anyTime: "Any time", none: "None", notProvided: "Not provided", time: "Time",
    askStudio: "Ask the studio", requestWhatsapp: "Request via WhatsApp", pickAMassage: "Pick a massage",
    back: "Back", waReassuranceStudios: "Studios already on Massage Club confirm instantly.", browseOtherStudios: "Browse other studios",
    callStudioLabel: "Call the studio",
    chooseService: "Choose a service", pickDayTime: "Pick a day and time", customizeSession: "Customize your session",
    yourDetails: "Your details", reviewConfirm: "Review and confirm",
    noServicesYet: "No services listed yet.", yourUsualBooking: "Your usual booking", change: "Change",
    notSureQuiz: "Not sure which massage? Take the 60 second quiz",
    hoursNotPublished: "This studio has not published its hours yet. Ask on WhatsApp and we will arrange it.",
    timesLabel: "Times", fullyBooked: "Fully booked that day. Try another date.", left: "left",
    addAnotherTime: "+ Add another time (recommended)",
    optionalHelps: "Optional, but it helps your therapist get it right.",
    prefilledProfile: "Prefilled from your profile", startBlank: "Start blank",
    pickMassageFirst: "Pick a massage first to choose these options.", chooseMassage: "Choose a massage",
    comfort: "Comfort", pressure: "Pressure", focusAreas: "Focus areas", makeItYours: "Make it yours",
    extrasNote: "Extras this studio offers. Added to your total.", notesForTherapist: "Notes for your therapist",
    notesPlaceholder: "Anything we should know? Injuries, allergies, preferences.",
    giveContact: "Give us an email or a WhatsApp number so we can reach you.",
    createAccount: "Create my free Massage Club account",
    createAccountSub: "Track your booking and rebook faster. We'll email you a one-tap sign-in link, no password.",
    notSet: "Not set", addOns: "Add-ons", notes: "Notes", addYourName: "Add your name", addContact: "Add a contact",
    firstMassage: "First massage? Draping is always used, you choose the pressure, and you can stop anytime.",
    readFirstTimer: "Read the first-timer guide",
    confirmedRightAway: "Your time is confirmed right away. You pay at the studio.",
    studioConfirms: "The studio confirms your time. You pay at the studio.",
    yourBooking: "Your booking", call: "Call", poweredBy: "Powered by Massage Club",
    forStudios: "For studios", privacy: "Privacy Policy", terms: "Terms",
    bookNow: "Book now", requestBooking: "Request booking", instantConfirmation: "Instant confirmation",
    freeToBook: "Free to book · Pay at the studio · No card needed",
    booking: "Booking", skipStep: "Skip this step",
    addNameContact: "Add your first and last name so the studio knows who is coming",
    slotFilled: "That time just filled up, pick another",
    somethingWrong: "Something went wrong. Please try again.",
    bookYourMassage: "Book your massage",
    pickService: "Pick a service", pickDay: "Pick a day", pickTime: "Pick a time", priceLabel: "Price",
    moreTimesFaster: "The more times you give us, the faster we confirm.",
  },
  es: {
    showDistance: "Ver distancia", directions: "Cómo llegar",
    yourAppointmentAt: "Tu cita en", checkingWithStudio: "Estamos confirmando con el centro",
    bookingDone: "¡Tu reserva está hecha! 🎉", waitTime: "Te escribimos en menos de 30 minutos con tu hora confirmada. Si no pueden, te mandamos otros centros cerca.",
    addToCalendar: "Añadir a mi calendario", waSetItUp: "Escríbenos por WhatsApp y te lo organizamos", visitWebsite: "Ver su web",
    timeConfirmedPay: "Tu hora está confirmada. Pagas en el estudio, sin tarjeta.",
    studioConfirmsPay: "El estudio suele confirmar en unas horas y te avisamos por email. Pagas en el estudio, sin tarjeta.",
    almostDone: "Casi listo. Escríbenos por WhatsApp y te lo organizamos.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Este estudio todavía no está en Massage Club. Aun así te organizamos la reserva.",
    howWeBook: "Así te lo reservamos",
    bookMassage: "Reserva un masaje", pickServiceFirst: "Elige antes un servicio",
    servicesLabel: "Servicios", takeQuiz: "¿No sabes cuál elegir? Haz el test",
    chooseServiceContinue: "Elige un servicio para continuar", continueLabel: "Continuar",
    contactStep: "Este centro todavía no está en Massage Club, así que contactamos con ellos por ti. Elige 2-3 horas que te vengan bien - cuantas más nos des, antes te confirmamos.",
    addSecondChoice: "+ Añadir una segunda opción", addThirdChoice: "+ Añadir una tercera opción", thirdChoice: "Tercera opción",
    moreThanOne: "¿Reservas para más de una persona?", groupCheck: "Confirmamos con el centro que pueden atender a todo el grupo a la vez.",
    firstName: "Nombre", lastName: "Apellido", waPhone: "WhatsApp / Teléfono (+34 600 123 456)", email: "Email",
    anythingElse: "¿Algo más que debamos saber?", optional: "Opcional",
    needContact: "Añade tu nombre y una forma de contacto",
    reachYouWa: "Para confirmarte la hora por WhatsApp.",
    service: "Servicio", day: "Día", secondChoice: "Segunda opción", name: "Nombre", contact: "Contacto", price: "Precio",
    pickAService: "Elige un servicio", anyDay: "Cualquier día", anyTime: "Cualquier hora", none: "Ninguno", notProvided: "No indicado", time: "Hora",
    askStudio: "Pregunta al estudio", requestWhatsapp: "Solicitar por WhatsApp", pickAMassage: "Elige un masaje",
    back: "Atrás", waReassuranceStudios: "Los estudios que ya están en Massage Club confirman al instante.", browseOtherStudios: "Ver otros estudios",
    callStudioLabel: "Llamar al estudio",
    chooseService: "Elige un servicio", pickDayTime: "Elige día y hora", customizeSession: "Personaliza tu sesión",
    yourDetails: "Tus datos", reviewConfirm: "Revisa y confirma",
    noServicesYet: "Todavía no hay servicios publicados.", yourUsualBooking: "Tu reserva habitual", change: "Cambiar",
    notSureQuiz: "¿No sabes cuál elegir? Haz el test",
    hoursNotPublished: "Este estudio todavía no ha publicado horarios. Pídelo por WhatsApp y lo organizamos.",
    timesLabel: "Horas", fullyBooked: "Ese día está completo. Prueba otra fecha.", left: "quedan",
    addAnotherTime: "+ Añadir otra hora (recomendado)",
    optionalHelps: "Opcional, pero ayuda a tu terapeuta a hacerlo bien.",
    prefilledProfile: "Rellenado con tu perfil", startBlank: "Empezar de cero",
    pickMassageFirst: "Elige antes un masaje para usar estas opciones.", chooseMassage: "Elegir masaje",
    comfort: "Confort", pressure: "Presión", focusAreas: "Zonas", makeItYours: "Hazlo tuyo",
    extrasNote: "Extras que ofrece este estudio. Se añaden a tu total.", notesForTherapist: "Notas para tu terapeuta",
    notesPlaceholder: "¿Algo que debamos saber? Lesiones, alergias, preferencias.",
    giveContact: "Déjanos un email o un WhatsApp para poder contactarte.",
    createAccount: "Crear mi cuenta gratis de Massage Club",
    createAccountSub: "Sigue tu reserva y repite más rápido. Te enviamos un enlace de acceso de un toque, sin contraseña.",
    notSet: "Sin definir", addOns: "Extras", notes: "Notas", addYourName: "Añade tu nombre", addContact: "Añade un contacto",
    firstMassage: "¿Primer masaje? Siempre se usa toalla, tú eliges la presión y puedes parar cuando quieras.",
    readFirstTimer: "Lee la guía para principiantes",
    confirmedRightAway: "Tu hora se confirma al instante. Pagas en el estudio.",
    studioConfirms: "El estudio confirma tu hora. Pagas en el estudio.",
    yourBooking: "Tu reserva", call: "Llamar", poweredBy: "Con la tecnología de Massage Club",
    forStudios: "Para estudios", privacy: "Política de Privacidad", terms: "Términos",
    bookNow: "Reservar ahora", requestBooking: "Solicitar reserva", instantConfirmation: "Confirmación al instante",
    freeToBook: "Reserva gratis · Paga en el estudio · Sin tarjeta",
    booking: "Reservando", skipStep: "Saltar",
    addNameContact: "Añade tu nombre y apellido para que el estudio sepa quién viene",
    slotFilled: "Esa hora se acaba de llenar, elige otra",
    somethingWrong: "Algo ha ido mal. Inténtalo de nuevo.",
    bookYourMassage: "Reserva tu masaje",
    pickService: "Elige un servicio", pickDay: "Elige un día", pickTime: "Elige una hora", priceLabel: "Precio",
    moreTimesFaster: "Cuantas más horas nos des, antes te confirmamos.",
  },
  fr: {
    showDistance: "Voir la distance", directions: "Itinéraire",
    yourAppointmentAt: "Votre rendez-vous à", checkingWithStudio: "Nous vérifions avec le centre",
    bookingDone: "Votre réservation est faite ! 🎉", waitTime: "Nous vous répondrons en moins de 30 minutes avec votre heure confirmée. S'ils ne peuvent pas, nous vous envoyons d'autres centres à proximité.",
    addToCalendar: "Ajouter à mon calendrier", waSetItUp: "Écrivez-nous sur WhatsApp et on s'occupe de tout", visitWebsite: "Voir leur site",
    timeConfirmedPay: "Votre heure est confirmée. Vous payez sur place, sans carte.",
    studioConfirmsPay: "Le centre confirme généralement en quelques heures et vous recevrez un email. Vous payez sur place, sans carte.",
    almostDone: "Presque fini. Écrivez-nous sur WhatsApp et on s'occupe de tout.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Ce centre n'est pas encore sur Massage Club. On peut tout de même organiser votre réservation.",
    howWeBook: "Voici comment on réserve pour vous",
    bookMassage: "Réserver un massage", pickServiceFirst: "Choisissez d'abord un service",
    servicesLabel: "Services", takeQuiz: "Vous ne savez pas quel massage choisir ? Faites le test de 60 secondes",
    chooseServiceContinue: "Choisissez un service pour continuer", continueLabel: "Continuer",
    contactStep: "Ce centre n'est pas encore sur Massage Club, donc on les contacte pour vous. Choisissez 2-3 horaires possibles - plus vous nous en donnez, plus vite on confirme.",
    addSecondChoice: "+ Ajouter un second choix", addThirdChoice: "+ Ajouter un troisième choix", thirdChoice: "Troisième choix",
    moreThanOne: "Vous réservez pour plusieurs personnes ?", groupCheck: "Nous vérifions que le centre peut recevoir tout le groupe en même temps.",
    firstName: "Prénom", lastName: "Nom", waPhone: "WhatsApp / Téléphone (+34 600 123 456)", email: "Email",
    anythingElse: "Autre chose à savoir ?", optional: "Facultatif",
    needContact: "Ajoutez votre nom et un moyen de vous contacter",
    reachYouWa: "Pour vous confirmer l'heure sur WhatsApp.",
    service: "Service", day: "Jour", secondChoice: "Second choix", name: "Nom", contact: "Contact", price: "Prix",
    pickAService: "Choisissez un service", anyDay: "N'importe quel jour", anyTime: "N'importe quelle heure", none: "Aucun", notProvided: "Non fourni", time: "Heure",
    askStudio: "Demander au centre", requestWhatsapp: "Demander via WhatsApp", pickAMassage: "Choisir un massage",
    back: "Retour", waReassuranceStudios: "Les centres déjà sur Massage Club confirment instantanément.", browseOtherStudios: "Voir d'autres centres",
    callStudioLabel: "Appeler le centre",
    chooseService: "Choisir un service", pickDayTime: "Choisir un jour et une heure", customizeSession: "Personnalisez votre séance",
    yourDetails: "Vos informations", reviewConfirm: "Vérifiez et confirmez",
    noServicesYet: "Aucun service listé pour le moment.", yourUsualBooking: "Votre réservation habituelle", change: "Modifier",
    notSureQuiz: "Vous ne savez pas quel massage choisir ? Faites le test de 60 secondes",
    hoursNotPublished: "Ce centre n'a pas encore publié ses horaires. Demandez sur WhatsApp et on s'en occupe.",
    timesLabel: "Horaires", fullyBooked: "Complet ce jour-là. Essayez une autre date.", left: "restant(s)",
    addAnotherTime: "+ Ajouter un autre horaire (recommandé)",
    optionalHelps: "Facultatif, mais ça aide votre thérapeute à bien faire.",
    prefilledProfile: "Pré-rempli depuis votre profil", startBlank: "Recommencer à zéro",
    pickMassageFirst: "Choisissez d'abord un massage pour utiliser ces options.", chooseMassage: "Choisir un massage",
    comfort: "Confort", pressure: "Pression", focusAreas: "Zones à cibler", makeItYours: "Personnalisez",
    extrasNote: "Extras proposés par ce centre. Ajoutés à votre total.", notesForTherapist: "Notes pour votre thérapeute",
    notesPlaceholder: "Quelque chose à savoir ? Blessures, allergies, préférences.",
    giveContact: "Laissez-nous un email ou un numéro WhatsApp pour vous contacter.",
    createAccount: "Créer mon compte gratuit Massage Club",
    createAccountSub: "Suivez votre réservation et réservez plus vite. On vous envoie un lien de connexion en un clic, sans mot de passe.",
    notSet: "Non défini", addOns: "Extras", notes: "Notes", addYourName: "Ajoutez votre nom", addContact: "Ajoutez un contact",
    firstMassage: "Premier massage ? Une serviette est toujours utilisée, vous choisissez la pression, et vous pouvez arrêter à tout moment.",
    readFirstTimer: "Lire le guide pour débutants",
    confirmedRightAway: "Votre heure est confirmée immédiatement. Vous payez sur place.",
    studioConfirms: "Le centre confirme votre heure. Vous payez sur place.",
    yourBooking: "Votre réservation", call: "Appeler", poweredBy: "Propulsé par Massage Club",
    forStudios: "Pour les centres", privacy: "Politique de confidentialité", terms: "Conditions",
    bookNow: "Réserver maintenant", requestBooking: "Demander une réservation", instantConfirmation: "Confirmation instantanée",
    freeToBook: "Réservation gratuite · Paiement sur place · Sans carte",
    booking: "Réservation en cours", skipStep: "Passer cette étape",
    addNameContact: "Ajoutez votre prénom et votre nom pour que le centre sache qui vient",
    slotFilled: "Cet horaire vient d'être pris, choisissez-en un autre",
    somethingWrong: "Une erreur est survenue. Veuillez réessayer.",
    bookYourMassage: "Réservez votre massage",
    pickService: "Choisissez un service", pickDay: "Choisissez un jour", pickTime: "Choisissez une heure", priceLabel: "Prix",
    moreTimesFaster: "Plus vous nous donnez d'horaires, plus vite on confirme.",
  },
  de: {
    showDistance: "Entfernung anzeigen", directions: "Wegbeschreibung",
    yourAppointmentAt: "Dein Termin bei", checkingWithStudio: "Wir prüfen das gerade mit dem Studio",
    bookingDone: "Deine Buchung ist fertig! 🎉", waitTime: "Wir melden uns innerhalb von 30 Minuten mit deiner bestätigten Zeit. Falls es nicht passt, schicken wir dir andere Studios in der Nähe.",
    addToCalendar: "Zu meinem Kalender hinzufügen", waSetItUp: "Schreib uns auf WhatsApp, wir kümmern uns darum", visitWebsite: "Website besuchen",
    timeConfirmedPay: "Deine Zeit ist bestätigt. Du zahlst im Studio, keine Karte nötig.",
    studioConfirmsPay: "Das Studio bestätigt normalerweise innerhalb einiger Stunden und du bekommst eine E-Mail. Du zahlst im Studio, keine Karte nötig.",
    almostDone: "Fast fertig. Schreib uns auf WhatsApp, wir kümmern uns darum.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Dieses Studio ist noch nicht bei Massage Club. Wir organisieren deine Buchung trotzdem.",
    howWeBook: "So buchen wir das für dich",
    bookMassage: "Massage buchen", pickServiceFirst: "Wähle zuerst einen Service",
    servicesLabel: "Leistungen", takeQuiz: "Nicht sicher, welche Massage? Mach den 60-Sekunden-Test",
    chooseServiceContinue: "Wähle einen Service, um fortzufahren", continueLabel: "Weiter",
    contactStep: "Dieses Studio ist noch nicht bei Massage Club, deshalb kontaktieren wir es für dich. Wähle 2-3 Zeiten, die passen könnten - je mehr du uns gibst, desto schneller bestätigen wir.",
    addSecondChoice: "+ Zweite Wahl hinzufügen", addThirdChoice: "+ Dritte Wahl hinzufügen", thirdChoice: "Dritte Wahl",
    moreThanOne: "Buchst du für mehr als eine Person?", groupCheck: "Wir prüfen, ob das Studio deine Gruppe zur gleichen Zeit aufnehmen kann.",
    firstName: "Vorname", lastName: "Nachname", waPhone: "WhatsApp / Telefon (+34 600 123 456)", email: "E-Mail",
    anythingElse: "Sollten wir noch etwas wissen?", optional: "Optional",
    needContact: "Füge deinen Namen und eine Kontaktmöglichkeit hinzu",
    reachYouWa: "Damit wir deine Zeit per WhatsApp bestätigen können.",
    service: "Service", day: "Tag", secondChoice: "Zweite Wahl", name: "Name", contact: "Kontakt", price: "Preis",
    pickAService: "Service wählen", anyDay: "Egal welcher Tag", anyTime: "Egal welche Zeit", none: "Keine", notProvided: "Nicht angegeben", time: "Uhrzeit",
    askStudio: "Beim Studio nachfragen", requestWhatsapp: "Über WhatsApp anfragen", pickAMassage: "Massage wählen",
    back: "Zurück", waReassuranceStudios: "Studios, die schon bei Massage Club sind, bestätigen sofort.", browseOtherStudios: "Andere Studios ansehen",
    callStudioLabel: "Studio anrufen",
    chooseService: "Service wählen", pickDayTime: "Tag und Uhrzeit wählen", customizeSession: "Passe deine Sitzung an",
    yourDetails: "Deine Daten", reviewConfirm: "Überprüfen und bestätigen",
    noServicesYet: "Noch keine Leistungen gelistet.", yourUsualBooking: "Deine übliche Buchung", change: "Ändern",
    notSureQuiz: "Nicht sicher, welche Massage? Mach den 60-Sekunden-Test",
    hoursNotPublished: "Dieses Studio hat seine Öffnungszeiten noch nicht veröffentlicht. Frag auf WhatsApp, wir organisieren es.",
    timesLabel: "Zeiten", fullyBooked: "An diesem Tag ausgebucht. Versuch ein anderes Datum.", left: "übrig",
    addAnotherTime: "+ Weitere Zeit hinzufügen (empfohlen)",
    optionalHelps: "Optional, aber es hilft deinem Therapeuten, es richtig zu machen.",
    prefilledProfile: "Aus deinem Profil vorausgefüllt", startBlank: "Neu anfangen",
    pickMassageFirst: "Wähle zuerst eine Massage, um diese Optionen zu nutzen.", chooseMassage: "Massage wählen",
    comfort: "Komfort", pressure: "Druck", focusAreas: "Problemzonen", makeItYours: "Mach es dir passend",
    extrasNote: "Extras, die dieses Studio anbietet. Werden zu deinem Total addiert.", notesForTherapist: "Notizen für deinen Therapeuten",
    notesPlaceholder: "Sollten wir etwas wissen? Verletzungen, Allergien, Vorlieben.",
    giveContact: "Gib uns eine E-Mail oder eine WhatsApp-Nummer, damit wir dich erreichen können.",
    createAccount: "Mein kostenloses Massage-Club-Konto erstellen",
    createAccountSub: "Verfolge deine Buchung und buche schneller erneut. Wir schicken dir einen Ein-Klick-Login-Link, ohne Passwort.",
    notSet: "Nicht festgelegt", addOns: "Extras", notes: "Notizen", addYourName: "Füge deinen Namen hinzu", addContact: "Füge einen Kontakt hinzu",
    firstMassage: "Erste Massage? Es wird immer ein Handtuch verwendet, du wählst den Druck, und du kannst jederzeit aufhören.",
    readFirstTimer: "Leitfaden für Erstbesucher lesen",
    confirmedRightAway: "Deine Zeit wird sofort bestätigt. Du zahlst im Studio.",
    studioConfirms: "Das Studio bestätigt deine Zeit. Du zahlst im Studio.",
    yourBooking: "Deine Buchung", call: "Anrufen", poweredBy: "Unterstützt von Massage Club",
    forStudios: "Für Studios", privacy: "Datenschutz", terms: "AGB",
    bookNow: "Jetzt buchen", requestBooking: "Buchung anfragen", instantConfirmation: "Sofortige Bestätigung",
    freeToBook: "Kostenlos buchen · Zahlung im Studio · Keine Karte nötig",
    booking: "Wird gebucht", skipStep: "Diesen Schritt überspringen",
    addNameContact: "Füge deinen Vor- und Nachnamen hinzu, damit das Studio weiß, wer kommt",
    slotFilled: "Diese Zeit ist gerade vergeben worden, wähle eine andere",
    somethingWrong: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    bookYourMassage: "Buche deine Massage",
    pickService: "Service wählen", pickDay: "Tag wählen", pickTime: "Zeit wählen", priceLabel: "Preis",
    moreTimesFaster: "Je mehr Zeiten du uns gibst, desto schneller bestätigen wir.",
  },
  it: {
    showDistance: "Mostra distanza", directions: "Indicazioni",
    yourAppointmentAt: "Il tuo appuntamento da", checkingWithStudio: "Stiamo verificando con il centro",
    bookingDone: "La tua prenotazione è fatta! 🎉", waitTime: "Ti risponderemo entro 30 minuti con l'orario confermato. Se non possono, ti mandiamo altri centri vicini.",
    addToCalendar: "Aggiungi al mio calendario", waSetItUp: "Scrivici su WhatsApp e ci pensiamo noi", visitWebsite: "Visita il loro sito",
    timeConfirmedPay: "Il tuo orario è confermato. Paghi al centro, senza carta.",
    studioConfirmsPay: "Il centro di solito confirma in poche ore e riceverai un'email. Paghi al centro, senza carta.",
    almostDone: "Quasi fatto. Scrivici su WhatsApp e ci pensiamo noi.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Questo centro non è ancora su Massage Club. Possiamo comunque organizzare la tua prenotazione.",
    howWeBook: "Ecco come prenotiamo per te",
    bookMassage: "Prenota un massaggio", pickServiceFirst: "Scegli prima un servizio",
    servicesLabel: "Servizi", takeQuiz: "Non sai quale massaggio scegliere? Fai il test di 60 secondi",
    chooseServiceContinue: "Scegli un servizio per continuare", continueLabel: "Continua",
    contactStep: "Questo centro non è ancora su Massage Club, quindi lo contattiamo noi per te. Scegli 2-3 orari possibili - più ce ne dai, più velocemente confermiamo.",
    addSecondChoice: "+ Aggiungi una seconda scelta", addThirdChoice: "+ Aggiungi una terza scelta", thirdChoice: "Terza scelta",
    moreThanOne: "Prenoti per più di una persona?", groupCheck: "Verifichiamo che il centro possa accogliere tutto il gruppo insieme.",
    firstName: "Nome", lastName: "Cognome", waPhone: "WhatsApp / Telefono (+34 600 123 456)", email: "Email",
    anythingElse: "C'è altro che dovremmo sapere?", optional: "Facoltativo",
    needContact: "Aggiungi il tuo nome e un modo per contattarti",
    reachYouWa: "Per confermarti l'orario su WhatsApp.",
    service: "Servizio", day: "Giorno", secondChoice: "Seconda scelta", name: "Nome", contact: "Contatto", price: "Prezzo",
    pickAService: "Scegli un servizio", anyDay: "Qualsiasi giorno", anyTime: "Qualsiasi orario", none: "Nessuno", notProvided: "Non fornito", time: "Ora",
    askStudio: "Chiedi al centro", requestWhatsapp: "Richiedi via WhatsApp", pickAMassage: "Scegli un massaggio",
    back: "Indietro", waReassuranceStudios: "I centri già su Massage Club confermano all'istante.", browseOtherStudios: "Guarda altri centri",
    callStudioLabel: "Chiama il centro",
    chooseService: "Scegli un servizio", pickDayTime: "Scegli giorno e ora", customizeSession: "Personalizza la tua sessione",
    yourDetails: "I tuoi dati", reviewConfirm: "Rivedi e confirma",
    noServicesYet: "Nessun servizio ancora elencato.", yourUsualBooking: "La tua prenotazione abituale", change: "Cambia",
    notSureQuiz: "Non sai quale massaggio scegliere? Fai il test di 60 secondi",
    hoursNotPublished: "Questo centro non ha ancora pubblicato gli orari. Chiedi su WhatsApp e lo organizziamo.",
    timesLabel: "Orari", fullyBooked: "Completo quel giorno. Prova un'altra data.", left: "rimasti",
    addAnotherTime: "+ Aggiungi un altro orario (consigliato)",
    optionalHelps: "Facoltativo, ma aiuta il tuo terapeuta a fare le cose per bene.",
    prefilledProfile: "Precompilato dal tuo profilo", startBlank: "Ricomincia da zero",
    pickMassageFirst: "Scegli prima un massaggio per usare queste opzioni.", chooseMassage: "Scegli un massaggio",
    comfort: "Comfort", pressure: "Pressione", focusAreas: "Zone da trattare", makeItYours: "Personalizzalo",
    extrasNote: "Extra offerti da questo centro. Si aggiungono al tuo totale.", notesForTherapist: "Note per il tuo terapeuta",
    notesPlaceholder: "C'è qualcosa che dovremmo sapere? Lesioni, allergie, preferenze.",
    giveContact: "Lasciaci un'email o un numero WhatsApp per poterti contattare.",
    createAccount: "Crea il mio account gratuito Massage Club",
    createAccountSub: "Segui la tua prenotazione e prenota di nuovo più velocemente. Ti mandiamo un link di accesso con un tocco, senza password.",
    notSet: "Non impostato", addOns: "Extra", notes: "Note", addYourName: "Aggiungi il tuo nome", addContact: "Aggiungi un contatto",
    firstMassage: "Primo massaggio? Si usa sempre un telo, scegli tu la pressione e puoi fermarti quando vuoi.",
    readFirstTimer: "Leggi la guida per principianti",
    confirmedRightAway: "Il tuo orario è confermato subito. Paghi al centro.",
    studioConfirms: "Il centro confirma il tuo orario. Paghi al centro.",
    yourBooking: "La tua prenotazione", call: "Chiama", poweredBy: "Offerto da Massage Club",
    forStudios: "Per i centri", privacy: "Informativa sulla privacy", terms: "Termini",
    bookNow: "Prenota ora", requestBooking: "Richiedi prenotazione", instantConfirmation: "Confirma immediata",
    freeToBook: "Prenotazione gratuita · Pagamento al centro · Senza carta",
    booking: "Prenotazione in corso", skipStep: "Salta questo passaggio",
    addNameContact: "Aggiungi nome e cognome così il centro sa chi arriva",
    slotFilled: "Quell'orario si è appena riempito, scegline un altro",
    somethingWrong: "Qualcosa è andato storto. Riprova.",
    bookYourMassage: "Prenota il tuo massaggio",
    pickService: "Scegli un servizio", pickDay: "Scegli un giorno", pickTime: "Scegli un orario", priceLabel: "Prezzo",
    moreTimesFaster: "Più orari ci dai, più velocemente confermiamo.",
  },
  pt: {
    showDistance: "Ver distância", directions: "Como chegar",
    yourAppointmentAt: "A tua marcação em", checkingWithStudio: "Estamos a confirmar com o estúdio",
    bookingDone: "A tua reserva está feita! 🎉", waitTime: "Respondemos-te em menos de 30 minutos com a hora confirmada. Se não conseguirem, enviamos-te outros estúdios próximos.",
    addToCalendar: "Adicionar ao meu calendário", waSetItUp: "Escreve-nos no WhatsApp e organizamos tudo", visitWebsite: "Visitar o site",
    timeConfirmedPay: "A tua hora está confirmada. Pagas no estúdio, sem cartão.",
    studioConfirmsPay: "O estúdio normalmente confirma em algumas horas e receberás um email. Pagas no estúdio, sem cartão.",
    almostDone: "Quase pronto. Escreve-nos no WhatsApp e organizamos tudo.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Este estúdio ainda não está no Massage Club. Ainda assim organizamos a tua reserva.",
    howWeBook: "É assim que reservamos por ti",
    bookMassage: "Reservar uma massagem", pickServiceFirst: "Escolhe primeiro um serviço",
    servicesLabel: "Serviços", takeQuiz: "Não sabes qual massagem escolher? Faz o teste de 60 segundos",
    chooseServiceContinue: "Escolhe um serviço para continuar", continueLabel: "Continuar",
    contactStep: "Este estúdio ainda não está no Massage Club, por isso contactamo-lo por ti. Escolhe 2-3 horários possíveis - quanto mais nos deres, mais rápido confirmamos.",
    addSecondChoice: "+ Adicionar uma segunda opção", addThirdChoice: "+ Adicionar uma terceira opção", thirdChoice: "Terceira opção",
    moreThanOne: "Estás a reservar para mais de uma pessoa?", groupCheck: "Vamos confirmar que o estúdio pode receber o teu grupo todo ao mesmo tempo.",
    firstName: "Nome próprio", lastName: "Sobrenome", waPhone: "WhatsApp / Telefone (+34 600 123 456)", email: "Email",
    anythingElse: "Há mais alguma coisa que devamos saber?", optional: "Opcional",
    needContact: "Adiciona o teu nome e uma forma de contacto",
    reachYouWa: "Para te confirmarmos a hora pelo WhatsApp.",
    service: "Serviço", day: "Dia", secondChoice: "Segunda opção", name: "Nome", contact: "Contacto", price: "Preço",
    pickAService: "Escolhe um serviço", anyDay: "Qualquer dia", anyTime: "Qualquer hora", none: "Nenhum", notProvided: "Não fornecido", time: "Hora",
    askStudio: "Perguntar ao estúdio", requestWhatsapp: "Pedir via WhatsApp", pickAMassage: "Escolher uma massagem",
    back: "Voltar", waReassuranceStudios: "Os estúdios já no Massage Club confirmam instantaneamente.", browseOtherStudios: "Ver outros estúdios",
    callStudioLabel: "Ligar ao estúdio",
    chooseService: "Escolhe um serviço", pickDayTime: "Escolhe dia e hora", customizeSession: "Personaliza a tua sessão",
    yourDetails: "Os teus dados", reviewConfirm: "Revê e confirma",
    noServicesYet: "Ainda não há serviços listados.", yourUsualBooking: "A tua reserva habitual", change: "Alterar",
    notSureQuiz: "Não sabes qual massagem escolher? Faz o teste de 60 segundos",
    hoursNotPublished: "Este estúdio ainda não publicou os horários. Pede pelo WhatsApp e organizamos.",
    timesLabel: "Horas", fullyBooked: "Sem vagas nesse dia. Tenta outra data.", left: "restantes",
    addAnotherTime: "+ Adicionar outra hora (recomendado)",
    optionalHelps: "Opcional, mas ajuda o teu terapeuta a acertar.",
    prefilledProfile: "Preenchido a partir do teu perfil", startBlank: "Começar do zero",
    pickMassageFirst: "Escolhe primeiro uma massagem para usar estas opções.", chooseMassage: "Escolher massagem",
    comfort: "Conforto", pressure: "Pressão", focusAreas: "Zonas a tratar", makeItYours: "Personaliza",
    extrasNote: "Extras que este estúdio oferece. Somam-se ao teu total.", notesForTherapist: "Notas para o teu terapeuta",
    notesPlaceholder: "Algo que devamos saber? Lesões, alergias, preferências.",
    giveContact: "Deixa-nos um email ou um número de WhatsApp para te contactarmos.",
    createAccount: "Criar a minha conta gratuita Massage Club",
    createAccountSub: "Acompanha a tua reserva e reserva mais rápido. Enviamos-te um link de acesso de um toque, sem palavra-passe.",
    notSet: "Não definido", addOns: "Extras", notes: "Notas", addYourName: "Adiciona o teu nome", addContact: "Adiciona um contacto",
    firstMassage: "Primeira massagem? Usa-se sempre toalha, tu escolhes a pressão e podes parar quando quiseres.",
    readFirstTimer: "Lê o guia para principiantes",
    confirmedRightAway: "A tua hora é confirmada de imediato. Pagas no estúdio.",
    studioConfirms: "O estúdio confirma a tua hora. Pagas no estúdio.",
    yourBooking: "A tua reserva", call: "Ligar", poweredBy: "Com tecnologia Massage Club",
    forStudios: "Para estúdios", privacy: "Política de Privacidade", terms: "Termos",
    bookNow: "Reservar agora", requestBooking: "Pedir reserva", instantConfirmation: "Confirmação instantânea",
    freeToBook: "Reserva grátis · Pagas no estúdio · Sem cartão",
    booking: "A reservar", skipStep: "Saltar este passo",
    addNameContact: "Adiciona o teu nome e sobrenome para o estúdio saber quem vem",
    slotFilled: "Essa hora acabou de ficar ocupada, escolhe outra",
    somethingWrong: "Algo correu mal. Tenta outra vez.",
    bookYourMassage: "Reserva a tua massagem",
    pickService: "Escolhe um serviço", pickDay: "Escolhe um dia", pickTime: "Escolhe uma hora", priceLabel: "Preço",
    moreTimesFaster: "Quanto mais horários nos deres, mais rápido confirmamos.",
  },
  zh: {
    showDistance: "显示距离", directions: "路线",
    yourAppointmentAt: "您在以下门店的预约", checkingWithStudio: "我们正在与门店确认",
    bookingDone: "预约成功！🎉", waitTime: "我们会在30分钟内告知您确认的时间。如果门店无法安排,我们会为您推荐附近其他门店。",
    addToCalendar: "添加到我的日历", waSetItUp: "通过WhatsApp联系我们,我们会为您安排", visitWebsite: "访问他们的网站",
    timeConfirmedPay: "您的时间已确认。到店付款,无需信用卡。",
    studioConfirmsPay: "门店通常会在几小时内确认,并通过邮件通知您。到店付款,无需信用卡。",
    almostDone: "快完成了。通过WhatsApp联系我们,我们会为您安排。",
    footerCredit: "Massage Club · 马德里 · book.massageclub.io",
    notOnClub: "该门店尚未加入Massage Club。我们仍然可以为您安排预约。",
    howWeBook: "我们就是这样为您预约的",
    bookMassage: "预约按摩", pickServiceFirst: "请先选择一项服务",
    servicesLabel: "服务", takeQuiz: "不确定选哪种按摩?来做60秒测试",
    chooseServiceContinue: "选择一项服务以继续", continueLabel: "继续",
    contactStep: "该门店尚未加入Massage Club,所以我们会替您联系他们。请选择2-3个可能的时间 - 提供的选择越多,确认越快。",
    addSecondChoice: "+ 添加第二选择", addThirdChoice: "+ 添加第三选择", thirdChoice: "第三选择",
    moreThanOne: "为多人预约吗?", groupCheck: "我们会确认门店能否同时接待您的整个团队。",
    firstName: "名字", lastName: "姓氏", waPhone: "WhatsApp / 电话 (+34 600 123 456)", email: "电子邮箱",
    anythingElse: "还有什么我们需要知道的吗?", optional: "可选",
    needContact: "请添加您的姓名和联系方式",
    reachYouWa: "以便我们通过WhatsApp确认您的时间。",
    service: "服务", day: "日期", secondChoice: "第二选择", name: "姓名", contact: "联系方式", price: "价格",
    pickAService: "选择一项服务", anyDay: "任意日期", anyTime: "任意时间", none: "无", notProvided: "未提供", time: "时间",
    askStudio: "询问门店", requestWhatsapp: "通过WhatsApp请求", pickAMassage: "选择一项按摩",
    back: "返回", waReassuranceStudios: "已加入Massage Club的门店可即时确认。", browseOtherStudios: "浏览其他门店",
    callStudioLabel: "致电门店",
    chooseService: "选择服务", pickDayTime: "选择日期和时间", customizeSession: "个性化您的疗程",
    yourDetails: "您的信息", reviewConfirm: "查看并确认",
    noServicesYet: "暂无服务信息。", yourUsualBooking: "您的常用预约", change: "更改",
    notSureQuiz: "不确定选哪种按摩?来做60秒测试",
    hoursNotPublished: "该门店尚未公布营业时间。通过WhatsApp询问,我们会为您安排。",
    timesLabel: "时间", fullyBooked: "该日已满,请尝试其他日期。", left: "剩余",
    addAnotherTime: "+ 添加另一个时间(推荐)",
    optionalHelps: "可选,但有助于治疗师更好地为您服务。",
    prefilledProfile: "已根据您的资料预填", startBlank: "重新开始",
    pickMassageFirst: "请先选择一项按摩以使用这些选项。", chooseMassage: "选择按摩",
    comfort: "舒适度", pressure: "力度", focusAreas: "重点部位", makeItYours: "个性化选项",
    extrasNote: "该门店提供的附加服务,会加到您的总价中。", notesForTherapist: "给治疗师的备注",
    notesPlaceholder: "有什么我们需要知道的吗?伤病、过敏、偏好等。",
    giveContact: "请留下邮箱或WhatsApp号码以便我们联系您。",
    createAccount: "创建我的免费Massage Club账户",
    createAccountSub: "追踪您的预约并更快地再次预约。我们会给您发送一个一键登录链接,无需密码。",
    notSet: "未设置", addOns: "附加项目", notes: "备注", addYourName: "添加您的姓名", addContact: "添加联系方式",
    firstMassage: "第一次按摩吗?始终会使用毛巾覆盖,您可以选择力度,并可随时暂停。",
    readFirstTimer: "阅读新手指南",
    confirmedRightAway: "您的预约会立即确认。到店付款。",
    studioConfirms: "门店会确认您的时间。到店付款。",
    yourBooking: "您的预约", call: "致电", poweredBy: "由Massage Club提供技术支持",
    forStudios: "商家入驻", privacy: "隐私政策", terms: "条款",
    bookNow: "立即预约", requestBooking: "申请预约", instantConfirmation: "即时确认",
    freeToBook: "免费预约 · 到店付款 · 无需信用卡",
    booking: "正在预约", skipStep: "跳过此步骤",
    addNameContact: "请添加您的姓名,以便门店知道是谁来访",
    slotFilled: "该时间刚被预订,请选择其他时间",
    somethingWrong: "出了点问题,请重试。",
    bookYourMassage: "预约您的按摩",
    pickService: "选择服务", pickDay: "选择日期", pickTime: "选择时间", priceLabel: "价格",
    moreTimesFaster: "你提供的时间越多，我们确认得越快。",
  },
};

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayShort = (d: Date, lang: FlowLang) => shortWeekday(d, lang);
const monShort = (d: Date, lang: FlowLang) =>
  new Intl.DateTimeFormat(localeOf(lang), { month: "short" }).format(d).replace(/\.$/, "");

export default function StudioBookingPage() {
  const { t, i18n } = useTranslation();
  const lang = useFlowLang();
  const c = pickCopy(PAGE_COPY, lang);
  const { studioId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const rebookId = searchParams.get("rebook");
  // "Book again" deep links ask for the wizard to open on Day and time.
  const stepParam = searchParams.get("step");
  const [profile, setProfile] = useState<StudioProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // How many bookings already exist for each `date__time` slot.
  // A slot is full only when this count reaches the studio's therapist count.
  const [slotCounts, setSlotCounts] = useState<Map<string, number>>(new Map());

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  // Extra time options: the concierge confirms far faster with 2-3 choices.
  const [altDate2, setAltDate2] = useState<Date | null>(null);
  const [altTime2, setAltTime2] = useState<string | null>(null);
  const [altDate3, setAltDate3] = useState<Date | null>(null);
  const [altTime3, setAltTime3] = useState<string | null>(null);
  const [alt2Shown, setAlt2Shown] = useState(false);
  const [alt3Shown, setAlt3Shown] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const nameComplete = !!(firstName.trim() && lastName.trim());
  const applyFullName = (full: string) => {
    const parts = (full || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    setFirstName(prev => prev || parts[0]);
    setLastName(prev => prev || parts.slice(1).join(" "));
  };
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Customize
  const [pressure, setPressure] = useState("Medium");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [addonNames, setAddonNames] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [people, setPeople] = useState("1");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [conversationPref, setConversationPref] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ref: string } | null>(null);
  const [error, setError] = useState("");
  const [profileAllergies, setProfileAllergies] = useState<string>("");
  const [profileHealthNotes, setProfileHealthNotes] = useState<string>("");
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [prefsApplied, setPrefsApplied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Rebook fast-path: when true, hide expanded pickers and show a summary card.
  const [rebookMode, setRebookMode] = useState(false);
  // "Almost there" details dialog, opened at the moment of booking.
  // Step-by-step wizard state (claimed studios).
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  // Wizard state for the unclaimed-studio WhatsApp handoff.
  const [hoStep, setHoStep] = useState(1);
  // The handoff panel heading, so every step transition visibly moves the viewport.
  const hoPanelRef = useRef<HTMLDivElement | null>(null);
  // The inline Continue inside the step card. The sticky bar watches it and
  // hides its own button while this one is on screen, so exactly one
  // actionable Continue is visible at any scroll position.
  const hoInlineContinueRef = useRef<HTMLButtonElement | null>(null);
  // Distances are only ever shown once the visitor has granted location.
  const [userLoc, setUserLoc] = useState<LatLng | null>(() => savedLocationResult()?.loc ?? null);
  const [locAreaName, setLocAreaName] = useState<string | null>(() => savedLocationResult()?.areaName ?? null);
  const askLocation = useLocationAsk();
  const [hoMaxStep, setHoMaxStep] = useState(1);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);
  // Unclaimed-studio WhatsApp handoff preferences (lightweight, no account)
  const [hoServiceId, setHoServiceId] = useState<string>("");
  const [hoPeople, setHoPeople] = useState("1");
  const [hoPeopleOpen, setHoPeopleOpen] = useState(false);
  const [hoNotes, setHoNotes] = useState("");
  const [hoFirstName, setHoFirstName] = useState("");
  const [hoLastName, setHoLastName] = useState("");
  const hoName = [hoFirstName.trim(), hoLastName.trim()].filter(Boolean).join(" ");
  const hoNameComplete = !!(hoFirstName.trim() && hoLastName.trim());
  const [hoEmail, setHoEmail] = useState("");
  const [hoPhone, setHoPhone] = useState("");

  // Passwordless account creation, offered to visitors who are not signed in.
  const [createAccount, setCreateAccount] = useState(true);

  const [hoDate, setHoDate] = useState("");
  const [hoTime, setHoTime] = useState("");
  const [hoAltDate, setHoAltDate] = useState("");
  const [hoAltTime, setHoAltTime] = useState("");
  const [waTapped, setWaTapped] = useState(false);
  const [askWaTapped, setAskWaTapped] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [alt2Open, setAlt2Open] = useState(false);
  const [hoAlt2Date, setHoAlt2Date] = useState("");
  const [hoAlt2Time, setHoAlt2Time] = useState("");
  const nameRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const serviceRef = useRef<HTMLDivElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);
  // Guard so a single WhatsApp tap logs exactly one row.
  const waLoggedRef = useRef(false);
  // Id of the request we just logged, so a new account can be attached to it.
  const waRequestIdRef = useRef<string | null>(null);
  // Languages the visitor speaks — defaults to the site language, never a required field.
  const siteLang = (i18n.language || "en").slice(0, 2);
  const defaultSpoken: SpokenLang[] = isSpokenLang(siteLang) ? [siteLang] : ["en"];
  const [spokenLangs, setSpokenLangs] = useState<SpokenLang[]>(() => {
    const saved = loadSpokenLangs();
    return saved.length ? saved : defaultSpoken;
  });
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  // Persist locally whenever it changes.
  useEffect(() => { saveSpokenLangs(spokenLangs); }, [spokenLangs]);
  useEffect(() => {
    clarityEvent("studio_view");
    trackEvent("studio_view", { slug: studioId });
    markStudioVisited(studioId);
  }, [studioId]);

  // Funnel: each booking step becoming visible (claimed-studio wizard).
  useEffect(() => {
    trackFunnel(`wizard_step_${step}`, { flow: "studio", studio: studioId, service_id: serviceId || null }, studioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Funnel: same for the unclaimed-studio handoff wizard.
  useEffect(() => {
    trackFunnel(`wizard_step_${hoStep}`, { flow: "studio-handoff", studio: studioId, service_id: hoServiceId || null }, studioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoStep]);




  const toggleSpokenLang = (code: SpokenLang) => {
    setSpokenLangs(prev => {
      const next = prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code];
      if (userId) {
        supabase.from("profiles").update({ spoken_languages: next }).eq("id", userId).then(
          () => {}, () => {},
        );
      }
      return next;
    });
  };





  useEffect(() => {
    captureSource();
  }, []);

  useEffect(() => {
    if (!profile?.partner) return;
    const p = profile.partner as any;
    const prevTitle = document.title;
    document.title = `${p.business_name} · Massage Club`;
    const desc = `${p.business_name}${p.address ? `, ${p.address}` : ", Madrid"}. Book a massage in English or Spanish${p.price_from ? `, from ${p.price_from}€` : ""}. Massage Club Madrid.`;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const prevDesc = meta.content;
    meta.content = desc;
    return () => {
      document.title = prevTitle;
      if (meta) meta.content = prevDesc;
    };
  }, [profile]);

  // LocalBusiness / HealthAndBeautyBusiness structured data for the studio profile.
  useEffect(() => {
    if (!profile?.partner) return;
    const p = profile.partner as any;
    const rating = p.google_rating != null ? Number(p.google_rating) : null;
    const reviews = p.google_reviews != null ? Number(p.google_reviews) : null;
    const data: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "HealthAndBeautyBusiness",
      name: p.business_name,
      url: `https://book.massageclub.io/${p.slug || p.id}`,
      ...(p.phone ? { telephone: p.phone } : {}),
      ...(p.image_url ? { image: p.image_url } : {}),
      address: {
        "@type": "PostalAddress",
        ...(p.address ? { streetAddress: p.address } : {}),
        addressLocality: "Madrid",
        addressCountry: "ES",
      },
      ...(p.latitude != null && p.longitude != null
        ? { geo: { "@type": "GeoCoordinates", latitude: Number(p.latitude), longitude: Number(p.longitude) } }
        : {}),
      ...(rating != null
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: rating,
              ...(reviews != null ? { reviewCount: reviews } : {}),
            },
          }
        : {}),
    };
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [profile]);




  useEffect(() => {
    if (!studioId) return;
    (async () => {
      // The param can be a partner UUID or a friendly slug (book.<domain>/<slug>).
      let resolvedId = studioId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studioId);
      if (!isUuid) {
        const { data: bySlug } = await supabase
          .from("partners")
          .select("id")
          .eq("slug", studioId)
          .maybeSingle();
        if (!bySlug?.id) { setLoading(false); return; }
        resolvedId = bySlug.id;
      }
      const p = await fetchStudioProfile(resolvedId);
      setProfile(p);
      if (p) {
        // Count how many bookings already exist per slot, so a slot only
        // disappears once EVERY therapist is busy at that time (real capacity).
        const { data } = await supabase.rpc("booked_slot_counts", { p_partner_id: resolvedId });
        const counts = new Map<string, number>();
        for (const b of (data as any[]) || []) {
          const key = `${b.booking_date}__${b.booking_time}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        setSlotCounts(counts);

        const { data: rs } = await supabase
          .from("partner_rating_summary")
          .select("rating_avg, rating_count")
          .eq("partner_id", resolvedId)
          .maybeSingle();
        if (rs && (rs as any).rating_count > 0) {
          setRating({ avg: Number((rs as any).rating_avg), count: Number((rs as any).rating_count) });
        }
      }

      setLoading(false);
    })();
  }, [studioId]);


  // Pre-fill name + email + phone if the customer is signed in.
  useEffect(() => {
    let cancelled = false;

    const prefill = async (user: any) => {
      if (!user || cancelled) return;
      setUserId(user.id);

      // Spoken languages live in their own query so a missing column can never
      // break the rest of the pre-fill.
      supabase.from("profiles").select("spoken_languages").eq("id", user.id).maybeSingle().then(
        ({ data }) => {
          const saved = normalizeSpokenLangs((data as any)?.spoken_languages);
          if (saved.length) setSpokenLangs(saved);
        },
        () => {},
      );

      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      setEmail(prev => prev || user.email || "");
      applyFullName(fullName);

      const userPhone = user.phone || user.user_metadata?.phone || "";
      setPhone(prev => prev || userPhone);

      // select("*") so one renamed column can never wipe out the whole pre-fill.
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof || cancelled) return;
      const p = prof as any;
      setCustomerProfile(p);
      applyFullName(p.full_name || "");
      setEmail(prev => prev || p.email || "");
      setPhone(prev => prev || p.phone || "");
      setProfileAllergies(p.allergies || "");
      setProfileHealthNotes(p.health_notes || "");
      // Only auto-apply massage prefs when NOT rebooking (rebook effect wins).
      if (!rebookId) {
        let applied = false;
        if (p.preferred_pressure) {
          setPressure(prev => (prev === "Medium" ? p.preferred_pressure : prev));
          applied = true;
        }
        if (Array.isArray(p.focus_areas) && p.focus_areas.length) {
          setFocusAreas(prev => (prev.length === 0 ? p.focus_areas : prev));
          applied = true;
        }
        if (p.conversation_pref) {
          setConversationPref(prev => prev || p.conversation_pref);
          applied = true;
        }
        if (applied) setPrefsApplied(true);
      }
    };

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        prefill(session.user);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) prefill(user);
      }
    })();

    // The session can land after first paint (magic link, OAuth return).
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) prefill(session.user);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Rebook fast-path: prefill service + preferences + contact from a previous booking.
  useEffect(() => {
    if (!rebookId || !profile) return;
    (async () => {
      const { data: prev, error: err } = await supabase
        .from("bookings")
        .select("service_id, massage_type, pressure, focus_areas, add_ons, notes, client_name, client_phone, client_email")
        .eq("id", rebookId)
        .maybeSingle();
      if (err || !prev) return; // silently fall back to normal flow

      // Resolve the service: prefer id, then name, then type match.
      let match = profile.services.find(s => s.id === (prev as any).service_id) || null;
      if (!match && prev.massage_type) {
        match =
          profile.services.find(s => s.name === prev.massage_type) ||
          profile.services.find((s: any) => s.type === prev.massage_type) ||
          null;
      }
      if (!match) return; // service no longer offered — exit rebook mode

      setServiceId(match.id);
      if (prev.pressure) setPressure(prev.pressure);
      if (Array.isArray(prev.focus_areas)) setFocusAreas(prev.focus_areas);
      const availableAddons = new Set((profile.addons ?? []).map((a: any) => a.name));
      if (Array.isArray(prev.add_ons)) {
        setAddonNames(prev.add_ons.filter((n: string) => availableAddons.has(n)));
      }
      if (prev.notes) setNotes(prev.notes);
      if (prev.client_name) applyFullName(prev.client_name);
      if (prev.client_phone) setPhone(prev.client_phone);
      if (prev.client_email) setEmail(prev.client_email);
      if (stepParam === "2") {
        // "Book again": everything stays editable, we just skip ahead one step.
        setRebookMode(false);
        setStep(2);
        setMaxStep(m => Math.max(m, 2));
        window.scrollTo({ top: 0, behavior: "auto" });
      } else {
        setRebookMode(true);
      }
    })();
  }, [rebookId, stepParam, profile]);

  // Deep link from a massage type landing page: ?service=<id> preselects it.
  const serviceParam = searchParams.get("service");
  useEffect(() => {
    if (!serviceParam || !profile || rebookId) return;
    const match = profile.services.find(s => s.id === serviceParam);
    if (!match) return;
    setServiceId(prev => prev ?? match.id);
    setHoServiceId(prev => prev || match.id);
  }, [serviceParam, profile, rebookId]);



  // availability grouped by weekday (0=Sun..6=Sat)
  const slotsByDay = useMemo(() => {
    const m: Record<number, string[]> = {};
    for (const a of profile?.availability ?? []) {
      const d = Number(a.day_of_week);
      (m[d] ||= []).push(a.time_slot);
    }
    for (const k of Object.keys(m)) m[Number(k)].sort();
    return m;
  }, [profile]);

  // next 21 days that the studio is open
  const openDates = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 21 && out.length < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if ((slotsByDay[d.getDay()] || []).length > 0) out.push(d);
    }
    return out;
  }, [slotsByDay]);

  // Step 2 must never open empty: preselect the first day that has slots.
  useEffect(() => {
    if (step !== 2 || date || openDates.length === 0) return;
    setDate(openDates[0]);
    setTime(null);
  }, [step, date, openDates]);

  // The quiz remembers which studio sent the visitor there.
  const quizHref = (() => {
    const p: any = profile?.partner;
    if (!p) return "/discovery/quiz";
    const params = new URLSearchParams({ from: p.slug || p.id, fromName: p.business_name || "" });
    return `/discovery/quiz?${params.toString()}`;
  })();

  const service = profile?.services.find(s => s.id === serviceId) || null;


  // Studio capacity = how many massages can run in parallel (min 1).
  const therapistCount = Math.max(1, Number(profile?.partner?.capacity) || 0, profile?.therapists?.length || 0);

  // Per-slot capacity overrides (partner_availability.capacity, NULL = inherit global)
  const slotCapacity = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of (profile?.availability ?? []) as any[]) {
      if (a.capacity != null) m.set(`${Number(a.day_of_week)}__${a.time_slot}`, Math.max(1, Number(a.capacity)));
    }
    return m;
  }, [profile]);

  const capacityFor = (day: number, slot: string) =>
    slotCapacity.get(`${day}__${slot}`) ?? therapistCount;

  // Spots still open for a given slot on the selected date.
  const remainingFor = (t: string) =>
    date ? capacityFor(date.getDay(), t) - (slotCounts.get(`${isoDate(date)}__${t}`) || 0) : 0;

  // Only show a time while at least one therapist is still free for it.
  const timesFor = (d: Date | null) =>
    d
      ? (slotsByDay[d.getDay()] || []).filter(
          t => capacityFor(d.getDay(), t) - (slotCounts.get(`${isoDate(d)}__${t}`) || 0) > 0,
        )
      : [];
  const times = timesFor(date);
  const prettyDayOf = (d: Date | null) =>
    d ? `${dayShort(d, lang)} ${d.getDate()} ${monShort(d, lang)}` : null;

  // Compact day + time picker used for the optional second and third choices.
  const renderAltSlot = (
    dVal: Date | null,
    setD: (d: Date | null) => void,
    tVal: string | null,
    setT: (t: string | null) => void,
    label: string,
  ) => (
    <div className="mt-5">
      <p className="text-xs min-[900px]:text-base font-semibold text-gray-500 mb-2">
        {label}
      </p>
      <div className="flex gap-2 w-full min-w-0 overflow-x-auto pb-1 -mx-1 px-1">
        {openDates.map(d => {
          const active = dVal && isoDate(d) === isoDate(dVal);
          return (
            <button
              key={isoDate(d)}
              type="button"
              onClick={() => { setD(d); setT(null); }}
              className={`flex-shrink-0 w-14 min-[900px]:w-16 py-2 rounded-xl border-2 text-center transition ${
                active ? "border-[#C4622D] bg-[#C4622D] text-white" : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <div className="text-[10px] uppercase opacity-70">{dayShort(d, lang)}</div>
              <div className="text-base font-bold leading-none mt-0.5">{d.getDate()}</div>
              <div className="text-[10px] opacity-70">{monShort(d, lang)}</div>
            </button>
          );
        })}
      </div>
      {dVal && (
        <div className="mt-3 flex flex-wrap gap-2">
          {timesFor(dVal).length === 0 ? (
            <p className="text-sm text-gray-400">Fully booked that day / Sin horas ese día</p>
          ) : (
            timesFor(dVal).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setT(t)}
                className={`px-4 py-2 rounded-full border-2 text-sm font-medium motion-safe:transition ${
                  tVal === t ? "border-[#C4622D] bg-[#C4622D] text-white" : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {t}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );




  const addons = profile?.addons ?? [];
  const selectedAddons = addons.filter((a: any) => addonNames.includes(a.name));
  const addonsTotal = selectedAddons.reduce((sum: number, a: any) => sum + Number(a.price || 0), 0);
  const addonsExtraMinutes = selectedAddons.reduce((sum: number, a: any) => sum + (Number(a.duration_extra) || 0), 0);
  const total = (Number(service?.price) || 0) + addonsTotal;
  /** Confirm-step review lines. */
  const addonSummary = selectedAddons.length
    ? selectedAddons.map((a: any) => `${a.name} (+€${Number(a.price) || 0})`).join(", ")
    : null;
  const serviceSummary = service
    ? [
        servicePrimaryName(service),
        Number(service.duration) > 0 ? `${Number(service.duration) + addonsExtraMinutes} min` : "",
        Number(service.price) > 0 ? `€${Number(service.price)}` : "",
      ].filter(Boolean).join(" · ")
    : null;
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  // Abandoned-booking capture: signed-out visitors who picked a day and time
  // but have not submitted yet. Declared before the early returns below.
  const leadSheet = useAbandonedBookingCapture({
    eligible: step > 2 && !!date && !!time,
    onFinalStep: step === 5,
    disabled: !!userId || !!done,
  });

  // Concierge bubble: studio context on the profile/first step, hidden once the
  // visitor is inside the wizard (it must never compete with the Continue bar).
  useEffect(() => {
    // The unclaimed-studio concierge wizard runs on hoStep and shows its own
    // sticky Continue bar on steps 1-3, so the bubble must stay out of the way.
    const unclaimed = (profile?.partner as any)?.status && (profile?.partner as any).status !== "active";
    const handoffWizard = !!unclaimed && hoStep <= 3;
    setWaBubbleContext({
      studio: (profile?.partner as any)?.business_name ?? null,
      hidden: !!done || step > 1 || handoffWizard || !profile?.partner,
    });
    return () => clearWaBubbleContext();
  }, [(profile?.partner as any)?.business_name, (profile?.partner as any)?.status, done, step, hoStep]);



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a0709]">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }

  if (!profile) {
    const askLang = (i18n.language || "en").slice(0, 2) === "es" ? "es" : "en";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a0709] text-white p-6 text-center">
        <div className="max-w-md w-full space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{t("app.shopDetail.notFoundTitle")}</h1>
            <p className="text-white/60 text-sm">{t("app.shopDetail.notFoundSub")}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/book"
              className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full bg-white text-[#1a0709] font-semibold hover:bg-white/90 transition"
            >
              {t("app.shopDetail.bookMassage")}
            </Link>
            <Link
              to="/studios"
              className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/30 text-white font-semibold hover:bg-white/10 transition"
            >
              {t("app.shopDetail.browseStudios")}
            </Link>
          </div>

          <WhatsAppAskButton
            source="not-found"
            lang={askLang}
            label={t("app.shopDetail.chatWhatsapp")}
            renderTrigger={({ open }) => (
              <button
                type="button"
                onClick={open}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/30 text-white font-semibold hover:bg-white/10 transition"
              >
                <MessageCircle className="h-5 w-5" />
                {t("app.shopDetail.chatWhatsapp")}
              </button>
            )}
          />
        </div>
      </div>
    );
  }

  const { partner } = profile;
  /** Studios that confirm automatically get a commit CTA, not a request CTA. */
  const autoConfirm = !!(partner as any).auto_confirm_bookings;
  /** Instant confirmation only holds for dates before 1 Sep 2026; after that every booking is a request. */
  const instantConfirm = isInstantConfirm(autoConfirm, date);


  // ─── Distance and walking directions ───
  const studioLatLng: LatLng | null =
    (partner as any).latitude != null && (partner as any).longitude != null
      ? { lat: Number((partner as any).latitude), lng: Number((partner as any).longitude) }
      : null;
  const distanceKm = userLoc && studioLatLng ? haversineKm(userLoc, studioLatLng) : null;
  const directionsHref = walkingDirectionsUrl(studioLatLng, partner.address || partner.business_name, userLoc);
  const distanceBlock = (dark: boolean) => (
    <p className={`text-sm flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 ${dark ? "text-white/80" : ""}`} style={dark ? undefined : { color: "#5a4736" }}>
      {distanceKm != null ? (
        <span>{distanceLabel(distanceKm, siteLang === "es" ? "es" : "en")} {locAreaName ? originSuffix(locAreaName, siteLang === "es" ? "es" : "en") : ""}</span>
      ) : (
        <button
          type="button"
          onClick={() => askLocation((res) => { if (res) { setUserLoc(res.loc); setLocAreaName(res.areaName); } })}
          className="underline underline-offset-2 font-semibold"
        >
          {c.showDistance}
        </button>
      )}
      {directionsHref && (
        <a href={directionsHref} target="_blank" rel="noreferrer" className={`underline underline-offset-2 font-semibold ${dark ? "" : "text-[#C4622D]"}`}>
          {c.directions}
        </a>)}
    </p>
  );



  // ─── Confirmation screen ───
  if (done) {
    const prettyDate = date ? `${dayShort(date, lang)} ${date.getDate()} ${monShort(date, lang)}` : "";
    const isClaimed = partner.status === "active";
    const studioNumber = (partner as any).whatsapp || partner.phone;
    const waNumber = resolveWhatsappNumber(partner as any);

    // Concierge model: every client CTA opens a chat with MASSAGE CLUB, never the studio.
    const conciergeWhen = prettyDate ? `${prettyDate}${time ? ` at ${time}` : ""}` : (time || null);
    const conciergeMsg = conciergePrefill({
      lang: siteLang,
      studio: partner.business_name,
      service: service ? servicePrimaryName(service) : null,
      duration: (service as any)?.duration ?? null,
      price: (service as any)?.price ?? null,
      when1: conciergeWhen,

      name: name || null,
      languages: spokenLangs,
    });
    const waLink = conciergeWhatsappUrl(conciergeMsg);
    const unclaimedWaLink = waLink;

    const websiteUrl = (() => {
      if (!partner.website) return null;
      const w = String(partner.website).trim();
      return /^https?:\/\//i.test(w) ? w : `https://${w}`;
    })();
    // Let the customer drop the appointment into their own calendar.
    const gcal = (() => {
      if (!date || !time || !service) return null;
      const [h, m] = time.split(":").map(Number);
      const start = new Date(date); start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + (service.duration || 60) * 60000);
      const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const text = encodeURIComponent(`${serviceInlineLabel(service)} · ${partner.business_name}`);
      const details = encodeURIComponent(`Massage Club booking · Ref ${done.ref}`);
      const loc = encodeURIComponent(partner.address || partner.business_name || "");
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${z(start)}/${z(end)}&details=${details}&location=${loc}`;
    })();
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FAF6F1" }}>
        <div className="w-full max-w-md rounded-2xl overflow-hidden text-center" style={{ background: "#ffffff", boxShadow: "0 6px 24px rgba(80,44,20,0.08)" }}>
          <div className="flex items-center justify-center gap-2 py-3 px-4" style={{ background: "#B85C38", borderRadius: "1rem 1rem 0 0" }}>
            <img src="/brand/mc-avatar-cream.png" alt="Massage Club" width={26} height={26} className="rounded-full" />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: "2px" }}>MASSAGE CLUB</span>
          </div>
          <div className="px-6 py-7">
            <div className="text-xs font-bold uppercase mb-1" style={{ color: "#B85C38", letterSpacing: "2.5px" }}>{c.yourAppointmentAt}</div>
            <h1 className="font-display text-3xl font-semibold leading-tight mb-3" style={{ color: "#2b2b2b" }}>{partner.business_name}</h1>
            <p className="text-base font-semibold mb-3" style={{ color: "#3d2b1f" }}>
              {isClaimed && !instantConfirm ? c.checkingWithStudio : c.bookingDone}
            </p>
            {isClaimed && !instantConfirm && (
              <p className="text-sm mb-6 leading-snug" style={{ color: "#5a4736" }}>
                {c.waitTime}
              </p>
            )}
            <div className="rounded-xl p-4 mb-5 text-left" style={{ background: "#FAF6F1" }}>
              <div className="text-sm font-semibold mb-1" style={{ color: "#3d2b1f" }}>
                {servicePrimaryName(service)} · {service?.duration} min · {total}€
              </div>
              {serviceSecondaryName(service) && (
                <div className="text-xs mb-1" style={{ color: "#8a7460" }}>{serviceSecondaryName(service)}</div>
              )}
              <div className="text-base font-bold mb-1" style={{ color: "#B85C38" }}>
                {prettyDate} · {time}
              </div>
              {partner.address && (
                <div className="text-sm flex items-start gap-1.5" style={{ color: "#5a4736" }}>
                  <span>📍</span>
                  <span>{partner.address}</span>
                </div>
              )}
            </div>
            <div className="inline-flex items-center justify-center px-4 py-2 rounded-full font-mono text-xs mb-5" style={{ background: "#FAF6F1", color: "#5a4736" }}>
              {done.ref}
            </div>
            {isClaimed ? (
              <>
                {instantConfirm ? (
                  <p className="text-sm mb-6" style={{ color: "#8a7460" }}>
                    {c.timeConfirmedPay}
                  </p>
                ) : (
                  <p className="text-sm mb-6" style={{ color: "#8a7460" }}>
                    {c.studioConfirmsPay}
                  </p>
                )}
                <div className="flex flex-col items-center gap-3 w-full">
                  {gcal && (
                    <a href={gcal} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border-2 font-semibold bg-white hover:bg-[#FAF6F1] transition" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                      <CalendarDays size={18} /> {c.addToCalendar}
                    </a>
                  )}
                  {waLink ? (
                    <a href={waLink} target="_blank" rel="noopener noreferrer" className="w-full inline-flex flex-col items-center justify-center h-12 px-6 rounded-full border font-semibold" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                      <span className="inline-flex items-center gap-2"><MessageCircle size={18} /> {c.waSetItUp}</span>
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm mb-6" style={{ color: "#8a7460" }}>
                  {c.almostDone}
                </p>
                <div className="flex flex-col items-center gap-3 w-full">
                  {unclaimedWaLink ? (
                    <a href={unclaimedWaLink} target="_blank" rel="noreferrer" className="w-full inline-flex flex-col items-center justify-center h-12 px-6 rounded-full font-semibold" style={{ background: "#B85C38", color: "#fff" }}>
                      <span className="inline-flex items-center gap-2"><MessageCircle size={18} /> {c.waSetItUp}</span>
                    </a>
                  ) : null}
                  {websiteUrl && (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2 hover:opacity-80" style={{ color: "#8a7460" }}>
                      {c.visitWebsite}
                    </a>
                  )}

                  {gcal && (
                    <a href={gcal} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border-2 font-semibold bg-white hover:bg-[#FAF6F1] transition" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                      <CalendarDays size={18} /> {c.addToCalendar}
                    </a>
                  )}
                </div>
              </>
            )}
            <AccountOfferBlock
              className="mt-6"
              firstName={firstName.trim()}
              lastName={lastName.trim()}
              email={email.trim()}
              phone={phone.trim()}
              requestId={waRequestIdRef.current}
              source="studio-booking"
            />
            <DealsConfirmationLine className="mt-6" />
            <MarketingOptInCard
              className="mt-6"
              email={email.trim() || null}
              userId={userId}
              source="booking_success"
              bookingRef={done.ref}
            />

            <div className="mt-6 text-xs" style={{ color: "#8a7460" }}>
              {c.footerCredit}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Unclaimed studio handoff ───
  if (partner.status !== "active") {
    const studioNumber = (partner as any).whatsapp || partner.phone;
    const waNumber = resolveWhatsappNumber(partner as any);
    const hoService = profile.services.find(s => s.id === hoServiceId) || null;
    const esDate = (v: string) => {
      if (!v) return "";
      const [y, mo, d] = v.split("-").map(Number);
      if (!y || !mo || !d) return "";
      try {
        return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" })
          .format(new Date(y, mo - 1, d));
      } catch {
        return v;
      }
    };
    const hoPrice = Number((hoService as any)?.price);
    const hasPrice = Number.isFinite(hoPrice) && hoPrice > 0;

    // Concierge model: the message goes to MASSAGE CLUB, in the visitor's language.
    const localDate = (v: string) => {
      if (!v) return "";
      const [y, mo, d] = v.split("-").map(Number);
      if (!y || !mo || !d) return "";
      try {
        return new Intl.DateTimeFormat(siteLang === "es" ? "es-ES" : "en-GB", {
          weekday: "long", day: "numeric", month: "long",
        }).format(new Date(y, mo - 1, d));
      } catch {
        return v;
      }
    };
    // Exact selections only: the concierge needs a precise day and time to ask the studio.
    const exactWhen = (d: string, tm: string) => {
      const day = localDate(d);
      if (!day && !tm) return null;
      if (!tm) return day;
      if (!day) return tm;
      return siteLang === "es" ? `${day} a las ${tm}` : `${day} at ${tm}`;
    };
    const hoWhen1 = exactWhen(hoDate, hoTime);
    // One-line reminder of the choice, kept visible in the sticky bar.
    const hoSummaryLine = hoService
      ? [
          servicePrimaryName(hoService),
          Number((hoService as any).duration) > 0 ? `${Number((hoService as any).duration)} min` : null,
          hasPrice ? `€${hoPrice}` : null,
        ].filter(Boolean).join(" · ")
      : null;
    // Concierge message from the client to Massage Club, always in English and
    // composed entirely from their picks, so it arrives complete with no typing.
    const waMsg = (() => {
      const svc = hoService
        ? `${servicePrimaryName(hoService)}${Number((hoService as any)?.duration) > 0 ? ` ${Number((hoService as any).duration)} min` : ""}`
        : "a massage";
      let msg = `Hi, I'd like to book: ${svc}${hoPeople !== "1" ? ` for ${hoPeople} people` : ""} at ${partner.business_name}.`;
      const when = hoWhen1;
      if (when) msg += ` ${when} if possible.`;
      if (hoPeople !== "1") msg += ` Personas: ${hoPeople}.`;
      if (hoNotes.trim()) msg += ` Notes: ${hoNotes.trim()}.`;
      msg += " (via Massage Club)";
      return msg;
    })();
    // Scroll the visitor to the services menu when a CTA needs to point them back.
    const scrollToServices = () => {
      document.getElementById("mc-services-menu")?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const hoContact = contactOk(hoPhone, hoEmail);
    const hoEmailValid = hoContact.emailValid === true;
    const hoPhoneValid = hoContact.phoneValid === true;
    const hoDetailsReady = !!(hoNameComplete && hoContact.ok);


    const trackWhatsappIntent = async () => {
      if (waLoggedRef.current) return;
      waLoggedRef.current = true;
      setWaTapped(true);
      clarityEvent("whatsapp_click");
      trackEvent("wa_click", { slug: partner.slug || partner.id });
      trackFunnel("wizard_wa_handoff", {
        flow: "studio-handoff",
        studio: partner.slug || partner.id,
        massage: hoService ? servicePrimaryName(hoService) : null,
        area: (partner as any).district || null,
      }, partner.slug || partner.id);
      const hasService = !!hoService;
      const hasDate = !!hoDate;
      sendTrack({
        event: "whatsapp_click",
        path: window.location.pathname,
        slug: partner.slug || partner.id,
        meta: {
          filled: hasService || hasDate || !!hoTime,
          service: hasService,
          date: hasDate,
          price_shown: hasPrice,
          languages: spokenLangs,
        },
      });
      // Log the lead BEFORE the WhatsApp link opens, so we keep the record even
      // if the visitor never sends the message.
      trackFunnel("wizard_submit_attempt", {
        flow: "studio-handoff",
        studio: partner.slug || partner.id,
        massage: hoService ? servicePrimaryName(hoService) : null,
        area: (partner as any).district || null,
        people,
      }, partner.slug || partner.id);
      const logged = await logWhatsappRequestResult({
        partner_id: partner.id,
        slug: partner.slug || null,
        studio_name: partner.business_name,
        service_name: hoService ? servicePrimaryName(hoService) : null,
        price: hasPrice ? hoPrice : null,
        day1: hoDate || null,
        time1: hoTime || null,
        day2: hoAltDate || null,
        time2: hoAltTime || null,
        day3: hoAlt2Date || null,
        time3: hoAlt2Time || null,
        first_name: hoFirstName.trim() || null,
        last_name: hoLastName.trim() || null,
        contact_email: hoEmailValid ? hoEmail.trim() : null,
        client_phone: hoPhoneValid ? hoPhone.trim() : null,
        languages: spokenLangs.join(", "),
        user_id: userId,
        wa_number: waNumber,
        message_text: waMsg,
      });
      waRequestIdRef.current = logged.id;
      if (logged.error) {
        trackFunnel("wizard_submit_error", {
          flow: "studio-handoff",
          studio: partner.slug || partner.id,
          massage: hoService ? servicePrimaryName(hoService) : null,
          area: (partner as any).district || null,
          error: logged.error,
        }, partner.slug || partner.id);
      } else {
        trackFunnel("wizard_submit_ok", {
          flow: "studio-handoff",
          studio: partner.slug || partner.id,
          massage: hoService ? servicePrimaryName(hoService) : null,
          area: (partner as any).district || null,
          request_id: logged.id,
        }, partner.slug || partner.id);
      }
    };


    const waLink = conciergeWhatsappUrl(waMsg);
    const websiteUrl = (() => {
      if (!partner.website) return null;
      const w = String(partner.website).trim();
      return /^https?:\/\//i.test(w) ? w : `https://${w}`;
    })();
    const googleRating = (partner as any).google_rating != null ? Number((partner as any).google_rating) : null;
    // Handoff wizard navigation.
    const hoGo = (n: number) => {
      setHoStep(n);
      setHoMaxStep(m => Math.max(m, n));
      // Bring the newly revealed step into view. Without this the next step
      // renders below the fold and the tap looks like it did nothing.
      requestAnimationFrame(() => {
        const el = hoPanelRef.current;
        if (el) {
          try {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          } catch { /* fall through */ }
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    };
    const googleReviews = (partner as any).google_reviews != null ? Number((partner as any).google_reviews) : null;
    return (
      <div className="min-h-screen p-4 pb-28 relative" style={{ background: "#FAF6F1" }}>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-3"><AccountHeaderLink /><LanguageFlagToggle /></div>
        <div className="w-full max-w-md min-[900px]:max-w-[1100px] mx-auto rounded-2xl overflow-hidden text-center min-[900px]:text-left" style={{ background: "#ffffff", boxShadow: "0 6px 24px rgba(80,44,20,0.08)" }}>
          <div className="flex items-center justify-center gap-2 py-3 px-4" style={{ background: "#B85C38", borderRadius: "1rem 1rem 0 0" }}>
            <img src="/brand/mc-avatar-cream.png" alt="Massage Club" width={26} height={26} className="rounded-full" />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: "2px" }}>MASSAGE CLUB</span>
          </div>
          <div className="px-6 py-7 min-[900px]:grid min-[900px]:grid-cols-[1fr_400px] min-[900px]:gap-10 min-[900px]:items-start">
            {/* LEFT: studio identity + menu */}
            <div>
            <h1 className="font-display text-3xl min-[900px]:text-4xl font-semibold leading-tight mb-3" style={{ color: "#2b2b2b" }}>{partner.business_name}</h1>
            {partner.address && (
              <p className="text-sm min-[900px]:text-base flex items-center justify-center min-[900px]:justify-start gap-1 mb-2" style={{ color: "#5a4736" }}>
                <span>📍</span>
                <span>{partner.address}</span>
              </p>
            )}
            <div className="mb-2 flex justify-center min-[900px]:justify-start">{distanceBlock(false)}</div>
            {rating ? (
              <p className="text-sm min-[900px]:text-base font-semibold mb-5 flex items-center justify-center min-[900px]:justify-start gap-1" style={{ color: "#5a4736" }}>
                <span style={{ color: "#E0A458" }}>★</span>
                {rating.avg.toFixed(1)} <span className="font-normal" style={{ color: "#7A7068" }}>({rating.count})</span>
              </p>
            ) : googleRating != null ? (
              <p className="text-sm min-[900px]:text-base font-semibold mb-5 flex items-center justify-center min-[900px]:justify-start gap-1" style={{ color: "#5a4736" }}>
                <span style={{ color: "#E0A458" }}>★</span>
                {googleRating.toFixed(1)}
                {googleReviews != null && (
                  <span className="font-normal" style={{ color: "#7A7068" }}>({googleReviews} · Google)</span>
                )}
              </p>
            ) : null}
            <p className="text-sm min-[900px]:text-base mb-5" style={{ color: "#5a4736" }}>
              {c.notOnClub}
            </p>
            <div className="mb-5">
              <HowBookingWorksVideo size="sm" label={c.howWeBook} />
              <p className="mt-2 text-center text-xs min-[900px]:text-sm" style={{ color: "#7A7068" }}>
                {c.howWeBook}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (hoServiceId) { hoGo(2); return; }
                scrollToServices();
              }}
              className="w-full min-[900px]:w-auto inline-flex flex-col items-center justify-center min-h-[52px] px-7 rounded-full font-semibold text-white motion-safe:transition hover:opacity-90"
              style={{ background: "#B85C38" }}
            >
              <span className="inline-flex items-center gap-2"><MessageCircle size={18} /> {c.bookMassage}</span>
            </button>
            {!hoServiceId && (
              <p className="text-xs mt-2" style={{ color: "#9E9387" }}>
                {c.pickServiceFirst}
              </p>
            )}

            {profile.services.length > 0 && (
              <div id="mc-services-menu" className="mt-6 text-left">
                <p className="text-xs min-[900px]:text-sm font-bold uppercase mb-2" style={{ color: "#B85C38", letterSpacing: "2px" }}>{c.servicesLabel}</p>
                {/* Extra bottom padding so the last row clears the WhatsApp bubble and the sticky bar. */}
                <div role="radiogroup" aria-label="Services" className="rounded-xl p-3 min-[900px]:p-4 pb-24 min-[900px]:pb-4 space-y-2 min-[900px]:space-y-3"
                  style={{ background: "#FAF6F1" }}>

                  {profile.services.map((s: any) => {
                    const selected = hoServiceId === s.id;
                    const dur = Number(s.duration) > 0 ? Number(s.duration) : null;
                    const price = Number(s.price);
                    return (
                      <div
                        key={s.id}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={0}
                        onClick={() => { setHoServiceId(selected ? "" : s.id); if (!selected) trackEvent("wizard_service_selected", { slug: partner.slug || partner.id, meta: { service: servicePrimaryName(s) } }); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHoServiceId(selected ? "" : s.id); } }}
                        className="cursor-pointer rounded-xl border-2 px-3 py-2.5 min-[900px]:px-4 min-[900px]:py-3.5 flex items-start justify-between gap-3 text-sm min-[900px]:text-base motion-safe:transition"
                        style={{ color: "#5a4736", borderColor: selected ? "#B85C38" : "#E6DCCF", background: selected ? "#FBEFE8" : "#ffffff" }}
                      >
                        <span className="min-w-0 flex items-start gap-2">
                          {selected && <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#B85C38" }} />}
                          <span className="min-w-0">
                            <span className="block font-semibold" style={{ color: "#2b2b2b" }}>
                              {servicePrimaryName(s)}
                              {dur ? ` · ${dur} min` : ""}
                            </span>
                            {serviceSecondaryName(s) && (
                              <span className="block text-xs min-[900px]:text-sm" style={{ color: "#8a7460" }}>{serviceSecondaryName(s)}</span>
                            )}
                          </span>
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-2">
                          {Number.isFinite(price) && price > 0 && (
                            <span className="font-semibold" style={{ color: "#2b2b2b" }}>€{price}</span>
                          )}
                          <MassageTypeInfoButton names={[(s as any).name_en, s.name, (s as any).type]} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            </div>

            {/* RIGHT: the booking request form + CTA (sticky on desktop) */}
            <div ref={hoPanelRef} className="min-[900px]:sticky min-[900px]:top-4 text-left scroll-mt-4">
            {waLink && (
              <>
                <Stepper steps={pickCopy(HANDOFF_STEPS_COPY, lang)} current={hoStep} maxReached={hoMaxStep} onGo={hoGo} />
                {/* The only Continue: one sticky bar, never an inline duplicate */}
                {hoStep === 1 && (
                  <StickyContinue
                    ready={!!hoServiceId}
                    onNext={() => hoGo(2)}
                    summary={hoSummaryLine}
                    note={hoServiceId ? undefined : c.chooseServiceContinue}
                    inlineRef={hoInlineContinueRef}
                  />
                )}
                {hoStep === 2 && <StickyContinue ready onNext={() => hoGo(3)} summary={hoSummaryLine} />}
                {hoStep === 3 && (
                  <StickyContinue
                    ready={hoDetailsReady}
                    onNext={() => hoGo(4)}
                    summary={hoSummaryLine}
                    note={hoDetailsReady ? undefined : CONTACT_COPY[lang].needContact}
                  />
                )}


                <div className="rounded-2xl p-4 min-[900px]:p-5 mt-3 mb-4" style={{ background: "#FAF6F1" }}>
                  <p className="text-xs min-[900px]:text-sm font-bold uppercase mb-3" style={{ color: "#B85C38", letterSpacing: "2px" }}>
                    {t("app.handoff.prefTitle")}
                  </p>

                  {/* STEP 1: slim summary of the selection made in the menu */}
                  {hoStep === 1 && (
                    <div>
                      <Link
                        to={quizHref}
                        className="w-full text-left rounded-xl border border-dashed px-3 min-[900px]:px-4 py-2.5 min-[900px]:py-3.5 flex items-center gap-2 motion-safe:transition hover:bg-[#F6EFE6]"
                        style={{ borderColor: "#B85C38", background: "#FAF6F1" }}
                      >
                        <Sparkles size={16} className="min-[900px]:size-5" style={{ color: "#B85C38", flexShrink: 0 }} />
                        <span className="min-w-0">
                          <span className="block text-sm min-[900px]:text-base font-semibold" style={{ color: "#B85C38" }}>{c.takeQuiz}</span>
                        </span>
                      </Link>

                      <div className="mt-3 rounded-xl border px-3 py-3 min-[900px]:px-4 min-[900px]:py-4" style={{ borderColor: "#E6DCCF", background: "#ffffff" }}>
                        {hoService ? (
                          <>
                            <span className="block text-sm min-[900px]:text-base font-semibold" style={{ color: "#2b2b2b" }}>
                              {servicePrimaryName(hoService)}
                            </span>
                            {serviceSecondaryName(hoService) && (
                              <span className="block text-xs min-[900px]:text-sm" style={{ color: "#8a7460" }}>{serviceSecondaryName(hoService)}</span>
                            )}
                            <span className="mt-1 block text-sm" style={{ color: "#5a4736" }}>
                              {Number((hoService as any).duration) > 0 ? `${Number((hoService as any).duration)} min` : ""}
                              {Number((hoService as any).duration) > 0 && hasPrice ? " · " : ""}
                              {hasPrice ? `€${hoPrice}` : ""}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="block text-sm min-[900px]:text-base font-semibold" style={{ color: "#7A7068" }}>{c.chooseServiceContinue}</span>
                          </>
                        )}
                      </div>

                      <button
                        ref={hoInlineContinueRef}
                        type="button"
                        onClick={() => { if (!hoServiceId) { scrollToServices(); return; } hoGo(2); }}
                        className="mt-3 w-full rounded-full px-5 py-3 text-sm min-[900px]:text-base font-semibold text-white motion-safe:transition"
                        style={{ background: "#B85C38" }}
                      >
                        {c.continueLabel}
                      </button>
                    </div>

                  )}

                  {/* STEP 2: day and time */}
                  {hoStep === 2 && (
                    <div className="space-y-3 min-[900px]:space-y-4">
                      <div className="rounded-2xl px-3 py-2.5" style={{ background: "#F4EEE6" }}>
                        <p className="text-xs min-[900px]:text-sm leading-snug" style={{ color: "#5C5349" }}>
                          {c.contactStep}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefDate")}</span>
                        <div className="mt-1.5">
                          <DayStrip value={hoDate} onChange={(v: string) => { setHoDate(v); trackFunnel("wizard_day_selected", { flow: "studio-handoff", day: v, massage: hoService ? servicePrimaryName(hoService) : null, area: (partner as any).district || null }, partner.slug || partner.id); }} label={t("app.handoff.prefDate")} />
                        </div>
                      </div>
                      <div>
                        <span className="text-xs min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefTime")}</span>
                        <div className="mt-1.5">
                          <TimePills value={hoTime} onChange={(v: string) => { setHoTime(v); trackFunnel("wizard_time_selected", { flow: "studio-handoff", time: v, massage: hoService ? servicePrimaryName(hoService) : null, area: (partner as any).district || null }, partner.slug || partner.id); }} label={t("app.handoff.prefTime")} />
                        </div>
                      </div>
                      {!altOpen ? (
                        <button
                          type="button"
                          onClick={() => setAltOpen(true)}
                          className="text-sm min-[900px]:text-base font-semibold underline underline-offset-2"
                          style={{ color: "#B85C38" }}
                        >
                          {c.addSecondChoice}
                        </button>
                      ) : (
                        <>
                          <div>
                            <span className="text-xs min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefAlt")}</span>
                            <div className="mt-1.5 space-y-2 min-[900px]:space-y-3">
                              <DayStrip value={hoAltDate} onChange={setHoAltDate} label={t("app.handoff.prefAlt")} />
                              <TimePills value={hoAltTime} onChange={setHoAltTime} label={t("app.handoff.prefAlt")} />
                            </div>
                          </div>
                          {!alt2Open ? (
                            <button
                              type="button"
                              onClick={() => setAlt2Open(true)}
                              className="text-sm min-[900px]:text-base font-semibold underline underline-offset-2"
                              style={{ color: "#B85C38" }}
                            >
                              {c.addThirdChoice}
                            </button>
                          ) : (
                            <div>
                              <span className="text-xs min-[900px]:text-base" style={{ color: "#7A7068" }}>
                                {c.thirdChoice}
                              </span>
                              <div className="mt-1.5 space-y-2 min-[900px]:space-y-3">
                                <DayStrip value={hoAlt2Date} onChange={setHoAlt2Date} label={c.thirdChoice} />
                                <TimePills value={hoAlt2Time} onChange={setHoAlt2Time} label={c.thirdChoice} />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <WizardNav
                        onBack={() => hoGo(1)}
                        skip={() => hoGo(3)}
                      />
                    </div>
                  )}

                  {/* STEP 3: your details */}
                  {hoStep === 3 && (
                    <div className="space-y-3 min-[900px]:space-y-4">
                      <div>
                        {!hoPeopleOpen ? (
                          <button
                            type="button"
                            onClick={() => setHoPeopleOpen(true)}
                            className="text-xs hover:opacity-80 transition-opacity"
                            style={{ color: "#9E9387" }}
                          >
                            {c.moreThanOne}
                          </button>
                        ) : (
                          <div className="flex flex-wrap gap-2 justify-center min-[900px]:justify-start">
                            {PEOPLE_OPTIONS.map((n) => {
                              const on = hoPeople === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => setHoPeople(n)}
                                  className={`h-9 min-w-[2.5rem] px-3 rounded-lg border text-sm font-medium ${
                                    on ? "border-[#B85C38] bg-[#FDF3EC] text-[#B85C38]" : "border-gray-200 bg-white text-gray-600"
                                  }`}
                                >
                                  {n}
                                </button>
                              );
                            })}
                            <p className="w-full mt-1 text-xs" style={{ color: "#9E9387" }}>
                              {c.groupCheck}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                        <input
                          value={hoFirstName}
                          onChange={(e) => setHoFirstName(e.target.value)}
                          placeholder={c.firstName}
                          autoComplete="given-name"
                          className="w-full h-12 min-[900px]:h-14 px-4 rounded-xl border border-gray-200 bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#B85C38]"
                        />
                        <input
                          value={hoLastName}
                          onChange={(e) => setHoLastName(e.target.value)}
                          placeholder={c.lastName}
                          autoComplete="family-name"
                          className="w-full h-12 min-[900px]:h-14 px-4 rounded-xl border border-gray-200 bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#B85C38]"
                        />
                      </div>
                      <div>
                        <input
                          value={hoPhone}
                          onChange={(e) => setHoPhone(e.target.value)}
                          placeholder={c.waPhone}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          aria-invalid={hoContact.phoneValid === false}
                          className={`w-full h-12 min-[900px]:h-14 px-4 rounded-xl border bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#B85C38] ${
                            hoContact.phoneValid === false ? "border-2 border-[#B03A2E]" : "border-gray-200"
                          }`}
                        />
                        {hoContact.phoneValid === false ? (
                          <p className="mt-1.5 text-xs min-[900px]:text-sm" style={{ color: "#B03A2E" }}>
                            {CONTACT_COPY[lang].badPhone}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs min-[900px]:text-sm" style={{ color: "#7A7068" }}>
                            {c.reachYouWa}
                          </p>
                        )}
                      </div>
                      <div>
                        <input
                          value={hoEmail}
                          onChange={(e) => setHoEmail(e.target.value)}
                          placeholder={c.email}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          aria-invalid={hoContact.emailValid === false}
                          className={`w-full h-12 min-[900px]:h-14 px-4 rounded-xl border bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#B85C38] ${
                            hoContact.emailValid === false ? "border-2 border-[#B03A2E]" : "border-gray-200"
                          }`}
                        />
                        {hoContact.emailValid === false && (
                          <p className="mt-1.5 text-xs min-[900px]:text-sm" style={{ color: "#B03A2E" }}>
                            {CONTACT_COPY[lang].badEmail}
                          </p>
                        )}
                      </div>
                      <div>

                        <p className="text-xs font-semibold mb-2 min-[900px]:text-sm" style={{ color: "#5a4736" }}>
                          {c.anythingElse}
                        </p>
                        <textarea
                          value={hoNotes}
                          onChange={(e) => setHoNotes(e.target.value)}
                          placeholder={c.optional}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#B85C38] resize-none h-20 min-[900px]:h-24"
                        />
                      </div>
                      {!hoDetailsReady && (
                        <p className="text-xs min-[900px]:text-sm" style={{ color: "#7A7068" }}>
                          {CONTACT_COPY[lang].needContact}
                        </p>
                      )}

                      <WizardNav
                        onBack={() => hoGo(2)}
                        onNext={() => hoGo(4)}
                        disabled={!hoDetailsReady}
                        hint={CONTACT_COPY[lang].needContact}
                      />
                    </div>
                  )}

                  {/* STEP 4: review and send */}
                  {hoStep === 4 && !waTapped && (
                    <div className="space-y-3 min-[900px]:space-y-4">
                      <div className="rounded-xl bg-white p-3 min-[900px]:p-4 space-y-2 min-[900px]:space-y-3 border" style={{ borderColor: "#E6DCCF" }}>
                        <SummaryRow label={c.service} value={hoService ? servicePrimaryName(hoService) : null} placeholder={c.pickAService} />
                        <SummaryRow label={c.day} value={hoDate ? esDate(hoDate) : null} placeholder={c.anyDay} />
                        <SummaryRow label={c.time} value={hoTime || null} placeholder={c.anyTime} />
                        <SummaryRow label={c.secondChoice} value={hoAltDate && hoAltTime ? `${esDate(hoAltDate)} ${hoAltTime}` : null} placeholder={c.none} />
                        <SummaryRow label={c.name} value={hoName.trim() || null} placeholder={c.notProvided} />
                        <SummaryRow label={c.contact} value={[hoPhone.trim(), hoEmail.trim()].filter(Boolean).join(" · ") || null} placeholder={c.notProvided} />
                        <SummaryRow label={c.price} value={hasPrice ? `€${hoPrice}` : null} placeholder={c.askStudio} />
                      </div>
                      {hoServiceId ? (
                        <button
                          type="button"
                          onClick={async () => {
                            // Open a blank tab synchronously while the user gesture is active,
                            // then log the lead and point the tab at WhatsApp.
                            const win = window.open("about:blank", "_blank");
                            await trackWhatsappIntent();
                            if (win) win.location.href = waLink;
                            // Popup blocked: try a direct new-tab open; never navigate this
                            // frame to wa.me (X-Frame-Options blocks it in embeds).
                            else window.open(waLink, "_blank", "noopener,noreferrer");
                          }}
                          className="w-full inline-flex flex-col items-center justify-center h-14 min-[900px]:h-16 px-6 rounded-2xl font-semibold"
                          style={{ background: "#B85C38", color: "#fff" }}
                        >
                          <span className="inline-flex items-center gap-2 min-[900px]:text-lg"><MessageCircle size={18} /> {c.requestWhatsapp}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={scrollToServices}
                          className="w-full inline-flex flex-col items-center justify-center h-14 min-[900px]:h-16 px-6 rounded-2xl font-semibold"
                          style={{ background: "#B85C38", color: "#fff" }}
                        >
                          <span className="inline-flex items-center gap-2 min-[900px]:text-lg"><MessageCircle size={18} /> {c.pickAMassage}</span>
                        </button>
                      )}
                      <p className="text-xs min-[900px]:text-sm text-center" style={{ color: "#7A7068" }}>{t("app.handoff.waReassurance")}</p>
                      <button type="button" onClick={() => hoGo(3)} className="text-sm min-[900px]:text-base font-semibold underline underline-offset-2" style={{ color: "#8a7460" }}>
                        {c.back}
                      </button>
                    </div>
                  )}

                  {/* STEP 4: confirmation after WhatsApp is opened */}
                  {hoStep === 4 && waTapped && (
                    <div className="space-y-4 min-[900px]:space-y-5 text-center">
                      <div className="mx-auto flex h-14 w-14 min-[900px]:h-16 min-[900px]:w-16 items-center justify-center rounded-full" style={{ background: "#EAF3E7" }}>
                        <MessageCircle size={28} className="min-[900px]:size-8" style={{ color: "#3F6B36" }} />
                      </div>
                      <div>
                        <h3 className="font-display text-xl min-[900px]:text-2xl font-semibold" style={{ color: "#2b2b2b" }}>{c.checkingWithStudio}</h3>
                      </div>
                      <div className="rounded-xl p-4 min-[900px]:p-5 text-left" style={{ background: "#FAF6F1" }}>
                        <p className="text-sm min-[900px]:text-base leading-snug" style={{ color: "#5a4736" }}>
                          {c.waitTime}
                        </p>
                      </div>
                      <AccountOfferBlock
                        firstName={hoFirstName.trim()}
                        lastName={hoLastName.trim()}
                        email={hoEmail.trim()}
                        phone={hoPhone.trim()}
                        requestId={waRequestIdRef.current}
                        source="studio-handoff"
                      />
                      <Link
                        to="/studios"
                        className="inline-flex flex-col items-center justify-center w-full h-12 min-[900px]:h-14 px-6 rounded-full border-2 font-semibold bg-white hover:bg-[#FAF6F1] transition"
                        style={{ borderColor: "#B85C38", color: "#B85C38" }}
                      >
                        <span className="inline-flex items-center gap-2">{c.browseOtherStudios}</span>
                      </Link>
                      <p className="text-xs min-[900px]:text-sm" style={{ color: "#8a7460" }}>
                        {c.waReassuranceStudios}
                      </p>
                      <button type="button" onClick={() => hoGo(3)} className="text-sm min-[900px]:text-base font-semibold underline underline-offset-2" style={{ color: "#8a7460" }}>
                        {c.back}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="flex flex-col items-center gap-3 w-full">
              {!waLink && studioNumber && (
                <a href={telHref(studioNumber) || undefined} className="w-full inline-flex flex-col items-center justify-center h-12 px-6 rounded-full font-semibold" style={{ background: "#B85C38", color: "#fff" }}>
                  <span className="inline-flex items-center gap-2"><Phone size={18} /> {t("app.handoff.callStudio")}</span>
                  <span className="text-xs font-normal opacity-90">{t("app.handoff.callStudioSub")}</span>
                </a>
              )}
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2 hover:opacity-80" style={{ color: "#8a7460" }}>
                  {t("app.handoff.visitWebsite")}
                </a>
              )}

            </div>
            </div>


            <div className="mt-6 text-xs min-[900px]:col-span-2 text-center" style={{ color: "#8a7460" }}>
              {c.footerCredit}
            </div>
          </div>
        </div>
      </div>
    );
  }


  // Name plus at least one valid way to reach them (WhatsApp number OR email).
  const contact = contactOk(phone, email);
  const emailValid = contact.emailValid === true;
  const hasContact = contact.ok;
  const canBook = !!(service && date && time && nameComplete && hasContact);

  const prettyDay = date ? `${dayShort(date, lang)} ${date.getDate()} ${monShort(date, lang)}` : null;




  // Wizard navigation. Every step is shown, nothing is skipped automatically.
  const goStep = (n: number) => {
    // Step-shown events fire from the effect above; this only records progress.
    if (n > step) trackFunnel("wizard_step_completed", { flow: "studio", from: pickCopy(BOOKING_STEPS_COPY, lang)[step - 1] ?? String(step), to: n }, partner?.slug || studioId);
    setStep(n);
    setMaxStep(m => Math.max(m, n));
    setStepError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitDetailsStep = () => {
    if (!nameComplete) {
      setStepError(c.addNameContact);
      nameRef.current?.focus();
      return;
    }
    if (contact.phoneValid === false) {
      setStepError(CONTACT_COPY[lang].badPhone);
      return;
    }
    if (contact.emailValid === false) {
      setStepError(CONTACT_COPY[lang].badEmail);
      emailRef.current?.focus();
      return;
    }
    if (!hasContact) {
      setStepError(CONTACT_COPY[lang].needContact);
      emailRef.current?.focus();
      return;
    }

    goStep(5);
  };


  const handleBook = async () => {
    if (!canBook) return;
    trackEvent("booking_submitted", { slug: partner?.slug || studioId });
    trackFunnel("wizard_submit_attempt", {
      flow: "studio",
      studio: partner?.slug || studioId,
      massage: service ? servicePrimaryName(service) : null,
      area: (partner as any)?.district || null,
      people,
    }, partner?.slug || studioId);
    setSubmitting(true);
    setError("");
    const comfortPrefs = {
      conversation: conversationPref || customerProfile?.conversation_pref || null,
      music: customerProfile?.music_pref || null,
      temperature: customerProfile?.temperature_pref || null,
      scent: customerProfile?.scent_pref || null,
      lighting: customerProfile?.lighting_pref || null,
      notes: customerProfile?.comfort_notes || null,
    };
    const clientPreferences = {
      pressure,
      focus_areas: focusAreas,
      conversation: conversationPref || customerProfile?.conversation_pref || null,
      preferred_therapist_gender: customerProfile?.preferred_therapist_gender || null,
      massage_goals: customerProfile?.massage_goals || null,
    };


    try {
      const { data, error } = await supabase.from("bookings").insert({
        ...getSource(),
        client_name: name.trim(),
        client_phone: phone.trim(),
        client_email: email.trim() || null,
        spa_name: partner.business_name,
        massage_type: service.type || service.name,
        service_id: service.id,
        partner_id: partner.id,
        booking_date: isoDate(date!),
        booking_time: time,
        duration: service.duration ?? 60,
        price: total,
        pressure,
        focus_areas: focusAreas,
        add_ons: addonNames,
        notes: [
          people !== "1" ? `Personas: ${people}` : null,
          altDate2 && altTime2 ? `Alt 2: ${prettyDayOf(altDate2)} ${altTime2}` : null,
          altDate3 && altTime3 ? `Alt 3: ${prettyDayOf(altDate3)} ${altTime3}` : null,
          notes.trim() || null,
        ].filter(Boolean).join(" - ") || null,
        allergies: profileAllergies || null,
        health_notes: profileHealthNotes || null,
        status: "pending",
        user_id: userId,
        lang: (localStorage.getItem("mm-lang") || navigator.language || "es").slice(0, 2),
        comfort_prefs: comfortPrefs,
        contraindications: Array.isArray(customerProfile?.medical_conditions)
          ? customerProfile.medical_conditions.join(", ")
          : (customerProfile?.medical_conditions || null),
        medications: customerProfile?.medications || null,
        avoid_areas: customerProfile?.avoid_areas || null,
        reason_for_visit: customerProfile?.reason_for_visit || null,
        is_first_visit: customerProfile?.is_first_massage ?? null,
        client_preferences: clientPreferences,
        marketing_opt_in: false,
        marketing_opt_in_at: null,
      }).select("id").single();


      if (error) throw new Error(error.message);

      // Fire the notification emails directly (more reliable than the DB webhook).
      try {
        await supabase.functions.invoke("notify-studio", {
          body: {
            type: "INSERT",
            table: "bookings",
            record: {
              id: data.id,
              partner_id: partner.id,
              client_name: name.trim(),
              client_phone: phone.trim(),
              client_email: email.trim() || null,
              massage_type: service.type || service.name,
              booking_date: isoDate(date!),
              booking_time: time,
              duration: service.duration ?? 60,
              spa_name: partner.business_name,
              pressure,
              focus_areas: focusAreas,
              add_ons: addonNames,
              notes: notes.trim() || null,
              allergies: profileAllergies || null,
              health_notes: profileHealthNotes || null,
              lang: (localStorage.getItem("mm-lang") || navigator.language || "es").slice(0, 2),
              comfort_prefs: comfortPrefs,
              contraindications: Array.isArray(customerProfile?.medical_conditions)
                ? customerProfile.medical_conditions.join(', ')
                : (customerProfile?.medical_conditions || null),
              medications: customerProfile?.medications || null,
              avoid_areas: customerProfile?.avoid_areas || null,
              reason_for_visit: customerProfile?.reason_for_visit || null,
              is_first_visit: customerProfile?.is_first_massage ?? null,
              client_preferences: clientPreferences,
            },
          },
        });
      } catch (notifyErr) {
        console.error("[booking] notify-studio invoke failed:", notifyErr);
      }

      setSlotCounts(prev => {
        const next = new Map(prev);
        const key = `${isoDate(date!)}__${time}`;
        next.set(key, (next.get(key) || 0) + 1);
        return next;
      });
      
      // Fire and forget: passwordless account for guests who opted in.
      if (!userId && createAccount && email.trim()) {
        requestAccountSignup({ email: email.trim(), name: firstName.trim(), lang: siteLang });
      }

      trackFunnel("wizard_submit_ok", {
        flow: "studio",
        studio: partner?.slug || studioId,
        massage: service ? servicePrimaryName(service) : null,
        area: (partner as any)?.district || null,
        request_id: data?.id ?? null,
      }, partner?.slug || studioId);
      setDone({ ref: `MR-2026-${String(data.id).padStart(4, "0")}` });

    } catch (e: any) {
      const msg = String(e?.message || "");
      trackFunnel("wizard_submit_error", {
        flow: "studio",
        studio: partner?.slug || studioId,
        massage: service ? servicePrimaryName(service) : null,
        area: (partner as any)?.district || null,
        error: (msg || "unknown_error").slice(0, 200),
      }, partner?.slug || studioId);
      if (/fully booked/i.test(msg)) {
        // Refresh slot counts from the server so the UI reflects reality.
        try {
          const { data } = await supabase.rpc("booked_slot_counts", { p_partner_id: partner.id });
          const counts = new Map<string, number>();
          for (const b of (data as any[]) || []) {
            const key = `${b.booking_date}__${b.booking_time}`;
            counts.set(key, (counts.get(key) || 0) + 1);
          }
          setSlotCounts(counts);
        } catch {}
        setTime("");
        setError(c.slotFilled);
      } else {
        setError(msg || c.somethingWrong);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const bookingWaNumber = resolveWhatsappNumber(partner as any);
  const esLongDate = (d: Date | null) => {
    if (!d) return null;
    try {
      return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(d);
    } catch {
      return null;
    }
  };
  const bookingWaMsg = conciergePrefill({
    lang: siteLang,
    studio: partner.business_name,
    service: service ? servicePrimaryName(service) : null,
    duration: (service as any)?.duration ?? null,
    price: (service as any)?.price ?? null,
    when1: [esLongDate(date), time ? `a las ${time}` : ""].filter(Boolean).join(" ") || null,
    when2:
      [esLongDate(altDate2), altTime2 ? `a las ${altTime2}` : ""].filter(Boolean).join(" ") || null,
    name: name || null,
    languages: spokenLangs,
  });
  const bookingWaHref = conciergeWhatsappUrl(bookingWaMsg);


  return (
    <div className="min-h-screen bg-[#FAF6F1] relative">
      <div className="absolute top-3 right-3 z-30 flex items-center gap-3"><AccountHeaderLink /><LanguageFlagToggle /></div>
      {/* Hero — real cover photo when the studio has one, otherwise the themed fallback */}
      <div
        className={`relative bg-gradient-to-br from-[#C4622D] to-[#5b0a16] ${
          partner.cover_url
            ? "aspect-[16/10] max-h-[380px] overflow-hidden rounded-b-3xl"
            : "h-44"
        }`}
      >
        <img
          src={studioImage({
            id: partner.id,
            name: partner.business_name,
            imageUrl: partner.cover_url || null,
            services: (profile.services || []).map((s: any) => `${s.name ?? ""} ${s.type ?? ""}`),
            description: partner.description,
          }, 1200)}
          alt={partner.cover_url ? partner.business_name : ""}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${partner.cover_url ? "" : "opacity-60"}`}
          onError={(e) => studioImageFallback(e, 1200)}
        />
        {partner.cover_url && <div className="absolute inset-0 bg-black/25" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-4 left-0 right-0 px-5 max-w-lg mx-auto">
          <div className="flex items-end gap-3">
            {partner.logo_url && (
              <img src={partner.logo_url} alt="" className="h-14 w-14 rounded-2xl object-cover border-2 border-white/80 shadow-lg flex-shrink-0" />
            )}
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold mb-2">
                <Sparkles size={12} /> {c.bookYourMassage}
              </div>
              <h1 className="font-display text-3xl font-semibold text-white leading-tight">{partner.business_name}</h1>
              {rating ? (
                <p className="text-white/95 text-sm font-semibold mt-0.5 flex items-center gap-1">
                  <span style={{ color: "#E0A458" }}>★</span>
                  {rating.avg.toFixed(1)} <span className="text-white/70 font-normal">({rating.count})</span>
                </p>
              ) : (partner as any).google_rating != null ? (
                <p className="text-white/95 text-sm font-semibold mt-0.5 flex items-center gap-1">
                  <span style={{ color: "#E0A458" }}>★</span>
                  {Number((partner as any).google_rating).toFixed(1)}
                  {(partner as any).google_reviews != null && (
                    <span className="text-white/70 font-normal">({(partner as any).google_reviews} · Google)</span>
                  )}
                </p>
              ) : null}
              {partner.address && (
                <p className="text-white/80 text-sm flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {partner.address}
                </p>
              )}
              {distanceBlock(true)}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg min-[900px]:max-w-[1100px] mx-auto px-5 py-5 pb-28">
        {/* Stepper: always visible so nobody misses a step */}
        <Stepper steps={pickCopy(BOOKING_STEPS_COPY, lang)} current={step} maxReached={maxStep} onGo={goStep} />

        {/* Always reachable Continue, so the primary action never hides below the fold */}
        {step === 1 && <StickyContinue ready={!!service} onNext={() => goStep(2)} />}
        {step === 2 && <StickyContinue ready={!!date && !!time} onNext={() => goStep(3)} />}
        {step === 3 && <StickyContinue ready onNext={() => goStep(4)} />}
        {step === 4 && (
          <StickyContinue ready={nameComplete && hasContact} onNext={submitDetailsStep} />
        )}
        {step === 5 && (
          <StickyContinue
            ready={canBook}
            busy={submitting}
            onNext={handleBook}
            label={`${instantConfirm ? c.bookNow : c.requestBooking} · €${total}`}
            badge={instantConfirm ? { text: c.instantConfirmation } : undefined}
            note={c.freeToBook}
          />
        )}



        {/* Mobile: slim running summary under the stepper */}
        <div className="min-[900px]:hidden sticky top-0 z-20 -mx-5 mt-2 px-5 py-2 bg-[#FAF6F1]/95 backdrop-blur border-y border-[#EADFD2]">
          <p className="text-xs truncate">
            <span className={service ? "font-semibold text-gray-800" : "text-gray-400"}>{service ? servicePrimaryName(service) : c.pickService}</span>
            <span className="text-gray-300"> · </span>
            <span className={prettyDay ? "font-semibold text-gray-800" : "text-gray-400"}>{prettyDay || c.pickDay}</span>
            <span className="text-gray-300"> · </span>
            <span className={time ? "font-semibold text-gray-800" : "text-gray-400"}>{time || c.pickTime}</span>
            <span className="text-gray-300"> · </span>
            <span className={service && total > 0 ? "font-semibold text-[#C4622D]" : "text-gray-400"}>{service && total > 0 ? `€${total}` : c.priceLabel}</span>
          </p>
        </div>

        <div className="mt-5 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_360px] min-[900px]:gap-8 min-[900px]:items-start">
          {/* LEFT: one step at a time */}
          <div className="space-y-5 min-w-0">

            {/* STEP 1: service */}
            {step === 1 && (
              <div ref={serviceRef}>
                <Section step="1" title={c.chooseService}>
                  {partner.description && <p className="text-sm min-[900px]:text-base text-gray-600 mb-4 min-[900px]:mb-5">{partner.description}</p>}
                  <StudioGallery items={partner.gallery || []} />
                  {!rebookId && (
                    <BookAgainBanner
                      partnerId={partner.id}
                      onRebook={(bookingId) => setSearchParams({ rebook: bookingId, step: "2" })}
                    />
                  )}
                  {rebookMode && service && (
                    <div className="rounded-2xl border-2 border-[#C4622D] bg-[#C4622D]/5 p-4 min-[900px]:p-5 mb-3 min-[900px]:mb-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="inline-flex items-center gap-1.5 bg-[#C4622D] text-white px-2.5 py-1 rounded-full text-[11px] min-[900px]:text-xs font-semibold">
                          <Sparkles size={11} /> Your usual booking
                        </div>
                        <button onClick={() => setRebookMode(false)} className="text-xs min-[900px]:text-sm font-semibold text-[#C4622D] underline underline-offset-2">
                          Change / Cambiar
                        </button>
                      </div>
                      <p className="font-semibold text-gray-900 min-[900px]:text-base">{servicePrimaryName(service)}</p>
                      {serviceSecondaryName(service) && <p className="text-xs min-[900px]:text-sm text-gray-500">{serviceSecondaryName(service)}</p>}
                    </div>
                  )}
                  {!rebookMode && (
                    <div className="space-y-2">
                      <Link
                        to={quizHref}
                        className="w-full flex items-center gap-2 p-4 min-[900px]:p-5 rounded-2xl border border-dashed border-[#C4622D] bg-[#FAF6F1] motion-safe:transition hover:bg-[#F6EFE6]"
                      >
                        <Sparkles size={18} className="text-[#C4622D] flex-shrink-0" />
                        <span className="min-w-0 text-left">
                          <span className="block text-sm min-[900px]:text-base font-semibold text-[#C4622D]">{c.notSureQuiz}</span>
                        </span>
                      </Link>
                      {profile.services.map(s => (
                        <div key={s.id}>
                          <button onClick={(e) => { setServiceId(s.id); trackEvent("wizard_service_selected", { slug: partner?.slug || studioId, meta: { service: servicePrimaryName(s) } }); scrollIntoViewGently(e.currentTarget); }}
                            className={`card-auto w-full text-left p-4 min-[900px]:p-5 rounded-2xl border-2 transition ${
                              serviceId === s.id ? "border-[#C4622D] bg-[#C4622D]/5" : "border-gray-200 bg-white"
                            }`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 min-[900px]:text-lg flex items-center gap-1.5">
                                  {serviceId === s.id && <Check size={16} className="text-[#C4622D] flex-shrink-0" />}
                                  {servicePrimaryName(s)}{Number(s.duration) > 0 ? ` · ${Number(s.duration)} min` : ""}
                                </p>
                                {serviceSecondaryName(s) && <p className="text-xs min-[900px]:text-sm text-gray-500">{serviceSecondaryName(s)}</p>}
                                {s.description && <p className="text-xs min-[900px]:text-sm text-gray-500 mt-0.5">{s.description}</p>}
                                {Number(s.duration) > 0 && (
                                  <p className="text-xs min-[900px]:text-sm text-gray-400 mt-1 flex items-center gap-1"><Clock size={11} /> {Number(s.duration)} min</p>
                                )}
                              </div>
                              <div className="flex flex-shrink-0 items-center gap-2">
                                {s.price != null && Number(s.price) > 0 && (
                                  <p className="font-bold text-[#C4622D] min-[900px]:text-lg flex items-center gap-0.5"><Euro size={13} />{Number(s.price)}</p>
                                )}
                                <MassageTypeInfoButton names={[(s as any).name_en, s.name, (s as any).type]} />
                              </div>
                            </div>
                          </button>
                        </div>
                      ))}
                      {profile.services.length === 0 && <p className="text-sm min-[900px]:text-base text-gray-400">{c.noServicesYet}</p>}
                    </div>
                  )}

                </Section>
                {partner?.id && (
                  <StudioReviews
                    partnerId={String(partner.id)}
                    lang={siteLang === "es" ? "es" : "en"}
                    className="mt-4"
                  />
                )}
                <WizardNav
                  onNext={() => goStep(2)}
                  disabled={!service}
                  hint={c.chooseServiceContinue}
                />
              </div>
            )}

            {/* STEP 2: day and time */}
            {step === 2 && (
              <div ref={dateRef} className="min-w-0">
                <Section step="2" title={c.pickDayTime}>
                  <div className="mb-4 rounded-xl px-3 py-2.5 bg-[#F4EEE6]">
                    <p className="text-xs min-[900px]:text-sm leading-snug text-[#5C5349]">
                      {c.moreTimesFaster}
                    </p>
                  </div>
                  {openDates.length === 0 ? (
                    <div className="text-sm min-[900px]:text-base text-gray-500">
                      <p>{c.hoursNotPublished}</p>
                    </div>
                  ) : (
                    <div className="relative flex gap-2 w-full min-w-0 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory" style={{ scrollPaddingLeft: "4px" }}>
                      {openDates.map(d => {
                        const active = date && isoDate(d) === isoDate(date);
                        return (
                          <button key={isoDate(d)} onClick={(e) => { setDate(d); setTime(null); trackFunnel("wizard_day_selected", { flow: "studio", day: isoDate(d), massage: service ? servicePrimaryName(service) : null, area: (partner as any)?.district || null }, partner?.slug || studioId); scrollIntoViewGently(e.currentTarget); }}
                            className={`flex-shrink-0 w-16 min-[900px]:w-20 py-2.5 min-[900px]:py-3.5 rounded-2xl border-2 text-center transition snap-start ${
                              active ? "border-[#C4622D] bg-[#C4622D] text-white" : "border-gray-200 bg-white text-gray-700"
                            }`}>
                            <div className="text-[10px] min-[900px]:text-xs uppercase opacity-70">{dayShort(d, lang)}</div>
                            <div className="text-lg min-[900px]:text-2xl font-bold leading-none mt-0.5">{d.getDate()}</div>
                            <div className="text-[10px] min-[900px]:text-xs opacity-70">{monShort(d, lang)}</div>
                          </button>
                        );
                      })}
                      <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-[#FAF6F1] to-transparent" aria-hidden />
                    </div>
                  )}
                  {date && (
                    <div ref={timeRef} className="mt-5">
                      <p className="text-xs min-[900px]:text-xl font-semibold text-gray-500 mb-2 min-[900px]:mb-3">{c.timesLabel}</p>
                      {times.length === 0 ? (
                        <p className="text-sm min-[900px]:text-base text-gray-400">{c.fullyBooked}</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 min-[900px]:gap-3">
                          {times.map(t => {
                            const left = remainingFor(t);
                            const cap = date ? capacityFor(date.getDay(), t) : therapistCount;
                            const lowStock = cap > 1 && left < cap;
                            return (
                              <button key={t} onClick={() => { setTime(t); trackFunnel("wizard_time_selected", { flow: "studio", time: t, massage: service ? servicePrimaryName(service) : null, area: (partner as any)?.district || null }, partner?.slug || studioId); }}
                                className={`px-4 min-[900px]:px-5 py-2 min-[900px]:py-3 rounded-full border-2 text-sm min-[900px]:text-[15px] font-medium motion-safe:transition ${
                                  time === t ? "border-[#C4622D] bg-[#C4622D] text-white" : "border-gray-200 bg-white text-gray-700"
                                }`}>
                                {t}
                                {lowStock && (
                                  <span className={`block text-[10px] min-[900px]:text-xs font-normal ${time === t ? "text-white/80" : "text-amber-600"}`}>
                                    {left} {c.left}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {date && time && (
                    <div className="mt-5">
                      {!alt2Shown ? (
                        <button
                          type="button"
                          onClick={() => setAlt2Shown(true)}
                          className="text-sm min-[900px]:text-base font-semibold underline underline-offset-2 text-[#C4622D]"
                        >
                          {c.addAnotherTime}
                        </button>
                      ) : (
                        <>
                          {renderAltSlot(altDate2, setAltDate2, altTime2, setAltTime2, c.secondChoice)}
                          {!alt3Shown ? (
                            <button
                              type="button"
                              onClick={() => setAlt3Shown(true)}
                              className="mt-4 text-sm min-[900px]:text-base font-semibold underline underline-offset-2 text-[#C4622D]"
                            >
                              {c.addThirdChoice}
                            </button>
                          ) : (
                            renderAltSlot(altDate3, setAltDate3, altTime3, setAltTime3, c.thirdChoice)
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Section>
                <WizardNav
                  onBack={() => goStep(1)}
                  onNext={() => goStep(3)}
                  disabled={!date || !time}
                  hint={c.pickDayTime}
                />
              </div>
            )}

            {/* STEP 3: customize */}
            {step === 3 && (
              <div>
                <Section step="3" title={c.customizeSession}>
                  <p className="text-sm min-[900px]:text-base text-gray-500 mb-4 min-[900px]:mb-5">
                    {c.optionalHelps}
                  </p>
                  {customerProfile && prefsApplied && (
                    <div className="mb-4 min-[900px]:mb-5 rounded-xl border border-[#C4622D]/30 bg-[#C4622D]/5 px-3 min-[900px]:px-4 py-2 min-[900px]:py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs min-[900px]:text-sm font-medium text-gray-700">{c.prefilledProfile}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPressure("Medium");
                          setFocusAreas([]);
                          setAddonNames([]);
                          setConversationPref("");
                          setPrefsApplied(false);
                        }}
                        className="text-xs min-[900px]:text-sm font-semibold text-[#C4622D] underline"
                      >
                        {c.startBlank}
                      </button>
                    </div>
                  )}
                  {!service && (
                    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-xs min-[900px]:text-sm text-gray-600">
                        {c.pickMassageFirst}
                      </p>
                      <button
                        type="button"
                        onClick={() => goStep(1)}
                        className="mt-1.5 text-xs min-[900px]:text-sm font-semibold text-[#C4622D] underline"
                      >
                        {c.chooseMassage}
                      </button>
                    </div>
                  )}
                  <p className="text-xs font-semibold text-gray-500 mb-2 min-[900px]:text-xl min-[900px]:mb-3">{c.comfort}</p>
                  <div className="flex flex-wrap gap-2 mb-4 min-[900px]:gap-3 min-[900px]:mb-5">
                    {[
                      { v: "silence" },
                      { v: "minimal" },
                      { v: "chatty" },
                    ].map(o => (
                      <button
                        key={o.v}
                        type="button"
                        disabled={!service}
                        onClick={() => setConversationPref(prev => prev === o.v ? "" : o.v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition min-[900px]:px-5 min-[900px]:py-3 min-[900px]:text-[15px] ${
                          !service ? "bg-white text-gray-300 border-gray-100 cursor-not-allowed" :
                          conversationPref === o.v ? "bg-[#C4622D] text-white border-[#C4622D]" : "bg-white text-gray-600 border-gray-200"
                        }`}
                      >
                        {pickCopy(CONVERSATION_LABEL_COPY, lang)[o.v]}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs font-semibold text-gray-500 mb-2 min-[900px]:text-xl min-[900px]:mb-3">{c.pressure}</p>
                  <div className="flex flex-wrap gap-2 mb-4 min-[900px]:gap-3 min-[900px]:mb-5">
                    {PRESSURE_LEVELS.map(p => (
                      <button key={p} type="button" disabled={!service} onClick={() => setPressure(p)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition min-[900px]:px-5 min-[900px]:py-3 min-[900px]:text-[15px] ${
                          !service ? "bg-white text-gray-300 border-gray-100 cursor-not-allowed" :
                          pressure === p ? "bg-[#C4622D] text-white border-[#C4622D]" : "bg-white text-gray-600 border-gray-200"
                        }`}>{pickCopy(PRESSURE_LABEL_COPY, lang)[p] || p}</button>
                    ))}
                  </div>

                  <p className="text-xs font-semibold text-gray-500 mb-2 min-[900px]:text-xl min-[900px]:mb-3">{c.focusAreas}</p>
                  <div className="flex flex-wrap gap-2 mb-4 min-[900px]:gap-3 min-[900px]:mb-5">
                    {FOCUS_AREAS.map(f => (
                      <button key={f} type="button" disabled={!service} onClick={() => toggle(focusAreas, f, setFocusAreas)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition min-[900px]:px-5 min-[900px]:py-3 min-[900px]:text-[15px] ${
                          !service ? "bg-white text-gray-300 border-gray-100 cursor-not-allowed" :
                          focusAreas.includes(f) ? "bg-[#C4622D] text-white border-[#C4622D]" : "bg-white text-gray-600 border-gray-200"
                        }`}>{pickCopy(FOCUS_AREA_LABEL_COPY, lang)[f] || f}</button>
                    ))}
                  </div>

                  {addons.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-500 mb-1 min-[900px]:text-xl min-[900px]:mb-1.5">{c.makeItYours}</p>
                      <p className="text-xs min-[900px]:text-sm text-gray-400 mb-2 min-[900px]:mb-3">{c.extrasNote}</p>
                      <div className="space-y-2 min-[900px]:space-y-3 mb-4 min-[900px]:mb-5">
                        {addons.map((a: any) => {
                          const on = addonNames.includes(a.name);
                          const price = Number(a.price) || 0;
                          const extra = Number(a.duration_extra) || 0;
                          return (
                            <button key={a.id} onClick={() => toggle(addonNames, a.name, setAddonNames)}
                              aria-pressed={on}
                              className={`card-auto w-full flex items-center justify-between gap-3 p-3 min-[900px]:p-4 rounded-xl border-2 text-left transition ${
                                on ? "border-[#C4622D] bg-[#C4622D]/5" : "border-gray-200 bg-white"
                              }`}>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 min-[900px]:text-base">{a.name}</p>
                                {a.name_es && a.name_es !== a.name && (
                                  <p className="text-xs text-gray-500 min-[900px]:text-sm">{a.name_es}</p>
                                )}
                                <p className="text-xs text-[#C4622D] font-semibold min-[900px]:text-sm">
                                  +€{price}{extra > 0 ? ` · +${extra} min` : ""}
                                </p>
                              </div>
                              <div className={`h-6 w-6 min-[900px]:h-7 min-[900px]:w-7 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${on ? "border-[#C4622D] bg-[#C4622D]" : "border-gray-300"}`}>
                                {on && <Check size={13} className="text-white min-[900px]:size-4" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}


                  <p className="text-xs font-semibold text-gray-500 mb-2 min-[900px]:text-xl min-[900px]:mb-3">{c.notesForTherapist}</p>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={c.notesPlaceholder}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#C4622D] resize-none h-24 min-[900px]:text-base min-[900px]:h-28" />
                </Section>
                <WizardNav onBack={() => goStep(2)} onNext={() => goStep(4)} skip={() => goStep(4)} />
              </div>
            )}

            {/* STEP 4: your details */}
            {step === 4 && (
              <div>
                <Section step="4" title={c.yourDetails}>
                  <div className="space-y-2 min-[900px]:space-y-3">
                    <div className="pb-1">
                      {!peopleOpen ? (
                        <button
                          type="button"
                          onClick={() => setPeopleOpen(true)}
                          className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
                        >
                          {c.moreThanOne}
                        </button>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {PEOPLE_OPTIONS.map((n) => {
                            const on = people === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                aria-pressed={on}
                                onClick={() => setPeople(n)}
                                className={`h-9 min-w-[2.5rem] px-3 rounded-lg border text-sm font-medium ${
                                  on ? "border-[#C4622D] bg-[#FDF3EC] text-[#C4622D]" : "border-gray-200 bg-white text-gray-600"
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                          <p className="w-full mt-1 text-xs text-gray-400">
                            {c.groupCheck}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                      <input ref={nameRef} value={firstName} onChange={e => { setFirstName(e.target.value); setStepError(null); }} placeholder={c.firstName} autoComplete="given-name"
                        aria-invalid={!!stepError && !firstName.trim()}
                        className={`w-full h-12 min-[900px]:h-14 px-4 rounded-xl border bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#C4622D] ${
                          stepError && !firstName.trim() ? "border-2 border-[#B03A2E]" : "border-gray-200"
                        }`} />
                      <input value={lastName} onChange={e => { setLastName(e.target.value); setStepError(null); }} placeholder={c.lastName} autoComplete="family-name"
                        aria-invalid={!!stepError && !lastName.trim()}
                        className={`w-full h-12 min-[900px]:h-14 px-4 rounded-xl border bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#C4622D] ${
                          stepError && !lastName.trim() ? "border-2 border-[#B03A2E]" : "border-gray-200"
                        }`} />
                    </div>
                    <div>
                      <input ref={emailRef} value={email} onChange={e => { setEmail(e.target.value); setStepError(null); }} placeholder={c.email} type="email" inputMode="email" autoComplete="email"
                        aria-invalid={contact.emailValid === false}
                        className={`w-full h-12 min-[900px]:h-14 px-4 rounded-xl border bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#C4622D] ${
                          contact.emailValid === false ? "border-2 border-[#B03A2E]" : "border-gray-200"
                        }`} />
                      {contact.emailValid === false && (
                        <p className="mt-1.5 text-xs min-[900px]:text-sm text-[#B03A2E]">
                          {CONTACT_COPY[lang].badEmail}
                        </p>
                      )}
                    </div>
                    <div>
                      <input value={phone} onChange={e => { setPhone(e.target.value); setStepError(null); }} placeholder={c.waPhone} type="tel" inputMode="tel" autoComplete="tel"
                        aria-invalid={contact.phoneValid === false}
                        className={`w-full h-12 min-[900px]:h-14 px-4 rounded-xl border bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#C4622D] ${
                          contact.phoneValid === false ? "border-2 border-[#B03A2E]" : "border-gray-200"
                        }`} />
                      {contact.phoneValid === false && (
                        <p className="mt-1.5 text-xs min-[900px]:text-sm text-[#B03A2E]">
                          {CONTACT_COPY[lang].badPhone}
                        </p>
                      )}
                    </div>
                    <p className="text-xs min-[900px]:text-sm text-gray-400">
                      {c.giveContact}
                    </p>


                    {!userId && !!email.trim() && (
                      <label className="flex items-start gap-3 pt-2 min-[900px]:pt-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createAccount}
                          onChange={e => setCreateAccount(e.target.checked)}
                        />
                        <span className="text-xs min-[900px]:text-sm text-gray-600 leading-snug">
                          {c.createAccount}
                          <span className="block text-[11px] min-[900px]:text-xs text-gray-400">
                            {c.createAccountSub}
                          </span>
                        </span>
                      </label>
                    )}

                    {stepError && (
                      <p role="alert" className="text-sm min-[900px]:text-base font-medium text-[#B03A2E]">
                        {stepError}
                      </p>
                    )}
                  </div>
                </Section>
                <WizardNav
                  onBack={() => goStep(3)}
                  onNext={submitDetailsStep}
                  disabled={!nameComplete || !hasContact}
                  hint={CONTACT_COPY[lang].needContact}
                />

              </div>
            )}

            {/* STEP 5: confirm */}
            {step === 5 && (
              <div>
                <Section step="5" title={c.reviewConfirm}>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 min-[900px]:p-5 space-y-2 min-[900px]:space-y-3">
                    <SummaryRow label={c.service} value={serviceSummary} placeholder={c.pickAService} onChange={() => goStep(1)} />
                    <SummaryRow label={c.day} value={prettyDay} placeholder={c.pickDay} onChange={() => goStep(2)} />
                    <SummaryRow label={c.time} value={time} placeholder={c.pickTime} onChange={() => goStep(2)} />
                    <SummaryRow label={c.pressure} value={pressure || null} placeholder={c.notSet} onChange={() => goStep(3)} />
                    <SummaryRow label={c.comfort} value={conversationPref ? pickCopy(CONVERSATION_LABEL_COPY, lang)[conversationPref] || conversationPref : null} placeholder={c.notSet} onChange={() => goStep(3)} />
                    <SummaryRow label={c.focusAreas} value={focusAreas.length ? focusAreas.map(f => pickCopy(FOCUS_AREA_LABEL_COPY, lang)[f] || f).join(", ") : null} placeholder={c.none} onChange={() => goStep(3)} />
                    <SummaryRow label={c.addOns} value={addonSummary} placeholder={c.none} onChange={() => goStep(3)} />
                    <SummaryRow label={c.notes} value={notes.trim() || null} placeholder={c.none} onChange={() => goStep(3)} />
                    <SummaryRow label={c.name} value={name.trim() || null} placeholder={c.addYourName} onChange={() => goStep(4)} />
                    <SummaryRow label={c.contact} value={[email.trim(), phone.trim()].filter(Boolean).join(" · ") || null} placeholder={c.addContact} onChange={() => goStep(4)} />
                    <SummaryRow label={c.price} value={total > 0 ? `€${total}` : null} placeholder={c.pickAService} />
                  </div>

                  {error && <p className="mt-3 text-sm min-[900px]:text-base text-red-500 bg-red-50 p-3 rounded-xl">{error}</p>}

                  {/* Quiet first-timer reassurance, right before the commit */}
                  <div className="mt-4 rounded-2xl border border-[#EADFD2] bg-[#FBF7F2] px-4 py-3">
                    <p className="text-xs min-[900px]:text-sm text-[#5a4736] leading-snug">
                      {c.firstMassage}
                    </p>
                    <a
                      href="/guides/your-first-massage-in-madrid"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1.5 text-xs min-[900px]:text-sm font-semibold text-[#C4622D] hover:underline"
                    >
                      {c.readFirstTimer}
                    </a>
                  </div>

                  <p className="mt-3 text-xs min-[900px]:text-sm text-center text-[#8a7460]">
                    {instantConfirm ? c.confirmedRightAway : c.studioConfirms}
                  </p>
                  <WizardNav onBack={() => goStep(4)} />

                </Section>
              </div>
            )}

          </div>

          {/* RIGHT: running summary, desktop only */}
          <aside className="hidden min-[900px]:block min-[900px]:sticky min-[900px]:top-4 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 min-[900px]:p-5 space-y-2 min-[900px]:space-y-3">
              <p className="text-xs min-[900px]:text-sm font-bold uppercase tracking-[2px] text-[#C4622D] mb-1 min-[900px]:mb-2">
                {c.yourBooking}
              </p>
              <SummaryRow label={c.service} value={service ? servicePrimaryName(service) : null} placeholder={c.pickAService} />
              <SummaryRow label={c.day} value={prettyDay} placeholder={c.pickDay} />
              <SummaryRow label={c.time} value={time} placeholder={c.pickTime} />
              <SummaryRow label={c.price} value={service && total > 0 ? `€${total}` : null} placeholder={c.pickAService} />
            </div>
            {bookingWaHref && (
              <a
                href={bookingWaHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (waLoggedRef.current) return;
                  waLoggedRef.current = true;
                  setAskWaTapped(true);
                  clarityEvent("whatsapp_click");
                  trackEvent("wa_click", { slug: partner.slug || partner.id });
                  trackFunnel("wizard_wa_handoff", {
                    flow: "studio",
                    studio: partner.slug || partner.id,
                    massage: service ? servicePrimaryName(service) : null,
                    area: (partner as any).district || null,
                  }, partner.slug || partner.id);
                  sendTrack({
                    event: "whatsapp_click",
                    path: window.location.pathname,
                    slug: partner.slug || partner.id,
                    meta: { filled: !!(service || date || time), service: !!service, date: !!date },
                  });
                  void logWhatsappRequest({
                    partner_id: partner.id,
                    slug: partner.slug || null,
                    studio_name: partner.business_name,
                    service_name: service ? servicePrimaryName(service) : null,
                    price: service && total > 0 ? total : null,
                    day1: prettyDay,
                    time1: time,
                    day2: prettyDayOf(altDate2),
                    time2: altTime2,
                    day3: prettyDayOf(altDate3),
                    time3: altTime3,
                    first_name: firstName.trim() || null,
                    last_name: lastName.trim() || null,
                    contact_email: email.trim() || null,
                    languages: spokenLangs.join(", "),
                    user_id: userId,
                    wa_number: bookingWaNumber,
                    message_text: bookingWaMsg,
                  }).then((id) => { waRequestIdRef.current = id; });
                }}
                className={`w-full inline-flex flex-col items-center justify-center min-h-[48px] min-[900px]:min-h-[56px] px-6 py-2 min-[900px]:py-2.5 rounded-2xl font-semibold motion-safe:transition ${
                  askWaTapped
                    ? "pointer-events-none opacity-70"
                    : partner.status === "active"
                    ? "border border-[#C4622D] text-[#C4622D] bg-white hover:bg-[#FAF6F1]"
                    : "text-white bg-[#C4622D] shadow-sm hover:opacity-95"
                }`}
              >
                <span className="inline-flex items-center gap-2 min-[900px]:text-base"><MessageCircle size={18} /> {c.waSetItUp}</span>
              </a>
            )}
            <div className="flex flex-wrap gap-2 min-[900px]:gap-2.5">
              {(partner.languages || []).slice(0, 4).map((l: string) => (
                <span key={l} className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs min-[900px]:text-sm text-gray-600">{tagLabel(l)}</span>
              ))}
              {(partner.amenities || []).slice(0, 4).map((a: string) => (
                <span key={a} className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs min-[900px]:text-sm text-gray-600">{tagLabel(a)}</span>
              ))}
            </div>
          </aside>

          <div className="min-[900px]:col-span-2 space-y-5">
            <ExitCaptureBlock
              source="studio-exit"
              step={step}
              want={(() => {
                const svc = service || profile?.services.find((s) => s.id === hoServiceId) || null;
                return svc ? servicePrimaryName(svc) : null;
              })()}
              area={(partner as any).district || null}
            />
            {/* Contact footer */}
            <div className="flex items-center justify-center gap-4 pt-6 pb-8 text-gray-400">
              <WhatsAppAskButton
                source="studio-page-footer"
                studioName={partner.business_name}
                meta={{ slug: partner.slug || partner.id }}
                renderTrigger={({ open }) => (
                  <button type="button" onClick={open} className="flex items-center gap-1 text-sm hover:text-[#25D366]">
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                )}
              />

              {partner.phone && (
                <a href={telHref(partner.phone) || undefined} className="flex items-center gap-1 text-sm hover:text-gray-600">
                  <Phone size={14} /> {c.call}
                </a>
              )}
              {partner.instagram && (
                <a href={`https://instagram.com/${partner.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm hover:text-pink-500">
                  <Instagram size={14} /> {partner.instagram}
                </a>
              )}
            </div>

            {/* Massage Club credit */}
            <div className="flex items-center justify-center gap-1.5 pb-4 text-gray-400 text-[11px]">
              <img src="/brand/mc-avatar-terracotta.png" alt="" className="h-4 w-4 rounded-full object-cover" />
              <span>{c.poweredBy}</span>
            </div>

            {/* Legal footer */}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pb-8 text-gray-400 text-[11px]">
              <span>Massage Club · Madrid</span>
              <span>·</span>
              <Link to="/for-studios" className="hover:text-[#C4622D] transition">{c.forStudios}</Link>
              <span>·</span>
              <Link to="/privacy" className="hover:text-[#C4622D] transition">{c.privacy}</Link>
              <span>·</span>
              <Link to="/terms" className="hover:text-[#C4622D] transition">{c.terms}</Link>
              <span>·</span>
              <a href="mailto:support@massageclub.io" className="hover:text-[#C4622D] transition">support@massageclub.io</a>
            </div>
          </div>
        </div>
      </div>

      <AbandonedBookingSheet
        open={leadSheet.open}
        onClose={leadSheet.close}
        slug={partner?.slug || studioId || null}
        serviceName={service ? servicePrimaryName(service) : null}
        date={date ? isoDate(date) : null}
        time={time}
        defaultEmail={email}
      />

    </div>

  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 min-[900px]:mb-4">
        <div className="h-6 w-6 min-[900px]:h-8 min-[900px]:w-8 rounded-full bg-[#C4622D] text-white flex items-center justify-center text-xs min-[900px]:text-sm font-bold flex-shrink-0">{step}</div>
        <div>
          <h2 className="font-display text-lg min-[900px]:text-[22px] leading-tight text-gray-900">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Horizontal day strip used by the WhatsApp handoff form (ISO value in/out). */
function DayStrip({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const lang = useFlowLang();
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {days.map(d => {
        const iso = isoDate(d);
        const active = value === iso;
        return (
          <button
            key={iso}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? "" : iso)}
            className="flex-shrink-0 w-16 min-[900px]:w-20 py-2 min-[900px]:py-3.5 rounded-2xl border-2 text-center motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4622D]"
            style={{
              borderColor: active ? "#C4622D" : "#E6DCCF",
              background: active ? "#C4622D" : "#ffffff",
              color: active ? "#ffffff" : "#5a4736",
            }}
          >
            <div className="text-[10px] min-[900px]:text-xs uppercase opacity-70">{dayShort(d, lang)}</div>
            <div className="text-lg min-[900px]:text-2xl font-bold leading-none mt-0.5">{d.getDate()}</div>
            <div className="text-[10px] min-[900px]:text-xs opacity-70">{monShort(d, lang)}</div>
          </button>
        );
      })}
    </div>
  );
}

/** Rounded time pills for the handoff form (fixed options, real availability unknown). */
function TimePills({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2 min-[900px]:gap-3">
      {HANDOFF_TIMES.map(t => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? "" : t)}
            className="px-3.5 min-[900px]:px-5 py-2 min-[900px]:py-3 rounded-full border-2 text-sm min-[900px]:text-[15px] font-medium motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4622D]"
            style={{
              borderColor: active ? "#C4622D" : "#E6DCCF",
              background: active ? "#C4622D" : "#ffffff",
              color: active ? "#ffffff" : "#5a4736",
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

export type StepDef = string;

/** Always visible wizard header. Completed steps are clickable, upcoming ones muted. */
/** Keeps a freshly selected card comfortably in view without a jarring jump. */
function scrollIntoViewGently(el: HTMLElement | null) {
  if (!el) return;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  } catch {
    /* older browsers: no smooth scrolling, no problem */
  }
}

/**
 * Always reachable Continue bar. Full width on mobile, aligned under the right
 * summary column on desktop, so picking a service never looks like nothing happened.
 */
function StickyContinue({
  ready, onNext, label, busy, badge, note, summary, inlineRef,
}: {
  ready: boolean; onNext: () => void; label?: string; busy?: boolean;
  badge?: { text: string }; note?: string; summary?: string | null;
  /** Inline Continue inside the step card. While it is in the viewport the
   *  sticky bar shows summary text only (no button), so exactly one
   *  actionable Continue is ever visible. */
  inlineRef?: React.RefObject<HTMLElement | null>;
}) {
  const lang = useFlowLang();
  const c = pickCopy(PAGE_COPY, lang);
  const [inlineVisible, setInlineVisible] = useState(false);
  useEffect(() => {
    const el = inlineRef?.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInlineVisible(false);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => setInlineVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inlineRef]);

  // Inline Continue is on screen: keep the summary visible but drop the
  // button so there is never a second competing CTA.
  if (inlineVisible) {
    if (!summary) return null;
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#EADFD2] bg-[#FAF6F1]/95 backdrop-blur px-5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <p className="max-w-lg min-[900px]:max-w-[1100px] mx-auto w-full text-center text-[12px] min-[900px]:text-sm font-semibold truncate text-[#5a4736]">
          {summary}
        </p>
      </div>
    );
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#EADFD2] bg-[#FAF6F1]/95 backdrop-blur shadow-[0_-6px_24px_rgba(80,44,20,0.06)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-lg min-[900px]:max-w-[1100px] mx-auto flex flex-col items-center gap-1.5">
        {summary && (
          <p className="w-full text-center text-[12px] min-[900px]:text-sm font-semibold truncate text-[#5a4736]">{summary}</p>
        )}
        {badge && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3E7] border border-[#CBE0C4] px-3 py-1 text-[11px] font-semibold text-[#3F6B36]">
            <Check size={12} strokeWidth={3} /> {badge.text}
          </span>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!ready || busy}
          aria-disabled={!ready || busy}
          className={`w-full min-[900px]:max-w-md min-[900px]:w-auto min-[900px]:px-16 min-h-[52px] min-[900px]:h-14 rounded-2xl font-semibold flex flex-col items-center justify-center leading-tight motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4622D] focus-visible:ring-offset-2 ${
            ready && !busy ? "bg-[#C4622D] text-white shadow-lg hover:opacity-95" : "bg-[#E7D9CB] text-[#9E8B78]"
          }`}
        >
          <span className="min-[900px]:text-lg">{busy ? c.booking : label || c.continueLabel}</span>
        </button>
        {note && (
          <p className="text-[11px] min-[900px]:text-xs text-center text-[#8a7460]">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}



function Stepper({
  steps, current, maxReached, onGo,
}: { steps: StepDef[]; current: number; maxReached: number; onGo: (n: number) => void }) {
  const lang = useFlowLang();
  const activeRef = useRef<HTMLButtonElement | null>(null);
  // On narrow screens the five steps scroll, so keep the active one in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [current]);
  return (
    <nav
      aria-label={pickCopy(BOOKING_STEPS_ARIA, lang)}
      className="relative flex items-start gap-0.5 min-[900px]:gap-1 overflow-x-auto pb-1 -mx-1 px-1 max-w-full min-[900px]:max-w-[720px] no-scrollbar"
    >
      {/* Thin connector line behind the step bullets */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-8 right-8 top-[22px] h-px bg-[#E7D9CB]"
      />
      {steps.map((s, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const isDone = n < current || (n <= maxReached && n !== current);
        const reachable = n <= maxReached;
        return (
          <button
            key={s}
            type="button"
            onClick={() => reachable && onGo(n)}
            disabled={!reachable}
            aria-current={isCurrent ? "step" : undefined}
            ref={isCurrent ? activeRef : undefined}
            className={`relative flex-1 min-w-[62px] min-[900px]:min-w-[86px] text-center px-1 min-[900px]:px-1.5 py-2 rounded-xl motion-safe:transition ${
              isCurrent ? "bg-[#C4622D]/10" : ""
            } ${reachable && !isCurrent ? "hover:bg-[#F1E7DB]" : ""}`}
          >
            <span
              className={`relative mx-auto mb-1 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ring-4 ring-[#FAF6F1] ${
                isCurrent
                  ? "bg-[#C4622D] text-white"
                  : isDone
                    ? "bg-[#C4622D]/15 text-[#C4622D]"
                    : "bg-[#E7D9CB] text-[#9E8B78]"
              }`}
            >
              {isDone ? <Check size={13} /> : n}
            </span>
            <span
              className={`block text-[10px] min-[900px]:text-[11px] font-semibold leading-tight ${
                isCurrent ? "text-[#C4622D]" : isDone ? "text-gray-700" : "text-[#A6968A]"
              }`}
            >
              {s}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Step footer: Back, an optional Skip, and the "why is Continue not lit" hint.
 * The Continue button itself lives ONLY in the sticky bar, never inline.
 */
function WizardNav({
  onBack, disabled, hint, skip,
}: {
  onBack?: () => void;
  onNext?: () => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  skip?: () => void;
}) {
  const lang = useFlowLang();
  const c = pickCopy(PAGE_COPY, lang);
  return (
    <div className="pt-4 min-[900px]:pt-5 space-y-2 min-[900px]:space-y-3">
      {disabled && hint && (
        <p className="text-xs min-[900px]:text-sm text-center text-[#8a7460]">
          {hint}
        </p>
      )}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm min-[900px]:text-base font-semibold text-[#8a7460] underline underline-offset-2">
            {c.back}
          </button>
        ) : <span />}
        {skip && (
          <button type="button" onClick={skip} className="text-sm min-[900px]:text-base font-semibold text-[#C4622D] underline underline-offset-2">
            {c.skipStep}
          </button>
        )}
      </div>
    </div>
  );
}



/** One line of the live booking summary. */
function SummaryRow({
  label, value, placeholder, onChange,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  /** When given, the row gets a small "Change" link back to that step. */
  onChange?: () => void;
}) {
  const lang = useFlowLang();
  const c = pickCopy(PAGE_COPY, lang);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs min-[900px]:text-sm text-gray-400 flex-shrink-0">
        {label}
      </span>
      <span className="flex items-baseline gap-2 min-w-0 justify-end">
        <span className={`text-sm min-[900px]:text-base text-right ${value ? "font-semibold text-gray-900" : "text-gray-300"}`} style={{ overflowWrap: "anywhere" }}>
          {value || placeholder}
        </span>
        {onChange && (
          <button
            type="button"
            onClick={onChange}
            className="flex-shrink-0 text-[11px] min-[900px]:text-xs font-semibold text-[#C4622D] underline underline-offset-2"
          >
            {c.change}
          </button>
        )}
      </span>
    </div>
  );
}

