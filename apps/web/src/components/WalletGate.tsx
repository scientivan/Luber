import { ReactNode } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { useCurrentAccount, useDAppKit, useWallets } from "@mysten/dapp-kit-react";
import { addressesMatch, shortAddress } from "../lib/address.js";

/**
 * Gates a deep-linked page behind a wallet-address check. MCP deep-links carry the
 * wallet the user asked the LLM about; this page must only reveal that wallet's data
 * once the SAME wallet is connected in the browser.
 *
 * - not connected      → Connect button
 * - connected, mismatch → warning + disconnect (so they can switch)
 * - connected, match    → render `children`
 */
export function WalletGate({
  expected,
  children,
  label = "this page",
}: {
  expected: string | undefined;
  children: ReactNode;
  label?: string;
}) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const wallets = useWallets();

  async function connect() {
    const wallet = wallets[0];
    if (!wallet) return;
    await dAppKit.connectWallet({ wallet });
  }
  async function disconnect() {
    await dAppKit.disconnectWallet();
  }

  // No expected address in the URL → nothing to gate against; render directly.
  if (!expected) return <>{children}</>;

  const connected = account?.address;

  if (!connected) {
    return (
      <div className="history-empty-state">
        <div className="panel history-empty-panel">
          <h2>Connect Wallet</h2>
          <p>
            Connect the wallet <code>{shortAddress(expected)}</code> to view {label}.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => connect()}
            style={{ width: "100%", justifyContent: "center", height: "48px", fontSize: "1.1rem" }}
          >
            Connect Wallet
          </button>
          <div className="history-safety-note">
            <ShieldCheck size={14} />
            Connecting does not move funds.
          </div>
        </div>
      </div>
    );
  }

  if (!addressesMatch(connected, expected)) {
    return (
      <div className="history-empty-state">
        <div className="panel history-empty-panel" style={{ borderColor: "var(--bleed)" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={20} color="var(--bleed)" /> Wrong wallet
          </h2>
          <p>
            You're connected as <code>{shortAddress(connected)}</code>, but {label} is for{" "}
            <code>{shortAddress(expected)}</code>.
          </p>
          <p style={{ opacity: 0.8 }}>
            Switch to the requested wallet in your extension, then reconnect.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => disconnect()}
            style={{ width: "100%", justifyContent: "center", height: "44px" }}
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
