import { createHash, randomUUID } from "node:crypto";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import type { RebalancePlan } from "@lp-guardian/core";
import { config, normalizeAddress } from "../config.js";
import { supabase } from "./supabaseClient.js";

const stableHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function approvalMessage(params: {
  walletAddress: string;
  planId: string;
  planHash: string;
  expiresAt: string;
}) {
  return [
    "Luber rebalance approval",
    `Wallet: ${normalizeAddress(params.walletAddress)}`,
    `Plan: ${params.planId}`,
    `Plan hash: ${params.planHash}`,
    `Expires: ${params.expiresAt}`,
    "Purpose: authorize the Luber strategist to execute this exact plan once.",
  ].join("\n");
}

export async function createIntent(params: {
  walletAddress: string;
  portfolioId: string;
  sessionId: string;
  plan: RebalancePlan;
}) {
  const wallet = normalizeAddress(params.walletAddress);
  const planId = randomUUID();
  const expiresAt = new Date(Date.now() + config.auth.rebalanceIntentTtlMs).toISOString();
  const planHash = stableHash(params.plan);
  const { error } = await supabase.admin.from("rebalance_intents").insert({
    id: planId,
    wallet_address: wallet,
    portfolio_id: params.portfolioId,
    session_id: params.sessionId,
    plan_hash: planHash,
    plan: params.plan,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Failed to create rebalance intent: ${error.message}`);
  return {
    planId,
    preview: params.plan.preview,
    steps: params.plan.steps,
    expectedHealthRange: params.plan.expectedHealthRange,
    approvalMessage: approvalMessage({ walletAddress: wallet, planId, planHash, expiresAt }),
    expiresAt,
  };
}

export async function consumeIntent(params: {
  planId: string;
  walletAddress: string;
  sessionId: string;
  signature: string;
}) {
  const wallet = normalizeAddress(params.walletAddress);
  const { data, error } = await supabase.admin
    .from("rebalance_intents")
    .select("*")
    .eq("id", params.planId)
    .single();
  if (error || !data) throw new Error("Rebalance plan not found");
  if (data.consumed_at) throw new Error("Rebalance plan already used");
  if (data.session_id !== params.sessionId) throw new Error("Rebalance plan session mismatch");
  if (normalizeAddress(data.wallet_address) !== wallet) throw new Error("Rebalance plan wallet mismatch");
  if (new Date(data.expires_at).getTime() <= Date.now()) throw new Error("Rebalance plan expired");
  if (stableHash(data.plan) !== data.plan_hash) throw new Error("Stored rebalance plan failed integrity check");

  const message = approvalMessage({
    walletAddress: wallet,
    planId: data.id,
    planHash: data.plan_hash,
    expiresAt: data.expires_at,
  });
  const publicKey = await verifyPersonalMessageSignature(new TextEncoder().encode(message), params.signature);
  if (normalizeAddress(publicKey.toSuiAddress()) !== wallet) throw new Error("Rebalance approval signer mismatch");

  const consumedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase.admin
    .from("rebalance_intents")
    .update({ consumed_at: consumedAt })
    .eq("id", params.planId)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (claimError || !claimed) throw new Error("Rebalance plan was already claimed");
  return {
    portfolioId: data.portfolio_id as string,
    plan: data.plan as RebalancePlan,
  };
}
