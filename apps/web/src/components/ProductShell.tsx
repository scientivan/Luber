import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "./AppHeader";

export function ProductShell({ title, subtitle, children, hideHero = false }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  hideHero?: boolean;
}) {
  return (
    <main className="product-page">
      <AppHeader
        subtitle="Liquidity risk agent"
        right={
          <>
          <Link to="/history">History</Link>
          <Link to="/status">Status</Link>
          <Link to="/docs">Docs</Link>
          </>
        }
      />
      {!hideHero && (
        <section className="product-shell">
          <div className="product-section-top">
            <span>Agentic liquidity control</span>
            <span>&lt;flow&gt; diagnose / inspect / approve &lt;/flow&gt;</span>
          </div>
          <div className="product-hero">
            <div className="product-hero-copy">
              <p className="product-kicker">Agentic liquidity control</p>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="product-hero-actions">
              <Link className="product-outline" to="/history">Open History</Link>
              <Link className="product-outline dark" to="/docs">Review Docs</Link>
            </div>
          </div>
        </section>
      )}
      <div className="product-content">{children}</div>
    </main>
  );
}
