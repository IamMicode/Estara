import { Navigate, useLocation } from "react-router-dom";
import { useAuth, homeRouteFor } from "../../lib/AuthContext";
import { LoadingBlock, Alert } from "./ui";
import type { UserRole } from "../../lib/database.types";

/**
 * Route guards.
 *
 * These are a UX affordance: they keep users out of screens that would fail or
 * look broken. They are NOT the security boundary — every table is protected by
 * RLS policies, so bypassing these guards in the browser yields empty data and
 * rejected writes, not unauthorized access.
 */

export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { session, profile, ready, configured } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <div className="app-root">
        <div className="page page--narrow">
          <Alert kind="warn">
          This area needs a database connection. Add your Supabase URL and anon key to{" "}
          <code>.env.local</code> and restart the dev server — see{" "}
            <code>supabase/README.md</code>.
          </Alert>
        </div>
      </div>
    );
  }

  if (!ready) return <LoadingBlock label="Checking your session…" />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  // Session exists but the profile row hasn't loaded yet.
  if (!profile) return <LoadingBlock label="Loading your account…" />;

  if (profile.status === "suspended") {
    return (
      <div className="app-root">
        <div className="page page--narrow">
          <div className="page-head">
            <h1>Account suspended</h1>
          <p>
            Your account has been suspended and can't perform this action. If you think this is a
              mistake, contact Estara support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={homeRouteFor(profile.role)} replace />;
  }

  return <>{children}</>;
}

/** Redirects an already-signed-in user away from login/register screens. */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { session, profile, ready } = useAuth();
  if (!ready) return <LoadingBlock />;
  if (session && profile) return <Navigate to={homeRouteFor(profile.role)} replace />;
  return <>{children}</>;
}

/** Agents must be verified before they can create listings. */
export function RequireVerifiedAgent({ children }: { children: React.ReactNode }) {
  const { agent } = useAuth();
  if (agent && agent.verification_status !== "verified") {
    return <Navigate to="/agent/verification" replace />;
  }
  return <>{children}</>;
}
