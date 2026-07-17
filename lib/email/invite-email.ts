import { sendEmail } from "@/lib/email/ses"

export interface SendInviteEmailParams {
  to: string
  temporaryPassword: string
  loginUrl: string
  clientName?: string
}

export async function sendInviteEmail({
  to,
  temporaryPassword,
  loginUrl,
  clientName,
}: SendInviteEmailParams): Promise<void> {
  const workspaceLabel = clientName
    ? `${clientName} on Ampere Studio`
    : "Ampere Studio"

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your Ampere Studio invite</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#111111;padding:24px 32px;">
            <span style="font-size:18px;font-weight:700;color:#ffffff;">Ampere Studio</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#333333;line-height:1.6;">
            <p style="margin:0 0 16px;font-size:16px;">You have been invited to ${workspaceLabel}.</p>
            <p style="margin:0 0 16px;font-size:15px;">Sign in with the temporary credentials below. You will be asked to set a new password on your first login.</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;background:#f9f9f9;border-radius:6px;border:1px solid #e5e5e5;">
              <tr>
                <td style="padding:16px 20px;font-size:14px;">
                  <p style="margin:0 0 8px;"><strong>Email:</strong> ${to}</p>
                  <p style="margin:0;"><strong>Temporary password:</strong> <code style="font-family:monospace;font-size:14px;">${temporaryPassword}</code></p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;">
              <a href="${loginUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:15px;">Sign in to Ampere Studio</a>
            </p>
            <p style="margin:0;font-size:13px;color:#666666;">This temporary password expires in 7 days. If you did not expect this invite, you can ignore this email.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  await sendEmail({
    to,
    subject: "Your Ampere Studio invite",
    html,
  })
}

const DEFAULT_STUDIO_URL = "https://studio.amperesites.com"

export function resolveLoginUrl(): string {
  const envUrl = process.env.AMPERE_STUDIO_URL?.trim()
  const base = envUrl ? envUrl.replace(/\/$/, "") : DEFAULT_STUDIO_URL
  return `${base}/login`
}
