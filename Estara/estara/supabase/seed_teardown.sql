-- =============================================================================
-- ESTARA — REMOVE ALL DEMO SEED DATA
--
-- Deletes everything created by 0004_seed.sql and nothing else. Real accounts
-- and real listings are untouched.
--
-- Seed data is identified two ways:
--   • auth.users where raw_user_meta_data->>'seed' = 'estara_demo'
--   • properties carrying the 'ESTARA_SEED' feature tag
--
-- Deleting the auth users cascades through profiles → agents → properties →
-- images / favourites / inquiries / reports / notifications, provided the
-- foreign keys in 0001_schema.sql are on delete cascade (they are).
-- =============================================================================

begin;

-- Belt and braces: drop tagged properties first in case an admin re-parented one.
delete from properties where 'ESTARA_SEED' = any (features);

delete from auth.users
where raw_user_meta_data->>'seed' = 'estara_demo';

commit;
