import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import {
  subscribeToPrayerTimes,
  subscribeToAnnouncements,
  subscribeToEvents,
  subscribeToJanaza,
  subscribeToIqama,
  IqamaDelays,
  addMinutesToTime,
} from '../services/firebase';
import { PrayerAPI } from '../services/prayerApi';
import { PrayerTime, Announcement, Event, Janaza } from '../types';
import { useLanguage } from '../context/LanguageContext';

// Donnees mockees par defaut (fallback)
const mockPrayerTimes: PrayerTime[] = [
  { name: 'Fajr', time: '06:45', icon: '🌅' },
  { name: 'Dhuhr', time: '13:15', icon: '☀️' },
  { name: 'Asr', time: '15:45', icon: '🌤️' },
  { name: 'Maghrib', time: '18:02', icon: '🌅' },
  { name: 'Isha', time: '19:30', icon: '🌙' },
];

const mockIslamicDate = {
  day: '9',
  month: 'Rajab',
  monthAr: 'رجب',
  year: '1447',
  gregorian: '9 Janvier 2026'
};

// Mock data pour Salat Janaza
const mockJanazaList = [
  {
    id: '1',
    nom: 'BENALI',
    prenom: 'Ahmed',
    genre: 'homme',
    date: '2026-01-12',
    apresSalat: 'dhuhr',
    lieu: 'Mosquée El Mouhssinine',
    phraseAr: 'إنا لله وإنا إليه راجعون',
    phraseFr: 'Nous appartenons à Allah et c\'est vers Lui que nous retournerons',
  },
  {
    id: '2',
    nom: 'SAID',
    prenom: 'Fatima',
    genre: 'femme',
    date: '2026-01-13',
    heure: '14:30',
    lieu: 'Mosquée El Mouhssinine',
    phraseAr: 'إنا لله وإنا إليه راجعون',
    phraseFr: 'Nous appartenons à Allah et c\'est vers Lui que nous retournerons',
  },
];

const HomeScreen = () => {
  const { t, isRTL } = useLanguage();
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>(mockPrayerTimes);
  const [nextPrayer, setNextPrayer] = useState({ name: 'Dhuhr', time: '13:15', icon: '☀️' });
  const [countdown, setCountdown] = useState('01:23:45');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [janaza, setJanaza] = useState<Janaza | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [_loading, setLoading] = useState(true);
  const [islamicDate, setIslamicDate] = useState(mockIslamicDate);
  const [iqamaDelays, setIqamaDelays] = useState<IqamaDelays | null>(null);
  const [islamicEvents] = useState([
    { name: 'Ramadan', gregorian: '28 Fevrier 2026', daysLeft: 50, icon: '🌙' },
    { name: 'Aid al-Fitr', gregorian: '30 Mars 2026', daysLeft: 80, icon: '🎉' },
    { name: 'Aid al-Adha', gregorian: '6 Juin 2026', daysLeft: 148, icon: '🐑' },
  ]);

  // Traduction des noms de prière
  const getPrayerName = (name: string) => {
    const prayerKey = name.toLowerCase().replace(' (demain)', '') as 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
    return t(prayerKey) || name;
  };

  // Calculer l'heure d'iqama = Adhan + délai en minutes
  const getIqamaTime = (prayerName: string, adhanTime: string): string | null => {
    if (!iqamaDelays) return null;
    const key = prayerName.toLowerCase().replace(' (demain)', '') as keyof IqamaDelays;
    const delay = iqamaDelays[key];
    if (!delay) return null;
    return addMinutesToTime(adhanTime, delay);
  };

  // Charger les donnees depuis l'API Aladhan
  const loadPrayerData = useCallback(async () => {
    try {
      // Horaires de priere depuis l'API
      const timings = await PrayerAPI.getTimesByCity('Bourg-en-Bresse', 'France');
      const formattedTimes: PrayerTime[] = [
        { name: 'Fajr', time: PrayerAPI.formatTime(timings.Fajr), icon: '🌅' },
        { name: 'Dhuhr', time: PrayerAPI.formatTime(timings.Dhuhr), icon: '☀️' },
        { name: 'Asr', time: PrayerAPI.formatTime(timings.Asr), icon: '🌤️' },
        { name: 'Maghrib', time: PrayerAPI.formatTime(timings.Maghrib), icon: '🌅' },
        { name: 'Isha', time: PrayerAPI.formatTime(timings.Isha), icon: '🌙' },
      ];
      setPrayerTimes(formattedTimes);

      // Calculer la prochaine priere
      const next = PrayerAPI.getNextPrayer(timings);
      if (next) {
        const iconMap: Record<string, string> = {
          Fajr: '🌅', Dhuhr: '☀️', Asr: '🌤️', Maghrib: '🌅', Isha: '🌙'
        };
        setNextPrayer({
          name: next.name,
          time: PrayerAPI.formatTime(next.time),
          icon: iconMap[next.name.replace(' (demain)', '')] || '🕌'
        });
      }

      // Date hijri depuis l'API
      const hijri = await PrayerAPI.getHijriDate();
      const today = new Date();
      const months = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
                      'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
      setIslamicDate({
        day: hijri.day,
        month: hijri.month.en,
        monthAr: hijri.month.ar,
        year: hijri.year,
        gregorian: `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`
      });
    } catch (error) {
      console.warn('API error, using mock data:', error);
      // Garde les donnees mockees en fallback
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculer le countdown vers la prochaine priere
  const calculateCountdown = useCallback(() => {
    const now = new Date();
    const [hours, minutes] = nextPrayer.time.split(':').map(Number);
    const prayerDate = new Date();
    prayerDate.setHours(hours, minutes, 0, 0);

    // Si la priere est passee, ajouter un jour
    if (prayerDate <= now) {
      prayerDate.setDate(prayerDate.getDate() + 1);
    }

    const diff = prayerDate.getTime() - now.getTime();
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
  }, [nextPrayer.time]);

  useEffect(() => {
    // Charger les donnees API
    loadPrayerData();

    // Subscriptions Firebase
    const unsubPrayer = subscribeToPrayerTimes((times) => {
      if (times?.prayers) setPrayerTimes(times.prayers);
    });

    const unsubAnnouncements = subscribeToAnnouncements((data) => setAnnouncements(data || []));
    const unsubEvents = subscribeToEvents((data) => setEvents(data || []));
    const unsubJanaza = subscribeToJanaza(setJanaza);
    const unsubIqama = subscribeToIqama((horaires) => {
      if (horaires?.iqama) {
        setIqamaDelays(horaires.iqama);
      }
    });

    // Countdown timer
    const timer = setInterval(() => {
      calculateCountdown();
    }, 1000);

    return () => {
      unsubPrayer?.();
      unsubAnnouncements();
      unsubEvents();
      unsubJanaza();
      unsubIqama();
      clearInterval(timer);
    };
  }, [loadPrayerData, calculateCountdown]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPrayerData();
    setRefreshing(false);
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
          <Text style={styles.salamArabic}>
            {t('welcome')}
          </Text>
          <Text style={[styles.salamTranslation, isRTL && styles.rtlText]}>
            {t('salamTranslation')}
          </Text>
          <View style={styles.salamDivider} />
        </LinearGradient>

        {/* Titre */}
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>🕌 {t('mosqueName')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('mosqueLocation')}</Text>
        </View>

        <View style={styles.content}>
          {/* Prochaine prière */}
          <View style={styles.nextPrayerCard}>
            <Text style={[styles.nextPrayerLabel, isRTL && styles.rtlText]}>{t('nextPrayer')}</Text>
            <Text style={[styles.nextPrayerName, isRTL && styles.rtlText]}>{nextPrayer.icon} {getPrayerName(nextPrayer.name)}</Text>
            <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
            <Text style={styles.countdown}>{countdown}</Text>
          </View>

          {/* Horaires */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>🕐 {t('todaySchedule')}</Text>
            <View style={styles.prayerCard}>
              {/* En-tête des colonnes */}
              <View style={[styles.prayerHeaderRow, isRTL && styles.prayerRowRTL]}>
                <Text style={[styles.prayerHeaderText, isRTL && styles.rtlText]}>{isRTL ? 'الصلاة' : 'Prière'}</Text>
                <View style={styles.prayerTimesHeader}>
                  <Text style={styles.prayerHeaderLabel}>{isRTL ? 'أذان' : 'Adhan'}</Text>
                  <Text style={styles.prayerHeaderLabel}>{isRTL ? 'إقامة' : 'Iqama'}</Text>
                </View>
              </View>
              {(prayerTimes || []).map((prayer, index) => {
                const iqamaTime = getIqamaTime(prayer.name, prayer.time);
                return (
                  <View
                    key={prayer.name}
                    style={[
                      styles.prayerRow,
                      isRTL && styles.prayerRowRTL,
                      index === prayerTimes.length - 1 && styles.prayerRowLast,
                      prayer.name === nextPrayer.name && styles.prayerRowActive,
                    ]}
                  >
                    <View style={[styles.prayerName, isRTL && styles.prayerNameRTL]}>
                      <Text style={styles.prayerIcon}>{prayer.icon}</Text>
                      <Text style={[styles.prayerNameText, isRTL && styles.rtlText]}>{getPrayerName(prayer.name)}</Text>
                    </View>
                    <View style={styles.prayerTimesRow}>
                      <Text style={styles.prayerTimeAdhan}>{prayer.time}</Text>
                      <Text style={styles.prayerTimeIqama}>{iqamaTime || '-'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Calendrier Hégirien */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>📅 {t('hijriCalendar')}</Text>
            <View style={styles.card}>
              <View style={styles.hijriDateCenter}>
                <Text style={[styles.hijriLabel, isRTL && styles.rtlText]}>{t('todayLabel')}</Text>
                <Text style={styles.hijriDay}>{islamicDate.day} {isRTL ? islamicDate.monthAr : islamicDate.month}</Text>
                <Text style={styles.hijriYear}>{islamicDate.year} H</Text>
                <Text style={styles.hijriGregorian}>{islamicDate.gregorian}</Text>
              </View>
              <View style={styles.hijriDivider} />
              <Text style={[styles.upcomingLabel, isRTL && styles.rtlText]}>{t('upcomingEvents')}</Text>
              {(islamicEvents || []).map((event, index) => (
                <View key={event.name} style={[
                  styles.eventRow,
                  isRTL && styles.eventRowRTL,
                  index === islamicEvents.length - 1 && styles.eventRowLast
                ]}>
                  <Text style={styles.eventIcon}>{event.icon}</Text>
                  <View style={styles.eventInfo}>
                    <Text style={[styles.eventName, isRTL && styles.rtlText]}>{event.name}</Text>
                    <Text style={[styles.eventDate, isRTL && styles.rtlText]}>{event.gregorian}</Text>
                  </View>
                  <View style={styles.daysLeftBadge}>
                    <Text style={styles.daysLeftText}>{isRTL ? `${event.daysLeft}${t('daysLeftPrefix')}` : `${t('daysLeftPrefix')}${event.daysLeft}`}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Salat Janaza */}
          {mockJanazaList.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>⚰️ {t('janazaUpcoming')}</Text>
              {(mockJanazaList || []).map((janazaItem) => {
                const dateObj = new Date(janazaItem.date);
                const joursSemaineFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
                const joursSemaineAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                const moisFr = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                const moisAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                const joursSemaine = isRTL ? joursSemaineAr : joursSemaineFr;
                const mois = isRTL ? moisAr : moisFr;
                const dateFormatee = `${joursSemaine[dateObj.getDay()]} ${dateObj.getDate()} ${mois[dateObj.getMonth()]}`;
                const heureInfo = janazaItem.heure || `${t('afterPrayerPrefix')} ${getPrayerName(janazaItem.apresSalat || '')}`;

                return (
                  <View key={janazaItem.id} style={styles.janazaMockCard}>
                    <Text style={styles.janazaMockArabic}>{janazaItem.phraseAr}</Text>
                    <View style={styles.janazaMockInfo}>
                      <Text style={[styles.janazaMockName, isRTL && styles.rtlText]}>
                        {janazaItem.genre === 'homme' ? '👤' : '👤'} {janazaItem.prenom} {janazaItem.nom}
                      </Text>
                      <Text style={[styles.janazaMockDate, isRTL && styles.rtlText]}>
                        📅 {dateFormatee} - {heureInfo}
                      </Text>
                      <Text style={[styles.janazaMockLieu, isRTL && styles.rtlText]}>📍 {janazaItem.lieu}</Text>
                      <Text style={[styles.janazaMockPhraseFr, isRTL && styles.rtlText]}>"{isRTL ? janazaItem.phraseAr : janazaItem.phraseFr}"</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Annonces */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>📢 {t('announcements')}</Text>
            {(announcements || []).length > 0 ? (
              (announcements || []).map((announcement) => (
                <View key={announcement.id} style={styles.card}>
                  <Text style={[styles.announcementTitle, isRTL && styles.rtlText]}>{announcement.title}</Text>
                  <Text style={[styles.announcementContent, isRTL && styles.rtlText]}>{announcement.content}</Text>
                  <Text style={[styles.announcementDate, isRTL && styles.rtlText]}>
                    {t('publishedOn')} {announcement.publishedAt?.toLocaleDateString(isRTL ? 'ar-SA' : 'fr-FR')}
                  </Text>
                </View>
              ))
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={[styles.announcementTitle, isRTL && styles.rtlText]}>{isRTL ? 'دروس القرآن للأطفال' : 'Cours de Coran pour enfants'}</Text>
                  <Text style={[styles.announcementContent, isRTL && styles.rtlText]}>
                    {isRTL ? 'استئناف الدروس كل سبت الساعة 14:00. التسجيل إلزامي.' : 'Reprise des cours chaque samedi à 14h. Inscription obligatoire.'}
                  </Text>
                  <Text style={[styles.announcementDate, isRTL && styles.rtlText]}>{t('publishedOn')} {isRTL ? '8 يناير 2026' : '8 janvier 2026'}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={[styles.announcementTitle, isRTL && styles.rtlText]}>{isRTL ? 'جمع الملابس الشتوية' : 'Collecte vêtements chauds'}</Text>
                  <Text style={[styles.announcementContent, isRTL && styles.rtlText]}>
                    {isRTL ? 'يمكن التبرع يومياً بعد صلاة المغرب.' : 'Dépôt possible tous les jours après la prière de Maghrib.'}
                  </Text>
                  <Text style={[styles.announcementDate, isRTL && styles.rtlText]}>{t('publishedOn')} {isRTL ? '5 يناير 2026' : '5 janvier 2026'}</Text>
                </View>
              </>
            )}
          </View>

          {/* Prière Mortuaire */}
          {janaza && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>🕯️ {t('funeralPrayer')}</Text>
              <LinearGradient
                colors={['rgba(30,58,95,0.8)', 'rgba(26,39,68,0.9)']}
                style={styles.janazaCard}
              >
                <View style={[styles.janazaHeader, isRTL && styles.janazaHeaderRTL]}>
                  <View style={styles.janazaIcon}>
                    <Text style={styles.janazaIconText}>🤲</Text>
                  </View>
                  <View style={styles.janazaInfo}>
                    <Text style={[styles.janazaTitle, isRTL && styles.rtlText]}>{t('janazaTitle')}</Text>
                    <Text style={styles.janazaTime}>{janaza.prayerTime}</Text>
                  </View>
                </View>
                <View style={styles.janazaDetails}>
                  <Text style={[styles.janazaDeceased, isRTL && styles.rtlText]}>
                    <Text style={styles.janazaBold}>{t('deceased')} : </Text>
                    {janaza.deceasedName} {janaza.deceasedNameAr && `(${janaza.deceasedNameAr})`}
                  </Text>
                  <Text style={[styles.janazaMessage, isRTL && styles.rtlText]}>
                    {janaza.message || (isRTL ? "رحمه الله وأسكنه فسيح جناته" : "Que Allah lui accorde Sa miséricorde et l'accueille dans Son vaste Paradis.")}
                  </Text>
                </View>
                <View style={styles.janazaFooter}>
                  <Text style={[styles.janazaLocation, isRTL && styles.rtlText]}>📍 {janaza.location}</Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Événements */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>📅 {t('upcomingEvents')}</Text>
            {(events || []).length > 0 ? (
              (events || []).slice(0, 3).map((event) => {
                const { day, month } = formatDate(event.date);
                return (
                  <View key={event.id} style={styles.card}>
                    <View style={[styles.eventItem, isRTL && styles.eventItemRTL]}>
                      <View style={styles.eventDateBox}>
                        <Text style={styles.eventDay}>{day}</Text>
                        <Text style={styles.eventMonth}>{month}</Text>
                      </View>
                      <View style={styles.eventDetails}>
                        <Text style={[styles.eventTitle, isRTL && styles.rtlText]}>{event.title}</Text>
                        <Text style={[styles.eventSubtitle, isRTL && styles.rtlText]}>
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
                  <View style={[styles.eventItem, isRTL && styles.eventItemRTL]}>
                    <View style={styles.eventDateBox}>
                      <Text style={styles.eventDay}>12</Text>
                      <Text style={styles.eventMonth}>{isRTL ? 'يناير' : 'JAN'}</Text>
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={[styles.eventTitle, isRTL && styles.rtlText]}>{isRTL ? 'محاضرة: الصبر في الإسلام' : 'Conférence : La patience en Islam'}</Text>
                      <Text style={[styles.eventSubtitle, isRTL && styles.rtlText]}>{isRTL ? 'الأحد الساعة 15:00 • القاعة الرئيسية' : 'Dimanche à 15h00 • Salle principale'}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.card}>
                  <View style={[styles.eventItem, isRTL && styles.eventItemRTL]}>
                    <View style={styles.eventDateBox}>
                      <Text style={styles.eventDay}>18</Text>
                      <Text style={styles.eventMonth}>{isRTL ? 'يناير' : 'JAN'}</Text>
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={[styles.eventTitle, isRTL && styles.rtlText]}>{isRTL ? 'وجبة جماعية' : 'Repas communautaire'}</Text>
                      <Text style={[styles.eventSubtitle, isRTL && styles.rtlText]}>{isRTL ? 'السبت الساعة 19:30 • بعد المغرب' : 'Samedi à 19h30 • Après Maghrib'}</Text>
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
    width: '100%',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  salamArabic: {
    fontSize: 20,
    color: colors.accent,
    marginBottom: 10,
    textAlign: 'center',
    lineHeight: 36,
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
  prayerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(201,162,39,0.3)',
    marginBottom: spacing.xs,
  },
  prayerHeaderText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  prayerTimesHeader: {
    flexDirection: 'row',
    gap: 24,
  },
  prayerHeaderLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    width: 50,
    textAlign: 'center',
  },
  prayerTimesRow: {
    flexDirection: 'row',
    gap: 24,
  },
  prayerTimeAdhan: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
    width: 50,
    textAlign: 'center',
  },
  prayerTimeIqama: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
    width: 50,
    textAlign: 'center',
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
  // Janaza Mock styles
  janazaMockCard: {
    backgroundColor: 'rgba(30,58,95,0.9)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  janazaMockArabic: {
    fontSize: 20,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  janazaMockInfo: {},
  janazaMockName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  janazaMockDate: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.xs,
  },
  janazaMockLieu: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.sm,
  },
  janazaMockPhraseFr: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  // RTL Styles
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  prayerRowRTL: {
    flexDirection: 'row-reverse',
  },
  prayerNameRTL: {
    flexDirection: 'row-reverse',
  },
  eventRowRTL: {
    flexDirection: 'row-reverse',
  },
  eventItemRTL: {
    flexDirection: 'row-reverse',
  },
  janazaHeaderRTL: {
    flexDirection: 'row-reverse',
  },
});

export default HomeScreen;
