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
      <section className="product-auth product-grid-paper">
        <div className="product-auth-panel">
          <span className="product-kicker product-kicker-badge">Web3 authentication</span>
          <h2>Connect The Linked Wallet To Continue.</h2>
          <p>This page is bound to <b>{expected.slice(0, 10)}…{expected.slice(-6)}</b>. Connect that exact wallet to inspect diagnosis details or continue protected actions.</p>
          <div className="product-auth-actions">
            <button
              className="product-primary"
              onClick={() => wallets[0] && dAppKit.connectWallet({ wallet: wallets[0] })}
            >
              Connect wallet
            </button>
          </div>
        </div>
      </section>
    );
  }

  const connected = normalize(account.address);
  const target = normalize(expected);

  if (connected !== target) {
    return (
      <section className="product-auth product-grid-paper">
        <div className="product-auth-panel mismatch">
          <span className="product-kicker product-kicker-badge">Wallet mismatch</span>
          <h2>Connected Wallet Does Not Match This Diagnosis Link.</h2>
          <p>
            Connected: <b>{account.address.slice(0, 10)}…{account.address.slice(-6)}</b>
          </p>
          <p>
            Expected: <b>{expected.slice(0, 10)}…{expected.slice(-6)}</b>
          </p>
          <p>
            Disconnect and reconnect with the correct wallet, or switch accounts in your wallet extension.
          </p>
          <div className="product-auth-actions">
            <button className="product-outline" onClick={() => dAppKit.disconnectWallet()}>
              Disconnect
            </button>
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
