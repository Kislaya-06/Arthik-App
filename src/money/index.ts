/**
 * src/money: the single home of "how Arthik turns rows into numbers".
 * Screens import from here; they do not re-derive classification, totals, allowance or funding.
 * Rules: docs/ARTHIK_CANONICAL_RULES.md (TXN, SPL, BUD, WAT, MNY).
 */
export * from './dateKeys';
export * from './ledger';
export * from './budgetAllowance';
export * from './budgetStatus';
export * from './overspendFunding';
export { classifyTransaction } from '../lib/transactionUtils';
export type { TransactionKind } from '../lib/transactionUtils';
