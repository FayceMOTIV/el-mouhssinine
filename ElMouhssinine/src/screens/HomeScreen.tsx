import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Modal,
  TouchableOpacity,
  Image,
  Animated,
  Vibration,
  Platform,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, wp, shadows, MIN_TOUCH_SIZE } from '../theme/colors';
import { BackgroundPattern } from '../components/BackgroundPattern';
import {
  subscribeToAnnouncements,
  subscribeToEvents,
  subscribeToJanazaList,
  subscribeToIqama,
  subscribeToPopups,
  subscribeToRappels,
  subscribeToIslamicDates,
  subscribeToMosqueeInfo,
  subscribeToGeneralSettings,
  subscribeToRamadanSettings,
  IqamaDelays,
  JumuaTimes,
  addMinutesToTime,
  Rappel,
  Popup,
  DateIslamique,
  DisplaySettings,
  RamadanSettings,
} from '../services/firebase';
import { PrayerAPI, PrayerTimings } from '../services/prayerApi';
import { PrayerTime, Announcement, Event, Janaza } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  getPrayerNotificationSettings,
  schedulePrayerNotifications,
  getBoostSettings,
  cancelBoostNotificationsForPrayer,
  scheduleBoostNotifications,
  PrayerBoostSettings,
  checkMosqueProximity,
  getMosqueProximitySettings,
  getPrayedPrayersToday,
  markPrayerAsPrayed,
} from '../services/prayerNotifications';
import { checkMosqueProximityForeground } from '../services/backgroundLocation';
import Geolocation from '@react-native-community/geolocation';
import { setInAppNotificationCallback } from '../services/notifications';
import auth from '@react-native-firebase/auth';
import { logger } from '../utils';
import { HomeScreenSkeleton } from '../components';
import { subscribeToUserMessages, UserMessage } from '../services/firebase';
import {
  getNotificationHistory,
  markAllNotificationsAsRead,
  getUnreadCount,
  StoredNotification,
} from '../services/notificationHistory';

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

// Bug 17 Fix: Pas de mock data pour janaza - données sensibles (noms de défunts)
// La section janaza ne s'affiche que si des données réelles existent dans Firestore

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const { t, isRTL, language } = useLanguage();
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>(mockPrayerTimes);
  const [nextPrayer, setNextPrayer] = useState({ name: 'Dhuhr', time: '13:15', icon: '☀️' });
  const [countdown, setCountdown] = useState('01:23:45');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [janazaList, setJanazaList] = useState<Janaza[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Animation du countdown
  const countdownOpacity = useRef(new Animated.Value(1)).current;
  const [islamicDate, setIslamicDate] = useState(mockIslamicDate);
  const [iqamaDelays, setIqamaDelays] = useState<IqamaDelays | null>(null);
  const [jumuaTimes, setJumuaTimes] = useState<JumuaTimes | null>(null);
  // Dates islamiques 2026 selon le calendrier Umm al-Qura (ajustées pour la France)
  // Source: islamicfinder.org / mawaqit.net
  const [islamicEvents, setIslamicEvents] = useState<DateIslamique[]>([
    { id: '1', nom: 'Ramadan', nomAr: 'رمضان', dateHijri: '1 Ramadan 1447', dateGregorien: '2026-02-18', icon: '🌙' },
    { id: '2', nom: 'Aïd al-Fitr', nomAr: 'عيد الفطر', dateHijri: '1 Shawwal 1447', dateGregorien: '2026-03-20', icon: '🎉' },
    { id: '3', nom: 'Aïd al-Adha', nomAr: 'عيد الأضحى', dateHijri: '10 Dhul Hijja 1447', dateGregorien: '2026-05-27', icon: '🐑' },
  ]);
  const [activePopup, setActivePopup] = useState<Popup | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupQueue, setPopupQueue] = useState<Popup[]>([]); // File d'attente multi-popups
  const [currentRappel, setCurrentRappel] = useState<Rappel | null>(null);

  const [showCalendar, setShowCalendar] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [parisTime, setParisTime] = useState('');
  const [rawPrayerTimings, setRawPrayerTimings] = useState<PrayerTimings | null>(null);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    showIqama: true,
    showSunrise: true,
    darkMode: true,
  });

  // Boost prière
  const [boostSettings, setBoostSettings] = useState<PrayerBoostSettings | null>(null);
  const [currentPrayer, setCurrentPrayer] = useState<{ name: string; time: string; nameAr: string } | null>(null);
  const [hasPrayedCurrentPrayer, setHasPrayedCurrentPrayer] = useState(false);

  // Notification in-app
  const [inAppNotification, setInAppNotification] = useState<{ title: string; body: string } | null>(null);

  // Historique des notifications
  const [showNotificationHistory, setShowNotificationHistory] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState<StoredNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);

  // Badge messages non lus
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  // Ramadan mode
  const [ramadanSettings, setRamadanSettings] = useState<RamadanSettings | null>(null);
  const [ramadanDay, setRamadanDay] = useState<number | null>(null);

  // Date relative ("Il y a 2h", "Il y a 30min")
  const getRelativeTime = useCallback((timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (isRTL) {
      if (seconds < 60) return 'الآن';
      if (minutes < 60) return `منذ ${minutes} د`;
      if (hours < 24) return `منذ ${hours} س`;
      return `منذ ${days} ي`;
    }
    if (seconds < 60) return "A l'instant";
    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${days}j`;
  }, [isRTL]);

  // Traduction des noms de prière
  const getPrayerName = (name: string) => {
    if (name === 'Sunrise' || name === 'Shurûq') {
      return isRTL ? 'الشروق' : 'Shurûq';
    }
    const prayerKey = name.toLowerCase().replace(' (demain)', '') as 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
    return t(prayerKey) || name;
  };

  // Liste des prières à afficher (avec ou sans Shurûq selon les settings)
  const displayedPrayerTimes = React.useMemo(() => {
    if (!displaySettings.showSunrise || !rawPrayerTimings?.Sunrise) {
      return prayerTimes;
    }
    // Insérer Shurûq après Fajr
    const sunriseTime = PrayerAPI.formatTime(rawPrayerTimings.Sunrise);
    const result: PrayerTime[] = [];
    for (const prayer of prayerTimes) {
      result.push(prayer);
      if (prayer.name === 'Fajr') {
        result.push({ name: 'Shurûq', time: sunriseTime, icon: '☀️' });
      }
    }
    return result;
  }, [prayerTimes, displaySettings.showSunrise, rawPrayerTimings?.Sunrise]);

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
      setRawPrayerTimings(timings); // Stocker pour les notifications locales
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
      if (__DEV__) console.warn('API error, using mock data:', error);
      setLoadError(t('loadingFailed') as string);
      // Garde les donnees mockees en fallback
    } finally {
      setLoading(false);
    }
  }, [t]);

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

    const newCountdown = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Animation fade quand les secondes changent
    Animated.sequence([
      Animated.timing(countdownOpacity, { toValue: 0.5, duration: 100, useNativeDriver: true }),
      Animated.timing(countdownOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    setCountdown(newCountdown);

    // Mettre à jour l'heure de Paris
    const parisTimeStr = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris'
    });
    setParisTime(parisTimeStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdownOpacity is stable Animated ref
  }, [nextPrayer.time]);

  useEffect(() => {
    // Charger les donnees API (horaires de priere depuis Aladhan)
    loadPrayerData();

    // Subscriptions Firebase
    const unsubAnnouncements = subscribeToAnnouncements((data) => setAnnouncements(data || []));
    const unsubEvents = subscribeToEvents((data) => setEvents(data || []));
    const unsubJanaza = subscribeToJanazaList(setJanazaList);
    const unsubIqama = subscribeToIqama((horaires) => {
      if (horaires?.iqama) {
        setIqamaDelays(horaires.iqama);
      }
      if (horaires?.jumua) {
        setJumuaTimes(horaires.jumua);
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
      logger.log('[HomeScreen] MosqueeInfo received:', JSON.stringify({
        hasInfo: !!info,
        headerImageUrl: info?.headerImageUrl || 'NOT_SET',
        name: info?.name
      }));
      if (info?.headerImageUrl) {
        setHeaderImageUrl(info.headerImageUrl);
      }
    });

    // Subscription aux paramètres d'affichage (showIqama, showSunrise)
    const unsubGeneralSettings = subscribeToGeneralSettings((settings) => {
      if (settings?.display) {
        setDisplaySettings(settings.display);
      }
    });

    // Subscription aux paramètres Ramadan
    const unsubRamadan = subscribeToRamadanSettings((settings) => {
      setRamadanSettings(settings);
      // Calculer le jour actuel de Ramadan
      if (settings.enabled && settings.startDate && settings.endDate) {
        const now = new Date();
        const start = new Date(settings.startDate);
        const end = new Date(settings.endDate);
        if (now >= start && now <= end) {
          const diffTime = now.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          setRamadanDay(diffDays);
        } else {
          setRamadanDay(null);
        }
      } else {
        setRamadanDay(null);
      }
    });

    // Subscriptions aux popups Firebase - File d'attente multi-popups
    const unsubPopups = subscribeToPopups(async (popups) => {
      logger.log(`[HomeScreen] Popups reçus: ${popups?.length || 0}`);
      if (popups && popups.length > 0) {
        // Construire la file d'attente des popups a afficher
        const queue: Popup[] = [];
        for (const popup of popups) {
          const shouldShow = await shouldShowPopup(popup);
          logger.log(`[HomeScreen] Popup ${popup.id} (${popup.titre}): shouldShow=${shouldShow}, frequence=${popup.frequence}`);
          if (shouldShow) {
            queue.push(popup);
          }
        }
        logger.log(`[HomeScreen] Popup queue: ${queue.length} à afficher`);
        // Stocker la file et afficher la premiere
        if (queue.length > 0) {
          setPopupQueue(queue.slice(1)); // Reste de la file
          setActivePopup(queue[0]); // Premiere popup
          setShowPopup(true);
        }
      }
    });

    // Countdown timer
    const timer = setInterval(() => {
      calculateCountdown();
    }, 1000);

    return () => {
      unsubAnnouncements();
      unsubEvents();
      unsubJanaza();
      unsubIqama();
      unsubIslamicDates();
      unsubRappels();
      unsubMosqueeInfo();
      unsubGeneralSettings();
      unsubRamadan();
      unsubPopups();
      clearInterval(timer);
    };
  }, [loadPrayerData, calculateCountdown]);

  // Scheduler les notifications locales de priere à chaque focus de l'écran
  // IMPORTANT: Les notifications iOS expirent, il faut les reprogrammer régulièrement
  useFocusEffect(
    useCallback(() => {
      const scheduleNotifications = async () => {
        if (!rawPrayerTimings) return;
        try {
          logger.log('[HomeScreen] Re-scheduling prayer notifications...');
          const settings = await getPrayerNotificationSettings();
          await schedulePrayerNotifications(rawPrayerTimings, settings);
        } catch (error) {
          logger.warn('[HomeScreen] Erreur scheduling notifications:', error);
        }
      };
      scheduleNotifications();
    }, [rawPrayerTimings])
  );

  // Charger les paramètres boost ET programmer les notifications à chaque focus
  useFocusEffect(
    useCallback(() => {
      const loadAndScheduleBoost = async () => {
        try {
          // 1. Charger les settings
          const settings = await getBoostSettings();
          setBoostSettings(settings);

          // 2. Programmer les notifications si activé
          if (!rawPrayerTimings || !settings.enabled) {
            logger.log('[HomeScreen] Boost désactivé ou pas de timings');
            return;
          }

          const translations = {
            reminderTitle: t('boostReminderTitle'),
            urgentTitle: t('boostUrgentTitle'),
            after30min: t('boostAfter30min'),
            midTime: t('boostMidTime'),
            before15min: t('boostBefore15min'),
          };

          // 3. Charger les prières déjà faites aujourd'hui pour ne pas re-scheduler leurs boost
          const prayedToday = await getPrayedPrayersToday();
          await scheduleBoostNotifications(rawPrayerTimings, settings, translations, prayedToday);
          logger.log('[HomeScreen] Boost notifications reprogrammées avec succès');
        } catch (error) {
          logger.warn('[HomeScreen] Erreur boost:', error);
        }
      };

      loadAndScheduleBoost();
    }, [rawPrayerTimings, t])
  );

  // Mettre à jour la prière en cours quand les horaires changent
  useEffect(() => {
    if (!rawPrayerTimings) return;
    const current = PrayerAPI.getCurrentPrayer(rawPrayerTimings);

    // Charger l'état "J'ai prié" depuis AsyncStorage (avec date)
    const loadPrayedState = async () => {
      try {
        const prayedToday = await getPrayedPrayersToday();
        if (current && prayedToday.has(current.name)) {
          setHasPrayedCurrentPrayer(true);
        } else {
          setHasPrayedCurrentPrayer(false);
        }
      } catch (error) {
        logger.warn('[HomeScreen] Erreur chargement état prié:', error);
      }
    };

    loadPrayedState();
    setCurrentPrayer(current);

    // Mettre à jour toutes les minutes
    const interval = setInterval(async () => {
      const updated = PrayerAPI.getCurrentPrayer(rawPrayerTimings);

      // Vérifier si la prière en cours a changé
      setCurrentPrayer(prev => {
        if (updated?.name !== prev?.name) {
          // Nouvelle prière : vérifier si elle a déjà été faite aujourd'hui
          if (updated) {
            getPrayedPrayersToday().then(prayedToday => {
              setHasPrayedCurrentPrayer(prayedToday.has(updated.name));
            }).catch(() => setHasPrayedCurrentPrayer(false));
          } else {
            setHasPrayedCurrentPrayer(false);
          }
        }
        return updated;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [rawPrayerTimings]);

  // Configurer le callback pour les notifications in-app
  useEffect(() => {
    setInAppNotificationCallback((notification) => {
      setInAppNotification(notification);
    });

    return () => {
      setInAppNotificationCallback(null);
    };
  }, []);

  // Charger l'historique des notifications et le compteur de non lus
  useFocusEffect(
    useCallback(() => {
      const loadNotificationHistory = async () => {
        try {
          const history = await getNotificationHistory();
          setNotificationHistory(history);
          const unread = await getUnreadCount();
          setUnreadNotifCount(unread);
        } catch (error) {
          logger.warn('[HomeScreen] Erreur chargement historique notifs:', error);
        }
      };
      loadNotificationHistory();
    }, [])
  );

  // Souscrire aux messages de l'utilisateur pour le badge
  useEffect(() => {
    let unsubMessages: (() => void) | null = null;

    const unsubAuth = auth().onAuthStateChanged((user) => {
      // Nettoyer l'ancien listener
      if (unsubMessages) {
        unsubMessages();
        unsubMessages = null;
      }

      if (!user) {
        setUnreadMsgCount(0);
        return;
      }

      unsubMessages = subscribeToUserMessages(user.uid, async (messages: UserMessage[]) => {
        // Récupérer le timestamp de dernière lecture des messages
        const lastReadStr = await AsyncStorage.getItem('messages_last_read_at');
        const lastReadAt = lastReadStr ? new Date(lastReadStr).getTime() : 0;
        // Compter les messages avec une réponse mosquée APRÈS la dernière lecture
        const unread = messages.filter(m => {
          if (!m.reponses || m.reponses.length === 0) return false;
          const mosqueeReplies = m.reponses.filter(r => r.createdBy === 'mosquee');
          if (mosqueeReplies.length === 0) return false;
          const lastMosqueeReply = mosqueeReplies[mosqueeReplies.length - 1];
          const replyTime = lastMosqueeReply.createdAt instanceof Date
            ? lastMosqueeReply.createdAt.getTime()
            : new Date(lastMosqueeReply.createdAt).getTime();
          return replyTime > lastReadAt;
        }).length;
        setUnreadMsgCount(unread);
      });
    });

    return () => {
      unsubAuth();
      if (unsubMessages) unsubMessages();
    };
  }, []);

  // Ouvrir l'historique des notifications
  const openNotificationHistory = useCallback(async () => {
    const history = await getNotificationHistory();
    setNotificationHistory(history);
    setShowNotificationHistory(true);
    setExpandedNotifId(null);
  }, []);

  // Marquer toutes les notifications comme lues
  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsAsRead();
    setUnreadNotifCount(0);
    const history = await getNotificationHistory();
    setNotificationHistory(history);
  }, []);

  // Vérifier la proximité de la mosquée au démarrage ET quand l'app revient au premier plan
  // Note: Le service backgroundLocation.ts gère aussi la vérification en arrière-plan (toutes les ~15min)
  useEffect(() => {
    let isMounted = true;

    const checkProximity = async () => {
      if (!isMounted) return;

      try {
        if (__DEV__) console.log('[HomeScreen] Vérification proximité mosquée (foreground)...');
        const sent = await checkMosqueProximityForeground(language === 'ar' ? 'ar' : 'fr');
        if (sent) {
          if (__DEV__) console.log('[HomeScreen] Notification mode silencieux envoyée !');
        }
      } catch (error) {
        if (__DEV__) console.warn('[HomeScreen] Erreur check proximité:', error);
      }
    };

    // Vérifier au démarrage
    checkProximity();

    // Écouter les changements d'état de l'app (arrière-plan -> premier plan)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (__DEV__) console.log('[HomeScreen] App au premier plan, vérification proximité...');
        checkProximity();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [language]);

  // Gérer le clic sur "J'ai prié" - annule les notifications boost et masque le bouton
  const handlePrayed = useCallback(async () => {
    if (!currentPrayer || !boostSettings?.enabled) return;

    try {
      // Marquer comme prié (masque le bouton jusqu'à la prochaine prière)
      setHasPrayedCurrentPrayer(true);
      // Sauvegarder dans AsyncStorage avec date + annuler les notifications boost
      // markPrayerAsPrayed stocke la prière dans la liste du jour ET annule les boost
      await markPrayerAsPrayed(currentPrayer.name);
      Vibration.vibrate(100); // Feedback haptique
    } catch (error) {
      logger.warn('[HomeScreen] Erreur annulation boost:', error);
    }
  }, [currentPrayer, boostSettings?.enabled]);

  const onRefresh = async () => {
    setRefreshing(true);
    setLoadError(null); // Reset error on refresh
    await loadPrayerData();
    setRefreshing(false);
  };

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUI', 'JUI', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
    return { day, month: months[date.getMonth()] };
  };

  // Vérifier si un popup doit être affiché selon sa fréquence
  const shouldShowPopup = async (popup: Popup): Promise<boolean> => {
    const frequence = popup.frequence || 'always';
    const storageKey = `popup_${popup.id}_shown`;

    // Si c'est un popup de bienvenue (champ type OU titre contient "bienvenue", "welcome", "مرحبا")
    const titreNormalized = (popup.titre || '').toLowerCase();
    const isWelcomePopup = (popup as any).type === 'bienvenue' ||
                           titreNormalized.includes('bienvenue') ||
                           titreNormalized.includes('welcome') ||
                           (popup.titre || '').includes('مرحبا');

    if (isWelcomePopup) {
      // Ne montrer que si c'est la première ouverture de l'app (jamais vue avant)
      const hasLaunched = await AsyncStorage.getItem('app_has_launched_welcome');
      if (hasLaunched !== 'true') {
        await AsyncStorage.setItem('app_has_launched_welcome', 'true');
        return true;
      }
      return false; // Déjà vue, ne plus montrer
    }

    switch (frequence) {
      case 'always':
        // Toujours afficher
        return true;

      case 'daily': {
        // Une fois par jour
        const today = new Date().toISOString().split('T')[0];
        const lastShown = await AsyncStorage.getItem(storageKey);
        return lastShown !== today;
      }

      case 'once': {
        // Une seule fois (définitivement)
        const seen = await AsyncStorage.getItem(`popup_seen_${popup.id}`);
        return seen !== 'true';
      }

      case 'weekly': {
        // Une fois par semaine
        const lastShown = await AsyncStorage.getItem(storageKey);
        if (!lastShown) return true;
        const lastDate = new Date(lastShown);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 7;
      }

      default:
        return true;
    }
  };

  // Fermer le popup et enregistrer qu'il a été vu selon sa fréquence
  // Puis afficher la popup suivante dans la file d'attente
  const closePopup = async () => {
    if (activePopup) {
      const frequence = activePopup.frequence || 'always';
      const today = new Date().toISOString().split('T')[0];

      switch (frequence) {
        case 'daily':
          // Stocker la date d'aujourd'hui
          await AsyncStorage.setItem(`popup_${activePopup.id}_shown`, today);
          break;
        case 'once':
          // Marquer comme vu définitivement
          await AsyncStorage.setItem(`popup_seen_${activePopup.id}`, 'true');
          break;
        case 'weekly':
          // Stocker la date pour vérification hebdomadaire
          await AsyncStorage.setItem(`popup_${activePopup.id}_shown`, today);
          break;
        // 'always' n'enregistre rien
      }
    }

    // Afficher la popup suivante dans la file d'attente
    if (popupQueue.length > 0) {
      const nextPopup = popupQueue[0];
      setPopupQueue(popupQueue.slice(1));
      setActivePopup(nextPopup);
      // showPopup reste true
    } else {
      setShowPopup(false);
      setActivePopup(null);
    }
  };

  // Afficher le skeleton pendant le chargement initial
  if (loading) {
    return (
      <View style={styles.container}>
        <HomeScreenSkeleton />
      </View>
    );
  }

  return (
    <>
      {/* Modal Popup */}
      <Modal
        visible={showPopup && activePopup !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closePopup}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>{activePopup?.titre || ''}</Text>
            <Text style={styles.popupContent}>{activePopup?.contenu || ''}</Text>
            <TouchableOpacity
              style={styles.popupButton}
              onPress={closePopup}
              activeOpacity={0.7}
            >
              <Text style={styles.popupButtonText}>{t('understood')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Calendrier Hégirien */}
      <Modal
        visible={showCalendar}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContainer}>
            <TouchableOpacity
              style={styles.calendarCloseBtn}
              onPress={() => setShowCalendar(false)}
              accessibilityLabel="Fermer le calendrier"
              accessibilityRole="button"
            >
              <Text style={styles.calendarCloseBtnText}>×</Text>
            </TouchableOpacity>

            <Text style={[styles.calendarModalTitle, isRTL && styles.rtlText]}>📅 {t('hijriCalendar')}</Text>

            <View style={styles.hijriDateCenter}>
              <Text style={[styles.hijriLabel, isRTL && styles.rtlText]}>{t('todayLabel')}</Text>
              <Text style={styles.hijriDay}>{islamicDate.day} {isRTL ? islamicDate.monthAr : islamicDate.month}</Text>
              <Text style={styles.hijriYear}>{islamicDate.year} H</Text>
              <Text style={styles.hijriGregorian}>{islamicDate.gregorian}</Text>
            </View>

            <View style={styles.hijriDivider} />

            <Text style={[styles.upcomingLabel, isRTL && styles.rtlText]}>{t('upcomingEvents')}</Text>
            <Text style={styles.approximatif}>
              {t('approximateDates')}
            </Text>

            {(islamicEvents || []).slice(0, 3).map((event, index) => {
              const eventDate = new Date(event.dateGregorien);
              const today = new Date();
              const daysLeft = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              if (daysLeft < 0) return null;
              const formattedDate = eventDate.toLocaleDateString(isRTL ? 'ar-SA' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
              return (
                <View key={event.id} style={[
                  styles.calendarEventRow,
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

            <TouchableOpacity
              style={styles.calendarOkBtn}
              onPress={() => setShowCalendar(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.calendarOkBtnText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Notification In-App */}
      <Modal
        visible={inAppNotification !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setInAppNotification(null)}
      >
        <View style={styles.notifModalOverlay}>
          <View style={styles.notifModalContainer}>
            <TouchableOpacity
              style={styles.notifCloseBtn}
              onPress={() => setInAppNotification(null)}
              accessibilityLabel="Fermer"
              accessibilityRole="button"
            >
              <Text style={styles.notifCloseBtnText}>×</Text>
            </TouchableOpacity>

            <Text style={styles.notifIcon}>🔔</Text>
            <Text style={styles.notifTitle}>{inAppNotification?.title}</Text>
            <Text style={styles.notifBody}>{inAppNotification?.body}</Text>

            <TouchableOpacity
              style={styles.notifOkBtn}
              onPress={() => setInAppNotification(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.notifOkBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Historique des Notifications */}
      <Modal
        visible={showNotificationHistory}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotificationHistory(false)}
      >
        <View style={styles.historyModalOverlay}>
          <View style={styles.historyModalContainer}>
            <TouchableOpacity
              style={styles.historyCloseBtn}
              onPress={() => setShowNotificationHistory(false)}
              accessibilityLabel="Fermer"
              accessibilityRole="button"
            >
              <Text style={styles.historyCloseBtnText}>×</Text>
            </TouchableOpacity>

            <Text style={[styles.historyModalTitle, isRTL && styles.rtlText]}>
              🔔 {isRTL ? 'سجل الإشعارات' : 'Historique des notifications'}
            </Text>
            <Text style={styles.historySubtitle}>
              {isRTL ? 'آخر 24 ساعة' : 'Dernières 24 heures'}
            </Text>

            {/* Bouton Tout marquer comme lu */}
            {unreadNotifCount > 0 && (
              <TouchableOpacity
                style={styles.markAllReadBtn}
                onPress={handleMarkAllRead}
                activeOpacity={0.7}
              >
                <Text style={styles.markAllReadBtnText}>
                  {isRTL ? 'تعليم الكل كمقروء' : 'Tout marquer comme lu'}
                </Text>
              </TouchableOpacity>
            )}

            <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator={false}>
              {notificationHistory.length === 0 ? (
                <View style={styles.historyEmptyContainer}>
                  <Text style={styles.historyEmptyIcon}>📭</Text>
                  <Text style={[styles.historyEmptyText, isRTL && styles.rtlText]}>
                    {isRTL ? 'لا توجد إشعارات' : 'Aucune notification récente'}
                  </Text>
                </View>
              ) : (
                notificationHistory.map((notif, index) => {
                  const isExpanded = expandedNotifId === notif.id;

                  // Icône selon le type
                  let typeIcon = '📢';
                  if (notif.type === 'prayer') typeIcon = '🕌';
                  else if (notif.type === 'message') typeIcon = '💬';
                  else if (notif.type === 'event') typeIcon = '📅';
                  else if (notif.type === 'janaza') typeIcon = '⚰️';

                  return (
                    <TouchableOpacity
                      key={notif.id}
                      activeOpacity={0.7}
                      onPress={() => setExpandedNotifId(isExpanded ? null : notif.id)}
                      style={[
                        styles.historyItem,
                        index === notificationHistory.length - 1 && styles.historyItemLast,
                        !notif.read && styles.historyItemUnread,
                      ]}
                    >
                      <Text style={styles.historyItemIcon}>{typeIcon}</Text>
                      <View style={styles.historyItemContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.historyItemTitle, isRTL && styles.rtlText, { flex: 1 }]} numberOfLines={isExpanded ? undefined : 1}>
                            {notif.title}
                          </Text>
                          <Text style={styles.historyExpandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                        </View>
                        {isExpanded && notif.body ? (
                          <Text style={[styles.historyItemBody, isRTL && styles.rtlText]}>
                            {notif.body}
                          </Text>
                        ) : null}
                        <Text style={[styles.historyItemTime, isRTL && styles.rtlText]}>
                          {getRelativeTime(notif.timestamp)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.historyOkBtn}
              onPress={() => setShowNotificationHistory(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.historyOkBtnText}>{isRTL ? 'إغلاق' : 'Fermer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Nos Services */}
      <Modal
        visible={showServicesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowServicesModal(false)}
      >
        <View style={styles.servicesModalOverlay}>
          <View style={styles.servicesModalContainer}>
            <TouchableOpacity
              style={styles.servicesModalCloseBtn}
              onPress={() => setShowServicesModal(false)}
              accessibilityLabel="Fermer"
              accessibilityRole="button"
            >
              <Text style={styles.servicesModalCloseBtnText}>×</Text>
            </TouchableOpacity>

            <Text style={[styles.servicesModalTitle, isRTL && styles.rtlText]}>
              🕌 {t('services')}
            </Text>
            <Text style={[styles.servicesModalSubtitle, isRTL && styles.rtlText]}>
              {isRTL ? 'جميع الخدمات المتاحة في مسجدنا' : 'Tous les services disponibles dans notre mosquée'}
            </Text>

            <ScrollView style={styles.servicesModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.servicesModalGrid}>
                {[
                  { icon: '🅿️', labelKey: 'parking', descKey: 'parkingDesc' },
                  { icon: '♿', labelKey: 'accessHandicapes', descKey: 'accessHandicapesDesc' },
                  { icon: '💧', labelKey: 'salleAblution', descKey: 'salleAblutionDesc' },
                  { icon: '👩', labelKey: 'espaceFemmes', descKey: 'espaceFemmesDesc' },
                  { icon: '📚', labelKey: 'coursAdultes', descKey: 'coursAdultesDesc' },
                  { icon: '👶', labelKey: 'coursEnfants', descKey: 'coursEnfantsDesc' },
                ].map((service, index) => (
                  <View key={index} style={styles.servicesModalItem}>
                    <View style={styles.servicesModalItemIcon}>
                      <Text style={styles.servicesModalItemIconText}>{service.icon}</Text>
                    </View>
                    <View style={styles.servicesModalItemInfo}>
                      <Text style={[styles.servicesModalItemLabel, isRTL && styles.rtlText]}>
                        {t(service.labelKey as any)}
                      </Text>
                      <Text style={[styles.servicesModalItemDesc, isRTL && styles.rtlText]}>
                        {isRTL ? 'متوفر' : 'Disponible'}
                      </Text>
                    </View>
                    <Text style={styles.servicesModalItemCheck}>✓</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.servicesModalOkBtn}
              onPress={() => setShowServicesModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.servicesModalOkBtnText}>{isRTL ? 'إغلاق' : 'Fermer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    <BackgroundPattern>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent, '#D4AF37']}
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {/* Header - Image ou Salam */}
        {headerImageUrl ? (
          <Image
            source={{ uri: headerImageUrl }}
            style={styles.headerImage}
            resizeMode="cover"
            onLoad={() => logger.log('[HomeScreen] Header image loaded successfully')}
            onError={(e) => logger.error('[HomeScreen] Header image error:', e.nativeEvent.error)}
          />
        ) : (
          <LinearGradient
            colors={colors.headerGradient}
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

        {/* Titre avec icônes cloche + message */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>🕌 {t('mosqueName')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableOpacity
                onPress={async () => { await AsyncStorage.setItem('messages_last_read_at', new Date().toISOString()); setUnreadMsgCount(0); navigation.navigate('Messages'); }}
                style={styles.bellButton}
                accessibilityLabel="Messages"
                accessibilityRole="button"
              >
                <Text style={styles.bellIcon}>💬</Text>
                {unreadMsgCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openNotificationHistory}
                style={styles.bellButton}
                accessibilityLabel={t('notificationHistory')}
                accessibilityRole="button"
              >
                <Text style={styles.bellIcon}>🔔</Text>
                {unreadNotifCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('mosqueLocation')}</Text>
        </View>

        {/* Error Banner */}
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{loadError}</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Prochaine prière */}
          <View style={styles.nextPrayerCard}>
            {/* Heure de Paris */}
            <Text style={styles.parisTime}>{parisTime}</Text>
            <Text style={[styles.nextPrayerLabel, isRTL && styles.rtlText]}>{t('nextPrayer')}</Text>
            <Text style={[styles.nextPrayerName, isRTL && styles.rtlText]}>{nextPrayer.icon} {getPrayerName(nextPrayer.name)}</Text>
            <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
            <Animated.Text style={[styles.countdown, { opacity: countdownOpacity }]}>{countdown}</Animated.Text>
            {/* Dates sous le countdown */}
            <Text style={styles.dateGregorian}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })}
            </Text>
            <Text style={styles.dateHijri}>
              {islamicDate.day} {isRTL ? islamicDate.monthAr : islamicDate.month} {islamicDate.year}
            </Text>

            {/* Bouton J'ai prié - masqué après le clic jusqu'à la prochaine prière */}
            {boostSettings?.enabled && currentPrayer && !hasPrayedCurrentPrayer && (
              <TouchableOpacity
                style={[styles.prayedButton, { marginTop: 12 }]}
                onPress={handlePrayed}
                activeOpacity={0.7}
              >
                <Text style={styles.prayedButtonText}>
                  ✅ {isRTL ? `صليت ${currentPrayer.nameAr}` : `J'ai prié ${getPrayerName(currentPrayer.name)}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Rappel du jour */}
          <View style={styles.rappelContainer}>
            <Text style={[styles.rappelTitle, isRTL && styles.rtlText]}>📿 {t('dailyReminder')}</Text>
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

          {/* Bouton Nos Services */}
          <TouchableOpacity
            style={styles.servicesButton}
            onPress={() => setShowServicesModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.servicesButtonIcon}>🕌</Text>
            <View style={styles.servicesButtonContent}>
              <Text style={[styles.servicesButtonText, isRTL && styles.rtlText]}>{t('services')}</Text>
              <Text style={[styles.servicesButtonSubtext, isRTL && styles.rtlText]}>
                {isRTL ? 'اكتشف جميع خدماتنا' : 'Découvrir tous nos services'}
              </Text>
            </View>
            <Text style={styles.servicesButtonArrow}>→</Text>
          </TouchableOpacity>

          {/* Horaires */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>🕐 {t('todaySchedule')}</Text>
              <TouchableOpacity
                onPress={() => setShowCalendar(!showCalendar)}
                style={styles.calendarToggle}
                accessibilityLabel="Voir le calendrier hégirien"
                accessibilityRole="button"
                accessibilityHint="Affiche les dates islamiques importantes"
              >
                <Text style={styles.calendarToggleText}>📅</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.prayerCard}>
              {/* En-tête des colonnes */}
              <View style={[styles.prayerHeaderRow, isRTL && styles.prayerRowRTL]}>
                <Text style={[styles.prayerHeaderText, isRTL && styles.rtlText]}>{t('prayer')}</Text>
                <View style={styles.prayerTimesHeader}>
                  <Text style={styles.prayerHeaderLabel}>{t('adhan')}</Text>
                  {displaySettings.showIqama && (
                    <Text style={styles.prayerHeaderLabel}>{t('iqama')}</Text>
                  )}
                </View>
              </View>
              {(displayedPrayerTimes || []).map((prayer, index) => {
                // Pas d'iqama pour Shurûq
                const iqamaTime = (displaySettings.showIqama && prayer.name !== 'Shurûq')
                  ? getIqamaTime(prayer.name, prayer.time)
                  : null;
                return (
                  <View
                    key={prayer.name}
                    style={[
                      styles.prayerRow,
                      isRTL && styles.prayerRowRTL,
                      index === displayedPrayerTimes.length - 1 && styles.prayerRowLast,
                      prayer.name === nextPrayer.name && styles.prayerRowActive,
                    ]}
                  >
                    <View style={[styles.prayerName, isRTL && styles.prayerNameRTL]}>
                      <Text style={styles.prayerIcon}>{prayer.icon}</Text>
                      <Text style={[styles.prayerNameText, isRTL && styles.rtlText]}>{getPrayerName(prayer.name)}</Text>
                    </View>
                    <View style={styles.prayerTimesRow}>
                      <Text style={styles.prayerTimeAdhan}>{prayer.time}</Text>
                      {displaySettings.showIqama && (
                        <Text style={styles.prayerTimeIqama}>{prayer.name === 'Shurûq' ? '-' : (iqamaTime || '-')}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Horaire Jumu'a - Affiché si c'est vendredi ou jeudi */}
          {jumuaTimes?.jumua1 && (new Date().getDay() === 5 || new Date().getDay() === 4) && (
            <View style={styles.jumuaSection}>
              <View style={styles.jumuaCard}>
                <Text style={styles.jumuaIcon}>🕌</Text>
                <View style={styles.jumuaInfo}>
                  <Text style={[styles.jumuaTitle, isRTL && styles.rtlText]}>
                    {t('fridayPrayer')}
                  </Text>
                  <Text style={[styles.jumuaTime, isRTL && styles.rtlText]}>
                    {t('sermonStartsAt')} {jumuaTimes.jumua1}
                  </Text>
                  <Text style={[styles.jumuaMessage, isRTL && styles.rtlText]}>
                    📍 {t('arriveEarly')}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Calendrier Hégirien est maintenant dans une Modal (voir ci-dessous) */}

          {/* Salat Janaza - Masqué si aucune donnée Firebase */}
          {janazaList.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>⚰️ {t('janazaUpcoming')}</Text>
            {janazaList.map((janazaItem: any) => {
                // Normaliser les champs (Firebase vs Mock)
                const dateValue = janazaItem.prayerDate || janazaItem.date;
                const dateObj = dateValue instanceof Date ? dateValue :
                  (dateValue ? new Date(dateValue) : new Date());
                const nom = janazaItem.deceasedName || `${janazaItem.prenom || ''} ${janazaItem.nom || ''}`.trim();
                const lieu = janazaItem.location || janazaItem.lieu;
                const heure = janazaItem.prayerTime || janazaItem.heure;
                const phraseAr = janazaItem.deceasedNameAr || janazaItem.phraseAr || 'إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ';
                const phraseFr = janazaItem.message || janazaItem.phraseFr || 'Nous sommes à Allah et vers Lui nous retournons';

                const joursSemaineFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
                const joursSemaineAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                const moisFr = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                const moisAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                const joursSemaine = isRTL ? joursSemaineAr : joursSemaineFr;
                const mois = isRTL ? moisAr : moisFr;
                const dateFormatee = `${joursSemaine[dateObj.getDay()]} ${dateObj.getDate()} ${mois[dateObj.getMonth()]}`;
                // Construire l'info d'heure: soit l'heure exacte, soit "Après [prière]"
                // Firebase: salatApres avec format "apres_dhuhr", "apres_asr", etc.
                // Mock: apresSalat avec format "dhuhr", "asr", etc.
                let heureInfo = heure;
                const salatValue = janazaItem.salatApres || janazaItem.apresSalat;
                if (!heureInfo && salatValue) {
                  // Extraire le nom de la prière (ex: "apres_dhuhr" -> "dhuhr", ou juste "dhuhr")
                  const prayerKey = salatValue.replace('apres_', '');
                  heureInfo = `${t('afterPrayerPrefix')} ${getPrayerName(prayerKey)}`;
                }
                if (!heureInfo) {
                  heureInfo = t('timeToConfirm') || 'Heure à confirmer';
                }

                return (
                  <TouchableOpacity
                    key={janazaItem.id}
                    style={styles.janazaMockCard}
                    onPress={() => Alert.alert(
                      `⚰️ ${t('janazaPrayer')}`,
                      `👤 ${nom}\n\n📅 ${dateFormatee}\n⏰ ${heureInfo}\n📍 ${lieu}\n\n"${isRTL ? phraseAr : phraseFr}"`,
                      [{ text: 'OK' }]
                    )}
                    activeOpacity={0.7}
                  >
                    <View style={styles.janazaCardHeader}>
                      <Text style={styles.janazaCardTitle}>🕋 {t('janazaPrayer')}</Text>
                      <Text style={styles.tapIndicator}>ℹ️</Text>
                    </View>
                    <View style={styles.janazaMockInfo}>
                      <Text style={[styles.janazaMockName, isRTL && styles.rtlText]} numberOfLines={1}>
                        {nom || t('funeralPrayer')}
                      </Text>
                      <Text style={[styles.janazaMockDate, isRTL && styles.rtlText]} numberOfLines={1}>
                        📅 {dateFormatee} - {heureInfo}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
          )}

          {/* Section Ramadan */}
          {ramadanSettings?.enabled && ramadanDay && (
            <View style={styles.ramadanSection}>
              <LinearGradient
                colors={['rgba(139,92,246,0.2)', 'rgba(139,92,246,0.05)']}
                style={styles.ramadanGradient}
              >
                <View style={styles.ramadanHeader}>
                  <Text style={styles.ramadanMubarak}>
                    {language === 'ar' ? 'رمضان مبارك 🌙' : 'Ramadan Mubarak 🌙'}
                  </Text>
                  <Text style={styles.ramadanDay}>
                    {language === 'ar' ? `اليوم ${ramadanDay}/30` : `Jour ${ramadanDay}/30`}
                  </Text>
                </View>

                <View style={styles.ramadanTimesRow}>
                  {/* Suhoor */}
                  <View style={styles.ramadanTimeCard}>
                    <Text style={styles.ramadanTimeLabel}>
                      {language === 'ar' ? 'السحور' : 'Suhoor'}
                    </Text>
                    <Text style={styles.ramadanTimeIcon}>🌅</Text>
                    <Text style={styles.ramadanTimeValue}>
                      {prayerTimes.find(p => p.name === 'Fajr')?.time || '--:--'}
                    </Text>
                    <Text style={styles.ramadanTimeNote}>
                      {language === 'ar' ? 'قبل الفجر' : 'Fin Suhoor'}
                    </Text>
                  </View>

                  {/* Iftar */}
                  <View style={styles.ramadanTimeCard}>
                    <Text style={styles.ramadanTimeLabel}>
                      {language === 'ar' ? 'الإفطار' : 'Iftar'}
                    </Text>
                    <Text style={styles.ramadanTimeIcon}>🌙</Text>
                    <Text style={styles.ramadanTimeValue}>
                      {prayerTimes.find(p => p.name === 'Maghrib')?.time || '--:--'}
                    </Text>
                    <Text style={styles.ramadanTimeNote}>
                      {language === 'ar' ? 'وقت المغرب' : 'Au Maghrib'}
                    </Text>
                  </View>

                  {/* Tarawih */}
                  {ramadanSettings.tarawihTime && (
                    <View style={styles.ramadanTimeCard}>
                      <Text style={styles.ramadanTimeLabel}>
                        {language === 'ar' ? 'التراويح' : 'Tarawih'}
                      </Text>
                      <Text style={styles.ramadanTimeIcon}>🕌</Text>
                      <Text style={styles.ramadanTimeValue}>
                        {ramadanSettings.tarawihTime}
                      </Text>
                      <Text style={styles.ramadanTimeNote}>
                        {language === 'ar' ? 'بعد العشاء' : 'Après Isha'}
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Annonces - Masqué si aucune donnée */}
          {(announcements || []).length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>📢 {t('announcements')}</Text>
            {announcements.map((announcement) => (
              <TouchableOpacity
                key={announcement.id}
                style={styles.card}
                onPress={() => Alert.alert(
                  `📢 ${announcement.title}`,
                  `${announcement.content}\n\n📅 ${t('publishedOn')} ${announcement.publishedAt?.toLocaleDateString(isRTL ? 'ar-SA' : 'fr-FR')}`,
                  [{ text: 'OK' }]
                )}
                activeOpacity={0.7}
              >
                <View style={styles.announcementHeader}>
                  <Text style={[styles.announcementTitle, isRTL && styles.rtlText, { flex: 1 }]} numberOfLines={1}>{announcement.title}</Text>
                  <Text style={styles.tapIndicator}>ℹ️</Text>
                </View>
                <Text style={[styles.announcementContent, isRTL && styles.rtlText]} numberOfLines={2}>{announcement.content}</Text>
              </TouchableOpacity>
            ))}
          </View>
          )}


          {/* Événements - Masqué si aucune donnée */}
          {(events || []).length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>📅 {t('upcomingEvents')}</Text>
            {events.map((event) => {
              const { day, month } = formatDate(event.date);
              return (
                <TouchableOpacity
                  key={event.id}
                  style={styles.card}
                  onPress={() => Alert.alert(
                    event.title,
                    `📅 ${day} ${month}\n⏰ ${event.time}\n📍 ${event.location}${event.description ? `\n\n${event.description}` : ''}`,
                    [{ text: 'OK' }]
                  )}
                  activeOpacity={0.7}
                >
                  <View style={[styles.eventItem, isRTL && styles.eventItemRTL]}>
                    <View style={styles.eventDateBox}>
                      <Text style={styles.eventDay}>{day}</Text>
                      <Text style={styles.eventMonth}>{month}</Text>
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={[styles.eventTitle, isRTL && styles.rtlText]} numberOfLines={1}>{event.title}</Text>
                      <Text style={[styles.eventSubtitle, isRTL && styles.rtlText]} numberOfLines={1}>
                        {event.time} • {event.location}
                      </Text>
                    </View>
                    <Text style={styles.tapIndicator}>ℹ️</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          )}
        </View>
      </ScrollView>
    </BackgroundPattern>
    </>
  );
};

const styles = StyleSheet.create({
  // Popup styles - TRIPLER hauteur, +35% largeur
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    backgroundColor: colors.accentDark,
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 20,
    width: '85%',
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  popupTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  popupContent: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  popupButton: {
    backgroundColor: '#F4D03F',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 30,
    marginTop: 20,
    alignItems: 'center',
  },
  popupButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#5D4E37',
  },
  // Calendar Modal styles
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModalContainer: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  calendarCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  calendarCloseBtnText: {
    fontSize: 24,
    color: colors.textMuted,
    lineHeight: 26,
  },
  calendarModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 20,
  },
  calendarEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  calendarOkBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    marginTop: 20,
    alignItems: 'center',
    alignSelf: 'center',
  },
  calendarOkBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  // Notification In-App Modal styles
  notifModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  notifCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifCloseBtnText: {
    fontSize: 22,
    color: '#666',
    lineHeight: 24,
  },
  notifIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  notifTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: 12,
  },
  notifBody: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  notifOkBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 50,
    borderRadius: 25,
  },
  notifOkBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerImage: {
    width: '100%',
    height: wp(50), // Responsive: 50% of screen width
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
  },
  salamHeader: {
    width: '100%',
    paddingTop: HEADER_PADDING_TOP + 10,
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
    color: colors.textSecondary,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(201,162,39,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 22,
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
    flex: 1,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  // Jumu'a Section
  jumuaSection: {
    marginBottom: spacing.xxl,
  },
  jumuaCard: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  jumuaIcon: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  jumuaInfo: {
    flex: 1,
  },
  jumuaTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 4,
  },
  jumuaTime: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  jumuaMessage: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
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
    color: colors.text,
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
  parisTime: {
    fontSize: 26, // +30% par rapport à 20
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
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
  prayedButton: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(39, 174, 96, 0.4)',
  },
  prayedButtonText: {
    color: '#27ae60',
    fontSize: fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
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
  // Bouton Nos Services
  servicesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  servicesButtonIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  servicesButtonContent: {
    flex: 1,
  },
  servicesButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.accent,
  },
  servicesButtonSubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  servicesButtonArrow: {
    fontSize: 20,
    color: colors.accent,
    marginLeft: spacing.sm,
  },
  // Modal Services
  servicesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  servicesModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  servicesModalCloseBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  servicesModalCloseBtnText: {
    fontSize: 20,
    color: colors.text,
    lineHeight: 22,
  },
  servicesModalTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  servicesModalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  servicesModalScroll: {
    maxHeight: 400,
  },
  servicesModalGrid: {
    gap: spacing.md,
  },
  servicesModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  servicesModalItemIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  servicesModalItemIconText: {
    fontSize: 24,
  },
  servicesModalItemInfo: {
    flex: 1,
  },
  servicesModalItemLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  servicesModalItemDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  servicesModalItemCheck: {
    fontSize: 18,
    color: '#22c55e',
    marginLeft: spacing.sm,
  },
  servicesModalOkBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  servicesModalOkBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#1a1a2e',
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
    minWidth: 50,
    textAlign: 'center',
  },
  prayerTimesRow: {
    flexDirection: 'row',
    gap: wp(6),
  },
  prayerTimeAdhan: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
    minWidth: 50,
    textAlign: 'center',
  },
  prayerTimeIqama: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
    minWidth: 50,
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
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tapIndicator: {
    fontSize: 16,
    marginLeft: spacing.sm,
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
    color: colors.text,
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
    color: colors.text,
    marginBottom: 4,
  },
  janazaBold: {
    fontWeight: 'bold',
  },
  janazaMessage: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  janazaFooter: {
    flexDirection: 'row',
  },
  janazaLocation: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
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
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  janazaMockArabic: {
    fontSize: 20,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  janazaCardTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
  janazaMockInfo: {},
  janazaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  janazaMockName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  janazaMockDate: {
    fontSize: fontSize.md,
    color: '#555',
    marginBottom: spacing.xs,
  },
  janazaMockLieu: {
    fontSize: fontSize.sm,
    color: '#666',
    marginBottom: spacing.sm,
  },
  janazaMockPhraseFr: {
    fontSize: fontSize.sm,
    color: '#777',
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
  // Empty state styles
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Error banner
  errorBanner: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  errorBannerText: {
    fontSize: fontSize.sm,
    color: '#e74c3c',
    textAlign: 'center',
  },
  // Notification History Modal
  historyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  historyModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    minHeight: 300,
  },
  historyCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  historyCloseBtnText: {
    fontSize: 24,
    color: colors.textMuted,
    lineHeight: 26,
  },
  historyModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 4,
    marginTop: 8,
  },
  historySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  historyScroll: {
    flex: 1,
    marginBottom: 16,
  },
  historyEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  historyEmptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  historyEmptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  historyItemLast: {
    borderBottomWidth: 0,
  },
  historyItemUnread: {
    backgroundColor: 'rgba(201,162,39,0.1)',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
  },
  historyItemIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  historyItemBody: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  historyItemTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  historyExpandIcon: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 8,
  },
  markAllReadBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  markAllReadBtnText: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontWeight: '600',
  },
  historyOkBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignItems: 'center',
    alignSelf: 'center',
  },
  historyOkBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  // Ramadan styles
  ramadanSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  ramadanGradient: {
    padding: spacing.lg,
  },
  ramadanHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ramadanMubarak: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8b5cf6',
    marginBottom: 4,
  },
  ramadanDay: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  ramadanTimesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ramadanTimeCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: 90,
  },
  ramadanTimeLabel: {
    fontSize: fontSize.sm,
    color: '#8b5cf6',
    fontWeight: '600',
    marginBottom: 4,
  },
  ramadanTimeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  ramadanTimeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  ramadanTimeNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});

export default HomeScreen;
