import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { supabase, fetchStudioProfile, type StudioProfile } from "@/lib/supabase";
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
import { contactOk, isValidEmail, isValidPhone } from "@/lib/contactValidation";
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
import MarketingOptInCard from "@/app/components/MarketingOptInCard";
import StudioPlaceMap from "@/app/components/StudioPlaceMap";
import { findNearbyStudios, sixtyMinFrom, isForTwo, isFourHands, type NearbyListedStudio } from "@/lib/nearestStudios";
import { studioPath } from "@/lib/studioHref";
import { madridTodayIso, madridDays, isTooSoon, isoToLocalDate } from "@/lib/madridTime";
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
  en: ["Service", "Day and time", "Your details", "Sent"],
  es: ["Servicio", "Día y hora", "Tus datos", "Enviada"],
  fr: ["Service", "Jour et heure", "Vos infos", "Envoyée"],
  de: ["Leistung", "Tag und Uhrzeit", "Deine Daten", "Gesendet"],
  it: ["Servizio", "Giorno e ora", "I tuoi dati", "Inviata"],
  pt: ["Serviço", "Dia e hora", "Os teus dados", "Enviada"],
  zh: ["服务", "日期和时间", "您的信息", "已发送"],
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
    // waitTime (31 Oct): was "You will hear from us within 30 minutes with your
    // confirmed time." Under BOTH PARTIES TAP the studio's answer is only an offer
    // until the customer taps Yes, and at night the bot waits for studios to open
    // at 09:00, so neither "confirmed" nor "30 minutes" was true. Every language.
    bookingDone: "You're booked!", waitTime: "We will write to you with the studio's answer. If the time works, tap Yes on the offer to book it. If they cannot fit you, we will send you other studios nearby.",
    addToCalendar: "Add to my calendar", waSetItUp: "WhatsApp us and we set it up", visitWebsite: "Visit their website",
    timeConfirmedPay: "Your time is confirmed. You pay at the studio, no card needed.",
    studioConfirmsPay: "We'll email you when the studio answers. You pay at the studio.",
    almostDone: "Almost done. WhatsApp us and we set it up.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "This studio isn't on Massage Club yet. We can still set up your booking for you.",
    howWeBook: "This is how we book it for you",
    bookMassage: "Book a massage", pickServiceFirst: "Pick a service below first",
    servicesLabel: "Services", takeQuiz: "Not sure which massage? Take the 60 second quiz",
    chooseServiceContinue: "Choose a service to continue", continueLabel: "Continue",
    contactStep: "We contact the studio for you in Spanish. Pick a time, and add a second one if you can.",
    addSecondChoice: "+ Add a second choice", addThirdChoice: "+ Add a third choice", thirdChoice: "Third choice",
    moreThanOne: "Booking for more than one person?", groupCheck: "We will check the studio can take your group at the same time.",
    firstName: "First name", lastName: "Last name", waPhone: "WhatsApp / Phone (+34 600 123 456)", email: "Email",
    anythingElse: "Anything else we should know?", optional: "Optional",
    needContact: "Add your name and a way to reach you",
    reachYouWa: "So we can confirm your time on WhatsApp.",
    service: "Service", day: "Day", secondChoice: "Second choice", name: "Name", contact: "Contact", price: "Price",
    pickAService: "Pick a service", anyDay: "Any day", anyTime: "Any time", none: "None", notProvided: "Not provided", time: "Time",
    askStudio: "Ask the studio", requestWhatsapp: "Request via WhatsApp", pickAMassage: "Pick a massage",
    // waReassuranceStudios (31 Oct): was "Studios already on Massage Club confirm
    // instantly." Untrue under BOTH PARTIES TAP (10 Oct): nothing is booked until the
    // studio has the slot and the customer taps Yes. Same fix in every language.
    back: "Back", waReassuranceStudios: "We ask the studio for you. Nothing is booked until you say yes.", browseOtherStudios: "Browse other studios",
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
    booking: "Booking", skipStep: "skip",
    addNameContact: "Add your first and last name so the studio knows who is coming",
    slotFilled: "That time just filled up, pick another",
    somethingWrong: "Something went wrong. Please try again.",
    bookYourMassage: "Book your massage",
    pickService: "Pick a service", pickDay: "Pick a day", pickTime: "Pick a time", priceLabel: "Price",
    moreTimesFaster: "Add a second time if you can. It helps the studio fit you in.",
  },
  es: {
    showDistance: "Ver distancia", directions: "Cómo llegar",
    yourAppointmentAt: "Tu cita en", checkingWithStudio: "Estamos confirmando con el centro",
    bookingDone: "¡Tu reserva está hecha! 🎉", waitTime: "Te escribimos con la respuesta del centro. Si la hora te va bien, toca Sí en la oferta para reservarla. Si no pueden, te mandamos otros centros cerca.",
    addToCalendar: "Añadir a mi calendario", waSetItUp: "Escríbenos por WhatsApp y te lo organizamos", visitWebsite: "Ver su web",
    timeConfirmedPay: "Tu hora está confirmada. Pagas en el estudio, sin tarjeta.",
    studioConfirmsPay: "Te escribimos cuando el centro responda. Pagas en el centro.",
    almostDone: "Casi listo. Escríbenos por WhatsApp y te lo organizamos.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Este estudio todavía no está en Massage Club. Aun así te organizamos la reserva.",
    howWeBook: "Así te lo reservamos",
    bookMassage: "Reserva un masaje", pickServiceFirst: "Elige antes un servicio",
    servicesLabel: "Servicios", takeQuiz: "¿No sabes cuál elegir? Haz el test",
    chooseServiceContinue: "Elige un servicio para continuar", continueLabel: "Continuar",
    contactStep: "Contactamos con el centro por ti. Elige una hora y, si puedes, añade otra.",
    addSecondChoice: "+ Añadir una segunda opción", addThirdChoice: "+ Añadir una tercera opción", thirdChoice: "Tercera opción",
    moreThanOne: "¿Reservas para más de una persona?", groupCheck: "Confirmamos con el centro que pueden atender a todo el grupo a la vez.",
    firstName: "Nombre", lastName: "Apellido", waPhone: "WhatsApp / Teléfono (+34 600 123 456)", email: "Email",
    anythingElse: "¿Algo más que debamos saber?", optional: "Opcional",
    needContact: "Añade tu nombre y una forma de contacto",
    reachYouWa: "Para confirmarte la hora por WhatsApp.",
    service: "Servicio", day: "Día", secondChoice: "Segunda opción", name: "Nombre", contact: "Contacto", price: "Precio",
    pickAService: "Elige un servicio", anyDay: "Cualquier día", anyTime: "Cualquier hora", none: "Ninguno", notProvided: "No indicado", time: "Hora",
    askStudio: "Pregunta al estudio", requestWhatsapp: "Solicitar por WhatsApp", pickAMassage: "Elige un masaje",
    back: "Atrás", waReassuranceStudios: "Le preguntamos al estudio por ti. No se reserva nada hasta que digas que sí.", browseOtherStudios: "Ver otros estudios",
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
    moreTimesFaster: "Si puedes, añade otra hora. Así al centro le es más fácil darte hueco.",
  },
  fr: {
    showDistance: "Voir la distance", directions: "Itinéraire",
    yourAppointmentAt: "Votre rendez-vous à", checkingWithStudio: "Nous vérifions avec le centre",
    bookingDone: "Votre réservation est faite ! 🎉", waitTime: "Nous vous écrivons avec la réponse du centre. Si l'heure vous convient, touchez Oui sur l'offre pour la réserver. S'ils ne peuvent pas, nous vous envoyons d'autres centres à proximité.",
    addToCalendar: "Ajouter à mon calendrier", waSetItUp: "Écrivez-nous sur WhatsApp et on s'occupe de tout", visitWebsite: "Voir leur site",
    timeConfirmedPay: "Votre heure est confirmée. Vous payez sur place, sans carte.",
    studioConfirmsPay: "Nous vous écrivons dès que le centre répond. Vous payez sur place.",
    almostDone: "Presque fini. Écrivez-nous sur WhatsApp et on s'occupe de tout.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Ce centre n'est pas encore sur Massage Club. On peut tout de même organiser votre réservation.",
    howWeBook: "Voici comment on réserve pour vous",
    bookMassage: "Réserver un massage", pickServiceFirst: "Choisissez d'abord un service",
    servicesLabel: "Services", takeQuiz: "Vous ne savez pas quel massage choisir ? Faites le test de 60 secondes",
    chooseServiceContinue: "Choisissez un service pour continuer", continueLabel: "Continuer",
    contactStep: "Nous contactons le centre pour vous en espagnol. Choisissez une heure, et ajoutez-en une deuxième si vous pouvez.",
    addSecondChoice: "+ Ajouter un second choix", addThirdChoice: "+ Ajouter un troisième choix", thirdChoice: "Troisième choix",
    moreThanOne: "Vous réservez pour plusieurs personnes ?", groupCheck: "Nous vérifions que le centre peut recevoir tout le groupe en même temps.",
    firstName: "Prénom", lastName: "Nom", waPhone: "WhatsApp / Téléphone (+34 600 123 456)", email: "Email",
    anythingElse: "Autre chose à savoir ?", optional: "Facultatif",
    needContact: "Ajoutez votre nom et un moyen de vous contacter",
    reachYouWa: "Pour vous confirmer l'heure sur WhatsApp.",
    service: "Service", day: "Jour", secondChoice: "Second choix", name: "Nom", contact: "Contact", price: "Prix",
    pickAService: "Choisissez un service", anyDay: "N'importe quel jour", anyTime: "N'importe quelle heure", none: "Aucun", notProvided: "Non fourni", time: "Heure",
    askStudio: "Demander au centre", requestWhatsapp: "Demander via WhatsApp", pickAMassage: "Choisir un massage",
    back: "Retour", waReassuranceStudios: "Nous demandons au centre pour vous. Rien n'est réservé tant que vous n'avez pas dit oui.", browseOtherStudios: "Voir d'autres centres",
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
    moreTimesFaster: "Ajoutez une deuxième heure si vous pouvez. Cela aide le centre à vous trouver une place.",
  },
  de: {
    showDistance: "Entfernung anzeigen", directions: "Wegbeschreibung",
    yourAppointmentAt: "Dein Termin bei", checkingWithStudio: "Wir prüfen das gerade mit dem Studio",
    bookingDone: "Deine Buchung ist fertig! 🎉", waitTime: "Wir schreiben dir die Antwort des Studios. Wenn die Zeit passt, tippe im Angebot auf Ja, um sie zu buchen. Falls es nicht passt, schicken wir dir andere Studios in der Nähe.",
    addToCalendar: "Zu meinem Kalender hinzufügen", waSetItUp: "Schreib uns auf WhatsApp, wir kümmern uns darum", visitWebsite: "Website besuchen",
    timeConfirmedPay: "Deine Zeit ist bestätigt. Du zahlst im Studio, keine Karte nötig.",
    studioConfirmsPay: "Wir schreiben dir, sobald das Studio antwortet. Du zahlst im Studio.",
    almostDone: "Fast fertig. Schreib uns auf WhatsApp, wir kümmern uns darum.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Dieses Studio ist noch nicht bei Massage Club. Wir organisieren deine Buchung trotzdem.",
    howWeBook: "So buchen wir das für dich",
    bookMassage: "Massage buchen", pickServiceFirst: "Wähle zuerst einen Service",
    servicesLabel: "Leistungen", takeQuiz: "Nicht sicher, welche Massage? Mach den 60-Sekunden-Test",
    chooseServiceContinue: "Wähle einen Service, um fortzufahren", continueLabel: "Weiter",
    contactStep: "Wir kontaktieren das Studio für dich auf Spanisch. Wähle eine Zeit und, wenn möglich, eine zweite.",
    addSecondChoice: "+ Zweite Wahl hinzufügen", addThirdChoice: "+ Dritte Wahl hinzufügen", thirdChoice: "Dritte Wahl",
    moreThanOne: "Buchst du für mehr als eine Person?", groupCheck: "Wir prüfen, ob das Studio deine Gruppe zur gleichen Zeit aufnehmen kann.",
    firstName: "Vorname", lastName: "Nachname", waPhone: "WhatsApp / Telefon (+34 600 123 456)", email: "E-Mail",
    anythingElse: "Sollten wir noch etwas wissen?", optional: "Optional",
    needContact: "Füge deinen Namen und eine Kontaktmöglichkeit hinzu",
    reachYouWa: "Damit wir deine Zeit per WhatsApp bestätigen können.",
    service: "Service", day: "Tag", secondChoice: "Zweite Wahl", name: "Name", contact: "Kontakt", price: "Preis",
    pickAService: "Service wählen", anyDay: "Egal welcher Tag", anyTime: "Egal welche Zeit", none: "Keine", notProvided: "Nicht angegeben", time: "Uhrzeit",
    askStudio: "Beim Studio nachfragen", requestWhatsapp: "Über WhatsApp anfragen", pickAMassage: "Massage wählen",
    back: "Zurück", waReassuranceStudios: "Wir fragen für dich beim Studio an. Gebucht ist erst, wenn du Ja sagst.", browseOtherStudios: "Andere Studios ansehen",
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
    moreTimesFaster: "Füge wenn möglich eine zweite Zeit hinzu. Das hilft dem Studio, dich unterzubringen.",
  },
  it: {
    showDistance: "Mostra distanza", directions: "Indicazioni",
    yourAppointmentAt: "Il tuo appuntamento da", checkingWithStudio: "Stiamo verificando con il centro",
    bookingDone: "La tua prenotazione è fatta! 🎉", waitTime: "Ti scriviamo con la risposta del centro. Se l'orario ti va bene, tocca Sì sull'offerta per prenotarlo. Se non possono, ti mandiamo altri centri vicini.",
    addToCalendar: "Aggiungi al mio calendario", waSetItUp: "Scrivici su WhatsApp e ci pensiamo noi", visitWebsite: "Visita il loro sito",
    timeConfirmedPay: "Il tuo orario è confermato. Paghi al centro, senza carta.",
    studioConfirmsPay: "Ti scriviamo quando il centro risponde. Paghi al centro.",
    almostDone: "Quasi fatto. Scrivici su WhatsApp e ci pensiamo noi.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Questo centro non è ancora su Massage Club. Possiamo comunque organizzare la tua prenotazione.",
    howWeBook: "Ecco come prenotiamo per te",
    bookMassage: "Prenota un massaggio", pickServiceFirst: "Scegli prima un servizio",
    servicesLabel: "Servizi", takeQuiz: "Non sai quale massaggio scegliere? Fai il test di 60 secondi",
    chooseServiceContinue: "Scegli un servizio per continuare", continueLabel: "Continua",
    contactStep: "Contattiamo noi il centro per te, in spagnolo. Scegli un orario e, se puoi, aggiungine un secondo.",
    addSecondChoice: "+ Aggiungi una seconda scelta", addThirdChoice: "+ Aggiungi una terza scelta", thirdChoice: "Terza scelta",
    moreThanOne: "Prenoti per più di una persona?", groupCheck: "Verifichiamo che il centro possa accogliere tutto il gruppo insieme.",
    firstName: "Nome", lastName: "Cognome", waPhone: "WhatsApp / Telefono (+34 600 123 456)", email: "Email",
    anythingElse: "C'è altro che dovremmo sapere?", optional: "Facoltativo",
    needContact: "Aggiungi il tuo nome e un modo per contattarti",
    reachYouWa: "Per confermarti l'orario su WhatsApp.",
    service: "Servizio", day: "Giorno", secondChoice: "Seconda scelta", name: "Nome", contact: "Contatto", price: "Prezzo",
    pickAService: "Scegli un servizio", anyDay: "Qualsiasi giorno", anyTime: "Qualsiasi orario", none: "Nessuno", notProvided: "Non fornito", time: "Ora",
    askStudio: "Chiedi al centro", requestWhatsapp: "Richiedi via WhatsApp", pickAMassage: "Scegli un massaggio",
    back: "Indietro", waReassuranceStudios: "Chiediamo noi al centro per te. Niente è prenotato finché non dici di sì.", browseOtherStudios: "Guarda altri centri",
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
    moreTimesFaster: "Se puoi, aggiungi un secondo orario. Aiuta il centro a trovarti posto.",
  },
  pt: {
    showDistance: "Ver distância", directions: "Como chegar",
    yourAppointmentAt: "A tua marcação em", checkingWithStudio: "Estamos a confirmar com o estúdio",
    bookingDone: "A tua reserva está feita! 🎉", waitTime: "Escrevemos-te com a resposta do estúdio. Se a hora te servir, toca em Sim na oferta para a reservar. Se não conseguirem, enviamos-te outros estúdios próximos.",
    addToCalendar: "Adicionar ao meu calendário", waSetItUp: "Escreve-nos no WhatsApp e organizamos tudo", visitWebsite: "Visitar o site",
    timeConfirmedPay: "A tua hora está confirmada. Pagas no estúdio, sem cartão.",
    studioConfirmsPay: "Escrevemos-te quando o estúdio responder. Pagas no estúdio.",
    almostDone: "Quase pronto. Escreve-nos no WhatsApp e organizamos tudo.",
    footerCredit: "Massage Club · Madrid · book.massageclub.io",
    notOnClub: "Este estúdio ainda não está no Massage Club. Ainda assim organizamos a tua reserva.",
    howWeBook: "É assim que reservamos por ti",
    bookMassage: "Reservar uma massagem", pickServiceFirst: "Escolhe primeiro um serviço",
    servicesLabel: "Serviços", takeQuiz: "Não sabes qual massagem escolher? Faz o teste de 60 segundos",
    chooseServiceContinue: "Escolhe um serviço para continuar", continueLabel: "Continuar",
    contactStep: "Contactamos o estúdio por ti, em espanhol. Escolhe uma hora e, se puderes, junta uma segunda.",
    addSecondChoice: "+ Adicionar uma segunda opção", addThirdChoice: "+ Adicionar uma terceira opção", thirdChoice: "Terceira opção",
    moreThanOne: "Estás a reservar para mais de uma pessoa?", groupCheck: "Vamos confirmar que o estúdio pode receber o teu grupo todo ao mesmo tempo.",
    firstName: "Nome próprio", lastName: "Sobrenome", waPhone: "WhatsApp / Telefone (+34 600 123 456)", email: "Email",
    anythingElse: "Há mais alguma coisa que devamos saber?", optional: "Opcional",
    needContact: "Adiciona o teu nome e uma forma de contacto",
    reachYouWa: "Para te confirmarmos a hora pelo WhatsApp.",
    service: "Serviço", day: "Dia", secondChoice: "Segunda opção", name: "Nome", contact: "Contacto", price: "Preço",
    pickAService: "Escolhe um serviço", anyDay: "Qualquer dia", anyTime: "Qualquer hora", none: "Nenhum", notProvided: "Não fornecido", time: "Hora",
    askStudio: "Perguntar ao estúdio", requestWhatsapp: "Pedir via WhatsApp", pickAMassage: "Escolher uma massagem",
    back: "Voltar", waReassuranceStudios: "Perguntamos ao estúdio por ti. Nada fica reservado até dizeres que sim.", browseOtherStudios: "Ver outros estúdios",
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
    moreTimesFaster: "Se puderes, junta uma segunda hora. Ajuda o estúdio a encontrar-te vaga.",
  },
  zh: {
    showDistance: "显示距离", directions: "路线",
    yourAppointmentAt: "您在以下门店的预约", checkingWithStudio: "我们正在与门店确认",
    bookingDone: "预约成功！🎉", waitTime: "我们会把门店的答复发给您。时间合适的话，在我们发来的邀约中点击“是”即可预订。如果门店无法安排，我们会为您推荐附近其他门店。",
    addToCalendar: "添加到我的日历", waSetItUp: "通过WhatsApp联系我们,我们会为您安排", visitWebsite: "访问他们的网站",
    timeConfirmedPay: "您的时间已确认。到店付款,无需信用卡。",
    studioConfirmsPay: "门店答复后我们会给您发邮件。到店付款。",
    almostDone: "快完成了。通过WhatsApp联系我们,我们会为您安排。",
    footerCredit: "Massage Club · 马德里 · book.massageclub.io",
    notOnClub: "该门店尚未加入Massage Club。我们仍然可以为您安排预约。",
    howWeBook: "我们就是这样为您预约的",
    bookMassage: "预约按摩", pickServiceFirst: "请先选择一项服务",
    servicesLabel: "服务", takeQuiz: "不确定选哪种按摩?来做60秒测试",
    chooseServiceContinue: "选择一项服务以继续", continueLabel: "继续",
    contactStep: "我们用西班牙语替您联系门店。请选择一个时间，如果可以，再添加一个。",
    addSecondChoice: "+ 添加第二选择", addThirdChoice: "+ 添加第三选择", thirdChoice: "第三选择",
    moreThanOne: "为多人预约吗?", groupCheck: "我们会确认门店能否同时接待您的整个团队。",
    firstName: "名字", lastName: "姓氏", waPhone: "WhatsApp / 电话 (+34 600 123 456)", email: "电子邮箱",
    anythingElse: "还有什么我们需要知道的吗?", optional: "可选",
    needContact: "请添加您的姓名和联系方式",
    reachYouWa: "以便我们通过WhatsApp确认您的时间。",
    service: "服务", day: "日期", secondChoice: "第二选择", name: "姓名", contact: "联系方式", price: "价格",
    pickAService: "选择一项服务", anyDay: "任意日期", anyTime: "任意时间", none: "无", notProvided: "未提供", time: "时间",
    askStudio: "询问门店", requestWhatsapp: "通过WhatsApp请求", pickAMassage: "选择一项按摩",
    back: "返回", waReassuranceStudios: "我们替您询问门店。在您确认之前，不会预订任何时段。", browseOtherStudios: "浏览其他门店",
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
    moreTimesFaster: "如果可以，请再添加一个时间，这样门店更容易为您安排。",
  },
};

/**
 * Studio page copy added on 2 Nov 2026 (UX batch, studio_pages). Typed, so a
 * language cannot miss a key. Placeholders: {min} {n} {km} {studio} {email}.
 * No em or en dashes; never "instant", "deals" or English-speaking promises.
 */
type SpCopy = {
  priceFrom: string; priceRange: string; oneLine: string; forTwo: string; fourHands: string;
  reviewsGoogle: string; reviewsOwn: string; howHereTitle: string; notOnClub: string;
  nearbyTitle: string; walk: string; kmAway: string; openMaps: string; aboutTitle: string;
  yourName: string; emailLabel: string; emailHelp: string; phoneLabel: string; notesLabel: string;
  errName: string; errEmail: string; errPhone: string;
  send: string; sending: string; sendError: string;
  sentTitle: string; sentContact: string; sentAnswer: string; sentYes: string; requestTo: string;
};
const SP_COPY: Record<FlowLang, SpCopy> = {
  en: {
    priceFrom: "60 min from €{min}", priceRange: "60 min · usually €50 to €85",
    oneLine: "We ask the studio for you in Spanish. Nothing is booked until you tap Yes. You pay at the studio.",
    forTwo: "for 2", fourHands: "4 hands",
    reviewsGoogle: "{n} Google reviews", reviewsOwn: "{n} reviews",
    howHereTitle: "How booking works here",
    notOnClub: "This studio isn't on Massage Club yet. We contact them for you in Spanish and email you their answer.",
    nearbyTitle: "Other studios nearby", walk: "{n} min walk", kmAway: "{km} km away",
    openMaps: "Open in Google Maps", aboutTitle: "About the studio",
    yourName: "Your name", emailLabel: "Email", emailHelp: "The studio's answer and the Yes button come here.",
    phoneLabel: "WhatsApp number (optional)", notesLabel: "Anything else? (optional)",
    errName: "What should we call you?", errEmail: "Check your email, for example name@gmail.com",
    errPhone: "Add the country code, for example +34",
    send: "Send request", sending: "Sending...", sendError: "That didn't go through. Try again.",
    sentTitle: "Request sent. We're asking {studio} now.",
    sentContact: "We contact {studio} for you in Spanish.",
    sentAnswer: "Their answer comes to {email}.",
    sentYes: "If the time works, tap Yes to book it. Nothing is booked before that. You pay at the studio.",
    requestTo: "Your request to {studio}",
  },
  es: {
    priceFrom: "60 min desde {min} €", priceRange: "60 min · normalmente entre 50 y 85 €",
    oneLine: "Preguntamos al centro por ti. No se reserva nada hasta que tocas Sí. Pagas en el centro.",
    forTwo: "para 2", fourHands: "4 manos",
    reviewsGoogle: "{n} reseñas en Google", reviewsOwn: "{n} reseñas",
    howHereTitle: "Cómo funciona la reserva aquí",
    notOnClub: "Este centro aún no está en Massage Club. Contactamos con ellos por ti y te enviamos su respuesta por email.",
    nearbyTitle: "Otros centros cerca", walk: "{n} min andando", kmAway: "a {km} km",
    openMaps: "Abrir en Google Maps", aboutTitle: "Sobre el centro",
    yourName: "Tu nombre", emailLabel: "Email", emailHelp: "Aquí te llegan la respuesta del centro y el botón para decir Sí.",
    phoneLabel: "Número de WhatsApp (opcional)", notesLabel: "¿Algo más? (opcional)",
    errName: "¿Cómo te llamamos?", errEmail: "Revisa tu email, por ejemplo nombre@gmail.com",
    errPhone: "Añade el prefijo, por ejemplo +34",
    send: "Enviar solicitud", sending: "Enviando...", sendError: "No se ha enviado. Inténtalo de nuevo.",
    sentTitle: "Solicitud enviada. Ya estamos preguntando a {studio}.",
    sentContact: "Contactamos con {studio} por ti.",
    sentAnswer: "Su respuesta te llega a {email}.",
    sentYes: "Si la hora te va bien, toca Sí para reservarla. Antes de eso no se reserva nada. Pagas en el centro.",
    requestTo: "Tu solicitud a {studio}",
  },
  fr: {
    priceFrom: "60 min dès {min} €", priceRange: "60 min · généralement entre 50 et 85 €",
    oneLine: "Nous demandons au centre pour vous, en espagnol. Rien n'est réservé tant que vous n'avez pas touché Oui. Vous payez sur place.",
    forTwo: "pour 2", fourHands: "4 mains",
    reviewsGoogle: "{n} avis Google", reviewsOwn: "{n} avis",
    howHereTitle: "Comment se passe la réservation ici",
    notOnClub: "Ce centre n'est pas encore sur Massage Club. Nous le contactons pour vous en espagnol et vous envoyons sa réponse par email.",
    nearbyTitle: "Autres centres à proximité", walk: "{n} min à pied", kmAway: "à {km} km",
    openMaps: "Ouvrir dans Google Maps", aboutTitle: "À propos du centre",
    yourName: "Votre nom", emailLabel: "Email", emailHelp: "La réponse du centre et le bouton Oui arrivent ici.",
    phoneLabel: "Numéro WhatsApp (facultatif)", notesLabel: "Autre chose ? (facultatif)",
    errName: "Comment vous appelez-vous ?", errEmail: "Vérifiez votre email, par exemple nom@gmail.com",
    errPhone: "Ajoutez l'indicatif, par exemple +34",
    send: "Envoyer la demande", sending: "Envoi...", sendError: "La demande n'est pas partie. Réessayez.",
    sentTitle: "Demande envoyée. Nous demandons maintenant à {studio}.",
    sentContact: "Nous contactons {studio} pour vous, en espagnol.",
    sentAnswer: "Leur réponse arrive à {email}.",
    sentYes: "Si l'heure vous convient, touchez Oui pour la réserver. Rien n'est réservé avant. Vous payez sur place.",
    requestTo: "Votre demande à {studio}",
  },
  de: {
    priceFrom: "60 Min. ab {min} €", priceRange: "60 Min. · meist zwischen 50 und 85 €",
    oneLine: "Wir fragen das Studio für dich auf Spanisch. Nichts ist gebucht, bevor du auf Ja tippst. Du zahlst im Studio.",
    forTwo: "für 2", fourHands: "4 Hände",
    reviewsGoogle: "{n} Google-Bewertungen", reviewsOwn: "{n} Bewertungen",
    howHereTitle: "So funktioniert die Buchung hier",
    notOnClub: "Dieses Studio ist noch nicht bei Massage Club. Wir kontaktieren es für dich auf Spanisch und schicken dir seine Antwort per E-Mail.",
    nearbyTitle: "Andere Studios in der Nähe", walk: "{n} Min. zu Fuß", kmAway: "{km} km entfernt",
    openMaps: "In Google Maps öffnen", aboutTitle: "Über das Studio",
    yourName: "Dein Name", emailLabel: "E-Mail", emailHelp: "Die Antwort des Studios und der Ja-Button kommen hierhin.",
    phoneLabel: "WhatsApp-Nummer (optional)", notesLabel: "Sonst noch etwas? (optional)",
    errName: "Wie heißt du?", errEmail: "Prüfe deine E-Mail, zum Beispiel name@gmail.com",
    errPhone: "Füge die Ländervorwahl hinzu, zum Beispiel +34",
    send: "Anfrage senden", sending: "Wird gesendet...", sendError: "Das hat nicht geklappt. Versuch es noch einmal.",
    sentTitle: "Anfrage gesendet. Wir fragen jetzt bei {studio} an.",
    sentContact: "Wir kontaktieren {studio} für dich auf Spanisch.",
    sentAnswer: "Die Antwort kommt an {email}.",
    sentYes: "Wenn die Zeit passt, tippe auf Ja, um sie zu buchen. Vorher ist nichts gebucht. Du zahlst im Studio.",
    requestTo: "Deine Anfrage an {studio}",
  },
  it: {
    priceFrom: "60 min da {min} €", priceRange: "60 min · di solito tra 50 e 85 €",
    oneLine: "Chiediamo noi al centro, in spagnolo. Niente è prenotato finché non tocchi Sì. Paghi al centro.",
    forTwo: "per 2", fourHands: "4 mani",
    reviewsGoogle: "{n} recensioni Google", reviewsOwn: "{n} recensioni",
    howHereTitle: "Come funziona la prenotazione qui",
    notOnClub: "Questo centro non è ancora su Massage Club. Lo contattiamo noi per te in spagnolo e ti mandiamo la sua risposta via email.",
    nearbyTitle: "Altri centri vicini", walk: "{n} min a piedi", kmAway: "a {km} km",
    openMaps: "Apri in Google Maps", aboutTitle: "Il centro",
    yourName: "Il tuo nome", emailLabel: "Email", emailHelp: "Qui ti arrivano la risposta del centro e il pulsante Sì.",
    phoneLabel: "Numero WhatsApp (facoltativo)", notesLabel: "Altro? (facoltativo)",
    errName: "Come ti chiami?", errEmail: "Controlla la tua email, per esempio nome@gmail.com",
    errPhone: "Aggiungi il prefisso, per esempio +34",
    send: "Invia richiesta", sending: "Invio...", sendError: "Non è stata inviata. Riprova.",
    sentTitle: "Richiesta inviata. Stiamo chiedendo a {studio}.",
    sentContact: "Contattiamo {studio} per te, in spagnolo.",
    sentAnswer: "La risposta arriva a {email}.",
    sentYes: "Se l'orario ti va bene, tocca Sì per prenotarlo. Prima di allora non è prenotato nulla. Paghi al centro.",
    requestTo: "La tua richiesta a {studio}",
  },
  pt: {
    priceFrom: "60 min desde {min} €", priceRange: "60 min · normalmente entre 50 e 85 €",
    oneLine: "Perguntamos ao estúdio por ti, em espanhol. Nada fica reservado até tocares em Sim. Pagas no estúdio.",
    forTwo: "para 2", fourHands: "4 mãos",
    reviewsGoogle: "{n} avaliações no Google", reviewsOwn: "{n} avaliações",
    howHereTitle: "Como funciona a reserva aqui",
    notOnClub: "Este estúdio ainda não está no Massage Club. Contactamo-lo por ti em espanhol e enviamos-te a resposta por email.",
    nearbyTitle: "Outros estúdios perto", walk: "{n} min a pé", kmAway: "a {km} km",
    openMaps: "Abrir no Google Maps", aboutTitle: "Sobre o estúdio",
    yourName: "O teu nome", emailLabel: "Email", emailHelp: "Aqui chegam a resposta do estúdio e o botão Sim.",
    phoneLabel: "Número de WhatsApp (opcional)", notesLabel: "Mais alguma coisa? (opcional)",
    errName: "Como te chamas?", errEmail: "Verifica o teu email, por exemplo nome@gmail.com",
    errPhone: "Adiciona o indicativo, por exemplo +34",
    send: "Enviar pedido", sending: "A enviar...", sendError: "Não foi enviado. Tenta outra vez.",
    sentTitle: "Pedido enviado. Já estamos a perguntar a {studio}.",
    sentContact: "Contactamos {studio} por ti, em espanhol.",
    sentAnswer: "A resposta chega a {email}.",
    sentYes: "Se a hora te servir, toca em Sim para a reservar. Antes disso nada fica reservado. Pagas no estúdio.",
    requestTo: "O teu pedido a {studio}",
  },
  zh: {
    priceFrom: "60分钟 {min} € 起", priceRange: "60分钟 · 通常 50 至 85 €",
    oneLine: "我们用西班牙语替您询问门店。在您点击“是”之前不会预订任何时段。到店付款。",
    forTwo: "2人", fourHands: "四手",
    reviewsGoogle: "{n} 条 Google 评价", reviewsOwn: "{n} 条评价",
    howHereTitle: "这里如何预约",
    notOnClub: "该门店尚未加入Massage Club。我们会用西班牙语替您联系，并通过邮件把答复发给您。",
    nearbyTitle: "附近的其他门店", walk: "步行{n}分钟", kmAway: "{km} 公里",
    openMaps: "在 Google 地图中打开", aboutTitle: "关于门店",
    yourName: "您的姓名", emailLabel: "电子邮箱", emailHelp: "门店的答复和“是”按钮会发到这里。",
    phoneLabel: "WhatsApp 号码（可选）", notesLabel: "还有其他吗？（可选）",
    errName: "我们该怎么称呼您？", errEmail: "请检查您的邮箱，例如 name@gmail.com",
    errPhone: "请加上国家区号，例如 +34",
    send: "发送请求", sending: "发送中...", sendError: "发送失败，请重试。",
    sentTitle: "请求已发送。我们正在询问 {studio}。",
    sentContact: "我们用西班牙语替您联系 {studio}。",
    sentAnswer: "答复会发送到 {email}。",
    sentYes: "如果时间合适，点击“是”即可预订。在此之前不会预订任何时段。到店付款。",
    requestTo: "您发给 {studio} 的请求",
  },
};

/** Fill {placeholders} in a copy line. */
const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** "w***@example.com": enough to recognise the address, not to read it off a screen. */
const maskEmail = (e: string) => {
  const v = (e || "").trim();
  const at = v.lastIndexOf("@");
  if (at < 1) return v;
  return `${v[0]}***@${v.slice(at + 1)}`;
};

/** "Ana María López" -> first "Ana", last "María López" (null when one word). */
const splitName = (full: string) => {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") || null };
};

/** Days from Madrid today to an ISO day (0 = today). */
const dayOffset = (iso: string) => {
  const [y1, m1, d1] = madridTodayIso().split("-").map(Number);
  const [y2, m2, d2] = (iso || "").split("-").map(Number);
  if (!y2) return null;
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

type FieldKey = "name" | "email" | "phone";
/** On-tap validation shared by both studio branches. Phone is checked only when typed. */
const validateContact = (name: string, email: string, phone: string): FieldKey[] => {
  const bad: FieldKey[] = [];
  if (!name.trim()) bad.push("name");
  if (!isValidEmail(email)) bad.push("email");
  if (/\d/.test(phone || "") && !isValidPhone(phone)) bad.push("phone");
  return bad;
};

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayShort = (d: Date, lang: FlowLang) => shortWeekday(d, lang);
const monShort = (d: Date, lang: FlowLang) =>
  new Intl.DateTimeFormat(localeOf(lang), { month: "short" }).format(d).replace(/\.$/, "");

/**
 * Keyed by the studio in the URL, so following an "Other studios nearby" link
 * starts a fresh page (no service, times or name carried over from the last
 * studio) and opens at the top.
 */
export default function StudioBookingPage() {
  const { studioId } = useParams();
  return <StudioBookingPageInner key={studioId || ""} />;
}

function StudioBookingPageInner() {
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
  // One "Your name" field (2 Nov): first AND last name was where people stopped.
  const [fullName, setFullName] = useState("");
  const name = fullName.trim();
  const { first: firstName, last: lastName } = splitName(fullName);
  const nameComplete = !!name;
  const applyFullName = (full: string) => {
    const v = (full || "").trim();
    if (!v) return;
    setFullName(prev => prev || v);
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
  // status: what the bookings row says. The anon role cannot read the column
  // back (2 Nov), and the insert policy only allows "pending", so a new request
  // is always pending here: no calendar button for an unconfirmed time.
  const [done, setDone] = useState<{ ref: string; status: string } | null>(null);
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
  const [hoFullName, setHoFullName] = useState("");
  const [hoEmail, setHoEmail] = useState("");
  const [hoPhone, setHoPhone] = useState("");
  // Send-step state: errors appear only after a tap on Send, then follow edits.
  const [hoErrors, setHoErrors] = useState<FieldKey[]>([]);
  const [hoSending, setHoSending] = useState(false);
  const [hoSendError, setHoSendError] = useState(false);
  const [hoSentTo, setHoSentTo] = useState<string | null>(null);
  const hoNameRef = useRef<HTMLInputElement | null>(null);
  const hoEmailRef = useRef<HTMLInputElement | null>(null);
  const hoPhoneRef = useRef<HTMLInputElement | null>(null);
  const hoSendRef = useRef<HTMLButtonElement | null>(null);
  // Claimed-studio details step: same on-tap validation.
  const [dErrors, setDErrors] = useState<FieldKey[]>([]);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  // "Other studios nearby" (SP1): null until loaded.
  const [nearby, setNearby] = useState<NearbyListedStudio[] | null>(null);
  const detailsViewedRef = useRef(false);

  // Passwordless account creation, offered to visitors who are not signed in.
  // Off by default (2 Nov): a pre-ticked box sent sign-up emails nobody asked for.
  const [createAccount, setCreateAccount] = useState(false);

  const [hoDate, setHoDate] = useState("");
  const [hoTime, setHoTime] = useState("");
  const [hoAltDate, setHoAltDate] = useState("");
  const [hoAltTime, setHoAltTime] = useState("");
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

  // Step events (contract 3.1, 2 Nov). The old wizard_step_${n} effects fired
  // on mount, twice per studio view, so "step 1" counted page loads. These fire
  // on a person's tap; the step is in the event name because `track` keeps
  // only the first row per day, visitor, event and path.
  const isHandoffPage = !!profile?.partner && (profile.partner as any).status !== "active";
  const reqTrack = (event: string, meta: Record<string, unknown> = {}) => {
    const slug = (profile?.partner as any)?.slug || studioId || null;
    trackFunnel(event, { flow: isHandoffPage ? "studio-handoff" : "studio", lang: siteLang, v: "ds1", studio: slug, ...meta }, slug);
  };
  useEffect(() => {
    if (!profile?.partner || detailsViewedRef.current) return;
    const onDetails = isHandoffPage ? hoStep === 3 : step === 4;
    if (!onDetails) return;
    detailsViewedRef.current = true;
    reqTrack("req_details_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoStep, step, profile]);

  // "Other studios nearby": the three closest listed studios. A studio with no
  // coordinates (Wellness Care, Belmont) uses the centre of its neighbourhood.
  useEffect(() => {
    const p = profile?.partner as any;
    if (!p?.id) return;
    let off = false;
    const lat = p.latitude != null ? Number(p.latitude) : null;
    const lng = p.longitude != null ? Number(p.longitude) : null;
    findNearbyStudios(lat, lng, p.id, 3, p.neighbourhood ?? null).then((r) => { if (!off) setNearby(r); });
    return () => { off = true; };
  }, [profile]);




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

  // A studio page opened from "Other studios nearby" starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
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

  // Madrid's today, not the browser's (2 Nov): a visitor abroad, or anyone
  // at 16:39, was offered 10:00 to 16:00 today.
  const todayIso = madridTodayIso();

  // Only show a time while at least one therapist is still free for it, and,
  // today, only from an hour after Madrid now.
  const timesFor = (d: Date | null) => {
    if (!d) return [];
    const iso = isoDate(d);
    return (slotsByDay[d.getDay()] || []).filter(
      t => capacityFor(d.getDay(), t) - (slotCounts.get(`${iso}__${t}`) || 0) > 0
        && !(iso <= todayIso && isTooSoon(iso, t)),
    );
  };

  // The next 21 Madrid days the studio is open (up to 14). Today only while a
  // time is still bookable.
  const openDates = useMemo(() => {
    const out: Date[] = [];
    for (const iso of madridDays(21)) {
      if (out.length >= 14) break;
      const d = isoToLocalDate(iso);
      const open = iso === todayIso ? timesFor(d).length > 0 : (slotsByDay[d.getDay()] || []).length > 0;
      if (open) out.push(d);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsByDay, slotCounts, slotCapacity, therapistCount, todayIso]);

  // Step 2 must never open empty. Preselect the first open day that is not
  // today; today only when it is the only day with times.
  useEffect(() => {
    if (step !== 2 || date || openDates.length === 0) return;
    setDate(openDates.find(d => isoDate(d) !== todayIso) ?? openDates[0]);
    setTime(null);
  }, [step, date, openDates, todayIso]);
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
            <p className="text-sm text-gray-400">{c.fullyBooked}</p>
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



  // Loading and not-found (31 Oct) are light, on the page's own cream. Both
  // were a near-black #1a0709 screen, and not-found was a dead end ("We could not
  // find that page") with three competing exits. The Nook, our most visited
  // studio page, now lands here. One action instead: /reserve asks professional
  // studios near the visitor. No studio is named on purpose.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF6F1" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#B85C38" }} />
      </div>
    );
  }

  if (!profile) {
    // /reserve is public/go.html (vercel.json rewrite), a plain page outside
    // the router, so a real link; ?lang=es keeps a Spanish visitor in Spanish.
    // src=studio-404 keeps the tag the old WhatsApp button sent (source
    // "not-found"): go.html files the lead as go-page-studio-404.
    const askLang = (i18n.language || "en").slice(0, 2) === "es" ? "es" : "en";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: "#FAF6F1" }}>
        <div className="max-w-md w-full space-y-6">
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-semibold leading-tight" style={{ color: "#2b2b2b" }}>{t("app.shopDetail.notFoundTitle")}</h1>
            <p className="text-base leading-relaxed" style={{ color: "#3d2b1f" }}>{t("app.shopDetail.notFoundSub")}</p>
          </div>
          <a
            href={askLang === "es" ? "/reserve?lang=es&src=studio-404" : "/reserve?src=studio-404"}
            className="w-full inline-flex items-center justify-center h-12 px-6 rounded-full font-semibold hover:opacity-90 transition"
            style={{ background: "#B85C38", color: "#fff" }}
          >
            {t("app.shopDetail.askStudiosNearMe")}
          </a>
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
  // 44px rows (2 Nov): "Show distance" and "Directions" were 20px tall.
  const distanceBlock = (dark: boolean) => (
    <p className={`text-sm flex flex-wrap items-center gap-x-4 ${dark ? "text-white/80" : ""}`} style={dark ? undefined : { color: "#5a4736" }}>
      {distanceKm != null ? (
        <span className="inline-flex min-h-[44px] items-center">{distanceLabel(distanceKm, siteLang === "es" ? "es" : "en")} {locAreaName ? originSuffix(locAreaName, siteLang === "es" ? "es" : "en") : ""}</span>
      ) : (
        <button
          type="button"
          onClick={() => askLocation((res) => { if (res) { setUserLoc(res.loc); setLocAreaName(res.areaName); } })}
          className="inline-flex min-h-[44px] items-center underline underline-offset-2 font-semibold"
        >
          {c.showDistance}
        </button>
      )}
      {directionsHref && (
        <a href={directionsHref} target="_blank" rel="noreferrer" className={`inline-flex min-h-[44px] items-center underline underline-offset-2 font-semibold ${dark ? "" : "text-[#B85C38]"}`}>
          {c.directions}
        </a>)}
    </p>
  );

  // ─── The real place first (SP1, 2 Nov) ───
  // Jordan: "show customers the real studio visually: photos, place, map,
  // compare others". Order: photo or map, name, place, rating, price, one line.
  const sp: SpCopy = pickCopy(SP_COPY, lang) as SpCopy;
  const numLocale = localeOf(lang);
  const hood: string | null = ((partner as any).neighbourhood || "").trim() || null;
  const placeLine = [hood, partner.address || (hood ? "Madrid" : null)].filter(Boolean).join(" · ");
  // Only the studio's own photos: never stock or Google Places as "the place".
  const studioPhoto: string | null =
    partner.cover_url ||
    (Array.isArray(partner.gallery)
      ? partner.gallery.find((u: unknown) => typeof u === "string" && u.trim() && !/\.(mp4|webm)(\?.*)?$/i.test(u)) || null
      : null);
  const from60 = sixtyMinFrom(profile.services);
  const priceChipText = from60 != null ? fill(sp.priceFrom, { min: from60 }) : sp.priceRange;
  const gRating = (partner as any).google_rating != null ? Number((partner as any).google_rating) : null;
  const gReviews = (partner as any).google_reviews != null ? Number((partner as any).google_reviews) : null;
  // A rating means something only with enough reviews behind it.
  const ratingLine =
    rating && rating.count >= 3
      ? { avg: rating.avg, text: fill(sp.reviewsOwn, { n: rating.count.toLocaleString(numLocale) }) }
      : gRating != null && Number.isFinite(gRating) && gReviews != null && gReviews >= 10
        ? { avg: gRating, text: fill(sp.reviewsGoogle, { n: gReviews.toLocaleString(numLocale) }) }
        : null;
  const fmtRating = (v: number) => v.toLocaleString(numLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  /** Euro amount in the page language: "€85" (en), "85 €" (es). */
  const eur = (v: number) => formatPrice(v, lang);

  const visualBlock = studioPhoto ? (
    <img
      src={studioPhoto}
      alt={partner.business_name}
      className="block w-full aspect-[4/3] object-cover rounded-2xl"
      style={{ background: "#F4EEE6" }}
      decoding="async"
    />
  ) : (
    <StudioPlaceMap
      lat={studioLatLng?.lat ?? null}
      lng={studioLatLng?.lng ?? null}
      name={partner.business_name}
      title={hood || "Madrid"}
      address={partner.address || null}
      height={180}
    />
  );

  const identityBlock = (
    <div className="text-left">
      <h1 className="font-display text-3xl min-[900px]:text-4xl font-semibold leading-tight mt-4" style={{ color: "#2b2b2b" }}>
        {partner.business_name}
      </h1>
      {placeLine && (
        <p className="mt-1.5 text-sm min-[900px]:text-base flex items-start gap-1.5" style={{ color: "#5a4736" }}>
          <MapPin size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#B85C38" }} aria-hidden="true" />
          <span>{placeLine}</span>
        </p>
      )}
      {distanceBlock(false)}
      {ratingLine && (
        <p className="text-sm min-[900px]:text-base flex items-center gap-1.5" style={{ color: "#5a4736" }}>
          <span aria-hidden="true" style={{ color: "#E0A458" }}>★</span>
          <span className="font-semibold">{fmtRating(ratingLine.avg)}</span>
          <span style={{ color: "#7A7068" }}>· {ratingLine.text}</span>
        </p>
      )}
      <p
        data-testid="studio-price-chip"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold"
        style={{ borderColor: "#E6DCCF", background: "#FAF6F1", color: "#2b2b2b" }}
      >
        <Euro size={15} style={{ color: "#B85C38" }} aria-hidden="true" />
        {priceChipText}
      </p>
      <p className="mt-3 text-sm min-[900px]:text-base leading-snug" style={{ color: "#5a4736" }}>
        {sp.oneLine}
      </p>
    </div>
  );

  // Brand bar (2 Nov): wordmark left, account and language right, in one row.
  // The account pill used to float over the wordmark (F6).
  const brandBar = () => (
    <div className="py-2.5 px-4" style={{ background: "#FAF6F1", borderBottom: "1px solid #EADFD2" }}>
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3">
      <Link to="/studios" className="flex min-w-0 items-center gap-2" aria-label="Massage Club">
        <img src="/brand/mc-avatar-terracotta.png" alt="" width={26} height={26} className="rounded-full flex-shrink-0" />
        <span className="truncate" style={{ color: "#B85C38", fontSize: 13, fontWeight: 700, letterSpacing: "2px" }}>MASSAGE CLUB</span>
      </Link>
      <div className="flex flex-shrink-0 items-center gap-2"><AccountHeaderLink /><LanguageFlagToggle /></div>
      </div>
    </div>
  );

  const nearbyBlock = nearby && nearby.length > 0 ? (
    <section aria-label={sp.nearbyTitle} className="text-left" data-testid="studio-nearby">
      <p className="text-xs min-[900px]:text-sm font-bold uppercase mb-2" style={{ color: "#B85C38", letterSpacing: "2px" }}>{sp.nearbyTitle}</p>
      <ul className="grid gap-2 min-[900px]:grid-cols-3 min-[900px]:gap-3">
        {nearby.map((n) => {
          const dist =
            n.walkMinutes == null
              ? null
              : n.walkMinutes <= 45
                ? fill(sp.walk, { n: n.walkMinutes })
                : fill(sp.kmAway, { km: n.km.toLocaleString(numLocale, { maximumFractionDigits: 1 }) });
          return (
            <li key={n.id}>
              <Link
                to={studioPath(n)}
                onClick={() => reqTrack("studio_nearby_click", { to: n.slug || n.id })}
                className="flex h-full min-h-[56px] items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 motion-safe:transition hover:border-[#B85C38]"
                style={{ borderColor: "#E6DCCF" }}
              >
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight" style={{ color: "#2b2b2b" }}>{n.name}</span>
                  {(n.neighbourhood || dist) && (
                    <span className="mt-0.5 block text-sm" style={{ color: "#7A7068" }}>
                      {[n.neighbourhood, dist].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                {n.from60 != null && (
                  <span className="flex-shrink-0 text-sm font-semibold text-right" style={{ color: "#2b2b2b" }}>
                    {fill(sp.priceFrom, { min: n.from60 })}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  ) : null;

  /** Menu price with "for 2" on couples rows and "4 hands" on four-hands rows (F17). */
  const serviceTag = (s: any) => (isForTwo(s) ? sp.forTwo : isFourHands(s) ? sp.fourHands : null);

  // ─── Confirmation screen (claimed studios) ───
  if (done) {
    const prettyDate = date ? `${dayShort(date, lang)} ${date.getDate()} ${monShort(date, lang)}` : "";
    const confirmed = done.status === "confirmed";
    // A calendar entry only for a confirmed time: an unconfirmed slot in a
    // calendar invites no-shows (F13).
    const gcal = (() => {
      if (!confirmed || !date || !time || !service) return null;
      const [h, m] = time.split(":").map(Number);
      const start = new Date(date); start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + (service.duration || 60) * 60000);
      const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const text = encodeURIComponent(`${serviceInlineLabel(service)} · ${partner.business_name}`);
      const details = encodeURIComponent(`Massage Club · ${done.ref}`);
      const loc = encodeURIComponent(partner.address || partner.business_name || "");
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${z(start)}/${z(end)}&details=${details}&location=${loc}`;
    })();
    return (
      <div className="min-h-screen" style={{ background: "#FAF6F1" }}>
        {brandBar()}
        <div className="p-4 flex justify-center">
        <div className="w-full max-w-md rounded-2xl overflow-hidden text-center" style={{ background: "#ffffff", boxShadow: "0 6px 24px rgba(80,44,20,0.08)" }}>
          <div className="px-6 py-7">
            <h1 className="font-display text-2xl font-semibold leading-tight mb-3" style={{ color: "#2b2b2b" }}>
              {fill(sp.requestTo, { studio: partner.business_name })}
            </h1>
            <p className="text-base font-semibold mb-3" style={{ color: "#3d2b1f" }}>
              {/* 31 Oct: never "You're booked!" before both the studio and the
                  customer have said yes (BOTH PARTIES TAP). */}
              {confirmed && instantConfirm ? c.bookingDone : c.checkingWithStudio}
            </p>
            {!confirmed && (
              <p className="text-sm mb-6 leading-snug" style={{ color: "#5a4736" }}>
                {c.waitTime}
              </p>
            )}
            <div className="rounded-xl p-4 mb-5 text-left" style={{ background: "#FAF6F1" }}>
              <div className="text-sm font-semibold mb-1" style={{ color: "#3d2b1f" }}>
                {[servicePrimaryName(service), service?.duration ? `${service.duration} min` : null, total > 0 ? eur(total) : null].filter(Boolean).join(" · ")}
                {service && serviceTag(service) ? ` ${serviceTag(service)}` : ""}
              </div>
              {serviceSecondaryName(service) && (
                <div className="text-xs mb-1" style={{ color: "#8a7460" }}>{serviceSecondaryName(service)}</div>
              )}
              <div className="text-base font-bold mb-1" style={{ color: "#B85C38" }}>
                {prettyDate} · {time}
              </div>
              {partner.address && (
                <div className="text-sm flex items-start gap-1.5" style={{ color: "#5a4736" }}>
                  <MapPin size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>{partner.address}</span>
                </div>
              )}
            </div>
            <div data-testid="booking-ref" className="inline-flex items-center justify-center px-4 py-2 rounded-full font-mono text-sm mb-5" style={{ background: "#FAF6F1", color: "#5a4736" }}>
              {done.ref}
            </div>
            <p className="text-sm mb-6" style={{ color: "#8a7460" }}>
              {confirmed ? c.timeConfirmedPay : c.studioConfirmsPay}
            </p>
            {/* No "WhatsApp us" button here (2 Nov): the request already exists,
                and a WhatsApp message without its id starts a second one in the
                bot, which asks studios again (F4). */}
            {gcal && (
              <a href={gcal} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border-2 font-semibold bg-white hover:bg-[#FAF6F1] transition" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                <CalendarDays size={18} /> {c.addToCalendar}
              </a>
            )}
            <AccountOfferBlock
              className="mt-6"
              firstName={firstName}
              lastName={lastName || ""}
              email={email.trim()}
              phone={phone.trim()}
              requestId={waRequestIdRef.current}
              source="studio-booking"
            />
            <MarketingOptInCard
              className="mt-6"
              email={email.trim() || null}
              userId={userId}
              source="booking_success"
              bookingRef={done.ref}
            />
            {nearbyBlock && <div className="mt-6">{nearbyBlock}</div>}

            <div className="mt-6 text-xs" style={{ color: "#8a7460" }}>
              {c.footerCredit}
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // ─── Unclaimed studio handoff ───
  if (partner.status !== "active") {
    const waNumber = resolveWhatsappNumber(partner as any);
    const hoService = profile.services.find(s => s.id === hoServiceId) || null;
    const hoPrice = Number((hoService as any)?.price);
    const hasPrice = Number.isFinite(hoPrice) && hoPrice > 0;
    const studioSlug = partner.slug || partner.id;

    // Studio-facing date for waMsg / message_text: format unchanged on 2 Nov.
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
    // Customer-facing dates in the page language (2 Nov): the review step said
    // "martes, 3 de noviembre" on English pages.
    const pageDate = (v: string, style: "long" | "short") => {
      if (!v) return "";
      const d = isoToLocalDate(v);
      try {
        return style === "short"
          ? shortDate(d, lang).replace(/[.,]/g, "")
          : new Intl.DateTimeFormat(localeOf(lang), { weekday: "long", day: "numeric", month: "long" }).format(d).replace(/^\p{Ll}/u, (m) => m.toUpperCase());
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
    const hoTag = hoService ? serviceTag(hoService) : null;
    const hoPriceText = hasPrice ? `${eur(hoPrice)}${hoTag ? ` ${hoTag}` : ""}` : null;
    // One-line reminder of the choice: in the sticky bar and on top of Your details.
    const hoSummaryLine = hoService
      ? [
          servicePrimaryName(hoService),
          Number((hoService as any).duration) > 0 ? `${Number((hoService as any).duration)} min` : null,
          hoDate ? `${pageDate(hoDate, "short")}${hoTime ? ` ${hoTime}` : ""}` : hoTime || null,
          hoPriceText,
        ].filter(Boolean).join(" · ")
      : null;
    // Message text stored with the request (message_text). Studio-facing
    // pipeline input: format unchanged on 2 Nov.
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

    const hasErr = (f: FieldKey) => hoErrors.includes(f);
    // A field already marked bad is checked again as it changes and on blur.
    const recheck = (f: FieldKey, next: { name?: string; email?: string; phone?: string }) => {
      if (!hoErrors.includes(f)) return;
      const bad = validateContact(next.name ?? hoFullName, next.email ?? hoEmail, next.phone ?? hoPhone);
      if (!bad.includes(f)) setHoErrors(prev => prev.filter(x => x !== f));
    };

    // Send (2 Nov). The insert IS the request: whatsapp_requests AFTER INSERT
    // fires studio-ask, booking-ack and notify-whatsapp-request. Nothing opens
    // WhatsApp any more: the hand-off text had no "(#id)", so the bot started
    // a second flow for a request it already had (F4). Always tappable;
    // problems are shown next to their field.
    const sendHandoff = async () => {
      if (hoSentTo || waLoggedRef.current) return;
      const invalid = validateContact(hoFullName, hoEmail, hoPhone);
      reqTrack("req_submit_attempt", { invalid });
      setHoSendError(false);
      setHoErrors(invalid);
      if (!hoService) { hoGo(1); scrollToServices(); return; }
      if (invalid.length) {
        const first = invalid[0] === "name" ? hoNameRef : invalid[0] === "email" ? hoEmailRef : hoPhoneRef;
        first.current?.focus();
        first.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      waLoggedRef.current = true;
      setHoSending(true);
      const { first, last } = splitName(hoFullName);
      const phoneTyped = /\d/.test(hoPhone);
      const funnelMeta = {
        flow: "studio-handoff",
        studio: studioSlug,
        massage: servicePrimaryName(hoService),
        area: hood,
        people: hoPeople,
      };
      trackFunnel("wizard_submit_attempt", funnelMeta, studioSlug);
      const logged = await logWhatsappRequestResult({
        partner_id: partner.id,
        slug: partner.slug || null,
        studio_name: partner.business_name,
        service_name: servicePrimaryName(hoService),
        price: hasPrice ? hoPrice : null,
        day1: hoDate || null,
        time1: hoTime || null,
        day2: hoAltDate || null,
        time2: hoAltTime || null,
        day3: hoAlt2Date || null,
        time3: hoAlt2Time || null,
        first_name: first || null,
        last_name: last,
        contact_email: hoEmail.trim(),
        client_phone: phoneTyped ? hoPhone.trim() : null,
        languages: spokenLangs.join(", "),
        user_id: userId,
        wa_number: waNumber,
        message_text: waMsg,
      });
      setHoSending(false);
      if (logged.error) {
        waLoggedRef.current = false;
        setHoSendError(true);
        reqTrack("req_submit_error", { error: logged.error.slice(0, 120) });
        trackFunnel("wizard_submit_error", { ...funnelMeta, error: logged.error }, studioSlug);
        return;
      }
      waRequestIdRef.current = logged.id;
      clarityEvent("req_submit_ok");
      reqTrack("req_submit_ok", { has_phone: phoneTyped });
      trackFunnel("wizard_submit_ok", { ...funnelMeta, request_id: logged.id }, studioSlug);
      setHoSentTo(hoEmail.trim());
      hoGo(4, true);
    };

    const websiteUrl = (() => {
      if (!partner.website) return null;
      const w = String(partner.website).trim();
      return /^https?:\/\//i.test(w) ? w : `https://${w}`;
    })();
    // Handoff wizard navigation. Nothing goes back to editing once sent.
    function hoGo(n: number, afterSend = false) {
      if (hoSentTo && !afterSend) return;
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
    }
    // A day that makes the chosen time too soon clears that time.
    const pickDay = (v: string, tm: string, setD: (v: string) => void, setT: (v: string) => void) => {
      setD(v);
      if (v && tm && isTooSoon(v, tm)) { setT(""); return ""; }
      return tm;
    };
    const onHoDay = (v: string) => {
      const keptTime = pickDay(v, hoTime, setHoDate, setHoTime);
      trackFunnel("wizard_day_selected", { flow: "studio-handoff", day: v, massage: hoService ? servicePrimaryName(hoService) : null, area: hood }, studioSlug);
      if (v && keptTime) reqTrack("req_answer_when", { offset: dayOffset(v) });
    };
    const onHoTime = (v: string) => {
      setHoTime(v);
      trackFunnel("wizard_time_selected", { flow: "studio-handoff", time: v, massage: hoService ? servicePrimaryName(hoService) : null, area: hood }, studioSlug);
      if (v && hoDate) reqTrack("req_answer_when", { offset: dayOffset(hoDate) });
    };

    const inputCls = (bad: boolean) =>
      `w-full h-12 px-4 rounded-xl border bg-white text-base focus:outline-none focus:border-[#B85C38] ${bad ? "border-2 border-[#B03A2E]" : "border-gray-300"}`;
    const labelCls = "block text-sm font-semibold mb-1.5";

    return (
      <div className="min-h-screen pb-28" style={{ background: "#FAF6F1" }}>
        {brandBar()}
        <div className="px-4 pt-4">
        <div className="w-full max-w-md min-[900px]:max-w-[1100px] mx-auto rounded-2xl overflow-hidden" style={{ background: "#ffffff", boxShadow: "0 6px 24px rgba(80,44,20,0.08)" }}>
          <div className="px-4 min-[420px]:px-6 pt-4 pb-7 min-[900px]:pt-6 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_400px] min-[900px]:gap-10 min-[900px]:items-start">
            {/* LEFT: the real place, then the menu */}
            <div className="min-w-0">
              {visualBlock}
              {identityBlock}

              {profile.services.length > 0 && (
                <div id="mc-services-menu" className="mt-6 text-left scroll-mt-4">
                  <p className="text-xs min-[900px]:text-sm font-bold uppercase mb-2" style={{ color: "#B85C38", letterSpacing: "2px" }}>{c.servicesLabel}</p>
                  <div role="radiogroup" aria-label={c.servicesLabel} className="rounded-xl p-3 min-[900px]:p-4 space-y-2 min-[900px]:space-y-3"
                    style={{ background: "#FAF6F1" }}>
                    {profile.services.map((s: any) => {
                      const selected = hoServiceId === s.id;
                      const dur = Number(s.duration) > 0 ? Number(s.duration) : null;
                      const price = Number(s.price);
                      const tag = serviceTag(s);
                      const pick = () => {
                        if (hoSentTo) return;
                        setHoServiceId(selected ? "" : s.id);
                        if (!selected) {
                          trackEvent("wizard_service_selected", { slug: studioSlug, meta: { service: servicePrimaryName(s) } });
                          reqTrack("req_answer_massage", { value: servicePrimaryName(s) });
                        }
                      };
                      return (
                        <div
                          key={s.id}
                          role="radio"
                          aria-checked={selected}
                          tabIndex={0}
                          data-testid="service-row"
                          onClick={pick}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
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
                              <span className="text-right leading-tight">
                                <span className="block font-semibold" style={{ color: "#2b2b2b" }}>{eur(price)}</span>
                                {tag && <span className="block text-xs font-semibold" style={{ color: "#B85C38" }}>{tag}</span>}
                              </span>
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

            {/* RIGHT: the request panel (sticky on desktop) */}
            <div ref={hoPanelRef} className="mt-6 min-[900px]:mt-0 min-[900px]:sticky min-[900px]:top-4 text-left scroll-mt-4">
              <Stepper steps={pickCopy(HANDOFF_STEPS_COPY, lang)} current={hoStep} maxReached={hoSentTo ? 0 : hoMaxStep} onGo={(n) => hoGo(n)} />
              {/* One actionable button at a time: the sticky bar hides its own
                  while the inline one is on screen. */}
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
                  ready
                  busy={hoSending}
                  busyLabel={sp.sending}
                  onNext={() => void sendHandoff()}
                  label={sp.send}
                  summary={hoSummaryLine}
                  inlineRef={hoSendRef}
                />
              )}

              <div className="rounded-2xl p-4 min-[900px]:p-5 mt-3 mb-4" style={{ background: "#FAF6F1" }}>
                {hoStep <= 3 && (
                  <p className="text-xs min-[900px]:text-sm font-bold uppercase mb-3" style={{ color: "#B85C38", letterSpacing: "2px" }}>
                    {t("app.handoff.prefTitle")}
                  </p>
                )}

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
                            {[Number((hoService as any).duration) > 0 ? `${Number((hoService as any).duration)} min` : null, hoPriceText].filter(Boolean).join(" · ")}
                          </span>
                        </>
                      ) : (
                        <span className="block text-sm min-[900px]:text-base font-semibold" style={{ color: "#7A7068" }}>{c.chooseServiceContinue}</span>
                      )}
                    </div>

                    <button
                      ref={hoInlineContinueRef}
                      type="button"
                      onClick={() => { if (!hoServiceId) { scrollToServices(); return; } hoGo(2); }}
                      className="mt-3 w-full min-h-[48px] rounded-full px-5 py-3 text-base font-semibold text-white motion-safe:transition"
                      style={{ background: "#B85C38" }}
                    >
                      {c.continueLabel}
                    </button>
                  </div>
                )}

                {/* STEP 2: day and time (Madrid time, never in the past) */}
                {hoStep === 2 && (
                  <div className="space-y-3 min-[900px]:space-y-4">
                    <div className="rounded-2xl px-3 py-2.5" style={{ background: "#F4EEE6" }}>
                      <p className="text-sm leading-snug" style={{ color: "#5C5349" }}>
                        {c.contactStep}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefDate")}</span>
                      <div className="mt-1.5">
                        <DayStrip value={hoDate} onChange={onHoDay} label={t("app.handoff.prefDate")} />
                      </div>
                    </div>
                    <div>
                      <span className="text-sm min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefTime")}</span>
                      <div className="mt-1.5">
                        <TimePills value={hoTime} date={hoDate} onChange={onHoTime} label={t("app.handoff.prefTime")} />
                      </div>
                    </div>
                    {!altOpen ? (
                      <button
                        type="button"
                        onClick={() => setAltOpen(true)}
                        className="min-h-[44px] text-sm min-[900px]:text-base font-semibold underline underline-offset-2"
                        style={{ color: "#B85C38" }}
                      >
                        {c.addSecondChoice}
                      </button>
                    ) : (
                      <>
                        <div>
                          <span className="text-sm min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefAlt")}</span>
                          <div className="mt-1.5 space-y-2 min-[900px]:space-y-3">
                            <DayStrip value={hoAltDate} onChange={(v) => pickDay(v, hoAltTime, setHoAltDate, setHoAltTime)} label={t("app.handoff.prefAlt")} />
                            <TimePills value={hoAltTime} date={hoAltDate} onChange={setHoAltTime} label={t("app.handoff.prefAlt")} />
                          </div>
                        </div>
                        {!alt2Open ? (
                          <button
                            type="button"
                            onClick={() => setAlt2Open(true)}
                            className="min-h-[44px] text-sm min-[900px]:text-base font-semibold underline underline-offset-2"
                            style={{ color: "#B85C38" }}
                          >
                            {c.addThirdChoice}
                          </button>
                        ) : (
                          <div>
                            <span className="text-sm min-[900px]:text-base" style={{ color: "#7A7068" }}>
                              {c.thirdChoice}
                            </span>
                            <div className="mt-1.5 space-y-2 min-[900px]:space-y-3">
                              <DayStrip value={hoAlt2Date} onChange={(v) => pickDay(v, hoAlt2Time, setHoAlt2Date, setHoAlt2Time)} label={c.thirdChoice} />
                              <TimePills value={hoAlt2Time} date={hoAlt2Date} onChange={setHoAlt2Time} label={c.thirdChoice} />
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

                {/* STEP 3: your details, with Send */}
                {hoStep === 3 && (
                  <form
                    noValidate
                    className="space-y-4"
                    onSubmit={(e) => { e.preventDefault(); void sendHandoff(); }}
                  >
                    {hoSummaryLine && (
                      <p className="rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold" style={{ borderColor: "#E6DCCF", color: "#2b2b2b" }}>
                        {hoSummaryLine}
                      </p>
                    )}
                    <div>
                      <label htmlFor="ho-name" className={labelCls} style={{ color: "#3d2b1f" }}>{sp.yourName}</label>
                      <input
                        id="ho-name"
                        ref={hoNameRef}
                        value={hoFullName}
                        onChange={(e) => { setHoFullName(e.target.value); recheck("name", { name: e.target.value }); }}
                        onBlur={() => recheck("name", {})}
                        autoComplete="name"
                        aria-invalid={hasErr("name")}
                        aria-describedby={hasErr("name") ? "ho-name-err" : undefined}
                        className={inputCls(hasErr("name"))}
                      />
                      {hasErr("name") && (
                        <p id="ho-name-err" role="alert" className="mt-1.5 text-sm" style={{ color: "#B03A2E" }}>{sp.errName}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="ho-email" className={labelCls} style={{ color: "#3d2b1f" }}>{sp.emailLabel}</label>
                      <input
                        id="ho-email"
                        ref={hoEmailRef}
                        value={hoEmail}
                        onChange={(e) => { setHoEmail(e.target.value); recheck("email", { email: e.target.value }); }}
                        onBlur={() => recheck("email", {})}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        aria-required="true"
                        aria-invalid={hasErr("email")}
                        aria-describedby={hasErr("email") ? "ho-email-err" : "ho-email-help"}
                        className={inputCls(hasErr("email"))}
                      />
                      {hasErr("email") ? (
                        <p id="ho-email-err" role="alert" className="mt-1.5 text-sm" style={{ color: "#B03A2E" }}>{sp.errEmail}</p>
                      ) : (
                        <p id="ho-email-help" className="mt-1.5 text-sm" style={{ color: "#7A7068" }}>{sp.emailHelp}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="ho-phone" className={labelCls} style={{ color: "#3d2b1f" }}>{sp.phoneLabel}</label>
                      <input
                        id="ho-phone"
                        ref={hoPhoneRef}
                        value={hoPhone}
                        onChange={(e) => { setHoPhone(e.target.value); recheck("phone", { phone: e.target.value }); }}
                        onBlur={() => recheck("phone", {})}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+34 600 123 456"
                        aria-invalid={hasErr("phone")}
                        aria-describedby={hasErr("phone") ? "ho-phone-err" : undefined}
                        className={inputCls(hasErr("phone"))}
                      />
                      {hasErr("phone") && (
                        <p id="ho-phone-err" role="alert" className="mt-1.5 text-sm" style={{ color: "#B03A2E" }}>{sp.errPhone}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="ho-notes" className={labelCls} style={{ color: "#3d2b1f" }}>{sp.notesLabel}</label>
                      <textarea
                        id="ho-notes"
                        value={hoNotes}
                        onChange={(e) => setHoNotes(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-base focus:outline-none focus:border-[#B85C38] resize-none h-24"
                      />
                    </div>
                    <div>
                      {!hoPeopleOpen ? (
                        <button
                          type="button"
                          onClick={() => setHoPeopleOpen(true)}
                          className="min-h-[44px] text-sm font-medium underline underline-offset-2"
                          style={{ color: "#5a4736" }}
                        >
                          {c.moreThanOne}
                        </button>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {["1", ...PEOPLE_OPTIONS].map((n) => {
                            const on = hoPeople === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                aria-pressed={on}
                                onClick={() => setHoPeople(n)}
                                className={`h-11 min-w-[2.75rem] px-3 rounded-lg border text-base font-medium ${
                                  on ? "border-[#B85C38] bg-[#FDF3EC] text-[#B85C38]" : "border-gray-300 bg-white text-gray-700"
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                          <p className="w-full mt-1 text-sm" style={{ color: "#7A7068" }}>
                            {c.groupCheck}
                          </p>
                        </div>
                      )}
                    </div>
                    {hoSendError && (
                      <p role="alert" className="rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: "#FBEAE7", color: "#B03A2E" }}>
                        {sp.sendError}
                      </p>
                    )}
                    <button
                      ref={hoSendRef}
                      type="submit"
                      disabled={hoSending}
                      className="w-full min-h-[52px] rounded-2xl px-6 text-base min-[900px]:text-lg font-semibold text-white motion-safe:transition hover:opacity-95"
                      style={{ background: "#B85C38", opacity: hoSending ? 0.75 : 1 }}
                    >
                      {hoSending ? sp.sending : sp.send}
                    </button>
                    <p className="text-sm text-center" style={{ color: "#7A7068" }}>{c.waReassuranceStudios}</p>
                    <WizardNav onBack={() => hoGo(2)} />
                  </form>
                )}

                {/* STEP 4: sent. Honest: nothing is booked yet, no timing promise. */}
                {hoStep === 4 && hoSentTo && (
                  <div className="space-y-4 text-left" data-testid="handoff-sent">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "#EAF3E7" }}>
                      <Check size={26} style={{ color: "#3F6B36" }} aria-hidden="true" />
                    </div>
                    <h2 role="status" className="font-display text-2xl font-semibold leading-tight" style={{ color: "#2b2b2b" }}>
                      {fill(sp.sentTitle, { studio: partner.business_name })}
                    </h2>
                    <div className="rounded-xl bg-white p-3 min-[900px]:p-4 space-y-2 border" style={{ borderColor: "#E6DCCF" }}>
                      <SummaryRow label={c.service} value={hoService ? servicePrimaryName(hoService) : null} placeholder={c.pickAService} />
                      <SummaryRow label={c.day} value={hoDate ? pageDate(hoDate, "long") : null} placeholder={c.anyDay} />
                      <SummaryRow label={c.time} value={hoTime || null} placeholder={c.anyTime} />
                      {hoAltDate && hoAltTime && (
                        <SummaryRow label={c.secondChoice} value={`${pageDate(hoAltDate, "short")} ${hoAltTime}`} placeholder="" />
                      )}
                      {hoPriceText && <SummaryRow label={c.price} value={hoPriceText} placeholder="" />}
                    </div>
                    <ul className="space-y-2 text-sm leading-snug" style={{ color: "#3d2b1f" }}>
                      <li className="flex gap-2"><Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#B85C38" }} aria-hidden="true" />{fill(sp.sentContact, { studio: partner.business_name })}</li>
                      <li className="flex gap-2"><Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#B85C38" }} aria-hidden="true" />{fill(sp.sentAnswer, { email: maskEmail(hoSentTo) })}</li>
                      <li className="flex gap-2"><Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#B85C38" }} aria-hidden="true" />{sp.sentYes}</li>
                    </ul>
                    <AccountOfferBlock
                      firstName={splitName(hoFullName).first}
                      lastName={splitName(hoFullName).last || ""}
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
                    {nearbyBlock}
                  </div>
                )}
              </div>
            </div>

            {/* BELOW: how booking works here, then other studios nearby */}
            <div className="mt-8 min-[900px]:col-span-2 space-y-6">
              <section className="rounded-2xl p-4 min-[900px]:p-5 text-left" style={{ background: "#FAF6F1" }}>
                <h2 className="text-xs min-[900px]:text-sm font-bold uppercase mb-2" style={{ color: "#B85C38", letterSpacing: "2px" }}>{sp.howHereTitle}</h2>
                <p className="text-sm min-[900px]:text-base leading-snug" style={{ color: "#5a4736" }}>{sp.notOnClub}</p>
              </section>
              {!hoSentTo && nearbyBlock}
              {websiteUrl && (
                <p className="text-center">
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sm underline underline-offset-2 hover:opacity-80" style={{ color: "#8a7460" }}>
                    {t("app.handoff.visitWebsite")}
                  </a>
                </p>
              )}
            </div>

            <div className="mt-6 text-xs min-[900px]:col-span-2 text-center" style={{ color: "#8a7460" }}>
              {c.footerCredit}
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Name plus at least one valid way to reach them (WhatsApp number OR email).
  const contact = contactOk(phone, email);
  // Email is mandatory: WhatsApp only lets us reply for free for 24h, so a
  // request with no email is one we cannot answer at all.
  const emailValid = isValidEmail(email);
  const hasContact = emailValid && contact.phoneValid !== false;
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

  // Continue on Your details is always tappable (2 Nov). It checks the fields
  // on tap and puts each problem next to its field.
  const submitDetailsStep = () => {
    const invalid = validateContact(fullName, email, phone);
    reqTrack("req_submit_attempt", { invalid });
    setDErrors(invalid);
    if (invalid.length) {
      const first = invalid[0] === "name" ? nameRef : invalid[0] === "email" ? emailRef : phoneRef;
      first.current?.focus();
      first.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    goStep(5);
  };
  const dHasErr = (f: FieldKey) => dErrors.includes(f);
  const dRecheck = (f: FieldKey, next: { name?: string; email?: string; phone?: string }) => {
    if (!dErrors.includes(f)) return;
    const bad = validateContact(next.name ?? fullName, next.email ?? email, next.phone ?? phone);
    if (!bad.includes(f)) setDErrors(prev => prev.filter(x => x !== f));
  };


  const handleBook = async () => {
    if (!canBook) return;
    trackEvent("booking_submitted", { slug: partner?.slug || studioId });
    trackFunnel("wizard_submit_attempt", {
      flow: "studio",
      studio: partner?.slug || studioId,
      massage: service ? servicePrimaryName(service) : null,
      area: hood,
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
        requestAccountSignup({ email: email.trim(), name: firstName, lang: siteLang });
      }

      trackFunnel("wizard_submit_ok", {
        flow: "studio",
        studio: partner?.slug || studioId,
        massage: service ? servicePrimaryName(service) : null,
        area: hood,
        request_id: data?.id ?? null,
      }, partner?.slug || studioId);
      reqTrack("req_submit_ok", { has_phone: /\d/.test(phone) });
      // "#3FA85F": six characters a person can read out, not the raw uuid (F13).
      setDone({ ref: `#${String(data.id).replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase()}`, status: "pending" });

    } catch (e: any) {
      const msg = String(e?.message || "");
      reqTrack("req_submit_error", { error: (msg || "unknown_error").slice(0, 120) });
      trackFunnel("wizard_submit_error", {
        flow: "studio",
        studio: partner?.slug || studioId,
        massage: service ? servicePrimaryName(service) : null,
        area: hood,
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
    <div className="min-h-screen bg-[#FAF6F1]">
      {brandBar()}
      {/* The real place first (SP1, 2 Nov): the studio's own photo (or a map),
          then name, place, rating, price and how it works, all on the first
          screen. The photo used to carry the text on top of it, with the
          account pill floating over everything. */}
      <div className="max-w-lg min-[900px]:max-w-[1100px] mx-auto px-5 pt-4 min-[900px]:pt-6 min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:gap-8 min-[900px]:items-center min-[900px]:[&_h1]:mt-0">
        <div className="[&_img]:max-h-[300px] min-[900px]:[&_img]:max-h-[380px]">{visualBlock}</div>
        <div>{identityBlock}</div>
      </div>

      <div className="max-w-lg min-[900px]:max-w-[1100px] mx-auto px-5 py-5 pb-28">
        {/* Stepper: always visible so nobody misses a step */}
        <Stepper steps={pickCopy(BOOKING_STEPS_COPY, lang)} current={step} maxReached={maxStep} onGo={goStep} />

        {/* Always reachable Continue, so the primary action never hides below the fold */}
        {step === 1 && <StickyContinue ready={!!service} onNext={() => goStep(2)} />}
        {step === 2 && <StickyContinue ready={!!date && !!time} onNext={() => goStep(3)} />}
        {step === 3 && <StickyContinue ready onNext={() => goStep(4)} />}
        {step === 4 && (
          <StickyContinue ready onNext={submitDetailsStep} />
        )}
        {step === 5 && (
          <StickyContinue
            ready={canBook}
            busy={submitting}
            busyLabel={sp.sending}
            onNext={handleBook}
            label={`${instantConfirm ? c.bookNow : c.requestBooking}${total > 0 ? ` · ${eur(total)}` : ""}`}
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
            <span className={service && total > 0 ? "font-semibold text-[#C4622D]" : "text-gray-400"}>{service && total > 0 ? eur(total) : c.priceLabel}</span>
          </p>
        </div>

        <div className="mt-5 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_360px] min-[900px]:gap-8 min-[900px]:items-start">
          {/* LEFT: one step at a time */}
          <div className="space-y-5 min-w-0">

            {/* STEP 1: service */}
            {step === 1 && (
              <div ref={serviceRef}>
                <Section step="1" title={c.chooseService}>
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
                      {profile.services.map(s => (
                        <div key={s.id}>
                          <button data-testid="service-row" onClick={(e) => { if (serviceId !== s.id) reqTrack("req_answer_massage", { value: servicePrimaryName(s) }); setServiceId(s.id); trackEvent("wizard_service_selected", { slug: partner?.slug || studioId, meta: { service: servicePrimaryName(s) } }); scrollIntoViewGently(e.currentTarget); }}
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
                                  <p className="font-bold text-[#C4622D] min-[900px]:text-lg text-right leading-tight">
                                    {eur(Number(s.price))}
                                    {serviceTag(s) && <span className="block text-xs font-semibold">{serviceTag(s)}</span>}
                                  </p>
                                )}
                                <MassageTypeInfoButton names={[(s as any).name_en, s.name, (s as any).type]} />
                              </div>
                            </div>
                          </button>
                        </div>
                      ))}
                      {profile.services.length === 0 && <p className="text-sm min-[900px]:text-base text-gray-400">{c.noServicesYet}</p>}
                      <Link
                        to={quizHref}
                        className="w-full flex items-center gap-2 p-4 min-[900px]:p-5 rounded-2xl border border-dashed border-[#C4622D] bg-[#FAF6F1] motion-safe:transition hover:bg-[#F6EFE6]"
                      >
                        <Sparkles size={18} className="text-[#C4622D] flex-shrink-0" />
                        <span className="min-w-0 text-left">
                          <span className="block text-sm min-[900px]:text-base font-semibold text-[#C4622D]">{c.notSureQuiz}</span>
                        </span>
                      </Link>
                    </div>
                  )}
                  {(partner.description || (partner.gallery || []).length > 0) && (
                    <div className="mt-6">
                      <p className="text-xs min-[900px]:text-sm font-bold uppercase mb-2 text-[#B85C38] tracking-[2px]">{sp.aboutTitle}</p>
                      {partner.description && <p className="text-sm min-[900px]:text-base text-gray-600 mb-4">{partner.description}</p>}
                      <StudioGallery items={partner.gallery || []} />
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
                          <button key={isoDate(d)} onClick={(e) => { setDate(d); setTime(null); trackFunnel("wizard_day_selected", { flow: "studio", day: isoDate(d), massage: service ? servicePrimaryName(service) : null, area: hood }, partner?.slug || studioId); scrollIntoViewGently(e.currentTarget); }}
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
                              <button key={t} onClick={() => { setTime(t); if (date) reqTrack("req_answer_when", { offset: dayOffset(isoDate(date)) }); trackFunnel("wizard_time_selected", { flow: "studio", time: t, massage: service ? servicePrimaryName(service) : null, area: hood }, partner?.slug || studioId); }}
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

            {/* STEP 4: your details. One name field, labelled 16px inputs,
                errors next to the field on tap (2 Nov). */}
            {step === 4 && (
              <div>
                <Section step="4" title={c.yourDetails}>
                  <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); submitDetailsStep(); }}>
                    <div>
                      <label htmlFor="d-name" className="block text-sm font-semibold mb-1.5 text-[#3d2b1f]">{sp.yourName}</label>
                      <input id="d-name" ref={nameRef} value={fullName}
                        onChange={e => { setFullName(e.target.value); dRecheck("name", { name: e.target.value }); }}
                        onBlur={() => dRecheck("name", {})}
                        autoComplete="name"
                        aria-invalid={dHasErr("name")}
                        aria-describedby={dHasErr("name") ? "d-name-err" : undefined}
                        className={`w-full h-12 px-4 rounded-xl border bg-white text-base focus:outline-none focus:border-[#C4622D] ${dHasErr("name") ? "border-2 border-[#B03A2E]" : "border-gray-300"}`} />
                      {dHasErr("name") && <p id="d-name-err" role="alert" className="mt-1.5 text-sm text-[#B03A2E]">{sp.errName}</p>}
                    </div>
                    <div>
                      <label htmlFor="d-email" className="block text-sm font-semibold mb-1.5 text-[#3d2b1f]">{sp.emailLabel}</label>
                      <input id="d-email" ref={emailRef} value={email}
                        onChange={e => { setEmail(e.target.value); dRecheck("email", { email: e.target.value }); }}
                        onBlur={() => dRecheck("email", {})}
                        type="email" inputMode="email" autoComplete="email" aria-required="true"
                        aria-invalid={dHasErr("email")}
                        aria-describedby={dHasErr("email") ? "d-email-err" : "d-email-help"}
                        className={`w-full h-12 px-4 rounded-xl border bg-white text-base focus:outline-none focus:border-[#C4622D] ${dHasErr("email") ? "border-2 border-[#B03A2E]" : "border-gray-300"}`} />
                      {dHasErr("email")
                        ? <p id="d-email-err" role="alert" className="mt-1.5 text-sm text-[#B03A2E]">{sp.errEmail}</p>
                        : <p id="d-email-help" className="mt-1.5 text-sm text-[#7A7068]">{sp.emailHelp}</p>}
                    </div>
                    <div>
                      <label htmlFor="d-phone" className="block text-sm font-semibold mb-1.5 text-[#3d2b1f]">{sp.phoneLabel}</label>
                      <input id="d-phone" ref={phoneRef} value={phone}
                        onChange={e => { setPhone(e.target.value); dRecheck("phone", { phone: e.target.value }); }}
                        onBlur={() => dRecheck("phone", {})}
                        type="tel" inputMode="tel" autoComplete="tel" placeholder="+34 600 123 456"
                        aria-invalid={dHasErr("phone")}
                        aria-describedby={dHasErr("phone") ? "d-phone-err" : undefined}
                        className={`w-full h-12 px-4 rounded-xl border bg-white text-base focus:outline-none focus:border-[#C4622D] ${dHasErr("phone") ? "border-2 border-[#B03A2E]" : "border-gray-300"}`} />
                      {dHasErr("phone") && <p id="d-phone-err" role="alert" className="mt-1.5 text-sm text-[#B03A2E]">{sp.errPhone}</p>}
                    </div>
                    <div>
                      {!peopleOpen ? (
                        <button
                          type="button"
                          onClick={() => setPeopleOpen(true)}
                          className="min-h-[44px] text-sm font-medium underline underline-offset-2 text-[#5a4736]"
                        >
                          {c.moreThanOne}
                        </button>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {["1", ...PEOPLE_OPTIONS].map((n) => {
                            const on = people === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                aria-pressed={on}
                                onClick={() => setPeople(n)}
                                className={`h-11 min-w-[2.75rem] px-3 rounded-lg border text-base font-medium ${
                                  on ? "border-[#C4622D] bg-[#FDF3EC] text-[#C4622D]" : "border-gray-300 bg-white text-gray-700"
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                          <p className="w-full mt-1 text-sm text-[#7A7068]">
                            {c.groupCheck}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Opt-in only: a pre-ticked box sent sign-up emails nobody asked for (F5). */}
                    {!userId && !!email.trim() && (
                      <label className="flex items-start gap-3 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-5 w-5 flex-shrink-0"
                          checked={createAccount}
                          onChange={e => setCreateAccount(e.target.checked)}
                        />
                        <span className="text-sm text-gray-700 leading-snug">
                          {c.createAccount}
                          <span className="block text-xs text-gray-500">
                            {c.createAccountSub}
                          </span>
                        </span>
                      </label>
                    )}
                    <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">{c.continueLabel}</button>
                  </form>
                </Section>
                <WizardNav onBack={() => goStep(3)} />

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
                    area: hood,
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
                    // The visitor may tap this before filling in their details;
                    // they are messaging us themselves, so log the handoff even
                    // without an email (it is still recorded when entered).
                    handoff: true,
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
            {/* Other studios nearby (SP1). The "Email me deals" block that
                sat here was removed on 2 Nov: we never pre-announce a discount. */}
            {nearbyBlock}
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

/** The hand-off times still bookable on a day (Madrid time, an hour's notice). */
const handoffTimesFor = (iso: string) =>
  iso ? HANDOFF_TIMES.filter(t => !isTooSoon(iso, t)) : HANDOFF_TIMES;

/**
 * Horizontal day strip used by the hand-off form (ISO value in/out). 14 days
 * from Madrid today; today only while a time is left (until 19:00).
 */
function DayStrip({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const lang = useFlowLang();
  const days = madridDays(14)
    .filter((iso, i) => i > 0 || handoffTimesFor(iso).length > 0)
    .map(iso => ({ iso, d: isoToLocalDate(iso) }));
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {days.map(({ iso, d }) => {
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

/**
 * Rounded time pills for the hand-off form (fixed options, real availability
 * unknown). On today, only times from an hour after Madrid now.
 */
function TimePills({ value, date, onChange, label }: { value: string; date?: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2 min-[900px]:gap-3">
      {handoffTimesFor(date || "").map(t => {
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
  ready, onNext, label, busy, busyLabel, badge, note, summary, inlineRef,
}: {
  ready: boolean; onNext: () => void; label?: string; busy?: boolean; busyLabel?: string;
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
      <div className="fixed inset-x-0 z-30 border-t border-[#EADFD2] bg-[#FAF6F1]/95 backdrop-blur px-5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]" style={{ bottom: "var(--consent-h, 0px)" }}>
        <p className="max-w-lg min-[900px]:max-w-[1100px] mx-auto w-full text-center text-[12px] min-[900px]:text-sm font-semibold truncate text-[#5a4736]">
          {summary}
        </p>
      </div>
    );
  }
  return (
    <div className="fixed inset-x-0 z-30 border-t border-[#EADFD2] bg-[#FAF6F1]/95 backdrop-blur shadow-[0_-6px_24px_rgba(80,44,20,0.06)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ bottom: "var(--consent-h, 0px)" }}>
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
          <span className="min-[900px]:text-lg">{busy ? busyLabel || c.booking : label || c.continueLabel}</span>
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
  const navRef = useRef<HTMLElement | null>(null);
  const firstRender = useRef(true);
  // On narrow screens the steps scroll sideways, so keep the active one in
  // view. Only the strip scrolls, horizontally, and never on first render:
  // scrollIntoView here used to drag the whole page down to the stepper on
  // load (scrollY 1361 on /onixama), past the studio's name and address.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const nav = navRef.current;
    const el = activeRef.current;
    if (!nav || !el || nav.scrollWidth <= nav.clientWidth) return;
    try {
      nav.scrollTo({ left: el.offsetLeft - nav.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
    } catch { /* old browsers: no smooth scroll */ }
  }, [current]);
  return (
    <nav
      ref={navRef}
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
 * Back and Skip stay visually quiet so the single Continue owns the attention.
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
          <button type="button" onClick={onBack} className="text-xs min-[900px]:text-sm text-[#A6968A] hover:text-[#8a7460] motion-safe:transition">
            {c.back}
          </button>
        ) : <span />}
      </div>
      {skip && (
        <div className="text-center">
          <button type="button" onClick={skip} className="text-xs text-[#B0A696] hover:text-[#8a7460] motion-safe:transition">
            {c.skipStep}
          </button>
        </div>
      )}
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

