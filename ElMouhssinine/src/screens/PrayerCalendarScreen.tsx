import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, wp } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { getTimesForDate, prayerNames } from '../services/prayerApi';

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_AR = ['إث', 'ثل', 'أر', 'خم', 'جم', 'سب', 'أح'];

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
];

const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

const PrayerCalendarScreen: React.FC = () => {
  const navigation = useNavigation();
  const { language, isRTL, t } = useLanguage();

  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  const [currentMonth, setCurrentMonth] = useState(todayMonth);
  const [selectedDay, setSelectedDay] = useState(todayDay);

  const daysInMonth = new Date(2026, currentMonth + 1, 0).getDate();
  // Day of week for 1st of month (0=Sun, convert to Mon=0)
  const firstDayRaw = new Date(2026, currentMonth, 1).getDay();
  const firstDayOffset = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

  const weeks = useMemo(() => {
    const rows: (number | null)[][] = [];
    let row: (number | null)[] = [];
    // Fill empty cells before 1st
    for (let i = 0; i < firstDayOffset; i++) row.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      row.push(d);
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }
    // Fill remaining cells
    if (row.length > 0) {
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [currentMonth, daysInMonth, firstDayOffset]);

  const selectedTimes = useMemo(() => {
    return getTimesForDate(currentMonth, selectedDay);
  }, [currentMonth, selectedDay]);

  const prevMonth = () => {
    if (currentMonth > 0) {
      setCurrentMonth(currentMonth - 1);
      setSelectedDay(1);
    }
  };

  const nextMonth = () => {
    if (currentMonth < 11) {
      setCurrentMonth(currentMonth + 1);
      setSelectedDay(1);
    }
  };

  const monthNames = language === 'ar' ? MONTHS_AR : MONTHS_FR;
  const dayNames = language === 'ar' ? DAYS_AR : DAYS_FR;

  const isToday = (day: number) => currentMonth === todayMonth && day === todayDay;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{isRTL ? 'رجوع →' : '← Retour'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
          📅 {t('prayerCalendar')}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={isRTL ? nextMonth : prevMonth}
            style={[styles.navArrow, currentMonth === (isRTL ? 11 : 0) && styles.navDisabled]}
            disabled={currentMonth === (isRTL ? 11 : 0)}
          >
            <Text style={[styles.navArrowText, currentMonth === (isRTL ? 11 : 0) && styles.navArrowDisabled]}>
              ◀
            </Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthNames[currentMonth]} 2026</Text>
          <TouchableOpacity
            onPress={isRTL ? prevMonth : nextMonth}
            style={[styles.navArrow, currentMonth === (isRTL ? 0 : 11) && styles.navDisabled]}
            disabled={currentMonth === (isRTL ? 0 : 11)}
          >
            <Text style={[styles.navArrowText, currentMonth === (isRTL ? 0 : 11) && styles.navArrowDisabled]}>
              ▶
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarCard}>
          {/* Day headers */}
          <View style={[styles.weekRow, isRTL && styles.rowRTL]}>
            {dayNames.map((d, i) => (
              <View key={i} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <View key={wi} style={[styles.weekRow, isRTL && styles.rowRTL]}>
              {week.map((day, di) => (
                <TouchableOpacity
                  key={di}
                  style={[
                    styles.dayCell,
                    day === selectedDay && styles.dayCellSelected,
                    day !== null && isToday(day) && styles.dayCellToday,
                  ]}
                  onPress={() => day && setSelectedDay(day)}
                  disabled={!day}
                  activeOpacity={0.7}
                >
                  {day !== null && (
                    <Text
                      style={[
                        styles.dayText,
                        day === selectedDay && styles.dayTextSelected,
                        isToday(day) && styles.dayTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* Prayer times for selected day */}
        <View style={styles.timesSection}>
          <Text style={[styles.timesTitle, isRTL && styles.textRTL]}>
            {t('prayerTimesFor')} {selectedDay} {monthNames[currentMonth]}
          </Text>

          {selectedTimes && selectedTimes.length >= PRAYER_KEYS.length ? (
            <View style={styles.timesGrid}>
              {PRAYER_KEYS.map((key, idx) => {
                const info = prayerNames[key];
                return (
                  <View key={key} style={styles.timeCard}>
                    <Text style={styles.timeIcon}>{info.icon}</Text>
                    <Text style={[styles.timeName, isRTL && styles.textRTL]}>
                      {language === 'ar' ? info.ar : info.fr}
                    </Text>
                    <Text style={styles.timeValue}>{selectedTimes[idx]}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noDataCard}>
              <Text style={styles.noDataText}>
                {language === 'ar' ? 'لا توجد بيانات لهذا اليوم' : 'Pas de données pour ce jour'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: HEADER_PADDING_TOP,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.accentDark,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backText: {
    color: colors.accent,
    fontSize: fontSize.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#fff',
  },
  textRTL: {
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  // Month navigation
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  navArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisabled: {
    backgroundColor: colors.border,
  },
  navArrowText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  navArrowDisabled: {
    color: colors.textMuted,
  },
  monthTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  // Calendar
  calendarCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dayHeaderText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.accent,
    textTransform: 'uppercase',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    margin: 1,
    borderRadius: borderRadius.sm,
  },
  dayCellSelected: {
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'rgba(201, 162, 39, 0.08)',
  },
  dayCellToday: {
    backgroundColor: colors.accent,
  },
  dayText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
  dayTextToday: {
    color: '#fff',
    fontWeight: '700',
  },
  // Times section
  timesSection: {
    marginTop: spacing.xl,
  },
  timesTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  timesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  timeCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  timeIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  timeName: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  timeValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.accent,
  },
  noDataCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
});

export default PrayerCalendarScreen;
