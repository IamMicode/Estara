import { Link } from "react-router-dom";
import type { PropertyWithRelations } from "../../lib/database.types";
import { formatPriceWithPeriod, locationLine } from "../../lib/format";
import { Icon, StatusBadge } from "./ui";

export function primaryImage(p: { property_images?: { public_url: string; is_primary: boolean; sort_order: number }[] }) {
  const imgs = p.property_images ?? [];
  if (!imgs.length) return null;
  const primary = imgs.find((i) => i.is_primary);
  return (primary ?? [...imgs].sort((a, b) => a.sort_order - b.sort_order)[0]).public_url;
}

export function PropertyCard({
  property,
  favorited,
  onToggleFavorite,
  showStatus,
}: {
  property: PropertyWithRelations;
  favorited?: boolean;
  onToggleFavorite?: (id: string) => void;
  showStatus?: boolean;
}) {
  const img = primaryImage(property);
  const beds = property.bedrooms;
  const baths = property.bathrooms;

  return (
    <article className="pcard">
      <Link to={`/properties/${property.id}`} className="pcard__media" aria-label={property.title}>
        {img ? (
          <img
            src={img}
            alt={`${property.title}, ${locationLine(property)}`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            style={{
              display: "grid",
              placeItems: "center",
              height: "100%",
              color: "var(--ink-400)",
              fontSize: 13,
            }}
          >
            No image yet
          </span>
        )}
        <span className="pcard__tags">
          <span className="pcard__tag">
            {property.listing_type === "sale" ? "For Sale" : property.listing_type === "rent" ? "For Rent" : "For Lease"}
          </span>
          {showStatus && <span className="pcard__tag">{property.status.replace("_", " ")}</span>}
        </span>
      </Link>

      {onToggleFavorite && (
        <button
          type="button"
          className={`pcard__fav ${favorited ? "is-on" : ""}`}
          onClick={() => onToggleFavorite(property.id)}
          aria-pressed={Boolean(favorited)}
          aria-label={favorited ? `Remove ${property.title} from saved` : `Save ${property.title}`}
        >
          {Icon.heart(Boolean(favorited))}
        </button>
      )}

      <div className="pcard__body">
        <span className="pcard__price">
          {formatPriceWithPeriod(property.price, property.currency, property.listing_type)}
        </span>
        <Link to={`/properties/${property.id}`} className="pcard__title">
          {property.title}
        </Link>
        <span className="pcard__loc">{locationLine(property)}</span>
        {showStatus && (
          <span style={{ marginTop: 4 }}>
            <StatusBadge status={property.status} />
          </span>
        )}
        <div className="pcard__facts">
          {beds != null && <span>{beds} bed</span>}
          {baths != null && <span>{baths} bath</span>}
          {property.floor_area != null && <span>{property.floor_area} m²</span>}
          {beds == null && baths == null && property.floor_area == null && property.land_area != null && (
            <span>{property.land_area} m² land</span>
          )}
        </div>
      </div>
    </article>
  );
}
