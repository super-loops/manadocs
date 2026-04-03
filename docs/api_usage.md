# Manadocs API & MCP

Manadocs provides two ways for external tools to manage documents: MCP (for AI assistants) and REST API (for scripts and integrations).

## MCP (Model Context Protocol)

MCP lets AI assistants like Claude read, create, and edit documents in Manadocs.

### 1. Enable MCP in Manadocs

Go to **Settings > Account > Preferences** and turn on the **MCP** toggle.

### 2. Create an API Token

Go to **Settings > Account > API Tokens** and click **Create Token**.

- Enter a name (e.g. "Claude MCP")
- Select permissions: `read`, `write`, or `admin`
- Optionally set an expiration date
- Click Create and **copy the token immediately** — it won't be shown again

The token looks like: `sd_a1b2c3d4e5f6...`

### 3. Configure your AI assistant

Point your MCP client to the Manadocs endpoint:

```
Endpoint: https://your-manadocs-instance.com/api
Authorization: Bearer sd_your_token_here
```

The AI assistant can then search, read, create, and update pages through the MCP protocol.

---

## REST API

Use the same API Token for direct API access from scripts, CI/CD, or other tools.

### Authentication

All requests require a Bearer token in the `Authorization` header:

```
Authorization: Bearer sd_your_token_here
```

### Endpoints

#### Pages

```bash
# List pages in a space
GET /api/pages?spaceId={spaceId}

# Get a page
GET /api/pages/{pageId}

# Create a page
POST /api/pages
Content-Type: application/json
{
  "title": "My Page",
  "spaceId": "space-id"
}

# Update a page
PATCH /api/pages/{pageId}
Content-Type: application/json
{
  "title": "Updated Title"
}

# Delete a page
DELETE /api/pages/{pageId}
```

#### Spaces

```bash
# List spaces
GET /api/spaces

# Get a space
GET /api/spaces/{spaceId}
```

#### Search

```bash
# Search pages
GET /api/search?query=keyword
```

#### API Tokens

```bash
# List your tokens
GET /api/api-tokens

# Create a token
POST /api/api-tokens
Content-Type: application/json
{
  "name": "My Token",
  "permissions": ["read", "write"]
}

# Delete a token
DELETE /api/api-tokens/{tokenId}
```

### Example

```bash
# Create a page
curl -X POST https://your-instance.com/api/pages \
  -H "Authorization: Bearer sd_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"title": "Meeting Notes", "spaceId": "space-id"}'
```

### Error Responses

| Status | Meaning |
|--------|---------|
| 401 | Invalid or missing token |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 422 | Validation error |
