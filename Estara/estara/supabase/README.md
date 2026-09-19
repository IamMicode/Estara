# Estara — backend setup

The Estara marketplace runs on **your own Supabase project**. Nothing here is mocked: auth is Supabase Auth, data lives in Postgres, and every authorization rule is enforced by Row Level Security in the database rather than by the React app.

You need to do four things: create the project, run the migrations, create the storage buckets, and put the two public keys into `.env.local`.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your users (`eu-west-2` / `eu-central-1` are the usual picks for Nigeria).
3. Save the database password somewhere safe — you won't need it for the app, but you'll want it later.

Wait for the project to finish provisioning before continuing.

---

## 2. Run the migrations

Open **SQL Editor** in the Supabase dashboard and run these files **in order**, one at a time, waiting for each to succeed:

| Order | File | What it does |
|-------|------|--------------|
| 1 | `migrations/0001_schema.sql` | Extensions, enums, 11 tables, indexes, triggers, the `handle_new_user` signup hook, notification triggers, `increment_property_view` RPC. |
| 2 | `migrations/0002_rls.sql` | Enables RLS on every table and installs all policies, the `is_admin`/`current_agent_id` helpers, the guard triggers, and the `public_agents` view. |
| 3 | `migrations/0003_storage.sql` | Creates the `property-images` and `avatars` buckets and their object-level policies. |
| 4 | `migrations/0004_seed.sql` | **Optional.** Demo accounts and listings. See below. |

All four files are **idempotent** — tables, indexes, triggers, policies and enums are all guarded, and the seed skips itself if it has already been applied. Re-running any of them is safe.

### Applying them from the command line instead

If you'd rather not paste into the dashboard, grab the **Session pooler** connection string from Settings → Database and run:

```bash
export DATABASE_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres'
node supabase/tests/run_migrations.cjs \
  supabase/migrations/0001_schema.sql \
  supabase/migrations/0002_rls.sql \
  supabase/migrations/0003_storage.sql \
  supabase/migrations/0004_seed.sql
```

### About the seed data

`0004_seed.sql` is clearly marked and entirely optional. It creates:

**Demo logins** — password `EstaraDemo!2026` for all of them:

| Role | Email | Notes |
|------|-------|-------|
| Customer | `demo.customer@estara.test` | Has saved properties, inquiries and view history |
| Customer | `demo.customer2@estara.test` | Second customer, so agent inbox isn't single-threaded |
| Agent | `demo.agent@estara.test` | **Verified** — can publish immediately |
| Agent | `demo.agent2@estara.test` | Verified, Abuja/Port Harcourt listings |
| Agent | `demo.agent3@estara.test` | **Pending verification** — sits in the admin queue |
| Admin | `demo.admin@estara.test` | Full moderation access |

**Listings** — 16 realistic properties across Lagos (Ikoyi, Lekki, Victoria Island, Magodo, Yaba, Ajah, Ikeja), Abuja, Port Harcourt, Ibadan and Cape Town (Camps Bay, Constantia, Sea Point), including one draft and one awaiting review so the agent and admin queues have real work in them. Plus favourites, a two-message inquiry thread, and an open report.

To remove all of it later, run `seed_teardown.sql`. It deletes only seeded rows.

> **Note on the admin account.** By design, `handle_new_user()` clamps any self-registration to `customer` or `agent` — nobody can sign up as an admin through the app. The seed promotes one account to admin with a direct SQL `UPDATE`, which is the only way an admin can be created. To make yourself an admin on a real project, run:
> ```sql
> update profiles set role = 'admin' where email = 'you@example.com';
> ```

---

## 3. Check the storage buckets

`0003_storage.sql` creates them, but confirm under **Storage** that you have:

- **`property-images`** — public read, 5 MB limit, `image/jpeg|png|webp|avif`
- **`avatars`** — 2 MB limit

Uploads are authorized by path convention: a property photo must be written to `property-images/<property_id>/<filename>`, and the policy joins that first path segment back to `properties.agent_id` to confirm the uploader owns the listing. The app already does this — just don't change the path format.

---

## 4. Configure the app

In the dashboard go to **Project Settings → API** and copy the **Project URL** and the **anon / public** key.

Create `/home/user/estara/.env.local`:

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Then restart the dev server (Vite only reads env files at startup):

```bash
npm run dev
```

The yellow "Demo mode — no database connected" banner disappears once the keys are picked up.

> **Only ever use the anon key in the client.** It's designed to be public — it's inert without a valid session because RLS decides what each request can see. The `service_role` key bypasses RLS entirely and must never appear in this repository or in any file shipped to the browser.

---

## 5. Auth settings worth checking

Under **Authentication → Providers → Email**:

- **Confirm email** — on by default. Keep it on for production. With it on, registration shows a "check your inbox" screen instead of signing the user straight in. Turn it off in development if you'd rather skip the round trip.
- **Site URL** — set to your dev origin (e.g. `http://localhost:5173`) so password-reset links come back to the right place.
- **Redirect URLs** — add `http://localhost:5173/reset-password` and `http://localhost:5173/login`.

---

## How authorization actually works

Worth understanding before you change anything, because the React route guards are *not* the security boundary — they're a UX affordance. Bypassing them in the browser gets you an empty page, not data.

The real rules live in Postgres:

- **Roles can't be escalated.** `guard_profile_self_update` blocks a user changing their own `role` or `status`.
- **Agents can't verify themselves.** `guard_agent_verification` only allows `not_started|rejected → pending`. Only an admin can write `verified`.
- **Agents can't publish themselves.** `guard_property_status` limits agent transitions to `draft|rejected → pending_review`, `pending_review → draft`, `published → archived|sold|rented`, and `archived|sold|rented → draft`. `published` is reachable only by an admin.
- **Only verified agents can create listings** — enforced in the INSERT policy on `properties`.
- **Agents only see their own rows.** Every agent-scoped policy filters on `current_agent_id()`.
- **The public never reads `profiles`.** Anonymous visitors get agent identity through the `public_agents` view, which exposes only safe columns.
- **Suspended accounts are blocked** by `is_active()` in the policies, not just by the UI.

### Verifying it yourself

There's a real test suite for this. It impersonates each role the same way PostgREST does (`set role` + `request.jwt.claims`), so it exercises the actual policies a browser request would hit. Every assertion runs in a rolled-back transaction, so it's safe against seeded data:

```bash
DATABASE_URL='postgresql://...' node supabase/tests/authorization.test.cjs
```

Current result against this schema: **38 passed, 0 failed**, covering anonymous, customer, verified agent, unverified agent, admin and suspended-user cases — including that an agent cannot approve their own listing, cannot edit another agent's listing, and cannot self-verify; that a customer cannot escalate to admin or publish anything; that anonymous visitors cannot read `profiles`; and that suspended accounts can neither favourite nor send inquiries.

> **Note on the guard triggers.** They intentionally allow trusted server-side SQL (where `auth.uid()` is null) to pass through. They exist to constrain *client* requests; a connection already holding the service role isn't something they can meaningfully defend against, and blocking it would break migrations, seeding and admin tooling.
