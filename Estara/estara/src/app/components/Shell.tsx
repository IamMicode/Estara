import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, homeRouteFor } from "../../lib/AuthContext";
import { isSupabaseConfigured } from "../../lib/supabase";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../../lib/api";
import type { Notification } from "../../lib/database.types";
import { Avatar, Icon } from "./ui";
import { timeAgo } from "../../lib/format";

/* --------------------------------------------------------- notifications --- */

function NotificationBell() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!profile) return;
    try {
      setItems(await listNotifications(profile.id, 20));
    } catch {
      /* notifications are non-critical */
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!profile) return null;
  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="btn btn--quiet btn--icon"
        style={{ position: "relative" }}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        {Icon.bell}
        {unread > 0 && <span className="notif-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="menu__panel" style={{ width: 320 }} role="region" aria-label="Notifications">
          <div className="menu__head row row--between">
            <span className="menu__name">Notifications</span>
            {unread > 0 && (
              <button
                className="link-quiet"
                style={{ background: "none", border: 0, cursor: "pointer" }}
                onClick={async () => {
                  await markAllNotificationsRead(profile.id);
                  void load();
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {items.length === 0 && (
              <p className="muted" style={{ padding: "14px 12px" }}>
                Nothing yet.
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                className="menu__item"
                style={{
                  display: "block",
                  background: n.read ? "transparent" : "var(--accent-soft)",
                }}
                onClick={async () => {
                  if (!n.read) {
                    await markNotificationRead(n.id);
                    void load();
                  }
                }}
              >
                <span style={{ display: "block", fontWeight: n.read ? 400 : 500, fontSize: 13.5 }}>
                  {n.title}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-500)" }}>
                  {n.message}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-400)", marginTop: 3 }}>
                  {timeAgo(n.created_at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ user menu ---- */

function UserMenu() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!profile) {
    return (
      <div className="row" style={{ gap: 8 }}>
        <Link to="/login" className="btn btn--ghost btn--sm">
          Sign in
        </Link>
        <Link to="/register" className="btn btn--primary btn--sm">
          Get started
        </Link>
      </div>
    );
  }

  const settingsPath =
    profile.role === "agent" ? "/agent/settings" : profile.role === "admin" ? "/admin/dashboard" : "/customer/settings";

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <Avatar name={profile.display_name || profile.email} url={profile.avatar_url} />
      </button>
      {open && (
        <div className="menu__panel">
          <div className="menu__head">
            <div className="menu__name">{profile.display_name || "Your account"}</div>
            <div className="menu__mail">{profile.email}</div>
            <div style={{ marginTop: 6 }}>
              <span className="badge">{profile.role}</span>
            </div>
          </div>
          <Link className="menu__item" to={homeRouteFor(profile.role)} onClick={() => setOpen(false)}>
            Dashboard
          </Link>
          <Link className="menu__item" to={settingsPath} onClick={() => setOpen(false)}>
            Settings
          </Link>
          <button
            className="menu__item"
            onClick={async () => {
              setOpen(false);
              await signOut();
              nav("/");
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- appbar ---- */

export function AppBar() {
  const { profile } = useAuth();
  return (
    <>
      {!isSupabaseConfigured && (
        <div className="config-banner">
          Demo mode — no database connected. Add Supabase credentials to <code>.env.local</code> to
          enable accounts, listings and inquiries.
        </div>
      )}
      <header className="appbar">
        <Link to="/" className="appbar__brand" aria-label="Estara home">
          ESTARA
        </Link>
        <nav className="appbar__nav" aria-label="Main">
          <NavLink to="/explore" className={({ isActive }) => (isActive ? "is-active" : "")}>
            Explore
          </NavLink>
          {profile?.role === "customer" && (
            <NavLink to="/customer/saved" className={({ isActive }) => (isActive ? "is-active" : "")}>
              Saved
            </NavLink>
          )}
          {profile?.role === "agent" && (
            <NavLink to="/agent/listings" className={({ isActive }) => (isActive ? "is-active" : "")}>
              Listings
            </NavLink>
          )}
        </nav>
        <div className="appbar__spacer" />
        <div className="appbar__right">
          {profile && <NotificationBell />}
          <UserMenu />
        </div>
      </header>
    </>
  );
}

/* ------------------------------------------------------------ dash shell --- */

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export function DashboardShell({ items, title }: { items: NavItem[]; title: string }) {
  return (
    <div className="app-root">
      <AppBar />
      <div className="dash">
        <aside className="dash__side" aria-label={`${title} navigation`}>
          <div className="dash__nav-group eyebrow">{title}</div>
          <nav className="dash__nav">
            {items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) => (isActive ? "is-active" : "")}
              >
                {i.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="dash__main">
          <Outlet />
        </main>
      </div>
      <nav className="mobile-nav" aria-label={`${title} navigation`}>
        {items.slice(0, 5).map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? "is-active" : "")}>
            {i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Plain shell for public marketplace pages. */
export function PublicShell() {
  return (
    <div className="app-root">
      <AppBar />
      <Outlet />
    </div>
  );
}
