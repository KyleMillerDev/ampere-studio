# Ampere Creative Group — AWS Lambda Backend

> ⚠️ **`form_submission/` is SUPERSEDED — no longer deployed from this repo.**
> Contact and inquiry form submissions now route through the shared Ampere
> universal Lambda (owned by the kingdom-koatings repo) via the Function
> URL hardcoded in `lib/config.ts`. The handler in `form_submission/` and
> the `AmpereCG-Form-Submissions` DynamoDB table are kept here as archival
> reference only and should not be redeployed. Once the new pipeline is
> verified in production, the legacy Lambda and table can be deleted from
> AWS. The `weddings/` and `brand_kit/` handlers below are unaffected and
> remain live.

## Overview

This directory contains the AWS Lambda functions and infrastructure for:

1. **Form Submission Handler** (`form_submission/`) — **SUPERSEDED.** Historical per-client handler that wrote to `AmpereCG-Form-Submissions` and sent SES notifications directly. Replaced by the shared Ampere universal Lambda (see `lib/config.ts`).

2. **Weddings Portal Handler** (`weddings/`) — serves wedding client portal data (videos, files, photos) with optional PIN protection. Still live.

3. **Brand Kit Handler** (`brand_kit/`) — receives base64-encoded PNG overlays from the free brand kit generator tool, packages them into a zip, uploads to S3 as `brand-kits/{email}.zip`, generates a 7-day pre-signed download URL, and emails it to the user via SES. Lead emails are visible directly from S3 filenames. Still live.

4. **Shared Utilities** (`shared/`) — common helpers for responses, validation, and email templates.

5. **Infrastructure** (`template.yaml`) — AWS SAM/CloudFormation template defining all resources. The `FormSubmissionFunction`, `FormSubmissionsTable`, and `FormSubmissionLambdaRole` resources within it are superseded along with the form-submission handler.

---

## DynamoDB Schemas

### `AmpereCG-Form-Submissions`

| Attribute        | Type        | Notes                                  |
| ---------------- | ----------- | -------------------------------------- |
| `submissionId`   | String (PK) | UUID v4                                |
| `timestamp`      | String (SK) | ISO 8601 UTC                           |
| `formId`         | String      | e.g. `web-development/custom-websites` |
| `serviceName`    | String      | Human-readable service name            |
| `subServiceName` | String      | Optional sub-service name              |
| `name`           | String      | Submitter's full name                  |
| `email`          | String      | Submitter's email                      |
| `phone`          | String      | Optional phone number                  |
| `message`        | String      | Optional free-text message             |
| `fields`         | Map         | Service-specific form fields           |
| `status`         | String      | `new`, `read`, `replied`               |
| `source`         | String      | `website`                              |

GSI: `formId-timestamp-index` for querying by service.

### `AmpereCG-Weddings`

| Attribute        | Type        | Notes                                                      |
| ---------------- | ----------- | ---------------------------------------------------------- |
| `weddingKey`     | String (PK) | URL slug, e.g. `britt-2025`                                |
| `groomFirstName` | String      | e.g. `Brandon`                                             |
| `brideFirstName` | String      | e.g. `Emmaline`                                            |
| `lastName`       | String      | Shared last name, e.g. `Britt`                             |
| `eventDate`      | String      | Wedding date (ISO 8601), e.g. `2025-05-24`                 |
| `coverPhoto`     | String      | S3 URL for hero background image                           |
| `coverVideo`     | String      | Optional S3/streaming URL for hero background video        |
| `message`        | String      | Personal note from videographer                            |
| `pinHash`        | String      | SHA-256 hash of 4-digit PIN (optional)                     |
| `videos`         | List        | `[{id, title, fullQualityUrl, hdStreamingUrl, thumbnail}]` |
| `files`          | List        | `[{name, url, size, type}]`                                |
| `expiresAt`      | String      | ISO 8601 expiry date                                       |
| `ttl`            | Number      | Unix timestamp for DynamoDB TTL                            |

**`videos` item shape:**

| Field            | Type   | Notes                                             |
| ---------------- | ------ | ------------------------------------------------- |
| `id`             | String | Unique identifier, e.g. `britt-25-highlight`      |
| `title`          | String | Display name, e.g. `Cinematic Highlight Reel`     |
| `fullQualityUrl` | String | Full-quality S3 streaming URL                     |
| `hdStreamingUrl` | String | Optional HD streaming URL (e.g. compressed Vimeo) |
| `thumbnail`      | String | Optional S3 thumbnail image URL                   |

---

## Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed (`pip install aws-sam-cli`)
- SES email address verified in your AWS account

### Deploy

```bash
# Build
sam build

# Deploy interactively (first time)
sam deploy --guided

# Deploy with saved config
sam deploy --stack-name ampere-cg-prod --parameter-overrides \
  Environment=prod \
  SenderEmail=noreply@amperecreativegroup.com \
  RecipientEmail=hello@amperecreativegroup.com \
  AllowedOrigin=https://amperecreativegroup.com
```

### `shared/` imports (`No module named 'responses'`)

Handlers add `shared/` to `sys.path` in two ways: **next to the handler file** (flat zip: `lambda_function.py` and `shared/` in the same folder) or **one level up** (SAM layout: `weddings/handler.py` with `lambda/shared/`). If you zip the function by hand, keep `shared/` beside your entry file, or use the updated `handler.py` logic from this repo. AWS Lambda layers need a `python/` directory at the zip root for imports unless you rely on `sys.path` as above.

### Environment Variables

After deployment, add the Lambda Function URLs (or a single API Gateway base URL) to your site `.env.local`.

**Separate Lambda Function URLs (recommended):**

```bash
NEXT_PUBLIC_WEDDINGS_API_URL=https://liun4t5p5yqgrszsbm3pztfi4e0qvtkx.lambda-url.us-east-2.on.aws
NEXT_PUBLIC_FORM_SUBMISSION_URL=https://oxewwocv4gewd4ric4wn57xvni0rpqgl.lambda-url.us-east-2.on.aws
BRAND_KIT_LAMBDA_URL=https://your-brand-kit-lambda.lambda-url.us-east-2.on.aws
```

The app calls `POST {FORM_SUBMISSION_URL}/submit` and `GET {WEDDINGS_API_URL}/weddings/{key}` (see `lib/api.ts`). Trailing slashes on the base URLs are fine.

**Single API Gateway base URL (SAM `ApiUrl` output):**

```bash
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.ca-central-1.amazonaws.com/prod
```

If `NEXT_PUBLIC_WEDDINGS_API_URL` and `NEXT_PUBLIC_FORM_SUBMISSION_URL` are unset, both features fall back to `NEXT_PUBLIC_API_URL`.

### Adding a Wedding Entry

```python
import boto3
import hashlib

dynamodb = boto3.resource('dynamodb', region_name='ca-central-1')
table = dynamodb.Table('AmpereCG-Weddings')

table.put_item(Item={
    'weddingKey': 'britt-2025',
    'groomFirstName': 'Brandon',
    'brideFirstName': 'Emmaline',
    'lastName': 'Britt',
    'eventDate': '2025-05-24',
    'coverPhoto': 'https://your-bucket.s3.ca-central-1.amazonaws.com/britt-2025/cover.jpg',
    'coverVideo': '',  # optional hero background video URL
    'message': 'It was an absolute honour to capture your day. Enjoy your films!',
    'pinHash': hashlib.sha256(b'1234').hexdigest(),  # 4-digit PIN
    'videos': [
        {
            'id': 'britt-25-highlight',
            'title': 'Cinematic Highlight Reel',
            'fullQualityUrl': 'https://ampere-wedding-videos.s3.ca-central-1.amazonaws.com/britt-2025/highlight-fq.mp4',
            'hdStreamingUrl': 'https://ampere-wedding-videos.s3.ca-central-1.amazonaws.com/britt-2025/highlight-hd.mp4',
            'thumbnail': 'https://your-bucket.s3.ca-central-1.amazonaws.com/britt-2025/highlight-thumb.jpg',
        },
        {
            'id': 'britt-25-ceremony',
            'title': 'Wedding Ceremony',
            'fullQualityUrl': 'https://ampere-wedding-videos.s3.ca-central-1.amazonaws.com/britt-2025/ceremony-fq.mp4',
            'hdStreamingUrl': 'https://ampere-wedding-videos.s3.ca-central-1.amazonaws.com/britt-2025/ceremony-hd.mp4',
            'thumbnail': 'https://your-bucket.s3.ca-central-1.amazonaws.com/britt-2025/ceremony-thumb.jpg',
        },
    ],
    'files': [
        {
            'name': 'Wedding Films Download (ZIP)',
            'url': 'https://your-bucket.s3.ca-central-1.amazonaws.com/britt-2025/download.zip',
            'size': '4.2 GB',
            'type': 'zip',
        }
    ],
    'expiresAt': '2027-01-01T00:00:00Z',
    'ttl': 1798761600  # Unix timestamp for 2027-01-01
})
```
