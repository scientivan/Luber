export function DocsTroubleshoot() {
  return (
    <div className="min-h-full flex flex-col of-grid-paper" style={{ background: 'color-mix(in srgb, var(--of-violet) 4%, var(--of-paper))' }}>
      <div className="of-section-top">
        <span style={{ color: 'var(--of-ink)' }}>Troubleshooting</span>
        <span>&lt;docs&gt; common issues &lt;/docs&gt;</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16 text-base flex-1 w-full space-y-12 pb-12">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-none" style={{ color: 'var(--of-ink)' }}>Troubleshooting</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--of-muted)' }}>
            Solutions for common issues when running the LPGuardian MCP server or communicating with the Sui network.
          </p>
        </div>

        <div className="space-y-6 mt-6">
          {/* Issue 1 */}
          <div className="p-6" style={{ border: 'var(--of-line)', borderTopWidth: '4px', borderTopColor: 'var(--of-orange)', background: 'var(--of-paper)' }}>
            <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--of-ink)' }}>MCP server not detected</h3>
            <div className="space-y-3 text-sm" style={{ color: 'var(--of-muted)' }}>
              <p className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--of-orange)' }} />
                Check the configuration path in <span className="font-mono text-[12px] px-1 rounded bg-[rgba(0,0,0,0.05)]">mcp_config.json</span>
              </p>
              <p className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--of-orange)' }} />
                Ensure Node.js is installed and accessible in the system PATH
              </p>
              <p className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--of-orange)' }} />
                Fully restart the AI client application
              </p>
            </div>
          </div>

          {/* Issue 2 */}
          <div className="p-6" style={{ border: 'var(--of-line)', borderTopWidth: '4px', borderTopColor: 'var(--of-violet)', background: 'var(--of-paper)' }}>
            <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--of-ink)' }}>Sui RPC connection failed</h3>
            <div className="space-y-3 text-sm" style={{ color: 'var(--of-muted)' }}>
              <p className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--of-violet)' }} />
                Verify the RPC URL in your environment variables
              </p>
              <p className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--of-violet)' }} />
                Check network availability and rate limits on the public RPC
              </p>
              <p className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--of-violet)' }} />
                Consider using a fallback or private RPC provider
              </p>
            </div>
          </div>

          {/* Issue 3 */}
          <div className="p-6" style={{ border: 'var(--of-line)', borderTopWidth: '4px', borderTopColor: 'var(--of-mint)', background: 'var(--of-paper)' }}>
            <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--of-ink)' }}>Wallet authentication fails</h3>
            <div className="space-y-3 text-sm" style={{ color: 'var(--of-muted)' }}>
              <p className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--of-mint)' }} />
                Ensure a compatible Sui wallet extension is installed and unlocked
              </p>
              <p className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--of-mint)' }} />
                Check that your wallet is connected to the correct network (Mainnet vs Testnet)
              </p>
              <p className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--of-mint)' }} />
                If the session has expired, disconnect and reconnect your wallet
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Example Prompts</h2>
          <p style={{ color: 'var(--of-muted)' }}>Try these prompts with your connected AI agent:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-5" style={{ background: 'var(--of-ink)', borderLeftWidth: '4px', borderLeftColor: 'var(--of-blue)' }}>
              <p className="text-[13px] italic leading-relaxed" style={{ color: 'var(--of-paper)' }}>
                "Diagnose my Sui LP portfolio for wallet 0x123..."
              </p>
            </div>
            <div className="p-5" style={{ background: 'var(--of-ink)', borderLeftWidth: '4px', borderLeftColor: 'var(--of-orange)' }}>
              <p className="text-[13px] italic leading-relaxed" style={{ color: 'var(--of-paper)' }}>
                "Check whether my Cetus SUI/USDC position is outside its active range."
              </p>
            </div>
            <div className="p-5" style={{ background: 'var(--of-ink)', borderLeftWidth: '4px', borderLeftColor: 'var(--of-mint)' }}>
              <p className="text-[13px] italic leading-relaxed" style={{ color: 'var(--of-paper)' }}>
                "Summarize my previous LPGuardian diagnosis history."
              </p>
            </div>
            <div className="p-5" style={{ background: 'var(--of-ink)', borderLeftWidth: '4px', borderLeftColor: 'var(--of-violet)' }}>
              <p className="text-[13px] italic leading-relaxed" style={{ color: 'var(--of-paper)' }}>
                "Open the rebalance page for the risky SUI/USDC position."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
