import { ArrowRight, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const navItems = [
  ["Overview", "overview"],
  ["Install MCP", "install"],
  ["How it works", "flow"],
  ["Demo", "demo"],
  ["Docs", "docs"],
] as const;

type LandingSectionId = (typeof navItems)[number][1];

export function OverflowHeader({
  activeSection,
  mobileMenuOpen,
  onToggleMenu,
  onNavigate,
}: {
  activeSection?: LandingSectionId;
  mobileMenuOpen?: boolean;
  onToggleMenu?: () => void;
  onNavigate?: (sectionId: LandingSectionId) => void;
}) {
  const nav = useNavigate();
  const handleNavigate = (id: LandingSectionId) => {
    if (onNavigate) {
      onNavigate(id);
    } else {
      nav(`/#${id}`);
    }
  };

  return (
    <header className="of-header">
      <Link to="/" className="of-header-brand" onClick={() => handleNavigate("overview")}>
        <img className="of-header-logo" src="/luber-logo.webp" alt="Luber logo" />
        <span>
          <strong>Luber</strong>
          <small>for Sui Overflow 2026</small>
        </span>
      </Link>
      <div className="of-header-actions">
        <div className="of-header-status">
          <span>Network</span>
          <b>
            <i /> Operational
          </b>
        </div>
        <Link className="of-header-history" to="/history">
          Diagnostic History
        </Link>
        <Link className="of-header-launch" to="/history">
          <span className="of-header-launch-icon" aria-hidden="true">
            <ArrowRight />
          </span>
          <span className="of-header-launch-label">Launch App</span>
        </Link>
      </div>
      {onToggleMenu && (
        <button
          className="of-menu-button"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-section-menu"
          aria-label={mobileMenuOpen ? "Close section menu" : "Open section menu"}
          onClick={onToggleMenu}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      )}
      {onNavigate && (
        <div id="mobile-section-menu" className={`of-mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
          {navItems.map(([label, id]) => (
            <button
              key={id}
              className={activeSection === id ? "active" : ""}
              type="button"
              onClick={() => handleNavigate(id)}
            >
              {label}
            </button>
          ))}
          <Link to="/history">History</Link>
          <Link to="/history">Launch App</Link>
        </div>
      )}
    </header>
  );
}
