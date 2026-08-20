import { describe, it, expect } from "vitest";
import { spanishLanguageOffer, spanishLanguageList, speaksSpanish } from "@/lib/spokenLanguages";
describe("spoken", () => {
  it("one", () => expect(spanishLanguageOffer(["en"])).toBe("Si habláis inglés, decídmelo y sigo en inglés."));
  it("two", () => expect(spanishLanguageOffer(["en","de"])).toBe("Si habláis inglés o alemán, decídmelo y sigo en ese idioma."));
  it("three", () => expect(spanishLanguageList(["en","de","fr"])).toBe("inglés, alemán o francés"));
  it("es", () => { expect(spanishLanguageOffer(["es","de"])).toBe(""); expect(speaksSpanish(["es"])).toBe(true); });
});
