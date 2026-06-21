import { DocsTable, DocsTableRow, DocsTableCell } from "../../components/DocsTable";

export function DocsTools() {
  return (
    <div className="min-h-full flex flex-col of-grid-paper" style={{ background: 'color-mix(in srgb, var(--of-pink) 4%, var(--of-paper))' }}>
      <div className="of-section-top">
        <span style={{ color: 'var(--of-ink)' }}>Agent Capabilities</span>
        <span>&lt;docs&gt; tool definitions &lt;/docs&gt;</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16 text-base flex-1 w-full space-y-12 pb-12">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-none" style={{ color: 'var(--of-ink)' }}>Agent Capabilities</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--of-muted)' }}>
            LPGuardian exposes several tools through the MCP protocol that your AI agent can call to analyze LP positions.
          </p>
        </div>

        {/* Tool 1 */}
        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--of-blue)' }} />
            <h2 className="text-2xl font-bold font-mono" style={{ color: 'var(--of-ink)' }}>diagnose_portfolio</h2>
          </div>
          <p style={{ color: 'var(--of-muted)' }}>Analyze all detected LP positions for a given wallet.</p>
          
          <h4 className="text-xs font-bold uppercase tracking-widest mt-8 mb-2" style={{ color: 'var(--of-blue)' }}>Parameters</h4>
          <DocsTable headers={["Parameter", "Type", "Required", "Description"]}>
            <DocsTableRow>
              <DocsTableCell isMono>walletAddress</DocsTableCell>
              <DocsTableCell isMono>string</DocsTableCell>
              <DocsTableCell>Yes</DocsTableCell>
              <DocsTableCell>Sui wallet address to diagnose</DocsTableCell>
            </DocsTableRow>
            <DocsTableRow>
              <DocsTableCell isMono>network</DocsTableCell>
              <DocsTableCell isMono>enum</DocsTableCell>
              <DocsTableCell>No</DocsTableCell>
              <DocsTableCell>Sui network, such as mainnet or testnet</DocsTableCell>
            </DocsTableRow>
            <DocsTableRow>
              <DocsTableCell isMono>protocol</DocsTableCell>
              <DocsTableCell isMono>enum</DocsTableCell>
              <DocsTableCell>No</DocsTableCell>
              <DocsTableCell>Target protocol, such as Cetus</DocsTableCell>
            </DocsTableRow>
            <DocsTableRow>
              <DocsTableCell isMono>includeHistory</DocsTableCell>
              <DocsTableCell isMono>boolean</DocsTableCell>
              <DocsTableCell>No</DocsTableCell>
              <DocsTableCell>Whether to include previous diagnostic history</DocsTableCell>
            </DocsTableRow>
          </DocsTable>
        </div>

        {/* Tool 2 */}
        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--of-violet)' }} />
            <h2 className="text-2xl font-bold font-mono" style={{ color: 'var(--of-ink)' }}>diagnose_pool</h2>
          </div>
          <p style={{ color: 'var(--of-muted)' }}>Analyze a specific pool or LP position.</p>
          
          <h4 className="text-xs font-bold uppercase tracking-widest mt-8 mb-2" style={{ color: 'var(--of-violet)' }}>Parameters</h4>
          <DocsTable headers={["Parameter", "Type", "Required", "Description"]}>
            <DocsTableRow>
              <DocsTableCell isMono>walletAddress</DocsTableCell>
              <DocsTableCell isMono>string</DocsTableCell>
              <DocsTableCell>Yes</DocsTableCell>
              <DocsTableCell>Owner wallet address</DocsTableCell>
            </DocsTableRow>
            <DocsTableRow>
              <DocsTableCell isMono>poolId</DocsTableCell>
              <DocsTableCell isMono>string</DocsTableCell>
              <DocsTableCell>Yes</DocsTableCell>
              <DocsTableCell>Target pool object ID</DocsTableCell>
            </DocsTableRow>
            <DocsTableRow>
              <DocsTableCell isMono>positionId</DocsTableCell>
              <DocsTableCell isMono>string</DocsTableCell>
              <DocsTableCell>No</DocsTableCell>
              <DocsTableCell>Specific position NFT ID</DocsTableCell>
            </DocsTableRow>
            <DocsTableRow>
              <DocsTableCell isMono>network</DocsTableCell>
              <DocsTableCell isMono>enum</DocsTableCell>
              <DocsTableCell>No</DocsTableCell>
              <DocsTableCell>Sui network</DocsTableCell>
            </DocsTableRow>
          </DocsTable>
        </div>

        {/* Additional Tools Summary */}
        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Other Utilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="p-5" style={{ border: 'var(--of-line)', background: 'var(--of-paper)' }}>
              <h4 className="font-mono font-bold mb-2" style={{ color: 'var(--of-ink)' }}>get_diagnostic_history</h4>
              <p className="text-sm" style={{ color: 'var(--of-muted)' }}>Returns previous AI diagnosis records for a connected wallet or address.</p>
            </div>
            <div className="p-5" style={{ border: 'var(--of-line)', background: 'var(--of-paper)' }}>
              <h4 className="font-mono font-bold mb-2" style={{ color: 'var(--of-ink)' }}>get_mcp_status</h4>
              <p className="text-sm" style={{ color: 'var(--of-muted)' }}>Checks MCP server and network health.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
