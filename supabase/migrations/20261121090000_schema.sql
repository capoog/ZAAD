-- =============================================================================
-- Fahm & Zaatar — core schema
-- Money is stored as integer piasters (1 EGP = 100 piasters). Never floats.
-- All timestamps are timestamptz; business logic uses Africa/Cairo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.fulfillment_type as enum ('delivery', 'pickup');

create type public.order_status as enum (
  'pending_payment',   -- online / InstaPay payment not confirmed yet (hidden from kitchen)
  'received',
  'preparing',
  'ready_for_pickup',  -- pickup orders only
  'out_for_delivery',  -- delivery orders only
  'delivered',         -- final state for both (pickup = collected)
  'cancelled'
);

create type public.payment_method as enum ('cash', 'card', 'wallet', 'fawry', 'valu', 'instapay');
create type public.payment_provider as enum ('cod', 'paymob', 'instapay');
create type public.payment_status as enum (
  'unpaid', 'pending', 'pending_review', 'paid', 'failed', 'refunded', 'cancelled'
);
create type public.discount_type as enum ('percent', 'fixed');
create type public.notification_status as enum ('queued', 'sent', 'mocked', 'failed');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- People & roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text check (char_length(full_name) <= 80),
  phone            text unique check (phone ~ '^01[0125][0-9]{8}$'),
  email            text check (char_length(email) <= 254),
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar', 'en')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.roles (
  key         text primary key check (key in ('owner', 'manager', 'kitchen', 'driver')),
  name_ar     text not null,
  name_en     text not null,
  description text,
  rank        smallint not null  -- lower = more privileged
);

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_key   text not null references public.roles (key) on delete restrict,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_key)
);
create index user_roles_role_idx on public.user_roles (role_key);

-- Every auth user gets a profile row automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, phone, full_name)
  values (
    new.id,
    new.email,
    case
      when new.phone ~ '^01[0125][0-9]{8}$' then new.phone
      when new.phone ~ '^\+?201[0125][0-9]{8}$' then '0' || right(new.phone, 10)
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_ar        text not null check (char_length(name_ar) between 1 and 60),
  name_en        text not null check (char_length(name_en) between 1 and 60),
  description_ar text check (char_length(description_ar) <= 280),
  description_en text check (char_length(description_en) <= 280),
  image_url      text check (char_length(image_url) <= 500),
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.menu_items (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid not null references public.categories (id) on delete restrict,
  slug               text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  name_ar            text not null check (char_length(name_ar) between 1 and 80),
  name_en            text not null check (char_length(name_en) between 1 and 80),
  description_ar     text check (char_length(description_ar) <= 500),
  description_en     text check (char_length(description_en) <= 500),
  -- Price when the item has no sizes. Items with sizes use item_sizes.price_piasters.
  base_price_piasters integer not null check (base_price_piasters between 0 and 10000000),
  image_url          text check (char_length(image_url) <= 500),
  is_spicy           boolean not null default false,
  is_vegetarian      boolean not null default false,
  is_best_seller     boolean not null default false,
  is_featured        boolean not null default false,
  is_sold_out        boolean not null default false,
  is_active          boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index menu_items_category_idx on public.menu_items (category_id, sort_order);
create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

create table public.item_sizes (
  id             uuid primary key default gen_random_uuid(),
  menu_item_id   uuid not null references public.menu_items (id) on delete cascade,
  name_ar        text not null check (char_length(name_ar) between 1 and 40),
  name_en        text not null check (char_length(name_en) between 1 and 40),
  price_piasters integer not null check (price_piasters between 0 and 10000000),
  is_default     boolean not null default false,
  sort_order     integer not null default 0,
  unique (menu_item_id, name_en)
);
create index item_sizes_item_idx on public.item_sizes (menu_item_id, sort_order);
-- At most one default size per item.
create unique index item_sizes_one_default on public.item_sizes (menu_item_id) where is_default;

create table public.addon_groups (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_ar    text not null check (char_length(name_ar) between 1 and 60),
  name_en    text not null check (char_length(name_en) between 1 and 60),
  min_select smallint not null default 0 check (min_select >= 0),
  max_select smallint check (max_select is null or max_select >= 1),  -- null = unlimited
  sort_order integer not null default 0,
  check (max_select is null or max_select >= min_select)
);

create table public.addons (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.addon_groups (id) on delete cascade,
  name_ar        text not null check (char_length(name_ar) between 1 and 60),
  name_en        text not null check (char_length(name_en) between 1 and 60),
  price_piasters integer not null default 0 check (price_piasters between 0 and 1000000),
  is_available   boolean not null default true,
  sort_order     integer not null default 0
);
create index addons_group_idx on public.addons (group_id, sort_order);

-- Which add-on groups are offered on which menu item.
create table public.menu_item_addon_groups (
  menu_item_id   uuid not null references public.menu_items (id) on delete cascade,
  addon_group_id uuid not null references public.addon_groups (id) on delete cascade,
  sort_order     integer not null default 0,
  primary key (menu_item_id, addon_group_id)
);
create index miag_group_idx on public.menu_item_addon_groups (addon_group_id);

-- ---------------------------------------------------------------------------
-- Delivery, hours, settings
-- ---------------------------------------------------------------------------
create table public.delivery_zones (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_ar            text not null check (char_length(name_ar) between 1 and 60),
  name_en            text not null check (char_length(name_en) between 1 and 60),
  fee_piasters       integer not null check (fee_piasters between 0 and 1000000),
  min_order_piasters integer not null default 0 check (min_order_piasters between 0 and 10000000),
  eta_min_minutes    smallint not null check (eta_min_minutes > 0),
  eta_max_minutes    smallint not null,
  is_active          boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (eta_max_minutes >= eta_min_minutes)
);
create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

-- 0 = Sunday … 6 = Saturday (Africa/Cairo local time).
-- closes_at <= opens_at means the shift ends after midnight (e.g. 12:00 → 02:00).
create table public.opening_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  opens_at    time not null,
  closes_at   time not null,
  is_closed   boolean not null default false
);

-- Typed on the server with Zod. is_public rows are readable by anyone
-- (restaurant info, VAT, InstaPay handle); the rest are staff-only.
create table public.settings (
  key        text primary key check (key ~ '^[a-z0-9_.]{2,60}$'),
  value      jsonb not null,
  is_public  boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

create table public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  label      text check (char_length(label) <= 30),
  zone_id    uuid not null references public.delivery_zones (id) on delete restrict,
  street     text not null check (char_length(street) between 2 and 120),
  building   text not null check (char_length(building) between 1 and 30),
  floor      text check (char_length(floor) <= 10),
  apartment  text check (char_length(apartment) <= 10),
  landmark   text check (char_length(landmark) <= 120),
  lat        double precision check (lat between -90 and 90),
  lng        double precision check (lng between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;
create trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------
create table public.promo_codes (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique check (code ~ '^[A-Z0-9_-]{3,24}$'),
  description_ar        text check (char_length(description_ar) <= 200),
  description_en        text check (char_length(description_en) <= 200),
  discount_type         public.discount_type not null,
  -- percent: whole percent (10 = 10%); fixed: piasters
  discount_value        integer not null check (discount_value > 0),
  max_discount_piasters integer check (max_discount_piasters > 0),
  min_subtotal_piasters integer not null default 0 check (min_subtotal_piasters >= 0),
  starts_at             timestamptz,
  ends_at               timestamptz,
  usage_limit           integer check (usage_limit > 0),
  per_phone_limit       integer check (per_phone_limit > 0),
  times_used            integer not null default 0 check (times_used >= 0),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger promo_codes_updated_at before update on public.promo_codes
  for each row execute function public.set_updated_at();

create table public.offers (
  id            uuid primary key default gen_random_uuid(),
  title_ar      text not null check (char_length(title_ar) between 1 and 80),
  title_en      text not null check (char_length(title_en) between 1 and 80),
  subtitle_ar   text check (char_length(subtitle_ar) <= 200),
  subtitle_en   text check (char_length(subtitle_en) <= 200),
  badge_ar      text check (char_length(badge_ar) <= 24),
  badge_en      text check (char_length(badge_en) <= 24),
  image_url     text check (char_length(image_url) <= 500),
  menu_item_id  uuid references public.menu_items (id) on delete set null,
  promo_code_id uuid references public.promo_codes (id) on delete set null,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger offers_updated_at before update on public.offers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          integer generated always as identity (start with 1001) unique,
  -- Unguessable token that lets guests track their own order without logging in.
  tracking_token        text not null unique default replace(gen_random_uuid()::text, '-', ''),
  user_id               uuid references public.profiles (id) on delete set null,
  customer_name         text not null check (char_length(customer_name) between 2 and 80),
  customer_phone        text not null check (customer_phone ~ '^01[0125][0-9]{8}$'),
  fulfillment_type      public.fulfillment_type not null,
  zone_id               uuid references public.delivery_zones (id) on delete restrict,
  -- Address snapshot (Egyptian format) — kept even if the saved address changes later.
  address_street        text check (char_length(address_street) <= 120),
  address_building      text check (char_length(address_building) <= 30),
  address_floor         text check (char_length(address_floor) <= 10),
  address_apartment     text check (char_length(address_apartment) <= 10),
  address_landmark      text check (char_length(address_landmark) <= 120),
  address_lat           double precision check (address_lat between -90 and 90),
  address_lng           double precision check (address_lng between -180 and 180),
  scheduled_for         timestamptz,  -- null = ASAP
  status                public.order_status not null default 'received',
  payment_method        public.payment_method not null default 'cash',
  payment_status        public.payment_status not null default 'unpaid',
  -- Totals are always computed on the server from database prices.
  subtotal_piasters     integer not null check (subtotal_piasters >= 0),
  discount_piasters     integer not null default 0 check (discount_piasters >= 0),
  delivery_fee_piasters integer not null default 0 check (delivery_fee_piasters >= 0),
  vat_piasters          integer not null default 0 check (vat_piasters >= 0),
  total_piasters        integer not null check (total_piasters >= 0),
  vat_rate_bps          integer not null default 1400 check (vat_rate_bps between 0 and 10000),
  prices_include_vat    boolean not null default true,
  promo_code_id         uuid references public.promo_codes (id) on delete set null,
  promo_code            text,
  notes                 text check (char_length(notes) <= 500),
  locale                text not null default 'ar' check (locale in ('ar', 'en')),
  assigned_driver_id    uuid references public.profiles (id) on delete set null,
  cancel_reason         text check (char_length(cancel_reason) <= 200),
  placed_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (fulfillment_type = 'pickup' or (zone_id is not null and address_street is not null and address_building is not null)),
  check (
    total_piasters = subtotal_piasters - discount_piasters + delivery_fee_piasters
      + case when prices_include_vat then 0 else vat_piasters end
  )
);
create index orders_status_idx on public.orders (status, placed_at desc);
create index orders_placed_idx on public.orders (placed_at desc);
create index orders_user_idx on public.orders (user_id, placed_at desc);
create index orders_phone_idx on public.orders (customer_phone, placed_at desc);
create index orders_driver_idx on public.orders (assigned_driver_id) where assigned_driver_id is not null;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id) on delete cascade,
  menu_item_id          uuid references public.menu_items (id) on delete set null,
  size_id               uuid references public.item_sizes (id) on delete set null,
  -- Snapshots so history stays correct when the menu changes.
  name_ar               text not null,
  name_en               text not null,
  size_name_ar          text,
  size_name_en          text,
  unit_price_piasters   integer not null check (unit_price_piasters >= 0),
  addons_unit_piasters  integer not null default 0 check (addons_unit_piasters >= 0),
  quantity              integer not null check (quantity between 1 and 50),
  line_total_piasters   integer not null check (line_total_piasters >= 0),
  notes                 text check (char_length(notes) <= 200),
  check (line_total_piasters = (unit_price_piasters + addons_unit_piasters) * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_menu_item_idx on public.order_items (menu_item_id);

create table public.order_item_addons (
  id             uuid primary key default gen_random_uuid(),
  order_item_id  uuid not null references public.order_items (id) on delete cascade,
  addon_id       uuid references public.addons (id) on delete set null,
  name_ar        text not null,
  name_en        text not null,
  price_piasters integer not null check (price_piasters >= 0)
);
create index order_item_addons_item_idx on public.order_item_addons (order_item_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- The acting user is taken from the JWT (Supabase) or from app.actor_id,
-- which the server sets per transaction.
create or replace function public.current_actor() returns uuid
language sql stable
set search_path = ''
as $$
  select coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid)
$$;

create or replace function public.log_order_status() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, created_at)
    values (new.id, null, new.status, public.current_actor(), new.placed_at);
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, public.current_actor());
  end if;
  return new;
end;
$$;

create trigger orders_status_history
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  provider          public.payment_provider not null,
  method            public.payment_method not null,
  status            public.payment_status not null default 'pending',
  amount_piasters   integer not null check (amount_piasters >= 0),
  currency          text not null default 'EGP' check (currency = 'EGP'),
  provider_ref      text check (char_length(provider_ref) <= 120),       -- e.g. Paymob transaction id
  provider_order_id text check (char_length(provider_order_id) <= 120), -- e.g. Paymob intention / order id
  proof_path        text check (char_length(proof_path) <= 300),        -- InstaPay screenshot (private storage)
  payer_reference   text check (char_length(payer_reference) <= 60),    -- InstaPay sender name / ref typed by customer
  reviewed_by       uuid references public.profiles (id) on delete set null,
  reviewed_at       timestamptz,
  review_note       text check (char_length(review_note) <= 200),
  raw               jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_review_idx on public.payments (status) where status = 'pending_review';
create unique index payments_provider_ref_unique on public.payments (provider, provider_ref) where provider_ref is not null;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reviews, notifications, rate limiting
-- ---------------------------------------------------------------------------
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid unique references public.orders (id) on delete set null,
  user_id       uuid references public.profiles (id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 1 and 60),
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (char_length(comment) <= 600),
  locale        text not null default 'ar' check (locale in ('ar', 'en')),
  is_published  boolean not null default false,
  created_at    timestamptz not null default now()
);
create index reviews_published_idx on public.reviews (is_published, created_at desc);

create table public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references public.orders (id) on delete cascade,
  channel    text not null default 'whatsapp' check (channel in ('whatsapp', 'sms')),
  audience   text not null check (audience in ('customer', 'restaurant')),
  recipient  text not null,
  template   text not null,
  body       text not null,
  provider   text not null,
  status     public.notification_status not null default 'queued',
  error      text,
  created_at timestamptz not null default now()
);
create index notification_log_order_idx on public.notification_log (order_id, created_at);

create table public.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 1,
  primary key (bucket, window_start)
);
