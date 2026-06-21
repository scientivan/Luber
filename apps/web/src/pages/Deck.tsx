import { type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { Cap } from "../design/atoms.js";
import "../styles/landing.css";

/* ─── Inline primitives ─────────────────────────────────────────────── */

type StickerVariant = "purple" | "magenta" | "cobalt" | "yellow";

function StickerBadge({
  children,
  variant = "purple",
  style,
}: {
  children: ReactNode;
  variant?: StickerVariant;
  style?: CSSProperties;
}) {
  return (
    <span className={`lp-sticker lp-sticker-${variant}`} style={style}>
      {children}
    </span>
  );
}

function WindowPanel({
  title,
  children,
  style,
}: {
  title: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="lp-window" style={style}>
      <div className="lp-window-bar">
        <div className="lp-window-dots">
          <div className="lp-window-dot" style={{ background: "var(--lp-bleed)" }} />
          <div className="lp-window-dot" style={{ background: "var(--lp-toxic)" }} />
          <div className="lp-window-dot" style={{ background: "var(--lp-healthy)" }} />
        </div>
        <span className="lp-window-title">{title}</span>
      </div>
      <div className="lp-window-body">{children}</div>
    </div>
  );
}

function PixelArrow() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M2.5 6.5h8M7 2.5l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function DividerBand({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--lp-base-deep)",
        borderTop: "2px solid var(--lp-border)",
        borderBottom: "2px solid var(--lp-border)",
        padding: "64px 36px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

/* ─── Data ──────────────────────────────────────────────────────────── */

const PHASES = [
  { n: "01", name: "position.resolve",           label: "VERIFIED",  color: "var(--lp-cobalt)" },
  { n: "03", name: "il.reconstruct",             label: "COMPUTED",  color: "var(--lp-purple)" },
  { n: "04", name: "regime.classify",            label: "ESTIMATED", color: "var(--lp-toxic)" },
  { n: "05", name: "hooks.discover",             label: "LABELED",   color: "var(--lp-purple)" },
  { n: "06", name: "hook.replay (1k swaps)",     label: "COMPUTED",  color: "var(--lp-purple)" },
  { n: "07", name: "migration.preview",          label: "COMPUTED",  color: "var(--lp-purple)" },
  { n: "10", name: "verdict.synthesize (TEE)",   label: "ESTIMATED", color: "var(--lp-toxic)" },
  { n: "08", name: "report.upload (0G Storage)", label: "VERIFIED",  color: "var(--lp-cobalt)" },
  { n: "09", name: "anchor.0g-chain + iNFT",     label: "VERIFIED",  color: "var(--lp-cobalt)" },
];

const STACK = [
  { name: "0G Storage",    role: "Blob anchoring for signed reports",          variant: "cobalt" as StickerVariant },
  { name: "0G Chain",      role: "On-chain anchor tx + iNFT state",            variant: "cobalt" as StickerVariant },
  { name: "0G Compute",    role: "TEE execution — verdict signed inside enclave", variant: "cobalt" as StickerVariant },
  { name: "ERC-7857",      role: "iNFT agent identity — memoryRoot on chain",  variant: "magenta" as StickerVariant },
  { name: "Uniswap V4",    role: "Hook discovery + swap replay against hooks", variant: "purple" as StickerVariant },
  { name: "Agent Memory",  role: "ERC-7857 memoryRoot + reputation updated on-chain", variant: "purple" as StickerVariant },
  { name: "MCP",           role: "5 product tools + ping — agent-callable", variant: "yellow" as StickerVariant },
  { name: "Slush",       role: "Slush approval — user keeps custody", variant: "magenta" as StickerVariant },
];

const OG_INTEGRATIONS = [
  {
    index: "A",
    title: "0G Storage for signed reports",
    body: "Every diagnosis uploads a JSON report blob via the 0G Storage DA layer. The returned URL is the first element of the verification chain — anyone can re-fetch it without LP Doctor's server.",
    color: "var(--lp-cobalt)",
  },
  {
    index: "B",
    title: "0G Chain anchor tx",
    body: "After upload, the agent submits an on-chain tx on 0G Aristotle Mainnet storing the rootHash, storageUrl, tokenId, and verdict. The tx hash becomes the second verification path.",
    color: "var(--lp-cobalt)",
  },
  {
    index: "C",
    title: "0G Compute TEE attestation",
    body: "The verdict is synthesized inside a 0G Compute provider with a broker-verifiable attestation report. No LP Doctor server is in the signing path — the TEE signs the hash before anchoring.",
    color: "var(--lp-cobalt)",
  },
  {
    index: "D",
    title: "ERC-7857 iNFT on Aristotle Mainnet",
    body: "LP Doctor/01 is an autonomous agent NFT on 0G Aristotle Mainnet. Its memoryRoot evolves per diagnosis, reputation increments per run, and migrationsTriggered bumps when users sign Slush bundles.",
    color: "var(--lp-magenta)",
  },
];

const VERIFY_PATHS = [
  { id: "A", label: "0G Storage URL",     method: "Re-fetch blob, hash the JSON, compare rootHash" },
  { id: "B", label: "0G Chain anchor tx", method: "Read tx calldata or event, extract rootHash" },
  { id: "C", label: "REST report cache",  method: "Fetch by rootHash from LP Doctor API and compare anchor fields" },
  { id: "D", label: "IPFS CID",           method: "Fetch via any IPFS gateway, recompute SHA-256" },
  { id: "E", label: "iNFT memoryRoot",    method: "agents(1).memoryRoot on 0G Aristotle Mainnet = latest blob" },
];

/* ─── Page ──────────────────────────────────────────────────────────── */

export function Deck() {
  return (
    <div className="landing-theme" style={{ minHeight: "100vh" }}>
      <div className="lp-grid-bg" />

      <AppHeader />

      {/* ── Slide 1: Hero ─────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "72px 36px 80px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StickerBadge variant="yellow" style={{ transform: "rotate(-1.5deg)" }}>
              0G APAC HACKATHON 2026
            </StickerBadge>
            <StickerBadge variant="cobalt">SUBMISSION DECK</StickerBadge>
          </div>

          <h1
            style={{
              margin: "0 0 24px",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(4rem, 10vw, 9rem)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              lineHeight: 0.9,
              color: "var(--lp-ink)",
            }}
          >
            LP Doctor
          </h1>

          <p
            style={{
              maxWidth: "60ch",
              margin: "0 0 16px",
              color: "var(--lp-ink-soft)",
              fontSize: "clamp(1rem, 1.8vw, 1.3rem)",
              lineHeight: 1.55,
              fontWeight: 400,
            }}
          >
            An autonomous diagnostic agent for Uniswap V3 and V4 LPs. It explains
            why a position is bleeding, simulates V4 hooks against real swap history,
            and publishes a verifiable signed report anchored to 0G Storage, 0G Chain,
            and an ERC-7857 iNFT.
          </p>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 32 }}>
            <Link
              to="/atlas"
              className="lp-btn-primary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              Try it live <PixelArrow />
            </Link>
            <Link
              to="/agent"
              className="lp-btn-ghost"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              View iNFT <PixelArrow />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Slide 2: Problem ──────────────────────────────────────────── */}
      <DividerBand>
        <Cap style={{ marginBottom: 16 }}>THE PROBLEM</Cap>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              n: "01",
              heading: "LP positions bleed quietly.",
              body: "A Uniswap V3 position can fall out of range, collect zero fees, and accumulate impermanent loss while every portfolio tracker shows it as \"active.\" The bleed is invisible without tick-level inspection.",
              color: "var(--lp-bleed)",
            },
            {
              n: "02",
              heading: "Dashboards flatten the data.",
              body: "Revert, Debank, and similar tools aggregate — they do not decompose IL from the tick range, reconstruct pool regime, or replay what a V4 hook would have done in the same swap window.",
              color: "var(--lp-toxic)",
            },
            {
              n: "03",
              heading: "Migration is guesswork.",
              body: "Moving to V4 hooks without backtesting the hook against the pool's actual swap history means choosing blind. Most LPs never do it. Most V4 hooks go unused as a result.",
              color: "var(--lp-purple)",
            },
          ].map((c) => (
            <div
              key={c.n}
              style={{
                padding: "18px 20px",
                border: "2px solid var(--lp-border)",
                borderRadius: 3,
                background: "var(--lp-base)",
                boxShadow: "4px 4px 0 var(--lp-border)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: c.color,
                  marginBottom: 10,
                  letterSpacing: "0.06em",
                }}
              >
                {c.n}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--lp-ink)",
                  marginBottom: 8,
                  lineHeight: 1.15,
                }}
              >
                {c.heading}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--lp-ink-soft)", lineHeight: 1.6 }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </DividerBand>

      {/* ── Slide 3: Solution ─────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "80px 36px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Cap style={{ marginBottom: 16 }}>THE SOLUTION</Cap>
          <h2
            style={{
              margin: "0 0 48px",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5vw, 4rem)",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--lp-ink)",
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
            }}
          >
            Diagnose. Simulate.{" "}
            <span style={{ color: "var(--lp-purple)" }}>Anchor.</span>
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 2,
              border: "2px solid var(--lp-border)",
              borderRadius: 3,
              overflow: "hidden",
              boxShadow: "5px 5px 0 var(--lp-border)",
            }}
            className="lp-solution-grid"
          >
            {[
              {
                n: "1",
                title: "Diagnose",
                body: "Resolve the LP NFT. Reconstruct IL from tick bounds and current sqrtPriceX96. Classify the pool regime. Assign honesty labels — VERIFIED, COMPUTED, ESTIMATED — to every output.",
                color: "var(--lp-purple)",
              },
              {
                n: "2",
                title: "Simulate",
                body: "Discover candidate V4 hooks for the pair. Replay the last 1,000 swaps through each hook. Score by projected fee capture. Propose a migration path only if the simulation backtests positively.",
                color: "var(--lp-magenta)",
              },
              {
                n: "3",
                title: "Anchor",
                body: "Sign the verdict inside a 0G Compute TEE. Upload the report to 0G Storage. Anchor rootHash on 0G Chain. Update the ERC-7857 iNFT memoryRoot. Multiple independent verification paths, one rootHash.",
                color: "var(--lp-cobalt)",
              },
            ].map((c, i) => (
              <div
                key={c.n}
                style={{
                  padding: "28px 24px",
                  borderRight: i < 2 ? "2px solid var(--lp-border)" : "none",
                  background: i % 2 === 0
                    ? "var(--lp-base)"
                    : "var(--lp-base-deep)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 48,
                    fontWeight: 700,
                    color: c.color,
                    lineHeight: 1,
                    marginBottom: 16,
                    opacity: 0.25,
                  }}
                >
                  {c.n}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--lp-ink)",
                    marginBottom: 12,
                  }}
                >
                  {c.title}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--lp-ink-soft)", lineHeight: 1.65 }}>
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Slide 4: How it works — phases ────────────────────────────── */}
      <DividerBand>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 1fr) minmax(340px, 1.4fr)",
            gap: 60,
            alignItems: "center",
          }}
          className="lp-how-grid"
        >
          <div>
            <Cap style={{ marginBottom: 14 }}>HOW IT WORKS · 10 PHASES</Cap>
            <h2
              style={{
                margin: "0 0 16px",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.8rem, 4vw, 3.2rem)",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--lp-ink)",
                lineHeight: 0.95,
                letterSpacing: "-0.01em",
              }}
            >
              Every phase is visible. Every output is labeled.
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--lp-ink-soft)", lineHeight: 1.6 }}>
              No black box. Each diagnostic phase is streamed live and tagged with an
              honesty label: VERIFIED (chain-sourced), COMPUTED (deterministic math),
              ESTIMATED (model-informed), EMULATED (simulation), or LABELED (human-tagged).
            </p>
          </div>

          <WindowPanel title="diagnostic.stream">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {PHASES.map((p) => (
                <div
                  key={p.n}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "3px 0",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--lp-ink-ghost)",
                      minWidth: 18,
                    }}
                  >
                    {p.n}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--lp-ink-soft)",
                      flex: 1,
                    }}
                  >
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      color: p.color,
                    }}
                  >
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          </WindowPanel>
        </div>
      </DividerBand>

      {/* ── Slide 5: Tech stack ───────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "80px 36px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Cap style={{ marginBottom: 16 }}>TECH STACK</Cap>
          <h2
            style={{
              margin: "0 0 40px",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.6rem, 3.5vw, 2.8rem)",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--lp-ink)",
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
            }}
          >
            Eight instruments, one pipeline.
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {STACK.map((s) => (
              <div
                key={s.name}
                style={{
                  padding: "14px 16px",
                  border: "2px solid var(--lp-border)",
                  borderRadius: 3,
                  background: "var(--lp-base)",
                  boxShadow: "3px 3px 0 var(--lp-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <StickerBadge variant={s.variant}>{s.name}</StickerBadge>
                <p style={{ margin: 0, fontSize: 11, color: "var(--lp-ink-soft)", lineHeight: 1.5 }}>
                  {s.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Slide 6: Why 0G ───────────────────────────────────────────── */}
      <DividerBand>
        <Cap style={{ marginBottom: 16 }}>WHY 0G · 4 INTEGRATION POINTS</Cap>
        <h2
          style={{
            margin: "0 0 36px",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
            fontWeight: 700,
            textTransform: "uppercase",
            color: "var(--lp-ink)",
            lineHeight: 0.95,
            letterSpacing: "-0.01em",
          }}
        >
          0G is not a badge.{" "}
          <span style={{ color: "var(--lp-cobalt)" }}>It is the trust path.</span>
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {OG_INTEGRATIONS.map((g) => (
            <div
              key={g.index}
              style={{
                padding: "18px 20px",
                border: "2px solid var(--lp-border)",
                borderRadius: 3,
                background: "var(--lp-base)",
                boxShadow: "4px 4px 0 var(--lp-border)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: g.color,
                  marginBottom: 10,
                  letterSpacing: "0.06em",
                }}
              >
                {g.index}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--lp-ink)",
                  marginBottom: 8,
                  lineHeight: 1.2,
                }}
              >
                {g.title}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--lp-ink-soft)", lineHeight: 1.6 }}>
                {g.body}
              </p>
            </div>
          ))}
        </div>
      </DividerBand>

      {/* ── Slide 7: Verification paths ───────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "80px 36px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Cap style={{ marginBottom: 16 }}>VERIFICATION · 5 PATHS, ONE ROOTHASH</Cap>
          <h2
            style={{
              margin: "0 0 36px",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.6rem, 3.5vw, 2.8rem)",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--lp-ink)",
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
            }}
          >
            No LP Doctor server in the trust path.
          </h2>
          <WindowPanel title="verification.matrix">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr 2fr",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            >
              {["ID", "PATH", "METHOD"].map((h) => (
                <div
                  key={h}
                  style={{
                    padding: "7px 14px",
                    background: "var(--lp-base-deep)",
                    borderBottom: "1.5px solid var(--lp-border)",
                    fontSize: 9,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    color: "var(--lp-ink-ghost)",
                    borderRight: h !== "METHOD" ? "1px solid var(--lp-border-soft)" : "none",
                  }}
                >
                  {h}
                </div>
              ))}
              {VERIFY_PATHS.map(({ id, label, method }, i) => (
                <>
                  <div
                    key={`id-${id}`}
                    style={{
                      padding: "10px 14px",
                      borderBottom: i < VERIFY_PATHS.length - 1 ? "1px solid var(--lp-border-soft)" : "none",
                      borderRight: "1px solid var(--lp-border-soft)",
                      fontWeight: 700,
                      color: "var(--lp-cobalt)",
                      background: i % 2 === 0 ? "transparent" : "color-mix(in oklch, var(--lp-purple) 2%, transparent)",
                    }}
                  >
                    {id}
                  </div>
                  <div
                    key={`label-${id}`}
                    style={{
                      padding: "10px 14px",
                      borderBottom: i < VERIFY_PATHS.length - 1 ? "1px solid var(--lp-border-soft)" : "none",
                      borderRight: "1px solid var(--lp-border-soft)",
                      color: "var(--lp-ink)",
                      background: i % 2 === 0 ? "transparent" : "color-mix(in oklch, var(--lp-purple) 2%, transparent)",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    key={`method-${id}`}
                    style={{
                      padding: "10px 14px",
                      borderBottom: i < VERIFY_PATHS.length - 1 ? "1px solid var(--lp-border-soft)" : "none",
                      color: "var(--lp-ink-faint)",
                      background: i % 2 === 0 ? "transparent" : "color-mix(in oklch, var(--lp-purple) 2%, transparent)",
                    }}
                  >
                    {method}
                  </div>
                </>
              ))}
            </div>
          </WindowPanel>
        </div>
      </section>

      {/* ── Slide 8: CTA ──────────────────────────────────────────────── */}
      <DividerBand>
        <div style={{ textAlign: "center" }}>
          <StickerBadge variant="yellow" style={{ marginBottom: 24, transform: "rotate(-2deg)", display: "inline-block" }}>
            LIVE ON TESTNET
          </StickerBadge>
          <h2
            style={{
              margin: "0 0 20px",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5vw, 4.4rem)",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--lp-ink)",
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
            }}
          >
            Run a real diagnosis.
          </h2>
          <p style={{ margin: "0 auto 32px", maxWidth: "48ch", fontSize: 14, color: "var(--lp-ink-soft)", lineHeight: 1.6 }}>
            Paste a Uniswap LP NFT tokenId or use one of six curated demo wallets.
            The pipeline runs end-to-end on chain data — no mocks.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <Link
              to="/atlas"
              className="lp-btn-primary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              Open the Atlas <PixelArrow />
            </Link>
            <Link
              to="/roadmap"
              className="lp-btn-ghost"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              View Roadmap <PixelArrow />
            </Link>
          </div>
        </div>
      </DividerBand>
    </div>
  );
}
