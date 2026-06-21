import WebSocket from "ws";

// Polyfill globalThis.WebSocket for Node.js < 22 (required by @supabase/realtime-js).
// Must run before any Supabase import evaluates WebSocketFactory.detectEnvironment().
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as any).WebSocket = WebSocket;
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

function buildClient(useServiceRole = false): SupabaseClient {
  const { url, anonKey, serviceRoleKey } = config.supabase;
  if (!url) throw new Error("SUPABASE_URL not set");

  const key = useServiceRole ? serviceRoleKey : anonKey;
  if (!key) {
    const label = useServiceRole ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY";
    throw new Error(`${label} not set`);
  }
  return createClient(url, key, {
    realtime: {
      // Provide ws transport explicitly for Node.js < 22 environments (e.g. Railway on Node 20).
      transport: WebSocket as unknown as new (url: string | URL, protocols?: string | string[]) => globalThis.WebSocket,
    },
  });
}

let _anon: SupabaseClient | undefined;
let _admin: SupabaseClient | undefined;

export const supabase = {
  get client(): SupabaseClient {
    if (!_anon) _anon = buildClient(false);
    return _anon;
  },

  get admin(): SupabaseClient {
    if (!_admin) _admin = buildClient(true);
    return _admin;
  },
};
