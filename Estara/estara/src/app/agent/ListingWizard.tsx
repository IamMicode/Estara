import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import {
  createProperty,
  deletePropertyImage,
  getProperty,
  setPrimaryImage,
  setPropertyStatus,
  updateProperty,
  uploadPropertyImage,
} from "../../lib/api";
import { friendlyError } from "../../lib/supabase";
import {
  CITIES,
  CURRENCIES,
  LISTING_TYPES,
  LOCATIONS,
  PROPERTY_TYPES,
  type ListingType,
  type PropertyImage,
  type PropertyType,
  type PropertyWithRelations,
} from "../../lib/database.types";
import { formatPriceWithPeriod } from "../../lib/format";
import {
  MAX_IMAGES_PER_PROPERTY,
  propertyBasicsSchema,
  propertyDescriptionSchema,
  propertyDetailsSchema,
  propertyLocationSchema,
  validate,
  validateImageFile,
} from "../../lib/validation";
import { Alert, Field, LoadingBlock, Spinner, StatusBadge } from "../components/ui";

/**
 * Six-step create/edit listing wizard.
 *
 * The draft is a real row in `properties` from step 1 onward — that's what makes
 * image upload (which needs a property id for the storage path) and "save and
 * finish later" work without any client-side faking.
 */

const STEPS = [
  "Basics",
  "Location",
  "Details",
  "Description",
  "Photos",
  "Review",
] as const;

const FEATURE_OPTIONS = [
  "Air conditioning",
  "Borehole / water supply",
  "Backup generator",
  "Solar power",
  "Swimming pool",
  "Gym",
  "24/7 security",
  "Gated estate",
  "CCTV",
  "Fitted kitchen",
  "Balcony",
  "Garden",
  "Elevator",
  "Boys' quarters",
  "Parking space",
  "Sea view",
  "Mountain view",
  "Pet friendly",
];

interface Draft {
  title: string;
  property_type: PropertyType;
  listing_type: ListingType;
  price: number | null;
  currency: string;
  country: string;
  state_region: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  toilets: number | null;
  floor_area: number | null;
  land_area: number | null;
  year_built: number | null;
  parking_spaces: number;
  furnished: boolean;
  description: string;
  features: string[];
}

const EMPTY: Draft = {
  title: "",
  property_type: "apartment",
  listing_type: "sale",
  price: null,
  currency: "NGN",
  country: "Nigeria",
  state_region: "",
  city: "",
  address: "",
  latitude: null,
  longitude: null,
  bedrooms: null,
  bathrooms: null,
  toilets: null,
  floor_area: null,
  land_area: null,
  year_built: null,
  parking_spaces: 0,
  furnished: false,
  description: "",
  features: [],
};

const numOrNull = (v: string) => (v === "" ? null : Number(v));

export function ListingWizard() {
  const { id } = useParams();
  const nav = useNavigate();
  const { agent } = useAuth();

  const [propertyId, setPropertyId] = useState<string | null>(id ?? null);
  const [existing, setExisting] = useState<PropertyWithRelations | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /* --------------------------------------------------------- load edit --- */
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await getProperty(id);
        if (!p) throw new Error("Listing not found.");
        setExisting(p);
        setImages([...(p.property_images ?? [])].sort((a, b) => a.sort_order - b.sort_order));
        setDraft({
          title: p.title,
          property_type: p.property_type,
          listing_type: p.listing_type,
          price: p.price,
          currency: p.currency,
          country: p.country,
          state_region: p.state_region,
          city: p.city,
          address: p.address ?? "",
          latitude: p.latitude,
          longitude: p.longitude,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          toilets: p.toilets,
          floor_area: p.floor_area,
          land_area: p.land_area,
          year_built: p.year_built,
          parking_spaces: p.parking_spaces,
          furnished: p.furnished,
          description: p.description,
          features: p.features ?? [],
        });
      } catch (e) {
        setErr(friendlyError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /* ------------------------------------------------------------- save --- */

  const persist = useCallback(
    async (patch: Partial<Draft>) => {
      if (!agent) throw new Error("No agent profile.");
      const payload = {
        title: patch.title ?? draft.title,
        description: patch.description ?? draft.description,
        property_type: patch.property_type ?? draft.property_type,
        listing_type: patch.listing_type ?? draft.listing_type,
        price: patch.price ?? draft.price ?? 0,
        currency: patch.currency ?? draft.currency,
        country: patch.country ?? draft.country,
        state_region: patch.state_region ?? draft.state_region,
        city: patch.city ?? draft.city,
        address: (patch.address ?? draft.address) || null,
        latitude: patch.latitude ?? draft.latitude,
        longitude: patch.longitude ?? draft.longitude,
        bedrooms: patch.bedrooms ?? draft.bedrooms,
        bathrooms: patch.bathrooms ?? draft.bathrooms,
        toilets: patch.toilets ?? draft.toilets,
        floor_area: patch.floor_area ?? draft.floor_area,
        land_area: patch.land_area ?? draft.land_area,
        year_built: patch.year_built ?? draft.year_built,
        parking_spaces: patch.parking_spaces ?? draft.parking_spaces,
        furnished: patch.furnished ?? draft.furnished,
        features: patch.features ?? draft.features,
      };

      if (propertyId) {
        await updateProperty(propertyId, payload);
        return propertyId;
      }
      const created = await createProperty({ ...payload, agent_id: agent.id, status: "draft" });
      setPropertyId(created.id);
      // keep the URL honest so a refresh resumes the same draft
      window.history.replaceState(null, "", `/agent/listings/${created.id}/edit`);
      return created.id;
    },
    [agent, draft, propertyId]
  );

  const validateStep = (s: number): boolean => {
    if (s === 0) {
      const v = validate(propertyBasicsSchema, {
        title: draft.title,
        property_type: draft.property_type,
        listing_type: draft.listing_type,
        price: draft.price ?? Number.NaN,
        currency: draft.currency,
      });
      if (!v.ok) {
        setErrors(v.errors);
        return false;
      }
    }
    if (s === 1) {
      const v = validate(propertyLocationSchema, {
        country: draft.country,
        state_region: draft.state_region,
        city: draft.city,
        address: draft.address,
        latitude: draft.latitude,
        longitude: draft.longitude,
      });
      if (!v.ok) {
        setErrors(v.errors);
        return false;
      }
    }
    if (s === 2) {
      const v = validate(propertyDetailsSchema, {
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        toilets: draft.toilets,
        floor_area: draft.floor_area,
        land_area: draft.land_area,
        year_built: draft.year_built,
        parking_spaces: draft.parking_spaces,
        furnished: draft.furnished,
      });
      if (!v.ok) {
        setErrors(v.errors);
        return false;
      }
    }
    if (s === 3) {
      const v = validate(propertyDescriptionSchema, {
        description: draft.description,
        features: draft.features,
      });
      if (!v.ok) {
        setErrors(v.errors);
        return false;
      }
    }
    setErrors({});
    return true;
  };

  const next = async () => {
    if (!validateStep(step)) return;
    setBusy(true);
    setErr("");
    try {
      await persist({});
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!validateStep(0)) {
      setStep(0);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await persist({});
      setNotice("Draft saved. You can finish this listing any time.");
      setTimeout(() => setNotice(""), 4000);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitForReview = async () => {
    for (let s = 0; s <= 3; s++) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    if (images.length === 0) {
      setStep(4);
      setErr("Add at least one photo before submitting for review.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const pid = await persist({});
      await setPropertyStatus(pid, "pending_review");
      nav("/agent/listings", { replace: true });
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------ images --- */

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let pid = propertyId;
    if (!pid) {
      if (!validateStep(0)) {
        setStep(0);
        setErr("Fill in the basics first so we can attach photos to your listing.");
        return;
      }
      pid = await persist({});
    }
    const room = MAX_IMAGES_PER_PROPERTY - images.length;
    if (room <= 0) {
      setErr(`You can upload up to ${MAX_IMAGES_PER_PROPERTY} photos.`);
      return;
    }
    setUploading(true);
    setErr("");
    const chosen = Array.from(files).slice(0, room);
    for (const [i, file] of chosen.entries()) {
      const problem = validateImageFile(file);
      if (problem) {
        setErr(problem);
        continue;
      }
      try {
        const img = await uploadPropertyImage(pid, file, images.length + i);
        setImages((prev) => [...prev, img]);
      } catch (e) {
        setErr(friendlyError(e));
      }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeImage = async (img: PropertyImage) => {
    setImages((prev) => prev.filter((i) => i.id !== img.id));
    try {
      await deletePropertyImage(img);
    } catch (e) {
      setErr(friendlyError(e));
    }
  };

  const makePrimary = async (img: PropertyImage) => {
    if (!propertyId) return;
    setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === img.id })));
    try {
      await setPrimaryImage(propertyId, img.id);
    } catch (e) {
      setErr(friendlyError(e));
    }
  };

  /* -------------------------------------------------------------- render - */

  if (loading) return <LoadingBlock label="Loading listing…" />;

  if (agent && agent.verification_status !== "verified") {
    return (
      <Alert kind="warn">
        You need a verified agent account to create listings.{" "}
        <Link to="/agent/verification" className="link-quiet">
          Complete verification →
        </Link>
      </Alert>
    );
  }

  const regions = LOCATIONS[draft.country] ?? [];
  const cities = CITIES[draft.state_region] ?? [];
  const isLand = draft.property_type === "land";
  const readOnly = existing?.status === "pending_review";

  return (
    <>
      <div className="row row--between row--wrap page-head">
        <div>
          <h1>{id ? "Edit listing" : "Create a listing"}</h1>
          <p>
            {existing ? (
              <>
                Status: <StatusBadge status={existing.status} />
              </>
            ) : (
              "Six short steps. Your progress saves as a draft as you go."
            )}
          </p>
        </div>
        <Link to="/agent/listings" className="btn btn--quiet">
          Back to listings
        </Link>
      </div>

      {readOnly && (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="info">
            This listing is awaiting admin review. Withdraw it to a draft from your listings page if
            you need to make changes.
          </Alert>
        </div>
      )}

      {existing?.status === "rejected" && existing.rejection_reason && (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="error">
            <strong>Rejected:</strong> {existing.rejection_reason} — make the changes and resubmit.
          </Alert>
        </div>
      )}

      <ol className="steps" aria-label="Listing progress">
        {STEPS.map((s, i) => (
          <li key={s} className={`step ${i === step ? "is-current" : ""} ${i < step ? "is-done" : ""}`}>
            <button
              type="button"
              onClick={() => i <= step && setStep(i)}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="step__num">{i < step ? "✓" : i + 1}</span>
              <span className="step__label">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      {err && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{err}</Alert>
        </div>
      )}
      {notice && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="success">{notice}</Alert>
        </div>
      )}

      <div className="card card--pad" style={{ maxWidth: 820 }}>
        {/* ------------------------------------------------- 1. basics --- */}
        {step === 0 && (
          <div className="form">
            <h2 style={{ fontSize: 19 }}>The basics</h2>
            <Field
              label="Listing title"
              error={errors.title}
              hint="Describe the property the way a buyer would search for it."
            >
              {(p) => (
                <input
                  {...p}
                  className="input"
                  placeholder="e.g. 4-Bedroom Waterfront Duplex in Banana Island"
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              )}
            </Field>

            <div className="form-row">
              <Field label="Property type" error={errors.property_type}>
                {(p) => (
                  <select
                    {...p}
                    className="select"
                    value={draft.property_type}
                    onChange={(e) => set("property_type", e.target.value as PropertyType)}
                  >
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Listing type" error={errors.listing_type}>
                {(p) => (
                  <select
                    {...p}
                    className="select"
                    value={draft.listing_type}
                    onChange={(e) => set("listing_type", e.target.value as ListingType)}
                  >
                    {LISTING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>

            <div className="form-row">
              <Field label="Price" error={errors.price}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="number"
                    min={0}
                    value={draft.price ?? ""}
                    onChange={(e) => set("price", numOrNull(e.target.value))}
                  />
                )}
              </Field>
              <Field label="Currency" error={errors.currency}>
                {(p) => (
                  <select
                    {...p}
                    className="select"
                    value={draft.currency}
                    onChange={(e) => set("currency", e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.symbol} {c.code} — {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>

            {draft.price ? (
              <p className="muted">
                Displays as{" "}
                <strong>
                  {formatPriceWithPeriod(draft.price, draft.currency, draft.listing_type)}
                </strong>
              </p>
            ) : null}
          </div>
        )}

        {/* ----------------------------------------------- 2. location --- */}
        {step === 1 && (
          <div className="form">
            <h2 style={{ fontSize: 19 }}>Where is it?</h2>
            <div className="form-row">
              <Field label="Country" error={errors.country}>
                {(p) => (
                  <select
                    {...p}
                    className="select"
                    value={draft.country}
                    onChange={(e) => {
                      set("country", e.target.value);
                      set("state_region", "");
                      set("city", "");
                    }}
                  >
                    {Object.keys(LOCATIONS).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="State / Region" error={errors.state_region}>
                {(p) => (
                  <select
                    {...p}
                    className="select"
                    value={draft.state_region}
                    onChange={(e) => {
                      set("state_region", e.target.value);
                      set("city", "");
                    }}
                  >
                    <option value="">Choose…</option>
                    {regions.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>

            <Field label="City / Area" error={errors.city}>
              {(p) =>
                cities.length ? (
                  <select
                    {...p}
                    className="select"
                    value={draft.city}
                    onChange={(e) => set("city", e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {cities.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                    <option value="__other">Other (type below)</option>
                  </select>
                ) : (
                  <input
                    {...p}
                    className="input"
                    value={draft.city}
                    onChange={(e) => set("city", e.target.value)}
                    placeholder="e.g. Lekki Phase 1"
                  />
                )
              }
            </Field>
            {draft.city === "__other" && (
              <Field label="City name">
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    onChange={(e) => set("city", e.target.value)}
                    placeholder="Type the city or area"
                  />
                )}
              </Field>
            )}

            <Field
              label="Street address"
              error={errors.address}
              hint="Optional. Shown on the listing page — leave out unit numbers if you prefer."
            >
              {(p) => (
                <input
                  {...p}
                  className="input"
                  value={draft.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              )}
            </Field>

            <div className="form-row">
              <Field label="Latitude" error={errors.latitude} hint="Optional map pin.">
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="number"
                    step="any"
                    value={draft.latitude ?? ""}
                    onChange={(e) => set("latitude", numOrNull(e.target.value))}
                  />
                )}
              </Field>
              <Field label="Longitude" error={errors.longitude}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="number"
                    step="any"
                    value={draft.longitude ?? ""}
                    onChange={(e) => set("longitude", numOrNull(e.target.value))}
                  />
                )}
              </Field>
            </div>
          </div>
        )}

        {/* ------------------------------------------------ 3. details --- */}
        {step === 2 && (
          <div className="form">
            <h2 style={{ fontSize: 19 }}>Property details</h2>
            {isLand ? (
              <p className="muted">
                For land listings, room counts don't apply — just tell us the plot size.
              </p>
            ) : (
              <div className="form-row">
                <Field label="Bedrooms" error={errors.bedrooms}>
                  {(p) => (
                    <input
                      {...p}
                      className="input"
                      type="number"
                      min={0}
                      value={draft.bedrooms ?? ""}
                      onChange={(e) => set("bedrooms", numOrNull(e.target.value))}
                    />
                  )}
                </Field>
                <Field label="Bathrooms" error={errors.bathrooms}>
                  {(p) => (
                    <input
                      {...p}
                      className="input"
                      type="number"
                      min={0}
                      value={draft.bathrooms ?? ""}
                      onChange={(e) => set("bathrooms", numOrNull(e.target.value))}
                    />
                  )}
                </Field>
                <Field label="Toilets" error={errors.toilets}>
                  {(p) => (
                    <input
                      {...p}
                      className="input"
                      type="number"
                      min={0}
                      value={draft.toilets ?? ""}
                      onChange={(e) => set("toilets", numOrNull(e.target.value))}
                    />
                  )}
                </Field>
              </div>
            )}

            <div className="form-row">
              {!isLand && (
                <Field label="Floor area (m²)" error={errors.floor_area}>
                  {(p) => (
                    <input
                      {...p}
                      className="input"
                      type="number"
                      min={0}
                      value={draft.floor_area ?? ""}
                      onChange={(e) => set("floor_area", numOrNull(e.target.value))}
                    />
                  )}
                </Field>
              )}
              <Field label="Land area (m²)" error={errors.land_area}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="number"
                    min={0}
                    value={draft.land_area ?? ""}
                    onChange={(e) => set("land_area", numOrNull(e.target.value))}
                  />
                )}
              </Field>
              {!isLand && (
                <Field label="Year built" error={errors.year_built}>
                  {(p) => (
                    <input
                      {...p}
                      className="input"
                      type="number"
                      value={draft.year_built ?? ""}
                      onChange={(e) => set("year_built", numOrNull(e.target.value))}
                    />
                  )}
                </Field>
              )}
            </div>

            <div className="form-row">
              <Field label="Parking spaces" error={errors.parking_spaces}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="number"
                    min={0}
                    value={draft.parking_spaces}
                    onChange={(e) => set("parking_spaces", Number(e.target.value || 0))}
                  />
                )}
              </Field>
              {!isLand && (
                <div className="field-group">
                  <span className="label">Furnishing</span>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={draft.furnished}
                      onChange={(e) => set("furnished", e.target.checked)}
                    />
                    This property is furnished
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------- 4. description --- */}
        {step === 3 && (
          <div className="form">
            <h2 style={{ fontSize: 19 }}>Tell its story</h2>
            <Field
              label="Description"
              error={errors.description}
              hint={`${draft.description.trim().length} characters — aim for at least 40.`}
            >
              {(p) => (
                <textarea
                  {...p}
                  className="textarea"
                  style={{ minHeight: 200 }}
                  placeholder="Describe the space, the light, the neighbourhood, what makes it worth seeing in person."
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              )}
            </Field>

            <div className="field-group">
              <span className="label">Features</span>
              <div className="row row--wrap" style={{ gap: 8 }}>
                {FEATURE_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`chip ${draft.features.includes(f) ? "is-active" : ""}`}
                    aria-pressed={draft.features.includes(f)}
                    onClick={() =>
                      set(
                        "features",
                        draft.features.includes(f)
                          ? draft.features.filter((x) => x !== f)
                          : [...draft.features, f]
                      )
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------- 5. photos --- */}
        {step === 4 && (
          <div className="form">
            <h2 style={{ fontSize: 19 }}>Photos</h2>
            <p className="muted">
              Up to {MAX_IMAGES_PER_PROPERTY} images, 5 MB each (JPEG, PNG, WebP or AVIF). The first
              photo is the cover — you can change it below.
            </p>

            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => void handleFiles(e.target.files)}
                id="photo-input"
                style={{ display: "none" }}
              />
              <label htmlFor="photo-input" className="btn btn--ghost" style={{ cursor: "pointer" }}>
                {uploading ? "Uploading…" : "Choose photos"}
              </label>
              <p className="muted" style={{ marginTop: 10 }}>
                or drag and drop them here
              </p>
            </div>

            {uploading && <LoadingBlock label="Uploading photos…" />}

            {images.length > 0 && (
              <div className="img-grid">
                {images.map((img) => (
                  <figure key={img.id} className={`img-tile ${img.is_primary ? "is-primary" : ""}`}>
                    <img src={img.public_url} alt={img.alt_text ?? ""} />
                    <figcaption>
                      {img.is_primary ? (
                        <span className="badge badge--published">Cover</span>
                      ) : (
                        <button type="button" className="btn btn--quiet btn--sm" onClick={() => makePrimary(img)}>
                          Make cover
                        </button>
                      )}
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => removeImage(img)}>
                        Remove
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {images.length === 0 && !uploading && (
              <Alert kind="info">
                A listing needs at least one photo before it can be submitted for review.
              </Alert>
            )}
          </div>
        )}

        {/* ------------------------------------------------- 6. review --- */}
        {step === 5 && (
          <div className="form">
            <h2 style={{ fontSize: 19 }}>Review and submit</h2>
            <p className="muted">
              An Estara admin reviews every listing before it goes live. You can't approve your own
              listing — that's what keeps the marketplace trustworthy.
            </p>

            <div className="review-grid">
              <div>
                <span className="label">Title</span>
                <p>{draft.title || "—"}</p>
              </div>
              <div>
                <span className="label">Price</span>
                <p>
                  {draft.price
                    ? formatPriceWithPeriod(draft.price, draft.currency, draft.listing_type)
                    : "—"}
                </p>
              </div>
              <div>
                <span className="label">Type</span>
                <p>
                  {PROPERTY_TYPES.find((t) => t.value === draft.property_type)?.label} ·{" "}
                  {LISTING_TYPES.find((t) => t.value === draft.listing_type)?.label}
                </p>
              </div>
              <div>
                <span className="label">Location</span>
                <p>
                  {[draft.address, draft.city, draft.state_region, draft.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>
              <div>
                <span className="label">Rooms</span>
                <p>
                  {isLand
                    ? "N/A (land)"
                    : `${draft.bedrooms ?? 0} bed · ${draft.bathrooms ?? 0} bath · ${draft.toilets ?? 0} toilet`}
                </p>
              </div>
              <div>
                <span className="label">Area</span>
                <p>
                  {draft.floor_area ? `${draft.floor_area} m² floor` : ""}
                  {draft.floor_area && draft.land_area ? " · " : ""}
                  {draft.land_area ? `${draft.land_area} m² land` : ""}
                  {!draft.floor_area && !draft.land_area ? "—" : ""}
                </p>
              </div>
              <div>
                <span className="label">Photos</span>
                <p>{images.length}</p>
              </div>
              <div>
                <span className="label">Features</span>
                <p>{draft.features.length ? draft.features.join(", ") : "—"}</p>
              </div>
            </div>

            <div>
              <span className="label">Description</span>
              <p className="prose">{draft.description || "—"}</p>
            </div>
          </div>
        )}

        {/* --------------------------------------------------- actions --- */}
        <div className="wizard-actions">
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
          >
            Back
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn--ghost" onClick={saveDraft} disabled={busy || readOnly}>
            Save draft
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn--primary" onClick={next} disabled={busy || readOnly}>
              {busy ? <Spinner /> : null}
              {busy ? "Saving…" : "Continue"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={submitForReview}
              disabled={busy || readOnly}
            >
              {busy ? <Spinner /> : null}
              {busy ? "Submitting…" : "Submit for review"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
