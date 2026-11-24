// Letters: Pingen webhook signature and event planning
// (supabase/functions/letters/webhook.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySignature, parseWebhook, planWebhook } from "../../supabase/functions/letters/webhook.ts";

const SECRET = "whsec_test_0123456789abcdef";
const ORG = "11111111-2222-4333-8444-555555555555";
const LID = "99999999-8888-4777-8666-555555555555";
const enc = new TextEncoder();
export function payload(category, o = {}) {
  return {
    data: {
      id: o.delivery || "d0d0d0d0-0000-4000-8000-000000000001",
      type: `webhook_${category}`,
      attributes: { reason: o.reason || "", url: "https://x", created_at: "2026-11-20T09:42:48+0100" },
      relationships: {
        organisation: { data: { id: o.org || ORG, type: "organisations" } },
        deliverable: { data: { id: o.letter || LID, type: o.type || "letters" } },
        event: { data: { id: o.event || "e0e0e0e0-0000-4000-8000-000000000001", type: "letters_events" } },
      },
    },
  };
}
const sign = (raw, key = SECRET) => createHmac("sha256", key).update(raw).digest("hex");

test("a good signature over the raw bytes is accepted", async () => {
  const raw = enc.encode(JSON.stringify(payload("sent")));
  assert.equal(await verifySignature(raw, sign(raw), SECRET), true);
});

test("tampered body, missing header, wrong length, uppercase, wrong key are rejected", async () => {
  const raw = enc.encode(JSON.stringify(payload("sent")));
  const sig = sign(raw);
  const tampered = enc.encode(JSON.stringify(payload("sent")).replace("sent", "undeliverable"));
  assert.equal(await verifySignature(tampered, sig, SECRET), false);
  assert.equal(await verifySignature(raw, null, SECRET), false);
  assert.equal(await verifySignature(raw, "", SECRET), false);
  assert.equal(await verifySignature(raw, sig.slice(0, 63), SECRET), false);
  assert.equal(await verifySignature(raw, sig + "0", SECRET), false);
  assert.equal(await verifySignature(raw, sig.toUpperCase(), SECRET), sig === sig.toUpperCase());
  assert.equal(await verifySignature(raw, sign(raw, "another-secret-value-123"), SECRET), false);
  assert.equal(await verifySignature(raw, sig, ""), false);
  // Re-serialised JSON (different bytes) does not verify: the check is on the raw body.
  const reserialised = enc.encode(JSON.stringify(JSON.parse(new TextDecoder().decode(raw)), null, 1));
  assert.equal(await verifySignature(reserialised, sig, SECRET), false);
});

test("parse: ids, category, event id falls back to the delivery id", () => {
  const p = parseWebhook(payload("undeliverable", { reason: "Unknown recipient" }));
  assert.equal(p.ok, true);
  assert.equal(p.event.category, "undeliverable");
  assert.equal(p.event.letterId, LID);
  assert.equal(p.event.eventId, "e0e0e0e0-0000-4000-8000-000000000001");
  assert.equal(p.event.reason, "Unknown recipient");
  const noEvent = payload("sent");
  delete noEvent.data.relationships.event;
  assert.equal(parseWebhook(noEvent).event.eventId, "d0d0d0d0-0000-4000-8000-000000000001");
  assert.equal(parseWebhook({ data: { type: "webhook_other" } }).ok, false);
  assert.equal(parseWebhook(null).ok, false);
});

test("plan: wrong organisation and non-letters are ignored; unknown letters are recorded", () => {
  const ev = (cat, o) => parseWebhook(payload(cat, o)).event;
  const now = "2026-11-20T09:00:00Z";
  assert.equal(planWebhook(ev("sent", { org: "00000000-0000-4000-8000-000000000000" }), { status: "submitted" }, ORG, now).event, "webhook_wrong_org");
  assert.equal(planWebhook(ev("sent", { type: "emails" }), { status: "submitted" }, ORG, now).kind, "ignore");
  assert.equal(planWebhook(ev("sent"), null, ORG, now).kind, "unknown_letter");
  assert.equal(planWebhook(ev("sent"), { status: "submitted" }, "", now).kind, "ignore");
});

test("plan: sent, undeliverable, delivered, issues", () => {
  const ev = (cat, o) => parseWebhook(payload(cat, o)).event;
  const now = "2026-11-20T09:00:00Z";
  assert.deepEqual(planWebhook(ev("sent"), { status: "submitted" }, ORG, now).steps, ["sent"]);
  assert.deepEqual(planWebhook(ev("sent"), { status: "sending" }, ORG, now).steps, ["submitted", "sent"]);
  const outside = planWebhook(ev("sent"), { status: "ready" }, ORG, now);
  assert.equal(outside.event, "sent_outside_tool");
  assert.deepEqual(outside.steps, []);
  assert.equal(planWebhook(ev("sent"), { status: "sent" }, ORG, now).kind, "record");
  const u = planWebhook(ev("undeliverable", { reason: "Moved" }), { status: "sent" }, ORG, now);
  assert.deepEqual(u.steps, ["undeliverable"]);
  assert.match(u.recipientReview, /^undeliverable on 2026-11-20: Moved$/);
  assert.deepEqual(planWebhook(ev("undeliverable"), { status: "submitted" }, ORG, now).steps, ["sent", "undeliverable"]);
  assert.deepEqual(planWebhook(ev("delivered"), { status: "sent" }, ORG, now).steps, ["delivered"]);
  assert.deepEqual(planWebhook(ev("issues", { reason: "Address invalid" }), { status: "checking" }, ORG, now).steps, ["blocked"]);
  assert.equal(planWebhook(ev("issues"), { status: "submitted" }, ORG, now).kind, "record");
});
