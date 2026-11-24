import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/siteVisit", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/flowLang", () => ({ useFlowLang: () => "en" }));
const withdraw = vi.fn();
const stopTyped = vi.fn();
vi.mock("@/lib/marketingOptIn", async (orig) => {
  const real = await orig<typeof import("@/lib/marketingOptIn")>();
  return {
    ...real,
    withdrawConsent: (...a: unknown[]) => withdraw(...a),
    stopByContact: (...a: unknown[]) => stopTyped(...a),
  };
});

import Unsubscribe, { UNSUBSCRIBE_COPY, maskContact } from "@/pages/Unsubscribe";

const SIG = "0123456789abcdef0123456789abcdef";
const at = (q: string) => window.history.replaceState({}, "", `/unsubscribe${q}`);

describe("/unsubscribe", () => {
  beforeEach(() => { withdraw.mockReset(); stopTyped.mockReset(); });
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

  it("strips the link from the address bar at once, so no tag, log or history keeps it", () => {
    at(`?u=someone%40example.com&s=${SIG}&lang=es`);
    render(<Unsubscribe />);
    expect(window.location.search).toBe("?lang=es");
    expect(window.location.href).not.toMatch(/someone|0123456789abcdef/);
  });

  it("reads the link from the fragment too, and a sealed token shows no address", async () => {
    withdraw.mockResolvedValueOnce({ ok: true });
    const token = "z" + "abcdefghijklmnop".repeat(4);
    at(`#u=${token}&s=${SIG}`);
    render(<Unsubscribe />);
    expect(window.location.hash).toBe("");
    expect(screen.queryByText(/^For /)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop offers" }));
    await waitFor(() => expect(withdraw).toHaveBeenCalledWith(token, SIG, expect.anything()));
  });

  it("Spanish with ?lang=es", () => {
    at(`?u=34600000000&s=${SIG}&lang=es`);
    render(<Unsubscribe />);
    expect(screen.getByRole("button", { name: "Dejar de recibir ofertas" })).toBeInTheDocument();
  });

  it("with no link, anyone can stop offers by typing their email or phone (GDPR art. 7.3)", async () => {
    stopTyped.mockResolvedValueOnce({ ok: true });
    at("");
    render(<Unsubscribe />);
    expect(screen.queryByRole("alert")).toBeNull();
    const field = screen.getByLabelText(UNSUBSCRIBE_COPY.en.formLabel);
    fireEvent.change(field, { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Stop offers" }));
    expect(screen.getByRole("alert")).toHaveTextContent(UNSUBSCRIBE_COPY.en.formErr);
    expect(stopTyped).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "Someone@Example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Stop offers" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(UNSUBSCRIBE_COPY.en.done));
    expect(stopTyped).toHaveBeenCalledWith("Someone@Example.com", { lang: "en", wording: UNSUBSCRIBE_COPY.en.formBody });
  });

  it("a typed stop that fails says to write to support, never Done", async () => {
    stopTyped.mockResolvedValueOnce({ ok: false, error: "http_400:action" });
    at("");
    render(<Unsubscribe />);
    fireEvent.change(screen.getByLabelText(UNSUBSCRIBE_COPY.en.formLabel), { target: { value: "+34 612 345 678" } });
    fireEvent.click(screen.getByRole("button", { name: "Stop offers" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNSUBSCRIBE_COPY.en.formFailed));
    expect(screen.queryByText(/^Done/)).toBeNull();
  });

  it("a link without a valid signature says so and offers the typed form", () => {
    at("?u=someone%40example.com&s=nope");
    render(<Unsubscribe />);
    expect(screen.getByRole("alert")).toHaveTextContent(UNSUBSCRIBE_COPY.en.broken);
    expect(screen.getByLabelText(UNSUBSCRIBE_COPY.en.formLabel)).toBeInTheDocument();
  });

  it("a refused signature falls back to the typed form; a server failure keeps the button and says so", async () => {
    at(`?u=someone%40example.com&s=${SIG}`);
    withdraw.mockResolvedValueOnce({ ok: false, error: "http_403:signature" });
    const { unmount } = render(<Unsubscribe />);
    fireEvent.click(screen.getByRole("button", { name: "Stop offers" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNSUBSCRIBE_COPY.en.broken));
    expect(screen.getByLabelText(UNSUBSCRIBE_COPY.en.formLabel)).toBeInTheDocument();
    unmount();
    at(`?u=someone%40example.com&s=${SIG}`);
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
    expect(maskContact("zabcdefghijklmnop")).toBe("");
    expect(maskContact("")).toBe("");
  });
});
