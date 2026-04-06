# Manadocs

A simple, collaborative wiki for startups and small teams.

## What Manadocs stands for

- **Simple** — No enterprise bloat, just what small teams need
- **Self-hosted** — Your data stays on your servers
- **AI Collaboration** — MCP and REST API for AI-powered document management

## Features

- Real-time collaboration
- Spaces and permissions
- Groups and comments
- Diagrams (Mermaid)
- File attachments and embeds
- MCP protocol support for AI tools
- Translations

## Quick Start

### Docker compose
```bash
# Start
docker compose up -d

# Stop
docker compose down
```
Open `http://localhost:3000` and create your workspace.

## Environment Setup

See [docs/environment.md](./docs/environment.md) for all configuration options.

## API & MCP

See [docs/api_usage.md](./docs/api_usage.md) for setup and usage.

## Origin

Manadocs is built on [Docmost](https://github.com/docmost/docmost) (AGPL-3.0), forked in April 2026.

Enterprise features have been removed. Some features have been downgraded or removed, and some have been rewritten to fit this application's goals. Compatibility with the upstream project is not guaranteed.

## Stack

- TypeScript / NestJS (backend)
- React / Mantine (frontend)
- PostgreSQL

## Building from Source

Requirements:
- Node.js 22+
- pnpm 10.4.0+
- PostgreSQL 15+

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Production build
pnpm build
pnpm start
```

## License

AGPL-3.0 — See [LICENSE](./LICENSE) for details.

This means:
- Use and modify freely for any purpose
- Share improvements with the community
- If you run a public instance, you must share source code changes

## Trademark

"Manadocs", "Super Loops", "SuperLoops", and associated logos are trademarks
of Super Loops. The AGPL-3.0 license covers the source code only and does not
grant rights to use these names or logos.

You may self-host Manadocs, fork it, and build different products on top
of it. However, commercial hosted services, SaaS offerings, or paid
distributions that use the Manadocs name or logo require written permission
from Super Loops. Forks used commercially must rebrand.

See [TRADEMARK.md](./TRADEMARK.md) for the full policy.

