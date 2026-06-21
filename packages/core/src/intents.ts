// ─────────────────────────────────────────────────────────────────────────
// Chat intent layer — NL surface is restricted to a few robust intents
// + suggested-prompt chips that look conversational but are reliable buttons
// (demo-safe; avoids NL-parsing meltdown). See brief §F3.
// ─────────────────────────────────────────────────────────────────────────

export type Intent =
  | "check" // "am I safe?"
  | "fix" // "de-risk me"
  | "guard" // "guard it"
  | "explain" // "explain"
  | "simulate"; // "simulate shock"

export interface SuggestedPrompt {
  intent: Intent;
  label: string; // what the user sees on the chip
  utterance: string; // what gets sent as the message
}

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { intent: "check", label: "Am I safe?", utterance: "Am I safe?" },
  { intent: "simulate", label: "What if ETH −10%?", utterance: "Simulate ETH dropping 10%" },
  { intent: "fix", label: "De-risk me", utterance: "De-risk me" },
  { intent: "guard", label: "Guard it", utterance: "Guard it" },
  { intent: "explain", label: "Explain", utterance: "Explain the risk" },
];

/** Tiny deterministic intent matcher (keyword-based, not an LLM). */
export function matchIntent(message: string): Intent {
  const m = message.toLowerCase();
  if (/(guard|protect|autopilot|watch it)/.test(m)) return "guard";
  if (/(de-?risk|fix|rebalance|reduce)/.test(m)) return "fix";
  if (/(simulate|what if|shock|crash|drops?)/.test(m)) return "simulate";
  if (/(explain|why|how come)/.test(m)) return "explain";
  return "check";
}
