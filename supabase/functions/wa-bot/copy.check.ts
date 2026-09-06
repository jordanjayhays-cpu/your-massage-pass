// Regression checks for the words the bot relies on. Run from the repo root:
//   node --experimental-strip-types supabase/functions/wa-bot/copy.check.ts
// Each case is a real message from the 5-6 Sept founder_log or the button ids
// the bot must route. No test runner, no install: plain Node 22+.
import { EROTIC_RE, strongSpanish, CANCEL_RE, AD_OPENER_RE } from "./copy.ts";

let fails = 0;
const check = (label: string, got: boolean, want: boolean) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label} -> ${got} (want ${want})`);
};

// The block list must be accent-proof (Rojo, 5 Sept: "tántrico, ayurvírico, nuru").
check("erotic: masajes tántrico, ayurvírico, nuru", EROTIC_RE.test("masajes tántrico, ayurvírico, nuru"), true);
check("erotic: TÁNTRICO upper", EROTIC_RE.test("Busco masaje TÁNTRICO"), true);
check("erotic: nuru alone", EROTIC_RE.test("nuru?"), true);
check("erotic: tantra", EROTIC_RE.test("masaje tantra"), true);
check("erotic: final feliz", EROTIC_RE.test("con final feliz"), true);
check("erotic: happy ending", EROTIC_RE.test("Hi, is it a massage with happy ending?"), true);
check("erotic: plain relaxing (no block)", EROTIC_RE.test("masaje relajante de una hora"), false);
check("erotic: ayurvedic alone (no block)", EROTIC_RE.test("ayurvedic massage"), false);
check("erotic: deep tissue (no block)", EROTIC_RE.test("deep tissue tomorrow at 5"), false);

// A Spanish speaker who types instead of tapping must read as Spanish (Ismael, 5 Sept).
check("es: Hola", strongSpanish("Hola"), true);
check("es: Español", strongSpanish("Español"), true);
check("es: Gracias", strongSpanish("Gracias"), true);
check("es: Buenos días, quería información", strongSpanish("Buenos días, quería información"), true);
check("es: quiero un masaje relajante mañana", strongSpanish("quiero un masaje relajante mañana"), true);
check("es: relajante de hora y media", strongSpanish("Relajante de hora y media"), true);
check("es: sesión de una hora cerca de Sol", strongSpanish("sesión de una hora cerca de Sol"), true);
check("es: ¿Qué tipo de masaje ofrecen?", strongSpanish("¿Qué tipo de masaje ofrecen?"), true);
check("en: ad opener stays English", strongSpanish("Hi, I'd like to book a massage. I saw you on Facebook."), false);
check("en: deep tissue tomorrow at 5", strongSpanish("Deep tissue tomorrow at 5"), false);
check("en: Thai massage in Retiro please", strongSpanish("Thai massage in Retiro please"), false);
check("en: yes", strongSpanish("yes"), false);
check("en: Hi", strongSpanish("Hi"), false);
check("ad opener regex", AD_OPENER_RE.test("Hi, I'd like to book a massage. I saw you on Facebook."), true);

// Typed cancellations (Anderson, 5 Sept).
check("cancel: Cancelar", CANCEL_RE.test("Cancelar"), true);
check("cancel: quiero cancelar la reserva", CANCEL_RE.test("quiero cancelar la reserva"), true);
check("cancel: ya no", CANCEL_RE.test("ya no lo quiero"), true);
check("cancel: plain no (not a cancel word)", CANCEL_RE.test("No"), false);

// Button routing as written in bot.ts.
const STUDIO_BTN = /^studio_(confirm|other|no)_\d+$/;
check("route: studio_no_55", STUDIO_BTN.test("studio_no_55"), true);
check("route: studio_confirm_55", STUDIO_BTN.test("studio_confirm_55"), true);
check("route: studio_other (customer list row, not a studio)", STUDIO_BTN.test("studio_other"), false);
const RC = /^rc_(yes|change|cancel)_(\d+)$/;
check("route: rc_cancel_48", RC.test("rc_cancel_48"), true);

console.log(fails ? `\n${fails} FAILED` : "\nall checks passed");
process.exit(fails ? 1 : 0);
