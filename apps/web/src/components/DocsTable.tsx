import { ReactNode } from "react";

interface DocsTableProps {
  headers: string[];
  children: ReactNode;
}

export function DocsTable({ headers, children }: DocsTableProps) {
  return (
    <div className="my-6 overflow-x-auto" style={{ border: 'var(--of-line)', background: 'var(--of-paper)' }}>
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr style={{ background: 'var(--of-warm)', borderBottom: 'var(--of-line)' }}>
            {headers.map((header, i) => (
              <th
                key={i}
                className="py-3 px-4 text-xs font-bold uppercase tracking-widest"
                style={{ color: 'var(--of-ink)' }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--of-ink)]">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function DocsTableRow({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-black/5">{children}</tr>;
}

export function DocsTableCell({
  children,
  isMono = false,
}: {
  children: ReactNode;
  isMono?: boolean;
}) {
  return (
    <td
      className={`py-3 px-4 text-[14px] ${
        isMono ? "font-mono" : "font-sans"
      }`}
      style={{ color: 'var(--of-ink)' }}
    >
      {children}
    </td>
  );
}
