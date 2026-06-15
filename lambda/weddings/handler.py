"""
Weddings Portal Lambda Handler (Python 3.12)
Serves wedding client portal data from DynamoDB.

DynamoDB table: AmpereCG-Weddings
Endpoints:
  GET /weddings/{key}       - Retrieve wedding data (with optional PIN verification)
  POST /weddings/{key}/pin  - Verify PIN and return session token
"""
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

_root = os.path.dirname(os.path.abspath(__file__))
# Flat zip: lambda_function.py + shared/ side by side. SAM: weddings/handler.py + ../shared
_shared_next_to_handler = os.path.join(_root, "shared")
_shared_under_parent = os.path.normpath(os.path.join(_root, "..", "shared"))
if os.path.isdir(_shared_next_to_handler):
    sys.path.insert(0, _shared_next_to_handler)
else:
    sys.path.insert(0, _shared_under_parent)

from responses import success_response, error_response, parse_body
from validators import validate_wedding_key, sanitize_string

TABLE_NAME = os.environ.get("WEDDINGS_TABLE", "AmpereCG-Weddings")
AWS_REGION = os.environ.get("AWS_REGION", "ca-central-1")

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)


def _wedding_key_from_event(event: dict) -> str:
    """Resolve {key} from API Gateway path params or Lambda Function URL raw path."""
    path_params = event.get("pathParameters") or {}
    key = path_params.get("key", "")
    if key:
        return key
    raw_path = (event.get("rawPath") or event.get("path") or "").strip()
    prefix = "/weddings/"
    if prefix in raw_path:
        after = raw_path.split(prefix, 1)[-1].strip("/")
        return after.split("/")[0] if after else ""
    return ""


def handler(event: dict, context) -> dict:
    """Main Lambda handler."""
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method", "GET")
    key = _wedding_key_from_event(event)

    # CORS preflight
    if method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
            "body": "",
        }

    # Validate key
    is_valid, err = validate_wedding_key(key)
    if not is_valid:
        return error_response(err, 400)

    if method == "GET":
        return get_wedding(key, event)
    elif method == "POST":
        return verify_pin(key, event)
    else:
        return error_response("Method not allowed", 405)


def get_wedding(key: str, event: dict) -> dict:
    """Retrieve wedding portal data by key."""
    table = dynamodb.Table(TABLE_NAME)

    try:
        response = table.get_item(Key={"weddingKey": key})
    except ClientError as e:
        print(f"DynamoDB error: {e.response['Error']}")
        return error_response("Service unavailable. Please try again.", 503)

    item = response.get("Item")
    if not item:
        return error_response("Wedding page not found.", 404)

    # Check expiry
    expires_at = item.get("expiresAt")
    if expires_at:
        expiry_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expiry_dt:
            return error_response("This page has expired. Please contact Ampere Creative Group.", 410)

    # Check if PIN-protected
    if item.get("pinHash"):
        query_params = event.get("queryStringParameters") or {}
        provided_pin = query_params.get("pin", "")

        if not provided_pin:
            return error_response("PIN required", 401)

        # Verify PIN (SHA-256 hash comparison)
        provided_hash = hashlib.sha256(provided_pin.encode()).hexdigest()
        if provided_hash != item.get("pinHash"):
            return error_response("Invalid PIN. Please try again.", 401)

    # Build safe response (exclude pin hash)
    wedding_data = {
        "weddingKey": item.get("weddingKey"),
        "groomFirstName": item.get("groomFirstName"),
        "brideFirstName": item.get("brideFirstName"),
        "lastName": item.get("lastName"),
        "eventDate": item.get("eventDate"),
        "coverPhoto": item.get("coverPhoto"),
        "coverVideo": item.get("coverVideo"),
        "message": item.get("message"),
        "videos": item.get("videos", []),
        "files": item.get("files", []),
        "expiresAt": item.get("expiresAt"),
        "pinProtected": bool(item.get("pinHash")),
    }

    return success_response(data=wedding_data)


def verify_pin(key: str, event: dict) -> dict:
    """Verify PIN for a wedding page (POST endpoint)."""
    body = parse_body(event)
    pin = sanitize_string(body.get("pin", ""), 20)

    if not pin:
        return error_response("PIN is required.", 400)
    if not pin.isdigit() or len(pin) < 4:
        return error_response("Invalid PIN format.", 400)

    table = dynamodb.Table(TABLE_NAME)
    try:
        response = table.get_item(Key={"weddingKey": key})
    except ClientError as e:
        print(f"DynamoDB error: {e.response['Error']}")
        return error_response("Service unavailable.", 503)

    item = response.get("Item")
    if not item:
        return error_response("Wedding page not found.", 404)

    stored_hash = item.get("pinHash")
    if not stored_hash:
        # Not PIN protected — treat as success
        return success_response(message="Access granted.")

    provided_hash = hashlib.sha256(pin.encode()).hexdigest()
    if provided_hash != stored_hash:
        return error_response("Invalid PIN. Please try again.", 401)

    return success_response(message="Access granted.")
