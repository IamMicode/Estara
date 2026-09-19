-- =============================================================================
-- ESTARA — 0002 ROW LEVEL SECURITY
-- Authorization lives here, in the database. The frontend's route guards are a
-- UX convenience only; every rule below is enforced regardless of client.
-- =============================================================================

alter table profiles         enable row level security;
alter table agents           enable row level security;
alter table properties       enable row level security;
alter table property_images  enable row level security;
alter table favorites        enable row level security;
alter table inquiries        enable row level security;
alter table inquiry_messages enable row level security;
alter table reports          enable row level security;
alter table notifications    enable row level security;
alter table property_views   enable row level security;

-- --------------------------------------------------------------- helpers ----
-- SECURITY DEFINER so policies can consult profiles without recursing into
-- the profiles policies themselves.

create or replace function current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where auth_user_id = auth.uid()
$$;

create or replace function current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where auth_user_id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where auth_user_id = auth.uid() and role = 'admin' and status = 'active'
  )
$$;

create or replace function is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where auth_user_id = auth.uid() and status = 'active'
  )
$$;

-- Agent row belonging to the caller.
create or replace function current_agent_id() returns uuid
language sql stable security definer set search_path = public as $$
  select a.id from agents a
    join profiles p on p.id = a.profile_id
   where p.auth_user_id = auth.uid()
$$;

grant execute on function current_profile_id, current_role_name, is_admin, is_active,
  current_agent_id to anon, authenticated;

-- ================================================================= profiles ==

-- Read your own profile; admins read all.
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles for select
  using (auth_user_id = auth.uid() or is_admin());

-- Public can read the profile fields of agents who have listings — needed for
-- agent cards / public agent pages. Exposed through the public_agents view
-- below rather than the base table.

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update
  using (auth_user_id = auth.uid() and status = 'active')
  with check (auth_user_id = auth.uid() and status = 'active');

drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles for update
  using (is_admin());

-- No client-side INSERT: profiles are created only by handle_new_user().
-- No client-side DELETE: cascade from auth.users only.

-- Role escalation guard: a user updating their own row cannot change role or
-- status. (Admins bypass via the admin policy above.)
create or replace function guard_profile_self_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Trusted server-side context (direct SQL / service_role) has no JWT, so
  -- auth.uid() is null. These guards exist to constrain *client* requests;
  -- a connection that already holds the service role is not something they
  -- can meaningfully protect against, and blocking it breaks migrations,
  -- seeding and admin tooling.
  if auth.uid() is null then
    return new;
  end if;
  if is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed';
  end if;
  if new.status is distinct from old.status then
    raise exception 'status cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_self_update on profiles;
create trigger profiles_guard_self_update
  before update on profiles
  for each row execute function guard_profile_self_update();

-- =================================================================== agents ==

-- Anyone may read agent business info (public agent profiles).
drop policy if exists agents_select_public on agents;
create policy agents_select_public on agents for select using (true);

-- An agent may update their own row, but never their verification decision.
drop policy if exists agents_update_own on agents;
create policy agents_update_own on agents for update
  using (profile_id = current_profile_id() and is_active())
  with check (profile_id = current_profile_id());

drop policy if exists agents_admin_all on agents;
create policy agents_admin_all on agents for all
  using (is_admin()) with check (is_admin());

-- Agents may move themselves not_started/rejected -> pending (submit for
-- review) but may never self-verify.
create or replace function guard_agent_verification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Trusted server-side context (direct SQL / service_role) has no JWT, so
  -- auth.uid() is null. These guards exist to constrain *client* requests;
  -- a connection that already holds the service role is not something they
  -- can meaningfully protect against, and blocking it breaks migrations,
  -- seeding and admin tooling.
  if auth.uid() is null then
    return new;
  end if;
  if is_admin() then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status then
    if not (old.verification_status in ('not_started','rejected')
            and new.verification_status = 'pending') then
      raise exception 'agents cannot set their own verification status';
    end if;
    new.verification_submitted_at := now();
  end if;
  -- protect admin-owned columns
  new.verified_at  := old.verified_at;
  new.verified_by  := old.verified_by;
  if new.verification_status <> 'pending' then
    new.verification_notes := old.verification_notes;
  end if;
  return new;
end $$;

drop trigger if exists agents_guard_verification on agents;
create trigger agents_guard_verification
  before update on agents
  for each row execute function guard_agent_verification();

-- =============================================================== properties ==

-- Public: only published listings. Agents: their own, any status.
-- Admins: everything.
drop policy if exists properties_select_published on properties;
create policy properties_select_published on properties for select
  using (
    status = 'published'
    or agent_id = current_agent_id()
    or is_admin()
  );

-- Only a verified, active agent may create a listing, and only for themselves.
drop policy if exists properties_insert_own on properties;
create policy properties_insert_own on properties for insert
  with check (
    agent_id = current_agent_id()
    and is_active()
    and exists (
      select 1 from agents
       where id = current_agent_id() and verification_status = 'verified'
    )
  );

drop policy if exists properties_update_own on properties;
create policy properties_update_own on properties for update
  using (agent_id = current_agent_id() and is_active())
  with check (agent_id = current_agent_id());

drop policy if exists properties_delete_own on properties;
create policy properties_delete_own on properties for delete
  using (
    agent_id = current_agent_id()
    and is_active()
    and status in ('draft','rejected','archived')
  );

drop policy if exists properties_admin_all on properties;
create policy properties_admin_all on properties for all
  using (is_admin()) with check (is_admin());

-- Agents cannot approve their own listings: they may only move
-- draft/rejected -> pending_review, or published -> archived/sold/rented.
-- Any transition into published/rejected/suspended is admin-only.
create or replace function guard_property_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare allowed boolean := false;
begin
  -- Trusted server-side context (direct SQL / service_role) has no JWT, so
  -- auth.uid() is null. These guards exist to constrain *client* requests;
  -- a connection that already holds the service role is not something they
  -- can meaningfully protect against, and blocking it breaks migrations,
  -- seeding and admin tooling.
  if auth.uid() is null then
    return new;
  end if;
  if is_admin() then
    return new;
  end if;

  if new.status is not distinct from old.status then
    -- editing a published listing sends it back for re-review
    if old.status = 'published' and (
         new.title       is distinct from old.title or
         new.description is distinct from old.description or
         new.price       is distinct from old.price or
         new.address     is distinct from old.address
       ) then
      new.status := 'pending_review';
    end if;
    return new;
  end if;

  allowed :=
       (old.status in ('draft','rejected')      and new.status = 'pending_review')
    or (old.status = 'pending_review'           and new.status = 'draft')
    or (old.status = 'published'                and new.status in ('archived','sold','rented'))
    or (old.status in ('archived','sold','rented') and new.status = 'draft');

  if not allowed then
    raise exception 'agents cannot move a listing from % to %', old.status, new.status;
  end if;

  new.rejection_reason := old.rejection_reason;
  return new;
end $$;

drop trigger if exists properties_guard_status on properties;
create trigger properties_guard_status
  before update on properties
  for each row execute function guard_property_status();

-- ========================================================== property_images ==

drop policy if exists property_images_select on property_images;
create policy property_images_select on property_images for select
  using (
    exists (
      select 1 from properties p
       where p.id = property_id
         and (p.status = 'published' or p.agent_id = current_agent_id() or is_admin())
    )
  );

drop policy if exists property_images_write_own on property_images;
create policy property_images_write_own on property_images for all
  using (
    is_active()
    and exists (select 1 from properties p
             where p.id = property_id and p.agent_id = current_agent_id())
  )
  with check (
    exists (select 1 from properties p
             where p.id = property_id and p.agent_id = current_agent_id())
  );

drop policy if exists property_images_admin on property_images;
create policy property_images_admin on property_images for all
  using (is_admin()) with check (is_admin());

-- ================================================================ favorites ==
-- Strictly private to the owning customer.

drop policy if exists favorites_own on favorites;
create policy favorites_own on favorites for all
  using (user_id = current_profile_id())
  with check (
    user_id = current_profile_id()
    and current_role_name() = 'customer'
    and is_active()
  );

-- ================================================================ inquiries ==
-- Visible only to the customer who sent it and the agent who received it.

drop policy if exists inquiries_select_party on inquiries;
create policy inquiries_select_party on inquiries for select
  using (
    customer_id = current_profile_id()
    or agent_id = current_agent_id()
    or is_admin()
  );

drop policy if exists inquiries_insert_customer on inquiries;
create policy inquiries_insert_customer on inquiries for insert
  with check (
    customer_id = current_profile_id()
    and current_role_name() = 'customer'
    and is_active()
    and exists (select 1 from properties p
                 where p.id = property_id and p.status = 'published'
                   and p.agent_id = inquiries.agent_id)
  );

-- Either party may update status (mark read / respond / close).
drop policy if exists inquiries_update_party on inquiries;
create policy inquiries_update_party on inquiries for update
  using (customer_id = current_profile_id() or agent_id = current_agent_id() or is_admin());

drop policy if exists inquiries_admin on inquiries;
create policy inquiries_admin on inquiries for all using (is_admin()) with check (is_admin());

-- --------------------------------------------------------- inquiry_messages --

drop policy if exists inquiry_messages_select_party on inquiry_messages;
create policy inquiry_messages_select_party on inquiry_messages for select
  using (
    exists (
      select 1 from inquiries i
       where i.id = inquiry_id
         and (i.customer_id = current_profile_id() or i.agent_id = current_agent_id() or is_admin())
    )
  );

drop policy if exists inquiry_messages_insert_party on inquiry_messages;
create policy inquiry_messages_insert_party on inquiry_messages for insert
  with check (
    sender_id = current_profile_id()
    and is_active()
    and exists (
      select 1 from inquiries i
       where i.id = inquiry_id
         and (i.customer_id = current_profile_id() or i.agent_id = current_agent_id())
    )
  );

-- ================================================================== reports ==

drop policy if exists reports_insert_own on reports;
create policy reports_insert_own on reports for insert
  with check (reporter_id = current_profile_id() and is_active());

drop policy if exists reports_select_own on reports;
create policy reports_select_own on reports for select
  using (reporter_id = current_profile_id() or is_admin());

drop policy if exists reports_admin_all on reports;
create policy reports_admin_all on reports for all
  using (is_admin()) with check (is_admin());

-- ============================================================ notifications ==

drop policy if exists notifications_own on notifications;
create policy notifications_own on notifications for select
  using (user_id = current_profile_id());

drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications for update
  using (user_id = current_profile_id() and is_active())
  with check (user_id = current_profile_id());

-- Inserts happen through SECURITY DEFINER triggers only.

-- =========================================================== property_views ==

drop policy if exists property_views_own on property_views;
create policy property_views_own on property_views for all
  using (user_id = current_profile_id())
  with check (user_id = current_profile_id() and is_active());

-- ==================================================== public agent view ======
-- Lets the public read the *safe* subset of an agent's identity without
-- exposing the whole profiles table.

create or replace view public_agents
with (security_invoker = off) as
select
  a.id                as agent_id,
  a.agency_name,
  a.verification_status,
  a.specialties,
  a.service_locations,
  a.years_experience,
  a.website,
  a.created_at,
  p.id                as profile_id,
  p.display_name,
  p.avatar_url,
  p.bio
from agents a
join profiles p on p.id = a.profile_id
where p.status = 'active';

grant select on public_agents to anon, authenticated;
