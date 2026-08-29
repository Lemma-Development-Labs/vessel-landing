import { Resend } from "resend";
import { config } from "./config.js";

const resend = config.resendConfigured ? new Resend(config.resendApiKey) : null;

const TESTNET = "https://testnet.vessel.wtf";
const X_URL = "https://x.com/vessel_hq";
const TG_URL = "https://t.me/+Akd24ACXWl5lY2E1";

export function subjectFor(n: number): string {
  return `You're crew member #${n} — Vessel`;
}

export function textBody(n: number): string {
  return [
    "Aboard.",
    "",
    `You are crew member #${n}.`,
    "",
    "We will notify you when we launch.",
    "",
    `Try us on testnet: ${TESTNET}`,
    "",
    `Follow us on X: ${X_URL}`,
    "",
    "Join the Vessel Telegram group for support and feedback:",
    TG_URL,
    "",
    "Vessel is experimental software on testnet. Not an offer, solicitation, or financial advice. Unaudited.",
    "",
    "— Vessel",
  ].join("\n");
}

/** Simple, image-free HTML on the brand's ink ground. */
export function htmlBody(n: number): string {
  const p = "margin:0 0 18px;";
  const a = "color:#836EF9;text-decoration:none;";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#070B10;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#070B10;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#EAEEF3;">
          <p style="${p}">Aboard.</p>
          <p style="${p}">You are crew member #${n}.</p>
          <p style="${p}">We will notify you when we launch.</p>
          <p style="${p}">Try us on testnet: <a href="${TESTNET}" style="${a}">${TESTNET}</a></p>
          <p style="${p}">Follow us on X: <a href="${X_URL}" style="${a}">${X_URL}</a></p>
          <p style="${p}">Join the Vessel Telegram group for support and feedback:<br>
            <a href="${TG_URL}" style="${a}">${TG_URL}</a></p>
          <p style="${p}font-size:13px;color:#8FA6BC;">Vessel is experimental software on testnet. Not an offer, solicitation, or financial advice. Unaudited.</p>
          <p style="margin:0;">— Vessel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Never throws. A mail failure must not fail a signup, so the caller gets a
 * boolean and the row stays committed either way.
 */
export async function sendWelcome(
  to: string,
  n: number,
  log: { info: (o: object, m?: string) => void; error: (o: object, m?: string) => void },
): Promise<boolean> {
  if (!resend) {
    log.info({ reason: "resend_not_configured" }, "welcome mail skipped");
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: config.resendFrom,
      to,
      subject: subjectFor(n),
      text: textBody(n),
      html: htmlBody(n),
    });
    if (error) {
      // Log the provider's reason, never the recipient.
      log.error({ reason: error.message ?? String(error) }, "welcome mail failed");
      return false;
    }
    log.info({ crewNumber: n }, "welcome mail sent");
    return true;
  } catch (err) {
    log.error({ reason: err instanceof Error ? err.message : "unknown" }, "welcome mail threw");
    return false;
  }
}
