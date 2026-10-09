// recover-abandoned - the last touch for people who started a booking and went
// quiet for more than 24 hours, which is exactly when WhatsApp stops letting us
// write freely. Inside 24h the rescue job nudges them; past it, only an
// approved template can reach them, so this sends booking_unfinished_v1 once
// per person, ever.
//
// The clever part is the button payloads: they map onto handlers wa-bot
// already has, so one tap finishes the job.
//   "Finish my booking" -> pick_yes  (session pre-armed with real studio
//                          matches, so the tap creates the request outright)
//                       -> menu_book (when we never got their day/time, so the
//                          flow restarts instead of booking something wrong)
//   "No thanks"         -> rebook_later (existing warm goodbye)
//
// 17 Sept: "once per person, ever" was a promise the session could not keep.
// The only record was data.recoverySent on wa_sessions, and wa-bot clears that
// data when someone taps Finish my booking, so the flag went with it and
// Favioagui got a second template the next morning (15 Sept 07:07, 16 Sept
// 11:07). The funnel_events row written on every send is permanent, so that is
// what is read now. The session flag is still honoured as a second source.
//
// v8 (9 Oct):
//  - A "Today" or "Tomorrow" chosen on an earlier day is not repeated. On 9 Oct
//    13:07 a customer who had picked "Today" on Thursday 8 Oct got "Your massage
//    is still saved with us: relaxing massage, Today" on Friday. A relative day
//    whose stored date has passed is left out, and the one-tap "book it" is not
//    armed for it (the tap restarts the flow instead).
//  - Language: a session that never set one used to get English. A Spanish
//    speaking country code, or a Spain number with a Spanish name, gets the
//    Spanish template now (same rule as wa-bot v188's first message).
//  - Moved into the repo with no secrets; the deployed loader passes them in.
//
// GET ?key=<CRON_KEY>[&dry=1][&phone=<one number>]

const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
let CRON_KEY = "";
let RESEND_API_KEY = "";
const FROM_EMAIL = "Massage Club <support@massageclub.io>";
const FOUNDER = ["support@massageclub.io"];
let WA_TOKEN = "";
let PHONE_ID = "1270437552818077";
let GRAPH = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;
const TEMPLATE = "booking_unfinished_v1";

// Steps that mean "they were mid-booking". human and done are deliberately out:
// human is Jordan's conversation, done already booked.
const FLOW_STEPS = ["await_service", "await_day", "await_day_text", "await_time", "await_hour", "await_time_text", "await_area", "await_studio", "await_studio_text", "await_name", "await_email"];

const digitsOf = (s: string) => String(s || "").replace(/[^0-9]/g, "");

// Jordan's own numbers and the friend testers (Cata, Yi, Ritik). Gerome has no
// phone on file. None of them may ever get a marketing template. v8: the fake
// 3460000xxxx test customers too.
const TEST_PHONES = ["15622355063", "17867276503", "34612474827", "34635569364", "34662680781"];
const isTestPhone = (p: string) => {
  const d = digitsOf(p);
  if (TEST_PHONES.includes(d)) return true;
  if (d.startsWith("86") && d.endsWith("997")) return true;
  if (/^3460000\d{4}$/.test(d)) return true;
  return false;
};

// The euphemisms. Someone who asked for these gets the standard line and
// nothing further, so they must never receive a "come finish your booking"
// template. Kept in step with EROTIC_RE in copy.ts.
const EROTIC_RE = /\b(er[oó]tic\w*|sensual\w*|sensitiv[oa]s?\b|sensitive\s+(?:massage|masaje)|(?:massage|masaje)\s+sensitive|t[aá]ntr\w*|nuru|happy\s*end\w*|final\s*feliz|con\s*extras?|extra\s*servic\w*|servicios?\s*extras?|servicio\s*completo|body\s*(2|to)\s*body|lingam|yoni|prostat\w*)\b/i;

const madridHour = (): number => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date()));

const SVC_LABEL: Record<string, { en: string; es: string }> = {
  svc_relax: { en: "relaxing massage", es: "masaje relajante" },
  svc_deep: { en: "deep tissue massage", es: "masaje descontracturante" },
  svc_thai: { en: "Thai massage", es: "masaje tailandés" },
  svc_sports: { en: "sports massage", es: "masaje deportivo" },
  svc_stone: { en: "hot stone massage", es: "masaje de piedras calientes" },
  svc_bali: { en: "Balinese massage", es: "masaje balinés" },
  svc_shiatsu: { en: "shiatsu", es: "shiatsu" },
  svc_reflex: { en: "reflexology", es: "reflexología" },
  svc_lymph: { en: "lymphatic drainage", es: "drenaje linfático" },
  svc_couples: { en: "couples massage", es: "masaje en pareja" },
  svc_kobido: { en: "Kobido facial massage", es: "masaje facial Kobido" },
  svc_unsure: { en: "massage", es: "masaje" },
};

// v8: the long dates wa-bot stores in data.dayDate ("Thursday 8 October",
// "jueves 8 de octubre"), so a stored relative day can be checked against today.
const LONG_ES = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
const LONG_EN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
const longDates = (plusDays: number) => {
  const d = new Date(Date.now() + plusDays * 86400e3);
  return [LONG_EN.format(d), LONG_ES.format(d)].map((x) => x.replace(/,/g, ""));
};
// A relative day ("Today", "Mañana", "tonight") is only still true when its
// stored date is today's (or tomorrow's) date. Without a stored date we cannot
// tell, so it is treated as stale too.
function relativeDayStale(d: Record<string, any>): boolean {
  const day = String(d.day || "").trim();
  if (!/^(today|tonight|hoy|tomorrow|ma[nñ]ana)$/i.test(day)) return false;
  const stored = String(d.dayDate || "").replace(/,/g, "");
  if (!stored) return true;
  const isToday = /^(today|tonight|hoy)$/i.test(day);
  return !(isToday ? longDates(0) : longDates(1)).includes(stored);
}

// "deep tissue massage, Friday evening in Chamberi" - what they actually asked
// for, in their words, so the template does not read like a form letter.
//
// 12 Sept: "in their words" was taken too literally. await_day_text stores any
// text as the day, so Jasper's "Just asking they have extra services" became
// his day, and this would have sent him "Your massage is still saved with us:
// relaxing massage, Just asking they have extra services". Nothing raw reaches
// the blank now. A day, a time and an area only count if they look like one;
// anything else is dropped and the line falls back to the service on its own,
// which is a perfectly good message.
const DAY_OK = /^(today|tomorrow|tonight|hoy|ma[nñ]ana|(mon|tues|wednes|thurs|fri|satur|sun)day|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{1,2}\s+[a-zà-ÿ]{3,10}|[a-zà-ÿ]{3,10}\s+\d{1,2})$/i;
const TIME_OK = /^(\d{1,2}([:.]\d{2})?\s*(h|am|pm)?|morning|afternoon|evening|ma[nñ]ana|tarde|noche)(\s*\(\d{1,2}-\d{1,2}\))?$/i;
const AREA_OK = /^[a-zà-ÿ][a-zà-ÿ .'-]{1,23}$/i;

function summarise(d: Record<string, any>, es: boolean): string {
  const svc = SVC_LABEL[String(d.service || "")] || { en: "massage", es: "masaje" };
  const parts = [es ? svc.es : svc.en];

  // v8: a stale relative day takes its time with it ("Today 18:00" from last week).
  const stale = relativeDayStale(d);
  const day = stale ? "" : String(d.day || "").trim();
  const time = stale ? "" : String(d.time || "").trim();
  const when = [DAY_OK.test(day) ? day : "", TIME_OK.test(time) ? time : ""].filter(Boolean).join(" ");
  if (when) parts.push(when);

  const area = String(d.area || "").trim();
  const areaOk = AREA_OK.test(area) && area.split(/\s+/).length <= 3 && !/anywhere|cualquier/i.test(area);
  if (areaOk) parts.push((es ? "en " : "in ") + area);

  const out = parts.join(", ").slice(0, 180);
  // Last line of defence: if anything in there trips the lexicon, send the bare
  // service word instead.
  return EROTIC_RE.test(out) ? (es ? svc.es : svc.en) : out;
}

// v8: the same language guess as wa-bot v188 for people who never set one.
const ES_CC_RE = /^(5[1234678]|59[1358]|50[2-7]|1(809|829|849))/;
const ES_GIVEN = new Set("jose juan antonio manuel francisco javier jesus miguel alejandro rafael pedro pablo sergio fernando jorge luis alberto alvaro diego raul enrique ramon vicente ivan ruben andres joaquin santiago eduardo roberto jaime ignacio marcos alfonso guillermo gonzalo angel emilio julian salvador agustin tomas cristian mateo nicolas rodrigo felipe ricardo arturo ernesto gustavo hector cesar mariano lorenzo eugenio borja inigo inaki unai aitor jordi xavier oriol paco pepe manolo nacho chema juanan juanma quique kike txema curro fermin efrain basilio gregorio carlos maria carmen ana isabel lucia cristina marta pilar raquel rosa silvia patricia beatriz nuria rocio teresa mercedes montserrat montse sonia monica ines lorena noelia veronica belen susana alicia esther marina angela yolanda encarnacion concepcion dolores josefa amparo inmaculada angeles angelines consuelo rosario soledad remedios milagros begona ainhoa leire maite almudena macarena paloma lourdes nerea ainara conchi merche puri luisa juana manuela francisca antonia lola paqui ximena guadalupe".split(" "));
const ES_SURNAME = new Set("garcia munoz moreno romero navarro torres ruiz ortiz molina delgado castro ortega rubio morales serrano molinero iglesias medina garrido cortes castillo lozano guerrero cano prieto cruz calvo gallego vidal herrera marin pena flores cabrera campos vega fuentes carrasco diez caballero reyes nieto aguilar pascual santana herrero montero hidalgo ibanez ferrer duran mora vargas arias carmona crespo pastor soto velasco moya soler parra esteban bravo gallardo rojas manzano burgos arjona balaguer ibarra valenciano garzon lazcano llanos".split(" "));
const stripAcc = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
function spanishName(raw: unknown): boolean {
  const s = String(raw || "");
  if (/[ñÑáíóúÁÍÓÚ]/.test(s)) return true;
  const toks = stripAcc(s).toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return toks.some((t) => ES_GIVEN.has(t) || ES_SURNAME.has(t) || (t.length >= 5 && /[^aeiou]ez$/.test(t)));
}
function guessSpanish(phone: string, name: unknown): boolean {
  const d = digitsOf(phone);
  return ES_CC_RE.test(d) || (d.startsWith("34") && spanishName(name));
}

async function matchStudios(area: string, want: string) {
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_studios`, {
    method: "POST", headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_area: area || null, p_want: want || null, p_exclude: null, p_limit: 3 }),
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (!CRON_KEY || (req.headers.get("x-cron-key") || url.searchParams.get("key") || "") !== CRON_KEY) return new Response("forbidden", { status: 403 });
  const dry = url.searchParams.get("dry") === "1";
  const only = digitsOf(url.searchParams.get("phone") || "");

  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const H = { apikey: svcKey, Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json" };

  const hour = madridHour();
  if ((hour < 9 || hour >= 21) && !dry) {
    return new Response(JSON.stringify({ ok: true, skipped: "outside 09-21 Madrid" }), { headers: { "Content-Type": "application/json" } });
  }

  const now = Date.now();
  // 14 Sept: the 10:00 run returned {"sent":[],"skipped":[]} and emailed nothing,
  // because the old `.catch(() => [])` on this fetch turned a failure into a
  // silent success. An empty customer list is never normal, so it now reports.
  // The 13:07 run then named the real cause: a PostgREST 504 Gateway Timeout,
  // not a slow view. wa_customers itself runs in about 70ms, the REST gateway
  // was simply cold. So retry three times with a short backoff before giving
  // up, and only then report.
  let peopleErr = "";
  const people = await (async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_customers?select=*&order=last_inbound.desc`, { headers: H });
        if (!r.ok) {
          peopleErr = `wa_customers ${r.status} ${(await r.text()).slice(0, 120)} (attempt ${attempt} of 3)`;
        } else {
          const j = await r.json();
          if (Array.isArray(j) && j.length) { peopleErr = ""; return j; }
          peopleErr = `wa_customers returned 0 rows (attempt ${attempt} of 3)`;
        }
      } catch (e) {
        peopleErr = `wa_customers threw ${String(e).slice(0, 120)} (attempt ${attempt} of 3)`;
      }
      if (attempt < 3) await new Promise((res) => setTimeout(res, attempt * 1500));
    }
    return [];
  })();
  const sent: any[] = [];
  const skipped: any[] = [];

  for (const p of (Array.isArray(people) ? people : [])) {
    if (sent.length >= 10) break;
    const phone = digitsOf(p.phone);
    if (only && phone !== only) continue;
    if (!phone || isTestPhone(phone)) continue;
    if (p.blocked) { skipped.push({ phone, why: "blocked" }); continue; }
    if (Number(p.confirmed_bookings) > 0) { skipped.push({ phone, why: "already booked" }); continue; }
    if (!FLOW_STEPS.includes(String(p.chat_step))) { skipped.push({ phone, why: `step ${p.chat_step}` }); continue; }

    const lastIn = p.last_inbound ? Date.parse(p.last_inbound) : 0;
    const hoursQuiet = (now - lastIn) / 3600000;
    // Inside 24h the ordinary rescue nudge reaches them for free; past 30 days
    // a cold template is just spam.
    if (hoursQuiet < 24) { skipped.push({ phone, why: `only ${hoursQuiet.toFixed(1)}h quiet` }); continue; }
    if (hoursQuiet > 24 * 30) { skipped.push({ phone, why: "older than 30 days" }); continue; }

    // Once per person, ever, and funnel_events is the record that survives a
    // session reset. This query comes before the session read on purpose: a
    // person who has been recovered is done, whatever their session now says.
    const priorRes = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events?phone=eq.${phone}&event=eq.recovery_sent&select=created_at&order=created_at.desc&limit=1`, { headers: H });
    if (!priorRes.ok) { skipped.push({ phone, why: `recovery history unreadable ${priorRes.status}` }); continue; }
    const prior = await priorRes.json().catch(() => null);
    if (!Array.isArray(prior)) { skipped.push({ phone, why: "recovery history unreadable" }); continue; }
    if (prior.length) { skipped.push({ phone, why: `already recovered ${String(prior[0].created_at || "").slice(0, 10)}` }); continue; }

    const sess = await (await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?phone=eq.${phone}&select=step,data,wa_name`, { headers: H })).json().catch(() => []);
    const s0 = Array.isArray(sess) && sess[0] ? sess[0] : null;
    if (!s0) { skipped.push({ phone, why: "no session" }); continue; }
    const data = (s0.data && typeof s0.data === "object") ? s0.data : {};
    if (data.recoverySent) { skipped.push({ phone, why: "already recovered once" }); continue; }

    // Someone who asked for extras gets the standard line and silence, never a
    // marketing template inviting them back.
    const inbound = await (await fetch(`${SUPABASE_URL}/rest/v1/wa_messages?phone=eq.${phone}&direction=eq.in&select=body&order=created_at.desc&limit=40`, { headers: H })).json().catch(() => []);
    if (Array.isArray(inbound) && inbound.some((m: any) => EROTIC_RE.test(String(m.body || "")))) {
      skipped.push({ phone, why: "asked for extras" });
      continue;
    }

    const lang = String(data.lang || "").toLowerCase();
    const es = lang ? lang.startsWith("es") : guessSpanish(phone, s0.wa_name || p.name);
    const summary = summarise(data, es);

    // Do we know enough to finish the booking on one tap? Needs what and when,
    // and the when must still be in the future (v8).
    const canFinish = Boolean(data.service && data.day && data.time) && !relativeDayStale(data);
    let yesPayload = "menu_book";
    let picks: any[] = Array.isArray(data.picks) ? data.picks : [];
    if (canFinish) {
      if (!picks.length) {
        const svcRow = SVC_LABEL[String(data.service)] ? String(data.service).replace("svc_", "") : "";
        const rows = await matchStudios(String(data.area || ""), svcRow === "unsure" ? "" : svcRow);
        picks = rows.map((o: any) => ({ id: o.id, slug: o.slug, name: o.business_name, svc: o.svc, price: o.price, duration: o.duration, area: o.area }));
      }
      if (picks.length) yesPayload = "pick_yes";
    }

    if (dry) { sent.push({ phone, name: p.name, summary, es, hoursQuiet: Number(hoursQuiet.toFixed(1)), yesPayload, picks: picks.map((x: any) => x.name) }); continue; }

    const res = await fetch(GRAPH, {
      method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: phone, type: "template",
        template: {
          name: TEMPLATE, language: { code: es ? "es" : "en" },
          components: [
            { type: "body", parameters: [{ type: "text", text: summary }] },
            { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: yesPayload }] },
            { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: "rebook_later" }] },
          ],
        },
      }),
    });
    const body = await res.text();
    console.log(`[recover] ${phone} status=${res.status} payload=${yesPayload} es=${es}`);
    if (!res.ok) { skipped.push({ phone, why: `send failed ${res.status}`, detail: body.slice(0, 200) }); continue; }

    // Pre-arm the session so the tap lands somewhere sensible, and mark them so
    // this can never happen to the same person twice. The funnel_events row
    // below is the one that has to be written: it is what the next run reads.
    data.recoverySent = new Date().toISOString();
    if (!data.lang) data.lang = es ? "es" : "en";
    if (yesPayload === "pick_yes" && picks.length) data.picks = picks;
    const nextStep = yesPayload === "pick_yes" ? "await_studio" : s0.step;
    await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?phone=eq.${phone}`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ step: nextStep, data, updated_at: new Date().toISOString() }),
    });
    await fetch(`${SUPABASE_URL}/rest/v1/wa_messages`, {
      method: "POST", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ phone, direction: "out", msg_type: "template", body: es ? `[${TEMPLATE}/es] Tu masaje sigue guardado con nosotros: ${summary} [Terminar reserva/Ahora no]` : `[${TEMPLATE}] Your massage is still saved with us: ${summary} [Finish my booking/No thanks]` }),
    });
    const evRes = await fetch(`${SUPABASE_URL}/rest/v1/funnel_events`, {
      method: "POST", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ phone, event: "recovery_sent", meta: { summary, yesPayload, es, hoursQuiet: Number(hoursQuiet.toFixed(1)) } }),
    });
    if (!evRes.ok) console.log(`[recover] WARNING: funnel_events not written for ${phone}, ${evRes.status}`);
    sent.push({ phone, name: p.name, summary, hoursQuiet: Number(hoursQuiet.toFixed(1)), yesPayload });
  }

  // A run where every send fails used to be silent, because the summary only
  // went out when something succeeded. An account-level block (131042, 131049)
  // is exactly the case Jordan needs to hear about, so failures now report too,
  // and so does a run that could not read the customer list at all.
  const sendFailures = skipped.filter((x: any) => String(x.why || "").startsWith("send failed"));
  if (!dry && (sent.length || sendFailures.length || peopleErr)) {
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL, to: FOUNDER,
        subject: peopleErr
          ? `⚠️ Recovery could not read the customer list: ${peopleErr.slice(0, 60)}`
          : sendFailures.length && !sent.length
          ? `⚠️ Recovery FAILED for all ${sendFailures.length}: ${String(sendFailures[0].detail || "").slice(0, 60)}`
          : `↩️ Recovery sent to ${sent.length} unfinished booking${sent.length > 1 ? "s" : ""}`,
        text: sent.map((x) => `+${x.phone}${x.name ? " (" + x.name + ")" : ""}: ${x.summary} · quiet ${x.hoursQuiet}h · tap = ${x.yesPayload === "pick_yes" ? "books the top studio straight away" : "restarts the flow"}`).join("\n") + (sendFailures.length ? "\n\nFAILED:\n" + sendFailures.map((x: any) => `+${x.phone}: ${x.why}${x.detail ? " - " + x.detail : ""}`).join("\n") : "") + (peopleErr ? "\n\nCOULD NOT READ THE CUSTOMER LIST: " + peopleErr : "") + "\n\nOne attempt per person, ever, checked against funnel_events so a session reset cannot spend it twice. A failed send does not spend the attempt. Replies land in the normal bot flow.",
      }),
    });
  }

  return new Response(JSON.stringify({ ok: true, peopleErr: peopleErr || undefined, sent, skipped }, null, 2), { headers: { "Content-Type": "application/json" } });
}

export function start(opts: { cronKey: string; resendKey: string; waToken: string; phoneId?: string }) {
  CRON_KEY = opts.cronKey;
  RESEND_API_KEY = opts.resendKey;
  WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || opts.waToken;
  PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || opts.phoneId || PHONE_ID;
  GRAPH = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;
  Deno.serve(handleRequest);
}
