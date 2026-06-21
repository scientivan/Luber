import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6" style={{ border: 'var(--of-line)', background: 'var(--of-paper)' }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: 'var(--of-line)', background: 'var(--of-warm)' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--of-muted)' }}>{language}</span>
        <button
          onClick={handleCopy}
          className="hover:opacity-100 transition-opacity flex items-center justify-center p-1"
          style={{ color: copied ? 'var(--of-blue)' : 'var(--of-muted)', opacity: copied ? 1 : 0.6 }}
          aria-label="Copy code"
        >
          {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} strokeWidth={2.5} />}
        </button>
      </div>
      <div className="p-4 overflow-x-auto" style={{ background: 'var(--of-ink)' }}>
        <pre className="text-[13px] leading-relaxed m-0 font-mono" style={{ color: 'var(--of-paper)' }}>
          <code>{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}
