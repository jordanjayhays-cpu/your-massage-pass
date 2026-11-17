// Letters (17 Nov 2026): row types and the storage interface the API uses.
// db.ts implements it over PostgREST with the service role; the Node tests
// implement it in memory. Types only: nothing here runs.

import type { Settings, Recipient, Partner } from "./rules.ts";
import type { Template } from "./templates.ts";

export type Campaign = {
  id: string; name: string; status: "open" | "closed"; template: Template; template_version: number;
  pingen_env: "staging" | "production" | null; copied_from: string | null; created_by: string; created_at: string; updated_at: string;
  // Review fix (17 Nov, UX H2): in live, studio letters are posted only after
  // Jordan's own proof letter arrived and he said it looks right.
  proof_confirmed_at?: string | null; proof_confirmed_by?: string | null;
};

export type Letter = {
  id: string; campaign_id: string; recipient_id: string; partner_id: string | null; ref_code: string;
  status: string; status_reason: string | null; greeting_name: string | null; address_lines: string[] | null;
  qr_url: string | null; link_v: number | null; render_inputs_sha256: string | null; renderer_version: string | null;
  pdf_path: string | null; pdf_sha256: string | null; pdf_bytes: number | null; layout: Record<string, unknown> | null; rendered_at: string | null;
  previewed_sha256: string | null; previewed_at: string | null; previewed_by: string | null;
  approved_sha256: string | null; approved_at: string | null; approved_by: string | null; warnings_acked: boolean;
  rejected_at: string | null; rejected_by: string | null; reject_reason: string | null;
  pingen_env: "staging" | "production" | null; pingen_letter_id: string | null; pingen_status: string | null; pingen_address: string | null;
  pingen_pages: number | null; pingen_fonts: unknown; pingen_price: number | null; pingen_currency: string | null;
  uploaded_sha256: string | null; uploaded_at: string | null; submitted_at: string | null; submitted_by: string | null;
  sent_at: string | null; delivered_at: string | null; undeliverable_at: string | null; cancelled_at: string | null;
  last_error: string | null; created_at: string; updated_at: string; purged_at?: string | null;
};

export type LetterEvent = {
  id?: number; campaign_id: string | null; letter_id: string | null; actor: string; event: string;
  from_status?: string | null; to_status?: string | null; detail?: Record<string, unknown> | null; pingen_event_id?: string | null; created_at?: string;
};

// Review fixes (17 Nov): scope says what the BAJA stopped ("letters" only, for
// an active partner, or "all" contact, which sets partners.opted_out_at);
// prev_opted_out_at is what partners.opted_out_at was before, so an undo
// restores it; test rows come from the bot's test numbers and only prove the
// WhatsApp route works (they never touch a studio); message_en is the bot's
// English for Jordan.
export type Optout = {
  id: string; channel: "whatsapp" | "email" | "phone" | "post" | "manual"; from_ref: string | null; message: string | null;
  ref_code: string | null; partner_id: string | null; matched_by: string | null; matched_at: string | null; created_at: string;
  scope?: "letters" | "all" | null; prev_opted_out_at?: string | null; opted_out_set_at?: string | null; undone_at?: string | null; undone_by?: string | null;
  message_en?: string | null; test?: boolean | null;
};

export type LetterFilter = { campaign_id?: string; ids?: string[]; partner_ids?: string[]; statuses?: string[]; limit?: number };

export interface Store {
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  listRecipients(o: { activeOnly: boolean; kind?: "studio" | "proof" }): Promise<Recipient[]>;
  getRecipients(ids: string[]): Promise<Recipient[]>;
  insertRecipients(rows: Omit<Recipient, "id">[]): Promise<Recipient[]>;
  deactivateRecipients(o: { kind?: "studio" | "proof"; partner_ids?: string[] }): Promise<number>;
  updateRecipient(id: string, patch: Partial<Recipient>): Promise<void>;

  getPartners(ids: string[]): Promise<Partner[]>;
  countPartnersWithSlug(slug: string): Promise<number>;
  // Sets opted_out_at only when it is empty; says what it was before.
  setPartnerOptedOut(id: string, atIso: string): Promise<{ partner: Partner | null; previous: string | null; changed: boolean }>;
  // Undo: puts back `previous` only while opted_out_at is still `current`.
  restorePartnerOptedOut(id: string, previous: string | null, current: string): Promise<boolean>;
  // Revokes the studio's signed links (slots page and /socios QR): +1.
  bumpPartnerLink(id: string): Promise<number | null>;
  // Every mailing-list row of these studios, active or not.
  recipientsForPartners(ids: string[]): Promise<Recipient[]>;

  listCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | null>;
  insertCampaign(row: Omit<Campaign, "id" | "created_at" | "updated_at">): Promise<Campaign>;
  // With expectedVersion: updates only while template_version still equals it.
  updateCampaign(id: string, patch: Partial<Campaign>, expectedVersion?: number): Promise<Campaign | null>;

  listLetters(f: LetterFilter): Promise<Letter[]>;
  getLetter(id: string): Promise<Letter | null>;
  insertLetters(rows: Partial<Letter>[]): Promise<Letter[]>;
  // With expectStatus: updates only while the status is still one of them
  // (the conditional claim); null when nothing matched.
  updateLetter(id: string, patch: Partial<Letter>, expectStatus?: string | string[]): Promise<Letter | null>;
  findLetterByPingenId(pingenId: string): Promise<Letter | null>;
  findLetterByRef(ref: string): Promise<Letter | null>;
  refCodesTaken(codes: string[]): Promise<string[]>;
  countSubmittedSince(iso: string): Promise<number>;

  // false when pingen_event_id was already recorded (a webhook replay).
  insertEvent(e: LetterEvent): Promise<boolean>;
  listEvents(o: { campaign_id?: string; letter_id?: string; limit: number }): Promise<LetterEvent[]>;

  insertOptout(row: Omit<Optout, "id" | "created_at">): Promise<Optout>;
  listOptouts(limit: number): Promise<Optout[]>;
  // Matched, not undone, not test: the BAJAs that stop letters.
  activeOptoutsFor(partnerIds: string[]): Promise<Optout[]>;
  // The newest test BAJA that came by WhatsApp since then (the route proof).
  latestTestOptout(sinceIso: string): Promise<Optout | null>;
  getOptout(id: string): Promise<Optout | null>;
  updateOptout(id: string, patch: Partial<Optout>): Promise<void>;

  // Fixed-window counters (letters_rate_hit / letters_rate_peek).
  rateHit(actor: string, kind: string, windowS: number, limit: number): Promise<boolean>;
  ratePeek(actor: string, kind: string, windowS: number): Promise<number>;

  putPdf(path: string, bytes: Uint8Array): Promise<void>;
  getPdf(path: string): Promise<Uint8Array | null>;
  deletePdf(path: string): Promise<void>;

  // Review fix (17 Nov, security M3): retention. letters_purge_expired (SQL,
  // also run daily by pg_cron) blanks addresses 12 months after the mailing
  // and at once for studios that opted out, and queues their PDFs; the
  // function deletes queued PDFs from Storage (SQL cannot).
  purgeExpired(): Promise<Record<string, number>>;
  pdfDeletions(limit: number): Promise<string[]>;
  pdfDeleted(path: string): Promise<void>;

  funnelStats(partnerIds: string[], sinceIso: string): Promise<{ partner_id: string; opened: number; signed_up: number }[]>;
}
