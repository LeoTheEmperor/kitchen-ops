# Fernleaf Kitchen — Admin Panel

A kitchen operations admin panel for a corporate meal program: catalogue,
pricing, companies/employees, orders with cut-off processing, kitchen board,
dispatch/driver flow, and billing. Built for the Heizen engineering round.

## Stack

| Layer | Use |
|---|---|
| Frontend | Next.js (App Router, TypeScript, Tailwind) |
| Backend | NestJS (TypeScript) |
| ORM | Prisma, targeting Postgres |
| Auth | JWT, role-based guards (ADMIN / KITCHEN / DISPATCH / DRIVER) |

## Structure

```
fernleaf/
├── frontend/   Next.js app
└── backend/    NestJS app — see backend/src/ for one folder per domain module
```

## Local setup

### Backend

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL to a Postgres connection string
# (local Postgres, or a free Neon/Supabase/Railway instance),
# and JWT_SECRET to any long random string

npm install          # also runs `prisma generate` via postinstall
npm run db:setup      # runs migrations, then seeds realistic demo data
npm run start:dev     # http://localhost:3001
```

`npm run db:setup` is also the exact command to run once after your first
production deploy — see "Deployment" below. **Do not run it twice** against
the same database: the seed script has no uniqueness guards on most of its
data (companies, orders, etc.), so re-running it creates duplicates. If you
need to reset, drop and recreate the database, then run `db:setup` again.

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
# edit .env.local if your backend isn't on localhost:3001

npm install
npm run dev     # http://localhost:3000
```

## Test accounts (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | admin@test.com | Test@1234 |
| Kitchen | kitchen@test.com | Test@1234 |
| Dispatch | dispatch@test.com | Test@1234 |
| Driver | driver@test.com | Test@1234 |

A second driver (`driver2@test.com`, same password) is also seeded so
dispatch assignment has more than one real choice.

## What the seed data contains

- 3 companies (Acme Logistics / Standard tier, Northwind Traders / Enterprise
  tier, Globex Partners / Partner tier), each with real addresses, domains,
  and 1–2 employees with varying permission flags and allergies/dietary tags
- A catalogue of 7 dishes across 4 categories (Bowls, Light Bites, Breakfast,
  Desserts), one dish with full option groups (protein/rice/side), one
  deactivated dish (to prove historical orders still reference it), and one
  dish deliberately left with **no price on any tier** (proves the "excluded
  from menu, never shown at $0" rule)
- 3 price tiers: one with explicit prices (Standard, also the default), one
  derived by markup percentage off the default (Enterprise), one derived by
  cost multiplier (Partner) — demonstrates every pricing mode in section 4.3
- Orders spanning: 4+ days in the past (delivered), yesterday (one cancelled,
  one rejected, for status variety), **today** (5 confirmed orders, two of
  which have kitchen units already started/done, with deliveries assigned —
  four to `driver@test.com`/`driver2@test.com`, one deliberately unassigned
  to show that state on the dispatch board), and the coming week (placed and
  draft orders, to exercise cut-off processing)
- One paid invoice covering Acme's delivered past orders

## Architecture overview

The backend is organized as one NestJS module per domain area under
`backend/src/`: `auth`, `staff`, `catalogue`, `pricing`, `companies`,
`employees`, `menu`, `orders`, `kitchen`, `dispatch`, `billing`, `settings`,
`dashboard`. Each module owns its own service (business logic + Prisma
queries), controller (HTTP + role guards), and DTOs (validation).

Role-based access is enforced with two composable guards applied via
decorators (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(StaffRole.ADMIN)`)
rather than scattered `if (role === 'ADMIN')` checks — adding a new role or
changing which roles can hit an endpoint is a one-line change at the
controller method, never a hunt through business logic.

### Data model

See `backend/prisma/schema.prisma` for the full model (38 models). Key
design decisions:

- **Order line combinations** (4.1): each `OrderLine` (one dish + quantity)
  has many `OrderLineCombination` rows, one per distinct option-choice
  combination, each with its own quantity and a frozen price snapshot. This
  is also the unit the kitchen board cooks against (4.7).
- **Historical pricing immutability** (4.1, 4.6): `OrderLine.unitPriceSnapshot`,
  `OrderLineCombination.totalPriceSnapshot`, and
  `OrderLineCombinationOption.priceSnapshot`/`optionNameSnapshot` are all
  frozen at order-creation time and never recomputed from the live catalogue.
- **Pricing** (4.3): a `PriceTier` model; `DishPrice`/`OptionPrice` join
  tables keyed by (item, tier), each storing either an explicit price or a
  derivation rule (`COST_MULTIPLIER` or `MARKUP_PERCENT` + a value). An
  explicit price, if also set, always overrides a derivation formula —
  satisfying "staff can still override individual prices." An item with no
  price row on an employee's tier is excluded from their menu outright
  (never shown at $0). Derived prices round up to the next 5 cents in
  integer-cent arithmetic to avoid floating-point error.
- **Cut-off processing** (4.6): a `CutoffRun` model with a unique constraint
  on `deliveryDate` makes re-running cut-off for the same date a safe,
  detectable no-op — satisfying the explicit idempotency requirement.
- **Billing immutability** (4.9 — documented, ambiguous requirement): once an
  order is attached to an `Invoice`, both `OrdersService.cancel()` and
  `adminOverride()` reject further changes to it. Invoices are immutable
  facts once issued; adjusting an invoiced order (credit/adjustment records)
  is out of scope for this submission — see "What I'd do next."
- **Drops** (4.8): deliberately **not** a stored entity. A drop (same
  company + address + exact delivery time) is computed on read by grouping
  `Order`/`Delivery` rows. This avoids a second source of truth that could
  drift from the orders themselves; the trade-off is that drop-level history
  (e.g. "this drop was reassigned from driver A to driver B") isn't
  separately tracked — only the current driver on each delivery is.
- **Money**: `Decimal` (Postgres `numeric`) everywhere prices/totals are
  stored — never `Float` — to avoid floating-point error in totals.

### Timezone handling (non-functional requirement, section 7)

The kitchen operates in **Asia/Kolkata (IST)**. All cut-off calculation uses
the `luxon` library with an explicit IANA timezone (`Asia/Kolkata`), so the
result is correct regardless of the server's or browser's local timezone —
verified by a unit test that constructs "now" in UTC and confirms the
cut-off comparison is still correct (`backend/src/orders/cutoff.util.spec.ts`).

## Dashboards (4.11)

Each dashboard's exact figures, grouping, and treatment of edge cases are
documented as code comments directly above each method in
`backend/src/dashboard/dashboard.service.ts` — summarized here:

**Admin** — orders today (excludes cancelled, includes every other status),
confirmed/kitchen-done/delivered counts for today, a running uninvoiced-orders
backlog count (all dates, not just today), and active company count. Why:
admin needs a same-day operational snapshot plus upstream signals (invoicing
backlog) that aren't visible from any single board.

**Kitchen** — today's prep units grouped by station and status
(pending/started/done), plus a count of "at-risk" orders (planned
kitchen-ready time has passed but actual kitchen-ready is still null). Why: a
kitchen lead at 6am needs total load per station and an early warning on
what's running behind, before service starts.

**Dispatch** — today's deliveries by status, and an unassigned-drop count.
Why: a dispatcher needs to see what's ready to move and what still needs a
driver, at a glance.

**Driver** — this driver's own stops today: total, delivered, remaining.
Why: a driver needs exactly one number that matters — how many stops are
left — nothing more.

All "today" figures use the kitchen's Asia/Kolkata calendar date, not the
server's or browser's. Cancelled orders are excluded from every count/total
unless the metric is explicitly about cancellations.

## Key decisions & trade-offs (section 6/7 ambiguity notes)

- **Invoice immutability** (4.9): explicitly chosen — see "Billing
  immutability" above. Not required by the spec in this exact form, but
  documented as the simplest correct behavior given the time available.
- **Combination merging**: if a staff member submits two separate
  combination rows with identical option choices, they're merged into one
  (summed quantity) before validation, so the kitchen board never shows two
  prep units for what's actually one distinct combination. Not explicitly
  specified; a reasonable reading of "each distinct combination is one unit."
- **Employee email domain validation**: an employee's email domain must
  match one of their company's registered domains. Not an explicit rule in
  section 4.5, but a direct consequence of why the domain model exists at
  all (section 4.4) — otherwise company domains would be unenforced data.
- **"Today"**: computed from the kitchen's Asia/Kolkata timezone via a fixed
  UTC+5:30 offset (IST has no DST), not from server or browser local time —
  see the Timezone section above.

## Prioritization (section 6) — what's built, what's skipped

**Built properly** (all [Must] items from section 4): Catalogue (4.1),
Menu (4.2), Pricing (4.3), Companies (4.4), Employees (4.5, minus CSV
import), Orders incl. cut-off (4.6), Kitchen board (4.7), Dispatch board +
driver view (4.8), Billing (4.9), Settings (4.10), Dashboards (4.11).

**Explicitly skipped / simplified**, and why:
- **Portions** (4.1, [Should]): schema supports it (`OptionGroup.usesPortions`,
  `OptionPortion`), but no UI or order-time validation was built for it —
  cut for time, since it's explicitly [Should] not [Must].
- **CSV bulk import** (4.5, [Should]): not built — cut for time.
- **Delivery photo** (4.8): the field (`Delivery.deliveryPhotoUrl`) exists in
  the schema but isn't wired to any upload flow yet — deferred by explicit
  agreement during development, to revisit if time remains.
- **Exports, audit logs, promotions, delivery fees, tax**: out of scope per
  section 5, not built.

**What I'd do next with more time**: portions support end-to-end, CSV
import with row-level error reporting, a proper credit/adjustment flow for
invoiced orders that need correction, delivery photo upload, and a
materialized `Drop` entity if drop-level reassignment history becomes a real
requirement.

## Tests (section 7)

`backend/src/orders/cutoff.util.spec.ts` and
`backend/src/orders/combination.util.spec.ts` cover the two correctness
areas most likely to break: cut-off calculation (including the exact
worked example from the spec, weekend-skipping, holiday-skipping, and
timezone-independence) and combination validation (quantity-sum enforcement,
required-group enforcement, duplicate-combination merging). Run with:

```bash
cd backend
npm test
```

## Deployment

See `backend/railway.json` for the Railway start command
(`npx prisma migrate deploy && npm run start:prod`), which runs migrations
automatically on every deploy. The seed step (`npm run seed`) is **not**
part of that automatic command — run it once, manually, after your first
successful deploy:

1. Push this repo to GitHub.
2. **Railway**: new project → provision Postgres → add this repo as a
   service with root directory `backend` → set `DATABASE_URL` (reference the
   Postgres service), `JWT_SECRET`, and (after step 3) `FRONTEND_URL` → deploy
   → generate a public domain.
3. **Vercel**: import the repo, root directory `frontend`, set
   `NEXT_PUBLIC_API_URL` to the Railway backend URL → deploy.
4. **Seed the production database once**: from your local machine, run
   ```bash
   cd backend
   DATABASE_URL="<your-production-connection-string>" npm run seed
   ```
   (or open a one-off shell on Railway and run `npm run seed` there).
5. Verify: sign in with each of the 4 test accounts on the live Vercel URL.

Keep the live link running for at least two weeks after submission, per the
assignment's instructions.
