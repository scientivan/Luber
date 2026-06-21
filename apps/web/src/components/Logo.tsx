interface Props {
  size?: number;
}

export function Logo({ size = 22 }: Props) {
  return (
    <img
      src="/lp-guardian-logo.webp"
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{
        display: "block",
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  );
}
