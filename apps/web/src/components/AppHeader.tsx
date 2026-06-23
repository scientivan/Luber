import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "../styles/app-header.css";

export function AppHeader({
  subtitle,
  right,
}: {
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <header className="app-header">
      <Link className="app-header-brand" to="/">
        <img src="/luber-logo.webp" alt="Luber logo" />
        <span>
          <b>Luber</b>
          <small>{subtitle}</small>
        </span>
      </Link>
      <div className="app-header-actions">{right}</div>
    </header>
  );
}
