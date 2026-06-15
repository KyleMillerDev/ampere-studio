"""
Input validation helpers for Ampere Creative Group Lambda functions.
"""
import re


def is_valid_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip()))


def is_valid_phone(phone: str) -> bool:
    digits = re.sub(r'\D', '', phone)
    return 10 <= len(digits) <= 15


def sanitize_string(value: str, max_length: int = 1000) -> str:
    """Strip whitespace and truncate to max_length."""
    return str(value).strip()[:max_length]


def validate_form_submission(body: dict) -> tuple[bool, str]:
    """
    Validate a form submission payload.
    Returns (is_valid, error_message).
    """
    org_site_trap = str(body.get("organizationWebsite", "")).strip()
    if org_site_trap:
        return False, "Unable to send your message. Please try again."

    name = body.get("name", "").strip()
    email = body.get("email", "").strip()
    form_id = body.get("formId", "").strip()

    if not name:
        return False, "Name is required."
    if len(name) > 200:
        return False, "Name is too long."
    if not email:
        return False, "Email is required."
    if not is_valid_email(email):
        return False, "Invalid email address."
    if not form_id:
        return False, "Form ID is required."

    return True, ""


def validate_wedding_key(key: str) -> tuple[bool, str]:
    """
    Validate a wedding portal key.
    Keys must be alphanumeric with hyphens only.
    """
    if not key:
        return False, "Wedding key is required."
    if not re.match(r'^[a-zA-Z0-9\-]{3,100}$', key):
        return False, "Invalid wedding key format."
    return True, ""
