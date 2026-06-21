import { useState } from "react";
import { useDAppKit, useWalletConnection, useWallets } from "@mysten/dapp-kit-react";

function shortAddr(addr: string): string {
  return addr.length <= 10 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const dAppKit = useDAppKit();
  const wallets = useWallets();
  const connection = useWalletConnection();
  const [isPending, setIsPending] = useState(false);

  const slushWallet = wallets.find((wallet) => wallet.name.toLowerCase().includes("slush"));
  const primaryWallet = slushWallet ?? wallets[0];
  const address = connection.account?.address;

  async function handleConnect() {
    if (!primaryWallet || isPending) return;
    setIsPending(true);
    try {
      await dAppKit.connectWallet({ wallet: primaryWallet });
    } finally {
      setIsPending(false);
    }
  }

  async function handleDisconnect() {
    if (isPending) return;
    setIsPending(true);
    try {
      await dAppKit.disconnectWallet();
    } finally {
      setIsPending(false);
    }
  }

  if (connection.isConnected && address) {
    return (
      <button
        type="button"
        onClick={handleDisconnect}
        className="btn btn-ghost"
        style={{ padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono)" }}
        title={`${address} on Sui`}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--healthy)",
            boxShadow: "0 0 6px var(--healthy-glow)",
            display: "inline-block",
          }}
        />
        {shortAddr(address)}
        <span style={{ color: "var(--text-tertiary)", fontSize: 10, marginLeft: 4 }}>
          Slush
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isPending || connection.isConnecting || connection.isReconnecting || !primaryWallet}
      className="btn btn-primary"
      style={{ padding: "10px 14px", fontSize: 13 }}
      title={primaryWallet ? `Connect ${primaryWallet.name}` : "No Sui wallet found"}
    >
      {isPending || connection.isConnecting || connection.isReconnecting
        ? "connecting…"
        : primaryWallet
          ? "Connect Slush"
          : "Install Slush"}
    </button>
  );
}
