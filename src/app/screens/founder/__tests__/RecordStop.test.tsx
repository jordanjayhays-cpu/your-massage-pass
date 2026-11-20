import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const stop = vi.fn();
vi.mock("@/lib/marketingOptIn", () => ({ stopByContact: (...a: unknown[]) => stop(...a) }));

import RecordStop from "@/app/screens/founder/RecordStop";

describe("founder: record a stop that came by email", () => {
  it("needs the address and their words, then saves both through the typed stop", async () => {
    stop.mockResolvedValueOnce({ ok: true });
    render(<RecordStop />);
    fireEvent.click(screen.getByRole("button", { name: "Record stop" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(stop).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Email or phone"), { target: { value: "someone@mail.es" } });
    fireEvent.change(screen.getByLabelText("Their words"), { target: { value: "please stop" } });
    fireEvent.click(screen.getByRole("button", { name: "Record stop" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Saved/));
    expect(stop).toHaveBeenCalledWith("someone@mail.es", { lang: "en", wording: 'Written to support@massageclub.io: "please stop"' });
  });

  it("a failure says so and how to do it by hand, never Saved", async () => {
    stop.mockResolvedValueOnce({ ok: false, error: "http_500" });
    render(<RecordStop />);
    fireEvent.change(screen.getByLabelText("Email or phone"), { target: { value: "+34 612 345 678" } });
    fireEvent.change(screen.getByLabelText("Their words"), { target: { value: "baja" } });
    fireEvent.click(screen.getByRole("button", { name: "Record stop" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Not saved \(http_500\)/));
    expect(screen.queryByText(/^Saved/)).toBeNull();
  });
});
