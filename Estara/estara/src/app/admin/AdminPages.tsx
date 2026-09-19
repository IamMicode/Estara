import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import {
  adminDecideVerification,
  adminListAgents,
  adminListProperties,
  adminListReports,
  adminListUsers,
  adminResolveReport,
  adminSetUserStatus,
  adminStats,
  setPropertyStatus,
} from "../../lib/api";
import { friendlyError } from "../../lib/supabase";
import { formatDate, formatPriceShort, locationLine, timeAgo } from "../../lib/format";
import type {
  AccountStatus,
  Agent,
  Profile,
  PropertyWithRelations,
  Report,
} from "../../lib/database.types";
import { STATUS_LABELS } from "../../lib/database.types";
import {
  Alert,
  Avatar,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  StatusBadge,
  VerificationBadge,
} from "../components/ui";
import { DashboardShell, type NavItem } from "../components/Shell";

const NAV: NavItem[] = [
  { to: "/admin/dashboard", label: "Overview", end: true },
  { to: "/admin/agents", label: "Agents" },
  { to: "/admin/properties", label: "Properties" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/reports", label: "Reports" },
];

export function AdminLayout() {
  return <DashboardShell items={NAV} title="Admin" />;
}

/* -------------------------------------------------------------- overview --- */

export function AdminDashboard() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof adminStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await adminStats());
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading platform stats…" />;
  if (error) return <ErrorState body={error} onRetry={load} />;
  if (!stats) return null;

  return (
    <>
      <div className="page-head">
        <h1>Platform overview</h1>
        <p>Everything that needs your attention, at a glance.</p>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Total users</div>
          <div className="stat__value">{stats.users}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Agents</div>
          <div className="stat__value">{stats.agents}</div>
        </div>
        <div className={`stat ${stats.pendingAgents ? "stat--attention" : ""}`}>
          <div className="stat__label">Agents awaiting verification</div>
          <div className="stat__value">{stats.pendingAgents}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Published listings</div>
          <div className="stat__value">{stats.published}</div>
        </div>
        <div className={`stat ${stats.pendingProps ? "stat--attention" : ""}`}>
          <div className="stat__label">Listings awaiting review</div>
          <div className="stat__value">{stats.pendingProps}</div>
        </div>
        <div className={`stat ${stats.openReports ? "stat--attention" : ""}`}>
          <div className="stat__label">Open reports</div>
          <div className="stat__value">{stats.openReports}</div>
        </div>
      </div>

      <section className="section">
        <h2>Moderation queue</h2>
        <div className="row row--wrap" style={{ gap: 10 }}>
          <Link to="/admin/agents?status=pending" className="btn btn--primary">
            Review agents ({stats.pendingAgents})
          </Link>
          <Link to="/admin/properties?status=pending_review" className="btn btn--ghost">
            Review listings ({stats.pendingProps})
          </Link>
          <Link to="/admin/reports?status=open" className="btn btn--ghost">
            Handle reports ({stats.openReports})
          </Link>
        </div>
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- agents --- */

type AdminAgent = Agent & {
  profiles: Pick<Profile, "id" | "display_name" | "email" | "phone" | "avatar_url" | "status"> | null;
  properties: { id: string; status: string }[];
};

export function AdminAgents() {
  const { profile } = useAuth();
  const [items, setItems] = useState<AdminAgent[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decide, setDecide] = useState<{ agent: AdminAgent; action: "verified" | "rejected" | "suspended" } | null>(
    null
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await adminListAgents(filter || undefined)) as unknown as AdminAgent[]);
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async () => {
    if (!decide || !profile) return;
    if (decide.action === "rejected" && notes.trim().length < 5) {
      setError("Give the agent a reason for the rejection.");
      return;
    }
    setBusy(true);
    try {
      await adminDecideVerification(decide.agent.id, decide.action, notes.trim(), profile.id);
      setDecide(null);
      setNotes("");
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Agents</h1>
        <p>Verify agents before they can publish. Nothing is auto-approved.</p>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="toolbar">
        {[
          { v: "pending", l: "Pending" },
          { v: "verified", l: "Verified" },
          { v: "rejected", l: "Rejected" },
          { v: "not_started", l: "Not started" },
          { v: "suspended", l: "Suspended" },
          { v: "", l: "All" },
        ].map((f) => (
          <button
            key={f.v || "all"}
            className={`chip ${filter === f.v ? "is-active" : ""}`}
            onClick={() => setFilter(f.v)}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here" body="No agents match this filter." />
      ) : (
        <div className="stack">
          {items.map((a) => (
            <article key={a.id} className="list-row">
              <Avatar name={a.profiles?.display_name ?? a.agency_name} url={a.profiles?.avatar_url} />
              <div className="list-row__body">
                <div className="row row--wrap" style={{ gap: 10 }}>
                  <strong>{a.profiles?.display_name ?? "—"}</strong>
                  <VerificationBadge status={a.verification_status} />
                </div>
                <span className="muted">{a.agency_name}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {a.profiles?.email}
                  {a.business_phone ? ` · ${a.business_phone}` : ""}
                  {a.license_number ? ` · Licence ${a.license_number}` : ""}
                </span>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {a.years_experience ?? 0} yrs experience · {a.properties?.length ?? 0} listings
                  {a.verification_submitted_at
                    ? ` · submitted ${timeAgo(a.verification_submitted_at)}`
                    : ""}
                </span>
                {a.specialties?.length > 0 && (
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {a.specialties.join(", ")}
                  </span>
                )}
                {a.verification_notes && (
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    Notes: {a.verification_notes}
                  </span>
                )}
              </div>
              <div className="stack" style={{ gap: 8, minWidth: 150 }}>
                <Link to={`/agents/${a.id}`} className="btn btn--quiet btn--sm">
                  Public profile
                </Link>
                {a.verification_status !== "verified" && (
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => setDecide({ agent: a, action: "verified" })}
                  >
                    Verify
                  </button>
                )}
                {a.verification_status === "pending" && (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setDecide({ agent: a, action: "rejected" })}
                  >
                    Reject
                  </button>
                )}
                {a.verification_status === "verified" && (
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => setDecide({ agent: a, action: "suspended" })}
                  >
                    Suspend
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {decide && (
        <Modal
          title={
            decide.action === "verified"
              ? "Verify this agent?"
              : decide.action === "rejected"
                ? "Reject this verification"
                : "Suspend this agent?"
          }
          onClose={() => setDecide(null)}
        >
          <p className="muted" style={{ marginBottom: 16 }}>
            <strong>{decide.agent.profiles?.display_name}</strong> — {decide.agent.agency_name}
          </p>
          <Field
            label={decide.action === "verified" ? "Internal note (optional)" : "Reason (shown to the agent)"}
          >
            {(p) => (
              <textarea
                {...p}
                className="textarea"
                style={{ minHeight: 100 }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  decide.action === "rejected"
                    ? "e.g. The licence number provided couldn't be validated. Please resubmit with a CAC certificate."
                    : ""
                }
              />
            )}
          </Field>
          <div className="modal__actions">
            <button className="btn btn--quiet" onClick={() => setDecide(null)}>
              Cancel
            </button>
            <button
              className={decide.action === "verified" ? "btn btn--primary" : "btn btn--danger"}
              disabled={busy}
              onClick={confirm}
            >
              {busy ? "Working…" : decide.action === "verified" ? "Verify agent" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------ properties --- */

export function AdminProperties() {
  const [items, setItems] = useState<PropertyWithRelations[]>([]);
  const [status, setStatus] = useState("pending_review");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reject, setReject] = useState<PropertyWithRelations | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await adminListProperties(status || undefined, q || undefined));
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (p: PropertyWithRelations) => {
    setBusy(p.id);
    try {
      await setPropertyStatus(p.id, "published", "");
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  };

  const doReject = async () => {
    if (!reject) return;
    if (reason.trim().length < 5) {
      setError("Give the agent a clear reason so they can fix the listing.");
      return;
    }
    setBusy(reject.id);
    try {
      await setPropertyStatus(reject.id, "rejected", reason.trim());
      setReject(null);
      setReason("");
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  };

  const suspend = async (p: PropertyWithRelations) => {
    setBusy(p.id);
    try {
      await setPropertyStatus(p.id, "suspended", "Suspended by moderation.");
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Properties</h1>
        <p>Review submissions and moderate what's live on Estara.</p>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search listing titles…"
          aria-label="Search listings"
        />
        <button className="btn btn--ghost" type="submit">
          Search
        </button>
      </form>

      <div className="toolbar">
        {["pending_review", "published", "rejected", "draft", "suspended", ""].map((s) => (
          <button
            key={s || "all"}
            className={`chip ${status === s ? "is-active" : ""}`}
            onClick={() => setStatus(s)}
          >
            {s ? STATUS_LABELS[s as keyof typeof STATUS_LABELS] : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing to review" body="No listings match this filter." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Agent</th>
                <th>Price</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/properties/${p.id}`} className="link-quiet">
                      {p.title}
                    </Link>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {locationLine(p)} · {p.property_images?.length ?? 0} photos
                    </div>
                    {p.rejection_reason && (
                      <div className="muted" style={{ fontSize: 12.5 }}>
                        Reason: {p.rejection_reason}
                      </div>
                    )}
                  </td>
                  <td>
                    {p.agents ? (
                      <Link to={`/agents/${p.agents.id}`} className="link-quiet">
                        {p.agents.agency_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatPriceShort(p.price, p.currency)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="muted">{formatDate(p.updated_at)}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {p.status === "pending_review" && (
                        <>
                          <button
                            className="btn btn--primary btn--sm"
                            disabled={busy === p.id}
                            onClick={() => approve(p)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn--ghost btn--sm"
                            disabled={busy === p.id}
                            onClick={() => setReject(p)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {p.status === "published" && (
                        <button
                          className="btn btn--danger btn--sm"
                          disabled={busy === p.id}
                          onClick={() => suspend(p)}
                        >
                          Suspend
                        </button>
                      )}
                      {p.status === "suspended" && (
                        <button
                          className="btn btn--ghost btn--sm"
                          disabled={busy === p.id}
                          onClick={() => approve(p)}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reject && (
        <Modal title="Reject this listing" onClose={() => setReject(null)}>
          <p className="muted" style={{ marginBottom: 16 }}>
            <strong>{reject.title}</strong> — the agent will see this reason and can fix and
            resubmit.
          </p>
          <Field label="Reason for rejection">
            {(p) => (
              <textarea
                {...p}
                className="textarea"
                style={{ minHeight: 110 }}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. The photos don't match the description, and the price appears to be a typo."
              />
            )}
          </Field>
          <div className="modal__actions">
            <button className="btn btn--quiet" onClick={() => setReject(null)}>
              Cancel
            </button>
            <button className="btn btn--danger" disabled={busy === reject.id} onClick={doReject}>
              {busy === reject.id ? "Rejecting…" : "Reject listing"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- users --- */

export function AdminUsers() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await adminListUsers({ q: q || undefined, role: role || undefined }));
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [q, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (u: Profile, status: AccountStatus) => {
    setBusy(u.id);
    try {
      await adminSetUserStatus(u.id, status);
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Users</h1>
        <p>Everyone on the platform. Suspending an account blocks it immediately.</p>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search users"
        />
        <button className="btn btn--ghost" type="submit">
          Search
        </button>
      </form>

      <div className="toolbar">
        {["", "customer", "agent", "admin"].map((r) => (
          <button
            key={r || "all"}
            className={`chip ${role === r ? "is-active" : ""}`}
            onClick={() => setRole(r)}
          >
            {r ? r[0].toUpperCase() + r.slice(1) + "s" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="No users found" body="Try a different search." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row">
                      <Avatar name={u.display_name || u.email} url={u.avatar_url} />
                      <div>
                        <div>{u.display_name || "—"}</div>
                        <div className="muted" style={{ fontSize: 12.5 }}>
                          {u.email}
                          {u.phone ? ` · ${u.phone}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge">{u.role}</span>
                  </td>
                  <td>
                    <span className={`badge badge--${u.status}`}>{u.status}</span>
                  </td>
                  <td className="muted">{formatDate(u.created_at)}</td>
                  <td>
                    {u.id === profile?.id ? (
                      <span className="muted">That's you</span>
                    ) : u.status === "active" ? (
                      <button
                        className="btn btn--danger btn--sm"
                        disabled={busy === u.id}
                        onClick={() => setStatus(u, "suspended")}
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        className="btn btn--ghost btn--sm"
                        disabled={busy === u.id}
                        onClick={() => setStatus(u, "active")}
                      >
                        Reinstate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- reports --- */

type AdminReport = Report & {
  properties: { id: string; title: string; city: string } | null;
  profiles: { id: string; display_name: string; email: string } | null;
  agents: { id: string; agency_name: string } | null;
};

export function AdminReports() {
  const [items, setItems] = useState<AdminReport[]>([]);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolve, setResolve] = useState<{ report: AdminReport; outcome: Report["status"] } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await adminListReports(status || undefined)) as unknown as AdminReport[]);
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async () => {
    if (!resolve) return;
    setBusy(true);
    try {
      await adminResolveReport(resolve.report.id, resolve.outcome, notes.trim());
      setResolve(null);
      setNotes("");
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Reports</h1>
        <p>Listings and agents flagged by the community.</p>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="toolbar">
        {["open", "investigating", "resolved", "dismissed", ""].map((s) => (
          <button
            key={s || "all"}
            className={`chip ${status === s ? "is-active" : ""}`}
            onClick={() => setStatus(s)}
          >
            {s ? s[0].toUpperCase() + s.slice(1) : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing flagged" body="No reports match this filter." />
      ) : (
        <div className="stack">
          {items.map((r) => (
            <article key={r.id} className="list-row">
              <div className="list-row__body">
                <div className="row row--wrap" style={{ gap: 10 }}>
                  <strong>{r.reason}</strong>
                  <span className={`badge badge--${r.status}`}>{r.status}</span>
                </div>
                {r.properties && (
                  <Link to={`/properties/${r.properties.id}`} className="link-quiet">
                    {r.properties.title} · {r.properties.city}
                  </Link>
                )}
                {r.agents && <span className="muted">Agent: {r.agents.agency_name}</span>}
                {r.description && <p className="muted">{r.description}</p>}
                <span className="muted" style={{ fontSize: 12.5 }}>
                  Reported by {r.profiles?.display_name ?? "a user"} · {timeAgo(r.created_at)}
                </span>
                {r.resolution_notes && (
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    Resolution: {r.resolution_notes}
                  </span>
                )}
              </div>
              {(r.status === "open" || r.status === "investigating") && (
                <div className="stack" style={{ gap: 8, minWidth: 150 }}>
                  {r.status === "open" && (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => setResolve({ report: r, outcome: "investigating" })}
                    >
                      Investigate
                    </button>
                  )}
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => setResolve({ report: r, outcome: "resolved" })}
                  >
                    Resolve
                  </button>
                  <button
                    className="btn btn--quiet btn--sm"
                    onClick={() => setResolve({ report: r, outcome: "dismissed" })}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {resolve && (
        <Modal title={`Mark report as ${resolve.outcome}`} onClose={() => setResolve(null)}>
          <p className="muted" style={{ marginBottom: 16 }}>
            {resolve.report.reason}
            {resolve.report.properties ? ` — ${resolve.report.properties.title}` : ""}
          </p>
          <Field label="Resolution notes" hint="Internal record of what you did.">
            {(p) => (
              <textarea
                {...p}
                className="textarea"
                style={{ minHeight: 100 }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
          </Field>
          <div className="modal__actions">
            <button className="btn btn--quiet" onClick={() => setResolve(null)}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={busy} onClick={confirm}>
              {busy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
