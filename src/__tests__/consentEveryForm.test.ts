/**
 * THE KELLY RULE (CLAUDE.md, 19 Nov 2026): "No booking path may collect an
 * email or phone without this step, and every new form or bot flow is checked
 * for it before it ships." This is that check for the website.
 *
 * Every .tsx file under src/ with an email or phone input must either show the
 * offers question (ConsentQuestion, MarketingOptInCard or ConsentSaveView) or
 * be listed below with the reason it does not need to. A new form fails this
 * test until someone decides which it is. public/go.html (the homepage request
 * form) must carry the notice and both buttons.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CONSENT_COPY } from "@/lib/marketingOptIn";

const ROOT = path.resolve(__dirname, "../..");
const CONTACT_INPUT = /type="(email|tel)"|inputMode="(email|tel)"|autoComplete="(email|tel)"/;
const ASKS = /\b(ConsentQuestion|MarketingOptInCard|ConsentSaveView)\b/;

/** Files that take an email or phone but are not a customer booking or signup path. */
const NOT_A_BOOKING_PATH: Record<string, string> = {
  "src/app/screens/Login.tsx": "sign in to an existing account",
  "src/app/screens/PartnerLogin.tsx": "studio staff sign in",
  "src/app/screens/PartnerResetPassword.tsx": "studio staff password reset",
  "src/app/screens/PartnerOnboarding.tsx": "studio sign-up (a business, not a customer)",
  "src/app/screens/StudioSetup.tsx": "studio sign-up (a business, not a customer)",
  "src/app/screens/AdminInviteStudio.tsx": "founder tool",
  "src/app/screens/SurveyStudios.tsx": "research survey for studios",
  "src/app/screens/SurveyCustomers.tsx": "research survey; the email is only for the next survey rounds (no offers are promised)",
  "src/pages/Home.tsx": "\"Missing your favourite studio?\" invite: the email is optional and only for that invite",
  "src/pages/AccountSetup.tsx": "creating an account after a booking that already asked; no news promised (19 Nov)",
  "src/components/AccountOfferBlock.tsx": "account offer on the sent screen of a booking that already asked",
  "src/pages/Unsubscribe.tsx": "the stop page itself",
  "src/pages/BookingCard.tsx": "the WhatsApp booking card (/r/...): the bot asks the offers question in the chat after the booking",
  "src/pages/Request.tsx": "retired 19 Nov: /request redirects to /reserve (App.tsx ToReserve)",
  "src/pages/Notify.tsx": "retired 19 Nov: /notify redirects to /reserve (App.tsx ToReserve)",
  "src/pages/Index.tsx": "retired 19 Nov: /landing redirects to /reserve (App.tsx ToReserve)",
  "src/components/ExitCaptureBlock.tsx": "dead code: rendered nowhere since 31 Oct",
  "src/app/components/AbandonedBookingSheet.tsx": "dead code: rendered nowhere",
};

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") out.push(...tsxFiles(p));
    } else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("every form that takes an email or phone asks about offers (the Kelly rule)", () => {
  const files = tsxFiles(path.join(ROOT, "src")).map((f) => path.relative(ROOT, f).split(path.sep).join("/"));

  it("each one shows the question, or is listed with a reason", () => {
    const missing: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      if (!CONTACT_INPUT.test(src)) continue;
      if (ASKS.test(src)) continue;
      if (NOT_A_BOOKING_PATH[f]) continue;
      missing.push(f);
    }
    expect(missing, "add the offers question (ConsentQuestion) or a reason in NOT_A_BOOKING_PATH").toEqual([]);
  });

  it("the list has no stale entries", () => {
    for (const f of Object.keys(NOT_A_BOOKING_PATH)) {
      expect(fs.existsSync(path.join(ROOT, f)), f).toBe(true);
    }
  });

  it("the retired routes really go to the request form", () => {
    const app = fs.readFileSync(path.join(ROOT, "src/App.tsx"), "utf8");
    for (const r of ["request", "notify", "landing"]) {
      expect(app).toContain(`<Route path="/${r}" element={<ToReserve src="${r}" />} />`);
    }
  });

  it("the homepage request form carries the notice and both buttons, in English and Spanish", () => {
    const go = fs.readFileSync(path.join(ROOT, "public/go.html"), "utf8");
    for (const lang of ["en", "es"] as const) {
      expect(go).toContain(CONSENT_COPY[lang].notice);
      expect(go).toContain(`"${CONSENT_COPY[lang].yes}"`);
      expect(go).toContain(`"${CONSENT_COPY[lang].no}"`);
    }
    expect(go).toMatch(/data-mk="yes"/);
    expect(go).toMatch(/data-mk="no"/);
  });
});
