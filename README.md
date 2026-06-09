# Attendance Payroll SaaS

Modular React + TypeScript multi-tenant attendance and payroll drafting app, ready for Cloudflare Pages deployment.

## Run locally

1. Install dependencies:
   npm install
2. Start development server:
   npm run dev

## Build

- npm run build

## Environment mode

1. Copy `.env.example` to `.env` for local development.
2. Set `VITE_SANDBOX_MODE=true` to show sandbox quick-login buttons.
3. Set `VITE_SANDBOX_MODE=false` for production behavior without quick-login shortcuts.

## Cloudflare D1 setup

1. Create D1 database once:
   `wrangler d1 create attendance-payroll-d1`
2. Copy the returned `database_id` into `wrangler.toml` under `[[d1_databases]]`.
3. Apply migrations locally:
   `npm run d1:migrate:local`
4. Apply migrations remotely:
   `npm run d1:migrate:remote`

Migrations are located in `migrations/`:
- `0001_init.sql` creates schema
- `0002_seed.sql` seeds initial data
- `0003_attendance_controls.sql` adds immutable attendance adjustment ledger, correction request workflow tables, and log mutation metadata columns

## Deploy to Cloudflare Pages

1. Login to Cloudflare:
   npx wrangler login
2. Build and deploy:
   npm run deploy

This deploy command runs:
- vite build
- wrangler pages deploy dist --project-name attendance-payroll-saas

If the Pages project does not exist yet, create it once in Cloudflare Dashboard with:
- Framework preset: Vite
- Build command: npm run build
- Build output directory: dist

## Project structure

- src/admin: Super Admin desktop portal modules
- src/client: Mobile-forced Employer and Employee modules
- src/shared: Domain types, payroll engine, and seed data
- src/App.tsx: Unified auth, role routing, and tenant session controls
- functions/api: Cloudflare Pages Functions API endpoints for login and tenant-safe commands
- functions/_lib: D1 query helpers and tenant scope enforcement
