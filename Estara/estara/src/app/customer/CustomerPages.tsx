import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import {
  getInquiryThread,
  listCustomerInquiries,
  listFavorites,
  listRecentlyViewed,
  removeFavorite,
  replyToInquiry,
  updateProfile,
} from "../../lib/api";
import { supabase, friendlyError } from "../../lib/supabase";
import { greeting, locationLine, timeAgo } from "../../lib/format";
import { profileSchema, validate } from "../../lib/validation";
import type { InquiryMessage, PropertyWithRelations } from "../../lib/database.types";
import {
  Alert,
  Avatar,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  SkeletonCards,
  Spinner,
} from "../components/ui";
import { PropertyCard, primaryImage } from "../components/PropertyCard";
import { DashboardShell, type NavItem } from "../components/Shell";

const NAV: NavItem[] = [
  { to: "/customer/dashboard", label: "Dashboard", end: true },
  { to: "/customer/saved", label: "Saved" },
  { to: "/customer/inquiries", label: "Inquiries" },
  { to: "/customer/profile", label: "Profile" },
  { to: "/customer/settings", label: "Settings" },
];

export function CustomerLayout() {
  return <DashboardShell items={NAV} title="My Estara" />;
}

/* ------------------------------------------------------------ dashboard ---- */

export function CustomerDashboard() {
  const { profile } = useAuth();
  const [saved, setSaved] = useState<PropertyWithRelations[]>([]);
  const [recent, setRecent] = useState<PropertyWithRelations[]>([]);
  const [inquiryCount, setInquiryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError("");
    try {
      const [favs, views, inqs] = await Promise.all([
        listFavorites(profile.id),
        listRecentlyViewed(profile.id, 3),
        listCustomerInquiries(profile.id),
      ]);
      setSaved(favs.map((f) => f.properties).filter(Boolean) as PropertyWithRelations[]);
      setRecent(views.map((v) => v.properties).filter(Boolean));
      setInquiryCount(inqs.length);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <SkeletonCards count={3} />;
  if (error) return <ErrorState body={error} onRetry={load} />;

  return (
    <>
      <div className="page-head">
        <h1>{greeting(profile?.first_name || profile?.display_name || "there")}</h1>
        <p>Pick up where you left off.</p>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Saved properties</div>
          <div className="stat__value">{saved.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Inquiries sent</div>
          <div className="stat__value">{inquiryCount}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Recently viewed</div>
          <div className="stat__value">{recent.length}</div>
        </div>
      </div>

      <section className="section">
        <div className="row row--between">
          <h2>Saved properties</h2>
          {saved.length > 0 && (
            <Link to="/customer/saved" className="link-quiet">
              View all
            </Link>
          )}
        </div>
        {saved.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            body="Tap the heart on any listing and it'll wait for you here."
            action={
              <Link to="/explore" className="btn btn--primary">
                Explore properties
              </Link>
            }
          />
        ) : (
          <div className="property-grid">
            {saved.slice(0, 3).map((p) => (
              <PropertyCard key={p.id} property={p} favorited onToggleFavorite={undefined} />
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="section">
          <h2>Recently viewed</h2>
          <div className="property-grid">
            {recent.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- saved ---- */

export function CustomerSaved() {
  const { profile } = useAuth();
  const [items, setItems] = useState<PropertyWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const favs = await listFavorites(profile.id);
      setItems(favs.map((f) => f.properties).filter(Boolean) as PropertyWithRelations[]);
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const unsave = async (id: string) => {
    if (!profile) return;
    setItems((s) => s.filter((p) => p.id !== id));
    try {
      await removeFavorite(profile.id, id);
    } catch (e) {
      setError(friendlyError(e));
      void load();
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Saved properties</h1>
        <p>Everything you've kept an eye on.</p>
      </div>
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {loading ? (
        <SkeletonCards count={6} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No saved properties"
          body="When you find something you like, save it and it'll appear here."
          action={
            <Link to="/explore" className="btn btn--primary">
              Explore properties
            </Link>
          }
        />
      ) : (
        <div className="property-grid">
          {items.map((p) => (
            <PropertyCard key={p.id} property={p} favorited onToggleFavorite={unsave} />
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ inquiries ---- */

interface CustomerInquiry {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  properties: PropertyWithRelations | null;
  agents: { id: string; agency_name: string; profiles: { display_name: string | null; avatar_url: string | null } | null } | null;
}

function ThreadModal({
  inquiry,
  onClose,
}: {
  inquiry: CustomerInquiry;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setMessages(await getInquiryThread(inquiry.id));
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [inquiry.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 2) return;
    setBusy(true);
    try {
      await replyToInquiry(inquiry.id, profile!.id, body.trim());
      setBody("");
      await load();
    } catch (e2) {
      setErr(friendlyError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={inquiry.subject} onClose={onClose}>
      {err && <Alert kind="error">{err}</Alert>}
      <div className="thread">
        <div className="thread__msg thread__msg--mine">
          <div className="thread__meta">You · {timeAgo(inquiry.created_at)}</div>
          {inquiry.message}
        </div>
        {loading ? (
          <LoadingBlock label="Loading conversation…" />
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`thread__msg ${m.sender_id === profile?.id ? "thread__msg--mine" : ""}`}
            >
              <div className="thread__meta">
                {m.sender_id === profile?.id ? "You" : "Agent"} · {timeAgo(m.created_at)}
              </div>
              {m.body}
            </div>
          ))
        )}
      </div>
      <form className="form" onSubmit={send} style={{ marginTop: 16 }}>
        <textarea
          className="textarea"
          style={{ minHeight: 80 }}
          placeholder="Write a reply…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Reply message"
        />
        <div className="modal__actions">
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Close
          </button>
          <button className="btn btn--primary" disabled={busy || body.trim().length < 2}>
            {busy ? "Sending…" : "Send reply"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CustomerInquiries() {
  const { profile } = useAuth();
  const [items, setItems] = useState<CustomerInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<CustomerInquiry | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      setItems((await listCustomerInquiries(profile.id)) as unknown as CustomerInquiry[]);
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <h1>My inquiries</h1>
        <p>Conversations with agents about properties you're interested in.</p>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState body={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No inquiries yet"
          body="Contact an agent from any listing and the conversation will show up here."
          action={
            <Link to="/explore" className="btn btn--primary">
              Explore properties
            </Link>
          }
        />
      ) : (
        <div className="stack">
          {items.map((i) => {
            const img = i.properties ? primaryImage(i.properties) : null;
            return (
              <article key={i.id} className="list-row">
                {img ? (
                  <img className="list-row__thumb" src={img} alt="" />
                ) : (
                  <div className="list-row__thumb" />
                )}
                <div className="list-row__body">
                  <div className="row row--between row--wrap">
                    <strong>{i.subject}</strong>
                    <span className={`badge badge--${i.status}`}>{i.status}</span>
                  </div>
                  {i.properties && (
                    <Link to={`/properties/${i.properties.id}`} className="link-quiet">
                      {i.properties.title} · {locationLine(i.properties)}
                    </Link>
                  )}
                  <p className="muted clamp-2">{i.message}</p>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {i.agents?.profiles?.display_name || i.agents?.agency_name} · {timeAgo(i.created_at)}
                  </span>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => setOpen(i)}>
                  View thread
                </button>
              </article>
            );
          })}
        </div>
      )}

      {open && (
        <ThreadModal
          inquiry={open}
          onClose={() => {
            setOpen(null);
            void load();
          }}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------- profile ---- */

export function CustomerProfile() {
  const { profile, refresh } = useAuth();
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    phone: profile?.phone ?? "",
    bio: profile?.bio ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(profileSchema, form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      // display_name is a generated column (first_name + last_name) — writing
      // it is rejected by Postgres, so we only send the source fields.
      await updateProfile(profile!.id, form);
      await refresh();
      setMsg("Profile updated.");
    } catch (e2) {
      setErr(friendlyError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Profile</h1>
        <p>How agents see you when you get in touch.</p>
      </div>

      <div className="card card--pad" style={{ maxWidth: 620 }}>
        <div className="row" style={{ marginBottom: 22 }}>
          <Avatar name={profile?.display_name || profile?.email || ""} url={profile?.avatar_url} large />
          <div>
            <div style={{ fontWeight: 500 }}>{profile?.display_name}</div>
            <div className="muted">{profile?.email}</div>
          </div>
        </div>

        {msg && <Alert kind="success">{msg}</Alert>}
        {err && <Alert kind="error">{err}</Alert>}

        <form className="form" onSubmit={submit} noValidate style={{ marginTop: 16 }}>
          <div className="form-row">
            <Field label="First name" error={errors.first_name}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Last name" error={errors.last_name}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              )}
            </Field>
          </div>
          <Field label="Phone" error={errors.phone}>
            {(p) => (
              <input
                {...p}
                className="input"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            )}
          </Field>
          <Field label="About you" error={errors.bio} hint="Optional — a line or two for agents you contact.">
            {(p) => (
              <textarea
                {...p}
                className="textarea"
                style={{ minHeight: 90 }}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            )}
          </Field>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner /> : null}
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- settings ---- */

export function CustomerSettings() {
  const { profile, signOut } = useAuth();
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (pw.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw.password !== pw.confirm) return setErr("Passwords don't match.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw.password });
      if (error) throw error;
      setPw({ password: "", confirm: "" });
      setMsg("Password updated.");
    } catch (e2) {
      setErr(friendlyError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p>Account and security.</p>
      </div>

      <div className="stack" style={{ maxWidth: 620 }}>
        <div className="card card--pad">
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Email</h2>
          <p className="muted">{profile?.email}</p>
        </div>

        <div className="card card--pad">
          <h2 style={{ fontSize: 18, marginBottom: 14 }}>Change password</h2>
          {msg && <Alert kind="success">{msg}</Alert>}
          {err && <Alert kind="error">{err}</Alert>}
          <form className="form" onSubmit={changePassword} style={{ marginTop: 12 }}>
            <Field label="New password">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={pw.password}
                  onChange={(e) => setPw({ ...pw, password: e.target.value })}
                />
              )}
            </Field>
            <Field label="Confirm new password">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                />
              )}
            </Field>
            <button className="btn btn--primary" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>

        <div className="card card--pad">
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Sign out</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Sign out of Estara on this device.
          </p>
          <button className="btn btn--ghost" onClick={() => signOut()}>
            Sign out
          </button>
        </div>

        <div className="card card--pad card--danger">
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Delete account</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Account deletion is permanent and removes your saved properties and inquiries.
          </p>
          <button className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
            Delete my account
          </button>
        </div>
      </div>

      {confirmDelete && (
        <Modal title="Delete your account?" onClose={() => setConfirmDelete(false)}>
          <Alert kind="warn">
            For safety, account deletion is handled by our support team so we can confirm it's really
            you. Email <strong>support@estara.example</strong> from {profile?.email} and we'll remove
            your account within 48 hours.
          </Alert>
          <div className="modal__actions">
            <button className="btn btn--primary" onClick={() => setConfirmDelete(false)}>
              Understood
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
