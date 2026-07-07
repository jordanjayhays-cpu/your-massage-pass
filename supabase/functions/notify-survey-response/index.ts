import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const payload = await req.json();
    const r = payload.record ?? payload ?? {};
    const kind = r.survey_type === "b2b" ? "Studio (B2B)" : "Customer (B2C)";
    const answers = r.answers ?? {};

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
    const email = r.email
      ? `<p style="margin:8px 0;color:#211C1A;font-size:14px;"><strong>Contact:</strong> ${r.email}</p>`
      : "";
    const contact = r.contact
      ? `<p style="margin:8px 0;color:#211C1A;font-size:14px;"><strong>Contact:</strong> ${r.contact}</p>`
      : "";
    const src = r.source
      ? `<p style="margin:8px 0;color:#7A7068;font-size:13px;"><strong>Source:</strong> ${r.source}</p>`
      : "";

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F7F4F0;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:28px;">
          <h1 style="font-family:Georgia,serif;color:#211C1A;font-size:24px;margin:0 0 8px;">New ${kind} survey response 🎉</h1>
          <p style="color:#7A7068;font-size:13px;margin:0 0 20px;">Fresh from the validation funnel.</p>
          <table style="width:100%;border-collapse:collapse;">${rows}</table>
          ${comments}
          ${email}${contact}${src}
          <p style="margin-top:24px;"><a href="https://massage-madrid-magic.lovable.app/founder" style="display:inline-block;background:#C4622D;color:#F7F4F0;padding:10px 18px;border-radius:999px;text-decoration:none;font-size:14px;">Open founder dashboard →</a></p>
        </div>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL") ?? "Massage Club <support@massageclub.io>",
        to: "jordan.hays@student.ie.edu",
        subject: `New ${kind} survey response`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error", res.status, body);
      return new Response(JSON.stringify({ error: body }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
