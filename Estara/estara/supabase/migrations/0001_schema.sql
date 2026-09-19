-- =============================================================================
-- ESTARA — 0001 SCHEMA
-- Core tables, enums, indexes and triggers for the marketplace.
-- Run this first, then 0002_rls.sql, then 0003_storage.sql.
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------- enums ----

do $$ begin
  create type user_role as enum ('customer', 'agent', 'admin');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type account_status as enum ('active', 'suspended', 'deactivated');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type verification_status as enum ('not_started', 'pending', 'verified', 'rejected', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type property_type as enum (
    'apartment', 'house', 'land', 'commercial', 'office', 'shop', 'warehouse', 'other'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type listing_type as enum ('sale', 'rent', 'lease');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type property_status as enum (
    'draft', 'pending_review', 'published', 'rejected', 'archived', 'sold', 'rented', 'suspended'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type inquiry_status as enum ('new', 'read', 'responded', 'closed');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type report_status as enum ('open', 'investigating', 'resolved', 'dismissed');
exception when duplicate_object then null;
end $$;

-- -------------------------------------------------------------- profiles ----
-- One row per auth user. Never stores credentials — auth.users owns those.

create table if not exists profiles (
  id            uuid primary key default uuid_generate_v4(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  role          user_role not null default 'customer',
  first_name    text not null default '',
  last_name     text not null default '',
  display_name  text generated always as (trim(first_name || ' ' || last_name)) stored,
  phone         text,
  email         text not null,
  avatar_url    text,
  bio           text,
  status        account_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles(role);
create index if not exists profiles_status_idx on profiles(status);

-- ---------------------------------------------------------------- agents ----

create table if not exists agents (
  id                       uuid primary key default uuid_generate_v4(),
  profile_id               uuid not null unique references profiles(id) on delete cascade,
  agency_name              text not null default '',
  license_number           text,
  business_phone           text,
  business_email           text,
  website                  text,
  years_experience         int check (years_experience is null or years_experience >= 0),
  specialties              text[] not null default '{}',
  service_locations        text[] not null default '{}',
  verification_status      verification_status not null default 'not_started',
  verification_notes       text,          -- admin's reason on reject/suspend
  verification_submitted_at timestamptz,
  verified_at              timestamptz,
  verified_by              uuid references profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists agents_verification_idx on agents(verification_status);

-- ------------------------------------------------------------ properties ----

create table if not exists properties (
  id             uuid primary key default uuid_generate_v4(),
  agent_id       uuid not null references agents(id) on delete cascade,
  title          text not null,
  description    text not null default '',
  property_type  property_type not null,
  listing_type   listing_type not null,
  status         property_status not null default 'draft',
  price          numeric(14,2) not null check (price >= 0),
  currency       char(3) not null default 'NGN',
  country        text not null default 'Nigeria',
  state_region   text not null default '',
  city           text not null default '',
  address        text,
  latitude       double precision check (latitude is null or (latitude between -90 and 90)),
  longitude      double precision check (longitude is null or (longitude between -180 and 180)),
  bedrooms       int check (bedrooms is null or bedrooms >= 0),
  bathrooms      int check (bathrooms is null or bathrooms >= 0),
  toilets        int check (toilets is null or toilets >= 0),
  floor_area     numeric(10,2) check (floor_area is null or floor_area >= 0),
  land_area      numeric(10,2) check (land_area is null or land_area >= 0),
  year_built     int check (year_built is null or (year_built between 1800 and 2100)),
  furnished      boolean not null default false,
  parking_spaces int not null default 0 check (parking_spaces >= 0),
  features       text[] not null default '{}',
  rejection_reason text,
  view_count     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  published_at   timestamptz
);

create index if not exists properties_status_idx      on properties(status);
create index if not exists properties_agent_idx       on properties(agent_id);
create index if not exists properties_city_idx        on properties(lower(city));
create index if not exists properties_type_idx        on properties(property_type, listing_type);
create index if not exists properties_price_idx       on properties(price);
create index if not exists properties_published_idx   on properties(published_at desc nulls last);
create index if not exists properties_search_idx      on properties using gin (
  (title || ' ' || coalesce(city,'') || ' ' || coalesce(state_region,'')) gin_trgm_ops
);

-- ------------------------------------------------------- property_images ----

create table if not exists property_images (
  id           uuid primary key default uuid_generate_v4(),
  property_id  uuid not null references properties(id) on delete cascade,
  storage_path text not null,
  public_url   text not null,
  alt_text     text,
  sort_order   int not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists property_images_property_idx on property_images(property_id, sort_order);
-- at most one primary image per property
create unique index if not exists property_images_one_primary_idx
  on property_images(property_id) where is_primary;

-- --------------------------------------------------------------- favorites --

create table if not exists favorites (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, property_id)
);

create index if not exists favorites_user_idx on favorites(user_id, created_at desc);

-- --------------------------------------------------------------- inquiries --

create table if not exists inquiries (
  id          uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  agent_id    uuid not null references agents(id) on delete cascade,
  subject     text not null,
  message     text not null,
  status      inquiry_status not null default 'new',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists inquiries_agent_idx    on inquiries(agent_id, created_at desc);
create index if not exists inquiries_customer_idx on inquiries(customer_id, created_at desc);

-- Threaded replies, so "respond" is real rather than a status flip.
create table if not exists inquiry_messages (
  id         uuid primary key default uuid_generate_v4(),
  inquiry_id uuid not null references inquiries(id) on delete cascade,
  sender_id  uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists inquiry_messages_inquiry_idx on inquiry_messages(inquiry_id, created_at);

-- ----------------------------------------------------------------- reports --

create table if not exists reports (
  id                uuid primary key default uuid_generate_v4(),
  reporter_id       uuid not null references profiles(id) on delete cascade,
  property_id       uuid references properties(id) on delete cascade,
  reported_agent_id uuid references agents(id) on delete cascade,
  reason            text not null,
  description       text not null default '',
  status            report_status not null default 'open',
  resolution_notes  text,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  check (property_id is not null or reported_agent_id is not null)
);

create index if not exists reports_status_idx on reports(status, created_at desc);

-- ----------------------------------------------------------- notifications --

create table if not exists notifications (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references profiles(id) on delete cascade,
  type           text not null,
  title          text not null,
  message        text not null default '',
  read           boolean not null default false,
  reference_type text,
  reference_id   uuid,
  created_at     timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications(user_id, read, created_at desc);

-- ------------------------------------------------- recently viewed (customer)

create table if not exists property_views (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  unique (user_id, property_id)
);

create index if not exists property_views_user_idx on property_views(user_id, viewed_at desc);

-- ================================================================ triggers ===

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_updated on profiles;
create trigger profiles_updated   before update on profiles   for each row execute function set_updated_at();
drop trigger if exists agents_updated on agents;
create trigger agents_updated     before update on agents     for each row execute function set_updated_at();
drop trigger if exists properties_updated on properties;
create trigger properties_updated before update on properties for each row execute function set_updated_at();
drop trigger if exists inquiries_updated on inquiries;
create trigger inquiries_updated  before update on inquiries  for each row execute function set_updated_at();

-- Stamp published_at exactly when a listing becomes published.
create or replace function stamp_published_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    new.published_at = now();
  end if;
  return new;
end $$;

drop trigger if exists properties_publish_stamp on properties;
create trigger properties_publish_stamp
  before update on properties
  for each row execute function stamp_published_at();

-- ---------------------------------------------------------- new auth user ---
-- Creates the profile (and agent row when registering as an agent) atomically.
-- Role comes from signup metadata but is clamped: nobody can self-register as
-- admin. Admins are promoted manually via 0004_seed.sql or another admin.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  requested text := coalesce(new.raw_user_meta_data->>'role', 'customer');
  final_role user_role;
  new_profile_id uuid;
begin
  final_role := case when requested = 'agent' then 'agent'::user_role
                     else 'customer'::user_role end;

  insert into profiles (auth_user_id, role, first_name, last_name, phone, email)
  values (
    new.id,
    final_role,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.raw_user_meta_data->>'phone',
    new.email
  )
  returning id into new_profile_id;

  if final_role = 'agent' then
    insert into agents (profile_id, agency_name, business_email)
    values (
      new_profile_id,
      coalesce(new.raw_user_meta_data->>'agency_name', ''),
      new.email
    );
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------ notify helpers

create or replace function notify_user(
  p_user uuid, p_type text, p_title text, p_message text,
  p_ref_type text default null, p_ref_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, type, title, message, reference_type, reference_id)
  values (p_user, p_type, p_title, p_message, p_ref_type, p_ref_id);
end $$;

-- New inquiry -> notify the agent.
create or replace function on_inquiry_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare agent_profile uuid; prop_title text;
begin
  select profile_id into agent_profile from agents where id = new.agent_id;
  select title into prop_title from properties where id = new.property_id;
  perform notify_user(agent_profile, 'inquiry_received', 'New inquiry',
                      'You received an inquiry about ' || coalesce(prop_title,'your listing') || '.',
                      'inquiry', new.id);
  return new;
end $$;

drop trigger if exists inquiries_notify on inquiries;
create trigger inquiries_notify after insert on inquiries
  for each row execute function on_inquiry_created();

-- Inquiry reply -> notify the other party.
create or replace function on_inquiry_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare cust uuid; agent_profile uuid; target uuid;
begin
  select i.customer_id, a.profile_id into cust, agent_profile
    from inquiries i join agents a on a.id = i.agent_id where i.id = new.inquiry_id;
  target := case when new.sender_id = cust then agent_profile else cust end;
  perform notify_user(target, 'inquiry_response', 'New reply',
                      'There is a new reply on your inquiry.', 'inquiry', new.inquiry_id);
  return new;
end $$;

drop trigger if exists inquiry_messages_notify on inquiry_messages;
create trigger inquiry_messages_notify after insert on inquiry_messages
  for each row execute function on_inquiry_message();

-- Listing moderation -> notify the agent.
create or replace function on_property_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare agent_profile uuid;
begin
  if new.status is distinct from old.status then
    select profile_id into agent_profile from agents where id = new.agent_id;
    if new.status = 'published' then
      perform notify_user(agent_profile, 'listing_approved', 'Listing published',
                          '"' || new.title || '" is now live.', 'property', new.id);
    elsif new.status = 'rejected' then
      perform notify_user(agent_profile, 'listing_rejected', 'Listing rejected',
                          coalesce(new.rejection_reason, 'Your listing needs changes.'),
                          'property', new.id);
    elsif new.status = 'suspended' then
      perform notify_user(agent_profile, 'listing_suspended', 'Listing suspended',
                          'A moderator suspended "' || new.title || '".', 'property', new.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists properties_notify on properties;
create trigger properties_notify after update on properties
  for each row execute function on_property_status_change();

-- Verification decision -> notify the agent.
create or replace function on_agent_verification_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status is distinct from old.verification_status then
    if new.verification_status = 'verified' then
      perform notify_user(new.profile_id, 'agent_verified', 'You are verified',
                          'Your agent account has been verified.', 'agent', new.id);
    elsif new.verification_status = 'rejected' then
      perform notify_user(new.profile_id, 'agent_verification_rejected', 'Verification rejected',
                          coalesce(new.verification_notes, 'Your verification was not approved.'),
                          'agent', new.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists agents_notify on agents;
create trigger agents_notify after update on agents
  for each row execute function on_agent_verification_change();

-- ------------------------------------------------------------- rpc helpers --

-- Atomic view counter (avoids a read-modify-write race and needs no update grant).
create or replace function increment_property_view(p_property uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update properties set view_count = view_count + 1
   where id = p_property and status = 'published';
end $$;

grant execute on function increment_property_view(uuid) to anon, authenticated;
