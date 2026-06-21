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
  return createClient(url, key);
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
