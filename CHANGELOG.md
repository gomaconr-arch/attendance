# Changelog

## 3.1.0 - 2026-06-09
- Wired app to Cloudflare D1 via Pages Functions with API-first login and mutation command flow.
- Added tenant-safe D1 query layer (`functions/_lib/db.ts`) enforcing org-bound access for non-superadmin actions.
- Added schema and seed migrations (`migrations/0001_init.sql`, `migrations/0002_seed.sql`) for organizations, users, and attendance logs.
- Added command endpoints for tenant provisioning, subscription toggles, employee creation, settings updates, draft finalization, and punch actions.
- Added environment-based sandbox mode (`VITE_SANDBOX_MODE`) so production mode does not require source edits.
- Added `.env.example` and updated README with D1 setup, migration commands, and sandbox mode usage.
- Converted Employer workspace into tabbed sections (`Configuration`, `Team`, `Payroll Draft`, `Logs`).
- Added explicit visual label badge in the Tenant Configuration Panel.
- Converted Employee workspace into tabs (`Clock`, `History`) with a clock-focused first tab.
- Updated Employee first tab to show current Manila date/time, large total pay-period hours, and no estimated pay display.
- Applied comma-separated, two-decimal formatting for money and displayed totals across payroll views.

## 3.0.0 - 2026-06-09
- Added route-based unified login at /login with role redirects for Super Admin, Employer, and Employee views.
- Added tenant lifecycle route protection that terminates Employer/Employee sessions and routes to lockout when subscription is disabled.
- Extended schema with per-tenant configuration settings, employee payroll mode fields, custom rates, and attendance flags.
- Added Manila timezone-safe date/time handling for punch logging and calendar workday evaluation.
- Implemented Employer Tenant Configuration Panel for currency, work days, shift window, default rates, and monthly hours cap.
- Implemented payroll drafting engine with runtime-only Hourly/Monthly toggle overrides per employee.
- Added hard cap logic: Cap Exceeded badge, payout clamping at max hours, and inline Override Cap checkbox.
- Added Finalize Draft action that persists runtime payroll mode overrides only on explicit submit.
- Added shift-window validation that appends Outside Shift Hours flag on out-of-window punch actions.
- Added pending clock-out exclusion from payroll calculations and visible Pending Clock-out labels in log timelines.
- Rehydrated seed data to include required localized settings defaults and >40-hour employee logs for immediate cap validation.

## 2.1.0 - 2026-06-09
- Migrated to a standard modular React + TypeScript project layout under `src/`.
- Moved feature modules into `src/admin`, `src/client`, and `src/shared` folders.
- Added Vite toolchain and TypeScript project configs for production build support.
- Added Tailwind + PostCSS configuration so existing utility classes compile correctly.
- Added React entrypoint (`src/main.tsx`) and global stylesheet (`src/styles.css`).
- Added Cloudflare deployment configuration via `wrangler.toml` and deploy script.
- Added deployment-ready scripts in `package.json` for local dev, build, and Cloudflare Pages deployment.
- Added `README.md` runbook with local run, build, and Cloudflare deploy instructions.

## 2.0.0 - 2026-06-09
- Rewrote the app from single-file sandbox into production-oriented modular architecture.
- Split code into `admin` and `client` module folders with shared typed domain utilities.
- Implemented unified login with role-based routing for SuperAdmin, Employer, and Employee.
- Added strict tenant data isolation by scoping all non-admin queries and mutations to the active `org_id`.
- Added tenant subscription kill-switch behavior that blocks disabled-tenant login and force-revokes active tenant sessions.
- Added desktop-first Super Admin Portal with tenant onboarding, searchable subscription matrix, and enable/disable toggle.
- Added mobile-forced Employer Dashboard with team provisioning, payroll roll-up, employee deep-dive timeline, and payroll draft summary card.
- Added mobile-forced Employee Console with one-tap punch clock and shift history.
- Added payroll engine for hourly and monthly compensation with 160-hour conversion and strict two-decimal formatting.
- Added pending clock-out handling that visually tags incomplete logs and excludes them from payroll calculations.
- Added idempotent punch handling so duplicate clock-in is prevented when an open shift exists.
- Preserved sandbox behavior through quick-access demo accounts behind a sandbox mode flag.
- Added seed dataset with two organizations (one enabled, one disabled) and two weeks of dummy attendance logs.
