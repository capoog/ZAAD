# فحم وزعتر — Fahm & Zaatar

Ordering + delivery site for an Egyptian/Levantine charcoal grill in the Fifth Settlement, New Cairo.
Arabic-first (RTL) + English · Next.js 15 · Supabase, with a zero-config local fallback.

## Quick start

```bash
npm install
npm run build && npm start      # http://localhost:3000   (or: npm run dev)
```

No environment variables are needed. The app uses an embedded Postgres (PGlite) in `.data/`,
applies the migrations and seeds the menu, zones, staff and 15 sample orders on first request.

| URL | What |
|---|---|
| `/` · `/en` | Home (Arabic · English) |
| `/menu` | Menu with search, filters, sticky categories |
| `/cart` → `/checkout` | Cart (promo `WELCOME10`) and checkout |
| `/orders/<token>` | Live order tracking (link shown after ordering) |
| `/orders` | Phone-OTP login, order history, saved addresses |
| `/admin` | Staff dashboard |
| `/style-guide` | Design system |

## Demo staff accounts

| Role | Email | Password |
|---|---|---|
| Owner | `owner@fahmzaatar.test` | `FahmZaatar@2026` |
| Manager | `manager@fahmzaatar.test` | `FahmZaatar@2026` |
| Kitchen | `kitchen@fahmzaatar.test` | `FahmZaatar@2026` |
| Driver | `driver@fahmzaatar.test` | `FahmZaatar@2026` |

Customer login is by phone. In demo mode there is no SMS provider, so the one-time code is shown on screen.
Change all of this before any real deployment.

## Demo-mode behaviour

- **Payments.** Cash on delivery is the default. Card, wallet, Fawry and valU go through a *mock* Paymob
  checkout (`PAYMENT_MODE=mock`). An order becomes "paid" only after an HMAC-verified transaction on the
  server, exactly as with real Paymob. For InstaPay, the customer uploads a transfer screenshot and a manager
  confirms it in **Admin → InstaPay**.
- **WhatsApp.** Messages to the customer on each status change, and new-order alerts to the restaurant, are
  logged (table `notification_log` + server console) instead of sent (`WHATSAPP_PROVIDER=mock`).
- **Opening hours.** Daily 12:00 PM – 2:00 AM, Cairo time. Outside those hours "ASAP" is blocked with a
  message, and customers can schedule for later.
- **Photos.** Dish photos are from Unsplash. Seven dishes without a verified matching free photo use designed
  illustrations; replace them from **Admin → Menu → Edit → Upload image**.

## Going to production (Vercel + Supabase)

1. Create a Supabase project and fill `.env.local` / Vercel env from [`.env.example`](.env.example):
   `DATABASE_URL` (pooled connection string), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`.
2. `npm run db:setup` applies `supabase/migrations` (also compatible with `supabase db push`) and seeds the data.
3. Enable phone auth in Supabase (Twilio/MessageBird, or test numbers) for customer OTP.
4. For real payments: set `PAYMENT_MODE=sandbox|live` plus the `PAYMOB_*` keys, and point Paymob's
   transaction-processed callback to `https://<your-domain>/api/payments/paymob/webhook`.
5. For WhatsApp: set `WHATSAPP_PROVIDER=cloud_api`, `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.

Vercel has no persistent disk, so PGlite is for local/demo use only. Production needs Supabase.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | strict TypeScript / ESLint |
| `npm run db:setup` · `db:migrate` · `db:reset` | migrate + seed · migrate only · wipe local PGlite and reseed |
| `npm run db:verify` | 46 checks: schema mirror, RLS for every role, seed invariants |
| `npm run test:e2e` | Playwright: browse → cart → checkout → admin sees the order (isolated DB) |
| `npm run screenshots -- --phase 2 --base http://localhost:3000` | full-page review screenshots |
| `npm run brand:logo` · `brand:art` · `brand:icons` | regenerate logo, dish illustrations, PWA icons |

## Architecture

See [`docs/PLAN.md`](docs/PLAN.md) for the architecture, schema diagram and Row Level Security model.
In short: SQL migrations are the source of truth, Drizzle is used for typed queries, and every price is
recalculated on the server from the database.

## Credits

Food photography from [Unsplash](https://unsplash.com) (Unsplash License). Map tiles © OpenStreetMap.
Fonts: Reem Kufi and IBM Plex Sans Arabic (SIL Open Font License).
