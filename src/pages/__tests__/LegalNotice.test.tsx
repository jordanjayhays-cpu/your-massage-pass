import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flowLang", () => ({ useFlowLang: () => "en" }));

import LegalNotice from "@/pages/LegalNotice";

// LSSI art. 10.1: name, address, email and registration of the provider.
describe("/legal", () => {
  it("names Kinsol LLC, its address, registration and email, in both languages, with no placeholder", () => {
    const { container } = render(<LegalNotice />);
    for (const re of [/Kinsol LLC/, /Massage Club/, /State of Colorado/, /1500 N Grant St, Ste N, Denver, CO 80203, United States/, /support@massageclub\.io/]) {
      expect(container.textContent, String(re)).toMatch(re);
    }
    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(container.textContent).toMatch(/Aviso legal/);
    expect(container.textContent).toMatch(/estado de Colorado/);
    expect(container.textContent).toMatch(/Estados Unidos/);
    expect(container.textContent).not.toMatch(/\[[^\]]*\]/);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") || "");
    for (const h of hrefs) expect(h.startsWith("/") || h === "mailto:support@massageclub.io", h).toBe(true);
  });
});
