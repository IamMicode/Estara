import { CURRENCIES } from "./database.types";

export function currencySymbol(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code + " ";
}

/** Compact, locale-aware money. 45000000 NGN -> "₦45,000,000". */
export function formatPrice(amount: number, currency = "NGN") {
  const sym = currencySymbol(currency);
  return sym + new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(amount);
}

/** Short form for dense cards: ₦45M, ₦950K. */
export function formatPriceShort(amount: number, currency = "NGN") {
  const sym = currencySymbol(currency);
  if (amount >= 1_000_000_000) return `${sym}${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (amount >= 1_000) return `${sym}${Math.round(amount / 1_000)}K`;
  return formatPrice(amount, currency);
}

export function formatPriceWithPeriod(amount: number, currency: string, listing: string) {
  const base = formatPrice(amount, currency);
  if (listing === "rent") return `${base}/yr`;
  if (listing === "lease") return `${base}/lease`;
  return base;
}

export function formatArea(sqm: number | null) {
  if (sqm == null) return null;
  return `${new Intl.NumberFormat("en-NG").format(sqm)} m²`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}

export function locationLine(p: { city: string; state_region: string; country: string }) {
  return [p.city, p.state_region, p.country].filter(Boolean).join(", ");
}
