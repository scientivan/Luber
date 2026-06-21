# LP Guardian MCP Server

MCP server for LP Guardian — plugs into Claude Code, Claude Desktop, Cursor, or any
MCP-compatible host. It exposes read/reasoning tools only (diagnose, simulate,
history) and proxies them to the LP Guardian backend API. It never holds keys or
signs transactions — signing happens on the web app via a returned link.

It supports two transports:

| Transport            | When to use                                              | How the host starts it           |
| -------------------- | -------------------------------------------------------- | -------------------------------- |
| **stdio** (default)  | Claude Desktop / Cursor that spawn a local process       | Host launches the process for you |
| **HTTP** (`--http`)  | Remote / shared server, Claude Code via `.mcp.json` URL  | **You start it yourself** first   |

## Tools

1. **diagnose_portfolio** — full health check (correlation cluster, score, stress-test)
2. **deep_diagnose_pool** — deep-dive into one flagged pool
3. **simulate_shock** — stress-test with a price shock + "money saved"
4. **get_history** — past diagnoses, fixes, and autonomous saves
5. **arm_guard** — returns a web link to mint the revocable StrategistCap (no signing here)

## Configuration

Both transports read these env vars (see `.env` / `.env.example`):

| Var            | Default                 | Meaning                          |
| -------------- | ----------------------- | -------------------------------- |
| `LPG_API_BASE` | `http://localhost:8787` | Backend API the tools call       |
| `LPG_WEB_BASE` | `http://localhost:5173` | Web app used for signing links   |
| `MCP_PORT`     | `8765`                  | Port for HTTP mode               |

---

## A) Remote / HTTP mode (Claude Code, project-scoped)

This is what `.mcp.json` at the repo root is wired for.

1. **Install & build** (from repo root):
   ```bash
   pnpm install
   pnpm build:mcp
   ```

2. **Start the server** — it must be running before Claude connects:
   ```bash
   # from repo root
   pnpm dev:mcp:http        # tsx watch, auto-reloads (dev)
   # or, production build:
   pnpm --filter @lp-guardian/mcp-server start:http
   ```
   You should see: `LP Guardian MCP server running on http://localhost:8765/mcp`

3. **`.mcp.json`** (already committed at repo root) registers it for this project:
   ```json
   {
     "mcpServers": {
       "lp-guardian": {
         "type": "http",
         "url": "http://localhost:8765/mcp"
       }
     }
   }
   ```

4. **Connect in Claude Code:** run `/mcp` — `lp-guardian` should show as connected
   and its 5 tools available. (First time, Claude Code asks you to approve the
   project's MCP servers — say yes.)

5. **Smoke-test without Claude** (optional):
   ```bash
   curl -s -X POST http://localhost:8765/mcp \
     -H "content-type: application/json" \
     -H "accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
   ```

> **Note:** tool *calls* (not just listing) need the backend API up at `LPG_API_BASE`.
> Without it you'll get a friendly "couldn't reach the analysis service" message.

---

## B) Local / stdio mode (Claude Desktop, Cursor)

1. **Build:**
   ```bash
   pnpm build:mcp
   ```

2. **Configure the host.** Claude Desktop config
   (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS,
   `%APPDATA%\Claude\claude_desktop_config.json` on Windows):
   ```json
   {
     "mcpServers": {
       "lp-guardian": {
         "command": "node",
         "args": ["/absolute/path/to/LPG/SUI/apps/mcp-server/dist/server.js"],
         "env": {
           "LPG_API_BASE": "http://localhost:8787",
           "LPG_WEB_BASE": "http://localhost:5173"
         }
       }
     }
   }
   ```
   (The host launches this process for you — no need to start it manually.)

3. **Restart the host** — LP Guardian tools appear in the tool palette.

## Development

- **Dev (stdio):** `pnpm dev`
- **Dev (HTTP):** `pnpm dev:http`
- **Type check:** `pnpm typecheck`
- **Build:** `pnpm build`
