import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  PAGE_SIZE,
  addFavorite,
  listFavoriteIds,
  removeFavorite,
  searchProperties,
  type ExploreFilters,
} from "../../lib/api";
import { friendlyError, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import {
  CITIES,
  LOCATIONS,
  LISTING_TYPES,
  PROPERTY_TYPES,
  type PropertyWithRelations,
} from "../../lib/database.types";
import { PropertyCard } from "../components/PropertyCard";
import { Alert, EmptyState, ErrorState, Pager, SkeletonCards } from "../components/ui";
import { LoginPrompt } from "../components/LoginPrompt";

/**
 * The public marketplace.
 *
 * All filter state lives in the URL query string, so any search is shareable
 * and the back button behaves. Queries are executed server-side with
 * pagination — we never pull the whole table into the browser.
 */

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
] as const;

function num(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();

  const [items, setItems] = useState<PropertyWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [promptLogin, setPromptLogin] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filters = useMemo<ExploreFilters>(
    () => ({
      q: params.get("q") ?? undefined,
      city: params.get("city") ?? undefined,
      state_region: params.get("region") ?? undefined,
      country: params.get("country") ?? undefined,
      property_type: params.get("type") ?? undefined,
      listing_type: params.get("listing") ?? undefined,
      min_price: num(params.get("min")),
      max_price: num(params.get("max")),
      bedrooms: num(params.get("beds")),
      bathrooms: num(params.get("baths")),
      min_area: num(params.get("area")),
      furnished: params.get("furnished") === "1" || undefined,
      sort: (params.get("sort") as ExploreFilters["sort"]) ?? "newest",
      page: num(params.get("page")) ?? 1,
    }),
    [params]
  );

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(params);
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, value);
      if (key !== "page") next.delete("page");
      setParams(next, { replace: false });
    },
    [params, setParams]
  );

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await searchProperties(filters);
      setItems(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!profile || profile.role !== "customer") return;
    listFavoriteIds(profile.id).then(setFavIds).catch(() => undefined);
  }, [profile]);

  const toggleFavorite = async (id: string) => {
    if (!profile) return setPromptLogin(true);
    if (profile.role !== "customer") return;
    const next = new Set(favIds);
    try {
      if (next.has(id)) {
        next.delete(id);
        setFavIds(next);
        await removeFavorite(profile.id, id);
      } else {
        next.add(id);
        setFavIds(next);
        await addFavorite(profile.id, id);
      }
    } catch (e) {
      setFavIds(await listFavoriteIds(profile.id));
      setError(friendlyError(e));
    }
  };

  const regions = filters.country ? LOCATIONS[filters.country] ?? [] : Object.values(LOCATIONS).flat();
  const cities = filters.state_region ? CITIES[filters.state_region] ?? [] : [];
  const activeCount = ["type", "listing", "min", "max", "beds", "baths", "area", "furnished", "city", "region"]
    .filter((k) => params.get(k))
    .length;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Find a place worth calling home.</h1>
        <p>
          Browse verified listings across Nigeria and beyond — filter by location, price and the
          details that matter to you.
        </p>
      </div>

      <form
        className="searchbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget as HTMLFormElement);
          setParam("q", String(fd.get("q") ?? ""));
        }}
      >
        <input
          className="input"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search by city, area, neighborhood…"
          aria-label="Search properties"
        />
        <button className="btn btn--primary" type="submit">
          Search
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setShowFilters((s) => !s)}
          aria-expanded={showFilters}
        >
          Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
      </form>

      <div className="toolbar">
        <button
          className={`chip ${!filters.listing_type ? "is-active" : ""}`}
          onClick={() => setParam("listing", undefined)}
        >
          All
        </button>
        {LISTING_TYPES.map((l) => (
          <button
            key={l.value}
            className={`chip ${filters.listing_type === l.value ? "is-active" : ""}`}
            onClick={() => setParam("listing", l.value)}
          >
            {l.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <label className="row" style={{ gap: 8 }}>
          <span className="muted">Sort</span>
          <select
            className="select"
            style={{ width: "auto" }}
            value={filters.sort}
            onChange={(e) => setParam("sort", e.target.value)}
            aria-label="Sort results"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showFilters && (
        <div className="card card--pad" style={{ marginBottom: 22 }}>
          <div className="filters">
            <div className="filters__row">
              <label className="field-group">
                <span className="label">Country</span>
                <select
                  className="select"
                  value={filters.country ?? ""}
                  onChange={(e) => setParam("country", e.target.value)}
                >
                  <option value="">Any country</option>
                  {Object.keys(LOCATIONS).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="label">State / Region</span>
                <select
                  className="select"
                  value={filters.state_region ?? ""}
                  onChange={(e) => setParam("region", e.target.value)}
                >
                  <option value="">Any region</option>
                  {regions.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="label">City / Area</span>
                <select
                  className="select"
                  value={filters.city ?? ""}
                  onChange={(e) => setParam("city", e.target.value)}
                  disabled={!cities.length}
                >
                  <option value="">{cities.length ? "Any city" : "Choose a region first"}</option>
                  {cities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="label">Property type</span>
                <select
                  className="select"
                  value={filters.property_type ?? ""}
                  onChange={(e) => setParam("type", e.target.value)}
                >
                  <option value="">Any type</option>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="filters__row">
              <label className="field-group">
                <span className="label">Min price</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  defaultValue={filters.min_price ?? ""}
                  onBlur={(e) => setParam("min", e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="field-group">
                <span className="label">Max price</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  defaultValue={filters.max_price ?? ""}
                  onBlur={(e) => setParam("max", e.target.value)}
                  placeholder="Any"
                />
              </label>
              <label className="field-group">
                <span className="label">Bedrooms</span>
                <select
                  className="select"
                  value={filters.bedrooms ?? ""}
                  onChange={(e) => setParam("beds", e.target.value)}
                >
                  <option value="">Any</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="label">Bathrooms</span>
                <select
                  className="select"
                  value={filters.bathrooms ?? ""}
                  onChange={(e) => setParam("baths", e.target.value)}
                >
                  <option value="">Any</option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="label">Min area (m²)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  defaultValue={filters.min_area ?? ""}
                  onBlur={(e) => setParam("area", e.target.value)}
                  placeholder="Any"
                />
              </label>
            </div>

            <div className="row row--between row--wrap">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(filters.furnished)}
                  onChange={(e) => setParam("furnished", e.target.checked ? "1" : undefined)}
                />
                Furnished only
              </label>
              <button className="btn btn--quiet" onClick={() => setParams(new URLSearchParams())}>
                Clear all filters
              </button>
            </div>
          </div>
        </div>
      )}

      {!isSupabaseConfigured ? (
        <Alert kind="warn">
          Listings load from the database. Connect Supabase to browse real properties.
        </Alert>
      ) : loading ? (
        <SkeletonCards count={PAGE_SIZE} />
      ) : error ? (
        <ErrorState body={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No listings found"
          body="Try widening your search — remove a filter or search a different area."
          action={
            <button className="btn btn--ghost" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 14 }} aria-live="polite">
            {total} {total === 1 ? "property" : "properties"} found
          </p>
          <div className="property-grid">
            {items.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                favorited={favIds.has(p.id)}
                onToggleFavorite={profile?.role === "agent" ? undefined : toggleFavorite}
              />
            ))}
          </div>
          <Pager page={filters.page ?? 1} pages={pages} onPage={(p) => setParam("page", String(p))} />
        </>
      )}

      {promptLogin && <LoginPrompt onClose={() => setPromptLogin(false)} />}
    </div>
  );
}
