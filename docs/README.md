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
| [`architecture.md`](architecture.md) | **System architecture** — layer map, stores, offline path, startup sequence, Gullak engine, auth, navigation, test architecture. Start here for any structural question. |
| [`prd.md`](prd.md) | **Product Requirements Document** — feature inventory, constraints, UX principles, roadmap, technical risks. |
| [`adr/`](adr/) | **Architecture Decision Records** — why key architectural choices were made. Read ADRs that touch the area you're working in before making changes. |
| [`maps/`](maps/) | **Deep technical maps** — detailed function-level analysis of complex files. Read before editing hot files. |
| [`agents/`](agents/) | **Agent tooling** — instructions for how agent skills interact with this repo's issue tracker, triage labels, and domain docs. |

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

---

## Maps Index

| Map | Subject | Lines |
|---|---|---|
| [daily-budget-map.md](maps/daily-budget-map.md) | Deep architectural analysis of `src/store/dailyBudgetStore.ts` | 442 |

---

## How to Add an ADR

1. Copy the file name pattern: `NNNN-short-hyphenated-title.md`
2. Next available number after `0009`.
3. Sections: **Context**, **Decision**, **Consequences**, **What Would Have to Be True to Revisit**.
4. If the ADR supersedes an older one, add a `## Status: Superseded by NNNN` to the old ADR.
5. Add the new ADR to the index table above and to `docs/architecture.md §12`.
