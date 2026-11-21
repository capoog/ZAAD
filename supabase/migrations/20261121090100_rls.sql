-- =============================================================================
-- Row Level Security — enabled on EVERY table in public.
--
-- Model:
--   * anon / customers can read the public menu, zones, hours, offers,
--     published reviews and public settings.
--   * customers can read their own profile, addresses and orders.
--   * orders, order items and payments are NEVER inserted or updated by
--     clients directly: the server recalculates prices and writes them with a
--     privileged connection. There are deliberately no client insert policies.
--   * staff (owner/manager/kitchen/driver) can read operational data;
--     owner/manager can manage the menu and settings; only owners manage roles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies don't recurse through user_roles)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(role text) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role_key = role
  )
$$;

create or replace function public.is_staff() returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = auth.uid())
$$;

create or replace function public.is_manager() returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role_key in ('owner', 'manager')
  )
$$;

create or replace function public.can_see_order(target uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = target
      and (
        o.user_id = auth.uid()
        or exists (
          select 1 from public.user_roles ur
          where ur.user_id = auth.uid() and ur.role_key in ('owner', 'manager', 'kitchen')
        )
        or (o.assigned_driver_id = auth.uid())
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.roles                  enable row level security;
alter table public.user_roles             enable row level security;
alter table public.categories             enable row level security;
alter table public.menu_items             enable row level security;
alter table public.item_sizes             enable row level security;
alter table public.addon_groups           enable row level security;
alter table public.addons                 enable row level security;
alter table public.menu_item_addon_groups enable row level security;
alter table public.delivery_zones         enable row level security;
alter table public.opening_hours          enable row level security;
alter table public.settings               enable row level security;
alter table public.addresses              enable row level security;
alter table public.promo_codes            enable row level security;
alter table public.offers                 enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.order_item_addons      enable row level security;
alter table public.order_status_history   enable row level security;
alter table public.payments               enable row level security;
alter table public.reviews                enable row level security;
alter table public.notification_log       enable row level security;
alter table public.rate_limits            enable row level security;  -- no policies: server only

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: staff read" on public.profiles
  for select to authenticated using (public.is_staff());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- roles / user_roles
-- ---------------------------------------------------------------------------
create policy "roles: authenticated read" on public.roles
  for select to authenticated using (true);

create policy "user_roles: read own" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "user_roles: managers read" on public.user_roles
  for select to authenticated using (public.is_manager());
create policy "user_roles: owners insert" on public.user_roles
  for insert to authenticated with check (public.has_role('owner'));
create policy "user_roles: owners delete" on public.user_roles
  for delete to authenticated using (public.has_role('owner'));

-- ---------------------------------------------------------------------------
-- Public catalogue: categories, menu_items, item_sizes, addon_groups, addons,
-- menu_item_addon_groups, delivery_zones, opening_hours, offers
-- ---------------------------------------------------------------------------
create policy "categories: public read active" on public.categories
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "categories: managers write" on public.categories
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "menu_items: public read active" on public.menu_items
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "menu_items: managers write" on public.menu_items
  for all to authenticated using (public.is_manager()) with check (public.is_manager());
-- Kitchen staff toggle "sold out" through a server action that only touches
-- that column, so there is deliberately no kitchen update policy here.

create policy "item_sizes: public read" on public.item_sizes
  for select to anon, authenticated using (true);
create policy "item_sizes: managers write" on public.item_sizes
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "addon_groups: public read" on public.addon_groups
  for select to anon, authenticated using (true);
create policy "addon_groups: managers write" on public.addon_groups
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "addons: public read" on public.addons
  for select to anon, authenticated using (true);
create policy "addons: managers write" on public.addons
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "menu_item_addon_groups: public read" on public.menu_item_addon_groups
  for select to anon, authenticated using (true);
create policy "menu_item_addon_groups: managers write" on public.menu_item_addon_groups
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "delivery_zones: public read active" on public.delivery_zones
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "delivery_zones: managers write" on public.delivery_zones
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "opening_hours: public read" on public.opening_hours
  for select to anon, authenticated using (true);
create policy "opening_hours: managers write" on public.opening_hours
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "offers: public read live" on public.offers
  for select to anon, authenticated using (
    (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or public.is_staff()
  );
create policy "offers: managers write" on public.offers
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------
create policy "settings: public keys" on public.settings
  for select to anon, authenticated using (is_public or public.is_staff());
create policy "settings: managers write" on public.settings
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- addresses (owner only)
-- ---------------------------------------------------------------------------
create policy "addresses: own read" on public.addresses
  for select to authenticated using (user_id = auth.uid());
create policy "addresses: own insert" on public.addresses
  for insert to authenticated with check (user_id = auth.uid());
create policy "addresses: own update" on public.addresses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "addresses: own delete" on public.addresses
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- promo_codes (validated by the server; only managers can list them)
-- ---------------------------------------------------------------------------
create policy "promo_codes: managers" on public.promo_codes
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- orders & children — read-only for clients; writes go through the server
-- ---------------------------------------------------------------------------
create policy "orders: customer reads own" on public.orders
  for select to authenticated using (user_id = auth.uid());
create policy "orders: kitchen & managers read" on public.orders
  for select to authenticated using (
    public.is_manager() or public.has_role('kitchen')
  );
create policy "orders: driver reads assigned" on public.orders
  for select to authenticated using (assigned_driver_id = auth.uid() and public.has_role('driver'));
-- No client update policy: status changes go through a server action that
-- validates the transition and the caller's role, so a staff JWT can never be
-- used to rewrite totals or payment state via the REST API.

create policy "order_items: visible with order" on public.order_items
  for select to authenticated using (public.can_see_order(order_id));

create policy "order_item_addons: visible with order" on public.order_item_addons
  for select to authenticated using (
    exists (select 1 from public.order_items oi where oi.id = order_item_id and public.can_see_order(oi.order_id))
  );

create policy "order_status_history: visible with order" on public.order_status_history
  for select to authenticated using (public.can_see_order(order_id));

create policy "payments: visible with order" on public.payments
  for select to authenticated using (public.can_see_order(order_id));
-- Payments are only ever marked paid by the server (verified Paymob webhook,
-- or a manager confirming InstaPay through a server action).

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create policy "reviews: public read published" on public.reviews
  for select to anon, authenticated using (is_published);
create policy "reviews: own read" on public.reviews
  for select to authenticated using (user_id = auth.uid());
create policy "reviews: managers" on public.reviews
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- notification_log (managers only)
-- ---------------------------------------------------------------------------
create policy "notification_log: managers read" on public.notification_log
  for select to authenticated using (public.is_manager());

-- rate_limits: intentionally no policies — only the server (service role) uses it.
