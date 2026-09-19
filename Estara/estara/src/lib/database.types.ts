/** Types mirroring supabase/migrations/0001_schema.sql. */

export type UserRole = "customer" | "agent" | "admin";
export type AccountStatus = "active" | "suspended" | "deactivated";
export type VerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

export type PropertyType =
  | "apartment"
  | "house"
  | "land"
  | "commercial"
  | "office"
  | "shop"
  | "warehouse"
  | "other";

export type ListingType = "sale" | "rent" | "lease";

export type PropertyStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "archived"
  | "sold"
  | "rented"
  | "suspended";

export type InquiryStatus = "new" | "read" | "responded" | "closed";
export type ReportStatus = "open" | "investigating" | "resolved" | "dismissed";

export interface Profile {
  id: string;
  auth_user_id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string | null;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  profile_id: string;
  agency_name: string;
  license_number: string | null;
  business_phone: string | null;
  business_email: string | null;
  website: string | null;
  years_experience: number | null;
  specialties: string[];
  service_locations: string[];
  verification_status: VerificationStatus;
  verification_notes: string | null;
  verification_submitted_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicAgent {
  agent_id: string;
  agency_name: string;
  verification_status: VerificationStatus;
  specialties: string[];
  service_locations: string[];
  years_experience: number | null;
  website: string | null;
  created_at: string;
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface Property {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  property_type: PropertyType;
  listing_type: ListingType;
  status: PropertyStatus;
  price: number;
  currency: string;
  country: string;
  state_region: string;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  toilets: number | null;
  floor_area: number | null;
  land_area: number | null;
  year_built: number | null;
  furnished: boolean;
  parking_spaces: number;
  features: string[];
  rejection_reason: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/** Property joined with its images and agent identity, as the UI consumes it. */
export interface PropertyWithRelations extends Property {
  property_images: PropertyImage[];
  agents?: {
    id: string;
    agency_name: string;
    verification_status: VerificationStatus;
    profiles?: Pick<Profile, "display_name" | "avatar_url" | "id">;
  } | null;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
}

export interface Inquiry {
  id: string;
  property_id: string;
  customer_id: string;
  agent_id: string;
  subject: string;
  message: string;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
}

export interface InquiryMessage {
  id: string;
  inquiry_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  property_id: string | null;
  reported_agent_id: string | null;
  reason: string;
  description: string;
  status: ReportStatus;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

/* ------------------------------------------------------------- constants ---- */

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
  { value: "office", label: "Office" },
  { value: "shop", label: "Shop" },
  { value: "warehouse", label: "Warehouse" },
  { value: "other", label: "Other" },
];

export const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: "sale", label: "For Sale" },
  { value: "rent", label: "For Rent" },
  { value: "lease", label: "For Lease" },
];

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
  sold: "Sold",
  rented: "Rented",
  suspended: "Suspended",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  not_started: "Not Started",
  pending: "Pending Review",
  verified: "Verified",
  rejected: "Rejected",
  suspended: "Suspended",
};

/** Currencies the platform supports. Nigeria-first, not Nigeria-locked. */
export const CURRENCIES = [
  { code: "NGN", symbol: "₦", label: "Nigerian Naira" },
  { code: "ZAR", symbol: "R", label: "South African Rand" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "EUR", symbol: "€", label: "Euro" },
] as const;

/** Location hierarchy. Extend per country without touching the schema. */
export const LOCATIONS: Record<string, string[]> = {
  Nigeria: [
    "Lagos",
    "Abuja (FCT)",
    "Rivers",
    "Oyo",
    "Kano",
    "Enugu",
    "Kaduna",
    "Delta",
    "Ogun",
    "Anambra",
  ],
  "South Africa": ["Western Cape", "Gauteng", "KwaZulu-Natal", "Eastern Cape"],
};

export const CITIES: Record<string, string[]> = {
  Lagos: ["Ikoyi", "Victoria Island", "Lekki", "Ikeja", "Yaba", "Surulere", "Ajah", "Magodo"],
  "Abuja (FCT)": ["Maitama", "Asokoro", "Wuse II", "Garki", "Gwarinpa", "Jabi"],
  Rivers: ["Port Harcourt", "Obio-Akpor"],
  Oyo: ["Ibadan", "Bodija"],
  "Western Cape": ["Cape Town", "Constantia", "Camps Bay", "Stellenbosch"],
  Gauteng: ["Johannesburg", "Sandton", "Pretoria"],
};
