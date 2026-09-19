import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addFavorite,
  createInquiry,
  createReport,
  getProperty,
  getSimilarProperties,
  listFavoriteIds,
  recordPropertyView,
  removeFavorite,
} from "../../lib/api";
import { friendlyError, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import type { PropertyWithRelations } from "../../lib/database.types";
import { PROPERTY_TYPES, STATUS_LABELS } from "../../lib/database.types";
import { formatArea, formatDate, formatPriceWithPeriod, locationLine } from "../../lib/format";
import { inquirySchema, reportSchema, validate } from "../../lib/validation";
import { Alert, Avatar, BackLink, EmptyState, ErrorState, Field, Icon, LoadingBlock, Modal, Spinner, VerificationBadge } from "../components/ui";
import { PropertyCard, primaryImage } from "../components/PropertyCard";
import { LoginPrompt } from "../components/LoginPrompt";

/* -------------------------------------------------------------- gallery ---- */

function Gallery({ images, title }: { images: { public_url: string; alt_text: string | null }[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const move = useCallback(
    (d: number) => setIdx((i) => (i + d + images.length) % images.length),
    [images.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, move]);

  // touch swipe
  const [touchX, setTouchX] = useState<number | null>(null);

  if (!images.length) {
    return (
      <div className="card" style={{ display: "grid", placeItems: "center", aspectRatio: "16/9", color: "var(--ink-400)" }}>
        No images for this listing yet
      </div>
    );
  }

  const openAt = (i: number) => {
    setIdx(i);
    setOpen(true);
  };

  return (
    <>
      <div className="gallery">
        <button className="gallery__main" onClick={() => openAt(0)} aria-label="Open image gallery">
          <img src={images[0].public_url} alt={images[0].alt_text ?? `${title} — main photo`} />
        </button>
        {images.length > 1 && (
          <div className="gallery__side">
            <button className="gallery__thumb" onClick={() => openAt(1)} aria-label="Open image 2">
              <img src={images[1].public_url} alt={images[1].alt_text ?? `${title} — photo 2`} />
            </button>
            {images[2] && (
              <button className="gallery__thumb" onClick={() => openAt(2)} aria-label="Open image 3">
                <img src={images[2].public_url} alt={images[2].alt_text ?? `${title} — photo 3`} />
                {images.length > 3 && <span className="gallery__more">+{images.length - 3} more</span>}
              </button>
            )}
          </div>
        )}
      </div>

      {open && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photo ${idx + 1} of ${images.length}`}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX == null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 45) move(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          <div className="lightbox__bar">
            <span>
              {idx + 1} / {images.length}
            </span>
            <button className="icon-btn-light" onClick={() => setOpen(false)} aria-label="Close gallery">
              {Icon.close}
            </button>
          </div>
          <div className="lightbox__stage">
            <img src={images[idx].public_url} alt={images[idx].alt_text ?? `${title} — photo ${idx + 1}`} />
          </div>
          <div className="lightbox__nav">
            <button className="icon-btn-light" onClick={() => move(-1)} aria-label="Previous photo">
              {Icon.chevron("left")}
            </button>
            {images.map((im, i) => (
              <button
                key={i}
                className={i === idx ? "is-active" : ""}
                onClick={() => setIdx(i)}
                aria-label={`Go to photo ${i + 1}`}
              >
                <img src={im.public_url} alt="" />
              </button>
            ))}
            <button className="icon-btn-light" onClick={() => move(1)} aria-label="Next photo">
              {Icon.chevron("right")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------- inquiry form --- */

function InquiryModal({
  property,
  onClose,
}: {
  property: PropertyWithRelations;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    subject: `Inquiry about ${property.title}`,
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(inquirySchema, form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    setErr("");
    try {
      await createInquiry({
        property_id: property.id,
        customer_id: profile!.id,
        agent_id: property.agent_id,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setDone(true);
    } catch (e2) {
      setErr(friendlyError(e2));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal title="Inquiry sent" onClose={onClose}>
        <Alert kind="success">
          Your message is with the agent. You'll see their reply in your inquiries.
        </Alert>
        <div className="modal__actions">
          <Link to="/customer/inquiries" className="btn btn--ghost">
            View my inquiries
          </Link>
          <button className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Contact the agent" onClose={onClose}>
      <p className="muted" style={{ marginBottom: 18 }}>
        Your name and contact details are shared with the agent so they can respond.
      </p>
      {err && (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{err}</Alert>
        </div>
      )}
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Subject" error={errors.subject}>
          {(p) => (
            <input
              {...p}
              className="input"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          )}
        </Field>
        <Field label="Message" error={errors.message}>
          {(p) => (
            <textarea
              {...p}
              className="textarea"
              placeholder="Ask about availability, viewing times, or anything else you need to know."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          )}
        </Field>
        <div className="modal__actions">
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner /> : null}
            {busy ? "Sending…" : "Send inquiry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------- report form --- */

const REPORT_REASONS = [
  "Listing appears fraudulent",
  "Property is no longer available",
  "Incorrect or misleading details",
  "Inappropriate content",
  "Duplicate listing",
  "Other",
];

function ReportModal({ propertyId, onClose }: { propertyId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({ reason: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(reportSchema, form);
    if (!v.ok) return setErrors(v.errors);
    setBusy(true);
    setErr("");
    try {
      await createReport({
        reporter_id: profile!.id,
        property_id: propertyId,
        reason: form.reason,
        description: form.description,
      });
      setDone(true);
    } catch (e2) {
      setErr(friendlyError(e2));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal title="Report submitted" onClose={onClose}>
        <Alert kind="success">Thanks — our moderation team will review this listing.</Alert>
        <div className="modal__actions">
          <button className="btn btn--primary" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Report this listing" onClose={onClose}>
      {err && (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{err}</Alert>
        </div>
      )}
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Reason" error={errors.reason}>
          {(p) => (
            <select
              {...p}
              className="select"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            >
              <option value="">Choose a reason…</option>
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Details" error={errors.description} hint="Optional, but helps us investigate.">
          {(p) => (
            <textarea
              {...p}
              className="textarea"
              style={{ minHeight: 90 }}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          )}
        </Field>
        <div className="modal__actions">
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- page ---- */

export function PropertyDetailPage() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const [property, setProperty] = useState<PropertyWithRelations | null>(null);
  const [similar, setSimilar] = useState<PropertyWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fav, setFav] = useState(false);
  const [showInquiry, setShowInquiry] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const p = await getProperty(id);
      setProperty(p);
      if (p) {
        void recordPropertyView(p.id, profile?.id);
        getSimilarProperties(p).then(setSimilar).catch(() => undefined);
        document.title = `${p.title} — ${locationLine(p)} | Estara`;
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id]);

  useEffect(() => {
    void load();
    return () => {
      document.title = "Estara — Where places become possibilities";
    };
  }, [load]);

  useEffect(() => {
    if (!profile || profile.role !== "customer") return;
    listFavoriteIds(profile.id)
      .then((s) => setFav(s.has(id)))
      .catch(() => undefined);
  }, [profile, id]);

  // SEO / social metadata for public listings
  useEffect(() => {
    if (!property) return;
    const desc = property.description.slice(0, 155);
    const set = (sel: string, attr: string, val: string) => {
      let el = document.head.querySelector(sel) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr.split("=")[0], attr.split("=")[1]);
        document.head.appendChild(el);
      }
      el.content = val;
    };
    set('meta[name="description"]', "name=description", desc);
    set('meta[property="og:title"]', "property=og:title", property.title);
    set('meta[property="og:description"]', "property=og:description", desc);
    const img = primaryImage(property);
    if (img) set('meta[property="og:image"]', "property=og:image", img);

    let canon = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canon) {
      canon = document.createElement("link");
      canon.rel = "canonical";
      document.head.appendChild(canon);
    }
    canon.href = `${window.location.origin}/properties/${property.id}`;
  }, [property]);

  const toggleFav = async () => {
    if (!profile) return setPrompt("save properties");
    if (profile.role !== "customer") return;
    try {
      if (fav) {
        setFav(false);
        await removeFavorite(profile.id, id);
      } else {
        setFav(true);
        await addFavorite(profile.id, id);
      }
    } catch (e) {
      setFav((f) => !f);
      setError(friendlyError(e));
    }
  };

  const onContact = () => {
    if (!profile) return setPrompt("contact an agent");
    if (profile.role !== "customer") return;
    setShowInquiry(true);
  };

  if (!isSupabaseConfigured)
    return (
      <div className="page">
        <Alert kind="warn">
          Property details load from the database. Connect Supabase to view this listing.
        </Alert>
      </div>
    );
  if (loading) return <LoadingBlock label="Loading property…" />;
  if (error) return (
    <div className="page">
      <ErrorState body={error} onRetry={load} />
    </div>
  );
  if (!property)
    return (
      <div className="page">
        <EmptyState
          title="Property not found"
          body="This listing may have been removed, archived, or is not published yet."
          action={
            <Link to="/explore" className="btn btn--primary">
              Back to Explore
            </Link>
          }
        />
      </div>
    );

  const images = [...(property.property_images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
  );
  const agent = property.agents;
  const typeLabel = PROPERTY_TYPES.find((t) => t.value === property.property_type)?.label;

  return (
    <div className="page">
      <BackLink to="/explore">Back to Explore</BackLink>

      {property.status !== "published" && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="warn">
            This listing is <strong>{STATUS_LABELS[property.status]}</strong> and isn't publicly
            visible. You're seeing it because you own it or you're an admin.
          </Alert>
        </div>
      )}

      <Gallery images={images} title={property.title} />

      <div className="detail-grid">
        <div>
          <div className="row row--between row--wrap" style={{ marginBottom: 6 }}>
            <span className="eyebrow">
              {typeLabel} ·{" "}
              {property.listing_type === "sale"
                ? "For Sale"
                : property.listing_type === "rent"
                  ? "For Rent"
                  : "For Lease"}
            </span>
            {property.published_at && (
              <span className="muted">Listed {formatDate(property.published_at)}</span>
            )}
          </div>

          <h1 style={{ fontSize: "clamp(24px,3.2vw,34px)" }}>{property.title}</h1>
          <p className="muted" style={{ marginTop: 8, fontSize: 15 }}>
            {property.address ? `${property.address}, ` : ""}
            {locationLine(property)}
          </p>

          <p style={{ fontSize: "clamp(24px,3vw,32px)", fontWeight: 500, margin: "18px 0 22px" }}>
            {formatPriceWithPeriod(property.price, property.currency, property.listing_type)}
          </p>

          <div className="facts">
            {property.bedrooms != null && (
              <div className="fact">
                <div className="fact__label">Bedrooms</div>
                <div className="fact__value">{property.bedrooms}</div>
              </div>
            )}
            {property.bathrooms != null && (
              <div className="fact">
                <div className="fact__label">Bathrooms</div>
                <div className="fact__value">{property.bathrooms}</div>
              </div>
            )}
            {property.toilets != null && (
              <div className="fact">
                <div className="fact__label">Toilets</div>
                <div className="fact__value">{property.toilets}</div>
              </div>
            )}
            {property.floor_area != null && (
              <div className="fact">
                <div className="fact__label">Floor area</div>
                <div className="fact__value">{formatArea(property.floor_area)}</div>
              </div>
            )}
            {property.land_area != null && (
              <div className="fact">
                <div className="fact__label">Land area</div>
                <div className="fact__value">{formatArea(property.land_area)}</div>
              </div>
            )}
            {property.parking_spaces > 0 && (
              <div className="fact">
                <div className="fact__label">Parking</div>
                <div className="fact__value">{property.parking_spaces}</div>
              </div>
            )}
            {property.year_built && (
              <div className="fact">
                <div className="fact__label">Year built</div>
                <div className="fact__value">{property.year_built}</div>
              </div>
            )}
            <div className="fact">
              <div className="fact__label">Furnished</div>
              <div className="fact__value">{property.furnished ? "Yes" : "No"}</div>
            </div>
          </div>

          <section className="section">
            <h2>About this property</h2>
            <p className="prose">{property.description}</p>
          </section>

          {property.features.length > 0 && (
            <section className="section">
              <h2>Features</h2>
              <ul className="feature-list">
                {property.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="section">
            <h2>Location</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              {locationLine(property)}
              {property.latitude != null &&
                property.longitude != null &&
                ` · ${property.latitude.toFixed(4)}, ${property.longitude.toFixed(4)}`}
            </p>
            {property.latitude != null && property.longitude != null ? (
              <a
                className="btn btn--ghost btn--sm"
                href={`https://www.openstreetmap.org/?mlat=${property.latitude}&mlon=${property.longitude}#map=15/${property.latitude}/${property.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on OpenStreetMap
              </a>
            ) : (
              <p className="muted">The agent hasn't pinned an exact location for this listing.</p>
            )}
          </section>

          <div className="divider" />
          <button className="btn btn--quiet" onClick={() => (profile ? setShowReport(true) : setPrompt("report a listing"))}>
            Report this listing
          </button>
        </div>

        {/* ------------------------------------------------------- aside --- */}
        <aside className="detail-aside">
          <div className="card card--pad">
            <span className="eyebrow">Listed by</span>
            {agent ? (
              <>
                <div className="row" style={{ marginTop: 12, marginBottom: 12 }}>
                  <Avatar name={agent.profiles?.display_name ?? agent.agency_name} url={agent.profiles?.avatar_url} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{agent.profiles?.display_name || "Agent"}</div>
                    <div className="muted">{agent.agency_name}</div>
                  </div>
                </div>
                <VerificationBadge status={agent.verification_status} />
                <div className="stack" style={{ marginTop: 16 }}>
                  <button className="btn btn--primary btn--block" onClick={onContact}>
                    Contact agent
                  </button>
                  <button
                    className={`btn btn--ghost btn--block ${fav ? "is-on" : ""}`}
                    onClick={toggleFav}
                    aria-pressed={fav}
                  >
                    {Icon.heart(fav)} {fav ? "Saved" : "Save property"}
                  </button>
                  <Link to={`/agents/${agent.id}`} className="btn btn--quiet btn--block">
                    View agent profile
                  </Link>
                </div>
              </>
            ) : (
              <p className="muted" style={{ marginTop: 10 }}>
                Agent details unavailable.
              </p>
            )}
          </div>

          <div className="card card--pad">
            <span className="eyebrow">Listing reference</span>
            <p style={{ marginTop: 8, fontSize: 13, fontFamily: "ui-monospace, monospace" }}>
              {property.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="muted" style={{ marginTop: 10 }}>
              {property.view_count} {property.view_count === 1 ? "view" : "views"}
            </p>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="section">
          <h2>Similar properties</h2>
          <div className="property-grid">
            {similar.map((s) => (
              <PropertyCard key={s.id} property={s} />
            ))}
          </div>
        </section>
      )}

      {showInquiry && <InquiryModal property={property} onClose={() => setShowInquiry(false)} />}
      {showReport && <ReportModal propertyId={property.id} onClose={() => setShowReport(false)} />}
      {prompt && <LoginPrompt action={prompt} onClose={() => setPrompt(null)} />}
    </div>
  );
}
