import { expect, test } from "@playwright/test";

const wallet = `0x${"1".repeat(64)}`;
const pool = `0x${"2".repeat(64)}`;

test("portfolio diagnosis links to real pool detail route", async ({ page }) => {
  await page.route("**/portfolio/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        walletAddress: wallet,
        healthScore: 42,
        riskLevel: "amber",
        totalValueUSD: 10250,
        positionCount: 1,
        cluster: { token: "ETH", exposurePct: 87, positions: [0] },
        stress: { asset: "ETH", pct: -10, atRiskUSD: 1800 },
        positions: [{
          objectId: `0x${"3".repeat(64)}`,
          protocol: "cetus",
          poolId: pool,
          pair: "ETH-USDC",
          tokenX: "ETH",
          tokenY: "USDC",
          token: "ETH",
          valueUSD: 10250,
          inRange: false,
        }],
        bleedingPools: [{ poolId: pool, protocol: "cetus", pair: "ETH-USDC", status: "bleeding" }],
        insights: [],
      }),
    });
  });
  await page.goto(`/d/${wallet}`);
  await expect(page.getByRole("heading", { name: "Portfolio diagnosis" })).toBeVisible();
  await expect(page.getByText("87% ETH")).toBeVisible();
  await page.getByText("ETH-USDC").click();
  await expect(page).toHaveURL(new RegExp(`/d/${wallet}/pool/${pool}`));
});

test("status page renders degraded dependencies from backend", async ({ page }) => {
  await page.route("http://localhost:8787/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        overall: "degraded",
        checkedAt: new Date().toISOString(),
        api: { ok: true, uptimeSeconds: 12 },
        beData: { ok: false, error: "timeout" },
        rpc: { ok: true, latencyMs: 80, checkpoint: "123", network: "testnet" },
        supabase: { ok: true, latencyMs: 20 },
        watcher: { enabled: true, running: true, guardedWallets: 1 },
        mcp: { ok: false, mode: "backing_endpoints", tools: ["diagnose_portfolio"] },
      }),
    });
  });
  await page.goto("/status");
  await expect(page.getByRole("heading", { name: "degraded" })).toBeVisible();
  await expect(page.getByText("timeout")).toBeVisible();
});
