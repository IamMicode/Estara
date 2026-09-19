import { supabase } from "./supabase";
import type {
  Agent,
  Inquiry,
  InquiryMessage,
  Notification,
  Profile,
  Property,
  PropertyImage,
  PropertyStatus,
  PropertyWithRelations,
  PublicAgent,
  Report,
} from "./database.types";

/**
 * Centralised database access.
 *
 * Every function here is a thin, typed wrapper over Supabase. Authorization is
 * NOT implemented in this file — it is enforced by RLS policies in the
 * database, so a compromised or modified client cannot bypass it.
 */

const PROPERTY_SELECT = `
  *,
  property_images ( id, property_id, storage_path, public_url, alt_text, sort_order, is_primary, created_at ),
  agents ( id, agency_name, verification_status, profiles ( id, display_name, avatar_url ) )
`;

/* ============================================================== explore ==== */

export interface ExploreFilters {
  q?: string;
  city?: string;
  state_region?: string;
  country?: string;
  property_type?: string;
  listing_type?: string;
  min_price?: number;
  max_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  min_area?: number;
  furnished?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "relevance";
  page?: number;
  page_size?: number;
}

export const PAGE_SIZE = 12;

export async function searchProperties(f: ExploreFilters) {
  const page = Math.max(1, f.page ?? 1);
  const size = f.page_size ?? PAGE_SIZE;
  const from = (page - 1) * size;

  let q = supabase
    .from("properties")
    .select(PROPERTY_SELECT, { count: "exact" })
    .eq("status", "published");

  if (f.q) {
    const term = `%${f.q}%`;
    q = q.or(`title.ilike.${term},city.ilike.${term},state_region.ilike.${term},address.ilike.${term}`);
  }
  if (f.city) q = q.ilike("city", f.city);
  if (f.state_region) q = q.ilike("state_region", f.state_region);
  if (f.country) q = q.eq("country", f.country);
  if (f.property_type) q = q.eq("property_type", f.property_type);
  if (f.listing_type) q = q.eq("listing_type", f.listing_type);
  if (f.min_price != null) q = q.gte("price", f.min_price);
  if (f.max_price != null) q = q.lte("price", f.max_price);
  if (f.bedrooms != null) q = q.gte("bedrooms", f.bedrooms);
  if (f.bathrooms != null) q = q.gte("bathrooms", f.bathrooms);
  if (f.min_area != null) q = q.gte("floor_area", f.min_area);
  if (f.furnished) q = q.eq("furnished", true);

  switch (f.sort) {
    case "price_asc":
      q = q.order("price", { ascending: true });
      break;
    case "price_desc":
      q = q.order("price", { ascending: false });
      break;
    default:
      q = q.order("published_at", { ascending: false, nullsFirst: false });
  }

  const { data, error, count } = await q.range(from, from + size - 1);
  if (error) throw error;
  return {
    items: (data ?? []) as PropertyWithRelations[],
    total: count ?? 0,
    page,
    pageSize: size,
    pages: Math.max(1, Math.ceil((count ?? 0) / size)),
  };
}

export async function getProperty(id: string) {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as PropertyWithRelations | null;
}

export async function getSimilarProperties(p: Property, limit = 3) {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("status", "published")
    .eq("property_type", p.property_type)
    .eq("listing_type", p.listing_type)
    .neq("id", p.id)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PropertyWithRelations[];
}

export async function recordPropertyView(propertyId: string, profileId?: string | null) {
  await supabase.rpc("increment_property_view", { p_property: propertyId });
  if (profileId) {
    await supabase
      .from("property_views")
      .upsert(
        { user_id: profileId, property_id: propertyId, viewed_at: new Date().toISOString() },
        { onConflict: "user_id,property_id" }
      );
  }
}

/* ============================================================ favorites ==== */

export async function listFavorites(profileId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select(`id, created_at, property_id, properties ( ${PROPERTY_SELECT} )`)
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string;
    created_at: string;
    property_id: string;
    properties: PropertyWithRelations | null;
  }[];
}

export async function listFavoriteIds(profileId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select("property_id")
    .eq("user_id", profileId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r as { property_id: string }).property_id));
}

export async function addFavorite(profileId: string, propertyId: string) {
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: profileId, property_id: propertyId });
  if (error && error.code !== "23505") throw error;
}

export async function removeFavorite(profileId: string, propertyId: string) {
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", profileId)
    .eq("property_id", propertyId);
  if (error) throw error;
}

/* ============================================================ inquiries ==== */

export async function createInquiry(input: {
  property_id: string;
  customer_id: string;
  agent_id: string;
  subject: string;
  message: string;
}) {
  const { data, error } = await supabase.from("inquiries").insert(input).select().single();
  if (error) throw error;
  return data as Inquiry;
}

export async function listCustomerInquiries(profileId: string) {
  const { data, error } = await supabase
    .from("inquiries")
    .select(
      `*, properties ( id, title, city, state_region, price, currency, listing_type,
        property_images ( public_url, is_primary, sort_order ) ),
       agents ( id, agency_name, profiles ( display_name, avatar_url ) )`
    )
    .eq("customer_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAgentInquiries(agentId: string) {
  const { data, error } = await supabase
    .from("inquiries")
    .select(
      `*, properties ( id, title, city, price, currency,
        property_images ( public_url, is_primary, sort_order ) ),
       profiles!inquiries_customer_id_fkey ( id, display_name, email, phone, avatar_url )`
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInquiryThread(inquiryId: string) {
  const { data, error } = await supabase
    .from("inquiry_messages")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as InquiryMessage[];
}

export async function replyToInquiry(inquiryId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from("inquiry_messages")
    .insert({ inquiry_id: inquiryId, sender_id: senderId, body });
  if (error) throw error;
  await supabase.from("inquiries").update({ status: "responded" }).eq("id", inquiryId);
}

export async function setInquiryStatus(inquiryId: string, status: Inquiry["status"]) {
  const { error } = await supabase.from("inquiries").update({ status }).eq("id", inquiryId);
  if (error) throw error;
}

/* ======================================================= agent: listings ==== */

export async function listAgentProperties(agentId: string) {
  const { data, error } = await supabase
    .from("properties")
    .select(`${PROPERTY_SELECT}, inquiries ( id )`)
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as (PropertyWithRelations & { inquiries: { id: string }[] })[];
}

export async function createProperty(input: Partial<Property> & { agent_id: string }) {
  const { data, error } = await supabase.from("properties").insert(input).select().single();
  if (error) throw error;
  return data as Property;
}

export async function updateProperty(id: string, patch: Partial<Property>) {
  const { data, error } = await supabase
    .from("properties")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Property;
}

export async function setPropertyStatus(id: string, status: PropertyStatus, reason?: string) {
  const patch: Partial<Property> = { status };
  if (reason !== undefined) patch.rejection_reason = reason;
  return updateProperty(id, patch);
}

export async function deleteProperty(id: string) {
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;
}

/* --------------------------------------------------------------- images ---- */

export async function uploadPropertyImage(propertyId: string, file: File, sortOrder: number) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${propertyId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("property-images")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from("property-images").getPublicUrl(path);

  const { count } = await supabase
    .from("property_images")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  const { data, error } = await supabase
    .from("property_images")
    .insert({
      property_id: propertyId,
      storage_path: path,
      public_url: pub.publicUrl,
      sort_order: sortOrder,
      is_primary: (count ?? 0) === 0,
      alt_text: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PropertyImage;
}

export async function deletePropertyImage(img: PropertyImage) {
  await supabase.storage.from("property-images").remove([img.storage_path]);
  const { error } = await supabase.from("property_images").delete().eq("id", img.id);
  if (error) throw error;
}

export async function setPrimaryImage(propertyId: string, imageId: string) {
  // clear then set — the partial unique index allows only one primary
  await supabase.from("property_images").update({ is_primary: false }).eq("property_id", propertyId);
  const { error } = await supabase
    .from("property_images")
    .update({ is_primary: true })
    .eq("id", imageId);
  if (error) throw error;
}

export async function reorderImages(order: { id: string; sort_order: number }[]) {
  for (const o of order) {
    await supabase.from("property_images").update({ sort_order: o.sort_order }).eq("id", o.id);
  }
}

/* ==================================================== agent: verification ==== */

export async function submitVerification(agentId: string, patch: Partial<Agent>) {
  const { data, error } = await supabase
    .from("agents")
    .update({ ...patch, verification_status: "pending" })
    .eq("id", agentId)
    .select()
    .single();
  if (error) throw error;
  return data as Agent;
}

export async function updateAgent(agentId: string, patch: Partial<Agent>) {
  const { data, error } = await supabase
    .from("agents")
    .update(patch)
    .eq("id", agentId)
    .select()
    .single();
  if (error) throw error;
  return data as Agent;
}

export async function getPublicAgent(agentId: string) {
  const { data, error } = await supabase
    .from("public_agents")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw error;
  return data as PublicAgent | null;
}

export async function listAgentPublicProperties(agentId: string) {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("agent_id", agentId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PropertyWithRelations[];
}

/* ============================================================== profile ==== */

export async function updateProfile(profileId: string, patch: Partial<Profile>) {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", profileId)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function listRecentlyViewed(profileId: string, limit = 4) {
  const { data, error } = await supabase
    .from("property_views")
    .select(`viewed_at, properties ( ${PROPERTY_SELECT} )`)
    .eq("user_id", profileId)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as { viewed_at: string; properties: PropertyWithRelations }[];
}

/* ======================================================== notifications ==== */

export async function listNotifications(profileId: string, limit = 30) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string) {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function markAllNotificationsRead(profileId: string) {
  await supabase.from("notifications").update({ read: true }).eq("user_id", profileId).eq("read", false);
}

/* =============================================================== reports ==== */

export async function createReport(input: {
  reporter_id: string;
  property_id?: string | null;
  reported_agent_id?: string | null;
  reason: string;
  description?: string;
}) {
  const { error } = await supabase.from("reports").insert(input);
  if (error) throw error;
}

/* ================================================================= admin ==== */

export async function adminStats() {
  const counts = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("agents").select("id", { count: "exact", head: true }),
    supabase.from("agents").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  const [users, agents, pendingAgents, published, pendingProps, openReports, newInquiries] = counts.map(
    (c) => c.count ?? 0
  );
  return { users, agents, pendingAgents, published, pendingProps, openReports, newInquiries };
}

export async function adminListUsers(opts: { q?: string; role?: string; status?: string } = {}) {
  let q = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (opts.q) q = q.or(`first_name.ilike.%${opts.q}%,last_name.ilike.%${opts.q}%,email.ilike.%${opts.q}%`);
  if (opts.role) q = q.eq("role", opts.role);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function adminSetUserStatus(profileId: string, status: Profile["status"]) {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", profileId);
  if (error) throw error;
}

export async function adminListAgents(status?: string) {
  let q = supabase
    .from("agents")
    .select(`*, profiles ( id, display_name, email, phone, avatar_url, status ),
             properties ( id, status )`)
    .order("verification_submitted_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (status) q = q.eq("verification_status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function adminDecideVerification(
  agentId: string,
  decision: "verified" | "rejected" | "suspended",
  notes: string,
  adminProfileId: string
) {
  const patch: Partial<Agent> = {
    verification_status: decision,
    verification_notes: notes || null,
  };
  if (decision === "verified") {
    patch.verified_at = new Date().toISOString();
    patch.verified_by = adminProfileId;
  }
  const { error } = await supabase.from("agents").update(patch).eq("id", agentId);
  if (error) throw error;
}

export async function adminListProperties(status?: string, q?: string) {
  let query = supabase
    .from("properties")
    .select(`${PROPERTY_SELECT}`)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PropertyWithRelations[];
}

export async function adminListReports(status?: string) {
  let q = supabase
    .from("reports")
    .select(
      `*, properties ( id, title, city ),
       profiles!reports_reporter_id_fkey ( id, display_name, email ),
       agents ( id, agency_name )`
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function adminResolveReport(
  id: string,
  status: Report["status"],
  notes: string
) {
  const patch: Partial<Report> = { status, resolution_notes: notes || null };
  if (status === "resolved" || status === "dismissed") {
    patch.resolved_at = new Date().toISOString();
  }
  const { error } = await supabase.from("reports").update(patch).eq("id", id);
  if (error) throw error;
}
