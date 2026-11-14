// Checks for the v214.2 live snapshot (14 Nov 2026, F3 from the ads review).
//
// The deployed wa-bot loader pins a snapshot file, not bot.ts. bot_v214_2.ts is
// bot_v214_1.ts (live v214 plus the cancel fix) plus the F3 patch only, and it
// imports agent_core_v214.ts (agent_core.ts frozen at de7932f) instead of
// agent_core.ts, so later changes there stay out of it. tests/replay.mjs reads
// bot.ts by a fixed path; this runs the key F3 checks against the snapshot and
// proves the snapshot differs from bot_v214_1.ts by that patch and the import.
//
// Run: node --experimental-strip-types tests/snapshot_f3_check.mjs
// Delete it with bot_v214_2.ts when bot.ts itself is next deployed.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const fn = (f) => path.join(root, "supabase/functions/wa-bot", f);
const read = (f) => fs.readFileSync(fn(f), "utf8");
const snap = read("bot_v214_2.ts");
const live = read("bot_v214_1.ts");
const bot = read("bot.ts");

let pass = 0;
const failures = [];
function check(group, input, got, want, note = "") {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else failures.push({ group, input, got, want, note });
}
const between = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i + 1); return i < 0 || j < 0 ? "" : src.slice(i, j); };
const lift = (src, head) => { const i = src.indexOf(head); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i) + 3); };

// ---------------------------------------------------------------------------
// 1. bot_v214_2.ts = bot_v214_1.ts + the F3 patch + the agent_core import.
// A line diff (Myers), grouped into hunks of changed lines.
// ---------------------------------------------------------------------------
function diffLines(a, b) {
  const n = a.length, m = b.length, max = n + m, off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = [];
  let dEnd = -1;
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) { dEnd = d; break outer; }
    }
  }
  const ops = [];
  let x = n, y = m;
  for (let d = dEnd; d >= 0; d--) {
    const vv = trace[d];
    const k = x - y;
    const prevK = (k === -d || (k !== d && vv[off + k - 1] < vv[off + k + 1])) ? k + 1 : k - 1;
    const prevX = vv[off + prevK], prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.push(["=", a[x - 1]]); x--; y--; }
    if (d > 0) { if (x === prevX) ops.push(["+", b[prevY]]); else ops.push(["-", a[prevX]]); }
    x = prevX; y = prevY;
  }
  ops.reverse();
  const hunks = [];
  let cur = null;
  for (const [op, line] of ops) {
    if (op === "=") { cur = null; continue; }
    if (!cur) { cur = { removed: [], added: [] }; hunks.push(cur); }
    (op === "+" ? cur.added : cur.removed).push(line);
  }
  return hunks;
}
const hunks = diffLines(live.split("\n"), snap.split("\n"));
// --show prints the hunks for a reviewer.
if (process.argv.includes("--show")) hunks.forEach((h, i) => console.log(`--- hunk ${i}\n${[...h.removed.map((l) => "- " + l), ...h.added.map((l) => "+ " + l)].join("\n")}`));
const added = hunks.reduce((t, h) => t + h.added.length, 0);
const removed = hunks.reduce((t, h) => t + h.removed.length, 0);
const G1 = "snapshot = v214.1 + F3";
check(G1, "hunks, lines added, lines removed", [hunks.length, added, removed], [27, 360, 41], "anything else in the snapshot changes these; --show prints them");
const [head, imp, ...f3] = hunks;
check(G1, "first hunk: the dated header", [head?.removed.length, head?.added.length, /^\/\/ wa-bot v214\.2 deploy snapshot \(14 Nov 2026\)/.test(head?.added[0] || "")], [0, 6, true], "");
const importLine = (to) => `import { runCoreTurn, coreTakes, parseCoreMode, validateDetails, madridCalendar, DAY_CLEARS, CORE_MODEL, type CoreCtx, type CoreMode, type CoreBooking, type StudioPick } from "./${to}";`;
check(G1, "second hunk: only the agent_core import", [imp?.removed, imp?.added], [[importLine("agent_core.ts")], [importLine("agent_core_v214.ts")]], "");
// reAskAt: the inline v200 checks the patch removes in favour of reAskOnce.
const F3_MARK = /v214\.2|reAskOnce|reAskNow|reAskHeld|reAskAt|f3Answer|f3q|todayQ|sameDay|LANGQ_RE|LANGQ_CUE_RE|langQ|langAsk|ENGLISH_ASK_RE|LANG_ANSWER|shortAsk|bareAreaAsk|AREA_ASK_WORD_RE|AREA_NEAR_RE|AREA_TAIL_RE|softAckHow|nameWithLang|lang0|placeAsk|areaAskWords|onlyAreaWords|AREA_TAG_RE|AREA_FILLER_RE|NOT_A_NAME_RE|nightLineAt|rebookLater|SOFT_ACK_RE\.test\(text\)|SAMEDAY_|INFO_ASK_RE|WHERE_ASK_RE|TYPES_ASK_RE|REASK_GAP_MS|askAgain|reasked|mustAsk|how = "answer"|madrid_now/;
f3.forEach((h, i) => {
  const text = [...h.removed, ...h.added].join("\n");
  check(G1, `F3 hunk ${i + 1}: an F3 change`, F3_MARK.test(text), true, text.slice(0, 120));
  check(G1, `F3 hunk ${i + 1}: the same lines are in bot.ts`, !h.added.length || bot.includes(h.added.join("\n")), true, "bot.ts carries the identical patch");
});
// The whole patch is there, not part of it: every F3 name is used as often in
// the snapshot as in bot.ts.
for (const name of ["reAskOnce(", "reAskNow(", "reAskHeld(", "f3Answer(", "sameDayReply(", "sameDayFor(", "sameDayLine(", "shortAsk(", "bareAreaAsk(", "AREA_ASK_WORD_RE", "AREA_NEAR_RE", "AREA_TAIL_RE", "softAckHow(", "nameWithLang(", "lang0", "area_question_mark", "placeAsk(", "areaAskWords(", "onlyAreaWords(", "AREA_TAG_RE", "AREA_FILLER_RE", "NOT_A_NAME_RE", "nightLineAt", "nightAt", "NIGHT_OK_RE", "night_line_ack", "rebookLater", "Review round 3", "LANGQ_RE", "langQ(", "langAsk", "ENGLISH_ASK_RE", "SAMEDAY_STEPS", "todayQ", "f3q", "askAgain", "reasked", "mustAsk", "madrid_now: madridNowLabel()", "\"bare\"", "\"ack\""]) {
  const count = (src) => src.split(name).length - 1;
  check(G1, `uses of ${name}`, count(snap), count(bot), "same as bot.ts");
}
const block = (src) => between(src, "// ---- v214.2 questions first: pure helpers (start) ----", "// ---- v214.2 questions first: pure helpers (end) ----");
check(G1, "pure helpers byte-identical to bot.ts", !!block(snap) && block(snap) === block(bot), true, "");

// Imports and pins.
const imports = [...snap.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1].replace(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\//, "raw:"));
check(G1, "imports", imports, ["raw:6715b8a/supabase/functions/wa-bot/copy.ts", "./read.ts", "./agent_core_v214.ts"], "copy.ts stays pinned; agent_core frozen; read.ts unchanged since de7932f");
const git = (...args) => { try { return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 }); } catch { return null; } };
const frozen = git("show", "de7932f:supabase/functions/wa-bot/agent_core.ts");
if (frozen === null) console.log("(git not available: agent_core_v214.ts and read.ts were not compared with de7932f)");
else {
  check(G1, "agent_core_v214.ts is agent_core.ts at de7932f", read("agent_core_v214.ts") === frozen, true, "");
  check(G1, "read.ts unchanged since de7932f", read("read.ts") === git("show", "de7932f:supabase/functions/wa-bot/read.ts"), true, "a change there would need freezing too");
}

// ---------------------------------------------------------------------------
// 2. The key F3 checks, run against the snapshot (tests/replay.mjs runs them,
// and more, against bot.ts).
// ---------------------------------------------------------------------------
const G2 = "v214.2 snapshot: questions first";
const at = (s) => snap.indexOf(s);
const iJob = at("if (jobKind && (jobKind === \"explicit\" || s.step !== \"await_offer\")) {");
const iNoThanks = at("if (text && !replyId && NOTHANKS_RE.test(text.trim()) && DECLINE_STEPS.includes(s.step)) {");
const iObj = at("if (text && !replyId && !stepAnswer && isPriceObjection(text)");
const iComplaint = at("if (text && !replyId && COMPLAINT_RE.test(text)) {");
const iToday = at("const todayQ = !!text && sameDayFor(s.step, s.data.day, text) && ([\"await_day\", \"await_day_text\"].includes(s.step) || !stepAnswer);");
const typedHead = "if (text && freeTextStep && !isEmail(text) && (looksLikeQuestion(text) || MEANING_RE.test(text) || f3q || (s.step === \"await_area\" && text.includes(\"?\")))) {";
const iTyped = at(typedHead);
const iButton = at("|| (MEANING_RE.test(text) && text.split(/\\s+/).length <= 10) || f3q)) {");
const iHuman = at("if ((text && !freeTextStep && wantsHuman(text)) || replyId === \"svc_human\") {");
const iLostEs = at("(LOST_ES_RE.test(text) || NO_ENGLISH_RE.test(text))");
const iSwitch = at("else if (text && /^(english|ingl[eé]s|in english)$/i.test(text.trim())) replyId = \"lang_en\";");
check(G2, "all anchors found", [iJob, iNoThanks, iObj, iComplaint, iToday, iTyped, iButton, iHuman, iLostEs, iSwitch].every((i) => i >= 0), true, "");
check(G2, "the guards run first", [iJob < iNoThanks, iNoThanks < iObj, iObj < iComplaint, iComplaint < iToday, iToday < iTyped, iTyped < iButton], [true, true, true, true, true, true], "\"Busco trabajo de masajista, ¿cuánto pagáis?\" never gets the price");
check(G2, "the earlier language rules still win", [iSwitch < iTyped, iLostEs < iTyped], [true, true], "");
const typed = snap.slice(iTyped, iButton);
const button = snap.slice(iButton, iHuman);
const ord = (src, parts) => parts.map((p) => src.indexOf(p)).every((x, i, a) => x >= 0 && (i === 0 || x > a[i - 1]));
check(G2, "typed steps: known answers, new answers, agent, one repeat limit", ord(typed, ["if (PRICEQ_RE.test(text)) await sendText(from, COPY[L].priceInfo);", "else if (zoneQ(text))", "else if (await f3Answer(from, L, text, langAsk) || todayQ) {", "await lastResort(s, from, L, text)", "if (todayQ) await sameDayReply(s, from, L, text, askAgain);\n      else await reAskOnce(s, from, L, text, askAgain, stepAnswer ? \"bare\" : \"answer\");"]), true, "review round 2: a question that holds the step's answer always gets the step's question");
check(G2, "button steps: known answers, new answers, agent, one repeat limit", ord(button, ["if (PRICEQ_RE.test(text)) await sendText(from, COPY[L].priceInfo);", "else if (THERAPISTQ_RE.test(text)) {", "else if (SERVICEQ_RE.test(text) && !detectService(text)) {", "else if (await f3Answer(from, L, text, langAsk) || todayQ) {", "await lastResort(s, from, L, text)", "if (todayQ) await sameDayReply(s, from, L, text);\n      else await reAskOnce(s, from, L, text);"]) && !button.includes("await reAsk(s, from, L);"), true, "");
// Review fixes: a language question that answers the step goes to the step;
// "English?" in a Spanish chat switches it; the agent knows the time.
check(G2, "the language gate", [snap.includes("const langAsk = !!text && (langQ(text) || ENGLISH_ASK_RE.test(text));\n    const f3q = !!text && ((langAsk && !stepAnswer && !(s.step === \"await_name\" && !!nameWithLang(text)) && !detectService(text) && !detectDay(text, L)) || todayQ || (!!shortAsk(text) && !stepAnswer));"), (snap.match(/LANGQ_RE\.test\(/g) || []).length], [true, 2], "review round 2: \"In English?\" counts; a name with a request goes to the step");
const nameCase = between(snap, "      case \"await_name\": {", "      case \"await_email_req\": {");
const iNameLang = nameCase.indexOf("if (langAsk && nameWithLang(text)) await f3Answer(from, L, text, true);");
check(G2, "the name step answers the language request, then keeps the name", [iNameLang > nameCase.indexOf("if (!text) { await sendText(from, COPY[L].name); break; }"), iNameLang < nameCase.indexOf("const parsedName = parseName(text);")], [true, true], "");
const iLangReset = at("if (s.data.lang !== lang0 && s.data.reAskStep && !SOFT_ACK_RE.test(text) && !ACK_ONLY_RE.test(text)) { delete s.data.reAskStep; await saveSession(s); }\n    const L: string = s.data.lang === \"es\" ? \"es\" : \"en\";");
check(G2, "a language switch starts the repeat limit again", [at("const lang0 = s.data.lang; // v214.2 (review): the language before this message\n    const placeOnly = ") > 0, iLangReset > at("if (text && !replyId && s.data.lang === \"es\" && ENGLISH_ASK_RE.test(text)) {")], [true, true], "");
const iEnAsk = at("if (text && !replyId && s.data.lang === \"es\" && ENGLISH_ASK_RE.test(text)) {");
check(G2, "\"English?\" switches before the language is fixed", [iEnAsk > at("else if (s.data.lang === \"es\" && !strongSpanish(text) && looksEnglish(text)"), iEnAsk < at("const L: string = s.data.lang === \"es\" ? \"es\" : \"en\";\n\n    // v195 (replay): \"No entiendo\""), iEnAsk < iTyped], [true, true, true], "");
check(G2, "the fallback agent knows the time", snap.includes("facts_url: FACTS_URL, madrid_now: madridNowLabel() };"), true, "");
check(G2, "the v200 rule lives in one place", [(snap.match(/s\.data\.reAskAt = Date\.now\(\)/g) || []).length, /Number\(s\.data\.reAskAt \|\| 0\) < 15 \* 60e3/.test(snap)], [1, false], "");
check(G2, "reAskOnce: a held thanks stays quiet; reAskNow records", [/const held = reAskHeld\(s\.data, s\.step, text, Date\.now\(\), how !== "bare"\);\n(?: *\/\/[^\n]*\n)*  if \(held === "later" && how === "bare" && !sentThisTurn\) await sendText\(from, COPY\[L\]\.rebookLater\);\n  if \(held\) \{ if \(how === "ack"\) quietThisTurn = true;/.test(lift(snap, "async function reAskOnce(")), /async function reAskNow\([^\n]*\n  s\.data\.reAskStep = s\.step; s\.data\.reAskAt = Date\.now\(\); await saveSession\(s\);/.test(snap)], [true, true], "");
const fallback = between(snap, "const flowStep = !isStudio", "await logEvent(from, \"fallback_ack\"");
check(G2, "re-ask: the holding turn", [fallback.includes("reasked = await reAskOnce(s, from, L, said, undefined, \"bare\");"), fallback.includes("await reAsk(")], [true, false], "");
const dayCase = between(snap, "      case \"await_day\": {", "      case \"await_day_text\": {");
check(G2, "re-ask: thanks at the day question", dayCase.includes("await logEvent(from, \"soft_ack\", { at: \"await_day\", said: text.slice(0, 30) });\n          await reAskOnce(s, from, L, text, undefined, softAckHow(text));"), true, "review round 2: a yes gets the day question");
check(G2, "re-ask: the link line clears the repeat limit", /if \(LINK_ONLY_RE\.test\(String\(text \|\| ""\)\)\) \{\n(?: *\/\/[^\n]*\n)* *delete s\.data\.reAskStep; await saveSession\(s\);\n *await sendText\(from, COPY\[L\]\.gotLink\);/.test(dayCase), true, "");
check(G2, "re-ask: a miss at the day question", [/if \(mustAsk\) await reAskNow\(s, from, L\);\n {10}else await reAskOnce\(s, from, L, text \|\| "", undefined, how\);\n {8}\}\n {8}break;\n {6}\}\n$/.test(dayCase), /Tap a day below[^\n]*\); mustAsk = true; \}/.test(dayCase), /if \(s\.step !== stepNow\) break;\n[^\n]*\n[^\n]*\n[^\n]*\n {14}how = "answer";/.test(dayCase)], [true, true, true], "\"Tap a day below\" always has the buttons under it");
check(G2, "re-ask: the day list after an agent answer", between(snap, "      case \"await_day_text\": {", "      case \"await_time\": {").includes("await reAskOnce(s, from, L, text);\n            break;"), true, "");
const sdr = lift(snap, "async function sameDayReply(");
check(G2, "same day at the day question goes on like a typed today", [sdr.includes("s.data.day = L === \"es\" ? \"Hoy\" : \"Today\"; s.data.dayDate = longDate(L, 0);"), sdr.includes("else { s.step = \"await_time\"; await saveSession(s); await askTime(from, L); }"), /const hour = mcMadridHour\(\);/.test(sdr)], [true, true, true], "");
check(G2, "the night line never stands alone", [/s\.step = "await_day";\n    await reAskNow\(s, from, L\);\n    return;\n  \}\n  await reAskNow\(s, from, L, ask\);\n\}\n$/.test(sdr), (sdr.match(/reAskOnce\(/g) || []).length, lift(snap, "async function sameDayReply(") === lift(bot, "async function sameDayReply(")], [true, 1, true], "");
const areaCase = between(snap, "      case \"await_area\": {", "      case \"await_studio\": {");
const iGuard = areaCase.indexOf("if (text.includes(\"?\") || f3q) {");
check(G2, "the area step never saves a \"?\" message", [iGuard > areaCase.indexOf("else if (text) {"), iGuard < areaCase.indexOf("if (ANY_RE.test(text)) area = \"anywhere\";"), iGuard < areaCase.indexOf("area = area || hit || text.slice(0, 40);")], [true, true, true], "");
// Review: "Retiro?" at the area question loses its marks (bareAreaAsk) after
// the complaint guard and before any question test.
const iBare = at("if (text && !replyId && s.step === \"await_area\") {\n      const bare = bareAreaAsk(text);\n      if (bare) { await logEvent(from, \"area_question_mark\", { said: text.slice(0, 80), area: bare }); text = bare; }\n      // Review round 3: a place we do not know (\"Pacífico?\"): the area the reader finds in it.\n      else if (placeAsk(text) && (await readerAssist(s, from, L, text, \"area\")).includes(\"area\")) { await logEvent(from, \"area_question_mark\", { said: text.slice(0, 80), area: s.data.area, by: \"reader\" }); text = String(s.data.area); }\n    }\n");
check(G2, "\"Retiro?\" is the area", [iBare > iComplaint, iBare < iToday, (snap.match(/bareAreaAsk\(/g) || []).length], [true, true, 2], "");

// The lifted helpers behave in the snapshot exactly as in bot.ts.
const copyUrl = pathToFileURL(fn("copy.ts")).href;
const one = (name) => (snap.match(new RegExp(`^const ${name} = .*$`, "m")) || [""])[0];
const js = `import { stripAcc, detectArea, ACK_ONLY_RE, GOODBYE_RE, parseName, AREAS, looksLikeQuestion } from ${JSON.stringify(copyUrl)};\n`
  + stripTypeScriptTypes([one("LATER_RE"), one("EXTRA_AREAS"), lift(snap, "function detectAreaPlus("), block(snap)].join("\n")) + "\nexport { LANGQ_RE, langQ, ENGLISH_ASK_RE, sameDayQ, sameDayFor, sameDayLine, shortAsk, reAskHeld, bareAreaAsk, placeAsk, softAckHow, nameWithLang, NIGHT_OK_RE };\n";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-f3snap-"));
fs.writeFileSync(path.join(dir, "f3.mjs"), js);
const Q = await import(pathToFileURL(path.join(dir, "f3.mjs")).href);
fs.rmSync(dir, { recursive: true, force: true });
const { looksLikeQuestion, detectDay } = await import(copyUrl);
for (const [msg, want] of [["Do you speak English?", true], ["¿Habláis inglés?", true], ["English?", true], ["Tengo 82 años y no entiendo inglés", true], ["English", false], ["No sé quién eres", false]]) check(G2, `language: ${msg}`, Q.LANGQ_RE.test(msg), want, "");
for (const [msg, want] of [["Can I book today?", true], ["¿Para hoy?", true], ["How much for today?", true], ["today at 6", false], ["hoy a las 18", false], ["¿Por la tarde tendríais espacio?", false]]) check(G2, `same day: ${msg}`, Q.sameDayQ(msg), want, "");
check(G2, "today at 6 / hoy a las 18 stay day answers", [detectDay("today at 6", "en"), detectDay("hoy a las 18", "es")], ["Today", "Hoy"], "");
check(G2, "sameDayFor after another day", Q.sameDayFor("await_time", "Saturday", "Today?"), false, "");
check(G2, "night line from 19:00", [Q.sameDayLine("en", 18).startsWith("Yes, same day can work"), Q.sameDayLine("en", 19), Q.sameDayLine("es", 19)], [true, "It's late for tonight, so I'll look at tomorrow.", "Para esta noche ya es tarde, así que miro mañana."], "");
for (const [msg, want] of [["Info", "info"], ["más info", "info"], ["location?", "where"], ["ubicación?", "where"], ["tipos?", "types"], ["types?", "types"]]) check(G2, `short: ${msg}`, [Q.shortAsk(msg), looksLikeQuestion(msg)], [want, false], "");
const T = Date.UTC(2026, 10, 14, 10);
check(G2, "reAskHeld", [Q.reAskHeld({ reAskStep: "await_day", reAskAt: T - 5 * 60e3 }, "await_day", "ok", T), Q.reAskHeld({ reAskStep: "await_day", reAskAt: T - 16 * 60e3 }, "await_day", "ok", T), Q.reAskHeld({}, "await_day", "I'll let you know", T)], ["recent", "", "later"], "");
check(G2, "reAskHeld when the question is the whole reply", [Q.reAskHeld({ reAskStep: "await_day", reAskAt: T - 60e3 }, "await_day", "hmm", T, false), Q.reAskHeld({}, "await_day", "I'll let you know", T, false)], ["", "later"], "a miss still gets the day buttons");
// Review: no same-day answer once a request exists (await_email_post).
for (const [step, day, msg, want] of [["await_email_post", "Today", "Is it confirmed for today?", false], ["await_email_post", "Hoy", "¿Sigue en pie lo de hoy?", false], ["await_email_post", "Today", "Any news for today?", false], ["done", "Today", "Is it today?", false], ["await_email", "Today", "Is it still possible today?", true], ["await_day", null, "Can I come today?", true]]) check(G2, `sameDayFor ${step} ${msg}`, Q.sameDayFor(step, day, msg), want, "");
// Review: statements are not language questions; "English?" switches.
for (const [msg, want] of [["I speak English", false], ["hablo inglés", false], ["Hi, I speak English. Tomorrow at 6pm near Sol", false], ["Ana, I speak English", false], ["Do you speak English?", true], ["Tengo 82 años y no entiendo inglés", true], ["English-speaking therapist please", true], ["English?", true]]) check(G2, `langQ: ${msg}`, Q.langQ(msg), want, "");
for (const [msg, want] of [["English?", true], ["In English?", true], ["English", false], ["Inglés?", false]]) check(G2, `ENGLISH_ASK_RE: ${msg}`, Q.ENGLISH_ASK_RE.test(msg), want, "");
// Review: the area with a question mark is the area; other "?" stay questions.
for (const [msg, want] of [["Retiro?", "Retiro"], ["¿Sol?", "Sol"], ["Sol ?", "Sol"], ["Chamberí?", "Chamberí"], ["Is Sol ok?", ""], ["Where is Retiro?", ""], ["Something near Sol?", ""], ["Retiro or Salamanca, which is closer?", ""], ["Retiro or Salamanca?", ""], ["Retiro today?", ""], ["Madrid?", ""]]) check(G2, `bareAreaAsk: ${msg}`, Q.bareAreaAsk(msg), want, "");
// Review round 2: "near X?", "cerca de X?", "por X?" and a polite tail are the area.
for (const [msg, want] of [["Near Sol?", "Sol"], ["¿Cerca de Sol?", "Sol"], ["Por Retiro?", "Retiro"], ["Retiro? 🙏", "Retiro"], ["Sol? thanks", "Sol"], ["Retiro please?", "Retiro"], ["Near?", ""], ["Near Sol? Is it far", ""], ["Near Sol or Retiro?", ""]]) check(G2, `bareAreaAsk: ${msg}`, Q.bareAreaAsk(msg), want, "");
// Review round 2: a yes is not a thank-you; only a plain thanks or ok is held quietly.
for (const [msg, want] of [["Yes", "bare"], ["Sí", "bare"], ["Claro", "bare"], ["Sisi", "bare"], ["Yeah", "bare"], ["Ok", "ack"], ["Vale", "ack"], ["Gracias", "ack"], ["Thanks", "ack"]]) check(G2, `softAckHow: ${msg}`, Q.softAckHow(msg), want, "");
const T3 = { reAskStep: "await_day", reAskAt: T - 3 * 60e3 };
check(G2, "the night line, then Yes / Claro: the day buttons", [Q.reAskHeld(T3, "await_day", "Yes", T, Q.softAckHow("Yes") !== "bare"), Q.reAskHeld(T3, "await_day", "Claro", T, Q.softAckHow("Claro") !== "bare"), Q.reAskHeld(T3, "await_day", "Gracias", T, Q.softAckHow("Gracias") !== "bare")], ["", "", "recent"], "a plain thanks stays quiet");
// Review round 2: "In English?" asks for English; a name with a request is the name.
for (const [msg, want] of [["In English?", true], ["English please?", true], ["English pls?", true]]) check(G2, `asks for English: ${msg}`, [Q.langQ(msg) || Q.ENGLISH_ASK_RE.test(msg), Q.nameWithLang(msg)], [want, ""], "never saved as the name or the studio");
for (const [msg, want] of [["Mark, English speaking therapist please", "Mark"], ["Ana, English speaker", "Ana"], ["Ana, i dont speak spanish", "Ana"], ["I only speak English", ""], ["English-speaking therapist please", ""], ["Ana, do you speak English?", ""]]) check(G2, `nameWithLang: ${msg}`, Q.nameWithLang(msg), want, "");
// Review round 3: only an area's words and filler stand with the area; a tag,
// a flag, ":)" or an invisible mark after it is still the area.
for (const [msg, want] of [["¿Retiro está lejos?", ""], ["Not in Centro?", ""], ["Fuera del centro?", ""], ["Centro de masajes?", ""], ["Retiro y Salamanca?", ""], ["Retiro vs Salamanca?", ""], ["Centro no?", ""], ["Near to Sol?", "Sol"], ["Barrio de Salamanca?", "Barrio de Salamanca"], ["Salamanca, ¿vale?", "Salamanca"], ["Chamberí, ¿sí?", "Chamberí"], ["Retiro ¿ok?", "Retiro"], ["Retiro? 🇪🇸", "Retiro"], ["Retiro? :)", "Retiro"], ["Retiro?" + String.fromCharCode(0x200e), "Retiro"], ["Retiro?" + String.fromCharCode(0x200b), "Retiro"]]) check(G2, `bareAreaAsk (round 3): ${JSON.stringify(msg)}`, Q.bareAreaAsk(msg), want, "");
for (const [msg, want] of [["Pacífico?", true], ["Ríos Rosas?", true], ["Bernabéu?", true], ["Retiro?", false], ["Price?", false], ["Info?", false], ["Is Sol ok?", false]]) check(G2, `placeAsk: ${msg}`, Q.placeAsk(msg), want, "the reader may name the area; nothing else is kept");
// Review round 3: the night line stamps the day question, and a soft ack to it is the Tomorrow tap.
check(G2, "the night line, then \"Ok\": the Tomorrow tap", [sdr.includes("  if (s.step === \"await_day\" || (!dayStep && /^(today|hoy)$/i.test(String(s.data.day || \"\").trim()))) s.data.nightLineAt = Date.now();\n"), /^ {6}case "await_day": \{\n(?: *\/\/[^\n]*\n)* {8}if \(!replyId && text && NIGHT_OK_RE\.test\(text\) && Date\.now\(\) - nightAt < REASK_GAP_MS\) \{\n {10}if \(mcMadridHour\(\) >= 19\) replyId = "day_tomorrow"; else delete s\.data\.reAskStep;\n/.test(dayCase)], [true, true], "before the core's own check of a tapped day");
// Review round 4: the stamp is read and cleared as the next message comes in,
// so only that message can use it, and only a plain ok or yes is the tap.
check(G2, "the night line's stamp is for the next message only", [/\n    const s = await getSession\(from\);\n    if \(profileName && !s\.wa_name\) s\.wa_name = profileName;\n    if \(ref\) s\.data\.adRef = [^\n]*\n(?: *\/\/[^\n]*\n)*    const nightAt = Number\(s\.data\.nightLineAt \|\| 0\);\n    if \(nightAt\) \{ delete s\.data\.nightLineAt; await saveSession\(s\); \}\n/.test(snap), (snap.match(/nightLineAt/g) || []).length], [true, 3], "the stamp in sameDayReply, and the read and the clear at the turn start: nothing else");
for (const [msg, want] of [["Ok", true], ["Vale", true], ["Sí", true], ["Yes", true], ["Ok 👍", true], ["Vale 👌🏽", true], ["Thanks", false], ["Gracias", false], ["Ok gracias", false], ["Sí, gracias", false], ["Gracias 👋", false], ["Ok 😞", false], ["Ok 🙏", false], ["thx", false]]) check(G2, `NIGHT_OK_RE: ${msg}`, Q.NIGHT_OK_RE.test(msg), want, "a thanks or another emoji is held as before");
// Review round 3: "I'll let you know" as the whole reply gets the approved no-problem line (reAskOnce, above); the question stays held.
check(G2, "\"I'll let you know\": the no-problem line, and Jordan is told", [Q.reAskHeld({}, "await_day", "I'll let you know", T, false), fallback.length > 0 && snap.includes("sentThisTurn ? \"They said they will tell us later, so they got the no-problem line and their booking question was not repeated\" : ")], ["later", true], "");
for (const [msg, want] of [["Ok 👍", "ack"], ["thx", "ack"], ["Yes 👍", "bare"]]) check(G2, `softAckHow (round 3): ${msg}`, Q.softAckHow(msg), want, "");
for (const msg of ["Sorry, I only speak English", "Hola, ¿hablan inglés", "Ok, English speaker please"]) check(G2, `nameWithLang (round 3): ${msg}`, Q.nameWithLang(msg), "", "never saved as the name");
check(G2, "typed steps: the ready answers at the area question", ord(typed, ["else if (zoneQ(text))", "else if (s.step === \"await_area\" && THERAPISTQ_RE.test(text)) { await sendText(from, COPY[L].therapistAnswer);", "else if (s.step === \"await_area\" && SERVICEQ_RE.test(text) && !detectService(text)) { await sendText(from, COPY[L].servicesAnswer);", "else if (await f3Answer(from, L, text, langAsk) || todayQ) {"]), true, "\"What type?\" at the area question gets the massage list");

// ---------------------------------------------------------------------------
const total = pass + failures.length;
if (failures.length) {
  console.log(`\n${failures.length} of ${total} FAILING\n`);
  for (const f of failures) {
    console.log(`  ${f.group}`);
    console.log(`    input : ${JSON.stringify(f.input)}`);
    console.log(`    got   : ${JSON.stringify(f.got)}`);
    console.log(`    want  : ${JSON.stringify(f.want)}`);
    if (f.note) console.log(`    why   : ${f.note}`);
    console.log("");
  }
  process.exit(1);
}
console.log(`snapshot F3 check: all ${total} pass`);
