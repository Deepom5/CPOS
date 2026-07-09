# 09 — Security Model

CPOS handles money, customer data, and employee identities. Security follows the project's [default instructions](../AGENTS.md) and the OWASP guidance referenced there. This doc captures the concrete decisions.

## 9.1 Threat model (short)

| Asset | Threats | Primary mitigations |
|---|---|---|
| Sales records | tampering, deletion to dodge tax | Immutable payment ledger, append-only audit log, signed device hand-off |
| Customer PII | exfiltration, cross-tenant leakage | RLS + Prisma tenant middleware, encrypted-at-rest fields, minimum collection |
| Employee credentials | shoulder surfing, PIN brute force | Short PIN with throttling, manager override required for sensitive ops |
| Device tokens | stolen device | Per-device refresh family with reuse detection, remote revoke, encrypted SecureStore |
| Sync API | replay, IDOR, mass enumeration | Idempotency keys, tenant guard, cursor-only pagination, rate limits |
| Backups | leakage of all customer data | KMS-encrypted snapshots, separate IAM role for restore, restore drills |
| Local SQLite on device | physical device theft | SQLCipher (paid native lib) **or** OS file protection + screen lock + remote revoke |

## 9.2 Authentication

### Identities

- **Tenant**: a billing customer (one organization).
- **Employee**: a real person with a role and a PIN. May also have an email/password if Owner/Manager.
- **Device**: a registered POS/KDS/admin device tied to a tenant and a default location.

### Tokens

| Token | Lifetime | Storage | Rotation |
|---|---|---|---|
| Access token (JWT) | 15 minutes | RAM only (Zustand) | Re-issued on refresh |
| Refresh token | 30 days | `expo-secure-store` | Rotated on every use, reuse-detected |
| Device secret | indefinite | `expo-secure-store` | Manual rotate; auto-rotate on suspected leak |
| Offline session token | 12 hours | RAM only | Issued by local PIN check; never crosses network |

JWT claims:

```json
{
  "iss": "https://api.cpos.app",
  "sub": "<employeeId>",
  "tid": "<tenantId>",
  "lid": "<locationId>",
  "did": "<deviceId>",
  "role": "MANAGER",
  "perms": ["order:void","price:edit"],
  "exp": 1750000000,
  "iat": 1749999100,
  "jti": "<uuid>"
}
```

Signed with **EdDSA (Ed25519)**. Keys live in a managed KMS (AWS KMS, GCP KMS, Vault). Public key exposed at `/.well-known/jwks.json` for any future trusted client.

### Refresh-token reuse detection

Refresh tokens are issued in **families**. Each rotation invalidates the previous token; if an invalidated token is presented, the entire family is revoked and an `audit:refresh_reuse` event is emitted with the IP/device. The user must re-login.

### PIN policy

- 4–8 digits, hashed with **argon2id** (memory=64 MiB, iterations=3, parallelism=4).
- Server stores `pin_hash` + a per-employee `pin_salt`.
- Device receives `pin_hash` to validate offline (PIN scope is limited to login + manager override, never to authorize a remote operation directly).
- Throttling: 5 attempts per PIN per minute on a device. After 5 consecutive failures, the employee chooser hides them for 60s and an audit event fires.
- Manager override: a separate manager PIN is required for void/refund/price-override/discount-over-threshold.

### Device registration

- Triggered after a successful email/password login.
- The server issues `{ deviceId, deviceSecret }`. `deviceSecret` is a 256-bit random string.
- On every subsequent token refresh the client signs the request with `HMAC-SHA256(deviceSecret, body+ts)` in an `X-Device-Sig` header; the server verifies it.
- Devices can be revoked from the admin UI; the next API call returns `410 device_revoked` and the app wipes its local DB.

## 9.3 Authorization (RBAC)

Roles ship with predefined permission sets. Permissions are strings checked by guards both on the server (`@Permissions('order:void')`) and on the client (`canI('order:void')` for UI gating).

| Permission | Owner | Manager | Cashier | Kitchen | Inventory | Accountant |
|---|---|---|---|---|---|---|
| `order:create` | ✓ | ✓ | ✓ | — | — | — |
| `order:submit` | ✓ | ✓ | ✓ | — | — | — |
| `order:void`   | ✓ | ✓ | — | — | — | — |
| `order:refund` | ✓ | ✓ | — | — | — | — |
| `payment:capture` | ✓ | ✓ | ✓ | — | — | — |
| `discount:over_threshold` | ✓ | ✓ | — | — | — | — |
| `price:edit` | ✓ | ✓ | — | — | — | — |
| `menu:edit` | ✓ | ✓ | — | — | — | — |
| `inventory:adjust` | ✓ | ✓ | — | — | ✓ | — |
| `inventory:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `kds:update` | ✓ | ✓ | — | ✓ | — | — |
| `employee:manage` | ✓ | ✓ | — | — | — | — |
| `report:read` | ✓ | ✓ | — | — | — | ✓ |
| `device:revoke` | ✓ | ✓ | — | — | — | — |

Client UI never trusts itself. Every restricted UI surface checks `canI(perm)`; every restricted API endpoint re-checks server-side. The two checks are derived from the same `@cpos/shared-types` permission registry to keep them in sync.

## 9.4 Data protection

### At rest

- **Server**: PostgreSQL with encryption at rest (provider-managed). Sensitive fields (`customer.phone`, `customer.email`, `employee.pinHash`, `device.pushToken`) are additionally encrypted with an application-layer KMS-backed envelope cipher. Decryption only happens when needed by a request handler.
- **Object storage**: S3 server-side encryption (SSE-KMS).
- **Device**: Tokens and `deviceSecret` in `expo-secure-store` (Keychain / Keystore). The SQLite file itself is not encrypted by default on Android; for tenants that require it we ship a SQLCipher build path under a feature flag. iOS uses Data Protection (`NSFileProtectionComplete`).

### In transit

- TLS 1.2 minimum, TLS 1.3 preferred.
- HSTS on the admin web.
- Certificate pinning on the mobile API client (pinned to the public CA + a backup) for production builds.
- WSS only; plain WS rejected.

### Field-level

- Phone numbers are E.164-normalized and lowercased for lookups via a separate `phone_hash` column (HMAC-SHA256 with a tenant key) to avoid storing the cleartext in indexes.
- Emails are lowercased and trimmed.

## 9.5 Audit & tamper resistance

- Every state-changing action emits an `AuditLog` row with `actorType`, `actorId`, `action`, `entity`, `entityId`, `before`, `after`, `ip`, `deviceId`, `createdAt`.
- The audit log is **append-only** at the application level. The `AuditLog` table has no UPDATE/DELETE endpoints and uses a Postgres trigger that raises on attempted UPDATE/DELETE outside of a scheduled retention job.
- Payments and inventory events are append-only by design (see [03-database-schema.md](03-database-schema.md)).
- Optional: nightly job emits a **hash chain** over the day's audit rows and stores the chain root in a separate, write-rate-limited table. Tampering becomes detectable.

## 9.6 OWASP Top 10 mapping

| OWASP 2021 | CPOS defense |
|---|---|
| A01 Broken Access Control | RBAC + tenant guard + Prisma middleware + RLS + integration tests that attempt cross-tenant reads. |
| A02 Cryptographic Failures | KMS-managed keys, TLS 1.2+, argon2id PINs, no homemade crypto. |
| A03 Injection | Prisma parameterized queries; zod-validated inputs at every boundary; never interpolate SQL. |
| A04 Insecure Design | Threat model + design reviews documented per milestone (this doc). |
| A05 Security Misconfiguration | Infrastructure as code, restrictive default IAM, automated header checks (CSP, HSTS, X-Content-Type-Options). |
| A06 Vulnerable Components | Renovate bot, `pnpm audit` in CI, SBOM published per release. |
| A07 Identification & Authentication Failures | Reuse-detected refresh tokens, throttled PINs, device binding. |
| A08 Software & Data Integrity Failures | Signed releases (EAS Submit), Sigstore on container images, checksum-verified migrations. |
| A09 Logging & Monitoring Failures | Structured logs, audit log, Sentry, alerts on auth anomalies + sync queue depth. |
| A10 SSRF | The server makes outbound calls only to allow-listed hosts (webhooks must be HTTPS, no link-local or private addresses). |

## 9.7 Webview & embedded HTML

Receipts and reports may render HTML for previews. We enforce:

- A strict CSP for any embedded HTML view (`default-src 'none'; style-src 'self' 'nonce-XXXX'; img-src 'self' data:`).
- Per-render nonce for any inline `<style>`.
- No inline event handlers; webview message types are zod-validated.
- The webview's `originWhitelist` is `[]` (no navigation).

## 9.8 Input validation

- Every API request body is validated with a zod schema from `@cpos/shared-types`.
- Every mobile form uses `react-hook-form` with the same zod schemas.
- Money inputs are validated as non-negative integer cents.
- Phone numbers via a single canonical normalizer.
- Allowlist for `device.platform`, `payment.method`, `inventory.eventType`.

## 9.9 Rate limits & abuse

- `/auth/login` and `/auth/pin`: 10 req/min per IP, 5 req/min per identifier (email or employeeId).
- `/sync/push`: 1,000 ops/min per device.
- WS connections: 5 concurrent per device.
- Public webhooks (future): per-tenant rate buckets with overflow → DLQ.

## 9.10 Secrets management

- All secrets via environment variables loaded from a secret manager (AWS Secrets Manager / Doppler / 1Password Connect). Never in code, never in `.env` committed to git.
- The repo has a pre-commit hook (Husky) running `gitleaks` to catch accidental commits.
- Mobile app build secrets (e.g. Sentry DSN) are injected at build time by EAS Secrets.
- Logs are scrubbed: a recursive redactor removes any field named `pin`, `password`, `secret`, `token`, `authorization`, `cardNumber` before emission.

## 9.11 Compliance posture

- Aim for **PCI-DSS SAQ-A** scope by never touching raw card data. All card processing is delegated to a PCI-validated processor.
- **GDPR / CCPA**: tenants own their data. Export endpoint returns a NDJSON archive of every tenant-scoped row. Delete endpoint hard-deletes after a 30-day grace and a confirmation email.
- **SOC 2** controls map to the audit log, access reviews, IaC, encrypted backups, and quarterly disaster-recovery drills.
- Per-region data residency (EU, IN, US) is an enterprise feature for v1.5+.

## 9.12 Security review gates

| Gate | When | Owner |
|---|---|---|
| Threat-model delta | Each milestone kick-off | Tech lead |
| Dependency audit | Each PR merge | CI |
| Secrets scan | Each commit | Husky + CI |
| Penetration test | Pre-launch + annually | External vendor |
| Restore drill | Quarterly | SRE |
| Access review | Quarterly | CTO |
