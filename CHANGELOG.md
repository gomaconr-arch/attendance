# Changelog

## 3.2.0 - 2026-06-09
- Added attendance log mutation controls with `is_modified` and `is_voided` support, including immutable `attendance_adjustments` audit ledger and `correction_requests` workflow storage.
- Added employer-side administrative overwrite workflow with required adjustment reason validation (minimum 10 characters), edit modal with time pickers, and log voiding without destructive deletion.
- Added backend punch cool-down enforcement (3 minutes) returning `429 Too Many Requests - Punch cool-down active` for rapid repeated punches.
- Added employee-side 180-second punch button lock countdown and surfaced backend punch cool-down errors in the mobile clock UI.
- Added employee self-correction module (`Dispute/Correct This Day`) with timeline links, request form, and pending correction submission pipeline.
- Added employer Approval Center for pending correction requests with approve/reject actions; approvals apply requested times to attendance logs and create audit adjustments.
- Excluded voided logs from payroll/cap calculation pathways while preserving records in the logs management view.
- Expanded scoped API state to include adjustments and correction requests for all tenant-aware clients.

## 3.1.6 - 2026-06-09
- Made Employee History calendar table more responsive for smaller screens by reducing minimum width and day cell height on mobile.
- Updated weekday headers to compact initials format: `S/M/T/W/T/F/S`.
- Adjusted calendar cell typography: smaller date number text and medium-sized total-hours text.

## 3.1.5 - 2026-06-09
- Compacted Employee History calendar cells by reducing row height and cell padding for denser monthly scanning.
- Removed `hrs` suffix from daily hour values in calendar cells.
- Added muted gray styling for zero-hour calendar dates.
- Highlighted current date with solid dark background and strong foreground contrast.

## 3.1.4 - 2026-06-09
- Changed Employee History to a month-style calendar table layout (weekday columns and week rows) instead of card grid boxes.
- Each calendar date cell now shows total tracked hours for that day, with pending clock-out count when applicable.

## 3.1.3 - 2026-06-09
- Refactored Employer Logs into a grouped table format by employee, with per-entry date/time details and per-employee total hours summary.
- Replaced Employee Shift History list with a calendar-style daily box view that shows total hours per date.
- Kept pending clock-out visibility in both employer and employee log views.

## 3.1.2 - 2026-06-09
- Replaced Employer Logs timeline with a simplified daily calendar summary that displays total tracked hours per day.
- Added daily rollup cards showing earliest clock-in and latest clock-out per date, including pending clock-out count when present.
- Standardized displayed shift times in the calendar to `HH:MM AM/PM`.
- Standardized displayed calendar dates to `MMM-DD, YYYY, Mon` format.

## 3.1.1 - 2026-06-09
- Added explicit field labels for all inputs in the Employer Tenant Configuration Panel (`Currency`, `Max Hours Per Month`, `Shift Start`, `Shift End`, `Default Hourly Rate`, `Default Monthly Rate`) for improved clarity and accessibility.

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
