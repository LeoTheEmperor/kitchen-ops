# Fernleaf Kitchen — Kitchen Operations Admin Panel

A comprehensive operations management system for a commercial corporate meal kitchen: catalogue management, multi-tier pricing engine, company/employee policies, cut-off order processing, real-time kitchen prep board, sequential dispatch/driver tracking, company billing, and role-tailored dashboards. Built for the Heizen engineering assessment.

---

## 1. Live Deployment & Credentials

* **Frontend (Vercel)**: `https://kitchen-ops-ten.vercel.app`
* **Backend (Render)**: `https://kitchen-ops-backend.onrender.com`

### Mandatory Test Accounts (Seeded)

All test accounts share the same password: **`Test@1234`**

| Role | Email | Password | Name | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@test.com` | `Test@1234` | Asha Admin | Full system access: catalogue, pricing, companies, employees, orders, boards, billing, settings. |
| **Kitchen** | `kitchen@test.com` | `Test@1234` | Kiran Kitchen | Kitchen prep board (filter by station, start/finish units) and kitchen load dashboard. |
| **Dispatch** | `dispatch@test.com` | `Test@1234` | Divya Dispatch | Dispatch delivery board (pipeline progression, driver assignment) and dispatch dashboard. |
| **Driver** | `driver@test.com` | `Test@1234` | Dev Driver | Driver view (today's stops in chronological order, mark delivered with notes) and driver dashboard. |

*(A second driver account, `driver2@test.com` / `Test@1234`, is also pre-seeded to provide realistic choice during dispatch driver assignment).*

---

## 2. Requirements Compliance & Traceability Matrix

This section explicitly maps out every requirement from the Heizen assignment document, detailing implementation status and architectural rationale.

### 4.1 Catalogue [`Must`] — ✅ FULFILLED
* **Dishes**: Modeled in `Dish` entity with `name`, `description`, `sku`, `temperature` (`HOT`/`COLD`), `costPrice`, `allergens`, `dietaryTags`, `kitchenStation`, `minOrderQty`, and soft deactivation (`active: boolean`). Historical orders reference dishes safely without deletion.
* **Options & Option Groups**: Reusable choices (paneer, tofu, brown rice, etc.) with individual cost prices, allergens, and dietary tags. Supported optional/required groups with explicit `displayOrder`.
* **Combinations & Snapshot Pricing**: Order lines split into discrete combinations with individual quantities. Combination total price calculated as `(dish price + chosen option prices) * quantity`. Snapshot fields (`unitPriceSnapshot`, `totalPriceSnapshot`, `optionNameSnapshot`) are frozen at order creation time to guarantee price immutability.
* **Reference Data**: Admin-managed lists for allergens, dietary tags, kitchen stations, and portion sizes.
* *Unfulfilled/Simplified (`Portions` [Should])*: While the data model supports portion size multipliers (`PortionSize`, `OptionGroup.usesPortions`), dynamic portion sizing in the UI was deprioritized to guarantee rock-solid correctness for mandatory option combination ordering.

### 4.2 Menu [`Must`] — ✅ FULFILLED
* **Categories & Ordering**: Dishes grouped by categories ("Bowls", "Light Bites", "Breakfast", "Desserts") with custom display ordering and active toggles.
* **Company Hiding & Secret Items**: Categories and items support company-specific exclusion rules and secret category flags.
* **Employee Menu Preview**: Built `/menu/preview/:employeeId` endpoint applying exact company visibility rules, tier prices, and active flags.

### 4.3 Pricing [`Must`] — ✅ FULFILLED
* **Named Price Tiers**: Default "Standard" tier alongside "Enterprise" and "Partner" tiers.
* **Derived Pricing Formulas**: Supports `COST_MULTIPLIER` (e.g. `cost * 2.4`) and `MARKUP_PERCENT` (e.g. `Standard + 15%`). Individual item overrides take precedence.
* **5-Cent Rounding Rule**: Formula derivations round up to the next 5 cents in integer-cent arithmetic (e.g. \$2.11 &rarr; \$2.15) to prevent floating-point inaccuracies.
* **Price Exclusion**: Dishes without a price on an employee's tier are completely excluded from their menu (never shown at \$0 or blank).

### 4.4 Companies [`Must`] — ✅ FULFILLED
* **Company Profile & Domains**: Corporate entities with name, delivery addresses, billing contact, owner employee, and email domains. Enforced duplicate prevention and blocked public domains (`gmail.com`, `yahoo.com`, etc.).
* **Company Calendar & Defaults**: Configurable working days, holidays, default delivery time, dispatch lead minutes (default 60 min), packaging type, driver standing instructions, and default assigned driver.

### 4.5 Employees [`Must`] — ✅ FULFILLED
* **Employee Policies**: Exactly one parent company per employee. Staff-configured permission flags (`canChooseAddress`, `canChangeTime`, `canChangePackaging`) strictly enforced by both the UI and NestJS backend validation pipes.
* **Allergies & Dietary Preferences**: Linked directly to employees and factored into meal ordering.
* *Unfulfilled/Simplified (`Bulk CSV Import` [Should])*: Deprioritized in favor of perfecting server-side validation, cut-off scheduling, and live kitchen dispatch pipelines.

### 4.6 Orders & Cut-Off Processing [`Must`] — ✅ FULFILLED
* **Working Days Cut-Off Calculation**: Dynamic lookback algorithm (`calculateCutoffInstant`, `isPastCutoff`) that skips weekends and configured kitchen holidays.
* **Order Lifecycle**: Strict state transitions: `DRAFT` &rarr; `PLACED` &rarr; `CONFIRMED` &rarr; `DELIVERED` (plus `CANCELLED` and `REJECTED`). Orders lock once the cut-off instant passes.
* **Automated Cut-Off Runner**: Idempotent processing cancels pending drafts, confirms placed orders, generates billable snapshots, and initializes kitchen prep units. Re-running cut-off for the same date is safe and idempotent via `CutoffRun` tracking.
* **Admin Overrides**: Admins have server-enforced privileges to override delivery time, address, and packaging after confirmation.

### 4.7 Kitchen Board [`Must`] — ✅ FULFILLED
* **Prep Unit Decomposition**: Distinct dish combinations are decomposed into individual `PrepUnit` tasks routed to kitchen stations (`Grill`, `Salad`, `Bakery`, `Beverage`, or `Unassigned`).
* **Station Tracking**: Kitchen leads filter by station and transition units: `PENDING` &rarr; `STARTED` &rarr; `DONE`. Finishing an unstarted unit automatically logs its start time.
* **Planned Schedule & Late Detection**: Dynamic planned times (`dispatchReady = deliveryTime - leadMinutes`, `kitchenReady = dispatchReady - 30 min`). Late and at-risk orders are visually highlighted with warnings.

### 4.8 Dispatch Board & Driver View [`Must`] — ✅ FULFILLED
* **Sequential Delivery Pipeline**: Strict state flow: `KITCHEN_READY` &rarr; `DISPATCH_READY` &rarr; `OUT_FOR_DELIVERY` &rarr; `DELIVERED`. Advancing to "Out for Delivery" enforces driver assignment.
* **Drop Grouping**: Orders sharing company, delivery address, and delivery time are computed as a single unified drop.
* **Mobile-Ready Driver Portal**: Drivers see only their assigned stops for today in chronological sequence, with delivery note logging and on-time performance calculation.
* *Unfulfilled/Simplified (`Delivery Photo Upload` [Could])*: Schema contains `deliveryPhotoUrl`, but cloud storage upload (e.g. S3) was omitted per Section 5 scope boundaries.

### 4.9 Company Billing [`Must`] — ✅ FULFILLED
* **Invoicing Engine**: Groups confirmed, uninvoiced delivered orders per company into discrete invoice records and marks invoices paid.
* **Invoice Immutability Decision**: Once an order is attached to an invoice, modifications and cancellations are permanently locked to preserve accounting integrity.

### 4.10 Settings [`Must`] — ✅ FULFILLED
* Dynamic database-backed operational settings (`CUTOFF_DAYS`, `CUTOFF_TIME`, `KITCHEN_WORKING_DAYS`, `KITCHEN_HOLIDAYS`, `KITCHEN_TIMEZONE`). Staff can adjust operational rules without touching code.

### 4.11 Dashboards [`Must`] — ✅ FULFILLED
* **Admin Dashboard**: Real-time snapshot of daily order counts, confirmed batches, delivery progress, active client companies, and uninvoiced backlogs.
* **Kitchen Dashboard**: Morning prep load distribution across stations and early-warning counts for at-risk orders.
* **Dispatch Dashboard**: Live delivery pipeline counts and unassigned drop alerts.
* **Driver Dashboard**: Clean personal stop counter: Total Stops, Completed, and Remaining Stops.

### 7. Non-Functional Requirements — ✅ FULFILLED
* **Money Precision**: Decimal (`numeric`) arithmetic across all price, snapshot, and invoice tables. Zero floating-point rounding errors.
* **Timezone Standards**: Kitchen operates on `Asia/Kolkata` (IST, UTC+5:30). Cut-off calculations execute against fixed IANA timezone instances via `luxon`, independent of server or browser system time.
* **Accessibility (WCAG 2.1 AA)**: High-contrast theme (Slate-900 on Slate-50), explicit form labels, distinct status chips, and visible focus rings (`:focus-visible`).
* **Automated Unit Tests**: 13/13 unit tests pass across cut-off calculations, holiday handling, timezone independence, and combination validation.

---

## 3. Prioritization & Scope Trade-offs (Section 6)

### What Was Prioritized and Completed:
1. **Core Business Mechanics**: All 11 [Must] functional areas were fully designed, modeled, implemented, and verified.
2. **Data Integrity & Immutability**: Historical price snapshots, invoice immutability, and safe idempotent cut-off processing.
3. **Role-Based Security**: Complete server-side enforcement using NestJS guards and JWT decorators (`@Roles()`, `RolesGuard`).
4. **Accessible Operational UX**: High-contrast, responsive UI tailored for real kitchen and dispatch workflows.

### What Was Skipped / Simplified & Reasoning:
1. **Portion Multipliers (`4.1 [Should]`)**: The database schema supports `PortionSize` and `usesPortions`, but dynamic portion selectors were omitted from the cart UI to prioritize complete option combination validation and snapshot pricing.
2. **Employee CSV Bulk Import (`4.5 [Should]`)**: Omitted to dedicate time to the core ordering, cut-off lookback engine, and real-time boards.
3. **Delivery Photo Upload (`4.8 [Could]`)**: Driver notes are fully implemented; photo file upload integration was deferred since external blob storage was optional.
4. **Explicit Out-of-Scope Items (`Section 5`)**: Employee payments, accounting sync, coupon codes, sales tax, delivery fees, and audit logs were omitted per instructions.

### What Would Be Added Next:
* End-to-end portion selection and portion-based surcharge math in the cart builder.
* Streaming CSV bulk employee import with row-by-row validation feedback.
* S3 / Cloudflare R2 bucket integration for driver delivery proof photos.
* Credit note and invoice adjustment workflow for post-billing order discrepancies.

---

## 4. Technical Architecture & Tech Stack

```
fernleaf-kitchen/
├── backend/                  # NestJS TypeScript API
│   ├── prisma/
│   │   ├── schema.prisma     # 38 relational Prisma models
│   │   ├── seed.ts           # Idempotent database seeder
│   │   └── migrations/       # PostgreSQL migration history
│   └── src/
│       ├── auth/             # JWT authentication & RolesGuard
│       ├── catalogue/        # Dishes, options & option groups
│       ├── pricing/          # Tier derivations & 5-cent rounding
│       ├── companies/        # Corporate client settings & domains
│       ├── employees/        # Employee profiles & permission flags
│       ├── menu/             # Categories, hiding & employee preview
│       ├── orders/           # Order creation, snapshots & cut-off engine
│       ├── kitchen/          # Kitchen station prep unit board
│       ├── dispatch/         # Delivery pipeline & drop grouping
│       ├── billing/          # Invoicing & company accounts
│       ├── settings/         # Kitchen operational config
│       └── dashboard/        # Role-tailored metric aggregators
└── frontend/                 # Next.js App Router (TypeScript & Tailwind)
    ├── src/app/              # Route pages (dashboard, kitchen, dispatch, driver, orders, login)
    ├── src/components/       # AppShell, StatCard, and reusable UI components
    └── src/lib/              # Typed API fetch client & auth session hooks
```

---

## 5. Local Setup Guide

### Prerequisites
* Node.js (v20+ recommended)
* PostgreSQL database (Local or Cloud instance)

### 1. Backend Setup
```bash
cd backend
cp .env.example .env

# Configure your .env:
# DATABASE_URL="postgresql://user:password@localhost:5432/kitchen_ops"
# JWT_SECRET="your-secure-random-secret"
# PORT=3001
# FRONTEND_URL="http://localhost:3000"

npm install
npm run db:setup     # Runs migrations and seeds demo data
npm run start:dev    # Starts backend at http://localhost:3001
```

### 2. Frontend Setup
```bash
cd frontend
cp .env.local.example .env.local

# Configure your .env.local:
# NEXT_PUBLIC_API_URL="http://localhost:3001"

npm install
npm run dev          # Starts frontend at http://localhost:3000
```

### 3. Running Automated Tests
```bash
cd backend
npm test             # Executes cut-off & combination test suites
npm run lint         # Verifies backend linting rules
```
