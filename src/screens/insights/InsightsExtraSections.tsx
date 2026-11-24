/**
 * The three Insights sections added on 2026-11-25: "Where you're heading" (INS-007/008/009) sits right under the
 * summary strip (`part="heading"`, the most actionable cards); "Your habits" and "Money with others & Gullak"
 * (INS-010/011) sit below the existing sections (`part="rest"`).
 * A section shows only when it has a card; every card hides itself when it has nothing true to say.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { parseISO } from 'date-fns/parseISO';
import { format } from 'date-fns/format';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import Hourglass from 'lucide-react-native/icons/hourglass';
import CalendarCheck from 'lucide-react-native/icons/calendar-check';
import Coins from 'lucide-react-native/icons/coins';
import MapPin from 'lucide-react-native/icons/map-pin';
import Users from 'lucide-react-native/icons/users';
import Trophy from 'lucide-react-native/icons/trophy';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import { BehavioralInsightRow } from '../../components/BehavioralInsightRow';
import { PiggyBankCoinIcon } from '../../components/PiggyBankCoinIcon';
import { useTheme } from '../../store/themeStore';
import { CATEGORY_PALETTE, FontFamily } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';
import { getCategoryIcon } from '../../lib/iconUtils';
import { DAY_PARTS, DayPart, formatRise } from '../../lib/insights/habits';
import type { Category } from '../../store/categoryStore';
import type { InsightsExtras } from './useInsightsExtras';
import type { Period } from './periodUtils';
import { InsightBreakdownCard } from './InsightBreakdownCard';
import { styles } from './InsightsScreen.styles';

const GULLAK_BADGE = '#ADEBB3'; // AGENTS.md §9.9: every Gullak badge
const PiggyIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => <PiggyBankCoinIcon size={size} color={color} />;

const DAY_PART_LABEL: Record<DayPart, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };
const DAY_PART_HOURS: Record<DayPart, string> = { morning: '5 AM – 12 PM', afternoon: '12 – 5 PM', evening: '5 – 9 PM', night: '9 PM – 5 AM' };

const shortDate = (key: string) => format(parseISO(key), 'd MMM');
const monthName = (key: string) => format(parseISO(key), 'MMMM');

/** 12 days / 3 months / 2 years */
export function formatEta(days: number): string {
  if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'}`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
}

interface Props {
  part: 'heading' | 'rest';
  extras: InsightsExtras;
  period: Period;
  categories: Category[];
  onOpenCategory: (categoryId: string) => void;
  onOpenLedger: () => void;
}

export const InsightsExtraSections: React.FC<Props> = ({ part, extras, period, categories, onOpenCategory, onOpenLedger }) => {
  const { colors } = useTheme();
  const { heading, habits, others } = extras;
  const cat = (id: string | null) => categories.find((c) => c.id === id);
  const periodWord = period === 'Weekly' ? 'week' : period === 'Monthly' ? 'month' : 'year';

  const title = (text: string) => (
    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
      {text}
    </Text>
  );

  // ─── Where you're heading ───────────────────────────────────────────────
  const headingCards: React.ReactNode[] = [];
  const p = heading.projection;
  if (p) {
    const vs = heading.isPureMode ? `last ${periodWord}` : 'your budget';
    const over = p.difference !== null && p.difference > 0;
    let detail = p.difference === null
      ? `At your pace so far, with ${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'} left`
      : over
        ? `${formatCurrency(p.difference!)} more than ${vs}${p.dailyCut ? ` · Spend ${formatCurrency(p.dailyCut)} less a day to stay level` : ''}`
        : `${formatCurrency(Math.abs(p.difference!))} less than ${vs}`;
    if (p.majorOutflowCount > 0) detail += ' · Big one-off spends counted once';
    headingCards.push(
      <BehavioralInsightRow
        key="projection"
        icon={over ? TrendingUp : TrendingDown}
        badgeColor={over ? colors.peachCoral : colors.mintGreen}
        title={`${period === 'Weekly' ? 'Week' : 'Month'}-End Estimate`}
        headline={`About ${formatCurrency(Math.round(p.projected))} by the end of this ${periodWord}`}
        detail={detail}
        pillText={p.difference === null ? null : over ? 'Over' : 'On track'}
        pillColor={over ? colors.coralText : colors.mintText}
      />
    );
  }
  const r = heading.runway;
  if (r) {
    headingCards.push(
      <BehavioralInsightRow
        key="runway"
        icon={Hourglass}
        badgeColor={CATEGORY_PALETTE[2]}
        title="Money Runway"
        headline={r.runwayDays > 0 ? `Your money lasts about ${r.runwayDays} ${r.runwayDays === 1 ? 'day' : 'days'}` : 'No spendable money left'}
        detail={`${formatCurrency(Math.max(0, r.spendable))} to spend at ${formatCurrency(Math.round(r.dailyAvg))}/day (last 30 days) · Gullak ${formatCurrency(r.gullak)} kept apart`}
      />
    );
  }
  const eta = heading.gullakEta;
  if (eta) {
    const content =
      eta.status === 'allReached'
        ? { headline: 'Every Gullak milestone reached', detail: 'Your Gullak passed ₹1,00,000. Keep it going!' }
        : eta.status === 'notGrowing'
          ? { headline: 'Gullak is not growing right now', detail: 'More went out of Gullak than came in over the last 90 days' }
          : eta.tooFar
            ? { headline: `${eta.milestone.name}: more than 3 years at this pace`, detail: `Gullak grew ${formatCurrency(eta.perDay)}/day over the last 90 days` }
            : {
                headline: `${eta.milestone.name} in about ${formatEta(eta.etaDays)}`,
                detail: `${formatCurrency(eta.milestone.amount)} goal · Gullak grew ${formatCurrency(eta.perDay)}/day over the last 90 days`,
              };
    headingCards.push(
      <BehavioralInsightRow key="eta" icon={PiggyIcon} badgeColor={GULLAK_BADGE} title="Next Gullak Milestone" {...content} />
    );
  }

  // ─── Your habits ────────────────────────────────────────────────────────
  const habitCards: React.ReactNode[] = [];
  const ns = habits.noSpend;
  if (ns) {
    const longest = ns.longest && ns.longest.length > 1
      ? `Longest run: ${ns.longest.length} days (${shortDate(ns.longest.start)} – ${shortDate(ns.longest.end)})`
      : ns.count === 0 ? 'Every finished day had some spending' : 'Days you spent nothing at all';
    habitCards.push(
      <BehavioralInsightRow
        key="nospend"
        icon={CalendarCheck}
        badgeColor={colors.mintGreen}
        title="No-Spend Days"
        headline={`${ns.count} of ${ns.daysCounted} ${ns.daysCounted === 1 ? 'day' : 'days'}`}
        detail={longest}
      />
    );
  }
  const leaks = habits.smallLeaks;
  if (leaks) {
    const top = cat(leaks.topCategoryId);
    habitCards.push(
      <BehavioralInsightRow
        key="leaks"
        icon={Coins}
        badgeColor={CATEGORY_PALETTE[3]}
        title="Small Spends Add Up"
        headline={`${leaks.count} spends under ₹200 · ${formatCurrency(leaks.total)}`}
        detail={`${Math.round(leaks.shareOfSpending * 100)}% of this ${periodWord}'s spending${top ? ` · Most in ${top.name}` : ''}`}
        onPress={top ? () => onOpenCategory(top.id) : undefined}
      />
    );
  }
  const tod = habits.timeOfDay;
  if (tod) {
    habitCards.push(
      <InsightBreakdownCard
        key="tod"
        title="When You Spend"
        headline={`${DAY_PART_LABEL[tod.top]} · ${Math.round(tod.topShare * 100)}% of your spending`}
        segments={DAY_PARTS.map((d, i) => ({ label: `${DAY_PART_LABEL[d]} (${DAY_PART_HOURS[d]})`, amount: tod.amounts[d], color: CATEGORY_PALETTE[i] }))}
        footnote={tod.usedEntries < tod.totalEntries ? `From ${tod.usedEntries} of ${tod.totalEntries} entries · Late entries left out` : undefined}
      />
    );
  }
  const baseWord = period === 'Weekly' ? '4-week' : '3-month';
  for (const s of habits.categoryShifts) {
    const c = cat(s.categoryId);
    if (!c) continue;
    const up = s.ratio > 1;
    habitCards.push(
      <BehavioralInsightRow
        key={`shift-${s.categoryId}`}
        icon={c.icon ? getCategoryIcon(c.icon) : ShoppingBag}
        badgeColor={c.color}
        title={up ? 'Higher Than Usual' : 'Lower Than Usual'}
        headline={`${c.name} · ${formatCurrency(s.current)}`}
        detail={`Your ${baseWord} average is ${formatCurrency(Math.round(s.average))}`}
        pillText={up ? formatRise(s.ratio) : `−${Math.round((1 - s.ratio) * 100)}%`}
        pillColor={up ? colors.coralText : colors.mintText}
        onPress={() => onOpenCategory(c.id)}
      />
    );
  }
  if (habits.topPlaces.length > 0) {
    const [first, ...rest] = habits.topPlaces;
    const then = rest.map((pl) => `${pl.name} ${pl.count} times`).join(', ');
    habitCards.push(
      <BehavioralInsightRow
        key="places"
        icon={MapPin}
        badgeColor={CATEGORY_PALETTE[1]}
        title="Top Places"
        headline={`${first.name} · ${first.count} times`}
        detail={`${formatCurrency(first.total)} in total${then ? ` · Then ${then}` : ''}`}
      />
    );
  }

  // ─── Money with others & Gullak ─────────────────────────────────────────
  const otherCards: React.ReactNode[] = [];
  const sp = others.split;
  if (sp) {
    // The number to act on (money still owed) leads; the rest of the period's story follows.
    const owed = sp.stillOwed > 0;
    const anyShared = sp.paidForOthers > 0 || sp.cameBack > 0;
    const headline = owed
      ? `${formatCurrency(sp.stillOwed)} still owed to you`
      : anyShared
        ? 'Everyone has paid you back'
        : `${formatCurrency(sp.refunds)} came back as refunds`;
    const parts = [
      owed && sp.topDebtor ? `Most by ${sp.topDebtor.name}` : null,
      sp.paidForOthers > 0 ? `${formatCurrency(sp.paidForOthers)} paid for others` : null,
      sp.cameBack > 0 ? `${formatCurrency(sp.cameBack)} came back` : null,
      sp.refunds > 0 && (owed || anyShared) ? `${formatCurrency(sp.refunds)} refunds` : null,
    ].filter(Boolean);
    otherCards.push(
      <BehavioralInsightRow
        key="split"
        icon={Users}
        badgeColor={CATEGORY_PALETTE[4]}
        title="Shared Expenses"
        headline={headline}
        detail={parts.length > 0 ? parts.join(' · ') : 'Tap to see who paid what'}
        pillText={sp.oldestDebtDays !== null && sp.oldestDebtDays > 0 ? `Oldest ${sp.oldestDebtDays}d` : null}
        pillColor={colors.coralText}
        onPress={onOpenLedger}
      />
    );
  }
  const gs = others.gullakSources;
  const gullakParts = gs
    ? [
        { label: 'Auto-saved from budget', amount: gs.autoSaved, color: GULLAK_BADGE, only: 'auto-saved from your daily budget' },
        { label: 'From income', amount: gs.fromIncome, color: CATEGORY_PALETTE[2], only: 'moved in from your income' },
        { label: 'From outside', amount: gs.fromOutside, color: CATEGORY_PALETTE[1], only: 'added from outside money' },
      ].filter((x) => x.amount > 0)
    : [];
  if (gs && gullakParts.length === 1) {
    // One source: a bar filled 100% says nothing, a sentence says it all.
    otherCards.push(
      <BehavioralInsightRow
        key="gullak"
        icon={PiggyIcon}
        badgeColor={GULLAK_BADGE}
        title="Where Gullak Money Came From"
        headline={`${formatCurrency(gs.total)} went into Gullak this ${periodWord}`}
        detail={`All of it ${gullakParts[0].only}${gs.coveredOverspend > 0 ? ` · ${formatCurrency(gs.coveredOverspend)} used to cover overspending` : ''}`}
      />
    );
  } else if (gs) {
    otherCards.push(
      <InsightBreakdownCard
        key="gullak"
        title="Where Gullak Money Came From"
        headline={`${formatCurrency(gs.total)} went into Gullak this ${periodWord}`}
        segments={gullakParts}
        extraLine={gs.coveredOverspend > 0 ? { label: 'Used to cover overspending', amount: gs.coveredOverspend } : null}
      />
    );
  }
  const bw = others.bestWorst;
  if (bw) {
    const reason = bw.worstReason && cat(bw.worstReason.categoryId);
    const short = (m: typeof bw.best) => (m.moneyLeft >= 0 ? `${formatCurrency(m.moneyLeft)} left` : `${formatCurrency(-m.moneyLeft)} short`);
    otherCards.push(
      <BehavioralInsightRow
        key="best"
        icon={Trophy}
        badgeColor={colors.mintGreen}
        title="Best Month"
        headline={`${monthName(bw.best.monthKey)} · ${short(bw.best)}`}
        detail={`${formatCurrency(bw.best.inflow)} in · ${formatCurrency(bw.best.spent)} spent`}
      />,
      <BehavioralInsightRow
        key="worst"
        icon={TrendingDown}
        badgeColor={colors.peachCoral}
        title="Least Money Left"
        headline={`${monthName(bw.worst.monthKey)} · ${short(bw.worst)}`}
        detail={
          reason
            ? `${reason.name} was ${bw.worstReason!.ratio.toFixed(1)}x its usual month`
            : `${formatCurrency(bw.worst.inflow)} in · ${formatCurrency(bw.worst.spent)} spent`
        }
        onPress={reason ? () => onOpenCategory(reason.id) : undefined}
      />
    );
  }

  if (part === 'heading') {
    return headingCards.length > 0 ? (
      <>
        {title("Where You're Heading")}
        <View style={styles.behavioralInsightsList}>{headingCards}</View>
      </>
    ) : null;
  }
  return (
    <>
      {habitCards.length > 0 && (
        <>
          {title("Your Habits")}
          <View style={styles.behavioralInsightsList}>{habitCards}</View>
        </>
      )}
      {otherCards.length > 0 && (
        <>
          {title("Money With Others & Gullak")}
          <View style={styles.behavioralInsightsList}>{otherCards}</View>
        </>
      )}
    </>
  );
};
