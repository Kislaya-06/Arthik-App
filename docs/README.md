# Arthik Documentation & Repository Anchor

Engineering documentation, architectural blueprints, and canonical guides for the **Arthik** personal finance app (Android, React Native 0.86, Expo SDK 57, Supabase).

---

## 1. Repository Master Navigation Anchor

Every Markdown documentation file in this repository is cataloged below with its location, semantic role, and primary authority.

### Top-Level Root Documents (`/`)

| File | Purpose & Role | Authority |
|---|---|---|
| [`../README.md`](../README.md) | **Public GitHub Entrypoint** — project description, screenshots, features, local setup, run commands. | Public / Humans |
| [`../AGENTS.md`](../AGENTS.md) | **Supreme AI Governance** — architecture, Real-Money Invariant, git commit/push restrictions, 4-stage quality gate. | Supreme Rulebook |
| [`../CONTEXT.md`](../CONTEXT.md) | **Domain Glossary & Terminology** — canonical definitions of Expense, Income, Allowance, Gullak, Waterfall. | Domain Vocabulary |
| [`../CHANGELOG.md`](../CHANGELOG.md) | **User-Facing Release History** — chronological log of features, fixes, and in-app OTA update highlights. | Release Log |
| [`ARTHIK_CANONICAL_RULES.md`](ARTHIK_CANONICAL_RULES.md) | **Canonical Money Rules** — the single supreme source of truth for every business / financial / accounting rule. Code, tests and all other docs must agree with it; changed only on explicit owner approval. | **Supreme Source of Truth** |
| [`../schema.sql`](../schema.sql) | **Postgres DDL & RLS Policies** — database schema and security source of truth. | Database Truth |

---

### Core Documentation (`docs/`)

| Path | Purpose & Role | Authority |
|---|---|---|
| [`architecture.md`](architecture.md) | **System Architecture (v2.1.0)** — 11 layers, stores, offline-first queues, startup hydration, security, tests. | Master Architecture |
| [`design-system.md`](design-system.md) | **Unified Design System & UI Specification** — canonical design contract, principles, token tables, component specs. | UI / Design Truth |
| [`AUTO_LOGGING.md`](AUTO_LOGGING.md) | **Automatic Logging Architecture (v2.0)** — Kotlin modules, SQLCipher encrypted SQLite, parsing, deduplication engine. | Auto-Log Engine |
| [`notifications.md`](notifications.md) | **Notification Policy & Schedule Matrix** — max 1/day rule, evening nudge, Gullak reward, recaps, channels. | Notification Policy |
| [`prd.md`](prd.md) | **Product Requirements Document (PRD)** — Indian cash+UPI problem statement, user personas, habit loops. | Product Baseline |
| [`RELEASE_PROCESS.md`](RELEASE_PROCESS.md) | **Release Engineering SOP** — 4-phase APK build, OTA updates, asset naming, Supabase force-update flags. | Release SOP |
| [`CODEBASE_GUIDE.md`](CODEBASE_GUIDE.md) | **Codebase Walkthrough & File Map** — 204 files, architectural layers, core money mechanics, where to change what. | Codebase Walkthrough |

---

### Deep Technical Maps & Feature Specifications

| Path | Purpose & Role | Lines |
|---|---|---|
| [`maps/daily-budget-map.md`](maps/daily-budget-map.md) | **Daily Budget Submodules Map** — detailed function and data mapping of `src/store/dailyBudget/*`. | 507 |
| [`specs/EMAIL_AUTO_LOGGING_SPEC.md`](specs/EMAIL_AUTO_LOGGING_SPEC.md) | **Email Notification Auto-Logging Spec** — bank email parsing boundaries, dual-core deduplication, privacy controls. | 705 |

---

## 2. Architecture Decision Records (ADR Index)

All architectural and financial logic decisions are recorded in [`docs/adr/`](adr/):

| ADR | Title | Status |
|---|---|---|
| [0001](adr/0001-offline-first-asyncstorage-write-path.md) | Offline-First Architecture with AsyncStorage Queues | Active |
| [0002](adr/0002-income-inferred-from-category-keywords.md) | Income Inferred from Category Keywords | Legacy (amended by 0008; keyword path is inert, `TXN-002`) |
| [0003](adr/0003-zustand-stores-as-sole-data-access-layer.md) | Zustand Stores as the Sole Data-Access Layer | Active |
| [0004](adr/0004-supabase-anon-key-and-user-scoped-rls.md) | Supabase Anon Key and User-Scoped Row-Level Security | Active |
| [0005](adr/0005-cross-store-wiring-via-registration-callbacks.md) | Cross-Store Wiring via Explicit Registration Callbacks | Active |
| [0006](adr/0006-ota-updates-tied-to-app-version.md) | Over-The-Air Updates Tied to App Version Policy | Active |
| [0007](adr/0007-income-classification-divergence.md) | Dual-Engine Income Classification Divergence | **Superseded by 0008** |
| [0008](adr/0008-unified-income-classification.md) | Unified Income Classification via isIncomeTransaction | Active |
| [0009](adr/0009-vitest-unit-test-coverage.md) | Vitest Unit Test Coverage for Store & Library Seams | Active |
| [0010](adr/0010-budget-cadence-periods.md) | Multi-Cadence Budget Modes and Period Engine | Active (D4 superseded by 0011, amended by 0012) |
| [0011](adr/0011-zero-proration-and-digital-vault-spending-guard.md) | Zero-Proration Policy and Digital Vault Spending Guard | Active (amended by 0012) |
| [0012](adr/0012-one-budget-per-calendar-period.md) | One Budget per Calendar Period, and Pure Mode Keeps the Same Books | Active |
| [0013](adr/0013-store-module-split.md) | Store Helper Decomposition and Module Encapsulation | Active |
| [0014](adr/0014-canonical-rules-and-implementation-status.md) | Canonical Rules File, Retired Split Feature, and CAR-001 Implementation Status | Active (split part superseded by 0016) |
| [0015](adr/0015-ui-thread-reanimated-worklet-migration-and-render-optimizations.md) | UI-Thread Reanimated Worklet Migration and Render Optimizations | Active |
| [0016](adr/0016-split-expenses-and-money-back.md) | Split Expenses, Money Back and Refunds | Active |
| [0017](adr/0017-money-layer-and-payback-review.md) | Unified Money Layer and Payback Review Resolution | Active |
| [0018](adr/0018-settle-review-choose-then-confirm.md) | Payback Review: Choose the Person, Then Confirm | Active |
| [0019](adr/0019-income-categories.md) | Income Categories and Required Category on Review | Active |
| [0020](adr/0020-transform-only-pills-and-commit-after-landing.md) | Transform-Only Pills, Commit After Landing, and the Touch Fence | Active |

---

## 3. How to Add a New ADR

1. Copy the file name pattern: `NNNN-short-hyphenated-title.md`
2. Next available number after `0020` (i.e. `0021`).
3. Standard sections: **Context**, **Decision**, **Consequences**, **What Would Have to Be True to Revisit**.
4. If the new ADR supersedes an older one, mark `## Status: Superseded by NNNN` in the old ADR.
5. Register the new ADR in the table above and in `docs/architecture.md §13`.

---

## 4. Living Documentation Invariant

Documentation in Arthik is maintained continuously alongside the code:
- Whenever any feature, bugfix, architectural change, or test suite update is made, **all relevant documentation files MUST be updated in the exact same task**.
- Test counts, store submodules, routes, notification rules, and product behaviors must never drift from code reality.
- See [`../AGENTS.md §17`](../AGENTS.md) and [`§19`](../AGENTS.md) for enforcement rules.
