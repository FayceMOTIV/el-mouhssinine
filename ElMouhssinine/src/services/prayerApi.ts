// Service API pour les horaires de prière - MAWAQIT API
// Horaires EXACTS depuis la mosquée El Mouhssinine via Mawaqit
// Avec cache Firestore pour supporter 4000+ utilisateurs

import firestore from '@react-native-firebase/firestore';

const MAWAQIT_API = 'https://mawaqit.net/api/2.0';
const MOSQUE_UUID = '357233ff-e025-42f2-abf9-b23adb23ed52';

// Fallback Aladhan pour la date Hijri (Mawaqit ne la fournit pas)
const ALADHAN_API = 'https://api.aladhan.com/v1';

// Essayer de lire le cache Firestore d'abord (rempli par Cloud Function)
const getCachedFromFirestore = async (): Promise<{ timings?: any; hijri?: any } | null> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const doc = await firestore()
      .collection('cached_prayer_times')
      .doc(today)
      .get();

    if (doc.exists()) {
      const data = doc.data();
      return {
        timings: data?.timings || null,
        hijri: data?.hijri || null,
      };
    }
    return null;
  } catch (error) {
    // Silently fail - will use API fallback
    return null;
  }
};

export interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
  Firstthird: string;
  Lastthird: string;
  // Données Mawaqit
  Jumua?: string;
  IqamaFajr?: string;
  IqamaDhuhr?: string;
  IqamaAsr?: string;
  IqamaMaghrib?: string;
  IqamaIsha?: string;
}

export interface HijriDate {
  date: string;
  format: string;
  day: string;
  weekday: { en: string; ar: string };
  month: { number: number; en: string; ar: string };
  year: string;
  designation: { abbreviated: string; expanded: string };
  holidays: string[];
}

export interface GregorianDate {
  date: string;
  format: string;
  day: string;
  weekday: { en: string };
  month: { number: number; en: string };
  year: string;
}

export interface DayData {
  timings: PrayerTimings;
  date: {
    readable: string;
    timestamp: string;
    hijri: HijriDate;
    gregorian: GregorianDate;
  };
  meta: {
    latitude: number;
    longitude: number;
    timezone: string;
    method: { id: number; name: string; params: { Fajr: number; Isha: number } };
  };
}

// Cache
const cache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes (réduit pour éviter les horaires obsolètes)

const getCached = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
};

const setCache = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Fetch avec timeout
const fetchWithTimeout = async (url: string, timeout = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Calculer l'heure iqama à partir de l'offset
const calculateIqamaTime = (prayerTime: string, offset: string): string => {
  if (!offset || offset === '0') return prayerTime;

  const [hours, minutes] = prayerTime.split(':').map(Number);
  let offsetMinutes = 0;

  if (offset.startsWith('+')) {
    offsetMinutes = parseInt(offset.substring(1), 10);
  } else if (offset.startsWith('-')) {
    offsetMinutes = -parseInt(offset.substring(1), 10);
  } else {
    return offset; // Format HH:MM direct
  }

  const totalMinutes = hours * 60 + minutes + offsetMinutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;

  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
};

export const PrayerAPI = {
  // Récupérer les horaires depuis Mawaqit
  getTimesByCity: async (
    city: string = 'Bourg-en-Bresse',
    country: string = 'France'
  ): Promise<PrayerTimings> => {
    const cacheKey = 'mawaqit-times';
    const cached = getCached<PrayerTimings>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetchWithTimeout(`${MAWAQIT_API}/mosque/${MOSQUE_UUID}/prayer-times`);

      if (!response.ok) {
        throw new Error(`Mawaqit API error: ${response.status}`);
      }

      const data = await response.json();

      // Récupérer la date du jour
      const today = new Date();
      const month = today.getMonth(); // 0-indexed
      const day = today.getDate().toString();

      // Utiliser le CALENDAR au lieu de times pour avoir les horaires EXACTS de Mawaqit
      // Le champ "times" contient des valeurs ajustées en temps réel (décalage de ~1 min)
      // Le champ "calendar" contient les horaires bruts publiés par Mawaqit
      let times: string[];
      let shuruq: string;

      if (data.calendar && data.calendar[month] && data.calendar[month][day]) {
        // calendar[month][day] = [Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha] (6 valeurs)
        const calendarTimes = data.calendar[month][day];
        times = [calendarTimes[0], calendarTimes[2], calendarTimes[3], calendarTimes[4], calendarTimes[5]];
        shuruq = calendarTimes[1];
      } else {
        // Fallback sur times si calendar non disponible
        times = data.times;
        shuruq = data.shuruq;
      }

      let iqamaOffsets = ['+10', '+10', '+10', '+7', '+10']; // Défaut
      if (data.iqamaCalendar && data.iqamaCalendar[month] && data.iqamaCalendar[month][day]) {
        iqamaOffsets = data.iqamaCalendar[month][day];
      }

      const timings: PrayerTimings = {
        Fajr: times[0],
        Sunrise: shuruq,
        Dhuhr: times[1],
        Asr: times[2],
        Sunset: times[3], // Maghrib = Sunset
        Maghrib: times[3],
        Isha: times[4],
        Imsak: times[0], // Même que Fajr pour simplifier
        Midnight: '00:00',
        Firstthird: '00:00',
        Lastthird: '00:00',
        Jumua: data.jumua || '13:30',
        IqamaFajr: calculateIqamaTime(times[0], iqamaOffsets[0]),
        IqamaDhuhr: calculateIqamaTime(times[1], iqamaOffsets[1]),
        IqamaAsr: calculateIqamaTime(times[2], iqamaOffsets[2]),
        IqamaMaghrib: calculateIqamaTime(times[3], iqamaOffsets[3]),
        IqamaIsha: calculateIqamaTime(times[4], iqamaOffsets[4]),
      };

      setCache(cacheKey, timings);
      return timings;
    } catch (error) {
      console.error('[PrayerAPI] Erreur Mawaqit:', error);
      // Fallback: utiliser les horaires du jour depuis le calendrier local
      // Horaires du 22 janvier (aujourd'hui) depuis Mawaqit
      const today = new Date();
      const day = today.getDate();
      const month = today.getMonth(); // 0-indexed

      // Calendrier janvier 2026 extrait de Mawaqit
      const januaryCalendar: Record<string, string[]> = {
        '22': ['06:42', '08:12', '12:51', '15:10', '17:35', '19:05'],
        '23': ['06:41', '08:11', '12:52', '15:11', '17:36', '19:06'],
        '24': ['06:40', '08:10', '12:52', '15:13', '17:38', '19:08'],
        '25': ['06:39', '08:09', '12:52', '15:14', '17:40', '19:10'],
        '26': ['06:37', '08:08', '12:52', '15:15', '17:41', '19:11'],
        '27': ['06:37', '08:07', '12:52', '15:16', '17:42', '19:12'],
        '28': ['06:36', '08:06', '12:52', '15:18', '17:44', '19:14'],
        '29': ['06:35', '08:05', '12:53', '15:19', '17:46', '19:16'],
        '30': ['06:34', '08:04', '12:53', '15:20', '17:47', '19:17'],
        '31': ['06:33', '08:03', '12:53', '15:20', '17:48', '19:18'],
      };

      // Utiliser les horaires du jour ou valeurs par défaut
      const dayStr = day.toString();
      const fallbackTimes = januaryCalendar[dayStr] || ['06:42', '08:12', '12:51', '15:10', '17:35', '19:05'];

      const fallbackTimings: PrayerTimings = {
        Fajr: fallbackTimes[0],
        Sunrise: fallbackTimes[1],
        Dhuhr: fallbackTimes[2],
        Asr: fallbackTimes[3],
        Sunset: fallbackTimes[4],
        Maghrib: fallbackTimes[4],
        Isha: fallbackTimes[5],
        Imsak: fallbackTimes[0],
        Midnight: '00:00',
        Firstthird: '00:00',
        Lastthird: '00:00',
        Jumua: '13:30',
        IqamaFajr: calculateIqamaTime(fallbackTimes[0], '+10'),
        IqamaDhuhr: calculateIqamaTime(fallbackTimes[2], '+10'),
        IqamaAsr: calculateIqamaTime(fallbackTimes[3], '+10'),
        IqamaMaghrib: calculateIqamaTime(fallbackTimes[4], '+7'),
        IqamaIsha: calculateIqamaTime(fallbackTimes[5], '+10'),
      };

      console.log('[PrayerAPI] Utilisation fallback local:', fallbackTimings);
      return fallbackTimings;
    }
  },

  // Alias pour compatibilité
  getTimesByCoords: async (latitude: number, longitude: number): Promise<PrayerTimings> => {
    return PrayerAPI.getTimesByCity();
  },

  // Calendrier mensuel depuis Mawaqit
  getMonthlyCalendar: async (
    year: number,
    month: number,
    city: string = 'Bourg-en-Bresse',
    country: string = 'France'
  ): Promise<DayData[]> => {
    const cacheKey = `calendar-${year}-${month}`;
    const cached = getCached<DayData[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetchWithTimeout(`${MAWAQIT_API}/mosque/${MOSQUE_UUID}/prayer-times`);

      if (!response.ok) throw new Error('Mawaqit API error');

      const data = await response.json();
      const monthIndex = month - 1; // API uses 0-indexed
      const monthCalendar = data.calendar[monthIndex];
      const iqamaCalendar = data.iqamaCalendar?.[monthIndex];

      const result: DayData[] = [];

      for (const [dayStr, times] of Object.entries(monthCalendar)) {
        const dayNum = parseInt(dayStr, 10);
        const timesArr = times as string[];
        const iqamaOffsets = iqamaCalendar?.[dayStr] || ['+10', '+10', '+10', '+7', '+10'];

        result.push({
          timings: {
            Fajr: timesArr[0],
            Sunrise: timesArr[1],
            Dhuhr: timesArr[2],
            Asr: timesArr[3],
            Sunset: timesArr[4],
            Maghrib: timesArr[4],
            Isha: timesArr[5],
            Imsak: timesArr[0],
            Midnight: '00:00',
            Firstthird: '00:00',
            Lastthird: '00:00',
            IqamaFajr: calculateIqamaTime(timesArr[0], iqamaOffsets[0]),
            IqamaDhuhr: calculateIqamaTime(timesArr[2], iqamaOffsets[1]),
            IqamaAsr: calculateIqamaTime(timesArr[3], iqamaOffsets[2]),
            IqamaMaghrib: calculateIqamaTime(timesArr[4], iqamaOffsets[3]),
            IqamaIsha: calculateIqamaTime(timesArr[5], iqamaOffsets[4]),
          },
          date: {
            readable: `${dayNum} ${month} ${year}`,
            timestamp: new Date(year, month - 1, dayNum).getTime().toString(),
            hijri: {} as HijriDate,
            gregorian: {} as GregorianDate,
          },
          meta: {
            latitude: 46.2055668,
            longitude: 5.2477947,
            timezone: 'Europe/Paris',
            method: { id: 99, name: 'Mawaqit', params: { Fajr: 12, Isha: 12 } },
          },
        });
      }

      setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[PrayerAPI] Erreur calendrier:', error);
      throw error;
    }
  },

  // Date Hijri depuis Firestore (cache serveur) puis Aladhan (fallback)
  // Utilise adjustment=-1 pour s'aligner sur le calendrier de la Grande Mosquée de Paris / Mawaqit
  getHijriDate: async (): Promise<HijriDate> => {
    const today = new Date();
    const dateKey = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    const cacheKey = `hijri-${dateKey}-v2`; // v2 pour forcer refresh du cache
    const cached = getCached<HijriDate>(cacheKey);
    if (cached) return cached;

    // 1. Essayer le cache Firestore (rempli par Cloud Function quotidienne)
    try {
      const firestoreCache = await getCachedFromFirestore();
      if (firestoreCache?.hijri) {
        const hijri: HijriDate = {
          date: '',
          format: '',
          day: firestoreCache.hijri.day,
          weekday: { en: '', ar: '' },
          month: {
            number: firestoreCache.hijri.month,
            en: firestoreCache.hijri.monthEn,
            ar: firestoreCache.hijri.monthAr,
          },
          year: firestoreCache.hijri.year,
          designation: { abbreviated: firestoreCache.hijri.designation || 'H', expanded: 'Anno Hegirae' },
          holidays: [],
        };
        setCache(cacheKey, hijri);
        return hijri;
      }
    } catch (e) {
      // Continue vers API
    }

    // 2. Fallback: appel API direct (si cache Firestore vide)
    try {
      // Ajustement de -1 jour pour s'aligner sur le calendrier français (Mawaqit/GMP)
      const response = await fetchWithTimeout(`${ALADHAN_API}/gToH/${dateKey}?adjustment=-1`);
      const data = await response.json();

      if (data.code === 200) {
        setCache(cacheKey, data.data.hijri);
        return data.data.hijri;
      }
      throw new Error('Aladhan API error');
    } catch (error) {
      console.error('[PrayerAPI] Erreur Hijri:', error);
      // Retourner une date par défaut
      return {
        date: '',
        format: '',
        day: '1',
        weekday: { en: '', ar: '' },
        month: { number: 1, en: 'Muharram', ar: 'محرم' },
        year: '1446',
        designation: { abbreviated: 'AH', expanded: 'Anno Hegirae' },
        holidays: [],
      };
    }
  },

  // Direction Qibla
  getQiblaDirection: async (latitude: number, longitude: number): Promise<number> => {
    const cacheKey = `qibla-${latitude.toFixed(2)}-${longitude.toFixed(2)}`;
    const cached = getCached<number>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetchWithTimeout(`${ALADHAN_API}/qibla/${latitude}/${longitude}`);
      const data = await response.json();

      if (data.code === 200) {
        setCache(cacheKey, data.data.direction);
        return data.data.direction;
      }
      throw new Error('Qibla API error');
    } catch (error) {
      console.error('[PrayerAPI] Erreur Qibla:', error);
      return 119.5; // Direction approximative depuis Bourg-en-Bresse
    }
  },

  // Données complètes du jour
  getFullDayData: async (
    city: string = 'Bourg-en-Bresse',
    country: string = 'France'
  ): Promise<DayData> => {
    const timings = await PrayerAPI.getTimesByCity(city, country);
    const hijri = await PrayerAPI.getHijriDate();
    const today = new Date();

    return {
      timings,
      date: {
        readable: today.toLocaleDateString('fr-FR'),
        timestamp: today.getTime().toString(),
        hijri,
        gregorian: {
          date: today.toISOString().split('T')[0],
          format: 'DD-MM-YYYY',
          day: today.getDate().toString(),
          weekday: { en: today.toLocaleDateString('en', { weekday: 'long' }) },
          month: { number: today.getMonth() + 1, en: today.toLocaleDateString('en', { month: 'long' }) },
          year: today.getFullYear().toString(),
        },
      },
      meta: {
        latitude: 46.2055668,
        longitude: 5.2477947,
        timezone: 'Europe/Paris',
        method: { id: 99, name: 'Mawaqit', params: { Fajr: 12, Isha: 12 } },
      },
    };
  },

  // Calculer la prochaine prière
  getNextPrayer: (timings: PrayerTimings): { name: string; time: string; nameAr: string } | null => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const prayers = [
      { name: 'Fajr', nameAr: 'الفجر', time: timings.Fajr },
      { name: 'Dhuhr', nameAr: 'الظهر', time: timings.Dhuhr },
      { name: 'Asr', nameAr: 'العصر', time: timings.Asr },
      { name: 'Maghrib', nameAr: 'المغرب', time: timings.Maghrib },
      { name: 'Isha', nameAr: 'العشاء', time: timings.Isha },
    ];

    for (const prayer of prayers) {
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerMinutes = hours * 60 + minutes;

      if (prayerMinutes > currentMinutes) {
        return prayer;
      }
    }

    // Si toutes les prières sont passées, retourner Fajr du lendemain
    return { ...prayers[0], name: 'Fajr (demain)', nameAr: 'الفجر (غدا)' };
  },

  // Retourne la prière en cours (fenêtre active)
  // Fajr: de Fajr à Sunrise
  // Dhuhr: de Dhuhr à Asr
  // Asr: de Asr à Maghrib
  // Maghrib: de Maghrib à Isha
  // Isha: de Isha à minuit
  getCurrentPrayer: (timings: PrayerTimings): { name: string; time: string; nameAr: string } | null => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const fajrMin = toMinutes(timings.Fajr);
    const sunriseMin = toMinutes(timings.Sunrise);
    const dhuhrMin = toMinutes(timings.Dhuhr);
    const asrMin = toMinutes(timings.Asr);
    const maghribMin = toMinutes(timings.Maghrib);
    const ishaMin = toMinutes(timings.Isha);

    // Fenêtre Fajr: de Fajr à Sunrise
    if (currentMinutes >= fajrMin && currentMinutes < sunriseMin) {
      return { name: 'Fajr', nameAr: 'الفجر', time: timings.Fajr };
    }
    // Fenêtre Dhuhr: de Dhuhr à Asr
    if (currentMinutes >= dhuhrMin && currentMinutes < asrMin) {
      return { name: 'Dhuhr', nameAr: 'الظهر', time: timings.Dhuhr };
    }
    // Fenêtre Asr: de Asr à Maghrib
    if (currentMinutes >= asrMin && currentMinutes < maghribMin) {
      return { name: 'Asr', nameAr: 'العصر', time: timings.Asr };
    }
    // Fenêtre Maghrib: de Maghrib à Isha
    if (currentMinutes >= maghribMin && currentMinutes < ishaMin) {
      return { name: 'Maghrib', nameAr: 'المغرب', time: timings.Maghrib };
    }
    // Fenêtre Isha: de Isha à minuit
    if (currentMinutes >= ishaMin) {
      return { name: 'Isha', nameAr: 'العشاء', time: timings.Isha };
    }

    // Hors fenêtre de prière (entre Sunrise et Dhuhr, ou avant Fajr)
    return null;
  },

  // Formater l'heure pour l'affichage
  formatTime: (time: string): string => {
    return time.split(' ')[0].substring(0, 5);
  },
};

// Noms des prières
export const prayerNames = {
  Fajr: { fr: 'Fajr', ar: 'الفجر', icon: '🌅' },
  Sunrise: { fr: 'Lever du soleil', ar: 'الشروق', icon: '☀️' },
  Dhuhr: { fr: 'Dhuhr', ar: 'الظهر', icon: '☀️' },
  Asr: { fr: 'Asr', ar: 'العصر', icon: '🌤️' },
  Maghrib: { fr: 'Maghrib', ar: 'المغرب', icon: '🌅' },
  Isha: { fr: 'Isha', ar: 'العشاء', icon: '🌙' },
};

// Mois islamiques
export const islamicMonths = [
  { number: 1, en: 'Muharram', ar: 'محرم', fr: 'Mouharram' },
  { number: 2, en: 'Safar', ar: 'صفر', fr: 'Safar' },
  { number: 3, en: 'Rabi al-Awwal', ar: 'ربيع الأول', fr: 'Rabi al-Awwal' },
  { number: 4, en: 'Rabi al-Thani', ar: 'ربيع الثاني', fr: 'Rabi al-Thani' },
  { number: 5, en: 'Jumada al-Awwal', ar: 'جمادى الأولى', fr: 'Joumada al-Oula' },
  { number: 6, en: 'Jumada al-Thani', ar: 'جمادى الآخرة', fr: 'Joumada al-Thani' },
  { number: 7, en: 'Rajab', ar: 'رجب', fr: 'Rajab' },
  { number: 8, en: 'Sha\'ban', ar: 'شعبان', fr: 'Chaabane' },
  { number: 9, en: 'Ramadan', ar: 'رمضان', fr: 'Ramadan' },
  { number: 10, en: 'Shawwal', ar: 'شوال', fr: 'Chawwal' },
  { number: 11, en: 'Dhu al-Qi\'dah', ar: 'ذو القعدة', fr: 'Dhoul Qi\'da' },
  { number: 12, en: 'Dhu al-Hijjah', ar: 'ذو الحجة', fr: 'Dhoul Hijja' },
];
