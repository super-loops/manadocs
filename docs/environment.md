# Environment Setup

Manadocs is configured entirely through environment variables. For a
production deployment, copy `.env.example` to `.env` and edit the values.

```bash
cp .env.example .env
```

## Required

| Variable | Description |
| --- | --- |
| `APP_URL` | Public URL for your instance (e.g. `https://docs.example.com`). Used for links in emails, OAuth callbacks, and the MCP system prompt. |
| `APP_SECRET` | Secret used to sign sessions and cookies. Minimum 32 characters. Generate with `openssl rand -hex 32`. |
| `DATABASE_URL` | PostgreSQL connection string. Example: `postgresql://user:pass@host:5432/manadocs?schema=public`. |

## General

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port the server listens on. |
| `JWT_TOKEN_EXPIRES_IN` | `30d` | Duration auth cookies remain valid. |
| `MANADOCS_DEFAULT_LANG` | `en-US` | BCP-47 locale applied to new users and the login screen. Supported: `en-US`, `ko-KR`, `ja-JP`, `zh-CN`, `es-ES`, `fr-FR`, `pt-BR`, `ru-RU`, `uk-UA`, `de-DE`, `it-IT`, `nl-NL`. |

## Storage

| Variable | Default | Description |
| --- | --- | --- |
| `STORAGE_DRIVER` | `local` | Attachment storage backend. One of `local` or `s3`. |
| `FILE_UPLOAD_SIZE_LIMIT` | `50mb` | Maximum upload size per file. |

### S3 driver

Required when `STORAGE_DRIVER=s3`. Works with AWS S3 and S3-compatible
services (MinIO, Cloudflare R2, Backblaze B2, etc.).

| Variable | Description |
| --- | --- |
| `AWS_S3_ACCESS_KEY_ID` | Access key. |
| `AWS_S3_SECRET_ACCESS_KEY` | Secret key. |
| `AWS_S3_REGION` | Bucket region (e.g. `us-east-1`, `auto` for R2). |
| `AWS_S3_BUCKET` | Bucket name. |
| `AWS_S3_ENDPOINT` | Custom endpoint URL. Leave blank for AWS. |
| `AWS_S3_FORCE_PATH_STYLE` | Set to `true` for MinIO/R2. |

## Mail

| Variable | Default | Description |
| --- | --- | --- |
| `MAIL_DRIVER` | `smtp` | One of `smtp` or `postmark`. |
| `MAIL_FROM_ADDRESS` | — | From address for outbound mail. |
| `MAIL_FROM_NAME` | `Manadocs` | From name for outbound mail. |

### SMTP driver

| Variable | Default | Description |
| --- | --- | --- |
| `SMTP_HOST` | `127.0.0.1` | SMTP server hostname. |
| `SMTP_PORT` | `587` | SMTP server port. |
| `SMTP_USERNAME` | — | SMTP auth username. |
| `SMTP_PASSWORD` | — | SMTP auth password. |
| `SMTP_SECURE` | `false` | Use TLS on connect (port 465). |
| `SMTP_IGNORETLS` | `false` | Skip STARTTLS negotiation. |

### Postmark driver

| Variable | Description |
| --- | --- |
| `POSTMARK_TOKEN` | Server API token from Postmark. |

## Integrations

| Variable | Description |
| --- | --- |
| `DRAWIO_URL` | URL of a custom draw.io embed server. Leave blank to use the hosted default. |

## Telemetry and logging

| Variable | Default | Description |
| --- | --- | --- |
| `DISABLE_TELEMETRY` | `false` | Set to `true` to disable anonymous usage telemetry. |
| `DEBUG_MODE` | `false` | Enable verbose logging in production. |
| `DEBUG_DB` | `false` | Log every database query. Noisy — debugging only. |
| `LOG_HTTP` | `false` | Log every incoming HTTP request. |

## Viewing current values

Admins and owners can inspect the running configuration from the web UI at
**Settings → Application → Environment**. Secrets are masked with `***`;
unset values are labelled "Unset". Values set via environment variables
show an "ENV" badge.
