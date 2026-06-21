import { useDAppKit } from "@mysten/dapp-kit-react";
import { createAuthChallenge, verifyAuth } from "./api.js";

const sessionKey = (walletAddress: string) => `luber:session:${walletAddress.toLowerCase()}`;

export function getSessionToken(walletAddress: string): string | null {
  return sessionStorage.getItem(sessionKey(walletAddress));
}

export function clearSessionToken(walletAddress: string) {
  sessionStorage.removeItem(sessionKey(walletAddress));
}

export function useWalletAuth() {
  const dAppKit = useDAppKit();

  async function authenticate(walletAddress: string): Promise<string> {
    const existing = getSessionToken(walletAddress);
    if (existing) return existing;
    const challenge = await createAuthChallenge(walletAddress);
    const signed = await dAppKit.signPersonalMessage({
      message: new TextEncoder().encode(challenge.message),
    });
    const session = await verifyAuth(walletAddress, challenge.nonce, signed.signature);
    sessionStorage.setItem(sessionKey(walletAddress), session.sessionToken);
    return session.sessionToken;
  }

  return { authenticate };
}
