import { createHash, randomBytes, randomUUID } from "node:crypto";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { config, normalizeAddress } from "../config.js";
import { supabase } from "./supabaseClient.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function authMessage(walletAddress: string, nonce: string, expiresAt: string): string {
  return [
    "Luber wallet sign-in",
    `Wallet: ${normalizeAddress(walletAddress)}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
    "Purpose: authenticate this browser session. This does not move funds.",
  ].join("\n");
}

export async function createChallenge(walletAddress: string) {
  const wallet = normalizeAddress(walletAddress);
  const nonce = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + config.auth.challengeTtlMs).toISOString();
  const { error } = await supabase.admin.from("auth_challenges").insert({
    nonce_hash: hash(nonce),
    wallet_address: wallet,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Failed to create auth challenge: ${error.message}`);
  return { nonce, message: authMessage(wallet, nonce, expiresAt), expiresAt };
}

export async function verifyChallenge(params: {
  walletAddress: string;
  nonce: string;
  signature: string;
}) {
  const wallet = normalizeAddress(params.walletAddress);
  const nonceHash = hash(params.nonce);
  const { data, error } = await supabase.admin
    .from("auth_challenges")
    .select("id, wallet_address, expires_at, used_at")
    .eq("nonce_hash", nonceHash)
    .single();
  if (error || !data) throw new Error("Invalid authentication challenge");
  if (data.used_at) throw new Error("Authentication challenge already used");
  if (new Date(data.expires_at).getTime() <= Date.now()) throw new Error("Authentication challenge expired");
  if (normalizeAddress(data.wallet_address) !== wallet) throw new Error("Challenge wallet mismatch");

  const message = authMessage(wallet, params.nonce, data.expires_at);
  const publicKey = await verifyPersonalMessageSignature(new TextEncoder().encode(message), params.signature);
  if (normalizeAddress(publicKey.toSuiAddress()) !== wallet) throw new Error("Signature does not match wallet");

  const sessionToken = `${randomUUID()}.${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + config.auth.sessionTtlMs).toISOString();
  const { error: sessionError } = await supabase.admin.from("auth_sessions").insert({
    token_hash: hash(sessionToken),
    wallet_address: wallet,
    expires_at: expiresAt,
  });
  if (sessionError) throw new Error(`Failed to create auth session: ${sessionError.message}`);
  await supabase.admin
    .from("auth_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { sessionToken, expiresAt, walletAddress: wallet };
}

export async function requireSession(authorization?: string) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new Error("Authentication required");
  const { data, error } = await supabase.admin
    .from("auth_sessions")
    .select("id, wallet_address, expires_at, revoked_at")
    .eq("token_hash", hash(token))
    .single();
  if (error || !data || data.revoked_at) throw new Error("Invalid session");
  if (new Date(data.expires_at).getTime() <= Date.now()) throw new Error("Session expired");
  return { id: data.id as string, walletAddress: normalizeAddress(data.wallet_address) };
}

export async function revokeSession(authorization?: string) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return;
  await supabase.admin
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hash(token));
}
