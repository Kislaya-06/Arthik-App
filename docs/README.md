# Arthik Docs

Engineering documentation for the **Arthik** personal finance app.

---

## Navigation

### Top-Level References

| File | Purpose |
|---|---|
| [`../CONTEXT.md`](../CONTEXT.md) | **Domain glossary** — canonical vocabulary for all domain concepts. Read before naming anything. |
| [`../AGENTS.md`](../AGENTS.md) | **Agent rules** — architecture, commands, test coverage rules, definition of done. Read before writing any code. |
| [`../CHANGELOG.md`](../CHANGELOG.md) | User-facing change log. Update with every shipped feature. |
| [`../schema.sql`](../schema.sql) | Postgres DDL + RLS policies. Source of truth for the database. |

### Docs Folder

| Path | Purpose |
|---|---|
| [`ARTHIK_DESIGN_SYSTEM.md`](ARTHIK_DESIGN_SYSTEM.md) | **Design Contract** — core design principles, typography hierarchy, financial-number roles, component rules, audit checklist. Read before any UI work. |
| [`design-system.md`](design-system.md) | **Design System Usage Guide** — token tables, component specs, allowed exceptions, correct/incorrect usage examples. |
| [`architecture.md`](architecture.md) | **System architecture** — layer map, stores, offline path, startup sequence, Gullak engine, auth, navigation, test architecture. Start here for any structural question. |
| [`prd.md`](prd.md) | **Product Requirements Document** — feature inventory, constraints, UX principles, roadmap, technical risks. |
| [`notifications.md`](notifications.md) | **Notification Policy** — rules, schedule matrix, channel breakdown, and single-source-of-truth invariants. |
| [`adr/`](adr/) | **Architecture Decision Records** — why key architectural choices were made. Read ADRs that touch the area you're working in before making changes. |
| [`maps/`](maps/) | **Deep technical maps** — detailed function-level analysis of complex files. Read before editing hot files. |

---

## ADR Index

| ADR | Title | Status |
|---|---|---|
| [0001](adr/0001-offline-first-asyncstorage-write-path.md) | Offline-First Architecture with AsyncStorage Queues | Active |
| [0002](adr/0002-income-inferred-from-category-keywords.md) | Income Inferred from Category Keywords | Active |
| [0003](adr/0003-zustand-stores-as-sole-data-access-layer.md) | Zustand Stores as the Sole Data-Access Layer | Active |
| [0004](adr/0004-supabase-anon-key-and-user-scoped-rls.md) | Supabase Anon Key and User-Scoped Row-Level Security | Active |
| [0005](adr/0005-cross-store-wiring-via-registration-callbacks.md) | Cross-Store Wiring via Explicit Registration Callbacks | Active |
| [0006](adr/0006-ota-updates-tied-to-app-version.md) | Over-The-Air Updates Tied to App Version Policy | Active |
| [0007](adr/0007-income-classification-divergence.md) | Dual-Engine Income Classification Divergence | **Superseded by 0008** |
| [0008](adr/0008-unified-income-classification.md) | Unified Income Classification via isIncomeTransaction | Active |
| [0009](adr/0009-vitest-unit-test-coverage.md) | Vitest Unit Test Coverage for Store & Library Seams | Active |
| [0010](adr/0010-budget-cadence-periods.md) | Multi-Cadence Budget Modes and Period Engine | Active (D4 superseded by 0011) |
| [0011](adr/0011-zero-proration-and-digital-vault-spending-guard.md) | Zero-Proration Policy and Digital Vault Spending Guard | Active |

---

## Maps Index

| Map | Subject | Lines |
|---|---|---|
| [daily-budget-map.md](maps/daily-budget-map.md) | Deep architectural analysis of `src/store/dailyBudgetStore.ts` | 483 |

---

## How to Add an ADR

1. Copy the file name pattern: `NNNN-short-hyphenated-title.md`
2. Next available number after `0011`.
3. Sections: **Context**, **Decision**, **Consequences**, **What Would Have to Be True to Revisit**.
4. If the ADR supersedes an older one, add a `## Status: Superseded by NNNN` to the old ADR.
5. Add the new ADR to the index table above and to `docs/architecture.md §12`.

---

## Living Documentation Invariant

Documentation in Arthik is maintained continuously alongside the code:
- Whenever any feature, bugfix, architectural change, or test suite update is made, **all relevant documentation files MUST be updated in the exact same task/commit**.
- Test counts, store lists, routes, notification rules, and product behaviors must never drift from code reality.
- See [`../AGENTS.md §17`](../AGENTS.md) and [`§19`](../AGENTS.md) for full rules and enforcement.
