import { describe, it, expect } from "vitest";
import en from "../en.json";
import es from "../es.json";
import fr from "../fr.json";
import de from "../de.json";
import itIT from "../it.json";
import pt from "../pt.json";
import zh from "../zh.json";

// Message bodies that are SENT TO a Spanish-speaking studio must stay in Spanish
// in every locale file. Translating them silently breaks the WhatsApp handoff.
const PROTECTED_PATHS = ["app.payment.confirmed.whatsapp.message"];

const get = (obj: unknown, path: string) =>
  path.split(".").reduce<any>((acc, k) => (acc == null ? acc : acc[k]), obj);

const LOCALES: Record<string, unknown> = { es, fr, de, it: itIT, pt, zh };

describe("WhatsApp message bodies stay Spanish", () => {
  for (const path of PROTECTED_PATHS) {
    const source = get(es, path) as string;
    for (const [code, bundle] of Object.entries(LOCALES)) {
      it(`${code}: ${path}`, () => {
        expect(get(bundle, path)).toBe(source);
      });
    }
  }

  it("every locale has full key parity with en.json", () => {
    const flat = (o: any, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object" && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`],
      );
    const base = flat(en).sort();
    for (const [code, bundle] of Object.entries(LOCALES)) {
      expect(flat(bundle).sort(), code).toEqual(base);
    }
  });
});
