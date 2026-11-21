import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../store/themeStore';
import { Spacing, FontSize, FontFamily, LineHeight } from '../../config/theme';
import { AppButton } from '../ui/AppButton';
import { Body, Card, SectionLabel } from './AutoLogUi';
import { autostartGuide } from '../../features/autoLog/autostart';
import { openAppDetails } from '../../features/autoLog/permissions';
import * as service from '../../features/autoLog/service';

/** Android reports the phone maker here ("Xiaomi", "OPPO", "samsung"…). */
const manufacturer = (): string | undefined =>
  Platform.OS === 'android' ? ((Platform.constants as { Manufacturer?: string } | undefined)?.Manufacturer ?? undefined) : undefined;

/**
 * One-time steps for phones whose maker stops apps in the background (Autostart and similar switches).
 * Android cannot open that screen for us, so we show the steps and open Arthik's App info. Hidden after "Done".
 */
export const AutostartGuideCard: React.FC<{ userId: string }> = ({ userId }) => {
  const { colors } = useTheme();
  const guide = autostartGuide(manufacturer());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!guide) return;
    service.isAutostartGuideDone(userId).then((done) => alive && setVisible(!done)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [guide, userId]);

  if (!guide || !visible) return null;

  return (
    <Card>
      <SectionLabel>{`Keep it running on ${guide.brand}`}</SectionLabel>
      <Body muted style={{ marginBottom: Spacing.element }}>
        These phones can stop Arthik in the background, so payments are missed. Do this once:
      </Body>
      {guide.steps.map((step, i) => (
        <View key={step} style={styles.step}>
          <Text style={[styles.num, { color: colors.textSecondary }]}>{i + 1}.</Text>
          <Text style={[styles.text, { color: colors.textPrimary }]}>{step}</Text>
        </View>
      ))}
      <View style={styles.row}>
        <AppButton label="Open settings" variant="outline" size="compact" style={{ flex: 1 }} onPress={openAppDetails} />
        <AppButton
          label="Done"
          size="compact"
          style={{ flex: 1 }}
          onPress={async () => {
            setVisible(false);
            await service.markAutostartGuideDone(userId);
          }}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: Spacing.element, marginBottom: Spacing.micro },
  num: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall, fontFamily: FontFamily.bold, minWidth: 16 },
  text: { flex: 1, fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall, fontFamily: FontFamily.medium },
  row: { flexDirection: 'row', gap: Spacing.group, marginTop: Spacing.group },
});
