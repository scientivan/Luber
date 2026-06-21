import { CodeBlock } from "../../components/CodeBlock";

export function DocsConfig() {
  const mcpConfig = `{
  "mcpServers": {
    "lpguardian": {
      "command": "node",
      "args": ["path/to/lpguardian-mcp/dist/index.js"],
      "env": {
        "SUI_RPC_URL": "https://fullnode.mainnet.sui.io"
      }
    }
  }
}`;

  return (
    <div className="min-h-full flex flex-col of-grid-paper" style={{ background: 'color-mix(in srgb, var(--of-yellow) 4%, var(--of-paper))' }}>
      <div className="of-section-top">
        <span style={{ color: 'var(--of-ink)' }}>Configuration</span>
        <span>&lt;docs&gt; client setup &lt;/docs&gt;</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16 text-base flex-1 w-full space-y-12 pb-12">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-none" style={{ color: 'var(--of-ink)' }}>Configuration</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--of-muted)' }}>
            To use LPGuardian, you need to register it as an MCP server within your AI client's configuration file.
          </p>
        </div>

        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Adding to MCP Config</h2>
          <p style={{ color: 'var(--of-muted)' }}>
            Locate your client's <strong>mcp_config.json</strong> file and add the <strong>lpguardian</strong> entry under <strong>mcpServers</strong>.
          </p>
          
          <CodeBlock 
            language="json" 
            code={mcpConfig}
          />
          
          <div className="grid gap-4 mt-6">
            <div className="p-5" style={{ border: 'var(--of-line)', background: 'var(--of-paper)' }}>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--of-blue)' }}>Command & Args</h4>
              <p className="text-sm" style={{ color: 'var(--of-muted)' }}>If installed globally, you can use <strong>"command": "lpguardian-mcp"</strong> and omit the args array. Otherwise, provide the absolute path to the built <strong>index.js</strong> file.</p>
            </div>
            <div className="p-5" style={{ border: 'var(--of-line)', background: 'var(--of-paper)' }}>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--of-violet)' }}>Environment Variables</h4>
              <p className="text-sm" style={{ color: 'var(--of-muted)' }}>The <strong>SUI_RPC_URL</strong> is required to fetch on-chain data. You can point this to the official Sui mainnet RPC or a private RPC node.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Applying Changes</h2>
          <p style={{ color: 'var(--of-muted)' }}>After updating the configuration file, you must restart your AI client for the new MCP server to be detected and loaded.</p>
          
          <ul className="list-disc pl-5 space-y-2 mt-4" style={{ color: 'var(--of-ink)' }}>
            <li>Close and reopen Claude Desktop or your preferred client.</li>
            <li>Check the client's tool integration settings to verify <strong>lpguardian</strong> is active.</li>
            <li>Test the connection by asking the agent: <span className="italic">"What MCP tools do you have available?"</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
