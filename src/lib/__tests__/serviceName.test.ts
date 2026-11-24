import { describe, it, expect } from "vitest";
import {
  servicePrimaryName,
  serviceSecondaryName,
  serviceNameForStudio,
  serviceInlineLabel,
} from "../serviceName";

const svc = { name: "Masaje descontracturante", name_en: "Deep tissue massage" };
const spanishOnly = { name: "Masaje tailandés", name_en: null };

describe("service naming", () => {
  it("shows English first, Spanish underneath", () => {
    expect(servicePrimaryName(svc)).toBe("Deep tissue massage");
    expect(serviceSecondaryName(svc)).toBe("Masaje descontracturante");
  });

  it("falls back to Spanish alone when name_en is null", () => {
    expect(servicePrimaryName(spanishOnly)).toBe("Masaje tailandés");
    expect(serviceSecondaryName(spanishOnly)).toBe("");
  });

  it("NEVER sends the English name to the studio", () => {
    expect(serviceNameForStudio(svc)).toBe("Masaje descontracturante");
    expect(serviceNameForStudio(spanishOnly)).toBe("Masaje tailandés");
  });

  it("inline label carries both", () => {
    expect(serviceInlineLabel(svc)).toBe("Deep tissue massage (Masaje descontracturante)");
    expect(serviceInlineLabel(spanishOnly)).toBe("Masaje tailandés");
  });
});
