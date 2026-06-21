import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function ProductShell({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="product-page">
      <header className="product-header">
        <Link to="/" className="product-brand">
          <img src="/luber-logo.webp" alt="Luber" />
          <span><b>Luber</b><small>Liquidity risk agent</small></span>
        </Link>
        <nav>
          <Link to="/atlas">History</Link>
          <Link to="/status">Status</Link>
          <Link to="/docs">Docs</Link>
        </nav>
      </header>
      <section className="product-hero">
        <p className="product-kicker">Agentic liquidity control</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </section>
      <div className="product-content">{children}</div>
    </main>
  );
}
