"""
HTML email template builder for Ampere Creative Group form submission notifications.
"""
from datetime import datetime
from typing import Any


def build_form_submission_email(
    name: str,
    email: str,
    phone: str,
    service_name: str,
    sub_service_name: str | None,
    form_id: str,
    fields: dict[str, Any],
    message: str,
    submission_id: str,
    timestamp: str,
) -> tuple[str, str]:
    """
    Returns (subject, html_body) for a form submission notification email.
    """
    subject = f"New inquiry: {service_name}{f' / {sub_service_name}' if sub_service_name else ''} — {name}"

    service_display = service_name
    if sub_service_name:
        service_display = f"{service_name} › {sub_service_name}"

    # Build the field rows HTML
    field_rows = ""
    if fields:
        for key, value in fields.items():
            if key in ("name", "email", "phone", "message"):
                continue  # Already shown above
            label = key.replace("_", " ").replace("-", " ").title()
            field_rows += f"""
            <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
                           font-size: 13px; color: #64748b; width: 40%; vertical-align: top;">{label}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;
                           font-size: 13px; color: #1e293b; vertical-align: top;">{value}</td>
            </tr>"""

    message_section = ""
    if message and message.strip():
        message_section = f"""
        <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;
                    border-left: 4px solid #3b82f6;">
            <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #475569;">Message</p>
            <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.6;">{message}</p>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
             background: #f1f5f9; margin: 0; padding: 32px 16px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px;
              overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px 32px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 36px; height: 36px; background: rgba(255,255,255,0.2); border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-weight: bold; font-size: 16px;">A</span>
        </div>
        <div>
          <h1 style="margin: 0; color: white; font-size: 18px; font-weight: 700;">New Lead</h1>
          <p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 13px;">Ampere Creative Group</p>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding: 28px 32px;">

      <!-- Service badge -->
      <div style="display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 4px 12px;
                  border-radius: 99px; font-size: 12px; font-weight: 600; margin-bottom: 20px;">
        {service_display}
      </div>

      <!-- Contact info -->
      <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden;
                    border: 1px solid #e2e8f0; margin-bottom: 8px;">
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
                     font-size: 13px; color: #64748b; width: 40%;">Name</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;
                     font-size: 14px; color: #1e293b; font-weight: 600;">{name}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
                     font-size: 13px; color: #64748b;">Email</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">
            <a href="mailto:{email}" style="color: #3b82f6; text-decoration: none;">{email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
                     font-size: 13px; color: #64748b;">Phone</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;
                     font-size: 13px; color: #1e293b;">{phone or 'Not provided'}</td>
        </tr>
        {field_rows}
      </table>

      {message_section}

      <!-- Metadata -->
      <div style="margin-top: 24px; padding: 12px 16px; background: #f8fafc; border-radius: 8px;
                  display: flex; gap: 24px;">
        <div>
          <p style="margin: 0 0 2px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Submission ID</p>
          <p style="margin: 0; font-size: 12px; color: #475569; font-family: monospace;">{submission_id[:8]}</p>
        </div>
        <div>
          <p style="margin: 0 0 2px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Received</p>
          <p style="margin: 0; font-size: 12px; color: #475569;">{timestamp}</p>
        </div>
        <div>
          <p style="margin: 0 0 2px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Form</p>
          <p style="margin: 0; font-size: 12px; color: #475569; font-family: monospace;">{form_id}</p>
        </div>
      </div>

      <!-- Quick actions -->
      <div style="margin-top: 24px; display: flex; gap: 12px;">
        <a href="mailto:{email}?subject=Re: Your inquiry with Ampere Creative Group"
           style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px;
                  border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none;">
          Reply to {name.split()[0]}
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
        Ampere Creative Group · Bloomfield, IA, USA · amperecreativegroup.com
      </p>
    </div>
  </div>
</body>
</html>"""

    return subject, html
