"""
Shared utilities for Ampere Creative Group Lambda functions.
"""
import json
from typing import Any


def success_response(data: Any = None, message: str = "Success", status_code: int = 200) -> dict:
    """Return a standardized success response with CORS headers."""
    body: dict = {"success": True, "message": message}
    if data is not None:
        body["data"] = data
    return {
        "statusCode": status_code,
        "headers": cors_headers(),
        "body": json.dumps(body),
    }


def error_response(message: str, status_code: int = 400) -> dict:
    """Return a standardized error response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": cors_headers(),
        "body": json.dumps({"success": False, "error": message}),
    }


def cors_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://amperecreativegroup.com",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }


def parse_body(event: dict) -> dict:
    """Safely parse the event body as JSON."""
    body = event.get("body", "{}")
    if isinstance(body, dict):
        return body
    try:
        return json.loads(body or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}
