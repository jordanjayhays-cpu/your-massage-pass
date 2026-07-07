import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Massage Club <support@massageclub.io>";
const FOUNDER_EMAIL = "jordan.hays@student.ie.edu";
// Where the survey lives, for building the follow-up "continue" link.
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://your-massage-pass-o5fo.vercel.app";

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend error", res.status, body);
  }
  return res;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const payload = await req.json();
    const r = payload.record ?? payload ?? {};
    const followup = payload.followup ?? null;
    const kind = r.survey_type === "b2b" ? "Studio (B2B)" : "Customer (B2C)";
    const answers = r.answers ?? {};

    // ---------- 1. Notify the founder ----------
    const rows = Object.entries(answers)
      .filter(([k]) => k !== "comments")
      .map(
        ([k, v]) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #EFE7DD;color:#7A7068;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;vertical-align:top;">${k}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #EFE7DD;color:#211C1A;font-size:14px;">${
              Array.isArray(v) ? v.join(", ") : String(v)
            }</td>
          </tr>`
      )
      .join("");

    const comments = answers.comments
      ? `<p style="margin:16px 0;padding:12px 14px;background:#F7F4F0;border-left:3px solid #C4622D;color:#211C1A;font-size:14px;"><strong>Comment:</strong> ${answers.comments}</p>`
      : "";
    const emailLine = r.email
      ? `<p style="margin:8px 0;color:#211C1A;font-size:14px;"><strong>Contact:</strong> ${r.email}</p>`
      : "";
    const contact = r.contact
      ? `<p style="margin:8px 0;color:#211C1A;font-size:14px;"><strong>Contact:</strong> ${r.contact}</p>`
      : "";
    const src = r.source
      ? `<p style="margin:8px 0;color:#7A7068;font-size:13px;"><strong>Source:</strong> ${r.source}</p>`
      : "";
    const wave = r.wave
      ? `<p style="margin:8px 0;color:#7A7068;font-size:13px;"><strong>Round:</strong> ${r.wave}</p>`
      : "";

    const founderHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F7F4F0;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:28px;">
          <h1 style="font-family:Georgia,serif;color:#211C1A;font-size:24px;margin:0 0 8px;">New ${kind} survey response 🎉</h1>
          <p style="color:#7A7068;font-size:13px;margin:0 0 20px;">Fresh from the validation funnel.</p>
          <table style="width:100%;border-collapse:collapse;">${rows}</table>
          ${comments}
          ${emailLine}${contact}${src}${wave}
          <p style="margin-top:24px;"><a href="${SITE_URL}/founder" style="display:inline-block;background:#C4622D;color:#F7F4F0;padding:10px 18px;border-radius:999px;text-decoration:none;font-size:14px;">Open founder dashboard →</a></p>
        </div>
      </div>`;

    await sendEmail(FOUNDER_EMAIL, `New ${kind} survey response`, founderHtml);

    // ---------- 2. Email the respondent their next round (if requested) ----------
    if (followup && followup.email && followup.respondent_id && followup.next_wave) {
      const link = `${SITE_URL}/survey/customers?rid=${encodeURIComponent(followup.respondent_id)}&wave=${followup.next_wave}`;
      const followupHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F7F4F0;padding:24px;">
          <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:28px;text-align:center;">
            <h1 style="font-family:Georgia,serif;color:#211C1A;font-size:24px;margin:0 0 10px;">Thanks — one more quick round? 🙏</h1>
            <p style="color:#7A7068;font-size:15px;line-height:1.5;margin:0 0 22px;">You finished round 1 of our Madrid massage survey. The next round takes under a minute and really helps us build something you'll love.</p>
            <a href="${link}" style="display:inline-block;background:#C4622D;color:#F7F4F0;padding:14px 28px;border-radius:999px;text-decoration:none;font-size:16px;font-weight:600;">Continue the survey →</a>
            <p style="color:#9E9387;font-size:12px;margin:22px 0 0;">Massage Club · Madrid</p>
          </div>
        </div>`;
      await sendEmail(followup.email, "Quick favour — round 2 of your massage survey", followupHtml);
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
