# 10 — Testing Strategy

## 10.1 Goals

1. **Never lose an order.** Most critical invariant — the test suite enforces it.
2. **Pricing math is identical client and server.** A property test runs both implementations against the same inputs.
3. **Sync converges.** Any reachable network sequence ends in a consistent state.
4. **The app is usable on a real low-end Android tablet.** Performance regressions block merges.

## 10.2 Test pyramid

| Layer | Where | Runner | Target coverage |
|---|---|---|---|
| Unit | `packages/pos-domain`, `apps/mobile/src/domain`, repos | Jest / Vitest | ≥ 95% |
| Sync integration | `apps/mobile/src/data/sync` against a mock API | Jest + msw | ≥ 80% |
| Component | `apps/mobile` UI | `@testing-library/react-native` | Smoke per component |
| API integration | `apps/api` against a real Postgres in Docker | Jest + supertest | ≥ 75% |
| Contract | shared zod schemas | Vitest (runs in both packages) | 100% of schemas |
| End-to-end | Detox on iOS sim + Android emulator | Detox | Smoke + critical flows |
| Performance | Maestro flows + Reassure | Maestro + Reassure | Budgets per release |
| Manual scripted | Pilot store | Checklist | Each milestone |

## 10.3 Critical test suites

### 10.3.1 Order persistence invariant

A property-based test (`fast-check`) generates random sequences of `addItem`, `removeItem`, `applyDiscount`, `submit`, `tenderCash` actions and asserts:

1. After each step the order is fully readable from SQLite.
2. After a simulated crash (close + reopen DB) the state is identical.
3. The outbox contains exactly one op per state-changing action.
4. Submitted orders never lose payments.

```ts
fc.assert(fc.property(
  fc.array(orderActionArbitrary, { minLength: 1, maxLength: 30 }),
  async (actions) => {
    const db = await openTestDb();
    for (const a of actions) await applyAction(db, a);
    const snapshotA = await readOrderTree(db);
    await db.close();
    const db2 = await openTestDb();
    const snapshotB = await readOrderTree(db2);
    expect(snapshotB).toEqual(snapshotA);
  }
));
```

### 10.3.2 Pricing parity

```ts
fc.assert(fc.property(orderInputArbitrary, (input) => {
  const clientTotals = computeTotals(input);           // from @cpos/pos-domain
  const serverTotals = computeTotalsServer(input);     // imported in api tests
  expect(clientTotals).toEqual(serverTotals);
}));
```

Both `computeTotals` calls resolve to the **same module**. The test guards against accidental divergence (e.g. someone adding a server-only rounding rule).

### 10.3.3 Sync convergence

A discrete-event simulator drives two virtual devices and one virtual server:

- Each tick, each device may: do a local mutation, attempt sync, go offline/online.
- After a fixed number of ticks with the network up, all three replicas must converge to the same canonical state for every entity (modulo conflicts that should remain in the `conflicts` table).

This catches subtle issues like out-of-order operations, double-apply, and lost tombstones.

### 10.3.4 Idempotency

Every mutating endpoint has a test:

1. Send request with `Idempotency-Key=K`. Expect 200 with response R.
2. Send the same request body with `Idempotency-Key=K`. Expect 200 with header `Idempotency-Replayed: true` and body equal to R.
3. Send the same key with a **different** body. Expect 409 `idempotency_mismatch`.

### 10.3.5 Tenant isolation

A red-team test logs in as Tenant A and tries every endpoint with ids belonging to Tenant B. Every attempt must produce 404 (never 403, to avoid revealing existence). The test also probes for SQL injection via numeric and uuid parameters.

### 10.3.6 Money precision

```ts
test('1000 random orders never drift', () => {
  for (let i = 0; i < 1000; i++) {
    const order = randomOrder();
    const sumOfLines = order.items.reduce((s, it) => s + lineTotalCents(it), 0);
    expect(orderTotalCents(order)).toBe(sumOfLines + taxCents(order) - discountCents(order));
  }
});
```

All math runs on integer cents. If a future change uses a float anywhere, a lint rule (`no-money-floats`) flags it.

## 10.4 Component tests

For each design-system component:

- Renders with default props.
- Honors `disabled`, `loading`, `tone` props (visual snapshot in light + dark).
- Fires `onPress` when tapped, not when disabled.
- A11y label / role correct.

POS composites get focused tests rather than snapshots:

- `CartItemRow`: swipe-left shows remove; tapping remove deletes the row; undo restores.
- `ModifierSheet`: respects `min/max` selection; price reflects deltas live.
- `SyncStatusBanner`: hides when `online && pending===0 && failed===0`.

## 10.5 End-to-end (Detox)

Three Detox suites, each tagged so they can run independently in CI:

### `e2e/critical.spec.ts` — must pass to release

1. Login as cashier with email/password.
2. Add a product to cart.
3. Charge cash, get exact change.
4. Print receipt (mock printer).
5. Open Orders, see the new order.

### `e2e/offline.spec.ts`

1. Disable network in the simulator.
2. Login with PIN (cached employee).
3. Create order + tender cash.
4. See "Offline — will sync".
5. Re-enable network.
6. Sync status banner clears within 30s.
7. Order appears on the server (queried via supertest from the test runner).

### `e2e/kds.spec.ts`

1. POS submits an order.
2. KDS sees the ticket within 5s (over LAN broadcast, network on).
3. Tap "Preparing" → POS sees the status flip.
4. Tap "Ready" → KDS card moves to Ready column.

## 10.6 Performance budgets

Enforced by `reassure` and Maestro performance flows.

| Metric | Budget | How measured |
|---|---|---|
| Cold start to POS screen interactive | < 1500 ms | Maestro on Pixel Tablet (Android 14) |
| Add-to-cart frame time | < 16 ms p95 | Reassure `<ProductGrid>` benchmark |
| Cart panel re-render on quantity bump | < 20 ms | Reassure |
| Order write to disk before payment screen | always | Detox: assert `orders.id` exists in SQLite when payment screen renders |
| Push sync batch round-trip (50 ops) | < 800 ms p95 | API integration test against local Postgres |

Regressions of >10% on any budget fail CI.

## 10.7 Test data & fixtures

- `packages/shared-types/src/fixtures/` exports factory functions: `aProduct()`, `anOrder({ items: 3 })`, `aPayment({ method: 'CASH' })`. Used by every test runner.
- Mobile tests start each case with a fresh in-memory SQLite (`expo-sqlite` supports `:memory:`).
- Server tests start each case in a Postgres transaction that is rolled back at the end (testcontainers).

## 10.8 Continuous integration

`.github/workflows/ci.yml` (one workflow, multiple jobs):

| Job | Triggers | Steps |
|---|---|---|
| `lint-typecheck` | every PR | pnpm install → `turbo lint typecheck` |
| `unit` | every PR | `turbo test --filter='./packages/*'` |
| `mobile-test` | every PR | RN tests + reassure |
| `api-test` | every PR | spin up Postgres + Redis → API integration |
| `e2e-android` | PR labelled `e2e` + main | Detox on Android emulator (AVD cached) |
| `e2e-ios` | PR labelled `e2e` + main | Detox on iOS sim (macOS runner) |
| `build-android` | main + tags | `eas build --profile preview --platform android` |
| `build-ios` | main + tags | `eas build --profile preview --platform ios` |

Caching: pnpm store, Turbo cache, Detox build artifacts, AVD snapshots. Target wall-clock for `lint-typecheck` + `unit` + `mobile-test` + `api-test` on a PR: under 10 minutes.

## 10.9 Manual test checklists

A short checklist per milestone, executed on real devices before any release branch:

- Print a receipt on the lab BLE printer with a 3-line item that wraps.
- Pull the Wi-Fi cable mid-checkout; complete the order; reconnect; confirm sync.
- Force-quit the app during sync; relaunch; confirm no duplicate orders.
- Change a product price on the admin; ensure the active order keeps the snapshot price.
- Turn the tablet display from landscape to portrait during a cart edit; no UI breaks.
- Battery 5% mode (Android low-power): app still hits frame budgets.

## 10.10 Test ownership

| Area | Primary owner |
|---|---|
| `pos-domain` math | Backend tech lead (server consumes same) |
| Sync engine | Mobile tech lead |
| API integration | Backend lead |
| Detox suites | QA + Mobile lead |
| Performance budgets | Mobile lead |
| Pilot manual checklist | PM + on-site lead |
