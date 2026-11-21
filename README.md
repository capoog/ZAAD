# فحم وزعتر — Fahm & Zaatar

Premium ordering & delivery site for an Egyptian/Levantine charcoal grill in the Fifth Settlement,
New Cairo. Arabic-first (RTL) + English · Next.js 15 · Supabase (with a zero-config local fallback).

> **Status: Phase 1 of 5** — plan, database schema (with RLS) and design system.
> The storefront, checkout and admin arrive in phases 2–4. See [`docs/PLAN.md`](docs/PLAN.md).

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000  →  /style-guide during phase 1
```

No environment variables are needed: the app uses an embedded Postgres (PGlite) in `.data/`,
applies the migrations and seeds the menu, zones, staff and 15 sample orders on first run.

```bash
npm run db:setup     # migrate + seed explicitly
npm run db:reset     # wipe the local PGlite database and start fresh
npm run db:verify    # 46 checks: schema mirror, RLS for every role, seed invariants
```

To use Supabase instead, fill in `.env.local` from [`.env.example`](.env.example), then
`npm run db:setup` (migrations from `supabase/migrations` are also compatible with `supabase db push`).

## Demo staff accounts

| Role | Email | Password |
|---|---|---|
| Owner | `owner@fahmzaatar.test` | `FahmZaatar@2026` |
| Manager | `manager@fahmzaatar.test` | `FahmZaatar@2026` |
| Kitchen | `kitchen@fahmzaatar.test` | `FahmZaatar@2026` |
| Driver | `driver@fahmzaatar.test` | `FahmZaatar@2026` |

Change these before any real deployment.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | strict TypeScript / ESLint |
| `npm run db:*` | see above |
| `npm run brand:logo` | regenerate the SVG logo (Arabic shaped with HarfBuzz, outlined to paths) |
| `npm run brand:art` | regenerate the dish illustrations in `public/art` |
| `npm run screenshots -- --phase 1 --base http://localhost:3000` | full-page review screenshots |

## Credits

Food photography from [Unsplash](https://unsplash.com) (Unsplash License). Fonts: Reem Kufi and
IBM Plex Sans Arabic (SIL Open Font License).
