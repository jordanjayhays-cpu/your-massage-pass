import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/siteVisit", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/flowLang", () => ({ useFlowLang: () => "en" }));
const save = vi.fn();
vi.mock("@/lib/marketingOptIn", async (orig) => {
  const real = await orig<typeof import("@/lib/marketingOptIn")>();
  return { ...real, saveConsent: (...a: unknown[]) => save(...a) };
});

import MarketingOptInCard, { ConsentQuestion } from "@/app/components/MarketingOptInCard";
import { CONSENT_COPY } from "@/lib/marketingOptIn";

describe("MarketingOptInCard", () => {
  beforeEach(() => save.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("shows the notice, a Privacy link and two equal buttons, none pressed", () => {
    render(<MarketingOptInCard source="profile" email="a@b.co" />);
    expect(screen.getByText(CONSENT_COPY.en.notice, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    const yes = screen.getByRole("button", { name: "Yes, send me offers" });
    const no = screen.getByRole("button", { name: "No thanks" });
    expect(yes).toHaveAttribute("aria-pressed", "false");
    expect(no).toHaveAttribute("aria-pressed", "false");
    expect(yes.className).toBe(no.className);
  });

  it("says Done only after the save answered ok", async () => {
    save.mockResolvedValueOnce({ ok: true });
    render(<MarketingOptInCard source="review_page" token="tok" lang="es" />);
    fireEvent.click(screen.getByRole("button", { name: "Sí, quiero ofertas" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(CONSENT_COPY.es.savedYes));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ choice: "yes", source: "review_page", lang: "es", token: "tok" }));
  });

  it("a failed save keeps the buttons and says so, and a second tap tries again", async () => {
    save.mockResolvedValueOnce({ ok: false, error: "http_500" }).mockResolvedValueOnce({ ok: true });
    render(<MarketingOptInCard source="profile" email="a@b.co" />);
    fireEvent.click(screen.getByRole("button", { name: "No thanks" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(CONSENT_COPY.en.error));
    expect(screen.queryByText(/^Done/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "No thanks" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(CONSENT_COPY.en.savedNo));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("renders nothing when there is no one to save the answer for", () => {
    const { container } = render(<MarketingOptInCard source="profile" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ConsentQuestion: a second tap on the chosen answer clears it", () => {
    const onChange = vi.fn();
    render(<ConsentQuestion lang="en" value="yes" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Yes, send me offers" }));
    expect(onChange).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(onChange).toHaveBeenCalledWith("no");
  });
});
