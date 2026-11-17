// Letters (17 Nov 2026): the Store over PostgREST and Storage with the service
// role key. The only reader and writer of the letter_* tables (RLS on, no
// policies). No Deno globals here: fetch and the keys come in as arguments.

import type { Store, Letter, Campaign, LetterEvent, Optout, LetterFilter } from "./types.ts";
import type { Settings, Recipient, Partner } from "./rules.ts";
import { DEFAULT_SETTINGS } from "./rules.ts";

type F = (url: string, init?: RequestInit) => Promise<Response>;
const BUCKET = "letters-pdf";
const PARTNER_COLS = "id,business_name,slug,status,opted_out_at,outreach_status,address,slots_link_v";
const enc = encodeURIComponent;
const inList = (ids: string[]) => `(${ids.map((i) => `"${String(i).replace(/"/g, "")}"`).join(",")})`;

export function createStore(o: { url: string; serviceKey: string; fetch: F }): Store {
  const H = (extra: Record<string, string> = {}) => ({ apikey: o.serviceKey, Authorization: `Bearer ${o.serviceKey}`, "Content-Type": "application/json", ...extra });
  async function rest<T>(path: string, init: RequestInit = {}, okEmpty = false): Promise<T> {
    const r = await o.fetch(`${o.url}/rest/v1/${path}`, { ...init, headers: H((init.headers || {}) as Record<string, string>) });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      const err = new Error(`db ${init.method || "GET"} ${path.split("?")[0]} ${r.status}: ${t.slice(0, 300)}`) as Error & { status?: number };
      err.status = r.status;
      throw err;
    }
    if (r.status === 204 || okEmpty) return null as T;
    const text = await r.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  const get = <T>(path: string) => rest<T>(path);
  const post = <T>(path: string, body: unknown, prefer = "return=representation") => rest<T>(path, { method: "POST", body: JSON.stringify(body), headers: { Prefer: prefer } });
  const patch = <T>(path: string, body: unknown) => rest<T>(path, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=representation" } });
  const chunks = <T>(a: T[], n = 100): T[][] => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
  async function byIds<T>(table: string, col: string, ids: string[], select = "*", extra = ""): Promise<T[]> {
    const out: T[] = [];
    for (const c of chunks([...new Set(ids)])) if (c.length) out.push(...await get<T[]>(`${table}?${col}=in.${enc(inList(c))}&select=${select}${extra}`));
    return out;
  }
  const num = (v: unknown) => (v == null ? v : Number(v));
  const settingsRow = (r: Record<string, unknown>): Settings => ({
    ...DEFAULT_SETTINGS, ...r,
    price_estimate_eur: Number(r.price_estimate_eur ?? DEFAULT_SETTINGS.price_estimate_eur),
    max_price_per_letter: Number(r.max_price_per_letter ?? DEFAULT_SETTINGS.max_price_per_letter),
    vat_rate: Number(r.vat_rate ?? DEFAULT_SETTINGS.vat_rate),
    pingen_price: num(r.pingen_price) as number | null,
  } as Settings);
  const letterRow = (r: Letter): Letter => ({ ...r, pingen_price: num(r.pingen_price) as number | null });

  return {
    async getSettings() {
      const rows = await get<Record<string, unknown>[]>("letter_settings?id=eq.1&select=*");
      if (!rows.length) throw new Error("letter_settings row 1 is missing (apply 20261117_letters.sql)");
      return settingsRow(rows[0]);
    },
    async updateSettings(p) {
      const rows = await patch<Record<string, unknown>[]>("letter_settings?id=eq.1", p);
      return settingsRow(rows[0]);
    },

    async listRecipients({ activeOnly, kind }) {
      return await get<Recipient[]>(`letter_recipients?select=*${activeOnly ? "&active=is.true" : ""}${kind ? `&kind=eq.${kind}` : ""}&order=display_name.asc&limit=5000`);
    },
    async getRecipients(ids) { return await byIds<Recipient>("letter_recipients", "id", ids); },
    async insertRecipients(rows) {
      const out: Recipient[] = [];
      for (const c of chunks(rows, 200)) out.push(...await post<Recipient[]>("letter_recipients", c));
      return out;
    },
    async deactivateRecipients({ kind, partner_ids }) {
      if (partner_ids) {
        let n = 0;
        for (const c of chunks(partner_ids)) if (c.length) n += (await patch<unknown[]>(`letter_recipients?active=is.true&partner_id=in.${enc(inList(c))}`, { active: false })).length;
        return n;
      }
      return (await patch<unknown[]>(`letter_recipients?active=is.true${kind ? `&kind=eq.${kind}` : ""}`, { active: false })).length;
    },
    async updateRecipient(id, p) { await patch(`letter_recipients?id=eq.${enc(id)}`, p); },

    async getPartners(ids) { return await byIds<Partner>("partners", "id", ids, PARTNER_COLS); },
    async countPartnersWithSlug(slug) { return (await get<unknown[]>(`partners?slug=eq.${enc(slug)}&select=id&limit=3`)).length; },
    async setPartnerOptedOut(id, at) {
      const rows = await patch<Partner[]>(`partners?id=eq.${enc(id)}&opted_out_at=is.null&select=${PARTNER_COLS}`, { opted_out_at: at });
      if (rows.length) return rows[0];
      return (await get<Partner[]>(`partners?id=eq.${enc(id)}&select=${PARTNER_COLS}`))[0] ?? null;
    },

    async listCampaigns() { return await get<Campaign[]>("letter_campaigns?select=*&order=created_at.desc&limit=200"); },
    async getCampaign(id) { return (await get<Campaign[]>(`letter_campaigns?id=eq.${enc(id)}&select=*`))[0] ?? null; },
    async insertCampaign(row) { return (await post<Campaign[]>("letter_campaigns", row))[0]; },
    async updateCampaign(id, p, expectedVersion) {
      const cond = expectedVersion === undefined ? "" : `&template_version=eq.${Number(expectedVersion)}`;
      return (await patch<Campaign[]>(`letter_campaigns?id=eq.${enc(id)}${cond}`, p))[0] ?? null;
    },

    async listLetters(f: LetterFilter) {
      const q: string[] = ["select=*"];
      if (f.campaign_id) q.push(`campaign_id=eq.${enc(f.campaign_id)}`);
      if (f.statuses) q.push(`status=in.${enc(`(${f.statuses.join(",")})`)}`);
      q.push("order=created_at.asc");
      q.push(`limit=${f.limit ?? 5000}`);
      if (f.ids || f.partner_ids) {
        const col = f.ids ? "id" : "partner_id";
        const ids = (f.ids ?? f.partner_ids)!;
        const out: Letter[] = [];
        for (const c of chunks(ids)) if (c.length) out.push(...await get<Letter[]>(`letters?${col}=in.${enc(inList(c))}&${q.join("&")}`));
        return out.map(letterRow);
      }
      return (await get<Letter[]>(`letters?${q.join("&")}`)).map(letterRow);
    },
    async getLetter(id) { const r = (await get<Letter[]>(`letters?id=eq.${enc(id)}&select=*`))[0]; return r ? letterRow(r) : null; },
    async insertLetters(rows) { return (await post<Letter[]>("letters", rows)).map(letterRow); },
    async updateLetter(id, p, expectStatus) {
      const st = expectStatus === undefined ? "" : Array.isArray(expectStatus) ? `&status=in.${enc(`(${expectStatus.join(",")})`)}` : `&status=eq.${enc(expectStatus)}`;
      const r = (await patch<Letter[]>(`letters?id=eq.${enc(id)}${st}`, p))[0];
      return r ? letterRow(r) : null;
    },
    async findLetterByPingenId(pid) { const r = (await get<Letter[]>(`letters?pingen_letter_id=eq.${enc(pid)}&select=*&limit=1`))[0]; return r ? letterRow(r) : null; },
    async findLetterByRef(ref) { const r = (await get<Letter[]>(`letters?ref_code=eq.${enc(ref)}&select=*&limit=1`))[0]; return r ? letterRow(r) : null; },
    async refCodesTaken(codes) { return (await byIds<{ ref_code: string }>("letters", "ref_code", codes, "ref_code")).map((r) => r.ref_code); },
    async countSubmittedSince(iso) { return (await get<unknown[]>(`letters?submitted_at=gte.${enc(iso)}&select=id&limit=1000`)).length; },

    async insertEvent(e: LetterEvent) {
      try {
        await rest("letter_events", { method: "POST", body: JSON.stringify(e), headers: { Prefer: "return=minimal" } }, true);
        return true;
      } catch (err) {
        if ((err as { status?: number }).status === 409 && e.pingen_event_id) return false;
        throw err;
      }
    },
    async listEvents({ campaign_id, letter_id, limit }) {
      const q = ["select=*", "order=id.desc", `limit=${limit}`];
      if (campaign_id) q.push(`campaign_id=eq.${enc(campaign_id)}`);
      if (letter_id) q.push(`letter_id=eq.${enc(letter_id)}`);
      return await get<LetterEvent[]>(`letter_events?${q.join("&")}`);
    },

    async insertOptout(row) { return (await post<Optout[]>("letter_optouts", row))[0]; },
    async listOptouts(limit) { return await get<Optout[]>(`letter_optouts?select=*&order=created_at.desc&limit=${limit}`); },
    async getOptout(id) { return (await get<Optout[]>(`letter_optouts?id=eq.${enc(id)}&select=*`))[0] ?? null; },
    async updateOptout(id, p) { await patch(`letter_optouts?id=eq.${enc(id)}`, p); },

    async rateHit(actor, kind, windowS, limit) {
      return !!(await post<boolean>("rpc/letters_rate_hit", { p_actor: actor, p_kind: kind, p_window_s: windowS, p_limit: limit }, "return=representation"));
    },
    async ratePeek(actor, kind, windowS) {
      return Number(await post<number>("rpc/letters_rate_peek", { p_actor: actor, p_kind: kind, p_window_s: windowS }, "return=representation")) || 0;
    },

    async putPdf(path, bytes) {
      const r = await o.fetch(`${o.url}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST", body: bytes, headers: { apikey: o.serviceKey, Authorization: `Bearer ${o.serviceKey}`, "Content-Type": "application/pdf", "x-upsert": "true", "Cache-Control": "no-store" },
      });
      if (!r.ok) throw new Error(`storage upload ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
    },
    async getPdf(path) {
      const r = await o.fetch(`${o.url}/storage/v1/object/authenticated/${BUCKET}/${path}`, { headers: { apikey: o.serviceKey, Authorization: `Bearer ${o.serviceKey}` } });
      if (r.status === 404 || r.status === 400) return null;
      if (!r.ok) throw new Error(`storage read ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    },
    async deletePdf(path) {
      await o.fetch(`${o.url}/storage/v1/object/${BUCKET}`, { method: "DELETE", body: JSON.stringify({ prefixes: [path] }), headers: { apikey: o.serviceKey, Authorization: `Bearer ${o.serviceKey}`, "Content-Type": "application/json" } });
    },

    async funnelStats(partnerIds, since) {
      const views = await get<{ meta: { partner_id?: string } | null }[]>(`funnel_events?event=eq.socios_view&created_at=gte.${enc(since)}&select=meta&limit=10000`);
      const signups = await byIds<{ partner_id: string }>("studio_signups", "partner_id", partnerIds, "partner_id", `&created_at=gte.${enc(since)}`);
      return partnerIds.map((pid) => ({
        partner_id: pid,
        opened: views.filter((v) => v.meta?.partner_id === pid).length,
        signed_up: signups.filter((s) => s.partner_id === pid).length,
      }));
    },
  };
}
