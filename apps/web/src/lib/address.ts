/**
 * Sui address helpers for wallet-gating deep-links.
 *
 * MCP tools embed a wallet address in the URL (e.g. /d/0xabc…). A page must only
 * render once the CONNECTED wallet matches that address — so we normalize both
 * sides before comparing (lowercase, 0x-prefixed, left-padded to 32 bytes).
 */
export function normalizeSuiAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  let hex = addr.trim().toLowerCase();
  if (hex.startsWith("0x")) hex = hex.slice(2);
  if (!/^[0-9a-f]+$/.test(hex)) return "";
  // Sui addresses are 32 bytes (64 hex chars); pad short forms for a stable compare.
  hex = hex.padStart(64, "0");
  return "0x" + hex;
}

export function addressesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeSuiAddress(a);
  const nb = normalizeSuiAddress(b);
  return na !== "" && na === nb;
}

export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  const n = normalizeSuiAddress(addr) || addr;
  return `${n.slice(0, 6)}…${n.slice(-4)}`;
}
