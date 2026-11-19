import { describe, expect, it } from "vitest";
import { indexStatus, isTestAddress, personAnswer } from "@/lib/offersStatus";

const st = indexStatus([
  { kind: "email", contact: "ana@mail.es", action: "yes", source: "go_page" },
  { kind: "phone", contact: "34611111111", action: "withdraw", source: "unsubscribe" },
  { kind: "email", contact: "bea@mail.es", action: "yes", source: "studio_booking" },
  { kind: "phone", contact: "34622222222", action: "yes", source: "studio_booking" },
  { kind: "email", contact: "cris@mail.es", action: "yes", source: "quiz" },
  { kind: "email", contact: "dani@mail.es", action: "no", source: "go_page" },
  { kind: "email", contact: "eva@mail.es", action: "yes", source: "review_page" },
  { kind: "email", contact: "jordan@massageclub.io", action: "yes", source: "go_page" },
]);

describe("who may get a promotion (dashboard and CSV)", () => {
  it("an email yes with a phone that sent STOP shows withdraw, never yes", () => {
    expect(personAnswer({ emails: ["Ana@Mail.es"], phones: ["+34 611 111 111"] }, st)).toBe("withdraw");
  });
  it("yes only when every address reads a verified yes", () => {
    expect(personAnswer({ emails: ["bea@mail.es"], phones: ["+34622222222"] }, st)).toBe("yes");
    expect(personAnswer({ emails: ["eva@mail.es"], phones: [null] }, st)).toBe("yes");
  });
  it("a yes on one address and nothing on another is not a yes", () => {
    expect(personAnswer({ emails: ["eva@mail.es"], phones: ["34633333333"] }, st)).toBe("partly answered");
  });
  it("a quiz yes is recorded but does not count; a signed-in profile yes does", () => {
    expect(personAnswer({ emails: ["cris@mail.es"] }, st)).toBe("unconfirmed yes");
    expect(personAnswer({ emails: ["fer@mail.es"] }, indexStatus([{ kind: "email", contact: "fer@mail.es", action: "yes", source: "profile" }]))).toBe("yes");
  });
  it("no, not answered, unknown, test contact", () => {
    expect(personAnswer({ emails: ["dani@mail.es"] }, st)).toBe("no");
    expect(personAnswer({ emails: ["nobody@mail.es"] }, st)).toBe("not answered");
    expect(personAnswer({ emails: ["bea@mail.es"] }, null)).toBe("unknown");
    expect(personAnswer({ emails: ["jordan@massageclub.io"] }, st)).toBe("test contact");
  });
  it("knows the CLAUDE.md test contacts", () => {
    expect(isTestAddress("email", "someone+mctest@gmail.com")).toBe(true);
    expect(isTestAddress("email", "a@example.com")).toBe(true);
    expect(isTestAddress("phone", "8613800000997")).toBe(true);
    expect(isTestAddress("phone", "17867276503")).toBe(true);
    expect(isTestAddress("email", "ana@mail.es")).toBe(false);
  });
});
