-- =============================================================================
-- ESTARA — DEMO SEED DATA
--
-- ⚠ SEED DATA ONLY — SAFE TO DROP.
-- Everything created here is tagged so it can be removed in one statement:
--   • auth users carry raw_user_meta_data->>'seed' = 'estara_demo'
--   • properties carry the feature tag 'ESTARA_SEED'
-- Run supabase/seed_teardown.sql to remove all of it.
--
-- This file inserts directly into auth.users because demo logins need working
-- passwords. It must be run from the SQL editor / service role, never from the
-- client. Real users are always created through supabase.auth.signUp().
--
-- Demo logins (password for all three: EstaraDemo!2026)
--   customer  →  demo.customer@estara.test
--   agent     →  demo.agent@estara.test      (pre-verified so you can publish)
--   admin     →  demo.admin@estara.test
-- =============================================================================

begin;

-- pgcrypto gives us crypt()/gen_salt() for the password hashes.
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Demo auth users
--    The on_auth_user_created trigger builds the matching profiles/agents rows.
-- -----------------------------------------------------------------------------

create or replace function seed_user(
  p_email text,
  p_password text,
  p_meta jsonb
) returns uuid
language plpgsql security definer set search_path = auth, public as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is not null then
    return uid;
  end if;

  uid := gen_random_uuid();

  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    p_meta || jsonb_build_object('seed', 'estara_demo'),
    now(), now()
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(), uid, uid::text, 'email',
    jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  );

  return uid;
end $$;

do $seed$
declare
  demo_pw          text := 'EstaraDemo!2026';
  customer_uid     uuid;
  customer2_uid    uuid;
  agent1_uid       uuid;
  agent2_uid       uuid;
  agent3_uid       uuid;
  admin_uid        uuid;

  customer_pid     uuid;
  customer2_pid    uuid;
  admin_pid        uuid;

  agent1_id        uuid;
  agent2_id        uuid;
  agent3_id        uuid;

  p_ikoyi          uuid;
  p_lekki          uuid;
  p_vi             uuid;
  p_maitama        uuid;
  p_gwarinpa       uuid;
  p_ph             uuid;
  p_ibadan         uuid;
  p_yaba           uuid;
  p_camps          uuid;
  p_constantia     uuid;
  p_seapoint       uuid;
  p_ajah_land      uuid;
  p_ikeja_office   uuid;
  p_draft          uuid;
  p_pending        uuid;
begin
  -- Idempotency: if the seed has already been applied, do nothing. Re-running
  -- migrations must not duplicate the demo catalogue.
  if exists (select 1 from properties where 'ESTARA_SEED' = any (features)) then
    raise notice 'Estara demo seed already present — skipping. Run seed_teardown.sql first to reseed.';
    return;
  end if;

  -- ---- accounts ------------------------------------------------------------
  customer_uid := seed_user('demo.customer@estara.test', demo_pw, jsonb_build_object(
    'role', 'customer', 'first_name', 'Amara', 'last_name', 'Okonkwo', 'phone', '+234 802 114 9930'));

  customer2_uid := seed_user('demo.customer2@estara.test', demo_pw, jsonb_build_object(
    'role', 'customer', 'first_name', 'Tunde', 'last_name', 'Bakare', 'phone', '+234 803 552 1180'));

  agent1_uid := seed_user('demo.agent@estara.test', demo_pw, jsonb_build_object(
    'role', 'agent', 'first_name', 'Chidinma', 'last_name', 'Eze',
    'phone', '+234 810 447 2201', 'agency_name', 'Eze & Partners Realty'));

  agent2_uid := seed_user('demo.agent2@estara.test', demo_pw, jsonb_build_object(
    'role', 'agent', 'first_name', 'Ibrahim', 'last_name', 'Danladi',
    'phone', '+234 807 330 6612', 'agency_name', 'Northgate Property Group'));

  agent3_uid := seed_user('demo.agent3@estara.test', demo_pw, jsonb_build_object(
    'role', 'agent', 'first_name', 'Nadia', 'last_name', 'Petersen',
    'phone', '+27 82 447 1120', 'agency_name', 'Table Bay Estates'));

  -- Admin: the trigger clamps self-registration to customer|agent by design, so
  -- an admin can only be minted here, server-side. This is deliberate.
  admin_uid := seed_user('demo.admin@estara.test', demo_pw, jsonb_build_object(
    'role', 'customer', 'first_name', 'Estara', 'last_name', 'Admin'));

  select id into admin_pid from profiles where auth_user_id = admin_uid;
  update profiles set role = 'admin' where id = admin_pid;

  select id into customer_pid  from profiles where auth_user_id = customer_uid;
  select id into customer2_pid from profiles where auth_user_id = customer2_uid;

  update profiles set bio = 'Looking for a family home in Lagos with good light and a short school run.'
    where id = customer_pid;

  select a.id into agent1_id from agents a join profiles p on p.id = a.profile_id
    where p.auth_user_id = agent1_uid;
  select a.id into agent2_id from agents a join profiles p on p.id = a.profile_id
    where p.auth_user_id = agent2_uid;
  select a.id into agent3_id from agents a join profiles p on p.id = a.profile_id
    where p.auth_user_id = agent3_uid;

  -- ---- agent verification states -------------------------------------------
  -- agent1: verified (so the demo login can publish immediately)
  update agents set
    verification_status = 'verified',
    license_number = 'RC-2291840',
    business_phone = '+234 810 447 2201',
    business_email = 'hello@ezepartners.test',
    website = 'https://ezepartners.test',
    years_experience = 11,
    specialties = array['Residential sales','Luxury homes','Rentals'],
    service_locations = array['Lagos','Ogun'],
    verification_submitted_at = now() - interval '21 days',
    verified_at = now() - interval '19 days',
    verified_by = admin_pid
  where id = agent1_id;

  update profiles set bio = 'Eleven years selling homes across Ikoyi, Lekki and the Lagos waterfront. I only list what I would live in.'
    where id = (select profile_id from agents where id = agent1_id);

  -- agent2: verified, Abuja / northern focus
  update agents set
    verification_status = 'verified',
    license_number = 'RC-1180273',
    business_phone = '+234 807 330 6612',
    business_email = 'info@northgate.test',
    years_experience = 7,
    specialties = array['Residential sales','Land & plots','Commercial'],
    service_locations = array['Abuja (FCT)','Kaduna','Kano'],
    verification_submitted_at = now() - interval '40 days',
    verified_at = now() - interval '38 days',
    verified_by = admin_pid
  where id = agent2_id;

  -- agent3: PENDING — gives the admin queue something real to review
  update agents set
    verification_status = 'pending',
    license_number = 'ZA-EAAB-77120',
    business_phone = '+27 82 447 1120',
    business_email = 'nadia@tablebay.test',
    years_experience = 14,
    specialties = array['Luxury homes','Short lets'],
    service_locations = array['Western Cape'],
    verification_submitted_at = now() - interval '2 days'
  where id = agent3_id;

  -- ---------------------------------------------------------------------------
  -- 2. Properties
  -- ---------------------------------------------------------------------------

  -- ============================ LAGOS (agent1) ==============================
  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address, latitude, longitude,
    bedrooms, bathrooms, toilets, floor_area, land_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent1_id,
    '5-Bedroom Waterfront Duplex in Banana Island',
    'A calm, generously proportioned duplex on the quiet eastern edge of Banana Island. Floor-to-ceiling glazing across the living wing pulls the lagoon into every room, and the west-facing terrace catches the whole of the evening light. The kitchen is fully fitted in matte oak with a separate prep pantry, and each bedroom is en-suite with fitted wardrobes. Serviced estate with 24-hour security, treated water and full backup power.',
    'house', 'sale', 'published',
    1250000000, 'NGN', 'Nigeria', 'Lagos', 'Ikoyi', 'Banana Island Road', 6.4281, 3.4519,
    5, 6, 6, 640, 1100, 2021, 4, true,
    array['ESTARA_SEED','Sea view','24/7 security','Gated estate','Backup generator','Borehole / water supply','Fitted kitchen','Swimming pool','Balcony','CCTV','Boys'' quarters'],
    now() - interval '9 days', 412)
  returning id into p_ikoyi;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address, latitude, longitude,
    bedrooms, bathrooms, toilets, floor_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent1_id,
    '3-Bedroom Serviced Apartment in Lekki Phase 1',
    'Bright, efficient three-bedroom apartment on the fourth floor of a well-run block just off Admiralty Way. Open-plan living with a balcony facing away from the road, so evenings are genuinely quiet. Service charge covers generator, water treatment, cleaning of common areas and estate security. Walking distance to the shops and a straight run to the Lekki-Epe expressway.',
    'apartment', 'rent', 'published',
    12000000, 'NGN', 'Nigeria', 'Lagos', 'Lekki', 'Off Admiralty Way', 6.4419, 3.4736,
    3, 3, 4, 168, 2019, 2, true,
    array['ESTARA_SEED','Air conditioning','Backup generator','24/7 security','Elevator','Balcony','Fitted kitchen','Parking space','Gym'],
    now() - interval '4 days', 289)
  returning id into p_lekki;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address, latitude, longitude,
    bedrooms, bathrooms, toilets, floor_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent1_id,
    '2-Bedroom Apartment with Skyline Views, Victoria Island',
    'A compact, beautifully finished two-bedroom on the eleventh floor with a long view north across the Lagos skyline. Ideal for a professional couple or a pied-à-terre. Concierge on the ground floor, secure basement parking, and a rooftop terrace shared between only eight units.',
    'apartment', 'sale', 'published',
    295000000, 'NGN', 'Nigeria', 'Lagos', 'Victoria Island', 'Ozumba Mbadiwe Avenue', 6.4281, 3.4219,
    2, 2, 3, 112, 2022, 1, false,
    array['ESTARA_SEED','Air conditioning','Elevator','24/7 security','CCTV','Backup generator','Balcony','Parking space'],
    now() - interval '16 days', 174)
  returning id into p_vi;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    bedrooms, bathrooms, toilets, floor_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent1_id,
    'Renovated 4-Bedroom Family House in Magodo GRA',
    'A proper family house on a wide, tree-lined street in Magodo Phase 2. Fully renovated last year: new roof, rewired throughout, new plumbing and a reworked kitchen that now opens onto the back garden. Four good bedrooms upstairs, a study downstairs that could be a fifth, and a walled garden big enough for a trampoline and a mango tree that was already there.',
    'house', 'sale', 'published',
    215000000, 'NGN', 'Nigeria', 'Lagos', 'Magodo', 'Magodo GRA Phase 2',
    4, 4, 5, 320, 2008, 3, false,
    array['ESTARA_SEED','Garden','Borehole / water supply','Backup generator','Gated estate','Fitted kitchen','Parking space','Boys'' quarters'],
    now() - interval '25 days', 331);

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    bedrooms, bathrooms, toilets, floor_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent1_id,
    'Studio Apartment in Yaba, Walk to Tech Cluster',
    'A well-planned studio five minutes'' walk from the Yaba tech cluster. Small, but designed properly: a real kitchen rather than a kitchenette, a separate shower room, and a window that actually opens onto air rather than a light well. Rent is inclusive of water and estate security.',
    'apartment', 'rent', 'published',
    2400000, 'NGN', 'Nigeria', 'Lagos', 'Yaba', 'Herbert Macaulay Way',
    1, 1, 1, 38, 2020, 0, true,
    array['ESTARA_SEED','Air conditioning','24/7 security','Backup generator','Fitted kitchen'],
    now() - interval '2 days', 98)
  returning id into p_yaba;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    land_area, parking_spaces, furnished, features, published_at, view_count)
  values (agent1_id,
    '1,200 sqm Residential Plot in Ajah, Governor''s Consent',
    'A dry, fully fenced 1,200 sqm plot in a developing residential pocket off the Lekki-Epe expressway at Ajah. Governor''s consent in place and survey available for inspection. Road access is tarred to the estate gate. Suited to a single large home or two semi-detached units subject to estate rules.',
    'land', 'sale', 'published',
    68000000, 'NGN', 'Nigeria', 'Lagos', 'Ajah', 'Off Lekki-Epe Expressway',
    1200, 0, false,
    array['ESTARA_SEED','Gated estate','24/7 security'],
    now() - interval '31 days', 156)
  returning id into p_ajah_land;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    floor_area, year_built, parking_spaces, furnished, features, published_at, view_count)
  values (agent1_id,
    'Open-Plan Office Floor in Ikeja GRA',
    'An entire 340 sqm floor in a low-rise office building in Ikeja GRA, available on a three-year lease. Currently fitted as open plan with two glazed meeting rooms and a small server room. Dedicated 60 KVA generator, three-phase power, and eight parking bays allocated to the floor.',
    'office', 'lease', 'published',
    38000000, 'NGN', 'Nigeria', 'Lagos', 'Ikeja', 'Oduduwa Crescent, Ikeja GRA',
    340, 2015, 8, false,
    array['ESTARA_SEED','Air conditioning','Backup generator','Elevator','24/7 security','CCTV','Parking space'],
    now() - interval '12 days', 87)
  returning id into p_ikeja_office;

  -- A draft and a pending listing so the agent + admin queues aren't empty.
  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city,
    bedrooms, bathrooms, toilets, floor_area, parking_spaces, furnished, features)
  values (agent1_id,
    'Unfinished Draft — 3-Bedroom Terrace in Surulere',
    'Draft listing kept deliberately incomplete to demonstrate the save-and-finish-later flow in the listing wizard. A three-bedroom terrace in Surulere, details still being confirmed with the owner.',
    'house', 'sale', 'draft',
    92000000, 'NGN', 'Nigeria', 'Lagos', 'Surulere',
    3, 3, 4, 190, 1, false,
    array['ESTARA_SEED','Parking space'])
  returning id into p_draft;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    bedrooms, bathrooms, toilets, floor_area, year_built, parking_spaces, furnished, features)
  values (agent1_id,
    '4-Bedroom Semi-Detached House in Ikoyi (Awaiting Review)',
    'Submitted and waiting on moderation, so the admin review queue has something real in it. A four-bedroom semi-detached house on a quiet Ikoyi street, recently repainted, with a small pool and a self-contained BQ at the rear. All rooms en-suite, fitted kitchen, and a generator that runs the whole house rather than selected circuits.',
    'house', 'rent', 'pending_review',
    35000000, 'NGN', 'Nigeria', 'Lagos', 'Ikoyi', 'Glover Road',
    4, 5, 5, 380, 2013, 2, false,
    array['ESTARA_SEED','Swimming pool','Backup generator','Borehole / water supply','24/7 security','Fitted kitchen','Boys'' quarters','Garden'])
  returning id into p_pending;

  -- ============================ ABUJA & OTHER (agent2) ======================
  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address, latitude, longitude,
    bedrooms, bathrooms, toilets, floor_area, land_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent2_id,
    '6-Bedroom Detached Mansion in Maitama',
    'A substantial detached house on nearly half a hectare in Maitama, set well back behind mature trees. Six bedrooms, all en-suite, with a separate guest wing and staff quarters at the rear. Formal and family living rooms, a dining room that seats fourteen, and a covered terrace overlooking the lawn. Solar array supplements the generator, so the house runs quietly most evenings.',
    'house', 'sale', 'published',
    980000000, 'NGN', 'Nigeria', 'Abuja (FCT)', 'Maitama', 'Gana Street', 9.0870, 7.4951,
    6, 7, 8, 780, 4500, 2016, 6, false,
    array['ESTARA_SEED','Garden','Solar power','Backup generator','Borehole / water supply','24/7 security','CCTV','Gated estate','Fitted kitchen','Boys'' quarters','Parking space'],
    now() - interval '6 days', 267)
  returning id into p_maitama;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    bedrooms, bathrooms, toilets, floor_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent2_id,
    '3-Bedroom Terraced Duplex in Gwarinpa',
    'A tidy three-bedroom terrace in one of Gwarinpa''s better-maintained estates. Sensible layout — living and kitchen downstairs, all bedrooms up — with a small paved yard at the back for parking two cars. Estate has its own transformer, borehole and a manned gate. Good value for a first family home in Abuja.',
    'house', 'rent', 'published',
    6500000, 'NGN', 'Nigeria', 'Abuja (FCT)', 'Gwarinpa', '3rd Avenue, Gwarinpa Estate',
    3, 3, 4, 210, 2012, 2, false,
    array['ESTARA_SEED','Borehole / water supply','24/7 security','Gated estate','Parking space','Fitted kitchen'],
    now() - interval '14 days', 143)
  returning id into p_gwarinpa;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    bedrooms, bathrooms, toilets, floor_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent2_id,
    'Riverside 4-Bedroom House in Port Harcourt GRA',
    'A calm four-bedroom house in Old GRA, Port Harcourt, backing onto a stretch of the creek. The garden runs down to a low wall at the water, and the back of the house is almost entirely glazed to take advantage of it. Recently re-roofed; the generator house and borehole are both newly installed.',
    'house', 'sale', 'published',
    185000000, 'NGN', 'Nigeria', 'Rivers', 'Port Harcourt', 'Old GRA Phase 2',
    4, 4, 5, 330, 2010, 3, false,
    array['ESTARA_SEED','Garden','Sea view','Borehole / water supply','Backup generator','24/7 security','Fitted kitchen'],
    now() - interval '20 days', 121)
  returning id into p_ph;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    bedrooms, bathrooms, toilets, floor_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent2_id,
    'Colonial 3-Bedroom Bungalow in Bodija, Ibadan',
    'A 1960s bungalow in Old Bodija with the high ceilings and deep verandas of the period, on a large mature plot. Structurally sound and lived in until recently; it would reward sympathetic modernisation rather than demolition. Three bedrooms, a wide central hall, and a detached kitchen block that could be brought into the main house.',
    'house', 'sale', 'published',
    74000000, 'NGN', 'Nigeria', 'Oyo', 'Ibadan', 'Old Bodija',
    3, 2, 3, 240, 1968, 2, false,
    array['ESTARA_SEED','Garden','Borehole / water supply','Parking space'],
    now() - interval '38 days', 76)
  returning id into p_ibadan;

  -- ============================ CAPE TOWN (agent3) ==========================
  -- agent3 is pending verification, so their listings sit unpublished. Verify
  -- the agent from the admin panel to see them enter the publishing flow.
  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address, latitude, longitude,
    bedrooms, bathrooms, toilets, floor_area, land_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent3_id,
    'Camps Bay Villa with Atlantic and Twelve Apostles Views',
    'Built into the slope above Camps Bay, this villa faces the Atlantic on one side and the Twelve Apostles on the other. Four bedrooms across two levels, the main suite opening directly onto the pool deck. Glass folds away entirely along the living wing, so in summer the inside and the terrace become one room. Sunsets here are the reason people buy in Camps Bay.',
    'house', 'sale', 'published',
    38500000, 'ZAR', 'South Africa', 'Western Cape', 'Camps Bay', 'Theresa Avenue', -33.9550, 18.3776,
    4, 4, 5, 420, 900, 2018, 3, true,
    array['ESTARA_SEED','Sea view','Mountain view','Swimming pool','24/7 security','CCTV','Fitted kitchen','Balcony','Garden','Parking space'],
    now() - interval '7 days', 358)
  returning id into p_camps;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    bedrooms, bathrooms, toilets, floor_area, land_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent3_id,
    'Cape Dutch Homestead on a Constantia Wine Estate',
    'A restored Cape Dutch homestead on two hectares in Upper Constantia, with established vines on the lower terrace and oaks along the drive. The gables and yellowwood floors are original; the kitchen and bathrooms are not, and are all the better for it. Five bedrooms in the main house plus a two-bedroom cottage currently let on a long lease.',
    'house', 'sale', 'published',
    62000000, 'ZAR', 'South Africa', 'Western Cape', 'Constantia', 'Klein Constantia Road',
    5, 5, 6, 610, 20000, 1804, 6, false,
    array['ESTARA_SEED','Mountain view','Garden','Swimming pool','Pet friendly','24/7 security','Fitted kitchen','Parking space'],
    now() - interval '18 days', 244)
  returning id into p_constantia;

  insert into properties (agent_id, title, description, property_type, listing_type, status,
    price, currency, country, state_region, city, address,
    bedrooms, bathrooms, toilets, floor_area, year_built, parking_spaces,
    furnished, features, published_at, view_count)
  values (agent3_id,
    'Sea Point Apartment on the Promenade',
    'A two-bedroom apartment directly on the Sea Point promenade, third floor, with the ocean filling both bedroom windows. The building is 1960s and unapologetic about it — good bones, generous room sizes, parquet floors. Secure parking bay and a caretaker on site. Walk to everything on Main Road.',
    'apartment', 'rent', 'published',
    32000, 'ZAR', 'South Africa', 'Western Cape', 'Sea Point', 'Beach Road',
    2, 2, 2, 96, 1967, 1, true,
    array['ESTARA_SEED','Sea view','Elevator','24/7 security','Parking space','Pet friendly'],
    now() - interval '3 days', 188)
  returning id into p_seapoint;

  -- ---------------------------------------------------------------------------
  -- 3. Images
  --    The three JPGs shipped in /public/properties are reused across listings
  --    so every seeded card has a cover. Real listings upload to the
  --    property-images bucket via the wizard.
  -- ---------------------------------------------------------------------------
  insert into property_images (property_id, storage_path, public_url, alt_text, sort_order, is_primary)
  values
    (p_ikoyi,        'seed/atlantic-villa.jpg',   '/properties/atlantic-villa.jpg',   'Waterfront duplex exterior at dusk', 0, true),
    (p_ikoyi,        'seed/city-apartment.jpg',   '/properties/city-apartment.jpg',   'Open-plan living room',              1, false),
    (p_ikoyi,        'seed/vineyard-estate.jpg',  '/properties/vineyard-estate.jpg',  'Garden and terrace',                 2, false),
    (p_lekki,        'seed/city-apartment.jpg',   '/properties/city-apartment.jpg',   'Serviced apartment living area',     0, true),
    (p_lekki,        'seed/atlantic-villa.jpg',   '/properties/atlantic-villa.jpg',   'Balcony view',                       1, false),
    (p_vi,           'seed/city-apartment.jpg',   '/properties/city-apartment.jpg',   'Apartment interior with skyline',    0, true),
    (p_yaba,         'seed/city-apartment.jpg',   '/properties/city-apartment.jpg',   'Studio interior',                    0, true),
    (p_ajah_land,    'seed/vineyard-estate.jpg',  '/properties/vineyard-estate.jpg',  'Fenced residential plot',            0, true),
    (p_ikeja_office, 'seed/city-apartment.jpg',   '/properties/city-apartment.jpg',   'Open-plan office floor',             0, true),
    (p_pending,      'seed/atlantic-villa.jpg',   '/properties/atlantic-villa.jpg',   'Semi-detached house frontage',       0, true),
    (p_maitama,      'seed/vineyard-estate.jpg',  '/properties/vineyard-estate.jpg',  'Detached mansion and lawn',          0, true),
    (p_maitama,      'seed/atlantic-villa.jpg',   '/properties/atlantic-villa.jpg',   'Covered terrace',                    1, false),
    (p_gwarinpa,     'seed/city-apartment.jpg',   '/properties/city-apartment.jpg',   'Terraced duplex interior',           0, true),
    (p_ph,           'seed/atlantic-villa.jpg',   '/properties/atlantic-villa.jpg',   'Riverside house from the garden',    0, true),
    (p_ibadan,       'seed/vineyard-estate.jpg',  '/properties/vineyard-estate.jpg',  'Bungalow veranda',                   0, true),
    (p_camps,        'seed/atlantic-villa.jpg',   '/properties/atlantic-villa.jpg',   'Camps Bay villa above the Atlantic', 0, true),
    (p_camps,        'seed/city-apartment.jpg',   '/properties/city-apartment.jpg',   'Living wing with folding glass',     1, false),
    (p_constantia,   'seed/vineyard-estate.jpg',  '/properties/vineyard-estate.jpg',  'Cape Dutch homestead and vines',     0, true),
    (p_constantia,   'seed/atlantic-villa.jpg',   '/properties/atlantic-villa.jpg',   'Oak-lined drive',                    1, false),
    (p_seapoint,     'seed/city-apartment.jpg',   '/properties/city-apartment.jpg',   'Apartment facing the promenade',     0, true);

  -- ---------------------------------------------------------------------------
  -- 4. Engagement — favourites, inquiries, a thread, a report
  -- ---------------------------------------------------------------------------
  insert into favorites (user_id, property_id) values
    (customer_pid,  p_ikoyi),
    (customer_pid,  p_lekki),
    (customer_pid,  p_camps),
    (customer2_pid, p_maitama),
    (customer2_pid, p_gwarinpa)
  on conflict do nothing;

  insert into property_views (user_id, property_id, viewed_at) values
    (customer_pid, p_ikoyi,  now() - interval '3 hours'),
    (customer_pid, p_vi,     now() - interval '1 day'),
    (customer_pid, p_camps,  now() - interval '2 days')
  on conflict (user_id, property_id) do nothing;

  insert into inquiries (property_id, customer_id, agent_id, subject, message, status, created_at)
  values (
    p_lekki, customer_pid, agent1_id,
    'Inquiry about 3-Bedroom Serviced Apartment in Lekki Phase 1',
    'Good afternoon. I am interested in this apartment and would like to view it this week if possible. Could you confirm what the service charge covers and whether the rent is negotiable for a two-year commitment? I am available Thursday or Friday afternoon.',
    'responded', now() - interval '3 days'
  );

  insert into inquiry_messages (inquiry_id, sender_id, body, created_at)
  select i.id, (select profile_id from agents where id = agent1_id),
    'Good afternoon Amara. Thank you for reaching out. The service charge covers estate security, the generator, water treatment and cleaning of the common areas — it is billed annually and is currently 1.8m. The landlord will consider a reduction for a two-year term. Friday at 3pm works well for a viewing if that suits you.',
    now() - interval '2 days'
  from inquiries i where i.property_id = p_lekki and i.customer_id = customer_pid;

  insert into inquiries (property_id, customer_id, agent_id, subject, message, status, created_at)
  values (
    p_ikoyi, customer2_pid, agent1_id,
    'Inquiry about 5-Bedroom Waterfront Duplex in Banana Island',
    'Hello, could you tell me whether the price is negotiable and if the property comes with the furniture shown in the photographs? I would also like to know the annual service charge for the estate.',
    'new', now() - interval '9 hours'
  );

  insert into inquiries (property_id, customer_id, agent_id, subject, message, status, created_at)
  values (
    p_maitama, customer_pid, agent2_id,
    'Inquiry about 6-Bedroom Detached Mansion in Maitama',
    'I represent a family relocating to Abuja in the first quarter. Is the property available for a viewing in the next two weeks, and would the owner consider a sale with a delayed completion?',
    'read', now() - interval '5 days'
  );

  insert into reports (reporter_id, property_id, reason, description, status, created_at)
  values (
    customer2_pid, p_ibadan,
    'Incorrect or misleading details',
    'The listing says the bungalow was built in 1968 but the photographs appear to show a much newer building. Worth checking with the owner before this misleads anyone.',
    'open', now() - interval '1 day'
  );

  raise notice 'Estara demo seed complete. Logins: demo.customer@estara.test / demo.agent@estara.test / demo.admin@estara.test — password EstaraDemo!2026';
end
$seed$;

drop function if exists seed_user(text, text, jsonb);

commit;
