import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import {
  deleteProperty,
  getInquiryThread,
  listAgentInquiries,
  listAgentProperties,
  replyToInquiry,
  setInquiryStatus,
  setPropertyStatus,
  submitVerification,
  updateAgent,
  updateProfile,
} from "../../lib/api";
import { supabase, friendlyError } from "../../lib/supabase";
import { formatPriceWithPeriod, greeting, locationLine, timeAgo } from "../../lib/format";
import { agencySchema, profileSchema, validate } from "../../lib/validation";
import { LOCATIONS, STATUS_LABELS, type InquiryMessage, type PropertyStatus, type PropertyWithRelations } from "../../lib/database.types";
import {
  Alert,
  Avatar,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  Spinner,
  StatusBadge,
  VerificationBadge,
} from "../components/ui";
import { primaryImage } from "../components/PropertyCard";
import { DashboardShell, type NavItem } from "../components/Shell";

const NAV: NavItem[] = [
  { to: "/agent/dashboard", label: "Dashboard", end: true },
  { to: "/agent/listings", label: "Listings" },
  { to: "/agent/inquiries", label: "Inquiries" },
  { to: "/agent/verification", label: "Verification" },
  { to: "/agent/profile", label: "Profile" },
  { to: "/agent/settings", label: "Settings" },
];

export function AgentLayout() {
  return <DashboardShell items={NAV} title="Agent" />;
}

/** Banner reminding unverified agents why they can't publish yet. */
function VerificationNotice() {
  const { agent } = useAuth();
  if (!agent || agent.verification_status === "verified") return null;

  const copy: Record<string, { kind: "warn" | "info" | "error"; text: string }> = {
    not_started: {
      kind: "warn",
      text: "Your agent account isn't verified yet. Complete verification to create and publish listings.",
    },
    pending: {
      kind: "info",
      text: "Your verification is under review. We'll notify you as soon as an admin makes a decision.",
    },
    rejected: {
      kind: "error",
      text: `Your verification was rejected${agent.verification_notes ? `: ${agent.verification_notes}` : "."} You can correct your details and resubmit.`,
    },
    suspended: {
      kind: "error",
      text: "Your agent account is suspended. Contact Estara support for details.",
    },
  };
  const c = copy[agent.verification_status];
  if (!c) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <Alert kind={c.kind}>
        {c.text}{" "}
        {agent.verification_status !== "pending" && (
          <Link to="/agent/verification" className="link-quiet">
            Go to verification →
          </Link>
        )}
      </Alert>
    </div>
  );
}

/* ------------------------------------------------------------ dashboard ---- */

type AgentProperty = PropertyWithRelations & { inquiries: { id: string }[] };

export function AgentDashboard() {
  const { profile, agent } = useAuth();
  const [items, setItems] = useState<AgentProperty[]>([]);
  const [inquiries, setInquiries] = useState<{ id: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!agent) return;
    setLoading(true);
    try {
      const [props, inqs] = await Promise.all([
        listAgentProperties(agent.id),
        listAgentInquiries(agent.id),
      ]);
      setItems(props);
      setInquiries(inqs as unknown as { id: string; status: string }[]);
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!agent) return <LoadingBlock />;
  if (loading) return <LoadingBlock label="Loading your dashboard…" />;
  if (error) return <ErrorState body={error} onRetry={load} />;

  const published = items.filter((p) => p.status === "published");
  const pending = items.filter((p) => p.status === "pending_review");
  const drafts = items.filter((p) => p.status === "draft");
  const views = items.reduce((s, p) => s + p.view_count, 0);
  const newInq = inquiries.filter((i) => i.status === "new").length;

  return (
    <>
      <div className="page-head">
        <h1>{greeting(profile?.first_name || "there")}</h1>
        <p>{agent.agency_name}</p>
      </div>

      <VerificationNotice />

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Published</div>
          <div className="stat__value">{published.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Pending review</div>
          <div className="stat__value">{pending.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Drafts</div>
          <div className="stat__value">{drafts.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Total views</div>
          <div className="stat__value">{views}</div>
        </div>
        <div className="stat">
          <div className="stat__label">New inquiries</div>
          <div className="stat__value">{newInq}</div>
        </div>
      </div>

      <div className="row row--wrap" style={{ gap: 10, marginBottom: 30 }}>
        {agent.verification_status === "verified" ? (
          <Link to="/agent/listings/new" className="btn btn--primary">
            Create a listing
          </Link>
        ) : (
          <Link to="/agent/verification" className="btn btn--primary">
            Complete verification
          </Link>
        )}
        <Link to="/agent/listings" className="btn btn--ghost">
          Manage listings
        </Link>
        <Link to="/agent/inquiries" className="btn btn--ghost">
          View inquiries
        </Link>
      </div>

      <section className="section">
        <h2>Recent listings</h2>
        {items.length === 0 ? (
          <EmptyState
            title="No listings yet"
            body="Once you're verified, create your first listing and it'll appear here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Inquiries</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 6).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/agent/listings/${p.id}/edit`} className="link-quiet">
                        {p.title}
                      </Link>
                      <div className="muted" style={{ fontSize: 12.5 }}>
                        {locationLine(p)}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td>{p.view_count}</td>
                    <td>{p.inquiries?.length ?? 0}</td>
                    <td className="muted">{timeAgo(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* -------------------------------------------------------------- listings --- */

const LISTING_TABS: { value: PropertyStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "pending_review", label: "Pending" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

export function AgentListings() {
  const { agent } = useAuth();
  const [items, setItems] = useState<AgentProperty[]>([]);
  const [tab, setTab] = useState<PropertyStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AgentProperty | null>(null);

  const load = useCallback(async () => {
    if (!agent) return;
    setLoading(true);
    try {
      setItems(await listAgentProperties(agent.id));
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (p: AgentProperty, status: PropertyStatus) => {
    setBusyId(p.id);
    setError("");
    try {
      await setPropertyStatus(p.id, status);
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyId("");
    }
  };

  const remove = async (p: AgentProperty) => {
    setBusyId(p.id);
    try {
      await deleteProperty(p.id);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyId("");
    }
  };

  const shown = tab === "all" ? items : items.filter((p) => p.status === tab);
  const count = (v: PropertyStatus | "all") =>
    v === "all" ? items.length : items.filter((p) => p.status === v).length;

  return (
    <>
      <div className="row row--between row--wrap page-head">
        <div>
          <h1>My listings</h1>
          <p>Create, edit and manage everything you have on Estara.</p>
        </div>
        {agent?.verification_status === "verified" && (
          <Link to="/agent/listings/new" className="btn btn--primary">
            + New listing
          </Link>
        )}
      </div>

      <VerificationNotice />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="toolbar">
        {LISTING_TABS.map((t) => (
          <button
            key={t.value}
            className={`chip ${tab === t.value ? "is-active" : ""}`}
            onClick={() => setTab(t.value)}
          >
            {t.label} ({count(t.value)})
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : shown.length === 0 ? (
        <EmptyState
          title={tab === "all" ? "No listings yet" : `No ${tab.replace("_", " ")} listings`}
          body={
            agent?.verification_status === "verified"
              ? "Create a listing to get started — you can save it as a draft and finish later."
              : "You'll be able to create listings once your account is verified."
          }
          action={
            agent?.verification_status === "verified" ? (
              <Link to="/agent/listings/new" className="btn btn--primary">
                Create a listing
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="stack">
          {shown.map((p) => {
            const img = primaryImage(p);
            return (
              <article key={p.id} className="list-row">
                {img ? <img className="list-row__thumb" src={img} alt="" /> : <div className="list-row__thumb" />}
                <div className="list-row__body">
                  <div className="row row--wrap" style={{ gap: 10 }}>
                    <strong>{p.title}</strong>
                    <StatusBadge status={p.status} />
                  </div>
                  <span className="muted">{locationLine(p)}</span>
                  <span>{formatPriceWithPeriod(p.price, p.currency, p.listing_type)}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {p.view_count} views · {p.inquiries?.length ?? 0} inquiries · updated{" "}
                    {timeAgo(p.updated_at)}
                  </span>
                  {p.status === "rejected" && p.rejection_reason && (
                    <div style={{ marginTop: 8 }}>
                      <Alert kind="error">Rejected: {p.rejection_reason}</Alert>
                    </div>
                  )}
                </div>

                <div className="stack" style={{ gap: 8, minWidth: 160 }}>
                  <Link to={`/agent/listings/${p.id}/edit`} className="btn btn--ghost btn--sm">
                    Edit
                  </Link>
                  {p.status === "published" && (
                    <Link to={`/properties/${p.id}`} className="btn btn--quiet btn--sm">
                      View live
                    </Link>
                  )}
                  {(p.status === "draft" || p.status === "rejected") && (
                    <button
                      className="btn btn--primary btn--sm"
                      disabled={busyId === p.id}
                      onClick={() => changeStatus(p, "pending_review")}
                    >
                      Submit for review
                    </button>
                  )}
                  {p.status === "pending_review" && (
                    <button
                      className="btn btn--quiet btn--sm"
                      disabled={busyId === p.id}
                      onClick={() => changeStatus(p, "draft")}
                    >
                      Withdraw
                    </button>
                  )}
                  {p.status === "published" && (
                    <>
                      <button
                        className="btn btn--quiet btn--sm"
                        disabled={busyId === p.id}
                        onClick={() => changeStatus(p, p.listing_type === "sale" ? "sold" : "rented")}
                      >
                        Mark as {p.listing_type === "sale" ? "sold" : "rented"}
                      </button>
                      <button
                        className="btn btn--quiet btn--sm"
                        disabled={busyId === p.id}
                        onClick={() => changeStatus(p, "archived")}
                      >
                        Archive
                      </button>
                    </>
                  )}
                  {(p.status === "archived" || p.status === "sold" || p.status === "rented") && (
                    <button
                      className="btn btn--quiet btn--sm"
                      disabled={busyId === p.id}
                      onClick={() => changeStatus(p, "draft")}
                    >
                      Relist as draft
                    </button>
                  )}
                  {p.status === "draft" && (
                    <button className="btn btn--danger btn--sm" onClick={() => setConfirmDelete(p)}>
                      Delete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <Modal title="Delete this draft?" onClose={() => setConfirmDelete(null)}>
          <p className="muted" style={{ marginBottom: 18 }}>
            <strong>{confirmDelete.title}</strong> and its images will be permanently removed. This
            can't be undone.
          </p>
          <div className="modal__actions">
            <button className="btn btn--quiet" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              disabled={busyId === confirmDelete.id}
              onClick={() => remove(confirmDelete)}
            >
              {busyId === confirmDelete.id ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------ inquiries ---- */

interface AgentInquiry {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  properties: { id: string; title: string; city: string } | null;
  profiles: { id: string; display_name: string; email: string; phone: string | null; avatar_url: string | null } | null;
}

function AgentThread({ inquiry, onClose }: { inquiry: AgentInquiry; onClose: () => void }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setMessages(await getInquiryThread(inquiry.id));
    } catch (e) {
      setErr(friendlyError(e));
    }
  }, [inquiry.id]);

  useEffect(() => {
    void load();
    if (inquiry.status === "new") void setInquiryStatus(inquiry.id, "read");
  }, [load, inquiry.id, inquiry.status]);

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
      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <span className="eyebrow">Customer</span>
        <div style={{ marginTop: 6 }}>
          <strong>{inquiry.profiles?.display_name}</strong>
          <div className="muted">{inquiry.profiles?.email}</div>
          {inquiry.profiles?.phone && <div className="muted">{inquiry.profiles.phone}</div>}
        </div>
      </div>

      <div className="thread">
        <div className="thread__msg">
          <div className="thread__meta">
            {inquiry.profiles?.display_name} · {timeAgo(inquiry.created_at)}
          </div>
          {inquiry.message}
        </div>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`thread__msg ${m.sender_id === profile?.id ? "thread__msg--mine" : ""}`}
          >
            <div className="thread__meta">
              {m.sender_id === profile?.id ? "You" : inquiry.profiles?.display_name} ·{" "}
              {timeAgo(m.created_at)}
            </div>
            {m.body}
          </div>
        ))}
      </div>

      <form className="form" onSubmit={send} style={{ marginTop: 16 }}>
        <textarea
          className="textarea"
          style={{ minHeight: 80 }}
          placeholder="Reply to this customer…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Reply message"
        />
        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--quiet"
            onClick={async () => {
              await setInquiryStatus(inquiry.id, "closed");
              onClose();
            }}
          >
            Close inquiry
          </button>
          <button className="btn btn--primary" disabled={busy || body.trim().length < 2}>
            {busy ? "Sending…" : "Send reply"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AgentInquiries() {
  const { agent } = useAuth();
  const [items, setItems] = useState<AgentInquiry[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<AgentInquiry | null>(null);

  const load = useCallback(async () => {
    if (!agent) return;
    setLoading(true);
    try {
      setItems((await listAgentInquiries(agent.id)) as unknown as AgentInquiry[]);
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <>
      <div className="page-head">
        <h1>Inquiries</h1>
        <p>Messages from people interested in your properties.</p>
      </div>

      <div className="toolbar">
        {["all", "new", "read", "responded", "closed"].map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? "is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f} ({f === "all" ? items.length : items.filter((i) => i.status === f).length})
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState body={error} onRetry={load} />
      ) : shown.length === 0 ? (
        <EmptyState
          title="No inquiries"
          body="When someone contacts you about a listing, it'll appear here."
        />
      ) : (
        <div className="stack">
          {shown.map((i) => (
            <article key={i.id} className="list-row">
              <Avatar name={i.profiles?.display_name ?? "?"} url={i.profiles?.avatar_url} />
              <div className="list-row__body">
                <div className="row row--between row--wrap">
                  <strong>{i.subject}</strong>
                  <span className={`badge badge--${i.status}`}>{i.status}</span>
                </div>
                <span className="muted">
                  {i.profiles?.display_name} · {i.properties?.title} · {timeAgo(i.created_at)}
                </span>
                <p className="muted clamp-2">{i.message}</p>
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => setOpen(i)}>
                Open
              </button>
            </article>
          ))}
        </div>
      )}

      {open && (
        <AgentThread
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

/* ----------------------------------------------------------- verification -- */

const SPECIALTIES = [
  "Residential sales",
  "Luxury homes",
  "Rentals",
  "Land & plots",
  "Commercial",
  "Short lets",
  "Property management",
];

export function AgentVerification() {
  const { agent, refresh } = useAuth();
  const [form, setForm] = useState({
    agency_name: agent?.agency_name ?? "",
    license_number: agent?.license_number ?? "",
    business_phone: agent?.business_phone ?? "",
    business_email: agent?.business_email ?? "",
    website: agent?.website ?? "",
    years_experience: agent?.years_experience ?? null,
  });
  const [specialties, setSpecialties] = useState<string[]>(agent?.specialties ?? []);
  const [areas, setAreas] = useState<string[]>(agent?.service_locations ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  if (!agent) return <LoadingBlock />;

  const locked = agent.verification_status === "pending" || agent.verification_status === "verified";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(agencySchema, form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await submitVerification(agent.id, {
        ...form,
        years_experience: form.years_experience,
        specialties,
        service_locations: areas,
      });
      await refresh();
      setMsg("Verification submitted. An admin will review your details.");
    } catch (e2) {
      setErr(friendlyError(e2));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const allRegions = Object.values(LOCATIONS).flat();

  return (
    <>
      <div className="page-head">
        <h1>Agent verification</h1>
        <p>
          Verification protects buyers and unlocks publishing. An Estara admin reviews every
          submission — accounts are never auto-verified.
        </p>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 22 }}>
        <span className="muted">Current status:</span>
        <VerificationBadge status={agent.verification_status} />
      </div>

      {agent.verification_status === "rejected" && agent.verification_notes && (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="error">Reviewer notes: {agent.verification_notes}</Alert>
        </div>
      )}
      {agent.verification_status === "verified" && (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="success">
            You're verified. You can create and publish listings.{" "}
            <Link to="/agent/listings/new" className="link-quiet">
              Create a listing →
            </Link>
          </Alert>
        </div>
      )}
      {agent.verification_status === "pending" && (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="info">
            Submitted {agent.verification_submitted_at ? timeAgo(agent.verification_submitted_at) : ""}.
            We'll notify you when a decision is made.
          </Alert>
        </div>
      )}
      {msg && (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="success">{msg}</Alert>
        </div>
      )}
      {err && (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="error">{err}</Alert>
        </div>
      )}

      <form className="card card--pad form" style={{ maxWidth: 720 }} onSubmit={submit} noValidate>
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form">
            <Field label="Agency name" error={errors.agency_name}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  value={form.agency_name}
                  onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                />
              )}
            </Field>
            <div className="form-row">
              <Field
                label="License / registration number"
                error={errors.license_number}
                hint="CAC number or professional licence, if you have one."
              >
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    value={form.license_number}
                    onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Years of experience" error={errors.years_experience}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="number"
                    min={0}
                    value={form.years_experience ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        years_experience: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                )}
              </Field>
            </div>
            <div className="form-row">
              <Field label="Business phone" error={errors.business_phone}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="tel"
                    value={form.business_phone}
                    onChange={(e) => setForm({ ...form, business_phone: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Business email" error={errors.business_email}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="email"
                    value={form.business_email}
                    onChange={(e) => setForm({ ...form, business_email: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label="Website" error={errors.website} hint="Optional. Include https://">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="url"
                  placeholder="https://"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              )}
            </Field>

            <div className="field-group">
              <span className="label">Specialties</span>
              <div className="row row--wrap" style={{ gap: 8 }}>
                {SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${specialties.includes(s) ? "is-active" : ""}`}
                    aria-pressed={specialties.includes(s)}
                    onClick={() => toggle(specialties, setSpecialties, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <span className="label">Areas you serve</span>
              <div className="row row--wrap" style={{ gap: 8 }}>
                {allRegions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`chip ${areas.includes(r) ? "is-active" : ""}`}
                    aria-pressed={areas.includes(r)}
                    onClick={() => toggle(areas, setAreas, r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        {!locked && (
          <button className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner /> : null}
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        )}
      </form>
    </>
  );
}

/* -------------------------------------------------------------- profile ---- */

export function AgentProfile() {
  const { profile, agent, refresh } = useAuth();
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
        <h1>Public profile</h1>
        <p>This is what customers see on your listings and agent page.</p>
      </div>

      <div className="card card--pad" style={{ maxWidth: 660 }}>
        <div className="row row--between row--wrap" style={{ marginBottom: 20 }}>
          <div className="row">
            <Avatar name={profile?.display_name ?? ""} url={profile?.avatar_url} large />
            <div>
              <div style={{ fontWeight: 500 }}>{profile?.display_name}</div>
              <div className="muted">{agent?.agency_name}</div>
            </div>
          </div>
          {agent && (
            <Link to={`/agents/${agent.id}`} className="btn btn--quiet btn--sm">
              View public page
            </Link>
          )}
        </div>

        {msg && <Alert kind="success">{msg}</Alert>}
        {err && <Alert kind="error">{err}</Alert>}

        <form className="form" onSubmit={submit} noValidate style={{ marginTop: 14 }}>
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
          <Field label="Bio" error={errors.bio} hint="A short introduction shown on your agent page.">
            {(p) => (
              <textarea
                {...p}
                className="textarea"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            )}
          </Field>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- settings ---- */

export function AgentSettings() {
  const { profile, agent, signOut, refresh } = useAuth();
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [agency, setAgency] = useState(agent?.agency_name ?? "");

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

  const saveAgency = async () => {
    if (!agent) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await updateAgent(agent.id, { agency_name: agency });
      await refresh();
      setMsg("Agency details updated.");
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p>Account, agency and security.</p>
      </div>

      <div className="stack" style={{ maxWidth: 620 }}>
        {msg && <Alert kind="success">{msg}</Alert>}
        {err && <Alert kind="error">{err}</Alert>}

        <div className="card card--pad">
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Account</h2>
          <p className="muted">{profile?.email}</p>
          <div style={{ marginTop: 10 }}>
            {agent && <VerificationBadge status={agent.verification_status} />}
          </div>
        </div>

        <div className="card card--pad">
          <h2 style={{ fontSize: 18, marginBottom: 14 }}>Agency</h2>
          <Field label="Agency name">
            {(p) => (
              <input {...p} className="input" value={agency} onChange={(e) => setAgency(e.target.value)} />
            )}
          </Field>
          <button className="btn btn--ghost" style={{ marginTop: 12 }} disabled={busy} onClick={saveAgency}>
            Save agency
          </button>
        </div>

        <div className="card card--pad">
          <h2 style={{ fontSize: 18, marginBottom: 14 }}>Change password</h2>
          <form className="form" onSubmit={changePassword}>
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
          <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

export { STATUS_LABELS };
