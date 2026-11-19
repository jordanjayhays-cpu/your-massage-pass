import { useState } from "react";
import { stopByContact } from "@/lib/marketingOptIn";

/**
 * Founder tool (19 Nov 2026): record a "stop sending me offers" that arrived
 * some other way, usually an email to support@massageclub.io (every notice
 * promises that address works). It goes through the consent function's typed
 * stop, the same as /unsubscribe without a link, so a withdraw row is written
 * for that address and every email or phone seen with it, with the person's
 * own words as the record (LSSI art. 22.1, GDPR art. 7.3). Answer them within
 * one month (GDPR art. 12.3).
 */
export default function RecordStop() {
  const [addr, setAddr] = useState("");
  const [words, setWords] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "ok" | "failed" | "bad">("idle");
  const [why, setWhy] = useState("");

  const save = async () => {
    if (state === "saving") return;
    const w = words.trim();
    if (!addr.trim() || !w) { setState("bad"); return; }
    setState("saving");
    const res = await stopByContact(addr, { lang: "en", wording: `Written to support@massageclub.io: "${w.slice(0, 1800)}"` });
    if (res.ok) { setState("ok"); setAddr(""); setWords(""); }
    else { setState(res.error === "bad_contact" ? "bad" : "failed"); setWhy(res.error || ""); }
  };

  return (
    <form
      className="mb-4 rounded-xl border border-[#E5DDD3] bg-white p-3 text-sm"
      onSubmit={(e) => { e.preventDefault(); void save(); }}
    >
      <p className="font-semibold text-[#3d2b1f]">Record a stop that came by email or phone</p>
      <p className="mt-1 text-xs text-[#7A7068]">Writes a withdraw for this address and every address seen with it. Paste their own words.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input
          value={addr}
          onChange={(e) => { setAddr(e.target.value); if (state !== "saving") setState("idle"); }}
          placeholder="email or phone with country code"
          aria-label="Email or phone"
          className="h-9 rounded-lg border border-gray-300 px-3"
        />
        <input
          value={words}
          onChange={(e) => { setWords(e.target.value); if (state !== "saving") setState("idle"); }}
          placeholder="what they wrote, e.g. please stop sending me offers"
          aria-label="Their words"
          className="h-9 rounded-lg border border-gray-300 px-3"
        />
        <button type="submit" disabled={state === "saving"} className="h-9 rounded-full px-4 font-semibold text-white disabled:opacity-60" style={{ background: "#C4622D" }}>
          {state === "saving" ? "Saving…" : "Record stop"}
        </button>
      </div>
      {state === "ok" && <p role="status" className="mt-2 text-xs font-semibold text-[#2F5E33]">Saved. They get no offers from now on, by email or WhatsApp.</p>}
      {state === "bad" && <p role="alert" className="mt-2 text-xs text-[#B03A2E]">Add a valid email or phone (with its country code) and their words.</p>}
      {state === "failed" && <p role="alert" className="mt-2 text-xs text-[#B03A2E]">Not saved ({why}). Add the withdraw row by hand: the SQL is in the consent function's header.</p>}
    </form>
  );
}
