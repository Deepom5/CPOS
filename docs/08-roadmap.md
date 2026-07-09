# 08 — Roadmap

## 8.1 Guiding principles

- Ship the **smallest end-to-end vertical** that lets a single cafe run a full day on CPOS without a backup system. Everything else is post-MVP.
- Every milestone is **demoable**, not just "code complete."
- Offline-first and sync are not features at the end — they are part of the foundation in M0.

## 8.2 Milestones overview

| Milestone | Theme | Duration estimate (calendar) | Demoable outcome |
|---|---|---|---|
| **M0** | Foundation | 2 weeks | App boots, registers a device, signs in offline, opens an empty POS screen. |
| **M1** | POS core | 4 weeks | Cashier takes a cash order offline, prints receipt. |
| **M2** | Sync + cloud | 3 weeks | Multi-device sync, manager dashboard, sync status UI. |
| **M3** | Kitchen + tables | 3 weeks | KDS, table management, holds, splits. |
| **M4** | Menu + inventory admin | 3 weeks | Owners manage menu and inventory from the app. |
| **M5** | Polish + pilot | 2 weeks | Reports, accessibility, performance, real-store pilot. |
| **MVP launch** | Public beta | — | A single cafe operates entirely on CPOS. |
| **v1.1+** | Growth features | ongoing | Loyalty campaigns, online ordering, integrations, franchises. |

(Estimates are duration, not effort. Adjust to team size.)

## 8.3 MVP scope (what ships at launch)

### Must-have

- [ ] Owner can sign up, create a tenant + first location.
- [ ] Device registration with a deviceSecret stored in `expo-secure-store`.
- [ ] Employee login: email/password for managers, PIN for cashiers.
- [ ] **Offline login** via cached `pin_hash` and refresh token.
- [ ] Cached menu pulled at first sync; usable offline thereafter.
- [ ] POS billing screen: categories, products, add-to-cart, modifiers, quantity, kitchen notes.
- [ ] Discounts: percent and fixed amount, with manager-PIN authorization.
- [ ] Taxes (inclusive and exclusive).
- [ ] Cash payment with change calculation.
- [ ] Card/UPI/wallet recorded as "external" (gateway integration is post-MVP).
- [ ] Receipt printing: at least Bluetooth ESC/POS and AirPrint.
- [ ] **Offline order queue** with the outbox pattern from [02-offline-first-architecture.md](02-offline-first-architecture.md).
- [ ] Sync engine: push + pull + retry + idempotency.
- [ ] Sync status UI (banner + dedicated screen).
- [ ] Basic KDS: New / Preparing / Ready columns, sound alert.
- [ ] Basic table management: floor plan grid, status toggle, assign order to table.
- [ ] Inventory: items + event log + low-stock badge (no purchase orders yet).
- [ ] Menu admin: categories, products, variants, simple add-ons, images.
- [ ] Reports: daily sales, top items, payment breakdown, staff sales. Computed by the worker.
- [ ] Role-based access: Owner / Manager / Cashier / Kitchen.
- [ ] Audit log for sensitive actions (refund, void, comp, manager override).
- [ ] Light and dark mode.
- [ ] Crash reporting (Sentry).
- [ ] One pilot deployment to a real cafe with at least one tablet + one KDS device.

### Explicitly out of scope for MVP

- Online ordering / QR ordering / delivery aggregator integrations.
- Loyalty program (the schema supports it; UI is not built).
- Multi-location reports rollup (per-location only).
- Franchise / sub-tenant hierarchies.
- Web admin panel (mobile admin is enough for MVP).
- Payment gateway integrations (we **record** card payments; we do not **process** them).
- Purchase orders / vendor management.
- Multi-device LAN store-and-forward (each device syncs through cloud).
- Multi-currency per tenant.
- Customer-facing display (CFD).
- Tip distribution / tip-out logic.

## 8.4 Milestone detail

### M0 — Foundation (2w)

Goal: get the boring-but-critical plumbing right before any product features.

- Monorepo migration (see [05-app-structure.md §5.9](05-app-structure.md#59-migration-from-current-repo)).
- CI: GitHub Actions for typecheck + lint + test on every PR.
- EAS dev client build profile, working install on Android tablet + iPad.
- `expo-sqlite` opened, migrations runner, `0001_init.ts` applied at boot.
- `LocalRepo` for products + orders with transactional writes.
- `sync_outbox` table + insert/update/delete helpers wrapped in TX.
- API skeleton in NestJS: `/healthz`, `/auth/login`, `/sync/pull`, `/sync/push` (echo only).
- Prisma migrations for `Tenant`, `Location`, `Device`, `Employee`.
- Auth flow end-to-end with refresh token rotation.
- Device registration + offline PIN login.
- Design system primitives: `AppButton`, `Card`, `Input`, `Pill`, `Toast`, `Skeleton`, `BottomSheet`, `Modal`.

### M1 — POS core (4w)

Goal: a cashier can take cash payments offline.

- Product grid + category rail with virtualization (`@shopify/flash-list`).
- Cart panel + bottom-sheet variant on phone.
- Modifier sheet (variants + add-ons).
- Discount entry with manager PIN gate.
- Tax engine (works offline, identical to server math via `@cpos/pos-domain`).
- Payment screen: cash + numeric pad + tendered/change.
- Receipt rendering + ESC/POS BLE adapter + AirPrint adapter.
- Hold/Resume order.
- Offline banner + sync status banner.
- First slice of `SyncEngine`: push only, retry with backoff.

### M2 — Sync + cloud (3w)

Goal: data flows reliably between devices and the cloud.

- Full pull sync with per-entity cursors.
- WS gateway with `menu.updated`, `order.updated`, `sync.hint`.
- Conflict resolution for menu vs active orders.
- `Idempotency-Key` middleware on the server.
- Sync status screen with retry/discard.
- Background fetch scheduling on iOS and Android.
- Multi-device demo: two POS devices on the same location.

### M3 — Kitchen + tables (3w)

Goal: full dine-in restaurant flow.

- KDS mode + LAN ticket broadcast over mDNS.
- Item-level status tracking with optimistic UI.
- Table floor plan editor.
- Assign order to table, move order, merge tables.
- Hold order linked to a table.
- Split bill: by item and evenly.
- Sound alerts on KDS, aging color shifts.

### M4 — Menu + inventory admin (3w)

Goal: owners self-serve their data.

- Menu CRUD: categories, products, variants, add-ons.
- Image upload via S3 presigned URLs + client-side resize.
- Inventory items + event log UI.
- Low-stock alerts (push notification + dashboard badge).
- Stock projection worker on the backend.
- Staff management: invite, set role, set PIN, location scoping.

### M5 — Polish + pilot (2w)

Goal: production-grade quality on real hardware.

- Reports dashboard (sales by day/hour, top items, payments, staff).
- Accessibility audit (contrast, labels, dynamic type).
- Performance: cold start budget, FlashList tuning, image cache.
- Sentry + structured logging on both client and server.
- Onboarding flow (seed sample menu).
- Pilot deployment to one cafe, daily check-ins for two weeks.

## 8.5 Definition of Done per milestone

A milestone is done only when **all** of:

1. The demo script runs end-to-end without manual intervention.
2. Test coverage in `pos-domain` ≥ 95%, in `sync` ≥ 80%.
3. Crashfree sessions on pilot devices ≥ 99.5% for 3 consecutive days.
4. Sync queue drains within 30s of reconnection at p95.
5. No P0/P1 bugs open.

## 8.6 Future roadmap (post-MVP)

### v1.1 — Loyalty + customer experience (4–6 weeks)

- Loyalty points engine (configurable earn/redeem rules).
- Loyalty campaigns (X visits = free Y).
- Customer-facing display on a second tablet over LAN.
- Customer profiles with order history and favorites.
- SMS / email digital receipts via tenant-owned providers.

### v1.2 — Online ordering & QR (6–8 weeks)

- Public web menu per location (Next.js page rendered from cached menu).
- QR ordering: scan → menu → order → pay → KDS.
- Pickup vs dine-in toggle.
- Webhook + WS push to POS for new online orders.
- Pre-pay via gateway (Stripe, Razorpay).

### v1.3 — Payments processing (6 weeks)

- Stripe Terminal (Tap to Pay on iPhone, Android tap), Razorpay, Adyen, Square Reader integrations.
- Tip logic + tip-pool reports.
- Refund through the same gateway.
- PCI scope minimization (we hold no card data).

### v1.4 — Delivery & aggregators (4 weeks)

- Zomato, Swiggy, Uber Eats menu sync + order push to POS.
- Rider hand-off flow on the KDS.
- Aggregator reports.

### v1.5 — Multi-location & franchise (8 weeks)

- Tenant hierarchies (brand → franchisee → location).
- Menu templates with location-level overrides and approval workflows.
- Centralized reporting rollups.
- Per-franchise pricing and promotions.

### v1.6 — Inventory advanced (6 weeks)

- Purchase orders + vendor management.
- Recipe-based auto-consumption with BOM hierarchy.
- Stock counts with variance reports.
- Multi-location stock transfers.

### v1.7 — Workforce (4 weeks)

- Shift scheduling.
- Tip distribution.
- Sales targets and gamification.
- Payroll export.

### v1.8 — Intelligence (continuous)

- Sales forecasting per item per day-of-week.
- Smart reorder suggestions.
- AI menu-engineering insights (margin × velocity matrix).
- Voice-driven analytics ("show me last week's coffee sales").

### v1.9 — Integrations & accounting

- QuickBooks, Xero, Zoho Books exports.
- WhatsApp business ordering bot.
- Email marketing connectors (Mailchimp, Sendinblue).
- Reservation systems (OpenTable, SevenRooms).

### v2.0 — Multi-device LAN sync

- Store-and-forward: when cloud is down, POS devices peer-sync via mDNS so the second cashier sees the first cashier's orders.
- Conflict-free replicated data structures for the cart hand-off case.
- Requires careful security: per-device LAN auth keys exchanged at registration.

## 8.7 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bluetooth printer SDK fragmentation | High | Medium | Ship 2–3 known-good adapters; document supported models. |
| Background sync killed by iOS | High | Medium | Treat foreground as primary sync window; rely on `sync.hint` WS on resume. |
| Expo SDK 56 churn vs library compat | Medium | Medium | Verify each native dep against SDK 56 docs (see [AGENTS.md](../AGENTS.md)); pin versions. |
| Money precision bugs (float drift) | Medium | High | Use integer cents end-to-end; share `pos-domain` between client and server. |
| Clock skew between devices | Medium | Low | Server is authoritative for ordering; device clocks only used for display. |
| Single pilot cafe blocks launch | Medium | High | Recruit 2 pilots in parallel; have a manual fallback in pilot SLAs. |
| Multi-tenant data leak | Low | Catastrophic | Prisma middleware + RLS + integration tests that try to read across tenants. |
