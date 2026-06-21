import { CodeBlock } from "../../components/CodeBlock";

export function DocsIntro() {
  return (
    <div className="min-h-full flex flex-col of-grid-paper" style={{ background: 'color-mix(in srgb, var(--of-blue) 4%, var(--of-paper))' }}>
      <div className="of-section-top">
        <span style={{ color: 'var(--of-ink)' }}>Introduction</span>
        <span>&lt;docs&gt; overview &lt;/docs&gt;</span>
      </div>
      
      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16 text-base flex-1 w-full space-y-12 pb-12">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-none" style={{ color: 'var(--of-ink)' }}>Introduction</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--of-muted)' }}>
            Model Context Protocol lets AI clients connect to external tools and data sources through a standardized interface. LPGuardian uses MCP to let compatible AI agents diagnose Sui LP positions without requiring users to expose private keys.
          </p>
        </div>

        <div className="p-6" style={{ border: 'var(--of-line)', borderLeftWidth: '6px', borderLeftColor: 'var(--of-violet)', background: 'var(--of-warm)' }}>
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--of-violet)' }}>
            Security Note
          </h3>
          <p style={{ color: 'var(--of-ink)' }}>
            LPGuardian can analyze public wallet and pool data through MCP. Transaction execution still happens through the web app and requires explicit wallet approval.
          </p>
        </div>

        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Getting Started</h2>
          <p style={{ color: 'var(--of-muted)' }}>Before installing LPGuardian, ensure you have the following requirements:</p>
          
          <ul className="list-disc pl-5 space-y-2 mt-4" style={{ color: 'var(--of-ink)' }}>
            <li><strong>Node.js</strong> (v18 or higher recommended)</li>
            <li>Supported AI client or MCP-compatible desktop app</li>
            <li>Sui wallet for web authentication and transaction approval</li>
            <li>Access to Sui RPC</li>
            <li>Internet connection</li>
          </ul>
        </div>

        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Supported Clients</h2>
          <p style={{ color: 'var(--of-muted)' }}>LPGuardian can be connected to the following AI agents and clients:</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {[
              "Hermes agent",
              "OpenClaw",
              "Claude Desktop or MCP-compatible Claude workflows",
              "GPT/Codex workflows with MCP support",
              "Other MCP-compatible clients"
            ].map((client, idx) => (
              <div key={idx} className="p-4 flex items-center gap-3" style={{ border: 'var(--of-line)', background: 'var(--of-paper)' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--of-blue)' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--of-ink)' }}>{client}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
