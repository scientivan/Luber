import type { Label } from "@lp-guardian/core";

interface Props {
  label: Label;
}

const LABEL_CLS: Record<Label, string> = {
  VERIFIED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
  COMPUTED: "bg-cyan-500/10 text-cyan-300 border-cyan-500/40",
  ESTIMATED: "bg-amber-500/10 text-amber-300 border-amber-500/40",
  EMULATED: "bg-orange-500/10 text-orange-300 border-orange-500/40",
  LABELED: "bg-violet-500/10 text-violet-300 border-violet-500/40",
};

const LABEL_DOT: Record<Label, string> = {
  VERIFIED: "🟢",
  COMPUTED: "🔵",
  ESTIMATED: "🟡",
  EMULATED: "🟠",
  LABELED: "🏷️",
};

export function LabelBadge({ label }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded border ${LABEL_CLS[label]}`}
      title={`source label: ${label}`}
    >
      <span aria-hidden>{LABEL_DOT[label]}</span>
      <span>{label}</span>
    </span>
  );
}
