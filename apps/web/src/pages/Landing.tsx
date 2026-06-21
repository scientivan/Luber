import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  ExternalLink,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { HoverGridBackground } from "../components/HoverGridBackground";
import { LandingActionButton } from "../components/LandingActionButton";
import "../styles/landing.css";

const navItems = [
  ["Overview", "overview"],
  ["Install MCP", "install"],
  ["How it works", "flow"],
  ["Demo", "demo"],
  ["Docs", "docs"],
] as const;

const integrations = ["Hermes", "OpenClaw", "Claude", "GPT / Codex", "Local agents"];

const steps = [
  ["01", "Install MCP Server", "Add LPGuardian to the AI client or agent you already use."],
  ["02", "Enter Wallet Address", "Ask your agent to inspect a Slush wallet or a specific Cetus pool."],
  ["03", "Get LLM Diagnosis", "Receive structured portfolio or pool risk analysis with evidence."],
  ["04", "Execute Safely on Web", "Review, sign, and execute rebalance actions through Slush."],
];

const features = [
  ["01", "Impermanent Loss Analytics", "Estimate hidden loss exposure against fees, volatility, and range behavior.", "yellow"],
  ["02", "Web3 Authentication", "Sign a message with Slush to create a secure, passwordless session.", "mint"],
  ["03", "PTB Execution", "Bundle withdraw, swap, and deposit steps into one reviewable Sui transaction flow.", "orange"],
  ["04", "Portfolio Diagnosis", "Analyze detected LP positions and surface aggregate wallet risk.", "blue"],
  ["05", "Pool Diagnosis", "Inspect Cetus tick ranges, active-range status, and position-specific risk.", "lavender"],
  ["06", "Diagnostic History", "Compare stored AI diagnostics over time before taking action.", "violet"],
] as const;

const faqs = [
  ["Can an AI agent move my funds?", "No. MCP tools can diagnose public wallet and pool data, but transaction execution only happens in the web app after explicit Slush approval."],
  ["What can LPGuardian diagnose?", "LPGuardian can analyze portfolio-level LP risk and individual Cetus pools, including range activity, fee performance, volatility exposure, and suggested next steps."],
  ["Do I need to connect a wallet to run a diagnosis?", "An agent can inspect public wallet data from an address. Connecting a wallet is only needed for web authentication, diagnostic history, and approving execution."],
  ["Is LPGuardian financial advice?", "No. LPGuardian provides risk analysis, not financial advice. Slippage and market movement may affect any rebalance execution."],
] as const;

export function Landing() {
  const nav = useNavigate();
  const [activeSection, setActiveSection] = useState<(typeof navItems)[number][1]>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const heroArtRef = useRef<HTMLDivElement | null>(null);
  const demoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowIntro(false), 2350);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!showIntro) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showIntro]);

  useEffect(() => {
    const sectionIds = navItems.map(([, id]) => id);
    const updateActiveSection = () => {
      const probeY = window.scrollY + 180;
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const section = document.getElementById(id);
        if (section && section.offsetTop <= probeY) current = id;
      }
      setActiveSection(current);
    };
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  const scrollToSection = (sectionId: (typeof navItems)[number][1]) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const header = document.querySelector<HTMLElement>(".of-header");
    const offset = window.matchMedia("(max-width: 680px)").matches ? (header?.offsetHeight ?? 0) : 0;
    setMobileMenuOpen(false);
    setActiveSection(sectionId);
    window.history.replaceState(null, "", `#${sectionId}`);
    window.scrollTo({ top: Math.max(section.offsetTop - offset, 0), behavior: "smooth" });
  };

  return (
    <main className={`overflow-theme ${showIntro ? "intro-running" : "intro-done"}`}>
      {showIntro ? <LandingIntro /> : null}
      <OverflowHeader activeSection={activeSection} mobileMenuOpen={mobileMenuOpen} onToggleMenu={() => setMobileMenuOpen((value) => !value)} onNavigate={scrollToSection} />

      <section className="of-hero-flow of-grid-paper">
        <div className="of-hero-flow-copy">
          <section id="overview" className="of-hero-copy">
            <p className="of-kicker"><span>Sui Overflow 2026</span> AI × DeFi infrastructure</p>
            <h1>LP Guardian</h1>
            <h2>Universal AI assistant for Sui liquidity risk.</h2>
            <p className="of-hero-text">Connect LPGuardian to your MCP-compatible AI agent, diagnose Cetus LP positions, review diagnostic history, and approve safer rebalance execution through Slush.</p>
            <div className="of-hero-actions">
              <LandingActionButton tone="dark" onClick={() => scrollToSection("install")}>Install MCP</LandingActionButton>
              <LandingActionButton tone="yellow" onClick={() => nav("/developers")}>Read documentation</LandingActionButton>
            </div>
            <div className="of-safety-notes">
              <p className="of-safety-line"><ShieldCheck size={17} strokeWidth={2.25} /> AI diagnosis does not move funds.</p>
              <p>Risk analysis, not financial advice.</p>
            </div>
          </section>

          <section id="install" className="of-compatible-copy-panel">
            <div className="of-section-top dark"><span>Compatible With</span><span>&lt;mcp&gt; connect the agent you already use &lt;/mcp&gt;</span></div>
            <div className="of-compatible-copy">
              <h2>LPGuardian plugs into the AI clients or local agents you already use.</h2>
              <p>LPGuardian runs through Model Context Protocol, so the install step feels native to Claude, GPT / Codex, Hermes, OpenClaw, and local agent workflows before diagnosis starts.</p>
              <div className="of-compatible-inline-list">{integrations.map((name) => <span key={name}>{name}</span>)}</div>
            </div>
          </section>
        </div>

        <aside className="of-hero-rail" aria-label="LPGuardian hero assets">
          <div ref={heroArtRef} className="of-asset-stage" aria-label="Sample LPGuardian diagnosis">
            <HoverGridBackground className="of-hover-grid-bg" gridClassName="of-hover-grid" squareSize={48} trailLength={8} targetRef={heroArtRef} />
            <img className="of-brand-text" src="/assets/lp-guardian-text.webp" alt="LPGuardian" />
          </div>
        </aside>
      </section>

      <section id="flow" className="of-flow of-grid-paper">
        <div className="of-section-top"><span>How it works</span><span>&lt;flow&gt; install / diagnose / review / approve &lt;/flow&gt;</span></div>
        <div className="of-section-heading"><h2>From agent insight to wallet-approved action.</h2><p>Install the MCP server, diagnose a wallet, review risk, then approve execution only in the web app.</p></div>
        <div className="of-flow-grid">{steps.map(([number, title, body], index) => <article className={`of-step step-${index}`} key={title}><span>{number}</span><h3>{title}</h3><p>{body}</p><ArrowRight aria-hidden="true" /></article>)}</div>
      </section>

      <section className="of-features">
        <div className="of-section-top dark"><span>Product surfaces</span><span>&lt;lp-risk&gt; explainable by default &lt;/lp-risk&gt;</span></div>
        <div className="of-section-heading"><h2>Everything needed to see risk before capital moves.</h2></div>
        <div className="of-feature-grid">{features.map(([number, title, body, tone], index) => <article className={`of-feature feature-${index} tone-${tone}`} key={title}><span>{number}</span><h3>{title}</h3><p>{body}</p><ArrowUpRight aria-hidden="true" /></article>)}</div>
      </section>

      <section ref={demoRef} id="demo" className="of-demo of-grid-paper">
        <HoverGridBackground className="of-hover-grid-bg of-demo-hover-grid-bg" gridClassName="of-hover-grid of-demo-hover-grid" squareSize={48} trailLength={10} targetRef={demoRef} />
        <div className="of-demo-copy"><p className="of-kicker">Demo & showcase</p><h2>Agent diagnoses. You approve.</h2><p>Short loop: ask, inspect, approve only when capital moves.</p><button className="of-inline-link" type="button" onClick={() => nav("/agent")}>View agent workspace <ExternalLink size={18} /></button></div>
        <div className="of-demo-chain" aria-label="LPGuardian workflow">
          <DemoPanel index="01" title="AI Client" body="Ask your agent to inspect a wallet." icon={<Code2 />} />
          <div className="of-chain-arrow" aria-hidden="true"><ArrowRight /></div>
          <DemoPanel index="02" title="LPGuardian MCP" body="Returns risk signals and evidence." icon={<Check />} />
          <div className="of-chain-arrow" aria-hidden="true"><ArrowRight /></div>
          <DemoPanel index="03" title="Web App" body="Review and sign with Slush." icon={<WalletCards />} />
        </div>
      </section>

      <section id="docs" className="of-stack">
        <div className="of-section-top"><span>Built With</span><span>&lt;stack&gt; Sui-first, agent-ready &lt;/stack&gt;</span></div>
        <div className="of-stack-content"><div><h2>Infrastructure you can inspect.</h2><p>Sui data, Cetus analytics, MCP tools, Zod schemas, and Slush-approved PTBs.</p></div><div className="of-stack-table">{["Sui Network", "Cetus Protocol", "MCP", "Zod", "Slush Wallet", "PTB Execution"].map((item, index) => <span key={item}><b>{String(index + 1).padStart(2, "0")}</b>{item}</span>)}</div></div>
      </section>

      <section className="of-faq">
        <div className="of-section-top dark"><span>FAQ</span><span>&lt;safety&gt; clear boundaries, explicit approval &lt;/safety&gt;</span></div>
        <div className="of-faq-list">{faqs.map(([question, answer]) => <FaqItem key={question} question={question} answer={answer} />)}</div>
      </section>

      <footer className="of-follow">
        <div className="of-follow-inner"><div><p className="of-kicker">Ready when your agent is.</p><h2>Install. Diagnose. Review. Rebalance.</h2></div><div className="of-follow-actions"><LandingActionButton tone="dark" size="follow" onClick={() => scrollToSection("install")}>Install MCP</LandingActionButton><button className="of-outline-button" type="button" onClick={() => nav("/atlas")}>Launch app <ArrowUpRight /></button></div></div>
        <div className="of-footer-links"><span>LPGuardian</span><Link to="/docs">Docs</Link><Link to="/docs/install">MCP Installation</Link><Link to="/atlas">Diagnostic History</Link><Link to="/agent">Network Status</Link></div>
      </footer>
    </main>
  );
}

function DemoPanel({ index, title, body, icon }: { index: string; title: string; body: string; icon: ReactNode }) {
  return <article className="of-demo-panel"><div><span>{index}</span>{icon}</div><h3>{title}</h3><p>{body}</p></article>;
}

function LandingIntro() { return <div className="of-intro" aria-hidden="true"><div className="of-intro-core"><img className="of-intro-logo" src="/lp-guardian-logo.webp" alt="" /></div></div>; }

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const answerId = useId();
  return <article className={`of-faq-item ${open ? "open" : ""}`}><button className="of-faq-trigger" type="button" aria-expanded={open} aria-controls={answerId} onClick={() => setOpen((value) => !value)}><span>{question}</span><ChevronDown aria-hidden="true" /></button><div id={answerId} className="of-faq-answer" aria-hidden={!open}><div><p>{answer}</p></div></div></article>;
}

function OverflowHeader({ activeSection, mobileMenuOpen, onToggleMenu, onNavigate }: { activeSection: (typeof navItems)[number][1]; mobileMenuOpen: boolean; onToggleMenu: () => void; onNavigate: (sectionId: (typeof navItems)[number][1]) => void }) {
  return <header className="of-header"><a href="#overview" className="of-header-brand"><img className="of-header-logo" src="/lp-guardian-logo.webp" alt="LPGuardian logo" /><span><strong>LPGuardian</strong><small>for Sui Overflow 2026</small></span></a><div className="of-header-actions"><div className="of-header-status"><span>Network</span><b><i /> Operational</b></div><a className="of-header-launch" href="/atlas"><span className="of-header-launch-icon" aria-hidden="true"><ArrowRight /></span><span className="of-header-launch-label">Launch App</span></a></div><button className="of-menu-button" type="button" aria-expanded={mobileMenuOpen} aria-controls="mobile-section-menu" aria-label="Open section menu" onClick={onToggleMenu}>Menu</button><div id="mobile-section-menu" className={`of-mobile-menu ${mobileMenuOpen ? "open" : ""}`}>{navItems.map(([label, id]) => <button key={id} className={activeSection === id ? "active" : ""} type="button" onClick={() => onNavigate(id)}>{label}</button>)}</div></header>;
}

