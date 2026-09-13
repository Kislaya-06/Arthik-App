import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react-native';
import { format, isToday as checkIsToday, isYesterday as checkIsYesterday, isSameDay } from 'date-fns';
import { useTheme } from '../store/themeStore';

interface CustomDatePickerModalProps {
  visible: boolean;
  value: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
  maxDate?: Date;
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CustomDatePickerModal: React.FC<CustomDatePickerModalProps> = ({
  visible,
  value,
  onConfirm,
  onClose,
  maxDate,
}) => {
  const { colors, isDark } = useTheme();

  // Internal selected date (only confirmed when user presses "Done")
  const [tempDate, setTempDate] = useState<Date>(value);
  // Month being viewed
  const [viewingDate, setViewingDate] = useState<Date>(value);

  useEffect(() => {
    if (visible) {
      const initial = value || new Date();
      setTempDate(initial);
      setViewingDate(new Date(initial.getFullYear(), initial.getMonth(), 1));
    }
  }, [visible, value]);

  const viewingYear = viewingDate.getFullYear();
  const viewingMonth = viewingDate.getMonth();

  // Month navigation
  const handlePrevMonth = () => {
    setViewingDate(new Date(viewingYear, viewingMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewingDate(new Date(viewingYear, viewingMonth + 1, 1));
  };

  // Quick shortcuts
  const selectToday = () => {
    const today = new Date();
    setTempDate(today);
    setViewingDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const selectYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setTempDate(yesterday);
    setViewingDate(new Date(yesterday.getFullYear(), yesterday.getMonth(), 1));
  };

  // Build calendar matrix
  const calendarCells = useMemo(() => {
    const daysInMonth = new Date(viewingYear, viewingMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewingYear, viewingMonth, 1).getDay();

    const cells: Array<{
      day: number | null;
      date: Date | null;
      isSelected: boolean;
      isTodayDate: boolean;
      isDisabled: boolean;
    }> = [];

    // Leading blanks
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        day: null,
        date: null,
        isSelected: false,
        isTodayDate: false,
        isDisabled: true,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(viewingYear, viewingMonth, d);
      const isSelected = isSameDay(cellDate, tempDate);
      const isTodayDate = checkIsToday(cellDate);
      const isDisabled = maxDate ? cellDate.getTime() > maxDate.getTime() : false;

      cells.push({
        day: d,
        date: cellDate,
        isSelected,
        isTodayDate,
        isDisabled,
      });
    }

    return cells;
  }, [viewingYear, viewingMonth, tempDate, maxDate]);

  const isCurrentSelectionToday = checkIsToday(tempDate);
  const isCurrentSelectionYesterday = checkIsYesterday(tempDate);

  const handleConfirm = () => {
    onConfirm(tempDate);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Top Banner: Selected Date Summary */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' },
                ]}
              >
                SELECT DATE
              </Text>
              <Text
                style={[
                  styles.headerTitle,
                  { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' },
                ]}
              >
                {format(tempDate, 'EEE, d MMM yyyy')}
              </Text>
            </View>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: colors.mintGreenSoft },
              ]}
            >
              <CalendarIcon size={20} color={colors.mintGreen} />
            </View>
          </View>

          {/* Quick Shortcuts */}
          <View style={styles.shortcutsRow}>
            <Pressable
              onPress={selectToday}
              style={[
                styles.shortcutChip,
                isCurrentSelectionToday
                  ? { backgroundColor: colors.mintGreen, borderColor: colors.mintGreen }
                  : { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle },
              ]}
            >
              <Text
                style={[
                  styles.shortcutChipText,
                  {
                    color: isCurrentSelectionToday ? '#1A2B4C' : colors.textPrimary,
                    fontFamily: isCurrentSelectionToday ? 'Quicksand_700Bold' : 'Quicksand_600SemiBold',
                  },
                ]}
              >
                Today
              </Text>
            </Pressable>

            <Pressable
              onPress={selectYesterday}
              style={[
                styles.shortcutChip,
                isCurrentSelectionYesterday
                  ? { backgroundColor: colors.mintGreen, borderColor: colors.mintGreen }
                  : { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle },
              ]}
            >
              <Text
                style={[
                  styles.shortcutChipText,
                  {
                    color: isCurrentSelectionYesterday ? '#1A2B4C' : colors.textPrimary,
                    fontFamily: isCurrentSelectionYesterday ? 'Quicksand_700Bold' : 'Quicksand_600SemiBold',
                  },
                ]}
              >
                Yesterday
              </Text>
            </Pressable>
          </View>

          {/* Month & Year Navigation Row */}
          <View style={styles.monthNavRow}>
            <Pressable
              onPress={handlePrevMonth}
              style={({ pressed }) => [
                styles.navArrow,
                {
                  backgroundColor: colors.cardSubtle,
                  borderColor: colors.borderSubtle,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <ChevronLeft size={20} color={colors.textPrimary} />
            </Pressable>

            <Text
              style={[
                styles.monthLabel,
                { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' },
              ]}
            >
              {format(viewingDate, 'MMMM yyyy')}
            </Text>

            <Pressable
              onPress={handleNextMonth}
              style={({ pressed }) => [
                styles.navArrow,
                {
                  backgroundColor: colors.cardSubtle,
                  borderColor: colors.borderSubtle,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <ChevronRight size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Day of Week Headers */}
          <View style={styles.daysOfWeekRow}>
            {DAYS_OF_WEEK.map((d, index) => (
              <View key={index} style={styles.dayOfWeekCell}>
                <Text
                  style={[
                    styles.dayOfWeekText,
                    { color: colors.textMuted, fontFamily: 'Quicksand_700Bold' },
                  ]}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.calendarGrid}>
            {calendarCells.map((cell, index) => {
              if (cell.day === null || !cell.date) {
                return <View key={`blank-${index}`} style={styles.dayCell} />;
              }

              return (
                <View key={`day-${cell.day}`} style={styles.dayCell}>
                  <Pressable
                    disabled={cell.isDisabled}
                    onPress={() => {
                      if (cell.date) {
                        setTempDate(cell.date);
                      }
                    }}
                    style={[
                      styles.dayButton,
                      cell.isSelected && {
                        backgroundColor: colors.mintGreen,
                      },
                      !cell.isSelected && cell.isTodayDate && {
                        borderWidth: 1.5,
                        borderColor: colors.mintGreen,
                        backgroundColor: colors.mintGreenSoft,
                      },
                      cell.isDisabled && { opacity: 0.25 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        {
                          color: cell.isSelected
                            ? '#1A2B4C'
                            : cell.isTodayDate
                            ? colors.mintGreen
                            : colors.textPrimary,
                          fontFamily: cell.isSelected || cell.isTodayDate
                            ? 'Quicksand_700Bold'
                            : 'Quicksand_600SemiBold',
                        },
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* Action Footer Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              style={[
                styles.cancelButton,
                {
                  backgroundColor: colors.cardSubtle,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' },
                ]}
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                {
                  backgroundColor: colors.mintGreen,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  { color: '#1A2B4C', fontFamily: 'Quicksand_700Bold' },
                ]}
              >
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  shortcutChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  shortcutChipText: {
    fontSize: 13,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
  },
  daysOfWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayOfWeekCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayOfWeekText: {
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
  },
  confirmButton: {
    flex: 1.4,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
  },
});
