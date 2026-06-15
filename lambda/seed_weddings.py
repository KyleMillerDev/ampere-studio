"""
Seed AmpereCG-Weddings DynamoDB table from weddings-seed.json.

Usage:
    python seed_weddings.py
    python seed_weddings.py --table AmpereCG-Weddings-dev
    python seed_weddings.py --region us-east-2
    python seed_weddings.py --dry-run

To add a PIN to any item before seeding, set pinHash:
    import hashlib
    hashlib.sha256(b'1234').hexdigest()
"""
import argparse
import hashlib
import json
import os
import sys

import boto3

DEFAULT_TABLE = "AmpereCG-Weddings"
DEFAULT_REGION = "us-east-2"
SEED_FILE = os.path.join(os.path.dirname(__file__), "weddings-seed.json")


def build_pin_hash(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Seed AmpereCG-Weddings DynamoDB table.")
    parser.add_argument("--table", default=DEFAULT_TABLE, help="DynamoDB table name")
    parser.add_argument("--region", default=DEFAULT_REGION, help="AWS region")
    parser.add_argument("--dry-run", action="store_true", help="Print items without writing")
    args = parser.parse_args()

    with open(SEED_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    if args.dry_run:
        print(f"[dry-run] Would write {len(items)} items to {args.table}:\n")
        for item in items:
            print(f"  - {item['weddingKey']}  ({item['groomFirstName']} & {item['brideFirstName']} {item['lastName']}, {len(item['videos'])} videos)")
        return

    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    table = dynamodb.Table(args.table)

    for item in items:
        # Strip empty strings — DynamoDB does not accept empty string values
        clean = {k: v for k, v in item.items() if v != ""}

        table.put_item(Item=clean)
        print(f"  wrote: {item['weddingKey']}")

    print(f"\nDone. {len(items)} items written to {args.table}.")


if __name__ == "__main__":
    main()
