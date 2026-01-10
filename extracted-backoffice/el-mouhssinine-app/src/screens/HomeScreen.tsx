import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { 
  subscribeToPrayerTimes, 
  subscribeToAnnouncements, 
  subscribeToEvents,
  subscribeToJanaza,
  getIslamicDates
} from '../services/firebase';
import { PrayerTime, Announcement, Event, Janaza } from '../types';

const HomeScreen = () => {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([
    { name: 'Fajr', time: '06:45', icon: '🌅' },
    { name: 'Dhuhr', time: '13:15', icon: '☀️' },
    { name: 'Asr', time: '15:45', icon: '🌤️' },
    { name: 'Maghrib', time: '18:02', icon: '🌅' },
    { name: 'Isha', time: '19:30', icon: '🌙' },
  ]);
  const [nextPrayer, setNextPrayer] = useState({ name: 'Dhuhr', time: '13:15', icon: '☀️' });
  const [countdown, setCountdown] = useState('01:23:45');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [janaza, setJanaza] = useState<Janaza | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [islamicDate, setIslamicDate] = useState({
    day: '9',
    month: 'Rajab',
    year: '1447',
    gregorian: '9 Janvier 2026'
  });
  const [islamicEvents, setIslamicEvents] = useState([
    { name: 'Ramadan', gregorian: '28 Février 2026', daysLeft: 50, icon: '🌙' },
    { name: 'Aïd al-Fitr', gregorian: '30 Mars 2026', daysLeft: 80, icon: '🎉' },
    { name: 'Aïd al-Adha', gregorian: '6 Juin 2026', daysLeft: 148, icon: '🐑' },
  ]);

  useEffect(() => {
    // Subscriptions Firebase
    const unsubPrayer = subscribeToPrayerTimes((times) => {
      if (times) setPrayerTimes(times.prayers);
    });
    
    const unsubAnnouncements = subscribeToAnnouncements(setAnnouncements);
    const unsubEvents = subscribeToEvents(setEvents);
    const unsubJanaza = subscribeToJanaza(setJanaza);

    // Countdown timer
    const timer = setInterval(() => {
      // TODO: Calculer le vrai countdown
    }, 1000);

    return () => {
      unsubPrayer?.();
      unsubAnnouncements();
      unsubEvents();
      unsubJanaza();
      clearInterval(timer);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUI', 'JUI', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
    return { day, month: months[date.getMonth()] };
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Salam */}
        <LinearGradient
          colors={['#5c3a1a', '#7f4f24']}
          style={styles.salamHeader}
        >
          <Text style={styles.salamArabic}>السلام عليكم ورحمة الله</Text>
          <Text style={styles.salamTranslation}>
            Que la paix et la miséricorde d'Allah soient sur vous
          </Text>
          <View style={styles.salamDivider} />
        </LinearGradient>

        {/* Titre */}
        <View style={styles.header}>
          <Text style={styles.title}>🕌 El Mouhssinine</Text>
          <Text style={styles.subtitle}>Mosquée - Bourg-en-Bresse</Text>
        </View>

        <View style={styles.content}>
          {/* Prochaine prière */}
          <View style={styles.nextPrayerCard}>
            <Text style={styles.nextPrayerLabel}>Prochaine prière</Text>
            <Text style={styles.nextPrayerName}>{nextPrayer.icon} {nextPrayer.name}</Text>
            <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
            <Text style={styles.countdown}>{countdown}</Text>
          </View>

          {/* Horaires */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🕐 Horaires du jour</Text>
            <View style={styles.prayerCard}>
              {prayerTimes.map((prayer, index) => (
                <View
                  key={prayer.name}
                  style={[
                    styles.prayerRow,
                    index === prayerTimes.length - 1 && styles.prayerRowLast,
                    prayer.name === nextPrayer.name && styles.prayerRowActive,
                  ]}
                >
                  <View style={styles.prayerName}>
                    <Text style={styles.prayerIcon}>{prayer.icon}</Text>
                    <Text style={styles.prayerNameText}>{prayer.name}</Text>
                  </View>
                  <Text style={styles.prayerTime}>{prayer.time}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Calendrier Hégirien */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Calendrier Hégirien</Text>
            <View style={styles.card}>
              <View style={styles.hijriDateCenter}>
                <Text style={styles.hijriLabel}>Aujourd'hui</Text>
                <Text style={styles.hijriDay}>{islamicDate.day} {islamicDate.month}</Text>
                <Text style={styles.hijriYear}>{islamicDate.year} H</Text>
                <Text style={styles.hijriGregorian}>{islamicDate.gregorian}</Text>
              </View>
              <View style={styles.hijriDivider} />
              <Text style={styles.upcomingLabel}>Prochains événements</Text>
              {islamicEvents.map((event, index) => (
                <View key={event.name} style={[
                  styles.eventRow,
                  index === islamicEvents.length - 1 && styles.eventRowLast
                ]}>
                  <Text style={styles.eventIcon}>{event.icon}</Text>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventName}>{event.name}</Text>
                    <Text style={styles.eventDate}>{event.gregorian}</Text>
                  </View>
                  <View style={styles.daysLeftBadge}>
                    <Text style={styles.daysLeftText}>J-{event.daysLeft}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Annonces */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📢 Annonces</Text>
            {announcements.length > 0 ? (
              announcements.map((announcement) => (
                <View key={announcement.id} style={styles.card}>
                  <Text style={styles.announcementTitle}>{announcement.title}</Text>
                  <Text style={styles.announcementContent}>{announcement.content}</Text>
                  <Text style={styles.announcementDate}>
                    Publié le {announcement.publishedAt?.toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              ))
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.announcementTitle}>Cours de Coran pour enfants</Text>
                  <Text style={styles.announcementContent}>
                    Reprise des cours chaque samedi à 14h. Inscription obligatoire.
                  </Text>
                  <Text style={styles.announcementDate}>Publié le 8 janvier 2026</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.announcementTitle}>Collecte vêtements chauds</Text>
                  <Text style={styles.announcementContent}>
                    Dépôt possible tous les jours après la prière de Maghrib.
                  </Text>
                  <Text style={styles.announcementDate}>Publié le 5 janvier 2026</Text>
                </View>
              </>
            )}
          </View>

          {/* Prière Mortuaire */}
          {janaza && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🕯️ Prière Mortuaire</Text>
              <LinearGradient
                colors={['rgba(30,58,95,0.8)', 'rgba(26,39,68,0.9)']}
                style={styles.janazaCard}
              >
                <View style={styles.janazaHeader}>
                  <View style={styles.janazaIcon}>
                    <Text style={styles.janazaIconText}>🤲</Text>
                  </View>
                  <View style={styles.janazaInfo}>
                    <Text style={styles.janazaTitle}>Salat Janaza</Text>
                    <Text style={styles.janazaTime}>{janaza.prayerTime}</Text>
                  </View>
                </View>
                <View style={styles.janazaDetails}>
                  <Text style={styles.janazaDeceased}>
                    <Text style={styles.janazaBold}>Défunt(e) : </Text>
                    {janaza.deceasedName} {janaza.deceasedNameAr && `(${janaza.deceasedNameAr})`}
                  </Text>
                  <Text style={styles.janazaMessage}>
                    {janaza.message || "Que Allah lui accorde Sa miséricorde et l'accueille dans Son vaste Paradis."}
                  </Text>
                </View>
                <View style={styles.janazaFooter}>
                  <Text style={styles.janazaLocation}>📍 {janaza.location}</Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Événements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Prochains événements</Text>
            {events.length > 0 ? (
              events.slice(0, 3).map((event) => {
                const { day, month } = formatDate(event.date);
                return (
                  <View key={event.id} style={styles.card}>
                    <View style={styles.eventItem}>
                      <View style={styles.eventDateBox}>
                        <Text style={styles.eventDay}>{day}</Text>
                        <Text style={styles.eventMonth}>{month}</Text>
                      </View>
                      <View style={styles.eventDetails}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventSubtitle}>
                          {event.time} • {event.location}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <>
                <View style={styles.card}>
                  <View style={styles.eventItem}>
                    <View style={styles.eventDateBox}>
                      <Text style={styles.eventDay}>12</Text>
                      <Text style={styles.eventMonth}>JAN</Text>
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={styles.eventTitle}>Conférence : La patience en Islam</Text>
                      <Text style={styles.eventSubtitle}>Dimanche à 15h00 • Salle principale</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.card}>
                  <View style={styles.eventItem}>
                    <View style={styles.eventDateBox}>
                      <Text style={styles.eventDay}>18</Text>
                      <Text style={styles.eventMonth}>JAN</Text>
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={styles.eventTitle}>Repas communautaire</Text>
                      <Text style={styles.eventSubtitle}>Samedi à 19h30 • Après Maghrib</Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  salamHeader: {
    padding: 30,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  salamArabic: {
    fontSize: 32,
    color: colors.accent,
    marginBottom: 8,
    textShadowColor: 'rgba(201,162,39,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  salamTranslation: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textAlign: 'center',
  },
  salamDivider: {
    width: 60,
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginTop: 16,
    opacity: 0.5,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.md,
  },
  nextPrayerCard: {
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
  },
  nextPrayerLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 4,
  },
  nextPrayerName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.accent,
  },
  nextPrayerTime: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  countdown: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.accent,
    marginTop: 8,
  },
  prayerCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  prayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  prayerRowLast: {
    borderBottomWidth: 0,
  },
  prayerRowActive: {
    backgroundColor: 'rgba(201,162,39,0.1)',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
  },
  prayerName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prayerIcon: {
    fontSize: 18,
  },
  prayerNameText: {
    fontSize: fontSize.lg,
    color: colors.text,
  },
  prayerTime: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.accent,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  hijriDateCenter: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  hijriLabel: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginBottom: 4,
  },
  hijriDay: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.accent,
  },
  hijriYear: {
    fontSize: fontSize.lg,
    color: colors.text,
  },
  hijriGregorian: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  hijriDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: spacing.md,
  },
  upcomingLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  eventRowLast: {
    borderBottomWidth: 0,
  },
  eventIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  eventDate: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  daysLeftBadge: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysLeftText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.accent,
  },
  announcementTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  announcementContent: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  announcementDate: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  janazaCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  janazaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  janazaIcon: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212,175,55,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  janazaIconText: {
    fontSize: 24,
  },
  janazaInfo: {
    flex: 1,
  },
  janazaTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: '#ffffff',
  },
  janazaTime: {
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  janazaDetails: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  janazaDeceased: {
    fontSize: fontSize.md,
    color: '#ffffff',
    marginBottom: 4,
  },
  janazaBold: {
    fontWeight: 'bold',
  },
  janazaMessage: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  janazaFooter: {
    flexDirection: 'row',
  },
  janazaLocation: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDateBox: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  eventDay: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.accent,
    lineHeight: 20,
  },
  eventMonth: {
    fontSize: fontSize.xs,
    color: colors.accent,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  eventSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});

export default HomeScreen;
