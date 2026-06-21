import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clipboard,
  Code2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles/docs.css";

const requirements = [
  "Node.js 20+",
  "MCP-compatible AI client or desktop app",
  "Sui wallet for authentication and transaction approval",
  "Access to Sui RPC",
  "Internet connection",
] as const;

const clients = [
  "Hermes agent",
  "OpenClaw",
  "Claude Desktop or MCP-compatible Claude workflows",
  "GPT / Codex workflows with MCP support",
  "Other MCP-compatible clients",
] as const;

const installSteps = [
  ["Clone repository", "git clone <repository-url>\ncd Luber"],
  ["Install workspace", "pnpm install"],
  ["Build MCP server", "pnpm build:mcp"],
  ["Run MCP server", "pnpm dev:mcp"],
] as const;

const mcpConfig = `{
  "mcpServers": {
    "Luber": {
      "command": "node",
      "args": ["/absolute/path/to/Luber/apps/mcp-server/dist/server.js"],
      "env": {
        "LPG_API_BASE": "http://localhost:8787",
        "LPG_WEB_BASE": "http://localhost:5173"
      }
    }
  }
}`;

const verifyToolCall = `diagnose_portfolio
walletAddress: 0x8a4...92f`;

const tools = [
  {
    name: "diagnose_portfolio",
    purpose: "Run a full portfolio health diagnosis for a Sui wallet.",
    params: [
      ["walletAddress", "string", "yes", "Sui wallet address to diagnose"],
    ],
  },
  {
    name: "deep_diagnose_pool",
    purpose: "Deep-dive into a single LP pool flagged as risky or bleeding.",
    params: [
      ["walletAddress", "string", "yes", "Owner wallet address"],
      ["poolId", "string", "yes", "Pool object ID from portfolio results"],
    ],
  },
  {
    name: "simulate_shock",
    purpose: "Simulate price shock impact across portfolio and compare Guard outcome.",
    params: [
      ["walletAddress", "string", "yes", "Wallet to simulate"],
      ["asset", "string", "yes", "Token symbol, for example ETH or SUI"],
      ["pct", "number", "yes", "Percentage move between -100 and 100"],
    ],
  },
  {
    name: "get_history",
    purpose: "Return previous Luber activity for a wallet.",
    params: [
      ["walletAddress", "string", "yes", "Wallet history owner"],
      ["filter", "enum", "no", "portfolio, pool, or all"],
    ],
  },
  {
    name: "arm_guard",
    purpose: "Open web link to mint revocable Guard capability with wallet approval.",
    params: [["walletAddress", "string", "yes", "Wallet to arm Guard for"]],
  },
] as const;

const securityRules = [
  "MCP can read and analyze public wallet and pool data.",
  "MCP does not access private keys.",
  "MCP does not silently execute transactions.",
  "Rebalance execution happens only in web flow.",
  "Transactions require explicit wallet approval before execution.",
] as const;

const troubleshooting = [
  [
    "MCP server not detected",
    ["Check config path", "Check command path", "Check Node.js version", "Restart client", "Inspect server logs"],
  ],
  [
    "Sui RPC connection failed",
    ["Check RPC URL", "Check network availability", "Check rate limits", "Try fallback provider"],
  ],
  [
    "AI client cannot call tool",
    ["Check MCP support", "Check tool name", "Check JSON schema", "Check server status"],
  ],
  [
    "Wallet authentication fails",
    ["Check wallet extension", "Check selected network", "Check rejected signature", "Check expired session"],
  ],
] as const;

const prompts = [
  "Diagnose my Sui LP portfolio for wallet 0x...",
  "Deep-dive on pool 0x... from my latest diagnosis.",
  "Simulate what happens if SUI drops 10%.",
  "Summarize my previous Luber diagnosis history.",
  "Open Guard setup for wallet 0x...",
] as const;

function CopyBlock({ code, language = "txt" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="docs-code-wrap">
      <div className="docs-code-top">
        <span>{language}</span>
        <button type="button" aria-label="Copy code" onClick={() => void handleCopy()}>
          <Clipboard aria-hidden="true" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ToolTable({
  name,
  purpose,
  params,
}: {
  name: string;
  purpose: string;
  params: readonly (readonly [string, string, string, string])[];
}) {
  return (
    <article className="docs-tool-card">
      <div className="docs-tool-head">
        <code>{name}</code>
        <span>{purpose}</span>
      </div>
      <div className="docs-table" role="table" aria-label={`${name} schema table`}>
        <div role="row">
          <b>Parameter</b>
          <b>Type</b>
          <b>Required</b>
          <b>Description</b>
        </div>
        {params.map(([parameter, type, required, description]) => (
          <div role="row" key={parameter}>
            <code>{parameter}</code>
            <span>{type}</span>
            <span>{required}</span>
            <span>{description}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

const docsSections = [
  ["intro", "Introduction"],
  ["getting-started", "Getting Started"],
  ["installation", "Installation"],
  ["configuration", "Configuration"],
  ["tools", "Agent Capabilities"],
  ["zod", "Zod Validation"],
  ["security", "Security Model"],
  ["troubleshooting", "Troubleshooting"],
  ["prompts", "Example Prompts"],
] as const;

export function Docs() {
  const [activeSection, setActiveSection] = useState<(typeof docsSections)[number][0]>("intro");

  useEffect(() => {
    const sections = docsSections
      .map(([id]) => document.getElementById(id))
      .filter((section): section is HTMLElement => section instanceof HTMLElement);

    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const pivot = 140;
      let nextActive: (typeof docsSections)[number][0] = docsSections[0][0];

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= pivot) {
          nextActive = section.id as (typeof docsSections)[number][0];
        }
      }

      setActiveSection(nextActive);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <main className="docs-theme">
      <header className="docs-header">
        <Link className="docs-brand" to="/">
          <img src="/luber-logo.webp" alt="Luber logo" />
          <span>
            <b>Luber</b>
            <small>Docs & Installation</small>
          </span>
        </Link>
        <nav aria-label="Docs navigation">
          <a href="#intro">Overview</a>
          <a href="#installation">Install MCP</a>
          <a href="#tools">Docs</a>
          <a href="#security">How It Works</a>
          <Link to="/">
            Launch App <ArrowUpRight aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <section className="docs-hero docs-grid-paper" id="intro">
        <div className="docs-kicker">
          <BookOpen aria-hidden="true" /> MCP + Sui LP Risk Docs
        </div>
        <h1>Install MCP. Diagnose with agent. Approve with wallet.</h1>
        <p>
          Model Context Protocol lets AI clients connect to external tools and data sources through a standardized interface.
          Luber uses MCP so compatible AI Agents can diagnose Sui LP positions without requiring users to expose private keys.
        </p>
        <p className="docs-security-note">
          MCP tools can diagnose positions, but transaction execution happens through web app flow and still requires explicit Sui Wallet approval.
        </p>
        <div className="docs-hero-actions">
          <a href="#installation">
            Install MCP <ArrowUpRight aria-hidden="true" />
          </a>
          <Link to="/">
            <ArrowLeft aria-hidden="true" /> Back to landing
          </Link>
        </div>
      </section>

      <section className="docs-map" aria-label="Documentation map">
        <article>
          <Code2 aria-hidden="true" />
          <b>MCP Server</b>
          <span>Expose portfolio diagnosis, deep pool diagnosis, shock simulation, history, and Guard setup.</span>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" />
          <b>Evidence Path</b>
          <span>Return structured risk output, validated inputs, technical metadata, and report provenance links.</span>
        </article>
        <article>
          <WalletCards aria-hidden="true" />
          <b>Wallet Gate</b>
          <span>Diagnosis stays read-only until user chooses web flow and approves transaction in wallet.</span>
        </article>
      </section>

      <section className="docs-body">
        <aside className="docs-rail" aria-label="Docs contents">
          <span>Contents</span>
          {docsSections.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={activeSection === id ? "is-active" : undefined}
              aria-current={activeSection === id ? "location" : undefined}>
              {label}
            </a>
          ))}
        </aside>

        <div className="docs-panels">
          <section className="docs-panel" id="getting-started">
            <div className="docs-panel-top">
              <span>01 / GETTING STARTED</span>
              <CheckCircle2 aria-hidden="true" />
            </div>
            <h2>Requirements and client fit.</h2>
            <p>Use “supported” only for clients you have tested. For broader coverage, say MCP-compatible clients.</p>
            <div className="docs-two-col">
              <div className="docs-cell-block">
                <h3>Requirements</h3>
                <ul className="docs-list-grid">
                  {requirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="docs-cell-block">
                <h3>MCP-compatible clients</h3>
                <ul className="docs-list-grid">
                  {clients.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="docs-panel" id="installation">
            <div className="docs-panel-top">
              <span>02 / INSTALLATION</span>
              <CheckCircle2 aria-hidden="true" />
            </div>
            <h2>Install from repository today.</h2>
            <p>Workspace commands stay source-of-truth until packaged binary exists.</p>
            <div className="docs-step-list">
              {installSteps.map(([title, code], index) => (
                <article key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <CopyBlock code={code} language="bash" />
                </article>
              ))}
            </div>
          </section>

          <section className="docs-panel" id="configuration">
            <div className="docs-panel-top">
              <span>03 / CONFIGURATION</span>
              <CheckCircle2 aria-hidden="true" />
            </div>
            <h2>Register Luber in <code>mcp_config.json</code>.</h2>
            <p>Add server entry, restart AI client, then confirm Luber shows up in available MCP tools.</p>
            <CopyBlock code={mcpConfig} language="json" />
            <div className="docs-two-col docs-notes-grid">
              <div className="docs-callout">
                <h3>Config notes</h3>
                <ul>
                  <li>Config file location depends on client.</li>
                  <li>Use absolute path to built server file.</li>
                  <li>Restart client after config changes.</li>
                </ul>
              </div>
              <div className="docs-callout">
                <h3>Quick verification</h3>
                <p>Run one simple tool call after restart.</p>
                <CopyBlock code={verifyToolCall} />
              </div>
            </div>
          </section>

          <section className="docs-panel" id="tools">
            <div className="docs-panel-top">
              <span>04 / AGENT CAPABILITIES</span>
              <CheckCircle2 aria-hidden="true" />
            </div>
            <h2>MCP exposes diagnosis, not custody.</h2>
            <p>Tool list below matches current MCP server implementation.</p>
            <div className="docs-tool-list">
              {tools.map((tool) => (
                <ToolTable key={tool.name} name={tool.name} purpose={tool.purpose} params={tool.params} />
              ))}
            </div>
          </section>

          <section className="docs-panel" id="zod">
            <div className="docs-panel-top">
              <span>05 / ZOD VALIDATION</span>
              <CheckCircle2 aria-hidden="true" />
            </div>
            <h2>Invalid inputs stop before analysis.</h2>
            <p>
              Luber validates MCP tool inputs before running diagnosis logic. Invalid wallet addresses, missing pool identifiers, and unsupported values are rejected before analysis begins.
            </p>
          </section>

          <section className="docs-panel" id="security">
            <div className="docs-panel-top">
              <span>06 / SECURITY MODEL</span>
              <CheckCircle2 aria-hidden="true" />
            </div>
            <h2>AI Agent reads. Sui Wallet approves.</h2>
            <ul className="docs-rule-list">
              {securityRules.map((rule) => (
                <li key={rule}>
                  <ShieldCheck aria-hidden="true" />
                  {rule}
                </li>
              ))}
            </ul>
            <p className="docs-footnote">Luber provides risk analysis, not financial advice.</p>
          </section>

          <section className="docs-panel" id="troubleshooting">
            <div className="docs-panel-top">
              <span>07 / TROUBLESHOOTING</span>
              <CheckCircle2 aria-hidden="true" />
            </div>
            <h2>Fast checks for common failures.</h2>
            <div className="docs-issue-grid">
              {troubleshooting.map(([title, checks]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <ul>
                    {checks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="docs-panel" id="prompts">
            <div className="docs-panel-top">
              <span>08 / EXAMPLE PROMPTS</span>
              <CheckCircle2 aria-hidden="true" />
            </div>
            <h2>Prompts your AI Agent can run.</h2>
            <div className="docs-prompt-list">
              {prompts.map((prompt) => (
                <CopyBlock key={prompt} code={prompt} />
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="docs-guardrails">
        <div>
          <span>Safety contract</span>
          <h2>Agents diagnose. Wallets approve.</h2>
        </div>
        <ul>
          {securityRules.map((item) => (
            <li key={item}>
              <CheckCircle2 aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
