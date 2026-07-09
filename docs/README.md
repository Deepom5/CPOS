# CPOS — Offline-First POS Blueprint

Complete technical and product blueprint for **CPOS**, an offline-first cloud-connected POS for small food businesses (cafes, coffee shops, bakeries, juice bars, ice cream shops, food trucks, QSRs).

Built on the existing app stack:

- Expo SDK ~56, React Native 0.85, React 19, TypeScript, `expo-router`
- `react-native-reanimated@4`, `react-native-gesture-handler@2.31`
- Target surfaces: Android tablets, iPads, touchscreen POS terminals, mobile phones

> The repo's [AGENTS.md](../AGENTS.md) warns that Expo SDK 56 changed APIs. Before writing any SDK-specific code, verify against https://docs.expo.dev/versions/v56.0.0/. This blueprint sticks to library choices that are stable on SDK 56 and flags areas that need version verification.

## Document index

1. [Product architecture](01-product-architecture.md)
2. [Offline-first architecture](02-offline-first-architecture.md)
3. [Database schema (Prisma + local SQLite)](03-database-schema.md)
4. [API design + sync contract](04-api-design.md)
5. [React Native app structure](05-app-structure.md)
6. [Design system + component library](06-design-system.md)
7. [User flows + wireframes](07-user-flows-and-wireframes.md)
8. [MVP + future roadmap](08-roadmap.md)
9. [Security model](09-security.md)
10. [Testing strategy](10-testing.md)
11. [Deployment strategy](11-deployment.md)

## Mapping deliverables → docs

| # | Deliverable                  | Document |
|---|------------------------------|----------|
| 1 | Product architecture         | [01](01-product-architecture.md) |
| 2 | Offline-first architecture   | [02](02-offline-first-architecture.md) |
| 3 | Database schema              | [03](03-database-schema.md) |
| 4 | User flow diagrams           | [07](07-user-flows-and-wireframes.md) |
| 5 | Wireframes                   | [07](07-user-flows-and-wireframes.md) |
| 6 | High-fidelity UI direction   | [06](06-design-system.md) |
| 7 | Responsive layouts           | [06](06-design-system.md) |
| 8 | Component library            | [06](06-design-system.md) |
| 9 | API architecture             | [04](04-api-design.md) |
| 10| Source code structure        | [05](05-app-structure.md) |
| 11| MVP roadmap                  | [08](08-roadmap.md) |
| 12| Future roadmap               | [08](08-roadmap.md) |
| 13| Security model               | [09](09-security.md) |
| 14| Testing strategy             | [10](10-testing.md) |
| 15| Deployment strategy          | [11](11-deployment.md) |
| 16| Offline-first design details | [02](02-offline-first-architecture.md) |

## Product positioning, one paragraph

CPOS is a touch-first, offline-first POS for independent food businesses. The cashier opens the app and is selling in under 5 seconds, online or not. Every order, payment, and inventory event is written to local SQLite first, then synced in the background with conflict-safe rules (orders are immutable once placed; payments are append-only; menu pulls never overwrite an active order). The product feel is Square-simple, Linear-smooth, Notion-clean — friendly defaults, large tap targets, calm offline UX, and a sync indicator that is always honest. It scales from a single food truck to a multi-location franchise via a multi-tenant SaaS backend (NestJS + PostgreSQL + Prisma + Redis).
