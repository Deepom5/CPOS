# 05 — React Native App Structure

The repo is a **monorepo** so the mobile app, backend, KDS, and shared types live under one roof and share TypeScript types and validation schemas. Use pnpm workspaces (or npm workspaces) — pnpm is recommended for speed and strict isolation.

> The existing repo currently is just the Expo app at the root. The structure below is the **target** after restructuring; section 5.9 explains how to migrate without breaking the working Expo project.

## 5.1 Monorepo layout

```
cpos/
├─ apps/
│  ├─ mobile/                 # the React Native Expo app (current root project)
│  │  ├─ app.json
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ src/
│  ├─ kds/                    # the same RN binary in KDS mode (built via EAS profile)
│  │  └─ package.json
│  ├─ admin-web/              # Next.js admin panel (post-MVP)
│  └─ api/                    # NestJS backend
│     ├─ package.json
│     ├─ prisma/
│     └─ src/
│
├─ packages/
│  ├─ shared-types/           # zod schemas + inferred TS types (source of truth)
│  ├─ design-system/          # RN component library (NativeWind-based)
│  ├─ sync-protocol/          # request/response types, op shapes, error codes
│  ├─ pos-domain/             # framework-free pricing, discounts, taxes, totals
│  ├─ printer/                # ESC/POS encoder, AirPrint helpers
│  └─ logger/                 # cross-platform structured logger
│
├─ infra/
│  ├─ docker/
│  ├─ terraform/
│  └─ github-actions/
│
├─ pnpm-workspace.yaml
├─ package.json
└─ turbo.json                 # task runner (optional)
```

`packages/pos-domain` is the most important shared package. Pricing logic must be **identical** on the device (for offline totals) and on the server (for validation on push). It is pure TypeScript with zero dependencies and ~100% unit-test coverage.

## 5.2 Mobile app internal structure

```
apps/mobile/src/
├─ app/                       # expo-router file-based routes
│  ├─ _layout.tsx
│  ├─ index.tsx               # redirect → /pos or /login
│  ├─ login.tsx
│  ├─ pin.tsx
│  ├─ (pos)/
│  │  ├─ _layout.tsx          # tabs: POS, Tables, Orders, More
│  │  ├─ pos.tsx              # billing screen
│  │  ├─ tables.tsx
│  │  ├─ orders.tsx
│  │  └─ more.tsx
│  ├─ checkout/
│  │  ├─ index.tsx            # cart review
│  │  ├─ payment.tsx
│  │  └─ receipt.tsx
│  ├─ kds/
│  │  └─ index.tsx            # KDS mode
│  ├─ admin/
│  │  ├─ menu/
│  │  ├─ inventory/
│  │  ├─ customers/
│  │  ├─ employees/
│  │  └─ reports/
│  └─ settings/
│     ├─ index.tsx
│     ├─ printers.tsx
│     ├─ sync.tsx             # sync status screen
│     └─ device.tsx
│
├─ components/                # screen-specific composite components
│  ├─ pos/
│  │  ├─ ProductGrid.tsx
│  │  ├─ CategoryRail.tsx
│  │  ├─ CartPanel.tsx
│  │  ├─ CartItemRow.tsx
│  │  └─ ModifierSheet.tsx
│  ├─ kds/
│  │  ├─ TicketColumn.tsx
│  │  └─ TicketCard.tsx
│  └─ shared/
│     ├─ SyncStatusBanner.tsx
│     └─ OfflineBadge.tsx
│
├─ data/                      # the Data Layer
│  ├─ db/
│  │  ├─ index.ts             # expo-sqlite open + migrations
│  │  ├─ migrations/
│  │  │  ├─ 0001_init.ts
│  │  │  └─ 0002_add_print_queue.ts
│  │  └─ schema.ts            # TS types matching SQL tables
│  ├─ repos/
│  │  ├─ orders.repo.ts
│  │  ├─ products.repo.ts
│  │  ├─ customers.repo.ts
│  │  ├─ tables.repo.ts
│  │  ├─ inventory.repo.ts
│  │  └─ outbox.repo.ts
│  ├─ api/
│  │  ├─ client.ts            # typed fetch wrapper, auth, retry
│  │  └─ endpoints/
│  │     ├─ auth.ts
│  │     ├─ sync.ts
│  │     ├─ menu.ts
│  │     └─ ...
│  └─ sync/
│     ├─ SyncEngine.ts
│     ├─ pullSync.ts
│     ├─ pushSync.ts
│     ├─ scheduler.ts
│     ├─ resolvers/
│     │  ├─ order.resolver.ts
│     │  ├─ menu.resolver.ts
│     │  ├─ customer.resolver.ts
│     │  └─ inventory.resolver.ts
│     └─ types.ts
│
├─ domain/                    # framework-free business services
│  ├─ orders/
│  │  ├─ createOrder.ts
│  │  ├─ addItem.ts
│  │  ├─ applyDiscount.ts
│  │  ├─ submitOrder.ts
│  │  ├─ voidOrder.ts
│  │  └─ refundOrder.ts
│  ├─ payments/
│  │  ├─ tenderCash.ts
│  │  ├─ recordCardPayment.ts
│  │  └─ refundPayment.ts
│  └─ inventory/
│     ├─ recordEvent.ts
│     └─ projectStock.ts
│
├─ state/                     # Zustand stores
│  ├─ sessionStore.ts         # employee, location, device, tokens (encrypted via secure-store)
│  ├─ cartStore.ts            # active draft order in memory (mirrors DB row)
│  ├─ syncStore.ts            # online/offline, pending count, last sync time
│  └─ uiStore.ts              # modals, toasts, theme
│
├─ hooks/
│  ├─ useOrders.ts            # TanStack Query hooks backed by repos
│  ├─ useProducts.ts
│  ├─ useSyncStatus.ts
│  ├─ usePrinter.ts
│  └─ useHaptics.ts
│
├─ platform/
│  ├─ secureStore.ts          # expo-secure-store wrapper
│  ├─ mmkv.ts                 # react-native-mmkv wrapper
│  ├─ netinfo.ts              # connection state machine
│  ├─ print/
│  │  ├─ PrintAdapter.ts      # interface
│  │  ├─ EscPosBle.ts
│  │  ├─ EscPosTcp.ts
│  │  └─ AirPrint.ts
│  ├─ ble.ts
│  └─ background.ts           # expo-task-manager registration
│
├─ ui/                        # design-system re-exports + theme
│  └─ index.ts                # re-export from @cpos/design-system
│
├─ utils/
│  ├─ money.ts                # integer-cents math
│  ├─ uuid.ts                 # v7 generator
│  ├─ time.ts
│  ├─ result.ts               # Result<T, E> for domain returns
│  └─ retry.ts
│
└─ env.ts                     # validated environment via zod
```

### State boundaries (rules)

- **No screen component reads from the DB directly.** Always through a `useXxx` hook → repo.
- **No repo function is async without a SQLite transaction.** Bare `await db.run()` calls outside transactions are a lint error (enforced by a custom ESLint rule).
- **No domain function imports React.** It must be runnable in Node for tests and on the server.
- **`pos-domain` package is the only place pricing math lives.** Server imports the same package.

## 5.3 Routing

`expo-router` typed routes are enabled (`app.json` already sets `experiments.typedRoutes: true`).

Route groups:

| Group | Auth required | Audience |
|---|---|---|
| `/login`, `/pin` | no | anonymous |
| `/(pos)/*` | yes, cashier+ | cashier on duty |
| `/checkout/*` | yes, cashier+ | active order owner |
| `/admin/*` | yes, manager+ | manager/owner |
| `/kds` | yes, kitchen role | KDS device |
| `/settings/*` | yes, manager+ except `/settings/sync` (cashier) | mixed |

Auth-guarded layouts redirect inside `_layout.tsx` based on `sessionStore.role`.

## 5.4 Dependency map (key packages)

| Concern | Package | Notes |
|---|---|---|
| Routing | `expo-router` (in repo) | Typed routes enabled. |
| State | `zustand` | Add. Tiny, no provider. |
| Server cache | `@tanstack/react-query` | Backed by local repos, not the network. |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers/zod` | Shared schemas live in `packages/shared-types`. |
| Local DB | `expo-sqlite` | Verify SDK 56 API at https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/. |
| KV | `react-native-mmkv` | For session + transient flags. |
| Secure storage | `expo-secure-store` | Tokens, deviceSecret. |
| Network | `@react-native-community/netinfo` | + custom reachability probe. |
| Animations | `react-native-reanimated@4` (in repo) | Already present. |
| Gestures | `react-native-gesture-handler@2.31` (in repo) | Already present. |
| Styling | `nativewind@^4` | Tailwind-on-RN; works with RN 0.85. Alternative: Tamagui. |
| Icons | `@expo/vector-icons` or `lucide-react-native` | Lucide preferred for consistency. |
| Charts | `victory-native` or `react-native-svg-charts` | Reports screen only. |
| Bluetooth | `react-native-ble-plx` | Requires custom dev client (not Expo Go). |
| LAN printing | `react-native-tcp-socket` | Custom dev client. |
| Background tasks | `expo-background-fetch` + `expo-task-manager` | Verify SDK 56 changes. |
| Push notifications | `expo-notifications` | For low-stock + sync hints. |
| Error tracking | `@sentry/react-native` | |
| Testing | `jest`, `@testing-library/react-native`, `detox` for e2e | |

> **Custom dev client required.** Anything beyond the Expo Go shipped modules (BLE, TCP sockets, MMKV native binding) needs `eas build --profile development` to produce a dev client. Document this on day one.

## 5.5 Backend (`apps/api`) structure

```
apps/api/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ src/
│  ├─ main.ts                  # bootstrap
│  ├─ app.module.ts
│  ├─ common/
│  │  ├─ guards/               # JwtGuard, RolesGuard, TenantGuard, DeviceGuard
│  │  ├─ interceptors/         # IdempotencyInterceptor, TraceIdInterceptor
│  │  ├─ pipes/                # ZodValidationPipe
│  │  ├─ decorators/           # @Tenant(), @CurrentEmployee()
│  │  └─ errors/               # ProblemDetails exception filter
│  ├─ modules/
│  │  ├─ auth/
│  │  ├─ tenants/
│  │  ├─ menu/
│  │  ├─ orders/
│  │  ├─ payments/
│  │  ├─ tables/
│  │  ├─ kitchen/
│  │  ├─ inventory/
│  │  ├─ customers/
│  │  ├─ reports/
│  │  ├─ sync/
│  │  ├─ audit/
│  │  └─ webhooks/
│  ├─ realtime/
│  │  └─ realtime.gateway.ts   # WS gateway
│  ├─ infra/
│  │  ├─ prisma.service.ts
│  │  ├─ redis.service.ts
│  │  ├─ s3.service.ts
│  │  └─ mailer.service.ts
│  └─ workers/
│     ├─ sync-conflict.worker.ts
│     ├─ report-rollup.worker.ts
│     ├─ low-stock.worker.ts
│     └─ webhook-dispatch.worker.ts
├─ test/
└─ package.json
```

## 5.6 Shared packages

### `packages/shared-types`

```
src/
  schemas/
    order.ts          # z.object(...) for order create/update payloads
    payment.ts
    inventory.ts
    sync.ts           # PushBatch, PushResult, PullResponse
  index.ts            # exports z.infer types
```

Both mobile and api import from this package. A change to a request shape breaks the build in both places — that is the point.

### `packages/pos-domain`

```
src/
  money.ts            # cents math, formatting, conversions
  pricing/
    calculateLineTotal.ts
    calculateOrderTotals.ts
    applyDiscount.ts
    applyTaxes.ts
    splitBill.ts
  order/
    canTransition.ts
    submitGuards.ts
  __tests__/
```

100% pure functions. Tested with Vitest/Jest in isolation.

### `packages/design-system`

See [06-design-system.md](06-design-system.md).

## 5.7 Build & dev scripts

Root `package.json`:

```jsonc
{
  "scripts": {
    "dev:mobile": "pnpm -F @cpos/mobile start",
    "dev:api":    "pnpm -F @cpos/api start:dev",
    "dev:db":     "docker compose -f infra/docker/compose.dev.yml up -d",
    "build":      "turbo run build",
    "test":       "turbo run test",
    "lint":       "turbo run lint",
    "typecheck":  "turbo run typecheck"
  }
}
```

## 5.8 TypeScript config

- `tsconfig.base.json` at root: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Each app/package extends it and adds `paths` for cross-package imports.
- React Native uses Metro's `resolver.unstable_enablePackageExports` to pick up workspace packages cleanly.

## 5.9 Migration from current repo

The current repo is a single Expo app at the root. To move to the monorepo without breaking it:

1. Create `apps/mobile/` and move everything except top-level `LICENSE`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/` into it.
2. Add `pnpm-workspace.yaml` and a root `package.json` with `"private": true` and `"workspaces": ["apps/*","packages/*"]`.
3. Update `apps/mobile/app.json` paths (they are already relative; only the working directory changes).
4. Add the `packages/` skeletons empty at first; introduce them as features need them.
5. Run `pnpm install` from the root.

The migration is reversible. Until features actually need shared packages, the app keeps working unchanged inside `apps/mobile/`.
