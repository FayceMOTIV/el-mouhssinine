import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Modal,
  TouchableOpacity,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import {
  subscribeToPrayerTimes,
  subscribeToAnnouncements,
  subscribeToEvents,
  subscribeToJanaza,
  subscribeToIqama,
  subscribeToPopups,
  subscribeToRappels,
  subscribeToIslamicDates,
  subscribeToMosqueeInfo,
  IqamaDelays,
  addMinutesToTime,
  Rappel,
  Popup,
  DateIslamique,
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
  const [islamicEvents, setIslamicEvents] = useState<DateIslamique[]>([
    { id: '1', nom: 'Ramadan', nomAr: 'رمضان', dateHijri: '1 Ramadan', dateGregorien: '2026-02-28', icon: '🌙' },
    { id: '2', nom: 'Aïd al-Fitr', nomAr: 'عيد الفطر', dateHijri: '1 Shawwal', dateGregorien: '2026-03-30', icon: '🎉' },
    { id: '3', nom: 'Aïd al-Adha', nomAr: 'عيد الأضحى', dateHijri: '10 Dhul Hijja', dateGregorien: '2026-06-06', icon: '🐑' },
  ]);
  const [activePopup, setActivePopup] = useState<Popup | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [currentRappel, setCurrentRappel] = useState<Rappel | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);

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

    // Subscriptions aux dates islamiques
    const unsubIslamicDates = subscribeToIslamicDates((dates) => {
      if (dates && dates.length > 0) {
        setIslamicEvents(dates);
      }
    });

    // Subscriptions aux rappels du jour
    const unsubRappels = subscribeToRappels((rappels) => {
      if (rappels && rappels.length > 0) {
        // Sélectionner un rappel aléatoire pour la journée
        const randomIndex = Math.floor(Math.random() * rappels.length);
        setCurrentRappel(rappels[randomIndex]);
      }
    });

    // Subscription aux infos mosquée (pour l'image header)
    const unsubMosqueeInfo = subscribeToMosqueeInfo((info) => {
      if (info?.headerImageUrl) {
        setHeaderImageUrl(info.headerImageUrl);
      }
    });

    // Subscriptions aux popups
    const unsubPopups = subscribeToPopups(async (popups) => {
      if (popups && popups.length > 0) {
        const popup = popups[0]; // Prendre le popup le plus prioritaire
        // Vérifier si ce popup a déjà été vu aujourd'hui
        const today = new Date().toISOString().split('T')[0];
        const lastShown = await AsyncStorage.getItem(`popup_${popup.id}_shown`);
        if (lastShown !== today) {
          setActivePopup(popup);
          setShowPopup(true);
        }
      } else {
        // Popup de bienvenue par défaut si pas de popup Firebase
        const today = new Date().toISOString().split('T')[0];
        const lastShown = await AsyncStorage.getItem('popup_welcome_shown');
        if (lastShown !== today) {
          setActivePopup({
            id: 'welcome',
            titre: 'Bienvenue à El Mouhssinine',
            contenu: 'Que la paix soit sur vous. Bienvenue dans l\'application de la mosquée El Mouhssinine de Bourg-en-Bresse.',
            actif: true,
          });
          setShowPopup(true);
        }
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
      unsubIslamicDates();
      unsubRappels();
      unsubMosqueeInfo();
      unsubPopups();
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

  // Fermer le popup et enregistrer qu'il a été vu
  const closePopup = async () => {
    if (activePopup) {
      const today = new Date().toISOString().split('T')[0];
      await AsyncStorage.setItem(`popup_${activePopup.id}_shown`, today);
    }
    setShowPopup(false);
    setActivePopup(null);
  };

  return (
    <>
      {/* Modal Popup */}
      <Modal
        visible={showPopup && activePopup !== null}
        transparent
        animationType="fade"
        onRequestClose={closePopup}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <LinearGradient
              colors={['#5c3a1a', '#7f4f24']}
              style={styles.popupGradient}
            >
              <Text style={styles.popupTitle}>{activePopup?.titre || ''}</Text>
              <Text style={styles.popupContent}>{activePopup?.contenu || ''}</Text>
              <TouchableOpacity style={styles.popupButton} onPress={closePopup}>
                <Text style={styles.popupButtonText}>{isRTL ? 'حسنا' : "J'ai compris"}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>


    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header - Image ou Salam */}
        {headerImageUrl ? (
          <Image
            source={{ uri: headerImageUrl }}
            style={styles.headerImage}
            resizeMode="cover"
          />
        ) : (
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
        )}

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
            {/* Dates sous le countdown */}
            <Text style={styles.dateGregorian}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })}
            </Text>
            <Text style={styles.dateHijri}>
              {islamicDate.day} {isRTL ? islamicDate.monthAr : islamicDate.month} {islamicDate.year}
            </Text>
          </View>

          {/* Rappel du jour */}
          <View style={styles.rappelContainer}>
            <Text style={[styles.rappelTitle, isRTL && styles.rtlText]}>📿 {isRTL ? 'تذكير اليوم' : 'Rappel du jour'}</Text>
            <Text style={[styles.rappelText, isRTL && styles.rtlText]}>
              "{currentRappel
                ? (isRTL ? currentRappel.texteAr : currentRappel.texteFr)
                : (isRTL
                  ? 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى'
                  : 'Les actes ne valent que par leurs intentions, et chacun sera rétribué selon son intention.')}"
            </Text>
            <Text style={[styles.rappelSource, isRTL && styles.rtlText]}>
              - {currentRappel?.source || (isRTL ? 'البخاري ومسلم' : 'Hadith Bukhari & Muslim')}
            </Text>
          </View>

          {/* Services */}
          <View style={styles.servicesSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>🕌 {t('services')}</Text>
            <View style={styles.servicesGrid}>
              {[
                { icon: '🅿️', labelKey: 'parking' },
                { icon: '♿', labelKey: 'accessHandicapes' },
                { icon: '💧', labelKey: 'salleAblution' },
                { icon: '👩', labelKey: 'espaceFemmes' },
                { icon: '📚', labelKey: 'coursAdultes' },
                { icon: '👶', labelKey: 'coursEnfants' },
              ].map((service, index) => (
                <View key={index} style={styles.serviceItem}>
                  <Text style={styles.serviceIcon}>{service.icon}</Text>
                  <Text style={[styles.serviceLabel, isRTL && styles.rtlText]}>{t(service.labelKey as any)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Horaires */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>🕐 {t('todaySchedule')}</Text>
              <TouchableOpacity
                onPress={() => setShowCalendar(!showCalendar)}
                style={styles.calendarToggle}
              >
                <Text style={styles.calendarToggleText}>📅</Text>
              </TouchableOpacity>
            </View>
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

          {/* Calendrier Hégirien - Masqué par défaut */}
          {showCalendar && (
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
              <Text style={styles.approximatif}>
                {isRTL ? '(تواريخ تقريبية حسب الحساب الفلكي)' : '(dates approximatives selon calcul astronomique)'}
              </Text>
              {(islamicEvents || []).slice(0, 3).map((event, index) => {
                const eventDate = new Date(event.dateGregorien);
                const today = new Date();
                const daysLeft = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysLeft < 0) return null; // Ne pas afficher les événements passés
                const formattedDate = eventDate.toLocaleDateString(isRTL ? 'ar-SA' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                return (
                  <View key={event.id} style={[
                    styles.eventRow,
                    isRTL && styles.eventRowRTL,
                    index === Math.min(islamicEvents.length - 1, 2) && styles.eventRowLast
                  ]}>
                    <Text style={styles.eventIcon}>{event.icon}</Text>
                    <View style={styles.eventInfo}>
                      <Text style={[styles.eventName, isRTL && styles.rtlText]}>{isRTL ? event.nomAr : event.nom}</Text>
                      <Text style={[styles.eventDate, isRTL && styles.rtlText]}>{formattedDate}</Text>
                    </View>
                    <View style={styles.daysLeftBadge}>
                      <Text style={styles.daysLeftText}>{isRTL ? `${daysLeft} يوم` : `J-${daysLeft}`}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
          )}

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
    </>
  );
};

const styles = StyleSheet.create({
  // Popup styles
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  popupContainer: {
    borderRadius: 20,
    marginHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  popupGradient: {
    padding: spacing.xl,
    alignItems: 'center',
    borderRadius: 20,
  },
  popupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  popupContent: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  popupButton: {
    backgroundColor: '#c9a227',
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  popupButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerImage: {
    width: '100%',
    height: 200,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
  },
  salamHeader: {
    width: '100%',
    paddingTop: 70,
    paddingBottom: 24,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  salamArabic: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    width: '100%',
    paddingHorizontal: 8,
    flexWrap: 'wrap',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 0,
  },
  calendarToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(201,162,39,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarToggleText: {
    fontSize: 22,
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
  dateGregorian: {
    fontSize: fontSize.md,
    color: colors.text,
    marginTop: spacing.md,
  },
  dateHijri: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  rappelContainer: {
    backgroundColor: 'rgba(201, 162, 39, 0.2)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  rappelTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  rappelText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  rappelSource: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  approximatif: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  // Services
  servicesSection: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  serviceItem: {
    width: '30%',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  serviceIcon: {
    fontSize: 28,
    marginBottom: 5,
  },
  serviceLabel: {
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
  },
  // Activités
  activitesSection: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  activiteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  activiteItemRTL: {
    flexDirection: 'row-reverse',
  },
  activiteIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  activiteInfo: {
    flex: 1,
  },
  activiteLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  activiteDetail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevronActivite: {
    fontSize: 20,
    color: colors.textMuted,
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
