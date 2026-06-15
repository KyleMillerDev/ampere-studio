"""
Brand Kit Lambda Handler (Python 3.12)

Receives email + base64-encoded PNG overlays, packages them into a zip,
uploads to S3 as brand-kits/{email}.zip, generates a 7-day pre-signed
download link, and delivers it to the user via SES.

The S3 key pattern (brand-kits/{email}.zip) makes it trivial to find
lead email addresses just from the bucket's file listing.

Env vars:
  BRAND_KIT_BUCKET  — S3 bucket name (required)
  SENDER_EMAIL      — SES verified sender address
  ALLOWED_ORIGIN    — CORS origin (e.g. https://amperecreativegroup.com)
  AWS_REGION        — AWS region
"""

import base64
import io
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

# Allow shared/ imports both in SAM layout and flat zip layout
_root = os.path.dirname(os.path.abspath(__file__))
_shared_sibling = os.path.join(_root, "shared")
_shared_parent = os.path.normpath(os.path.join(_root, "..", "shared"))
if os.path.isdir(_shared_sibling):
    sys.path.insert(0, _shared_sibling)
else:
    sys.path.insert(0, _shared_parent)

S3_BUCKET = os.environ.get("BRAND_KIT_BUCKET", "ampere-public")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@amperecreativegroup.com")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://amperecreativegroup.com")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

s3 = boto3.client("s3", region_name=AWS_REGION)
ses = boto3.client("ses", region_name=AWS_REGION)


# ─── Entry point ──────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    method = (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method", "POST")
    )

    if method == "OPTIONS":
        return _cors_preflight()

    if method != "POST":
        return _error(405, "Method not allowed.")

    body = _parse_body(event)
    email = (body.get("email") or "").strip().lower()
    pngs: list[dict] = body.get("pngs") or []

    if not email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return _error(400, "A valid email address is required.")

    if not pngs:
        return _error(400, "No PNG data was provided.")

    # Build zip in memory
    zip_buf = io.BytesIO()
    added = 0
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in pngs:
            name = (item.get("name") or "overlay.png").replace("/", "_")
            data_url: str = item.get("data") or ""

            # Strip data URI prefix (data:image/png;base64,...)
            if "," in data_url:
                raw_b64 = data_url.split(",", 1)[1]
            else:
                raw_b64 = data_url

            try:
                img_bytes = base64.b64decode(raw_b64 + "==")  # pad safely
                zf.writestr(f"brand-kit/{name}", img_bytes)
                added += 1
            except Exception as exc:
                print(f"Skipping {name}: {exc}")

    if added == 0:
        return _error(400, "No valid PNG data could be decoded.")

    zip_buf.seek(0)

    # S3 key: brand-kits/{email}.zip — leads visible from filenames
    safe_email = re.sub(r"[^a-z0-9._@\-]", "_", email)
    s3_key = f"brand-kits/{safe_email}.zip"

    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=zip_buf.getvalue(),
            ContentType="application/zip",
            ContentDisposition='attachment; filename="brand-kit.zip"',
            Metadata={"email": email, "created": datetime.now(timezone.utc).isoformat()},
        )
    except ClientError as exc:
        print(f"S3 put_object error: {exc}")
        return _error(503, "Could not store your files. Please try again in a moment.")

    # Generate 7-day pre-signed download URL
    try:
        download_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=604_800,  # 7 days
        )
    except ClientError as exc:
        print(f"Pre-sign error: {exc}")
        return _error(503, "Could not generate your download link. Please try again.")

    # Send email via SES
    email_sent = False
    try:
        subject, html = _build_email(email, download_url)
        ses.send_email(
            Source=SENDER_EMAIL,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Html": {"Data": html}},
            },
        )
        email_sent = True
    except ClientError as exc:
        print(f"SES error: {exc}")
        # Fall through — return the download URL directly so the user isn't
        # left empty-handed if SES hasn't been fully configured yet.

    return {
        "statusCode": 200,
        "headers": _cors_headers(),
        "body": json.dumps(
            {
                "success": True,
                "emailSent": email_sent,
                # Only expose downloadUrl if email failed (frontend can show it)
                **({"downloadUrl": download_url} if not email_sent else {}),
            }
        ),
    }


# ─── Email template ───────────────────────────────────────────────────────────

def _build_email(recipient: str, download_url: str) -> tuple[str, str]:
    subject = "Your Free Brand Overlay Kit — Ampere Creative Group"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
             background:#f1f5f9;margin:0;padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;
              overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
        Your Brand Kit is Ready
      </h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.82);font-size:14px;">
        Ampere Creative Group &bull; amperecreativegroup.com
      </p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.75;">
        Your custom brand overlay kit is ready. Inside the zip you will find
        <strong>5 transparent PNG overlays</strong> sized for every major platform,
        each one carrying your brand colors and logo exactly as you configured them.
      </p>

      <ul style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;
                 line-height:2;">
        <li>Instagram Post (1080 &times; 1080 px)</li>
        <li>Reels &amp; Stories (1080 &times; 1920 px)</li>
        <li>YouTube / Facebook (1920 &times; 1080 px)</li>
        <li>LinkedIn Banner (1584 &times; 396 px)</li>
        <li>Social Share Card (1200 &times; 630 px)</li>
      </ul>

      <a href="{download_url}"
         style="display:inline-block;background:linear-gradient(135deg,#1e40af,#3b82f6);
                color:#ffffff;padding:14px 28px;border-radius:8px;font-size:15px;
                font-weight:600;text-decoration:none;">
        Download Your Brand Kit
      </a>

      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
        This link is active for 7 days. Need it extended or want a fully custom brand
        identity? Reach out at
        <a href="mailto:hello@amperecreativegroup.com"
           style="color:#3b82f6;text-decoration:none;">
          hello@amperecreativegroup.com
        </a>
        — we are happy to help.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
        Ampere Creative Group &bull; Bloomfield, IA &bull; amperecreativegroup.com
      </p>
    </div>
  </div>
</body>
</html>"""

    return subject, html


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_body(event: dict) -> dict:
    body = event.get("body", "{}")
    if isinstance(body, dict):
        return body
    try:
        return json.loads(body or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}


def _cors_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def _cors_preflight() -> dict:
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": "",
    }


def _error(status: int, message: str) -> dict:
    return {
        "statusCode": status,
        "headers": _cors_headers(),
        "body": json.dumps({"success": False, "error": message}),
    }
