-- =============================================================================
-- LOCAL-ONLY auth shim.
--
-- Supabase already provides the `auth` schema, the anon/authenticated/
-- service_role roles and the auth.uid()/auth.jwt() helpers. When the app runs
-- without Supabase (embedded PGlite or a plain local Postgres) this file is
-- applied FIRST so that every migration in supabase/migrations runs unchanged,
-- including all Row Level Security policies.
--
-- Never apply this file to a Supabase project.
-- =============================================================================

create schema if not exists auth;

do $$ begin create role anon nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- Mirror Supabase's default privileges: table access is granted broadly and
-- Row Level Security decides which rows are visible.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  phone              text unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_sign_in_at    timestamptz
);

-- One-time codes for the local (mock SMS) phone login.
create table if not exists auth.local_otp_codes (
  id          bigint generated always as identity primary key,
  phone       text not null,
  code_hash   text not null,
  attempts    smallint not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists local_otp_codes_phone_idx on auth.local_otp_codes (phone, created_at desc);

-- Same semantics as Supabase: claims are read from the request.jwt.* settings
-- that the server sets per transaction.
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;
