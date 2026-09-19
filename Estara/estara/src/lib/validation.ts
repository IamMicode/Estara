import { z } from "zod";

/**
 * Client-side validation.
 *
 * This is a UX layer only — every rule that matters is also enforced by
 * database constraints and RLS policies. Never trust these alone.
 */

const email = z.string().trim().min(1, "Email is required").email("Enter a valid email address");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");
const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});

export const customerRegisterSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required").max(60),
    last_name: z.string().trim().min(1, "Last name is required").max(60),
    email,
    phone,
    password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export const agentRegisterSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required").max(60),
    last_name: z.string().trim().min(1, "Last name is required").max(60),
    email,
    phone,
    agency_name: z.string().trim().min(2, "Agency name is required").max(120),
    password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export const profileSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  phone,
  bio: z.string().max(600, "Bio must be under 600 characters").optional().or(z.literal("")),
});

export const agencySchema = z.object({
  agency_name: z.string().trim().min(2, "Agency name is required").max(120),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
  business_phone: phone,
  business_email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  website: z.string().trim().url("Enter a valid URL (including https://)").optional().or(z.literal("")),
  years_experience: z
    .number({ message: "Enter a number" })
    .int("Whole years only")
    .min(0, "Can't be negative")
    .max(80, "That seems too high")
    .nullable()
    .optional(),
});

export const inquirySchema = z.object({
  subject: z.string().trim().min(3, "Add a short subject").max(140),
  message: z.string().trim().min(10, "Tell the agent a little more").max(2000),
});

export const reportSchema = z.object({
  reason: z.string().min(1, "Choose a reason"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

/* --------------------------------------------------- property (multi-step) -- */

export const propertyBasicsSchema = z.object({
  title: z.string().trim().min(8, "Give the listing a descriptive title").max(140),
  property_type: z.enum([
    "apartment", "house", "land", "commercial", "office", "shop", "warehouse", "other",
  ]),
  listing_type: z.enum(["sale", "rent", "lease"]),
  price: z
    .number({ message: "Enter a price" })
    .positive("Price must be greater than zero")
    .max(1e13, "That price is out of range"),
  currency: z.string().length(3),
});

export const propertyLocationSchema = z.object({
  country: z.string().trim().min(1, "Country is required"),
  state_region: z.string().trim().min(1, "State or region is required"),
  city: z.string().trim().min(1, "City is required"),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

const nonNegInt = (label: string) =>
  z.number().int(`${label} must be a whole number`).min(0, `${label} can't be negative`).nullable().optional();

export const propertyDetailsSchema = z.object({
  bedrooms: nonNegInt("Bedrooms"),
  bathrooms: nonNegInt("Bathrooms"),
  toilets: nonNegInt("Toilets"),
  floor_area: z.number().min(0, "Can't be negative").nullable().optional(),
  land_area: z.number().min(0, "Can't be negative").nullable().optional(),
  year_built: z
    .number()
    .int()
    .min(1800, "Enter a realistic year")
    .max(new Date().getFullYear() + 5, "Enter a realistic year")
    .nullable()
    .optional(),
  parking_spaces: z.number().int().min(0).max(100),
  furnished: z.boolean(),
});

export const propertyDescriptionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(40, "Write at least a couple of sentences so buyers know what to expect")
    .max(5000),
  features: z.array(z.string()).max(40),
});

/** Turn a ZodError into a { field: message } map for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Validate and return either data or a field-error map. */
export function validate<T>(
  schema: z.ZodType<T>,
  value: unknown
): { ok: true; data: T } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, errors: fieldErrors(r.error) };
}

/* -------------------------------------------------------- image validation -- */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PROPERTY = 15;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name} isn't a supported image (use JPEG, PNG, WebP or AVIF).`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is larger than 5 MB.`;
  }
  return null;
}
