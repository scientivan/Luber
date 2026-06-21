import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import { config } from "./config.js";
import { strategist } from "./agents/strategist.js";
import { scout } from "./agents/scout.js";
import { watcher } from "./agents/watcher.js";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import type { PortfolioHealth, ShockResult, HistoryItem } from "@lp-guardian/core";
import { wsHandler } from "./websocket/wsHandler.js";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Middleware
app.use("*", cors());
app.use("*", logger());

// Error handler
app.onError((err, c) => {
  console.error("[server error]", err);
  return c.json({ error: err.message || "Internal server error" }, 500);
});


// --- WebSocket Setup ---------------------------------------------------------
app.get(
  "/ws",
  upgradeWebSocket((c: any) => {
    // Optional: get wallet from query param for MVP
    const walletAddress = c.req.query("wallet");
    
    return {
      onOpen: (event: any, ws: any) => {
        wsHandler.register(ws, walletAddress);
        wsHandler.startHeartbeat();
      },
      onMessage: (event: any, ws: any) => {
        const msg = typeof event.data === 'string' ? event.data : event.data.toString();
        if (msg === "pong") wsHandler.handlePong(ws);
      },
      onClose: (event: any, ws: any) => {
        wsHandler.unregister(ws);
      },
      onError: (error: any, ws: any) => {
        console.error("[ws] Connection error:", error);
        wsHandler.unregister(ws);
      }
    };
  })
);
// --- Routes ------------------------------------------------------------------

app.get("/health", (c) => c.json({ ok: true, mockMode: config.mockMode }));

// POST /wallet/positions - Discover a wallet's REAL Cetus LP positions (mainnet)
const walletPositionsSchema = z.object({ walletAddress: z.string() });
app.post("/wallet/positions", async (c) => {
  const body = await c.req.json();
  const { walletAddress } = walletPositionsSchema.parse(body);
  const positions = await scout.discoverWalletPositions(walletAddress);
  return c.json({ positions, count: positions.length, valueBasis: "estimated_onchain" });
});

// POST /portfolio/health - Diagnose portfolio. Optionally diagnose a wallet's REAL
// discovered positions (source: "wallet"), and/or a chosen subset (positionIds).
const diagnoseSchema = z.object({
  walletAddress: z.string(),
  source: z.enum(["wallet", "portfolio"]).optional(),
  positionIds: z.array(z.string()).optional(),
});
app.post("/portfolio/health", async (c) => {
  const body = await c.req.json();
  const { walletAddress, source, positionIds } = diagnoseSchema.parse(body);

  let opts: { positions?: PortfolioHealth["positions"] } | undefined;
  if (source === "wallet" || (positionIds && positionIds.length)) {
    let positions = await scout.discoverWalletPositions(walletAddress);
    if (positionIds && positionIds.length) {
      positions = positions.filter((p) => positionIds.includes(p.objectId));
    }
    opts = { positions };
  }

  const health: PortfolioHealth = await strategist.diagnose(walletAddress, opts);
  return c.json(health);
});

// POST /portfolio/history - Get activity history
const historySchema = z.object({ walletAddress: z.string(), filter: z.string().optional() });
app.post("/portfolio/history", async (c) => {
  const body = await c.req.json();
  const { walletAddress } = historySchema.parse(body);
  
  // Return mock history for demo purposes
  const history: { items: HistoryItem[]; webLink: string } = {
    items: [
      { id: "h1", type: "autonomous_save", level: "portfolio", timestamp: new Date(Date.now() - 3600000).toISOString(), summary: "Cut ETH cluster 87%→40% after -4% shock", moneySaved: 1200, txDigest: "0xMockSave123" },
      { id: "h2", type: "diagnosis", level: "portfolio", timestamp: new Date(Date.now() - 86400000).toISOString(), summary: "Health 42/100, 87% ETH cluster" }
    ],
    webLink: `${config.beDataUrl.replace("8000", "5173")}/history/${walletAddress}`
  };
  return c.json(history);
});

// POST /auth/verify - Verify signMessage ownership
const verifySchema = z.object({ message: z.string(), signature: z.string(), walletAddress: z.string() });
app.post("/auth/verify", async (c) => {
  const body = await c.req.json();
  const { message, signature, walletAddress } = verifySchema.parse(body);
  try {
    const publicKey = await verifyPersonalMessageSignature(new TextEncoder().encode(message), signature);
    const derivedAddress = publicKey.toSuiAddress();
    return c.json({ valid: derivedAddress === walletAddress });
  } catch (err) {
    console.error("[auth error]", err);
    return c.json({ valid: false });
  }
});

// POST /simulate/shock - Simulate asset drop
const shockSchema = z.object({ walletAddress: z.string(), asset: z.string(), pct: z.number() });
app.post("/simulate/shock", async (c) => {
  const body = await c.req.json();
  const { walletAddress, asset, pct } = shockSchema.parse(body);
  const sim: ShockResult = await strategist.simulate(walletAddress, asset, pct);
  return c.json(sim);
});

// POST /portfolio/rebalance - One-signature Fix: agent signs the rebalance + mints report
const rebalanceSchema = z.object({ walletAddress: z.string(), planId: z.string().optional() });
app.post("/portfolio/rebalance", async (c) => {
  const body = await c.req.json();
  const { walletAddress } = rebalanceSchema.parse(body);
  const result = await strategist.rebalance(walletAddress);
  return c.json(result);
});

// POST /watcher/trigger-shock - Manual trigger for autonomous guard demo
app.post("/watcher/trigger-shock", async (c) => {
  const body = await c.req.json();
  const { walletAddress, asset, pct } = shockSchema.parse(body);
  // Arm with the resolved real StrategistCap for this wallet (no mock cap).
  watcher.arm(walletAddress);
  // Trigger async but don't wait for completion
  watcher.fireShock(walletAddress, asset, pct).catch(console.error);
  return c.json({ success: true, message: `Shock triggered for ${walletAddress}` });
});

// Start the server
const server = serve({
  fetch: app.fetch,
  port: config.port,
  hostname: "0.0.0.0",
}, (info) => {
  console.log(`[BE Agent] API Server running on http://localhost:${info.port}`);
  if (config.mockMode) console.log(`[BE Agent] Running in MOCK MODE`);
  // Start watcher daemon
  watcher.start();
});

injectWebSocket(server);
