import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer as createHttpServer, type IncomingMessage } from "node:http";

const API = process.env.LPG_API_BASE ?? "http://localhost:8787";
const WEB = process.env.LPG_WEB_BASE ?? "http://localhost:5173";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "unknown error");
    throw new Error(`API ${path} returned ${res.status}: ${msg}`);
  }
  return res.json();
}

function textResult(text: string, extra?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    ...(extra ? { structuredContent: extra } : {}),
  };
}

function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

function isValidSuiAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{1,64}$/.test(addr);
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "discover_positions",
    description:
      "Find the REAL Cetus LP positions held by a Sui wallet (read from mainnet), each with an estimated USD value and in/out-of-range status. Use this FIRST when the user gives a wallet address and wants to analyze THEIR OWN positions — then show the numbered list and let them pick which ones to diagnose. Returns each position's objectId so the user's selection can be passed to diagnose_portfolio.",
    inputSchema: {
      type: "object" as const,
      properties: {
        walletAddress: {
          type: "string",
          description: "Sui wallet address (0x...)",
        },
      },
      required: ["walletAddress"],
    },
  },
  {
    name: "diagnose_portfolio",
    description:
      "Run a full portfolio health diagnosis for a Sui wallet. Shows the hidden correlation cluster, health score, stress-test, and suggested allocation. Use when the user asks 'am I safe?', 'check my portfolio', or connects a wallet. To diagnose a wallet's REAL discovered positions, set source='wallet'; pass positionIds (from discover_positions) to diagnose only a chosen subset.",
    inputSchema: {
      type: "object" as const,
      properties: {
        walletAddress: {
          type: "string",
          description: "Sui wallet address (0x...)",
        },
        source: {
          type: "string",
          enum: ["wallet", "portfolio"],
          description:
            "'wallet' = diagnose the wallet's REAL on-chain Cetus positions; 'portfolio' (default) = the LP Guardian demo portfolio.",
        },
        positionIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional subset of position objectIds (from discover_positions) to diagnose. Implies source='wallet'.",
        },
      },
      required: ["walletAddress"],
    },
  },
  {
    name: "deep_diagnose_pool",
    description:
      "Deep-dive into a single LP pool that diagnose_portfolio flagged as bleeding or risky. Shows IL estimate, exit-liquidity depth, and contribution to cluster risk. Use after a portfolio diagnosis when the user wants details on a specific pool.",
    inputSchema: {
      type: "object" as const,
      properties: {
        walletAddress: {
          type: "string",
          description: "Sui wallet address",
        },
        poolId: {
          type: "string",
          description: "Pool object ID from diagnose_portfolio results",
        },
      },
      required: ["walletAddress", "poolId"],
    },
  },
  {
    name: "simulate_shock",
    description:
      "Simulate a price shock on an asset and show the dollar impact across the portfolio, plus how much Guard would save. Use when the user asks 'what if ETH drops 10%', 'simulate', or 'stress test'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        walletAddress: { type: "string" },
        asset: { type: "string", description: "Token symbol, e.g. ETH" },
        pct: {
          type: "number",
          description: "Percentage move (negative = drop, e.g. -10)",
        },
      },
      required: ["walletAddress", "asset", "pct"],
    },
  },
  {
    name: "get_history",
    description:
      "Show past LP Guardian activity for a wallet: diagnoses run, one-sig fixes, and autonomous saves performed by Guard. Use when the user asks 'what did you do', 'show my history', or 'what happened while I was away'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        walletAddress: { type: "string" },
        filter: {
          type: "string",
          enum: ["portfolio", "pool", "all"],
          default: "all",
        },
      },
      required: ["walletAddress"],
    },
  },
  {
    name: "arm_guard",
    description:
      "Start setting up autonomous Guard. Does NOT sign or move anything — returns a web link where the OWNER signs once to mint the revocable StrategistCap. Use when the user says 'guard it', 'protect my portfolio', or 'turn on autopilot'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        walletAddress: { type: "string" },
      },
      required: ["walletAddress"],
    },
  },
  {
    name: "guard_status",
    description:
      "Check the current status of autonomous Guard for a wallet: whether it's armed/enabled, the drop threshold it watches, which correlation cluster token it's protecting, and recent autonomous saves. Use when the user asks 'is my guard on?', 'what's protecting me?', 'guard status', or 'what has Guard done lately?'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        walletAddress: { type: "string" },
      },
      required: ["walletAddress"],
    },
  },
];
// ─── Tool handlers ───────────────────────────────────────────────────────────

async function handleTool(name: string, args: Record<string, unknown>) {
  const addr = args.walletAddress as string | undefined;
  if (addr && !isValidSuiAddress(addr)) {
    return errorResult("That doesn't look like a valid Sui address.");
  }

  switch (name) {
    case "discover_positions": {
      const data: any = await apiPost("/wallet/positions", {
        walletAddress: addr,
      });
      const positions: any[] = data.positions || [];
      if (positions.length === 0) {
        return textResult(
          "No Cetus LP positions found for that wallet on mainnet. (Real LP liquidity lives on Sui mainnet — testnet wallets usually have none.)"
        );
      }
      const total = positions.reduce((s, p) => s + (p.valueUSD || 0), 0);
      const lines = positions.map(
        (p, i) =>
          `${i + 1}. ${p.pair} — ~$${Math.round(p.valueUSD).toLocaleString()} ${p.inRange ? "(in range)" : "⚠ out of range"}${p.isDust ? " · dust" : ""}\n   id: ${p.objectId}`
      );
      const text = [
        `Found ${positions.length} real Cetus position${positions.length > 1 ? "s" : ""} (~$${Math.round(total).toLocaleString()} total, value estimated on-chain):`,
        ...lines,
        `\nReply with which ones to diagnose (e.g. "diagnose 1 and 3"), or "all".`,
      ].join("\n");
      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { ...data, webLink: `${WEB}/d/${addr}?s=discover` },
      };
    }

    case "diagnose_portfolio": {
      const data: any = await apiPost("/portfolio/health", {
        walletAddress: addr,
        ...(args.source ? { source: args.source } : {}),
        ...(Array.isArray(args.positionIds) && args.positionIds.length
          ? { positionIds: args.positionIds }
          : {}),
      });
      const h = data;
      const text = [
        `Health: ${h.healthScore}/100 (${h.riskLevel})`,
        `You have ${h.positionCount} LP positions worth ~$${Math.round(h.totalValueUSD).toLocaleString()}.`,
        `But ${h.cluster.exposurePct}% is really one ${h.cluster.token} bet.`,
        `If ${h.cluster.token} drops ${Math.abs(h.stress?.pct ?? 10)}%, you lose ~$${Math.round(h.stress?.atRiskUSD ?? 0)} across all of them at once.`,
        ...(h.insights || []).map((i: any) => `⚠ ${i.title}: ${i.description}`),
      ].join("\n");
      return {
        content: [{ type: "text" as const, text }],
        structuredContent: {
          ...h,
          webLink: `${WEB}/d/${addr}?s=preview`,
        },
      };
    }

    case "deep_diagnose_pool": {
      const poolId = args.poolId as string;
      if (!poolId || !isValidSuiAddress(poolId)) {
        return errorResult("That doesn't look like a valid pool ID.");
      }
      const data: any = await apiPost("/portfolio/pool-health", {
        walletAddress: addr,
        poolId,
      });
      const text = [
        `Pool: ${data.pair} (${data.protocol})`,
        `Status: ${data.inRange ? "In range" : `Out of range for ${data.daysOutOfRange ?? "?"} days`}`,
        `Estimated impermanent loss: $${Math.round(data.estImpermanentLossUSD ?? 0)}`,
        `Contribution to dominant cluster: ${data.contributionToClusterPct ?? 0}%`,
        `Exit depth: $${Math.round(data.exitLiquidity?.depthUSD ?? 0).toLocaleString()} (${data.exitLiquidity?.feasible ? "feasible" : "constrained"})`,
      ]
        .filter(Boolean)
        .join("\n");
      return {
        content: [{ type: "text" as const, text }],
        structuredContent: {
          ...data,
          webLink: `${WEB}/d/${addr}/pool/${poolId}?s=preview`,
        },
      };
    }

    case "simulate_shock": {
      const asset = args.asset as string;
      const pct = args.pct as number;
      if (!asset) return errorResult("Please specify an asset to shock.");
      if (typeof pct !== "number" || pct < -100 || pct > 100) {
        return errorResult("Percentage must be between -100 and 100.");
      }
      const data: any = await apiPost("/simulate/shock", {
        walletAddress: addr,
        asset,
        pct,
      });
      const direction = pct < 0 ? "drops" : "rises";
      const text = [
        `If ${asset} ${direction} ${Math.abs(pct)}%:`,
        `  💸 You lose ~$${Math.round(data.atRiskUSD)} across your portfolio.`,
        `  🛡️ With Guard on, I'd save you ~$${Math.round(data.guarded.moneySaved)} of that.`,
        `  📊 Post-guard health: ${data.guarded.postHealth}/100`,
      ].join("\n");
      return {
        content: [{ type: "text" as const, text }],
        structuredContent: {
          ...data,
          webLink: `${WEB}/d/${addr}?sim=${asset}:${pct}`,
        },
      };
    }

    case "get_history": {
      const filter = (args.filter as string) || "all";
      const data: any = await apiPost("/portfolio/history", {
        walletAddress: addr,
        filter,
      });
      if (!data.items?.length) {
        return textResult("No saved activity yet for this wallet.");
      }
      const lines = data.items.map(
        (item: any) =>
          `[${item.type}] ${item.summary}${item.moneySaved ? ` (saved ~$${item.moneySaved})` : ""} — ${new Date(item.timestamp).toLocaleDateString()}`
      );
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          items: data.items,
          webLink: `${WEB}/history/${addr}`,
        },
      };
    }

    case "arm_guard": {
      const webLink = `${WEB}/guard/${addr}`;
      return textResult(
        `To arm Guard, sign once here — you mint a revocable capability; I still physically can't withdraw your funds (enforced by Move): ${webLink}`,
        { action: "mint_strategist_cap", webLink }
      );
    }

    case "guard_status": {
      const data: any = await apiPost("/guard/status", { walletAddress: addr });
      const webLink = `${WEB}/guard/${addr}`;
      if (!data.guardEnabled && !data.watching) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Guard is OFF for this wallet. Arm it here to protect your cluster autonomously: ${webLink}`,
            },
          ],
          structuredContent: { ...data, webLink },
        };
      }
      const recent = (data.recentActivity || [])
        .slice(0, 3)
        .map(
          (a: any) =>
            `  • [${a.type}] ${a.summary}${a.moneySaved ? ` (saved ~$${Math.round(a.moneySaved)})` : ""}`
        );
      const text = [
        `🛡️ Guard is ${data.guardEnabled ? "ON" : "OFF"}${data.watching ? " · watching live" : ""}.`,
        data.clusterToken ? `Protecting your ${data.clusterToken} cluster.` : "",
        `Triggers an autonomous rebalance if it drops ${Math.abs(data.thresholdPct)}%.`,
        data.lastCheckAt ? `Last checked: ${new Date(data.lastCheckAt).toLocaleString()}` : "",
        recent.length ? `Recent activity:\n${recent.join("\n")}` : "No saves yet — all quiet.",
      ]
        .filter(Boolean)
        .join("\n");
      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { ...data, webLink },
      };
    }

    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

// ─── Server setup ────────────────────────────────────────────────────────────

/** Builds a fresh MCP server instance with all tools wired up. */
function buildServer() {
  const server = new Server(
    { name: "lp-guardian", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      return await handleTool(
        req.params.name,
        (req.params.arguments ?? {}) as Record<string, unknown>
      );
    } catch (err: any) {
      const msg =
        err?.message?.includes("ECONNREFUSED") ||
        err?.message?.includes("fetch")
          ? "I couldn't reach the analysis service right now — try again in a moment."
          : err?.message || "Something went wrong.";
      return errorResult(msg);
    }
  });

  return server;
}

// ─── Transports ──────────────────────────────────────────────────────────────

/** Local transport — Claude spawns this process and talks over stdin/stdout. */
async function runStdio() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] LP Guardian MCP server running on stdio");
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Remote transport — server listens on HTTP; hosts (Claude Code/Desktop) connect
 * to a URL. Stateless Streamable HTTP: a fresh server is created per request, so
 * there is no session to track and any client can connect at any time.
 */
async function runHttp() {
  // Railway/Render/etc. inject PORT; prefer MCP_PORT, then PORT, then default.
  const port = Number(process.env.MCP_PORT ?? process.env.PORT ?? 8765);

  const http = createHttpServer(async (req, res) => {
    // Permissive CORS so browser-based MCP hosts can connect too.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type, mcp-session-id, mcp-protocol-version"
    );
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url?.split("?")[0] !== "/mcp") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found. Use POST /mcp." }));
      return;
    }

    if (req.method !== "POST") {
      // Stateless mode has no standalone GET/DELETE session streams.
      res.writeHead(405, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed." },
          id: null,
        })
      );
      return;
    }

    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, await readJsonBody(req));
  });

  http.listen(port, () => {
    console.error(
      `[MCP] LP Guardian MCP server running on http://localhost:${port}/mcp`
    );
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const useHttp =
  process.argv.includes("--http") ||
  (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase() === "http";

(useHttp ? runHttp() : runStdio()).catch((err) => {
  console.error("[MCP] Fatal error:", err);
  process.exit(1);
});
