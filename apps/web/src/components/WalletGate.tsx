import type { ReactNode } from "react";
import { useCurrentAccount, useDAppKit, useWallets } from "@mysten/dapp-kit-react";

function normalize(addr: string): string {
  const hex = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + hex.padStart(64, "0");
}

export function WalletGate({
  expected,
  children,
}: {
  expected: string;
  children: ReactNode;
}) {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const dAppKit = useDAppKit();

  if (!account) {
    return (
      <section className="panel" style={{ textAlign: "center", padding: 40 }}>
        <h2>Connect your wallet</h2>
        <p>This page requires wallet <b>{expected.slice(0, 10)}…{expected.slice(-6)}</b> to be connected.</p>
        <button
          className="button primary"
          onClick={() => wallets[0] && dAppKit.connectWallet({ wallet: wallets[0] })}
        >
          Connect wallet
        </button>
      </section>
    );
  }

  const connected = normalize(account.address);
  const target = normalize(expected);

  if (connected !== target) {
    return (
      <section className="panel" style={{ textAlign: "center", padding: 40 }}>
        <h2>Wallet mismatch</h2>
        <p>
          Connected: <b>{account.address.slice(0, 10)}…{account.address.slice(-6)}</b>
        </p>
        <p>
          Expected: <b>{expected.slice(0, 10)}…{expected.slice(-6)}</b>
        </p>
        <p style={{ color: "#777", marginTop: 12 }}>
          Disconnect and reconnect with the correct wallet, or switch accounts in your wallet extension.
        </p>
        <button className="button" onClick={() => dAppKit.disconnectWallet()}>
          Disconnect
        </button>
      </section>
    );
  }

  return <>{children}</>;
}
