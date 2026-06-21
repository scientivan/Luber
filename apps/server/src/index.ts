import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import type { HistoryItem, PoolDeepDive, PortfolioHealth, ShockResult } from "@lp-guardian/core";
import { config, configuredDemoWallets, normalizeAddress, resolveActionPortfolio } from "./config.js";
import { strategist, buildPlanFromAllocation } from "./agents/strategist.js";
import { scout } from "./agents/scout.js";
import { watcher } from "./agents/watcher.js";
import { deepbookClient } from "./services/deepbookClient.js";
import * as supabaseService from "./services/supabaseService.js";
import * as authService from "./services/authService.js";
import * as intentService from "./services/rebalanceIntentService.js";
import { wsHandler } from "./websocket/wsHandler.js";
import { getSystemStatus } from "./services/statusService.js";
import { strategistKeypair, suiClient } from "./chain/suiClient.js";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("*", cors());
app.use("*", logger());

app.onError((err, c) => {
  console.error("[server error]", err);
  const message = err.message || "Internal server error";
  const status =
    /Authentication required|Invalid session|Session expired/.test(message) ? 401 :
    /only for configured demo wallets|wallet mismatch|signer mismatch/.test(message) ? 403 :
    /not found|isn't in this wallet/.test(message) ? 404 :
    /Invalid|expired|already|mismatch|required|between/.test(message) ? 400 : 500;
  return c.json({ error: message }, status);
});

app.get(
  "/ws",
  upgradeWebSocket((c: any) => {
    const rawWallet = c.req.query("wallet");
    let walletAddress: string | undefined;
    if (rawWallet) {
      try {
        walletAddress = normalizeAddress(rawWallet);
      } catch {
        walletAddress = undefined;
      }
    }
    return {
      onOpen: (_event: any, ws: any) => {
        wsHandler.register(ws, walletAddress);
        wsHandler.startHeartbeat();
      },
      onMessage: (event: any, ws: any) => {
        const msg = typeof event.data === "string" ? event.data : event.data.toString();
        if (msg === "pong") wsHandler.handlePong(ws);
      },
      onClose: (_event: any, ws: any) => wsHandler.unregister(ws),
      onError: (error: any, ws: any) => {
        console.error("[ws] Connection error:", error);
        wsHandler.unregister(ws);
      },
    };
  }),
);

app.get("/health", (c) => c.json({ ok: true, mockMode: config.mockMode }));
app.get("/status", async (c) => c.json(await getSystemStatus()));

const walletSchema = z.object({ walletAddress: z.string() });
const walletPositionsSchema = walletSchema;
app.post("/wallet/positions", async (c) => {
  const { walletAddress } = walletPositionsSchema.parse(await c.req.json());
  const wallet = normalizeAddress(walletAddress);
  const positions = await scout.discoverWalletPositions(wallet);
  return c.json({ positions, count: positions.length, valueBasis: "estimated_onchain" });
});

const diagnoseSchema = walletSchema.extend({
  source: z.enum(["wallet", "portfolio"]).optional(),
  positionIds: z.array(z.string()).optional(),
});
app.post("/portfolio/health", async (c) => {
  const { walletAddress, source, positionIds } = diagnoseSchema.parse(await c.req.json());
  const wallet = normalizeAddress(walletAddress);
  let opts: { positions?: PortfolioHealth["positions"] } | undefined;
  if (source !== "portfolio") {
    let positions = await scout.discoverWalletPositions(wallet);
    if (positionIds?.length) positions = positions.filter((p) => positionIds.includes(p.objectId));
    opts = positions.length === 0 && configuredDemoWallets().has(wallet) ? undefined : { positions };
  }
  const health = await strategist.diagnose(wallet, opts);
  await supabaseService.logEvent(wallet, wallet, "diagnosis", {
    healthScore: health.healthScore,
    riskLevel: health.riskLevel,
    cluster: health.cluster,
  }, {
    summary: `Health ${health.healthScore}/100, ${Math.round(health.cluster.exposurePct)}% ${health.cluster.token} cluster`,
  }).catch(console.error);
  return c.json(health);
});

const poolHealthSchema = walletSchema.extend({ poolId: z.string() });
app.post("/portfolio/pool-health", async (c) => {
  const { walletAddress, poolId } = poolHealthSchema.parse(await c.req.json());
  const wallet = normalizeAddress(walletAddress);
  const normalizedPool = normalizeAddress(poolId);
  let positions = await scout.discoverWalletPositions(wallet);
  if (positions.length === 0 && configuredDemoWallets().has(wallet)) {
    positions = (await strategist.diagnose(wallet)).positions;
  }
  const position = positions.find(
    (item) => normalizeAddress(item.poolId) === normalizedPool || normalizeAddress(item.objectId) === normalizedPool,
  );
  if (!position) throw new Error("That pool isn't in this wallet's positions");
  const health = await strategist.diagnose(wallet, { positions });
  const clusterValue = health.positions
    .filter((_, index) => health.cluster.positions.includes(index))
    .reduce((sum, item) => sum + item.valueUSD, 0);
  const liquidity = await deepbookClient.getLiquidityProfile(position.poolId, position.tokenX, position.tokenY);
  const exitValue = position.valueUSD * 0.3;
  const result: PoolDeepDive = {
    poolId: position.poolId,
    protocol: position.protocol,
    pair: position.pair,
    status: !position.inRange || position.isDust ? "bleeding" : "healthy",
    inRange: position.inRange,
    daysOutOfRange: position.daysOutOfRange ?? 0,
    estImpermanentLossUSD: Math.round(position.valueUSD * (position.inRange ? 0.015 : 0.06) * 100) / 100,
    contributionToClusterPct: clusterValue > 0
      ? Math.round((position.valueUSD / clusterValue) * 10_000) / 100
      : 0,
    exitLiquidity: {
      depthUSD: liquidity.depthUSD,
      slippageBpsAt30pct: Math.max(
        liquidity.spreadBps,
        liquidity.depthUSD > 0 ? Math.round((exitValue / liquidity.depthUSD) * 10_000) : 10_000,
      ),
      feasible: liquidity.depthUSD >= exitValue,
    },
  };
  await supabaseService.logEvent(wallet, wallet, "diagnosis", result as unknown as Record<string, unknown>, {
    level: "pool",
    poolId: position.poolId,
    summary: `${position.pair}: ${result.status}, ${result.contributionToClusterPct}% of dominant cluster`,
  }).catch(console.error);
  return c.json(result);
});

const historySchema = walletSchema.extend({
  filter: z.enum(["portfolio", "pool", "all"]).optional().default("all"),
});
app.post("/portfolio/history", async (c) => {
  const { walletAddress, filter } = historySchema.parse(await c.req.json());
  const wallet = normalizeAddress(walletAddress);
  const rawEvents = await supabaseService.getHistory(wallet, 50, filter);
  const items: HistoryItem[] = rawEvents.map((event: any) => ({
    id: event.id,
    type:
      event.event_type === "rebalance" ? "autonomous_save" :
      event.event_type === "manual_rebalance" ? "fix" : "diagnosis",
    level: event.level === "pool" ? "pool" : "portfolio",
    timestamp: event.created_at,
    summary: event.summary ??
      (event.event_type === "threshold_breach"
        ? `${event.details?.asset ?? "Asset"} dropped ${Math.abs(event.details?.dropPct ?? 0).toFixed(2)}%`
        : event.event_type),
    moneySaved: event.money_saved == null ? event.details?.moneySaved : Number(event.money_saved),
    txDigest: event.tx_digest ?? event.details?.txDigest,
  }));
  return c.json({ items, webLink: `/history/${wallet}` });
});

app.post("/auth/challenge", async (c) => {
  const { walletAddress } = walletSchema.parse(await c.req.json());
  return c.json(await authService.createChallenge(walletAddress));
});

const verifySchema = walletSchema.extend({ nonce: z.string().min(1), signature: z.string().min(1) });
app.post("/auth/verify", async (c) => c.json(await authService.verifyChallenge(verifySchema.parse(await c.req.json()))));
app.post("/auth/logout", async (c) => {
  await authService.revokeSession(c.req.header("authorization"));
  return c.json({ ok: true });
});

const shockSchema = walletSchema.extend({
  asset: z.string().min(1),
  pct: z.number().min(-100).max(100),
});
app.post("/simulate/shock", async (c) => {
  const { walletAddress, asset, pct } = shockSchema.parse(await c.req.json());
  const wallet = normalizeAddress(walletAddress);
  const sim: ShockResult = await strategist.simulate(wallet, asset.toUpperCase(), pct);
  return c.json(sim);
});

app.post("/portfolio/rebalance/prepare", async (c) => {
  const { walletAddress } = walletSchema.parse(await c.req.json());
  const session = await authService.requireSession(c.req.header("authorization"));
  const wallet = normalizeAddress(walletAddress);
  if (session.walletAddress !== wallet) throw new Error("Session wallet mismatch");
  const { portfolioId } = resolveActionPortfolio(wallet);
  const health = await strategist.diagnose(wallet);
  return c.json(await intentService.createIntent({
    walletAddress: wallet,
    portfolioId,
    sessionId: session.id,
    plan: buildPlanFromAllocation(health),
  }));
});

const rebalanceSchema = walletSchema.extend({ planId: z.string().uuid(), signature: z.string().min(1) });
app.post("/portfolio/rebalance", async (c) => {
  const body = rebalanceSchema.parse(await c.req.json());
  const session = await authService.requireSession(c.req.header("authorization"));
  const wallet = normalizeAddress(body.walletAddress);
  if (session.walletAddress !== wallet) throw new Error("Session wallet mismatch");
  resolveActionPortfolio(wallet);
  const intent = await intentService.consumeIntent({
    planId: body.planId,
    walletAddress: wallet,
    sessionId: session.id,
    signature: body.signature,
  });
  const result = await strategist.rebalance(wallet, intent.plan);
  wsHandler.broadcastWallet(wallet, "rebalance_complete", { walletAddress: wallet, ...result });
  return c.json(result);
});

app.post("/portfolio/guard/prepare", async (c) => {
  const { walletAddress } = walletSchema.parse(await c.req.json());
  const session = await authService.requireSession(c.req.header("authorization"));
  const wallet = normalizeAddress(walletAddress);
  if (session.walletAddress !== wallet) throw new Error("Session wallet mismatch");
  const { portfolioId } = resolveActionPortfolio(wallet);
  const system = await suiClient.getLatestSuiSystemState();
  return c.json({
    eligible: true,
    packageId: config.sui.packageId,
    portfolioId,
    agentAddress: strategistKeypair().toSuiAddress(),
    expiresAtEpoch: Number(system.epoch) + 30,
  });
});

const guardConfirmSchema = walletSchema.extend({
  txDigest: z.string().min(1),
  capId: z.string().min(1),
});
app.post("/portfolio/guard/confirm", async (c) => {
  const body = guardConfirmSchema.parse(await c.req.json());
  const session = await authService.requireSession(c.req.header("authorization"));
  const wallet = normalizeAddress(body.walletAddress);
  if (session.walletAddress !== wallet) throw new Error("Session wallet mismatch");
  const { portfolioId } = resolveActionPortfolio(wallet);
  const agentAddress = normalizeAddress(strategistKeypair().toSuiAddress());
  const tx = await suiClient.getTransactionBlock({
    digest: body.txDigest,
    options: { showInput: true, showObjectChanges: true, showEffects: true },
  });
  const sender = normalizeAddress((tx.transaction?.data as any)?.sender ?? "");
  if (sender !== wallet) throw new Error("Guard transaction sender mismatch");
  const capChange = tx.objectChanges?.find((change: any) =>
    change.type === "created" &&
    normalizeAddress(change.objectId) === normalizeAddress(body.capId) &&
    String(change.objectType).endsWith("::lp_guardian::StrategistCap") &&
    change.owner?.AddressOwner &&
    normalizeAddress(change.owner.AddressOwner) === agentAddress
  );
  if (!capChange || tx.effects?.status.status !== "success") {
    throw new Error("Guard transaction did not create a StrategistCap for the agent");
  }
  await supabaseService.confirmGuard(wallet, portfolioId, normalizeAddress(body.capId), body.txDigest);
  watcher.arm(wallet, normalizeAddress(body.capId));
  return c.json({ active: true, capId: normalizeAddress(body.capId), txDigest: body.txDigest });
});

app.post("/watcher/trigger-shock", async (c) => {
  const { walletAddress, asset, pct } = shockSchema.parse(await c.req.json());
  const session = await authService.requireSession(c.req.header("authorization"));
  const wallet = normalizeAddress(walletAddress);
  if (session.walletAddress !== wallet) throw new Error("Session wallet mismatch");
  resolveActionPortfolio(wallet);
  watcher.arm(wallet);
  void watcher.fireShock(wallet, asset.toUpperCase(), pct).catch(console.error);
  return c.json({ success: true, message: `Shock triggered for ${wallet}` });
});

const server = serve({
  fetch: app.fetch,
  port: config.port,
  hostname: "0.0.0.0",
}, (info) => {
  console.log(`[BE Agent] API Server running on http://localhost:${info.port}`);
  if (config.mockMode) console.log("[BE Agent] Running in MOCK MODE");
  watcher.start();
});

injectWebSocket(server);

setInterval(() => {
  void getSystemStatus()
    .then((status) => wsHandler.broadcast("status_update", status))
    .catch(console.error);
}, 15_000).unref();
