import { useNotificationStore } from '../store/notificationStore';
import { triggerDeviceNotification } from './notificationService';
import {
  Cadence,
  LimitCopyInput,
  budgetUpdatedCopy,
  limitCopy,
  rolloverCopy,
} from './notificationPolicy';

/**
 * Notifications caused by the user's OWN actions inside the app (they are looking at the app when these happen).
 *
 *  - "80% used"        -> in-app bell only (a phone banner is redundant while the user is on the screen)
 *  - "Over the limit"  -> bell + a SILENT phone banner (the one moment worth interrupting for)
 *  - rollover / budget updated -> bell only (the morning "saved yesterday" phone message is scheduled separately)
 *
 * Wording lives in notificationPolicy.ts. Ids stay stable so each event is stored at most once.
 */

export interface LimitEventInput extends LimitCopyInput {
  id: string;
  date: string;
  periodKey?: string;
}

export function notifyLimit(e: LimitEventInput): void {
  const { title, body } = limitCopy(e);
  const type = e.kind === 'exceeded' ? 'budget_exceeded' : 'budget_warning';

  useNotificationStore.getState().addNotification({
    id: e.id,
    title,
    message: body,
    type,
    data: { date: e.date, periodKey: e.periodKey, amount: e.spent, remaining: e.remaining, screen: 'Savings' },
  });

  triggerDeviceNotification(
    title,
    body,
    { type, screen: 'Savings', date: e.date, presentation: e.kind === 'exceeded' ? 'always' : 'background' },
    'alerts'
  );
}

export interface RolloverEventInput {
  id: string;
  cadence: Cadence;
  amount: number;
  date?: string;
  periodId?: string;
}

export function notifyRollover(e: RolloverEventInput): void {
  const { title, body } = rolloverCopy(e.cadence, e.amount);
  useNotificationStore.getState().addNotification({
    id: e.id,
    title,
    message: body,
    type: 'savings_rollover',
    data: { date: e.date, periodId: e.periodId, cadence: e.cadence, amount: e.amount, screen: 'Savings' },
  });
}

export function notifyBudgetUpdated(id: string, amount: number, date: string): void {
  const { title, body } = budgetUpdatedCopy(amount);
  useNotificationStore.getState().addNotification({
    id,
    title,
    message: body,
    type: 'general',
    data: { date, amount, screen: 'Savings' },
  });
}
