// Letters (17 Nov 2026): Pingen webhooks. Signature check over the raw bytes,
// payload parsing, and what each event does to a letter. Pure (WebCrypto
// only), so Node tests run it.
//
// Pingen signs with header `Signature` = lowercase hex HMAC-SHA256 of the raw
// body under the webhook's signing key (official SDKs, read 17 Nov). It
// retries any non-2xx (1 min, 5 min, 10 min, 1 h, 2 h, 4 h), so the handler
// answers 401 for a bad signature, 503 when the secret is not set, and 200 for
// everything verified, even an event it ignores.

import { hmacSha256, constantTimeEqual } from "./sign.ts";

const SIG_RE = /^[0-9a-f]{64}$/;

export async function verifySignature(raw: Uint8Array, header: string | null, secret: string): Promise<boolean> {
  if (!secret || !header) return false;
  const sig = header.trim();
  if (!SIG_RE.test(sig)) return false;
  const mac = await hmacSha256(secret, raw);
  const given = new Uint8Array(32);
  for (let i = 0; i < 32; i++) given[i] = parseInt(sig.slice(i * 2, i * 2 + 2), 16);
  return constantTimeEqual(mac, given);
}

export type WebhookEvent = {
  deliveryId: string; eventId: string; category: string; reason: string; createdAt: string;
  orgId: string; letterId: string; deliverableType: string;
};

export function parseWebhook(json: unknown): { ok: true; event: WebhookEvent } | { ok: false; error: string } {
  const d = (json as { data?: Record<string, unknown> } | null)?.data;
  if (!d || typeof d !== "object") return { ok: false, error: "no data" };
  const type = String(d.type || "");
  const m = type.match(/^webhook_(issues|sent|undeliverable|delivered)$/);
  if (!m) return { ok: false, error: `unknown type ${type}` };
  const a = (d.attributes || {}) as Record<string, unknown>;
  const rel = (d.relationships || {}) as Record<string, { data?: { id?: string; type?: string } }>;
  const event: WebhookEvent = {
    deliveryId: String(d.id || ""),
    eventId: String(rel.event?.data?.id || d.id || ""),
    category: m[1],
    reason: String(a.reason || "").slice(0, 500),
    createdAt: String(a.created_at || ""),
    orgId: String(rel.organisation?.data?.id || ""),
    letterId: String(rel.deliverable?.data?.id || ""),
    deliverableType: String(rel.deliverable?.data?.type || ""),
  };
  if (!event.eventId || !event.letterId) return { ok: false, error: "missing ids" };
  return { ok: true, event };
}

export type WebhookPlan = {
  kind: "ignore" | "unknown_letter" | "record" | "apply";
  event: string;
  steps: string[];
  patch: Record<string, unknown>;
  recipientReview?: string;
  note?: string;
};

// What an event does to our letter. Steps walk the state machine one edge at
// a time (submitted -> sent -> undeliverable when the "sent" event was missed).
export function planWebhook(ev: WebhookEvent, letter: { status: string } | null, orgId: string, nowIso: string): WebhookPlan {
  if (!orgId || ev.orgId !== orgId) return { kind: "ignore", event: "webhook_wrong_org", steps: [], patch: {} };
  if (ev.deliverableType !== "letters") return { kind: "ignore", event: "webhook_not_a_letter", steps: [], patch: {} };
  if (!letter) return { kind: "unknown_letter", event: "webhook_unknown_letter", steps: [], patch: {} };
  const st = letter.status;
  const at = ev.createdAt || nowIso;
  switch (ev.category) {
    case "sent": {
      const patch = { pingen_status: "sent", sent_at: at };
      if (st === "submitted") return { kind: "apply", event: "webhook_sent", steps: ["sent"], patch };
      if (st === "sending") return { kind: "apply", event: "webhook_sent", steps: ["submitted", "sent"], patch: { ...patch, submitted_at: at } };
      if (["sent", "delivered", "undeliverable"].includes(st)) return { kind: "record", event: "webhook_sent_repeat", steps: [], patch: {} };
      return { kind: "record", event: "sent_outside_tool", steps: [], patch: { pingen_status: "sent", last_error: "Pingen says this letter was sent, but it was not sent from this tool (someone used the Pingen web app)." } };
    }
    case "undeliverable": {
      const patch = { pingen_status: "undeliverable", undeliverable_at: at, status_reason: ev.reason || "Returned as undeliverable." };
      const review = `undeliverable on ${at.slice(0, 10)}${ev.reason ? `: ${ev.reason}` : ""}`.slice(0, 200);
      if (st === "sent") return { kind: "apply", event: "webhook_undeliverable", steps: ["undeliverable"], patch, recipientReview: review };
      if (st === "submitted") return { kind: "apply", event: "webhook_undeliverable", steps: ["sent", "undeliverable"], patch: { ...patch, sent_at: at }, recipientReview: review };
      return { kind: "record", event: "webhook_undeliverable", steps: [], patch: { pingen_status: "undeliverable" }, recipientReview: review };
    }
    case "delivered": {
      const patch = { pingen_status: "delivered", delivered_at: at };
      if (st === "sent") return { kind: "apply", event: "webhook_delivered", steps: ["delivered"], patch };
      if (st === "submitted") return { kind: "apply", event: "webhook_delivered", steps: ["sent", "delivered"], patch: { ...patch, sent_at: at } };
      return { kind: "record", event: "webhook_delivered", steps: [], patch: {} };
    }
    default: {
      // issues: a problem Pingen found. While we wait for validation it blocks
      // the letter; later on it is recorded and pingen_refresh reconciles.
      if (st === "checking") return { kind: "apply", event: "webhook_issue", steps: ["blocked"], patch: { status_reason: ev.reason || "Pingen reported an issue." } };
      return { kind: "record", event: "webhook_issue", steps: [], patch: { status_reason: ev.reason || "Pingen reported an issue." } };
    }
  }
}
