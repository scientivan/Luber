import { CodeBlock } from "../../components/CodeBlock";

export function DocsSecurity() {
  return (
    <div className="min-h-full flex flex-col of-grid-paper" style={{ background: 'color-mix(in srgb, var(--of-orange) 4%, var(--of-paper))' }}>
      <div className="of-section-top">
        <span style={{ color: 'var(--of-ink)' }}>Security & Validation</span>
        <span>&lt;docs&gt; boundaries &lt;/docs&gt;</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16 text-base flex-1 w-full space-y-12 pb-12">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-none" style={{ color: 'var(--of-ink)' }}>Security & Validation</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--of-muted)' }}>
            LPGuardian is built with strict separation of concerns, ensuring your assets remain safe while giving AI agents deep analytical access.
          </p>
        </div>

        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Zod Validation</h2>
          <div className="p-6" style={{ background: 'var(--of-ink)', color: 'var(--of-paper)' }}>
            <p className="leading-relaxed">
              LPGuardian validates MCP tool inputs with <span className="font-bold" style={{ color: 'var(--of-blue)' }}>Zod</span> before running diagnosis logic. Invalid wallet addresses, missing pool identifiers, and unsupported network values are rejected before analysis begins.
            </p>
          </div>
          <p className="mt-4" style={{ color: 'var(--of-muted)' }}>
            This strict runtime type validation prevents malformed requests from reaching the Sui RPC and ensures the AI agent understands exactly why a request failed so it can correct itself.
          </p>
        </div>

        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Security Model</h2>
          <p style={{ color: 'var(--of-muted)' }}>LPGuardian separates diagnosis (MCP) from execution (Web App).</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="p-5" style={{ border: 'var(--of-line)', borderTopWidth: '4px', borderTopColor: 'var(--of-mint)', background: 'var(--of-paper)' }}>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--of-mint)' }}>What MCP Can Do</h4>
              <ul className="space-y-3 text-sm" style={{ color: 'var(--of-muted)' }}>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--of-mint)' }} />
                  Read and analyze public on-chain data
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--of-mint)' }} />
                  Identify out-of-range positions
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--of-mint)' }} />
                  Provide structured risk assessments
                </li>
              </ul>
            </div>
            
            <div className="p-5" style={{ border: 'var(--of-line)', borderTopWidth: '4px', borderTopColor: 'var(--of-orange)', background: 'var(--of-paper)' }}>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--of-orange)' }}>What MCP CANNOT Do</h4>
              <ul className="space-y-3 text-sm" style={{ color: 'var(--of-muted)' }}>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--of-orange)' }} />
                  Access private keys or seed phrases
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--of-orange)' }} />
                  Silently execute transactions
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--of-orange)' }} />
                  Move funds without wallet approval
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="p-6 mt-10" style={{ border: 'var(--of-line)', borderLeftWidth: '6px', borderLeftColor: 'var(--of-blue)', background: 'var(--of-warm)' }}>
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--of-blue)' }}>
            Execution Flow
          </h3>
          <p style={{ color: 'var(--of-ink)' }}>
            Rebalance execution happens <strong>only in the web app</strong>. Wallet approval is required through <span className="font-mono text-[12px] px-1 rounded bg-[rgba(0,0,0,0.05)]">sui:signAndExecuteTransaction</span> for any action that modifies your LP positions.
          </p>
        </div>
      </div>
    </div>
  );
}
