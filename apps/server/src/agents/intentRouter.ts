import { matchIntent, type Intent } from "@lp-guardian/core";
import { strategist } from "./strategist.js";
import { aiClient } from "../services/aiClient.js";

export interface ChatReply {
  role: "agent";
  text: string;
  intent: Intent;
  payload?: unknown;
}

/**
 * Intent Router - maps a chat message to an AI-based intent handler
 * and produces a plain-English reply using Gemini.
 */
export async function routeMessage(walletAddress: string, message: string): Promise<ChatReply> {
  // 1. Use AI to detect intent and extract parameters
  const parsed = await aiClient.parseIntent(message);
  const intent = parsed.intent === "unknown" ? matchIntent(message) : parsed.intent;

  switch (intent) {
    case "check": {
      const h = await strategist.diagnose(walletAddress);
      const aiText = await aiClient.generateInsights(h);
      
      const text = aiText || `Honestly? ${h.riskLevel === "green" ? "You're ok." : "No."} You have ${h.positionCount} LP positions, but they're really one bet - ${h.cluster.exposurePct}% ${h.cluster.token}. If ${h.cluster.token} drops 10%, you lose about $${Math.round(h.stress.atRiskUSD)} across all of them at once. Want me to guard it?`;
      
      return {
        role: "agent",
        intent,
        text,
        payload: h,
      };
    }

    case "simulate": {
      const asset = parsed.params?.asset || "ETH";
      const pct = parsed.params?.pct || -10;
      const sim = await strategist.simulate(walletAddress, asset, pct);
      
      return {
        role: "agent",
        intent,
        text: `If ${sim.scenario.asset} ${pct < 0 ? "drops" : "rises"} ${Math.abs(sim.scenario.pct)}%, you lose about $${Math.round(sim.atRiskUSD)}. With Guard on, I'd save you about $${Math.round(sim.guarded.moneySaved)} of that.`,
        payload: sim,
      };
    }

    case "fix":
      return { role: "agent", intent, text: "I'll cut your ETH cluster from ~87% to ~40% into uncorrelated assets via DeepBook. Review the preview, then one signature.", payload: { needsSignature: true } };
    case "guard":
      return { role: "agent", intent, text: "To arm Guard, sign once to mint a revocable capability. I can rebalance, but I physically cannot withdraw your funds - enforced by Move, not by my promise.", payload: { needsSignature: true } };
    case "explain":
      return { role: "agent", intent, text: "Your positions look diversified, but their prices move together - so a single drop hits all of them at once. That hidden correlation is the real risk.", payload: undefined };
    default:
      return { role: "agent", intent: "unknown" as Intent, text: "I can help you check portfolio health, simulate shocks, or set up autonomous Guard. Try asking 'am I safe?'", payload: undefined };
  }
}