import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/siteVisit", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/flowLang", () => ({ useFlowLang: () => "en" }));
const withdraw = vi.fn();
vi.mock("@/lib/marketingOptIn", async (orig) => {
  const real = await orig<typeof import("@/lib/marketingOptIn")>();
  return { ...real, withdrawConsent: (...a: unknown[]) => withdraw(...a) };
});

import Unsubscribe, { UNSUBSCRIBE_COPY, maskContact } from "@/pages/Unsubscribe";

const SIG = "0123456789abcdef0123456789abcdef";
const at = (q: string) => window.history.replaceState({}, "", `/unsubscribe${q}`);

describe("/unsubscribe", () => {
  beforeEach(() => withdraw.mockReset());
  afterEach(() => at(""));

  it("does nothing on load: one button, and only a tap withdraws", async () => {
    withdraw.mockResolvedValueOnce({ ok: true });
    at(`?u=someone%40example.com&s=${SIG}`);
    render(<Unsubscribe />);
    expect(withdraw).not.toHaveBeenCalled();
    expect(screen.getByText("For s•••@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop offers" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(UNSUBSCRIBE_COPY.en.done));
    expect(withdraw).toHaveBeenCalledWith("someone@example.com", SIG, { lang: "en", wording: UNSUBSCRIBE_COPY.en.body });
  });

  it("Spanish with ?lang=es", () => {
    at(`?u=34600000000&s=${SIG}&lang=es`);
    render(<Unsubscribe />);
    expect(screen.getByRole("button", { name: "Dejar de recibir ofertas" })).toBeInTheDocument();
  });

  it("a link without a valid signature says how else to stop, with no button", () => {
    at("?u=someone%40example.com&s=nope");
    render(<Unsubscribe />);
    expect(screen.getByRole("alert")).toHaveTextContent(UNSUBSCRIBE_COPY.en.broken);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a refused signature is a broken link; a server failure keeps the button and says so", async () => {
    at(`?u=someone%40example.com&s=${SIG}`);
    withdraw.mockResolvedValueOnce({ ok: false, error: "http_403" });
    const { unmount } = render(<Unsubscribe />);
    fireEvent.click(screen.getByRole("button", { name: "Stop offers" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNSUBSCRIBE_COPY.en.broken));
    unmount();
    withdraw.mockResolvedValueOnce({ ok: false, error: "http_500" });
    render(<Unsubscribe />);
    fireEvent.click(screen.getByRole("button", { name: "Stop offers" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNSUBSCRIBE_COPY.en.failed));
    expect(screen.getByRole("button", { name: "Stop offers" })).toBeEnabled();
    expect(screen.queryByText(/^Done/)).toBeNull();
  });

  it("masks the contact", () => {
    expect(maskContact("jane@gmail.com")).toBe("j•••@gmail.com");
    expect(maskContact("34600123456")).toBe("•••••••3456");
    expect(maskContact("")).toBe("");
  });
});
