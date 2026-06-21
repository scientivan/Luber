import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { config } from "../config.js";
import type { PortfolioHealth, Insight, Position } from "@lp-guardian/core";

// AI is disabled if no API key is set
const isEnabled = () => config.ai.enabled;

const model = () => google(config.ai.model || "gemini-1.5-pro-latest");

/**
 * AI Client - Vercel AI SDK + Gemini for structured output generation.
 * Used for: intent understanding, insight generation, and deep pool diagnosis.
 */
export const aiClient = {
  /**
   * Strategist Agent Diagnosis: Analyzes raw positions and returns
   * a structured array of bleeding pools with AI reasoning.
   */
  async diagnosePools(positions: Position[], priceHistory: Record<string, number[]>) {
    if (!isEnabled() || positions.length === 0) {
      // Fallback to hardcoded logic if AI disabled
      return positions
        .filter((p) => !p.inRange || p.isDust)
        .map((p) => ({
          poolId: p.poolId,
          protocol: p.protocol,
          pair: p.pair,
          status: "bleeding" as const,
          reason: p.isDust ? "Position value is below dust threshold." : "Position is out of tick range.",
        }));
    }

    try {
      const schema = z.object({
        diagnoses: z.array(z.object({
          poolId: z.string(),
          protocol: z.enum(["cetus", "turbos", "deepbook", "kriya"]),
          pair: z.string(),
          status: z.enum(["bleeding", "healthy", "concentration_risk"]),
          reason: z.string().describe("1-2 sentences explaining why it's bleeding or healthy based on ticks, liquidity, and price correlation.")
        }))
      });

      const { object } = await generateObject({
        model: model(),
        schema,
        prompt: `
As a DeFi Quant Strategist, analyze the following Liquidity Pool positions.
Determine if each pool is 'bleeding' (out of range, losing money, dust), 'healthy' (in range, good depth), or has a 'concentration_risk'.

Positions Data:
${JSON.stringify(positions, null, 2)}

Provide a strict JSON response diagnosing every pool provided.
        `.trim(),
      });

      // Filter only the bleeding or risky ones for the strategist
      return object.diagnoses
        .filter(d => d.status !== "healthy")
        .map(d => ({ ...d, status: "bleeding" as const })); // cast to bleeding for core type compat
    } catch (err) {
      console.error("[AI] Failed to diagnose pools:", err);
      return positions
        .filter((p) => !p.inRange || p.isDust)
        .map((p) => ({
          poolId: p.poolId,
          protocol: p.protocol,
          pair: p.pair,
          status: "bleeding" as const,
          reason: "Fallback: out of range or dust.",
        }));
    }
  },

  /**
   * Generate plain-English insights from portfolio health data.
   */
  async generateInsights(health: PortfolioHealth): Promise<string> {
    if (!isEnabled()) {
      return generateFallbackInsight(health);
    }

    try {
      const prompt = `
You are LP Guardian, an AI agent that helps users understand hidden correlation risks in their LP positions.

Portfolio Data:
- Health Score: ${health.healthScore}/100
- Risk Level: ${health.riskLevel}
- Total Value: $${health.totalValueUSD.toFixed(2)}
- Position Count: ${health.positionCount}
- Correlation Cluster: ${health.cluster.exposurePct}% exposed to ${health.cluster.token}
- Stress Test: If ${health.stress.asset} drops ${Math.abs(health.stress.pct)}%, user loses ~$${health.stress.atRiskUSD}

Key Insights:
${health.insights.map(i => `- ${i.title}: ${i.description}`).join("\n")}

Generate a plain-English explanation (3-4 sentences) that:
1. Explains the correlation risk in visceral terms
2. Uses the "you think you have X positions, but really one bet" framing
3. Mentions the dollar amount at risk
4. Ends with a question like "Want me to guard it?" or "Should I de-risk this?"

Keep it conversational, direct, and money-focused (not math-focused).
      `.trim();

      const { text } = await generateText({
        model: model(),
        prompt,
      });

      return text;
    } catch (err) {
      console.error("[AI] Failed to generate insights:", err);
      return generateFallbackInsight(health);
    }
  },

  /**
   * Understand user intent from natural language message.
   */
  async parseIntent(message: string): Promise<{
    intent: "check" | "simulate" | "fix" | "guard" | "explain" | "unknown";
    params?: { asset?: string; pct?: number };
  }> {
    if (!isEnabled()) {
      return parseIntentFallback(message);
    }

    try {
      const schema = z.object({
        intent: z.enum(["check", "simulate", "fix", "guard", "explain", "unknown"]),
        asset: z.string().optional(),
        pct: z.number().optional(),
      });

      const { object } = await generateObject({
        model: model(),
        schema,
        prompt: `
Parse the user's intent from this message: "${message}"

Intent types:
- check: User wants to diagnose their portfolio health
- simulate: User wants to stress-test a scenario
- fix: User wants to rebalance
- guard: User wants autonomous protection
- explain: User wants more explanation
- unknown: None of the above

Return JSON with intent and optional params.
        `.trim(),
      });

      return {
        intent: object.intent,
        params: object.asset || object.pct ? { asset: object.asset, pct: object.pct } : undefined,
      };
    } catch (err) {
      console.error("[AI] Failed to parse intent:", err);
      return parseIntentFallback(message);
    }
  },
};

// Fallback insight generator (template-based)
function generateFallbackInsight(health: PortfolioHealth): string {
  const riskEmoji = health.riskLevel === "green" ? "✅" : health.riskLevel === "amber" ? "⚠️" : "🚨";
  return `${riskEmoji} You have ${health.positionCount} LP positions, but they're really one bet - ${health.cluster.exposurePct}% ${health.cluster.token}. If ${health.cluster.token} drops ${Math.abs(health.stress.pct)}%, you lose about $${Math.round(health.stress.atRiskUSD)} across all of them at once. Want me to guard it?`;
}

// Fallback intent parser (regex-based)
function parseIntentFallback(message: string): {
  intent: "check" | "simulate" | "fix" | "guard" | "explain" | "unknown";
  params?: { asset?: string; pct?: number };
} {
  const lower = message.toLowerCase();
  
  if (/(am i safe|check|diagnose|health|risky)/i.test(lower)) {
    return { intent: "check" };
  }
  if (/(simulate|stress|what if|shock)/i.test(lower)) {
    const assetMatch = lower.match(/(eth|btc|sui|usdc|usdt)/i);
    const pctMatch = lower.match(/(-?\d+)%?/);
    return {
      intent: "simulate",
      params: {
        asset: assetMatch?.[1]?.toUpperCase() || "ETH",
        pct: pctMatch ? parseInt(pctMatch[1]) : -10,
      },
    };
  }
  if (/(fix|rebalance|de-risk)/i.test(lower)) {
    return { intent: "fix" };
  }
  if (/(guard|protect|autopilot|autonomous)/i.test(lower)) {
    return { intent: "guard" };
  }
  if (/(why|explain|how|what)/i.test(lower)) {
    return { intent: "explain" };
  }
  
  return { intent: "unknown" };
}