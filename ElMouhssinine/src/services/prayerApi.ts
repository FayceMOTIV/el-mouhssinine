// Service API pour les horaires de priere - Aladhan API
// Ajustements pour correspondre aux horaires Mawaqit de la mosquée El Mouhssinine

const BASE_URL = 'https://api.aladhan.com/v1';

// Configuration : 15 degres pour Fajr et Isha (methode personnalisee - plus proche de Mawaqit)
const FAJR_ANGLE = 15;
const ISHA_ANGLE = 15;

// Ajustements en minutes pour chaque prière (tune parameter)
// Ordre: Imsak, Fajr, Sunrise, Dhuhr, Asr, Maghrib, Sunset, Isha, Midnight
// Ces valeurs ajustent les horaires pour correspondre à Mawaqit El Mouhssinine
const TUNE_ADJUSTMENTS = '0,-5,0,3,2,6,0,5,0';

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
}

export interface HijriDate {
  date: string;
  format: string;
  day: string;
  weekday: {
    en: string;
    ar: string;
  };
  month: {
    number: number;
    en: string;
    ar: string;
  };
  year: string;
  designation: {
    abbreviated: string;
    expanded: string;
  };
  holidays: string[];
}

export interface GregorianDate {
  date: string;
  format: string;
  day: string;
  weekday: {
    en: string;
  };
  month: {
    number: number;
    en: string;
  };
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
    method: {
      id: number;
      name: string;
      params: {
        Fajr: number;
        Isha: number;
      };
    };
  };
}

// Cache pour les donnees
const cache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

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

export const PrayerAPI = {
  // Horaires par ville avec degres personnalises (12 degres)
  getTimesByCity: async (
    city: string = 'Bourg-en-Bresse',
    country: string = 'France'
  ): Promise<PrayerTimings> => {
    const cacheKey = `prayer-city-${city}-${country}`;
    const cached = getCached<PrayerTimings>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${BASE_URL}/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=99&methodSettings=${FAJR_ANGLE},null,${ISHA_ANGLE}&tune=${TUNE_ADJUSTMENTS}`
      );
      const data = await response.json();

      if (data.code === 200) {
        setCache(cacheKey, data.data.timings);
        return data.data.timings;
      }
      throw new Error(data.status || 'Erreur API');
    } catch (error) {
      console.error('Erreur getTimesByCity:', error);
      throw error;
    }
  },

  // Horaires par coordonnees GPS avec degres personnalises
  getTimesByCoords: async (
    latitude: number,
    longitude: number
  ): Promise<PrayerTimings> => {
    const cacheKey = `prayer-coords-${latitude.toFixed(2)}-${longitude.toFixed(2)}`;
    const cached = getCached<PrayerTimings>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${BASE_URL}/timings?latitude=${latitude}&longitude=${longitude}&method=99&methodSettings=${FAJR_ANGLE},null,${ISHA_ANGLE}&tune=${TUNE_ADJUSTMENTS}`
      );
      const data = await response.json();

      if (data.code === 200) {
        setCache(cacheKey, data.data.timings);
        return data.data.timings;
      }
      throw new Error(data.status || 'Erreur API');
    } catch (error) {
      console.error('Erreur getTimesByCoords:', error);
      throw error;
    }
  },

  // Calendrier du mois complet
  getMonthlyCalendar: async (
    year: number,
    month: number,
    city: string = 'Bourg-en-Bresse',
    country: string = 'France'
  ): Promise<DayData[]> => {
    const cacheKey = `calendar-${year}-${month}-${city}`;
    const cached = getCached<DayData[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${BASE_URL}/calendarByCity/${year}/${month}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=99&methodSettings=${FAJR_ANGLE},null,${ISHA_ANGLE}&tune=${TUNE_ADJUSTMENTS}`
      );
      const data = await response.json();

      if (data.code === 200) {
        setCache(cacheKey, data.data);
        return data.data;
      }
      throw new Error(data.status || 'Erreur API');
    } catch (error) {
      console.error('Erreur getMonthlyCalendar:', error);
      throw error;
    }
  },

  // Date hijri actuelle
  getHijriDate: async (): Promise<HijriDate> => {
    const today = new Date();
    const dateKey = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    const cacheKey = `hijri-${dateKey}`;
    const cached = getCached<HijriDate>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${BASE_URL}/gpiToH/${dateKey}`
      );
      const data = await response.json();

      if (data.code === 200) {
        setCache(cacheKey, data.data.hijri);
        return data.data.hijri;
      }
      throw new Error(data.status || 'Erreur API');
    } catch (error) {
      console.error('Erreur getHijriDate:', error);
      throw error;
    }
  },

  // Direction Qibla par coordonnees
  getQiblaDirection: async (
    latitude: number,
    longitude: number
  ): Promise<number> => {
    const cacheKey = `qibla-${latitude.toFixed(2)}-${longitude.toFixed(2)}`;
    const cached = getCached<number>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${BASE_URL}/qibla/${latitude}/${longitude}`
      );
      const data = await response.json();

      if (data.code === 200) {
        setCache(cacheKey, data.data.direction);
        return data.data.direction;
      }
      throw new Error(data.status || 'Erreur API');
    } catch (error) {
      console.error('Erreur getQiblaDirection:', error);
      throw error;
    }
  },

  // Obtenir les horaires complets du jour (avec metadonnees)
  getFullDayData: async (
    city: string = 'Bourg-en-Bresse',
    country: string = 'France'
  ): Promise<DayData> => {
    const cacheKey = `fullday-${city}-${country}`;
    const cached = getCached<DayData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${BASE_URL}/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=99&methodSettings=${FAJR_ANGLE},null,${ISHA_ANGLE}&tune=${TUNE_ADJUSTMENTS}`
      );
      const data = await response.json();

      if (data.code === 200) {
        setCache(cacheKey, data.data);
        return data.data;
      }
      throw new Error(data.status || 'Erreur API');
    } catch (error) {
      console.error('Erreur getFullDayData:', error);
      throw error;
    }
  },

  // Calculer la prochaine priere
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

    // Si toutes les prieres sont passees, retourner Fajr du lendemain
    return { ...prayers[0], name: 'Fajr (demain)', nameAr: 'الفجر (غدا)' };
  },

  // Formater l'heure pour l'affichage
  formatTime: (time: string): string => {
    // Enlever les secondes si presentes et les espaces
    return time.split(' ')[0].substring(0, 5);
  },
};

// Noms des prieres en francais et arabe
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
