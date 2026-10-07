import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useTheme } from '../../store/themeStore';
import { Spacing, FontSize, FontFamily } from '../../config/theme';
import { Body, Bullet, Card, SectionLabel } from './AutoLogUi';

/** Email apps whose notifications Arthik can read (must match EMAIL_APPS in FinancialFilter.kt). */
export const SUPPORTED_EMAIL_APPS = ['Gmail', 'Outlook', 'Samsung Email', 'Yahoo Mail', 'Proton Mail', 'Spark', 'Zoho Mail'];

/**
 * The explanation shown before email detection is turned on (spec email §35, §37).
 * Clear about what is and is not used — never "we need access to your emails".
 */
export const EmailSourceInfo: React.FC = () => {
  const { colors } = useTheme();
  return (
    <>
      <Card>
        <Body>
          Arthik uses supported email notifications to detect financial transactions automatically. Only relevant financial
          notifications are considered for transaction detection. Personal and unrelated emails are not transaction inputs.
        </Body>
      </Card>
      <Card>
        <SectionLabel>Used</SectionLabel>
        <Bullet tone="ok">Debit / credit alerts, payment and UPI confirmations, card transaction emails from banks and payment apps</Bullet>
        <Bullet tone="ok">Only what the email notification shows (sender, subject, preview) — not your inbox</Bullet>
        <SectionLabel style={{ marginTop: Spacing.block }}>Not used</SectionLabel>
        <Bullet tone="no">Personal, work and unrelated emails</Bullet>
        <Bullet tone="no">OTP, login, password and security emails</Bullet>
        <Bullet tone="no">Offers, reminders, statements, "will be debited", failed payments</Bullet>
        <Bullet tone="no">Old emails — nothing from before you turn this on is added</Bullet>
      </Card>
      <Card tone="mint">
        <View style={styles.row}>
          <Lock size={16} color={colors.mintGreenDark} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Processed on this device</Text>
        </View>
        <Body muted style={{ marginTop: Spacing.micro }}>
          Email content is not uploaded. Only the transaction itself (amount, merchant, date) is saved, like any transaction.
        </Body>
      </Card>
      <Card>
        <SectionLabel>Works with</SectionLabel>
        <Body muted>{SUPPORTED_EMAIL_APPS.join(' · ')}</Body>
        <Body muted style={{ marginTop: Spacing.element }}>
          Keep notifications on for bank emails in your email app. Uses the same Notification access you gave for payment apps.
        </Body>
      </Card>
    </>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.element },
  title: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
});
