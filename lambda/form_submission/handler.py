"""
Form Submission Lambda Handler (Python 3.12)

⚠️ SUPERSEDED — NO LONGER DEPLOYED FROM THIS REPO.

The Ampere Creative Group site now posts contact/inquiry form submissions
to the shared Ampere universal Lambda (owned by the kingdom-koatings
repo) at the Function URL hardcoded in `lib/config.ts`. That shared
handler writes to the `Ampere-Sites-Form-Submissions` DynamoDB table and
sends notification emails via SES, looking up the recipient address by
`client_id` in the `Ampere-Clients` table.

This file is kept in place as archival reference for the historical
per-client pipeline (DynamoDB table `AmpereCG-Form-Submissions`, SES
recipient via `RECIPIENT_EMAIL` env var). Do not redeploy. Once the new
pipeline is verified in production, the legacy Lambda function and its
DynamoDB table can be deleted from AWS.

Processes contact/inquiry form submissions, stores them in DynamoDB,
and sends styled email notifications via AWS SES.

DynamoDB table: AmpereCG-Form-Submissions
SES Source email: configure via SENDER_EMAIL env var
SES Destination: configure via RECIPIENT_EMAIL env var
"""
import json
import os
import sys
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

_root = os.path.dirname(os.path.abspath(__file__))
_shared_next_to_handler = os.path.join(_root, "shared")
_shared_under_parent = os.path.normpath(os.path.join(_root, "..", "shared"))
if os.path.isdir(_shared_next_to_handler):
    sys.path.insert(0, _shared_next_to_handler)
else:
    sys.path.insert(0, _shared_under_parent)

from responses import success_response, error_response, parse_body
from validators import validate_form_submission, sanitize_string
from email_templates import build_form_submission_email

# Environment variables
TABLE_NAME = os.environ.get("FORM_SUBMISSIONS_TABLE", "AmpereCG-Form-Submissions")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@amperecreativegroup.com")
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL", "hello@amperecreativegroup.com")
AWS_REGION = os.environ.get("AWS_REGION", "ca-central-1")

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
ses_client = boto3.client("ses", region_name=AWS_REGION)


def handler(event: dict, context) -> dict:
    """Main Lambda handler."""
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method", "POST")

    # Handle CORS preflight
    if method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "https://amperecreativegroup.com",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": "",
        }

    if method != "POST":
        return error_response("Method not allowed", 405)

    body = parse_body(event)

    # Validate required fields
    is_valid, validation_error = validate_form_submission(body)
    if not is_valid:
        return error_response(validation_error, 400)

    # Extract and sanitize fields
    submission_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    name = sanitize_string(body.get("name", ""))
    email = sanitize_string(body.get("email", "")).lower()
    phone = sanitize_string(body.get("phone", ""), 50) or None
    message = sanitize_string(body.get("message", ""), 5000) or None
    form_id = sanitize_string(body.get("formId", ""))
    service_name = sanitize_string(body.get("serviceName", ""))
    sub_service_name = sanitize_string(body.get("subServiceName", ""), 200) or None
    raw_fields = body.get("fields", {}) or {}

    # Sanitize all field values
    fields = {
        sanitize_string(k, 100): sanitize_string(str(v), 500)
        for k, v in raw_fields.items()
        if k and v
    }

    # Save to DynamoDB
    try:
        table = dynamodb.Table(TABLE_NAME)
        table.put_item(
            Item={
                "submissionId": submission_id,
                "timestamp": timestamp,
                "formId": form_id,
                "serviceName": service_name,
                "subServiceName": sub_service_name,
                "name": name,
                "email": email,
                "phone": phone,
                "message": message,
                "fields": fields,
                "status": "new",
                "source": "website",
            }
        )
    except ClientError as e:
        print(f"DynamoDB error: {e.response['Error']}")
        return error_response("Failed to save submission. Please try again.", 500)

    # Send email notification via SES
    try:
        subject, html_body = build_form_submission_email(
            name=name,
            email=email,
            phone=phone or "",
            service_name=service_name,
            sub_service_name=sub_service_name,
            form_id=form_id,
            fields=fields,
            message=message or "",
            submission_id=submission_id,
            timestamp=timestamp,
        )

        ses_client.send_email(
            Source=SENDER_EMAIL,
            Destination={"ToAddresses": [RECIPIENT_EMAIL]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": html_body, "Charset": "UTF-8"},
                    "Text": {
                        "Data": f"New inquiry from {name} ({email})\nService: {service_name}\nMessage: {message}",
                        "Charset": "UTF-8",
                    },
                },
            },
            ReplyToAddresses=[email],
        )
    except ClientError as e:
        # Don't fail the whole request just because email failed
        print(f"SES error (non-fatal): {e.response['Error']}")

    return success_response(
        data={"submissionId": submission_id},
        message="Your request has been received. We'll be in touch within 1 business day.",
        status_code=201,
    )
