import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

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
    name: "diagnose_portfolio",
    description:
      "Run a full portfolio health diagnosis for a Sui wallet. Shows the hidden correlation cluster, health score, stress-test, and suggested allocation. Use when the user asks 'am I safe?', 'check my portfolio', or connects a wallet.",
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
];
// ─── Tool handlers ───────────────────────────────────────────────────────────

async function handleTool(name: string, args: Record<string, unknown>) {
  const addr = args.walletAddress as string | undefined;
  if (addr && !isValidSuiAddress(addr)) {
    return errorResult("That doesn't look like a valid Sui address.");
  }

  switch (name) {
    case "diagnose_portfolio": {
      const data: any = await apiPost("/portfolio/health", {
        walletAddress: addr,
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
      const data: any = await apiPost("/portfolio/health", {
        walletAddress: addr,
      });
      const pool = (data.positions || []).find(
        (p: any) => p.poolId === poolId
      );
      if (!pool) {
        return errorResult(
          `Pool ${poolId} not found in this wallet's positions.`
        );
      }
      const text = [
        `Pool: ${pool.pair} (${pool.protocol})`,
        `Status: ${pool.inRange ? "In range" : `Out of range for ${pool.daysOutOfRange ?? "?"} days`}`,
        `Value: $${Math.round(pool.valueUSD)}`,
        pool.isDust ? "⚠ This is a dust position (gas > value)." : "",
      ]
        .filter(Boolean)
        .join("\n");
      return {
        content: [{ type: "text" as const, text }],
        structuredContent: {
          ...pool,
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

    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

// ─── Server setup ────────────────────────────────────────────────────────────

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
      err?.message?.includes("ECONNREFUSED") || err?.message?.includes("fetch")
        ? "I couldn't reach the analysis service right now — try again in a moment."
        : err?.message || "Something went wrong.";
    return errorResult(msg);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] LP Guardian MCP server running on stdio");
}

main().catch((err) => {
  console.error("[MCP] Fatal error:", err);
  process.exit(1);
});
