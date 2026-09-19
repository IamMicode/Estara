import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { Agent, Profile, UserRole } from "./database.types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  agent: Agent | null;
  role: UserRole | null;
  loading: boolean;
  /** true once the initial session check has resolved */
  ready: boolean;
  configured: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const mounted = useRef(true);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setAgent(null);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", uid)
      .maybeSingle();

    if (!mounted.current) return;
    setProfile((prof as Profile) ?? null);

    if (prof && (prof as Profile).role === "agent") {
      const { data: ag } = await supabase
        .from("agents")
        .select("*")
        .eq("profile_id", (prof as Profile).id)
        .maybeSingle();
      if (!mounted.current) return;
      setAgent((ag as Agent) ?? null);
    } else {
      setAgent(null);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted.current) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (!mounted.current) return;
      setLoading(false);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted.current) return;
      setSession(s);
      // Defer the profile fetch: calling supabase inside the callback can
      // deadlock the auth lock in v2.
      setTimeout(() => {
        void loadProfile(s?.user.id);
      }, 0);
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadProfile(data.session?.user.id);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setAgent(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      agent,
      role: profile?.role ?? null,
      loading,
      ready,
      configured: isSupabaseConfigured,
      refresh,
      signOut,
    }),
    [session, profile, agent, loading, ready, refresh, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

/** Where a user belongs after signing in. */
export function homeRouteFor(role: UserRole | null) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "agent") return "/agent/dashboard";
  if (role === "customer") return "/customer/dashboard";
  return "/explore";
}
