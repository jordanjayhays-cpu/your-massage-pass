import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EMAIL_TYPOS, emailTypoFix } from "../emailTypo";

describe("emailTypoFix", () => {
  it("fixes common domain typos", () => {
    expect(emailTypoFix("ana@gmial.com")).toBe("ana@gmail.com");
    expect(emailTypoFix(" Ana@Hotmial.com ")).toBe("ana@hotmail.com");
    expect(emailTypoFix("ana@outlok.com")).toBe("ana@outlook.com");
    expect(emailTypoFix("ana@icloud.con")).toBe("ana@icloud.com");
    expect(emailTypoFix("ana@empresa.con")).toBe("ana@empresa.com");
  });

  it("leaves good and unknown addresses alone", () => {
    expect(emailTypoFix("ana@gmail.com")).toBeNull();
    expect(emailTypoFix("ana@student.ie.edu")).toBeNull();
    expect(emailTypoFix("ana@empresa.es")).toBeNull();
    expect(emailTypoFix("not an email")).toBeNull();
    expect(emailTypoFix("")).toBeNull();
  });

  it("matches the map in public/go.html", () => {
    const html = readFileSync(resolve(__dirname, "../../../public/go.html"), "utf8");
    const m = html.match(/const TYPO = (\{[^}]*\});/);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1])).toEqual(EMAIL_TYPOS);
  });
});
