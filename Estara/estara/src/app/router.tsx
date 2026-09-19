import { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "../lib/AuthContext";
import { RequireAuth, RedirectIfAuthed } from "./components/Guards";
import { PublicShell } from "./components/Shell";
import { LoadingBlock, EmptyState } from "./components/ui";
import "./app.css";

/**
 * Route map.
 *
 * The cinematic landing (`/`) is lazy-loaded on its own so the marketplace never
 * pulls in three.js, and the dashboards are split per role so a customer never
 * downloads the admin bundle.
 */

const Cinematic = lazy(() => import("../App"));

const ExplorePage = lazy(() =>
  import("./public/ExplorePage").then((m) => ({ default: m.ExplorePage }))
);
const PropertyDetailPage = lazy(() =>
  import("./public/PropertyDetailPage").then((m) => ({ default: m.PropertyDetailPage }))
);
const AgentProfilePage = lazy(() =>
  import("./public/AgentProfilePage").then((m) => ({ default: m.AgentProfilePage }))
);

const Auth = {
  Login: lazy(() => import("./auth/AuthPages").then((m) => ({ default: m.LoginPage }))),
  Choice: lazy(() => import("./auth/AuthPages").then((m) => ({ default: m.RegisterChoicePage }))),
  Customer: lazy(() =>
    import("./auth/AuthPages").then((m) => ({ default: m.CustomerRegisterPage }))
  ),
  Agent: lazy(() => import("./auth/AuthPages").then((m) => ({ default: m.AgentRegisterPage }))),
  Forgot: lazy(() => import("./auth/AuthPages").then((m) => ({ default: m.ForgotPasswordPage }))),
  Reset: lazy(() => import("./auth/AuthPages").then((m) => ({ default: m.ResetPasswordPage }))),
};

const C = {
  Layout: lazy(() => import("./customer/CustomerPages").then((m) => ({ default: m.CustomerLayout }))),
  Dashboard: lazy(() =>
    import("./customer/CustomerPages").then((m) => ({ default: m.CustomerDashboard }))
  ),
  Saved: lazy(() => import("./customer/CustomerPages").then((m) => ({ default: m.CustomerSaved }))),
  Inquiries: lazy(() =>
    import("./customer/CustomerPages").then((m) => ({ default: m.CustomerInquiries }))
  ),
  Profile: lazy(() =>
    import("./customer/CustomerPages").then((m) => ({ default: m.CustomerProfile }))
  ),
  Settings: lazy(() =>
    import("./customer/CustomerPages").then((m) => ({ default: m.CustomerSettings }))
  ),
};

const A = {
  Layout: lazy(() => import("./agent/AgentPages").then((m) => ({ default: m.AgentLayout }))),
  Dashboard: lazy(() => import("./agent/AgentPages").then((m) => ({ default: m.AgentDashboard }))),
  Listings: lazy(() => import("./agent/AgentPages").then((m) => ({ default: m.AgentListings }))),
  Inquiries: lazy(() => import("./agent/AgentPages").then((m) => ({ default: m.AgentInquiries }))),
  Verification: lazy(() =>
    import("./agent/AgentPages").then((m) => ({ default: m.AgentVerification }))
  ),
  Profile: lazy(() => import("./agent/AgentPages").then((m) => ({ default: m.AgentProfile }))),
  Settings: lazy(() => import("./agent/AgentPages").then((m) => ({ default: m.AgentSettings }))),
  Wizard: lazy(() => import("./agent/ListingWizard").then((m) => ({ default: m.ListingWizard }))),
};

const Ad = {
  Layout: lazy(() => import("./admin/AdminPages").then((m) => ({ default: m.AdminLayout }))),
  Dashboard: lazy(() => import("./admin/AdminPages").then((m) => ({ default: m.AdminDashboard }))),
  Agents: lazy(() => import("./admin/AdminPages").then((m) => ({ default: m.AdminAgents }))),
  Properties: lazy(() =>
    import("./admin/AdminPages").then((m) => ({ default: m.AdminProperties }))
  ),
  Users: lazy(() => import("./admin/AdminPages").then((m) => ({ default: m.AdminUsers }))),
  Reports: lazy(() => import("./admin/AdminPages").then((m) => ({ default: m.AdminReports }))),
};

/** Scroll to top on navigation — the cinematic route manages its own scroll. */
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === "/") return;
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** The landing page owns document scrolling; app routes must not inherit it. */
function BodyMode() {
  const { pathname } = useLocation();
  useEffect(() => {
    const cinematic = pathname === "/";
    document.body.classList.toggle("body--app", !cinematic);
    document.body.classList.toggle("body--cinematic", cinematic);
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="app-root page">
      <EmptyState
        title="Page not found"
        body="That page doesn't exist, or it moved."
        action={
          <a href="/explore" className="btn btn--primary">
            Go to Explore
          </a>
        }
      />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollReset />
        <BodyMode />
        <Suspense fallback={<div className="app-root"><LoadingBlock /></div>}>
          <Routes>
            {/* ---------------------------------- cinematic landing (Phase 1) */}
            <Route path="/" element={<Cinematic />} />

            {/* --------------------------------------------------------- auth */}
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <Auth.Login />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuthed>
                  <Auth.Choice />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/register/customer"
              element={
                <RedirectIfAuthed>
                  <Auth.Customer />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/register/agent"
              element={
                <RedirectIfAuthed>
                  <Auth.Agent />
                </RedirectIfAuthed>
              }
            />
            {/* Scene 06 CTAs point here — keep them working. */}
            <Route path="/customer/register" element={<Navigate to="/register/customer" replace />} />
            <Route path="/agent/register" element={<Navigate to="/register/agent" replace />} />
            <Route path="/forgot-password" element={<Auth.Forgot />} />
            <Route path="/reset-password" element={<Auth.Reset />} />

            {/* ----------------------------------------- public marketplace */}
            <Route element={<PublicShell />}>
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/properties/:id" element={<PropertyDetailPage />} />
              <Route path="/agents/:id" element={<AgentProfilePage />} />
            </Route>

            {/* ---------------------------------------------------- customer */}
            <Route
              path="/customer"
              element={
                <RequireAuth roles={["customer"]}>
                  <C.Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/customer/dashboard" replace />} />
              <Route path="dashboard" element={<C.Dashboard />} />
              <Route path="saved" element={<C.Saved />} />
              <Route path="inquiries" element={<C.Inquiries />} />
              <Route path="profile" element={<C.Profile />} />
              <Route path="settings" element={<C.Settings />} />
            </Route>

            {/* ------------------------------------------------------- agent */}
            <Route
              path="/agent"
              element={
                <RequireAuth roles={["agent"]}>
                  <A.Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/agent/dashboard" replace />} />
              <Route path="dashboard" element={<A.Dashboard />} />
              <Route path="listings" element={<A.Listings />} />
              <Route path="listings/new" element={<A.Wizard />} />
              <Route path="listings/:id/edit" element={<A.Wizard />} />
              <Route path="inquiries" element={<A.Inquiries />} />
              <Route path="verification" element={<A.Verification />} />
              <Route path="profile" element={<A.Profile />} />
              <Route path="settings" element={<A.Settings />} />
            </Route>

            {/* ------------------------------------------------------- admin */}
            <Route
              path="/admin"
              element={
                <RequireAuth roles={["admin"]}>
                  <Ad.Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<Ad.Dashboard />} />
              <Route path="agents" element={<Ad.Agents />} />
              <Route path="properties" element={<Ad.Properties />} />
              <Route path="users" element={<Ad.Users />} />
              <Route path="reports" element={<Ad.Reports />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
