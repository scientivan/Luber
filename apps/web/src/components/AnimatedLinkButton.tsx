import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface AnimatedLinkButtonProps {
  to: string;
  label: string;
  direction?: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}

export function AnimatedLinkButton({
  to,
  label,
  direction = "right",
  className = "",
  style,
}: AnimatedLinkButtonProps) {
  return (
    <Link
      to={to}
      className={`of-animated-link-btn ${className}`}
      style={style}
    >
      <span className="of-animated-icon" aria-hidden="true">
        {direction === "left" ? <ArrowLeft /> : <ArrowRight />}
      </span>
      <span className="of-animated-label">{label}</span>
    </Link>
  );
}
