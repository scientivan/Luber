import { type RefObject, useEffect, useRef } from "react";

interface Props {
  squareSize?: number;
  borderColor?: string;
  trailLength?: number;
  className?: string;
  eventTargetRef?: RefObject<HTMLElement | null>;
}

const PALETTE = [
  "#CDB5F6",
  "#7CB7FF",
  "#7EE7C2",
  "#FFE560",
  "#FF8A2B",
  "#F39BD2",
  "#8F6CFF",
  "#96C6FF",
];

export function HeroHoverGrid({
  squareSize = 72,
  borderColor = "rgba(84, 154, 255, 0.38)",
  trailLength = 7,
  className = "",
  eventTargetRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hoveredCell = { current: null as null | { col: number; row: number } };
    const trail = { current: [] as Array<{ col: number; row: number; color: string; life: number }> };
    let raf = 0;

    const getCanvasRect = () => {
      const target = eventTargetRef?.current;
      if (target) return target.getBoundingClientRect();
      return canvas.getBoundingClientRect();
    };

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = getCanvasRect();
      const width = rect.width;
      const height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      draw();
    };

    const draw = () => {
      const rect = getCanvasRect();
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);

      for (let i = trail.current.length - 1; i >= 0; i -= 1) {
        const cell = trail.current[i];
        cell.life *= 0.955;
        if (cell.life < 0.03) {
          trail.current.splice(i, 1);
        }
      }

      for (const cell of trail.current) {
        const x = cell.col * squareSize;
        const y = cell.row * squareSize;
        ctx.globalAlpha = Math.min(cell.life, 0.88);
        ctx.fillStyle = cell.color;
        ctx.fillRect(x + 1, y + 1, squareSize - 2, squareSize - 2);
      }

      ctx.globalAlpha = 1;

      const cols = Math.ceil(width / squareSize) + 2;
      const rows = Math.ceil(height / squareSize) + 2;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;

      for (let col = -1; col <= cols; col += 1) {
        const x = col * squareSize + 0.75;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let row = -1; row <= rows; row += 1) {
        const y = row * squareSize + 0.75;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    };

    const tick = () => {
      draw();
      raf = window.requestAnimationFrame(tick);
    };

    const pushCell = (col: number, row: number) => {
      const color = PALETTE[(col * 3 + row * 5 + trail.current.length) % PALETTE.length];
      trail.current.unshift({ col, row, color, life: 1 });
      if (trail.current.length > trailLength) {
        trail.current.length = trailLength;
      }
    };

    const handleMove = (event: PointerEvent) => {
      const rect = getCanvasRect();
      const localX = Math.max(0, Math.min(event.clientX - rect.left, rect.width - 1));
      const localY = Math.max(0, Math.min(event.clientY - rect.top, rect.height - 1));
      const col = Math.floor(localX / squareSize);
      const row = Math.floor(localY / squareSize);
      const prev = hoveredCell.current;

      if (!prev || prev.col !== col || prev.row !== row) {
        hoveredCell.current = { col, row };
        pushCell(col, row);
      }
    };

    const handleLeave = () => {
      hoveredCell.current = null;
    };

    resize();
    raf = window.requestAnimationFrame(tick);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    if (eventTargetRef?.current) resizeObserver.observe(eventTargetRef.current);
    window.addEventListener("resize", resize);
    const eventTarget = eventTargetRef?.current ?? canvas;
    eventTarget.addEventListener("pointermove", handleMove);
    eventTarget.addEventListener("pointerleave", handleLeave);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      eventTarget.removeEventListener("pointermove", handleMove);
      eventTarget.removeEventListener("pointerleave", handleLeave);
    };
  }, [borderColor, eventTargetRef, squareSize, trailLength]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
