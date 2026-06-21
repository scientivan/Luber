import { Outlet, NavLink } from "react-router-dom";
import { ArrowRight, BookOpen, Terminal, Shield, Wrench, FileCode2 } from "lucide-react";
import { AnimatedLinkButton } from "./AnimatedLinkButton";
import "../styles/landing.css";

export function DocsLayout() {
  const navItems = [
    { name: "Introduction", path: "/docs", exact: true, icon: <BookOpen size={14} />, color: 'var(--of-blue)' },
    { name: "Installation", path: "/docs/install", exact: false, icon: <Terminal size={14} />, color: 'var(--of-mint)' },
    { name: "Configuration", path: "/docs/config", exact: false, icon: <Wrench size={14} />, color: 'var(--of-yellow)' },
    { name: "Agent Capabilities", path: "/docs/tools", exact: false, icon: <FileCode2 size={14} />, color: 'var(--of-pink)' },
    { name: "Security & Zod", path: "/docs/security", exact: false, icon: <Shield size={14} />, color: 'var(--of-orange)' },
    { name: "Troubleshooting", path: "/docs/troubleshoot", exact: false, icon: <Wrench size={14} />, color: 'var(--of-violet)' },
  ];

  return (
    <div className="overflow-theme flex flex-col md:flex-row min-h-screen" style={{ paddingTop: 0, paddingBottom: 0 }}>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4" style={{ borderBottom: 'var(--of-line)' }}>
        <div className="flex items-center gap-2 font-bold text-lg" style={{ color: 'var(--of-ink)' }}>
          <img src="/lp-guardian-logo.webp" alt="LPGuardian" className="w-6 h-6 object-contain" />
          LPGuardian Docs
        </div>
        <NavLink to="/" className="text-sm font-bold opacity-60 hover:opacity-100 uppercase" style={{ color: 'var(--of-ink)' }}>
          Back to App
        </NavLink>
      </div>

      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 lg:w-72 shrink-0 hidden md:flex flex-col h-screen sticky top-0 self-start" style={{ borderRight: 'var(--of-line)', background: 'var(--of-paper)' }}>
        <div className="p-6" style={{ borderBottom: 'var(--of-line)' }}>
          <NavLink to="/" className="flex items-center gap-3 font-bold text-xl no-underline" style={{ color: 'var(--of-ink)' }}>
            <img src="/lp-guardian-logo.webp" alt="LPGuardian" className="w-8 h-8 object-contain" />
            <div className="flex flex-col leading-none">
              <span>LPGuardian</span>
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-50 mt-1">Docs</span>
            </div>
          </NavLink>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `of-nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-bold uppercase tracking-wide no-underline transition-all ${
                  isActive ? "is-active" : "opacity-70"
                }`
              }
              style={
                {
                  '--nav-color': item.color,
                } as React.CSSProperties
              }
            >
              <span className="of-nav-icon">
                {item.icon}
              </span>
              <span className="of-nav-text">{item.name}</span>
            </NavLink>
          ))}
        </div>

        <div className="mt-auto flex" style={{ borderTop: 'var(--of-line)' }}>
          <AnimatedLinkButton
            to="/"
            label="Back to App"
            direction="left"
            className="w-full flex-1"
            style={{ borderLeft: 'none' }}
          />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 overflow-y-auto w-full relative z-10" id="docs-main-scroll">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
