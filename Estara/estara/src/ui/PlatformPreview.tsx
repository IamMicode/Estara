import { useState } from "react";
import { EmergentItem } from "./EmergentLayer";

export interface Listing {
  id: string;
  title: string;
  location: string;
  type: string;
  price: string;
  status: "Available" | "New listing" | "By appointment";
  agent: string;
  meta: string;
  image: string;
}

export const LISTINGS: Listing[] = [
  {
    id: "atlantic-villa",
    title: "Tribeca Loft Residence",
    location: "Tribeca, Manhattan",
    type: "Loft",
    price: "$4,250,000",
    status: "Available",
    agent: "Nadia Okonkwo",
    meta: "4 bed · 4 bath · 410 m²",
    image: "properties/atlantic-villa.jpg",
  },
  {
    id: "city-apartment",
    title: "Greenwich Street Apartment",
    location: "West Village, Manhattan",
    type: "Apartment",
    price: "$1,850,000",
    status: "New listing",
    agent: "Marcus Bellini",
    meta: "2 bed · 2 bath · 118 m²",
    image: "properties/city-apartment.jpg",
  },
  {
    id: "vineyard-estate",
    title: "Hudson Riverfront Penthouse",
    location: "Battery Park City, Manhattan",
    type: "Penthouse",
    price: "$9,400,000",
    status: "By appointment",
    agent: "Elena Whitfield",
    meta: "5 bed · 6 bath · 640 m²",
    image: "properties/vineyard-estate.jpg",
  },
];

const TYPES = ["Any type", "House", "Apartment", "Penthouse", "Loft"];
const PRICES = ["Any price", "Under $2m", "$2m – $6m", "$6m+"];

/**
 * A cinematic preview of the Estara product — a real, working filter over a
 * small set of example listings. Not the marketplace; the promise of it.
 */
export function PlatformPreview() {
  const [query, setQuery] = useState("Manhattan");
  const [type, setType] = useState(TYPES[0]);
  const [price, setPrice] = useState(PRICES[0]);

  const results = LISTINGS.filter((l) => {
    const q = query.trim().toLowerCase();
    const matchQ =
      !q || l.location.toLowerCase().includes(q) || l.title.toLowerCase().includes(q);
    const matchT = type === TYPES[0] || l.type === type;
    return matchQ && matchT;
  });

  return (
    <section className="platform" aria-label="Estara property discovery preview">
      <form className="platform__search" onSubmit={(e) => e.preventDefault()} role="search">
        <label className="field field--grow">
          <span className="field__label">Location</span>
          <input
            className="field__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Where do you want to live?"
            aria-label="Where do you want to live?"
          />
        </label>
        <label className="field">
          <span className="field__label">Property type</span>
          <select className="field__input" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Price</span>
          <select className="field__input" value={price} onChange={(e) => setPrice(e.target.value)}>
            {PRICES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </form>

      <ul className="platform__results">
        {results.map((l, i) => (
          <li key={l.id} className="listing-wrap">
            <EmergentItem range={[4.52, 4.78]} index={i} className="listing">
            <div
              className="listing__media"
              role="img"
              aria-label={`${l.title}, ${l.location}`}
              style={{ backgroundImage: `url(${l.image})` }}
            >
              <span className="listing__status">{l.status}</span>
            </div>
            <div className="listing__body">
              <p className="listing__location">{l.location}</p>
              <h3 className="listing__title">{l.title}</h3>
              <p className="listing__meta">
                {l.type} · {l.meta}
              </p>
              <div className="listing__foot">
                <span className="listing__price">{l.price}</span>
                <span className="listing__agent">{l.agent}</span>
              </div>
            </div>
            </EmergentItem>
          </li>
        ))}
        {results.length === 0 && (
          <li className="listing listing--empty">
            <p>No example properties match that search yet.</p>
          </li>
        )}
      </ul>
    </section>
  );
}
