import { useEffect, useState } from "react";
import { WS_BASE } from "./api.js";

export interface RealtimeEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function useRealtime(walletAddress?: string) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let timer: number | undefined;
    let attempts = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const query = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
      socket = new WebSocket(`${WS_BASE}/ws${query}`);
      socket.onopen = () => {
        attempts = 0;
        setConnected(true);
      };
      socket.onmessage = (message) => {
        if (message.data === "ping") {
          socket?.send("pong");
          return;
        }
        try {
          const event = JSON.parse(message.data) as RealtimeEvent;
          if (event.type === "ping") {
            socket?.send("pong");
            return;
          }
          setEvents((current) => [event, ...current].slice(0, 20));
        } catch {
          // Ignore malformed frames.
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) {
          const delay = Math.min(1000 * 2 ** attempts++, 15_000);
          timer = window.setTimeout(connect, delay);
        }
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      socket?.close();
    };
  }, [walletAddress]);

  return { events, connected };
}
