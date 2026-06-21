import { matchIntent, type Intent } from "@lp-guardian/core";
import { strategist } from "./strategist.js";

export interface ChatReply {
  role: "agent";
  text: string;
  intent: Intent;
  payload?: unknown;
}

/**
 * Intent Router — maps a chat message (or MCP tool call) to one of the few
 * robust intents and produces a plain-English reply. NL surface is deliberately
 * narrow + backed by suggested-prompt chips (demo-safe).
 */
export async function routeMessage(walletAddress: string, message: string): Promise<ChatReply> {
  const intent = matchIntent(message);

  switch (intent) {
    case "check": {
      const h = await strategist.diagnose(walletAddress);
      return {
        role: "agent",
        intent,
        text: `Honestly? ${h.riskLevel === "green" ? "You're okay." : "No."} You have ${h.positionCount} LP positions, but they're really one bet — ${h.cluster.exposurePct}% ${h.cluster.token}. If ${h.cluster.token} drops 10%, you lose about $${Math.round(h.stress.atRiskUSD)} across all of them at once. Want me to guard it?`,
        payload: h,
      };
    }
    case "simulate": {
      const sim = await strategist.simulate(walletAddress, "ETH", -10);
      return {
        role: "agent",
        intent,
        text: `If ${sim.scenario.asset} drops ${Math.abs(sim.scenario.pct)}%, you lose about $${Math.round(sim.atRiskUSD)}. With Guard on, I'd save you about $${Math.round(sim.guarded.moneySaved)} of that.`,
        payload: sim,
      };
    }
    case "fix":
      return { role: "agent", intent, text: "I'll cut your ETH cluster from ~87% to ~40% into uncorrelated assets via DeepBook. Review the preview, then one signature.", payload: { needsSignature: true } };
    case "guard":
      return { role: "agent", intent, text: "To arm Guard, sign once to mint a revocable capability. I can rebalance, but I physically cannot withdraw your funds — enforced by Move, not by my promise.", payload: { needsSignature: true } };
    case "explain":
      return { role: "agent", intent, text: "Your positions look diversified, but their prices move together — so a single drop hits all of them at once. That hidden correlation is the real risk.", payload: undefined };
  }
}
