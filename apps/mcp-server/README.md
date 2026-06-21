# LP Guardian MCP Server

MCP server for LP Guardian — plugs into Claude Desktop, Cursor, or any MCP-compatible host.

## Setup

1. **Install dependencies:**
   ```bash
   cd apps/mcp-server
   pnpm install
   ```

2. **Build:**
   ```bash
   pnpm build
   ```

3. **Configure Claude Desktop:**
   Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

   ```json
   {
     "mcpServers": {
       "lp-guardian": {
         "command": "node",
         "args": ["D:\\Source Code\\Sui\\LPGuardian\\apps\\mcp-server\\dist\\server.js"],
         "env": {
           "LPG_API_BASE": "http://localhost:8787",
           "LPG_WEB_BASE": "http://localhost:5173"
         }
       }
     }
   }
   ```

   **For production:**
   ```json
   {
     "mcpServers": {
       "lp-guardian": {
         "command": "node",
         "args": ["/absolute/path/to/lp-guardian/apps/mcp-server/dist/server.js"],
         "env": {
           "LPG_API_BASE": "https://api.lpg.xyz",
           "LPG_WEB_BASE": "https://app.lpg.xyz"
         }
       }
     }
   }
   ```

4. **Restart Claude Desktop** — LP Guardian tools will appear in the tool palette.

## Available Tools

1. **diagnose_portfolio** — Run full health check
2. **deep_diagnose_pool** — Deep-dive into a specific pool
3. **simulate_shock** — Stress-test with price shock
4. **get_history** — Show past activity
5. **arm_guard** — Set up autonomous Guard

## Example Usage

In Claude Desktop:
```
User: Check my portfolio: 0xabc123...
Claude: [calls diagnose_portfolio]
You have 5 LP positions worth $10,250. But 87% is really one ETH bet...
```

## Development

- **Dev mode:** `pnpm dev` (watches for changes)
- **Type check:** `pnpm typecheck`