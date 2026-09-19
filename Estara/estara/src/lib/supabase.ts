import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client.
 *
 * Only the publishable anon key is ever exposed to the browser — that key is
 * designed to be public and is useless without the row-level security policies
 * in supabase/migrations/0002_rls.sql, which are what actually enforce access.
 * The service-role key must never appear in this bundle.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the app has been given real credentials. */
export const isSupabaseConfigured = Boolean(
  url && anonKey && url.startsWith("http") && anonKey.length > 20
);

export const supabase: SupabaseClient = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "public-anon-key-not-configured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "estara.auth",
    },
  }
);

/** Human-readable message for a Supabase/Postgres error. Never leaks SQL. */
export function friendlyError(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";
  const e = error as { message?: string; code?: string; status?: number };
  const msg = (e.message ?? "").toLowerCase();

  if (!isSupabaseConfigured) {
    return "The platform is not connected to its database yet. Add your Supabase credentials to .env.local to enable accounts and listings.";
  }
  if (msg.includes("failed to fetch") || msg.includes("networkerror")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (msg.includes("invalid login credentials")) {
    return "That email and password combination doesn't match an account.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  if (msg.includes("user already registered") || e.code === "23505") {
    if (msg.includes("favorites")) return "You've already saved this property.";
    return "An account with that email already exists. Try signing in instead.";
  }
  if (msg.includes("password") && msg.includes("6")) {
    return "Your password must be at least 8 characters.";
  }
  // RLS denials surface as 42501 / "row-level security"
  if (e.code === "42501" || msg.includes("row-level security") || msg.includes("policy")) {
    return "You don't have permission to do that.";
  }
  if (msg.includes("cannot be changed")) {
    return "That field can't be changed from here.";
  }
  if (msg.includes("verification status")) {
    return "Agents can't change their own verification status.";
  }
  if (msg.includes("cannot move a listing")) {
    return "That listing status change isn't allowed.";
  }
  if (e.code === "23503") {
    return "That item no longer exists.";
  }
  if (e.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return e.message || "Something went wrong. Please try again.";
}
