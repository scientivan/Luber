import { CodeBlock } from "../../components/CodeBlock";

export function DocsInstall() {
  return (
    <div className="min-h-full flex flex-col of-grid-paper" style={{ background: 'color-mix(in srgb, var(--of-mint) 4%, var(--of-paper))' }}>
      <div className="of-section-top">
        <span style={{ color: 'var(--of-ink)' }}>Installation</span>
        <span>&lt;docs&gt; setup guide &lt;/docs&gt;</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16 text-base flex-1 w-full space-y-12 pb-12">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-none" style={{ color: 'var(--of-ink)' }}>Installation</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--of-muted)' }}>
            Install the LPGuardian MCP server globally or build it from source to connect it with your AI clients.
          </p>
        </div>

        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Global Installation</h2>
          <p style={{ color: 'var(--of-muted)' }}>The fastest way to install LPGuardian is via npm:</p>
          
          <CodeBlock 
            language="bash" 
            code="npm install -g lpguardian-mcp"
          />
          
          <p className="mt-4" style={{ color: 'var(--of-muted)' }}>
            This will install the <strong>lpguardian-mcp</strong> binary globally, making it available for your AI clients to execute.
          </p>
        </div>

        <div className="space-y-4 pt-10" style={{ borderTop: 'var(--of-line)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--of-ink)' }}>Build from Source</h2>
          <p style={{ color: 'var(--of-muted)' }}>If you prefer to build the server manually or want to contribute:</p>
          
          <CodeBlock 
            language="bash" 
            code={`git clone https://github.com/example/lpguardian.git
cd lpguardian
pnpm install
pnpm build`}
          />
          
          <div className="p-6 mt-6" style={{ border: 'var(--of-line)', borderLeftWidth: '6px', borderLeftColor: 'var(--of-blue)', background: 'var(--of-warm)' }}>
            <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--of-blue)' }}>
              Path Note
            </h3>
            <p style={{ color: 'var(--of-ink)' }}>
              When building from source, you will need to reference the compiled JavaScript file (usually in the <strong>dist/index.js</strong> directory) when configuring your MCP client.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
