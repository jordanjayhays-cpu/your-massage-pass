// Studio photos (28 Nov 2026, wa-bot v223).
//
// What went wrong: a studio sent "Hola buenas tardes", a photo, then "Abrimos
// martes a domingo", and the bot answered the photo with STUDIO_MEDIA_LINE
// ("Gracias. Por aquí no puedo abrir fotos ni audios. Si es la hora o el
// precio, ¿me lo escribís en un mensaje?"). The photo was never read and its
// row was logged as "[tap: ]". Jordan: "never respond like this", "i thought we
// already had a way for you to read this".
//
// Each group below runs the real code from bot.ts in a sandbox, with invented
// names and numbers (the repo is public) and a mocked fetch: nothing touches
// a database, Meta, OpenRouter or the network.
//   1. inboundImage: which messages are photos we read
//   2. cleanImageRead: the model's "no text" is nothing
//   3. readImage, readable: Graph, download, wa-media, the voice fallback's model
//   4. readImage, every failure: empty text, never a throw
//   5. why a photo's reading is never the studio's reply: the real parsers
//      would take a price list's IVA for a discount, an agenda for an offer
//   6. studioMediaUnread: no word to the studio; Jordan's card (with what was
//      read) and alert, the media link whole inside the 300-character alert;
//      no alert for a sticker, one per studio in 10 minutes
//   7. the partner branch of the handler, run: a photo's reading goes only to
//      Jordan's card, never to handleStudioReply; a caption goes on as typed,
//      and the photo still reaches Jordan
//   8. the handler's wiring (source order), the media page, no STUDIO_MEDIA_LINE
//   9. ops "read_image_test": the same model call, sends nothing
//
// Run: node --experimental-strip-types tests/studio_photo.mjs
// BOT=<path> runs the same checks against another copy of bot.ts.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const botPath = process.env.BOT || path.join(root, "supabase/functions/wa-bot/bot.ts");
const botSrc = fs.readFileSync(botPath, "utf8");

let pass = 0;
const failures = [];
function check(group, input, got, want, note = "") {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else failures.push({ group, input, got, want, note });
}
const between = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i + 1); return i < 0 || j < 0 ? "" : src.slice(i, j); };
const lift = (src, head) => { const i = src.indexOf(head); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i) + 3); };
const one = (name) => (botSrc.match(new RegExp(`^const ${name} = .*$`, "m")) || [""])[0];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-photo-"));
let nmod = 0;
async function load(js) {
  const file = path.join(tmp, `m${nmod++}.mjs`);
  fs.writeFileSync(file, js);
  return import(pathToFileURL(file).href);
}
const copyUrl = pathToFileURL(path.join(root, "supabase/functions/wa-bot/copy.ts")).href;
const C = await import(copyUrl);
const dash = (t) => /[‒-―−]/.test(String(t));
const res = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (k) => headers[String(k).toLowerCase()] ?? null },
  json: async () => (typeof body === "string" ? JSON.parse(body) : body),
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  arrayBuffer: async () => (body instanceof Uint8Array ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : new ArrayBuffer(0)),
});

// ---------------------------------------------------------------------------
// The code under test: the v223 block, with the real reply link, the real
// founder alert (notifyJordanWa, its fake-number guard and the template's
// 300-character blank) and stand-ins only for the database, Meta and email.
// ---------------------------------------------------------------------------
const START = "// ---- v223 (28 Nov 2026): studio photos (start) ----";
const END = "// ---- v223: studio photos (end) ----";
const blk = between(botSrc, START, END);
check("0 setup", "the v223 block is marked in bot.ts", !!blk, true, "tests lift it between its markers");
// A bot.ts without the block (before v223) answers "MISSING" everywhere, so
// BOT=<an older bot.ts> lists every check it fails instead of stopping.
const MISSING_BLOCK = ["inboundImage", "cleanImageRead", "visionRead", "readImage", "studioHasOpenAsk", "studioMediaUnread"].map((n) => `function ${n}() { return "MISSING"; }`).join("\n")
  + `\nconst IMAGE_READ_PROMPT = "MISSING", IMAGE_READ_MAX = 0, IMAGE_MAX_BYTES = 0;\n`;
const parts = [one("REPLY_BASE"), lift(botSrc, "async function replySig("), lift(botSrc, "async function replyUrl("), one("FAKE_NUM_RE"), one("aboutFakeCustomer"), one("tp"), lift(botSrc, "async function notifyJordanWa(")];
check("0 setup", "the alert's parts are found", parts.map(Boolean), parts.map(() => true));
const B = await load(`
import { JORDAN_MAIN_NUMBER } from ${JSON.stringify(copyUrl)};
export const S = { secrets: {}, cards: [], templates: [], calls: [], studio: [], events: [], fetchImpl: async () => res(404, {}) };
const res = ${res.toString()};
const fetch = async (u, o = {}) => { S.calls.push({ u: String(u), o }); return S.fetchImpl(String(u), o); };
const SUPABASE_URL = "https://jglftdstrowwckwqmpue.supabase.co";
const H = () => ({ apikey: "service-role-test" });
const WA_TOKEN = "wa-token-test";
const OPS_KEY = "ops-key-test";
const digitsOf = (x) => String(x || "").replace(/[^0-9]/g, "");
async function appSecret(k) { return S.secrets[k] || ""; }
async function founderCard(subject, o) { S.cards.push({ subject, ...o }); }
async function sendTemplate(to, name, lang, params) { S.templates.push({ to, name, params: params.map((p) => tp(p)) }); return true; }
async function sendText(to, body) { S.studio.push({ to, body }); return true; }
async function logEvent(phone, event, meta = {}) { S.events.push({ phone, event, meta }); }
${stripTypeScriptTypes(parts.join("\n"))}
${stripTypeScriptTypes(blk || MISSING_BLOCK)}
export { inboundImage, cleanImageRead, visionRead, readImage, studioHasOpenAsk, studioMediaUnread, IMAGE_READ_PROMPT, IMAGE_READ_MAX, IMAGE_MAX_BYTES, replyUrl, replySig };
`);
const S = B.S;
const reset = () => { S.secrets = {}; S.cards.length = 0; S.templates.length = 0; S.calls.length = 0; S.studio.length = 0; S.events.length = 0; S.fetchImpl = async () => res(404, {}); };

const STUDIO = "34000111222"; // invented
const PARTNER = { id: "p-photo", business_name: "Estudio Ficticio" };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 0xff, 0xd9]);
const MENU = "Tarifas\nMasaje relajante 60 min 45€\n90 min 60€\nMartes a domingo de 11:00 a 21:00";
const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
// Meta, the download, the bucket and OpenRouter, as they answer.
function world(o = {}) {
  return async (u, opt) => {
    if (u.startsWith("https://graph.facebook.com/v21.0/")) {
      if (o.graphThrows) throw new Error("graph down");
      return res(200, o.meta || { url: "https://lookaside.invalid/media/abc", mime_type: "image/jpeg", file_size: JPEG.length, id: "MEDIA1" });
    }
    if (u === "https://lookaside.invalid/media/abc") return o.downloadStatus ? res(o.downloadStatus, "") : res(200, JPEG);
    if (u.includes("/storage/v1/object/wa-media/")) return o.uploadStatus ? res(o.uploadStatus, "nope") : res(200, { Key: "ok" });
    if (u === OPENROUTER) {
      if (o.modelThrows) throw new Error("timeout");
      return o.modelStatus ? res(o.modelStatus, { error: { message: "no credits" } }) : res(200, { choices: [{ message: { content: o.read ?? MENU } }] });
    }
    return res(404, {});
  };
}
const modelBody = () => { const c = S.calls.find((x) => x.u === OPENROUTER); try { return JSON.parse(c ? c.o.body : "{}"); } catch { return {}; } };
const hosts = () => S.calls.map((c) => c.u.startsWith("https://graph.facebook.com/") ? "graph" : c.u.startsWith("https://lookaside.invalid/") ? "download" : c.u.includes("/storage/v1/object/wa-media/") ? "wa-media" : c.u === OPENROUTER ? "openrouter" : "other:" + c.u);

// ---------------------------------------------------------------------------
// 1. Which messages are photos we read.
// ---------------------------------------------------------------------------
{
  const G = "1 inboundImage";
  check(G, "an image", B.inboundImage({ type: "image", image: { id: "M1", mime_type: "image/jpeg", caption: " Os paso las tarifas " } }), { id: "M1", mime: "image/jpeg", caption: "Os paso las tarifas" });
  check(G, "an image with no mime type or caption", B.inboundImage({ type: "image", image: { id: "M2" } }), { id: "M2", mime: "image/jpeg", caption: "" });
  check(G, "a document that is a png", B.inboundImage({ type: "document", document: { id: "D1", mime_type: "image/png", filename: "precios.png" } }), { id: "D1", mime: "image/png", caption: "" });
  check(G, "a pdf is not a photo", B.inboundImage({ type: "document", document: { id: "D2", mime_type: "application/pdf" } }), null);
  check(G, "a sticker, a voice note, a video, a text: none", ["sticker", "audio", "video", "text"].map((t) => B.inboundImage({ type: t, [t]: { id: "X" }, text: { body: "hola" } })), [null, null, null, null]);
  check(G, "an image with no id", B.inboundImage({ type: "image", image: {} }), null);
}

// ---------------------------------------------------------------------------
// 2. The model's "nothing here" is nothing.
// ---------------------------------------------------------------------------
{
  const G = "2 cleanImageRead";
  for (const t of ["", "   ", "No text", "No readable text.", "There is no readable text in this image.", "The image contains no text.", "I can't read any text in this photo.", "[no text]", "Nothing", "Nothing readable.", "None", "(empty)", "N/A", "Sin texto", "No hay texto legible.", "```\n```"]) check(G, JSON.stringify(t), B.cleanImageRead(t), "");
  check(G, "a reading that only starts like \"none\" or \"empty\" is kept", [B.cleanImageRead("None of us is free at 18:00, at 19:00 yes"), B.cleanImageRead("Empty slots: 18:00, 19:30")], ["None of us is free at 18:00, at 19:00 yes", "Empty slots: 18:00, 19:30"]);
  check(G, "a menu kept as written", B.cleanImageRead(MENU), MENU);
  check(G, "code fences dropped", B.cleanImageRead("```text\nMasaje 60 min 45€\n```"), "Masaje 60 min 45€");
  check(G, "a real answer that starts with No is kept", B.cleanImageRead("No tenemos hueco hoy, mañana a las 18:00 sí"), "No tenemos hueco hoy, mañana a las 18:00 sí");
  check(G, "capped", B.cleanImageRead("x".repeat(5000)).length, B.IMAGE_READ_MAX);
  check(G, "about 1500 characters", B.IMAGE_READ_MAX, 1500);
  check(G, "not a string", [B.cleanImageRead(null), B.cleanImageRead(undefined)], ["", ""]);
}

// ---------------------------------------------------------------------------
// 3. A readable photo: Graph id, its url, the bytes with the WhatsApp token,
// saved to wa-media like a voice note, read by the voice fallback's model.
// ---------------------------------------------------------------------------
{
  const G = "3 readImage, readable";
  reset();
  S.secrets = { OPENROUTER_API_KEY: "or-key-test" };
  S.fetchImpl = world();
  const r = await B.readImage("MEDIA1", "+" + STUDIO, "image/jpeg");
  check(G, "the text read", r.text, MENU);
  check(G, "saved under the studio's number", /^34000111222\/\d+\.jpg$/.test(String(r.path)), true, "the ?media= page only serves <digits>/<digits>.<ext>");
  check(G, "the calls, in order", hosts(), ["graph", "download", "wa-media", "openrouter"]);
  const none = { u: "", o: { headers: {}, body: "{}" } };
  const [graph = none, dl = none, up = none, model = none] = S.calls;
  check(G, "Graph and the download carry the WhatsApp token", [graph.o.headers?.Authorization, dl.o.headers?.Authorization], ["Bearer wa-token-test", "Bearer wa-token-test"]);
  check(G, "Graph is asked for this media id", graph.u, "https://graph.facebook.com/v21.0/MEDIA1");
  check(G, "the upload: POST, the image's type, upsert", [up.o.method, up.o.headers?.["Content-Type"], up.o.headers?.["x-upsert"], up.u.endsWith("/storage/v1/object/wa-media/" + r.path)], ["POST", "image/jpeg", "true", true]);
  const body = JSON.parse(model.o.body);
  const content = body.messages?.[0]?.content || [];
  check(G, "the model: the voice fallback's (Gemini Flash-Lite through OpenRouter), temperature 0", [body.model, body.temperature, model.o.headers?.Authorization, model.o.headers?.["X-Title"]], ["google/gemini-2.5-flash-lite", 0, "Bearer or-key-test", "Massage Club bot"]);
  check(G, "the prompt", [content[0]?.type, content[0]?.text], ["text", B.IMAGE_READ_PROMPT]);
  check(G, "the prompt asks for the text verbatim, in its language, the times, durations and prices, and nothing when unreadable",
    [/verbatim/.test(B.IMAGE_READ_PROMPT), /original language/.test(B.IMAGE_READ_PROMPT), /price list, a menu or a schedule/.test(B.IMAGE_READ_PROMPT), /time, duration and price/.test(B.IMAGE_READ_PROMPT), /return nothing/i.test(B.IMAGE_READ_PROMPT), /massage studio/.test(B.IMAGE_READ_PROMPT), /booking request/.test(B.IMAGE_READ_PROMPT)], [true, true, true, true, true, true, true]);
  const url = String(content[1]?.image_url?.url || "");
  check(G, "the image goes as a data url of the bytes downloaded", [content[1]?.type, url.startsWith("data:image/jpeg;base64,"), Buffer.from(url.split(",")[1] || "", "base64").equals(Buffer.from(JPEG))], ["image_url", true, true]);
  // TRANSCRIBE_MODEL_OR overrides the model for both, as it does for voice.
  reset();
  S.secrets = { OPENROUTER_API_KEY: "or-key-test", TRANSCRIBE_MODEL_OR: "some/other-model" };
  S.fetchImpl = world();
  await B.readImage("MEDIA1", STUDIO);
  check(G, "TRANSCRIBE_MODEL_OR is the model, as for voice notes", modelBody().model, "some/other-model");
  // A png document keeps its own type and extension.
  reset();
  S.secrets = { OPENROUTER_API_KEY: "or-key-test" };
  S.fetchImpl = world({ meta: { url: "https://lookaside.invalid/media/abc", mime_type: "image/png", file_size: 11 } });
  const p = await B.readImage("D1", STUDIO, "image/png");
  check(G, "a png: .png and image/png all the way", [/\.png$/.test(String(p.path)), String(modelBody().messages?.[0]?.content?.[1]?.image_url?.url || "").startsWith("data:image/png;base64,")], [true, true]);
}

// ---------------------------------------------------------------------------
// 4. Every failure is empty text, never a throw.
// ---------------------------------------------------------------------------
{
  const G = "4 readImage, failures";
  const run = async (name, secrets, o, want) => {
    reset();
    S.secrets = secrets;
    S.fetchImpl = world(o);
    let threw = false, r = null;
    try { r = await B.readImage("MEDIA1", STUDIO); } catch { threw = true; }
    check(G, name, { threw, saved: !!r?.path, text: r?.text, calls: hosts() }, { threw: false, ...want });
  };
  const KEY = { OPENROUTER_API_KEY: "or-key-test" };
  await run("the model reads nothing", KEY, { read: "No readable text." }, { saved: true, text: "", calls: ["graph", "download", "wa-media", "openrouter"] });
  await run("the model answers 402", KEY, { modelStatus: 402 }, { saved: true, text: "", calls: ["graph", "download", "wa-media", "openrouter"] });
  await run("the model times out", KEY, { modelThrows: true }, { saved: true, text: "", calls: ["graph", "download", "wa-media", "openrouter"] });
  await run("IMAGE_READ off: saved, no model call", { ...KEY, IMAGE_READ: "off" }, {}, { saved: true, text: "", calls: ["graph", "download", "wa-media"] });
  await run("IMAGE_READ OFF (any case)", { ...KEY, IMAGE_READ: "OFF" }, {}, { saved: true, text: "", calls: ["graph", "download", "wa-media"] });
  await run("no OpenRouter key: saved, no model call", {}, {}, { saved: true, text: "", calls: ["graph", "download", "wa-media"] });
  await run("the upload fails: still read", KEY, { uploadStatus: 500 }, { saved: false, text: MENU, calls: ["graph", "download", "wa-media", "openrouter"] });
  await run("Graph is down", KEY, { graphThrows: true }, { saved: false, text: "", calls: ["graph"] });
  await run("Graph has no url", KEY, { meta: { error: { code: 100 } } }, { saved: false, text: "", calls: ["graph"] });
  await run("the download fails", KEY, { downloadStatus: 404 }, { saved: false, text: "", calls: ["graph", "download"] });
  await run("a gif is not downloaded or read", KEY, { meta: { url: "https://lookaside.invalid/media/abc", mime_type: "image/gif", file_size: 10 } }, { saved: false, text: "", calls: ["graph"] });
  await run("an svg is not downloaded or read", KEY, { meta: { url: "https://lookaside.invalid/media/abc", mime_type: "image/svg+xml", file_size: 10 } }, { saved: false, text: "", calls: ["graph"] });
  await run("over 8 MB is not downloaded", KEY, { meta: { url: "https://lookaside.invalid/media/abc", mime_type: "image/jpeg", file_size: B.IMAGE_MAX_BYTES + 1 } }, { saved: false, text: "", calls: ["graph"] });
  // visionRead on its own: empty bytes or an odd type never call the model.
  reset(); S.secrets = KEY; S.fetchImpl = world();
  check(G, "visionRead: no bytes, a gif: nothing, no call", [await B.visionRead(new Uint8Array(0), "image/jpeg"), await B.visionRead(JPEG, "image/gif"), S.calls.length], ["", "", 0]);
}

// ---------------------------------------------------------------------------
// 5. Why a photo's reading is never the studio's reply (review, 28 Nov). The
// real parsers (copy.ts, parseDiscount, AUTOREPLY_RE) on what a model reads in
// ordinary studio pictures: each would have sent the customer an offer, a
// discount or a price nobody wrote for this booking, or silenced the photo.
// Group 7 shows none of these readings reaches the studio path.
// ---------------------------------------------------------------------------
const SAMPLES = {
  iva: "Tarifas\nMasaje relajante 60 min 45€\nPrecios con 21% IVA incluido",
  flyer: "-20% en tu primera visita\nMasaje 60 min 40€",
  bono: "Bono 5 sesiones 10% dto",
  twoMenu: "Masaje relajante 60 min 45€\nMasaje deportivo 60 min 55€",
  agenda: "10:00 Ana G.\n11:30 Pedro\n13:00 libre",
  hours: "HORARIO DE ATENCIÓN\nMartes a Domingo\n10:00 - 21:00",
};
{
  const G = "5 why a reading is not a reply";
  const replies = between(botSrc, "// ---- v219 studio replies: pure helpers (start) ----", "// ---- v219 studio replies: pure helpers (end) ----");
  const words = between(botSrc, "// ---- v219 (19 Nov 2026, #126): studio words: pure helpers (start)", "// ---- v219: studio words: pure helpers (end)");
  const R = await load(`import { AUTOREPLY_RE, parseQuotedPrice, parseOfferedTime } from ${JSON.stringify(copyUrl)};\n${stripTypeScriptTypes(replies + "\n" + words + "\n" + lift(botSrc, "function parseDiscount("))}\nexport { isAwayMessage, BARE_YES_RE, plainStudioAck, parseDiscount, ourQuestionOpen };\n`);
  check(G, "the parsers are found", [typeof R.parseDiscount, typeof R.isAwayMessage, typeof R.BARE_YES_RE?.test], ["function", "function", "function"]);
  check(G, "a price list's IVA, a flyer's promo and a bono read as discounts (21, 20, 10)", [R.parseDiscount(SAMPLES.iva), R.parseDiscount(SAMPLES.flyer), R.parseDiscount(SAMPLES.bono)], [21, 20, 10], "on an open ask, 10 or more is awardWinner: an offer to the customer");
  check(G, "a two-service menu reads as one quoted price", C.parseQuotedPrice(SAMPLES.twoMenu) !== null, true);
  check(G, "an agenda reads as an offered time (a taken slot)", C.parseOfferedTime(SAMPLES.agenda), "10:00");
  check(G, "an hours flyer reads as an away message", C.AUTOREPLY_RE.test(SAMPLES.hours), true, "the v55 photo-vanishes bug");
  global.__R = R;
}

// ---------------------------------------------------------------------------
// 6. Media the bot could not read: nothing to the studio; Jordan gets the
// card and a WhatsApp alert with the media link, whole.
// ---------------------------------------------------------------------------
{
  const G = "6 studioMediaUnread";
  const PATH = `${STUDIO}/1764340000000.jpg`;
  const link = `https://jglftdstrowwckwqmpue.supabase.co/functions/v1/wa-bot?media=${encodeURIComponent(PATH)}&sig=${await B.replySig(STUDIO)}`;
  reset();
  await B.studioMediaUnread(STUDIO, PARTNER, "image", PATH, true);
  check(G, "nothing to the studio", [S.studio.length, S.templates.filter((t) => t.to !== "34613977900" && t.name !== "founder_alert_v1").length], [0, 0]);
  const card = S.cards[0] || {};
  check(G, "one card: STUDIO MEDIA, a photo the bot could not read", [S.cards.length, card.badge, card.title], [1, "STUDIO MEDIA", "Estudio Ficticio sent a photo the bot could not read"]);
  check(G, "the card no longer says the bot asked them to type it", /asked them|as text|write the time/i.test(JSON.stringify(card)), false);
  check(G, "the card says nothing was said back, and why it matters", [/Nothing was said back to them/.test((card.paras || []).join(" ")), /open request from us, so it may be their answer/.test((card.paras || []).join(" "))], [true, true]);
  check(G, "the card's button opens the photo", (card.links || []).map((l) => [l.label, l.href]), [["Open the photo", link]]);
  const alert = S.templates.find((t) => t.name === "founder_alert_v1");
  const param = alert ? alert.params[0] : "";
  check(G, "one WhatsApp alert to Jordan (founder_alert_v1)", [S.templates.length, alert?.to], [1, C.JORDAN_MAIN_NUMBER.replace(/[^0-9]/g, "")]);
  check(G, "it names the studio and carries the media link whole", [param.includes("Estudio Ficticio"), param.includes(link), param.includes("Reply as the bot: " + await B.replyUrl(STUDIO))], [true, true, true], "the blank is 300 characters and ends in the reply link");
  check(G, "it says no reply went", /photo not read, no reply sent/.test(param), true);
  check(G, "under the template's 300 characters", param.length <= 300, true);
  // A long studio name gives way, never the link.
  reset();
  await B.studioMediaUnread(STUDIO, { id: "p2", business_name: "Centro de Masajes Tradicionales y Terapias Orientales Ficticio" }, "audio", `${STUDIO}/1764340000001.ogg`, false);
  const p2 = (S.templates[0] || { params: [""] }).params[0];
  const l2 = `https://jglftdstrowwckwqmpue.supabase.co/functions/v1/wa-bot?media=${encodeURIComponent(STUDIO + "/1764340000001.ogg")}&sig=${await B.replySig(STUDIO)}`;
  check(G, "a long name is shortened; the link and the reply link stay whole", [p2.includes(l2), p2.includes("Reply as the bot: "), /^Centro de Masajes/.test(p2), p2.includes("…: voice note not read, no reply sent."), p2.length <= 300], [true, true, true, true, true]);
  check(G, "a voice note: the card says voice note", [S.cards[0]?.title, /no open request from us/.test((S.cards[0]?.paras || []).join(" "))], ["Centro de Masajes Tradicionales y Terapias Orientales Ficticio sent a voice note the bot could not read", true]);
  // Nothing saved (a video): no link, the chat instead.
  reset();
  await B.studioMediaUnread(STUDIO, PARTNER, "video", null, false);
  const p3 = (S.templates[0] || { params: [""] }).params[0];
  check(G, "a video: no link, open the chat", [S.studio.length, /wa-bot\?media=/.test(p3), /Estudio Ficticio: video not read, no reply sent\. Open the chat on WhatsApp to see it\./.test(p3), (S.cards[0]?.links || []).length, /open the chat on WhatsApp/.test((S.cards[0]?.paras || []).join(" "))], [0, false, true, 0, true]);
  // A sticker: the card, no page to Jordan's phone (review, 28 Nov).
  reset();
  await B.studioMediaUnread(STUDIO, PARTNER, "sticker", null, false);
  check(G, "a sticker: the card only, no WhatsApp alert", [S.studio.length, S.cards.length, S.templates.length], [0, 1, 0]);
  // A photo the bot read: the card shows the reading and says nothing was
  // acted on; the alert carries the link.
  reset();
  await B.studioMediaUnread(STUDIO, PARTNER, "image", PATH, true, SAMPLES.iva);
  const rc = S.cards[0] || {};
  const rp = (S.templates[0] || { params: [""] }).params[0];
  check(G, "a read photo: one STUDIO PHOTO card quoting what was read, with the photo", [S.cards.length, rc.badge, rc.quote, (rc.links || []).map((l) => l.href)], [1, "STUDIO PHOTO", SAMPLES.iva, [link]]);
  check(G, "a read photo: the card says nothing in it was acted on and nothing was said back", [/Nothing read in the photo was acted on/.test((rc.paras || []).join(" ")), /no time, price or discount from it goes to a customer/.test((rc.paras || []).join(" ")), /Nothing was said back to them/.test((rc.paras || []).join(" "))], [true, true, true]);
  check(G, "a read photo: nothing to the studio; one alert with the link, under 300", [S.studio.length, S.templates.length, rp.includes(link), /^Estudio Fic.*: photo read, no action, no reply\. /.test(rp), rp.length <= 300], [0, 1, true, true, true]);
  // A photo with a caption: the card quotes the caption, and does not claim
  // nothing was said back (the caption went on as a typed reply).
  reset();
  await B.studioMediaUnread(STUDIO, PARTNER, "image", PATH, true, "", "Os paso las tarifas");
  const cc = S.cards[0] || {};
  const cp = (S.templates[0] || { params: [""] }).params[0];
  check(G, "an unread photo with a caption: STUDIO MEDIA card naming the caption, alert with the link", [cc.badge, /Their caption was handled as a typed message: "Os paso las tarifas"/.test((cc.paras || []).join(" ")), /Nothing was said back/.test((cc.paras || []).join(" ")), S.templates.length, cp.includes(link), /photo not read\./.test(cp), /no reply sent/.test(cp)], ["STUDIO MEDIA", true, false, 1, true, true, false]);
  // One alert per studio in 10 minutes: a second photo gets its card only.
  reset();
  S.fetchImpl = async (u) => u.includes("/funnel_events?") ? res(200, [{ id: 1 }]) : res(404, {});
  await B.studioMediaUnread(STUDIO, PARTNER, "image", PATH, true, SAMPLES.iva);
  const asked = S.calls.find((c) => c.u.includes("/funnel_events?"))?.u || "";
  check(G, "alerted in the last 10 minutes: card yes, alert no", [S.cards.length, S.templates.length, /phone=eq\.34000111222&event=eq\.studio_media_alert&created_at=gte\./.test(asked)], [1, 0, true]);
  reset();
  await B.studioMediaUnread(STUDIO, PARTNER, "image", PATH, true, SAMPLES.iva);
  check(G, "the alert is recorded for the 10 minute check", S.events.map((e) => [e.phone, e.event]), [[STUDIO, "studio_media_alert"]]);
  reset();
  S.fetchImpl = async (u) => { if (u.includes("/funnel_events?")) throw new Error("db down"); return res(404, {}); };
  await B.studioMediaUnread(STUDIO, PARTNER, "image", PATH, true, SAMPLES.iva);
  check(G, "a check that fails lets the alert through", S.templates.length, 1);
  // A fake test number never pages Jordan (notifyJordanWa's own guard).
  reset();
  await B.studioMediaUnread("34600000123", PARTNER, "image", "34600000123/1.jpg", true);
  check(G, "a fake 34600000xxx number: no alert", S.templates.length, 0);
  check(G, "no em dash in anything Jordan reads", dash(blk.match(/`[^`]*`|"[^"]*"/g)?.join(" ")), false);
}

// ---------------------------------------------------------------------------
// 7. The partner branch of the handler, lifted and run.
// ---------------------------------------------------------------------------
const branchStart = botSrc.indexOf("    // Anything at all from a known studio number is a studio talking to us,");
const branchEnd = botSrc.indexOf("    const s = await getSession(from);", branchStart);
const branch = branchStart > 0 && branchEnd > branchStart ? botSrc.slice(branchStart, branchEnd) : "";
{
  const G = "7 the partner branch";
  check(G, "found", !!branch, true);
  const R = global.__R;
  const runBranch = async (o) => {
    const log = { studio: [], replies: [], unread: [], cards: [], away: [], ocupado: [] };
    reset();
    const env = {
      msg: o.msg, from: STUDIO, text: o.text, priorLastAt: Date.now() - 20 * 60e3, photo: o.photo || null, voice: o.voice || null,
      SUPABASE_URL: "https://db.invalid", H: () => ({}), digitsOf: (x) => String(x || "").replace(/[^0-9]/g, ""),
      fetch: async (u) => {
        u = String(u);
        if (u.includes("/wa_messages?")) return res(200, [{ msg_type: "template", body: "[solicitud_reserva_v7/es] ¿Tenéis hueco?", created_at: new Date(Date.now() - (o.lastOutAgo ?? 20 * 60e3)).toISOString() }]);
        if (u.includes("/request_dispatch?")) return res(200, o.openAsk === false ? [] : [{ id: "row-1" }]);
        return res(200, []);
      },
      findPartnerByNumber: async () => PARTNER,
      AUTOREPLY_RE: C.AUTOREPLY_RE, EMAIL_IN_TEXT_RE: C.EMAIL_IN_TEXT_RE,
      isAwayMessage: R.isAwayMessage, BARE_YES_RE: R.BARE_YES_RE, parseDiscount: R.parseDiscount, ourQuestionOpen: R.ourQuestionOpen,
      ocupadoQuestionOpen: async () => false, studioOcupado: async (f, t) => { log.ocupado.push(t); return false; }, ocupadoAwayCard: async (f, t) => { log.away.push(t); },
      studioHasOpenAsk: async () => o.openAsk !== false,
      bareYesAsk: async () => o.bareYes || null,
      handleStudioReply: async (...a) => { log.replies.push(a); },
      founderCard: async (s, c) => { log.cards.push(c.badge); },
      sendText: async (to, body) => { log.studio.push(body); return true; },
      studioSay: async (to, body) => { log.studio.push(body); return true; },
      MEDIA_TYPES: ["image", "sticker", "audio", "video", "document", "contacts", "unsupported", "order"],
      studioMediaUnread: async (...a) => { log.unread.push(a); await B.studioMediaUnread(...a); },
      quietThisTurn: false,
      console: { log: () => {} },
      // What the branch used before v223, so an older bot.ts runs too and
      // shows what it did (the photo line to the studio).
      sentRecently: async () => false, STUDIO_MEDIA_LINE: "STUDIO_MEDIA_LINE",
    };
    let out;
    try {
      const code = stripTypeScriptTypes(`async function __branch() {\n${branch}\nreturn "fell through";\n}`);
      const fn = new Function("env", `with (env) { ${code}\n return __branch(); }`);
      out = await fn(env);
    } catch (e) { out = "threw: " + String(e).slice(0, 120); }
    return { ...log, quiet: env.quietThisTurn, returned: out instanceof Response ? out.status : out, alerts: S.templates.map((t) => t.params[0]), cardsB: S.cards.map((c) => c.badge) };
  };
  const PATH = `${STUDIO}/1764340000000.jpg`;
  // The handler sets text to the caption alone (group 8); these runs give the
  // branch exactly that.
  // (a) a readable photo with no caption: its reading goes to Jordan's card,
  // never to the studio path (no offer, price, discount, ocupado or away guess)
  const a = await runBranch({ msg: { type: "image", image: { id: "M1" } }, text: "", photo: { path: PATH, text: MENU, caption: "" } });
  check(G, "readable photo: not handled as a reply (no handleStudioReply, no ocupado)", [a.replies, a.ocupado], [[], []]);
  check(G, "readable photo: one STUDIO PHOTO card quoting the reading, one alert with the link", [a.unread.map((x) => [x[2], x[3], x[4], x[5]]), a.cardsB, a.alerts.length, /wa-bot\?media=34000111222%2F1764340000000\.jpg&sig=/.test(a.alerts[0] || "")], [[["image", PATH, true, MENU]], ["STUDIO PHOTO"], 1, true]);
  check(G, "readable photo: nothing said to the studio, quiet turn (no holding line)", [a.studio, a.quiet, a.returned], [[], true, 200]);
  // (b) the readings that the real parsers would have acted on (group 5), on
  // an open ask: none reaches handleStudioReply, so no awardWinner, no
  // forwardOffer, no quoted_price, no partners.mc_discount_pct write
  for (const [k, read] of Object.entries(SAMPLES)) {
    const r = await runBranch({ msg: { type: "image", image: { id: "M1" } }, text: "", photo: { path: PATH, text: read, caption: "" } });
    check(G, `photo reading "${k}": no reply path, no away drop; Jordan's card with the reading`, [r.replies.length, r.ocupado.length, r.away.length, r.studio, r.cardsB, r.unread[0]?.[5]], [0, 0, 0, [], ["STUDIO PHOTO"], read]);
  }
  const doc = await runBranch({ msg: { type: "document", document: { id: "D1", mime_type: "image/png" } }, text: "", photo: { path: `${STUDIO}/1764340000003.png`, text: SAMPLES.iva, caption: "" } });
  check(G, "a photo sent as a document: the same (a photo card, not a file)", [doc.replies.length, doc.unread.map((x) => x[2]), doc.cardsB], [0, ["image"], ["STUDIO PHOTO"]]);
  // (c) a caption is the studio's own words: it goes on as typed, alone
  const typed = await runBranch({ msg: { type: "text" }, text: "Sí", bareYes: "9126" });
  check(G, "typed Sí: the yes tap", typed.replies[0]?.[1], "studio_confirm_9126");
  const cap = await runBranch({ msg: { type: "image", image: { id: "M1", caption: "Os paso las tarifas" } }, text: "Os paso las tarifas", photo: { path: PATH, text: SAMPLES.iva, caption: "Os paso las tarifas" } });
  check(G, "captioned photo: handleStudioReply gets the caption only, never the reading", cap.replies, [[STUDIO, "", "", "Os paso las tarifas", PARTNER]]);
  check(G, "captioned photo: Jordan still gets the photo card with the reading and the caption", [cap.unread.map((x) => [x[2], x[3], x[5], x[6]]), cap.cardsB.includes("STUDIO PHOTO"), cap.alerts.length], [[["image", PATH, SAMPLES.iva, "Os paso las tarifas"]], true, 1]);
  // (d) review, 28 Nov: a captioned photo whose reading failed (IMAGE_READ off,
  // no key, the model down, a gif) used to reach no card at all
  const capUnread = await runBranch({ msg: { type: "image", image: { id: "M1", caption: "Os paso las tarifas" } }, text: "Os paso las tarifas", photo: { path: PATH, text: "", caption: "Os paso las tarifas" } });
  check(G, "captioned unread photo: the caption goes on; one STUDIO MEDIA card and one alert with the link", [capUnread.replies.map((x) => x[3]), capUnread.cardsB.filter((b) => b === "STUDIO MEDIA").length, capUnread.alerts.length, /wa-bot\?media=34000111222%2F1764340000000\.jpg&sig=/.test(capUnread.alerts[0] || "")], [["Os paso las tarifas"], 1, 1, true]);
  // (e) a caption in away-message wording is dropped as typed; the photo is not
  const capAway = await runBranch({ msg: { type: "image", image: { id: "M1", caption: "Gracias por contactar, te responderemos lo antes posible" } }, text: "Gracias por contactar, te responderemos lo antes posible", lastOutAgo: 10_000, photo: { path: PATH, text: SAMPLES.hours, caption: "Gracias por contactar, te responderemos lo antes posible" } });
  check(G, "away-message caption: dropped as typed, the photo still reaches Jordan", [capAway.replies.length, capAway.quiet, capAway.cardsB.includes("STUDIO PHOTO"), capAway.alerts.length], [0, true, true, 1]);
  // (f) an unreadable photo: no studio message, Jordan alerted with the link
  const c = await runBranch({ msg: { type: "image", image: { id: "M1" } }, text: "", photo: { path: PATH, text: "", caption: "" } });
  check(G, "unreadable photo: no message to the studio", c.studio, [], "it used to get STUDIO_MEDIA_LINE");
  check(G, "unreadable photo: quiet turn (no holding line either)", c.quiet, true);
  check(G, "unreadable photo: studioMediaUnread with the saved path and the open ask", c.unread.map((x) => [x[0], x[1].business_name, x[2], x[3], x[4]]), [[STUDIO, "Estudio Ficticio", "image", PATH, true]]);
  check(G, "unreadable photo: Jordan's card and WhatsApp alert with the link", [c.cardsB, c.alerts.length, /wa-bot\?media=34000111222%2F1764340000000\.jpg&sig=/.test(c.alerts[0] || "")], [["STUDIO MEDIA"], 1, true]);
  check(G, "unreadable photo: not read as a reply", c.replies, []);
  // (g) an untranscribed voice note and a sticker
  const d = await runBranch({ msg: { type: "audio", audio: { id: "A1" } }, text: "", voice: { path: `${STUDIO}/1764340000002.ogg`, transcript: "" } });
  check(G, "untranscribed voice note: no studio message, alert with the recording", [d.studio, d.unread.map((x) => [x[2], x[3]]), /\.ogg&sig=/.test(d.alerts[0] || "")], [[], [["audio", `${STUDIO}/1764340000002.ogg`]], true]);
  const e = await runBranch({ msg: { type: "sticker", sticker: { id: "S1" } }, text: "", openAsk: true });
  check(G, "sticker: no studio message, no open-ask claim, the card but no phone alert", [e.studio, e.unread.map((x) => [x[2], x[3], x[4]]), e.cardsB, e.alerts.length], [[], [["sticker", null, false]], ["STUDIO MEDIA"], 0]);
  // (h) a typed reply is untouched
  const f = await runBranch({ msg: { type: "text" }, text: "Podemos a las 18:00, 45€" });
  check(G, "a typed reply goes on as before", [f.replies.map((x) => x[3]), f.studio, f.unread.length], [["Podemos a las 18:00, 45€"], [], 0]);
}

// ---------------------------------------------------------------------------
// 8. The handler's wiring, by source order (the handler itself is not lifted).
// ---------------------------------------------------------------------------
{
  const G = "8 wiring";
  const code = botSrc.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const at = (needle) => code.indexOf(needle);
  check(G, "STUDIO_MEDIA_LINE is gone (no const, no send)", [/const STUDIO_MEDIA_LINE\b/.test(code), /STUDIO_MEDIA_LINE/.test(code)], [false, false], "Jordan, 28 Nov: never respond like this");
  check(G, "no studio send anywhere says it cannot open photos", /no puedo abrir fotos/i.test(code), false);
  const readLine = (code.match(/^.*\breadImage\(img\.id.*$/m) || [""])[0];
  check(G, "readImage is called once, only for a partner's number", [(code.match(/\breadImage\(/g) || []).length, /const img = inboundImage\(msg\);/.test(code), /if \(img && await findPartnerByNumber\(digitsOf\(from\)\)/.test(readLine)], [2, true, true], "a customer's photo never reaches a model");
  const voiceAt = at("voice = await handleVoice(String(msg.audio.id), from);");
  const imgAt = at("const img = inboundImage(msg);");
  const logAt = at('await logMsg(from, "in", (voice ?');
  const lettersAt = at("if (text && !replyId && await handleLetterReply(from, text)");
  const assignAt = at("if (photo && !text) text = photo.caption;");
  const partnerAt = at("const partner = await findPartnerByNumber(digitsOf(from));\n      if (partner) {");
  check(G, "read next to the voice note, before the log row", [voiceAt > 0, imgAt > voiceAt, logAt > imgAt], [true, true, true]);
  check(G, "the caption (alone) becomes text after the letters check and before the studio branch", [lettersAt > logAt, assignAt > lettersAt, partnerAt > assignAt], [true, true, true]);
  // Review, 28 Nov: what the model read is never the studio's words. It is
  // used in three places only: the log row and the two photo cards.
  const readUses = code.split("\n").filter((l) => /\bphoto\??\.text\b/.test(l));
  check(G, "the reading is used only by the log row and studioMediaUnread", [readUses.length, readUses.every((l) => /await logMsg\(from, "in"|await studioMediaUnread\(/.test(l))], [3, true], "never text, freeText or a parser");
  check(G, "photoText (the reading as the studio's reply) is gone", /\bphotoText\b/.test(code), false);
  const logLine = (code.match(/^.*await logMsg\(from, "in", \(voice \?.*$/m) || [""])[0];
  check(G, "the log row: [photo <path>] <caption> <read text>", /\(photo \? `\[photo\$\{photo\.path \? " " \+ photo\.path : ""\}\]\$\{\[photo\.caption, photo\.text\]\.filter\(Boolean\)/.test(logLine), true, "it was \"[tap: ]\"");
  check(G, "the media branch calls studioMediaUnread with the saved path and the reading", /await studioMediaUnread\(from, partner, photo \? "image" : String\(msg\.type\), photo\?\.path \|\| voice\?\.path \|\| null, asked, photo\?\.text \|\| ""\);/.test(branch), true);
  check(G, "a captioned photo reaches Jordan after its caption is handled", /if \(photo && text\) await studioMediaUnread\(from, partner, "image", photo\.path, await studioHasOpenAsk\(from\), photo\.text, photo\.caption\);\n\s*return new Response\("OK", \{ status: 200 \}\);/.test(branch), true);
  // The inbox list and the fallback alert (review, 28 Nov).
  const tidy = between(botSrc, "  const tidy = (b: string) => {", "  const card = async (i: Item) => {");
  const tidyFn = tidy ? new Function(`${stripTypeScriptTypes(tidy.replace(/prettyLogged\(t\)/g, "t"))}\nreturn tidy;`)() : () => "MISSING";
  check(G, "the inbox list shows a photo row without its storage path", [tidyFn("[photo 34000111222/1764340000000.jpg] Os paso las tarifas Tarifas 45€"), tidyFn("[photo]"), tidyFn("[photo 34000111222/1764340000000.jpg]")], ["📷 Os paso las tarifas Tarifas 45€", "📷 Photo", "📷 Photo"]);
  const fbAt = code.indexOf("const isReaction = m?.type === \"reaction\";");
  const fbHead = fbAt > 0 ? code.slice(Math.max(0, fbAt - 400), fbAt) : "";
  check(G, "the fallback alert's \"said\" names a photo and its caption, not \"They said: \"", [/const pic = inboundImage\(m\);/.test(fbHead), /const said = String\(m\?\.text\?\.body \|\| m\?\.button\?\.text \|\| \(pic \? `\[photo\]\$\{pic\.caption \? " " \+ pic\.caption : ""\}` : ""\)\);/.test(fbHead)], [true, true]);
  const mediaBranch = between(branch, "else if (MEDIA_TYPES.includes(String(msg.type))) {", "else console.log(");
  check(G, "the media branch says nothing to the studio", [!!mediaBranch, /sendText|studioSay|sendTemplate|tellStudio|studioAviso/.test(mediaBranch)], [true, false]);
  const unread = lift(botSrc, "async function studioMediaUnread(");
  check(G, "studioMediaUnread says nothing to the studio", [!!unread, /sendText|studioSay|sendTemplate|tellStudio|studioAviso/.test(unread)], [true, false]);
  const media = between(botSrc, 'if (url.searchParams.has("media")) {', "if (url.searchParams.has(\"reply\")) {");
  check(G, "the signed ?media= page serves jpg, png and webp (never svg)", [/\|jpg\|png\|webp\)\$\//.test(media), /svg/.test(media.replace(/\/\/.*$/gm, ""))], [true, false]);
  check(G, "the reply page shows a photo row with the image", /\^\\\[photo\(\?: \(\[0-9\]\+\\\/\[0-9\]\+\\\.\(\?:jpg\|png\|webp\)\)\)\?\\\]/.test(botSrc) && /<img src="\$\{src\}"/.test(botSrc), true);
  check(G, "a version note", /\/\/ v223 \(28 Nov\): /.test(botSrc), true);
  check(G, "customers' photos keep their own line (MEDIA_LINE, unchanged)", /if \(MEDIA_TYPES\.includes\(String\(msg\.type\)\) && !text && !replyId && s\.step !== "start"\) \{/.test(code) && /await sendText\(from, MEDIA_LINE\[L\]\);/.test(code), true);
}

// ---------------------------------------------------------------------------
// 9. ops "read_image_test": the same model call on a public image, nothing sent.
// ---------------------------------------------------------------------------
{
  const G = "9 ops read_image_test";
  const opStart = botSrc.indexOf('    if (payload?.ops === "read_image_test") {');
  const op = opStart > 0 ? botSrc.slice(opStart, botSrc.indexOf("\n    }\n", opStart) + 6) : "";
  check(G, "found", !!op, true);
  check(G, "the same key check as ops tpl (and never with no key set)", /if \(!OPS_KEY \|\| String\(payload\.key \|\| ""\) !== OPS_KEY\) return new Response\("forbidden", \{ status: 403 \}\);/.test(op), true);
  check(G, "it sends, logs and saves nothing", /sendText|sendTemplate|studioSay|notifyJordanWa|founderCard|logMsg|logEvent|storage\/v1|readImage\(/.test(op), false);
  const runOp = async (payload, o = {}) => {
    reset();
    S.secrets = { OPENROUTER_API_KEY: "or-key-test" };
    S.fetchImpl = world({ read: o.read });
    const fetched = [];
    const env = {
      payload, OPS_KEY: "ops-key-test", IMAGE_MIMES: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }, IMAGE_MAX_BYTES: B.IMAGE_MAX_BYTES,
      visionRead: B.visionRead,
      fetch: async (u) => { fetched.push(String(u)); return o.imageStatus ? res(o.imageStatus, "") : res(200, JPEG, { "content-type": o.type || "image/jpeg" }); },
    };
    const fn = new Function("env", `with (env) { ${stripTypeScriptTypes(`async function __op() {\n${op}\nreturn "fell through";\n}`)}\n return __op(); }`);
    const r = await fn(env);
    const body = r instanceof Response ? await r.text() : r;
    let json = null; try { json = JSON.parse(body); } catch { /* forbidden */ }
    return { status: r instanceof Response ? r.status : 0, json, body, fetched, model: S.calls.filter((c) => c.u === OPENROUTER).length, other: S.calls.filter((c) => c.u !== OPENROUTER).length };
  };
  const bad = await runOp({ ops: "read_image_test", key: "wrong", url: "https://example.invalid/menu.jpg" });
  check(G, "a wrong key: 403, nothing fetched", [bad.status, bad.fetched.length, bad.model], [403, 0, 0]);
  const ok = await runOp({ ops: "read_image_test", key: "ops-key-test", url: "https://example.invalid/menu.jpg" }, { read: "Masaje 60 min 45€" });
  check(G, "a public jpeg: { ok, text } from the model", [ok.status, ok.json], [200, { ok: true, text: "Masaje 60 min 45€" }]);
  check(G, "one fetch of the image, one model call, nothing else", [ok.fetched, ok.model, ok.other], [["https://example.invalid/menu.jpg"], 1, 0]);
  const none = await runOp({ ops: "read_image_test", key: "ops-key-test", url: "https://example.invalid/blank.jpg" }, { read: "No text" });
  check(G, "nothing readable: ok false, empty text", [none.json?.ok, none.json?.text], [false, ""]);
  const html = await runOp({ ops: "read_image_test", key: "ops-key-test", url: "https://example.invalid/page" }, { type: "text/html" });
  check(G, "not an image: ok false, no model call", [html.json?.ok, html.model], [false, 0]);
  const nourl = await runOp({ ops: "read_image_test", key: "ops-key-test" });
  check(G, "no url: ok false, nothing fetched", [nourl.json?.ok, nourl.fetched.length], [false, 0]);
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL [${f.group}] ${f.input}\n  got:  ${JSON.stringify(f.got)}\n  want: ${JSON.stringify(f.want)}${f.note ? "\n  note: " + f.note : ""}`);
  console.log(`\nstudio photo: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`studio photo: all ${pass} pass`);
