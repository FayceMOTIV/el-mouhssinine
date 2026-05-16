// Service API pour les horaires de prière - MAWAQIT API
// Horaires EXACTS depuis la mosquée El Mohsinine via Mawaqit
// Avec cache Firestore pour supporter 4000+ utilisateurs

import firestore from '@react-native-firebase/firestore';
import { logger } from '../utils';

// Interface pour les délais Iqama depuis Firebase
interface FirebaseIqamaDelays {
  fajr: number | string;
  dhuhr: number | string;
  asr: number | string;
  maghrib: number | string;
  isha: number | string;
}

// Charger les délais Iqama depuis Firebase (settings/prayerTimes)
const getIqamaDelaysFromFirebase = async (): Promise<FirebaseIqamaDelays | null> => {
  try {
    const doc = await firestore().collection('settings').doc('prayerTimes').get();
    if (doc.exists() && doc.data()?.iqama) {
      return doc.data()?.iqama as FirebaseIqamaDelays;
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Convertir délai Firebase en format offset (+10, +15, etc.)
const delayToOffset = (delay: number | string): string => {
  if (typeof delay === 'string') {
    // Si déjà format HH:MM ou +XX, retourner tel quel
    if (delay.includes(':') || delay.startsWith('+') || delay.startsWith('-')) {
      return delay;
    }
    return `+${delay}`;
  }
  return `+${delay}`;
};

const MAWAQIT_API = 'https://mawaqit.net/api/2.0';
const MOSQUE_UUID = '357233ff-e025-42f2-abf9-b23adb23ed52';

// Forcer la timezone Europe/Paris pour tous les calculs de jour/heure.
// Corrige le bug où un device en UTC ou autre TZ voit les horaires du mauvais jour.
// Utilise les composants Intl pour éviter new Date(string) qui peut retourner Invalid Date.
export const getParisDate = (): Date => {
  const now = new Date();
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
    return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  } catch {
    // Fallback: toLocaleString parse (peut échouer sur certains devices)
    const parisStr = now.toLocaleString('en-US', { timeZone: 'Europe/Paris' });
    const parsed = new Date(parisStr);
    return isNaN(parsed.getTime()) ? now : parsed;
  }
};

// Fallback Aladhan pour la date Hijri (Mawaqit ne la fournit pas)
const ALADHAN_API = 'https://api.aladhan.com/v1';

// Essayer de lire le cache Firestore d'abord (rempli par Cloud Function)
const getCachedFromFirestore = async (): Promise<{ timings?: any; hijri?: any } | null> => {
  try {
    const paris = getParisDate();
    const today = `${paris.getFullYear()}-${String(paris.getMonth() + 1).padStart(2, '0')}-${String(paris.getDate()).padStart(2, '0')}`;
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

// Calendrier 2026 complet pour Bourg-en-Bresse (méthode UOIF/Mawaqit)
// Format: [Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha]
// Calendrier Mawaqit 2026 COMPLET — source officielle PDF mosquée El Mohsinine
const calendar2026: Record<number, Record<string, string[]>> = {
  0: { // Janvier
    '1': ['06:51','08:21','12:43','14:48','17:11','18:41'],
    '2': ['06:51','08:21','12:43','14:49','17:12','18:42'],
    '3': ['06:51','08:21','12:44','14:50','17:13','18:43'],
    '4': ['06:51','08:21','12:44','14:51','17:14','18:44'],
    '5': ['06:51','08:21','12:45','14:52','17:15','18:45'],
    '6': ['06:50','08:20','12:45','14:53','17:16','18:46'],
    '7': ['06:50','08:20','12:46','14:54','17:17','18:47'],
    '8': ['06:50','08:20','12:47','14:54','17:18','18:48'],
    '9': ['06:50','08:20','12:47','14:55','17:19','18:49'],
    '10': ['06:49','08:19','12:48','14:56','17:20','18:50'],
    '11': ['06:48','08:19','12:48','14:57','17:21','18:50'],
    '12': ['06:48','08:18','12:49','14:59','17:22','18:52'],
    '13': ['06:48','08:18','12:49','15:00','17:24','18:54'],
    '14': ['06:47','08:17','12:49','15:01','17:25','18:55'],
    '15': ['06:47','08:17','12:50','15:02','17:26','18:56'],
    '16': ['06:46','08:16','12:50','15:03','17:28','18:58'],
    '17': ['06:46','08:16','12:50','15:04','17:29','18:59'],
    '18': ['06:45','08:15','12:50','15:05','17:30','19:00'],
    '19': ['06:45','08:15','12:51','15:06','17:31','19:01'],
    '20': ['06:44','08:14','12:51','15:08','17:33','19:03'],
    '21': ['06:43','08:13','12:51','15:09','17:34','19:04'],
    '22': ['06:42','08:12','12:51','15:10','17:35','19:05'],
    '23': ['06:41','08:11','12:52','15:11','17:36','19:06'],
    '24': ['06:40','08:10','12:52','15:13','17:38','19:08'],
    '25': ['06:39','08:09','12:52','15:14','17:40','19:10'],
    '26': ['06:37','08:08','12:52','15:15','17:41','19:11'],
    '27': ['06:37','08:07','12:52','15:16','17:42','19:12'],
    '28': ['06:36','08:06','12:52','15:18','17:44','19:14'],
    '29': ['06:35','08:05','12:53','15:19','17:46','19:16'],
    '30': ['06:34','08:04','12:53','15:20','17:47','19:17'],
    '31': ['06:33','08:03','12:53','15:20','17:48','19:18'],
  },
  1: { // Février
    '1': ['06:32','08:02','12:54','15:22','17:50','19:20'],
    '2': ['06:31','08:01','12:54','15:23','17:52','19:22'],
    '3': ['06:30','08:00','12:54','15:24','17:54','19:24'],
    '4': ['06:28','07:58','12:54','15:25','17:55','19:25'],
    '5': ['06:27','07:57','12:54','15:27','17:57','19:27'],
    '6': ['06:26','07:56','12:54','15:28','17:59','19:29'],
    '7': ['06:25','07:55','12:54','15:29','18:01','19:31'],
    '8': ['06:23','07:53','12:54','15:30','18:02','19:32'],
    '9': ['06:22','07:52','12:55','15:32','18:03','19:33'],
    '10': ['06:21','07:51','12:55','15:33','18:05','19:35'],
    '11': ['06:19','07:49','12:55','15:34','18:07','19:37'],
    '12': ['06:17','07:47','12:55','15:35','18:08','19:38'],
    '13': ['06:16','07:46','12:55','15:37','18:09','19:39'],
    '14': ['06:15','07:45','12:55','15:38','18:11','19:41'],
    '15': ['06:13','07:43','12:55','15:39','18:13','19:43'],
    '16': ['06:11','07:41','12:55','15:40','18:14','19:44'],
    '17': ['06:10','07:40','12:55','15:42','18:15','19:45'],
    '18': ['06:08','07:38','12:55','15:43','18:17','19:47'],
    '19': ['06:07','07:37','12:55','15:44','18:18','19:48'],
    '20': ['06:05','07:35','12:55','15:45','18:19','19:49'],
    '21': ['06:04','07:34','12:55','15:46','18:21','19:51'],
    '22': ['06:03','07:33','12:55','15:47','18:22','19:52'],
    '23': ['06:01','07:31','12:55','15:48','18:23','19:53'],
    '24': ['05:59','07:29','12:54','15:50','18:25','19:55'],
    '25': ['05:57','07:27','12:54','15:51','18:27','19:57'],
    '26': ['05:56','07:26','12:54','15:52','18:29','19:59'],
    '27': ['05:54','07:24','12:54','15:53','18:30','20:00'],
    '28': ['05:52','07:22','12:54','15:54','18:31','20:01'],
  },
  2: { // Mars
    '1': ['05:50','07:20','12:54','15:55','18:32','20:02'],
    '2': ['05:49','07:19','12:54','15:55','18:34','20:04'],
    '3': ['05:47','07:17','12:53','15:56','18:36','20:06'],
    '4': ['05:45','07:15','12:53','15:57','18:37','20:07'],
    '5': ['05:43','07:13','12:53','15:58','18:38','20:08'],
    '6': ['05:41','07:11','12:53','15:59','18:39','20:09'],
    '7': ['05:39','07:09','12:52','16:00','18:41','20:11'],
    '8': ['05:37','07:07','12:52','16:01','18:42','20:12'],
    '9': ['05:35','07:05','12:52','16:02','18:43','20:13'],
    '10': ['05:34','07:04','12:52','16:03','18:45','20:15'],
    '11': ['05:33','07:02','12:51','16:04','18:46','20:16'],
    '12': ['05:32','07:00','12:51','16:05','18:47','20:17'],
    '13': ['05:28','06:58','12:51','16:06','18:49','20:19'],
    '14': ['05:26','06:56','12:50','16:07','18:50','20:20'],
    '15': ['05:24','06:54','12:50','16:08','18:51','20:21'],
    '16': ['05:22','06:52','12:50','16:08','18:52','20:22'],
    '17': ['05:20','06:50','12:50','16:09','18:54','20:24'],
    '18': ['05:19','06:49','12:50','16:09','18:55','20:25'],
    '19': ['05:17','06:47','12:49','16:10','18:56','20:26'],
    '20': ['05:15','06:45','12:49','16:11','18:58','20:28'],
    '21': ['05:13','06:43','12:49','16:12','19:00','20:30'],
    '22': ['05:11','06:41','12:48','16:12','19:01','20:31'],
    '23': ['05:09','06:39','12:47','16:13','19:02','20:32'],
    '24': ['05:07','06:37','12:47','16:14','19:03','20:33'],
    '25': ['05:05','06:35','12:47','16:15','19:05','20:35'],
    '26': ['05:01','06:33','12:46','16:16','19:06','20:36'],
    '27': ['05:01','06:31','12:46','16:16','19:07','20:37'],
    '28': ['04:59','06:29','12:46','16:16','19:08','20:38'],
    '29': ['05:57','07:27','13:46','17:17','20:10','21:40'], // Passage heure d'été
    '30': ['05:55','07:25','13:45','17:17','20:11','21:41'],
    '31': ['05:53','07:23','13:45','17:18','20:12','21:42'],
  },
  3: { // Avril
    '1': ['05:51','07:21','13:45','17:19','20:14','21:44'],
    '2': ['05:50','07:20','13:45','17:19','20:15','21:45'],
    '3': ['05:48','07:18','13:45','17:20','20:16','21:46'],
    '4': ['05:46','07:16','13:45','17:20','20:17','21:47'],
    '5': ['05:44','07:14','13:44','17:21','20:19','21:49'],
    '6': ['05:42','07:12','13:44','17:21','20:20','21:50'],
    '7': ['05:40','07:10','13:44','17:22','20:21','21:51'],
    '8': ['05:38','07:08','13:43','17:23','20:22','21:52'],
    '9': ['05:36','07:06','13:43','17:24','20:24','21:54'],
    '10': ['05:35','07:05','13:43','17:25','20:25','21:55'],
    '11': ['05:33','07:03','13:42','17:25','20:26','21:56'],
    '12': ['05:31','07:01','13:42','17:25','20:27','21:57'],
    '13': ['05:29','06:59','13:41','17:26','20:29','21:59'],
    '14': ['05:27','06:57','13:41','17:26','20:30','22:00'],
    '15': ['05:25','06:55','13:41','17:27','20:31','22:01'],
    '16': ['05:23','06:53','13:40','17:27','20:32','22:02'],
    '17': ['05:21','06:51','13:40','17:28','20:34','22:04'],
    '18': ['05:19','06:49','13:40','17:28','20:35','22:05'],
    '19': ['05:18','06:48','13:40','17:29','20:36','22:06'],
    '20': ['05:16','06:46','13:39','17:29','20:37','22:07'],
    '21': ['05:14','06:44','13:39','17:30','20:39','22:09'],
    '22': ['05:12','06:42','13:39','17:31','20:40','22:10'],
    '23': ['05:10','06:40','13:39','17:31','20:41','22:11'],
    '24': ['05:09','06:39','13:39','17:32','20:43','22:13'],
    '25': ['05:08','06:38','13:38','17:32','20:45','22:15'],
    '26': ['05:06','06:36','13:38','17:32','20:46','22:16'],
    '27': ['05:04','06:34','13:38','17:33','20:47','22:17'],
    '28': ['05:02','06:32','13:38','17:33','20:49','22:18'],
    '29': ['05:01','06:31','13:38','17:33','20:50','22:20'],
    '30': ['05:00','06:30','13:38','17:33','20:51','22:21'],
  },
  4: { // Mai
    '1': ['04:58','06:28','13:37','17:34','20:52','22:22'],
    '2': ['04:57','06:27','13:37','17:34','20:53','22:23'],
    '3': ['04:56','06:26','13:37','17:35','20:54','22:24'],
    '4': ['04:54','06:24','13:37','17:35','20:55','22:25'],
    '5': ['04:52','06:22','13:37','17:36','20:57','22:27'],
    '6': ['04:51','06:22','13:37','17:36','20:58','22:28'],
    '7': ['04:50','06:21','13:37','17:37','20:59','22:29'],
    '8': ['04:48','06:20','13:37','17:37','21:00','22:30'],
    '9': ['04:46','06:18','13:37','17:38','21:02','22:32'],
    '10': ['04:45','06:16','13:37','17:38','21:03','22:33'],
    '11': ['04:44','06:15','13:37','17:38','21:04','22:34'],
    '12': ['04:43','06:14','13:37','17:38','21:05','22:35'],
    '13': ['04:41','06:13','13:37','17:39','21:07','22:37'],
    '14': ['04:40','06:11','13:37','17:39','21:08','22:38'],
    '15': ['04:39','06:10','13:37','17:40','21:09','22:39'],
    '16': ['04:38','06:09','13:37','17:40','21:10','22:40'],
    '17': ['04:37','06:08','13:37','17:41','21:12','22:42'],
    '18': ['04:36','06:07','13:37','17:41','21:13','22:43'],
    '19': ['04:35','06:06','13:37','17:41','21:14','22:44'],
    '20': ['04:34','06:05','13:37','17:42','21:15','22:45'],
    '21': ['04:32','06:04','13:37','17:42','21:16','22:46'],
    '22': ['04:31','06:02','13:37','17:42','21:17','22:47'],
    '23': ['04:30','06:01','13:37','17:43','21:18','22:48'],
    '24': ['04:30','06:00','13:37','17:43','21:19','22:49'],
    '25': ['04:29','06:00','13:37','17:44','21:20','22:50'],
    '26': ['04:29','05:59','13:37','17:44','21:21','22:51'],
    '27': ['04:28','05:59','13:37','17:45','21:22','22:52'],
    '28': ['04:27','05:58','13:37','17:45','21:23','22:53'],
    '29': ['04:26','05:57','13:37','17:45','21:24','22:54'],
    '30': ['04:26','05:56','13:37','17:46','21:25','22:55'],
    '31': ['04:25','05:56','13:37','17:46','21:26','22:56'],
  },
  5: { // Juin
    '1': ['04:24','05:54','13:38','17:47','21:27','22:57'],
    '2': ['04:23','05:53','13:38','17:47','21:27','22:57'],
    '3': ['04:23','05:53','13:38','17:47','21:28','22:58'],
    '4': ['04:22','05:52','13:38','17:47','21:29','22:59'],
    '5': ['04:22','05:52','13:38','17:48','21:30','23:00'],
    '6': ['04:22','05:52','13:38','17:48','21:30','23:00'],
    '7': ['04:21','05:51','13:38','17:48','21:31','23:01'],
    '8': ['04:21','05:51','13:38','17:48','21:32','23:02'],
    '9': ['04:20','05:50','13:39','17:49','21:33','23:03'],
    '10': ['04:20','05:50','13:39','17:49','21:33','23:03'],
    '11': ['04:20','05:50','13:39','17:49','21:34','23:04'],
    '12': ['04:20','05:50','13:39','17:49','21:34','23:05'],
    '13': ['04:19','05:50','13:40','17:50','21:35','23:05'],
    '14': ['04:19','05:49','13:40','17:50','21:35','23:06'],
    '15': ['04:19','05:49','13:41','17:50','21:36','23:06'],
    '16': ['04:19','05:49','13:41','17:50','21:36','23:07'],
    '17': ['04:19','05:49','13:41','17:51','21:37','23:07'],
    '18': ['04:19','05:49','13:41','17:51','21:37','23:07'],
    '19': ['04:20','05:49','13:41','17:51','21:37','23:08'],
    '20': ['04:20','05:50','13:41','17:51','21:38','23:08'],
    '21': ['04:20','05:50','13:41','17:52','21:38','23:08'],
    '22': ['04:20','05:50','13:41','17:52','21:38','23:08'],
    '23': ['04:20','05:50','13:41','17:52','21:39','23:09'],
    '24': ['04:21','05:51','13:41','17:52','21:39','23:09'],
    '25': ['04:21','05:51','13:42','17:53','21:39','23:09'],
    '26': ['04:22','05:52','13:42','17:53','21:39','23:09'],
    '27': ['04:22','05:52','13:42','17:53','21:38','23:08'],
    '28': ['04:22','05:52','13:42','17:53','21:38','23:08'],
    '29': ['04:23','05:53','13:43','17:54','21:38','23:08'],
    '30': ['04:23','05:53','13:43','17:54','21:38','23:08'],
  },
  6: { // Juillet
    '1': ['04:24','05:54','13:43','17:54','21:38','23:08'],
    '2': ['04:24','05:54','13:43','17:54','21:38','23:08'],
    '3': ['04:25','05:55','13:43','17:54','21:37','23:07'],
    '4': ['04:25','05:55','13:43','17:54','21:37','23:07'],
    '5': ['04:26','05:56','13:44','17:54','21:37','23:07'],
    '6': ['04:26','05:56','13:44','17:54','21:36','23:06'],
    '7': ['04:27','05:57','13:44','17:54','21:36','23:06'],
    '8': ['04:28','05:58','13:44','17:54','21:35','23:05'],
    '9': ['04:29','05:59','13:45','17:54','21:35','23:05'],
    '10': ['04:30','06:00','13:45','17:54','21:35','23:05'],
    '11': ['04:31','06:01','13:45','17:54','21:34','23:04'],
    '12': ['04:32','06:02','13:45','17:54','21:34','23:04'],
    '13': ['04:33','06:03','13:45','17:54','21:33','23:03'],
    '14': ['04:34','06:04','13:45','17:54','21:33','23:03'],
    '15': ['04:35','06:05','13:45','17:54','21:32','23:02'],
    '16': ['04:35','06:05','13:45','17:54','21:31','23:01'],
    '17': ['04:36','06:06','13:46','17:53','21:30','23:00'],
    '18': ['04:37','06:07','13:46','17:53','21:30','23:00'],
    '19': ['04:38','06:08','13:46','17:53','21:29','22:59'],
    '20': ['04:39','06:09','13:46','17:53','21:28','22:58'],
    '21': ['04:40','06:10','13:46','17:52','21:27','22:57'],
    '22': ['04:41','06:11','13:46','17:52','21:26','22:56'],
    '23': ['04:42','06:12','13:46','17:52','21:25','22:55'],
    '24': ['04:43','06:13','13:46','17:52','21:24','22:54'],
    '25': ['04:45','06:15','13:46','17:51','21:23','22:53'],
    '26': ['04:46','06:16','13:46','17:51','21:21','22:51'],
    '27': ['04:47','06:17','13:46','17:51','21:20','22:50'],
    '28': ['04:48','06:18','13:46','17:51','21:19','22:49'],
    '29': ['04:49','06:19','13:46','17:50','21:18','22:48'],
    '30': ['04:50','06:20','13:46','17:50','21:17','22:47'],
    '31': ['04:51','06:21','13:46','17:50','21:16','22:46'],
  },
  7: { // Août
    '1': ['04:53','06:23','13:46','17:48','21:14','22:44'],
    '2': ['04:54','06:24','13:46','17:48','21:12','22:42'],
    '3': ['04:55','06:25','13:46','17:47','21:11','22:41'],
    '4': ['04:56','06:26','13:46','17:47','21:10','22:40'],
    '5': ['04:58','06:28','13:46','17:46','21:09','22:39'],
    '6': ['04:59','06:29','13:46','17:46','21:08','22:38'],
    '7': ['05:00','06:30','13:46','17:45','21:06','22:36'],
    '8': ['05:01','06:31','13:46','17:45','21:04','22:34'],
    '9': ['05:02','06:32','13:45','17:44','21:03','22:33'],
    '10': ['05:03','06:33','13:45','17:44','21:01','22:31'],
    '11': ['05:04','06:34','13:45','17:43','20:59','22:29'],
    '12': ['05:05','06:35','13:45','17:42','20:58','22:28'],
    '13': ['05:07','06:37','13:45','17:41','20:57','22:27'],
    '14': ['05:08','06:38','13:45','17:41','20:56','22:26'],
    '15': ['05:09','06:39','13:45','17:40','20:54','22:24'],
    '16': ['05:10','06:40','13:45','17:39','20:52','22:22'],
    '17': ['05:12','06:41','13:44','17:38','20:51','22:21'],
    '18': ['05:13','06:43','13:44','17:37','20:49','22:19'],
    '19': ['05:14','06:44','13:44','17:36','20:47','22:17'],
    '20': ['05:15','06:45','13:44','17:35','20:45','22:15'],
    '21': ['05:17','06:47','13:43','17:34','20:44','22:14'],
    '22': ['05:18','06:48','13:43','17:33','20:42','22:12'],
    '23': ['05:19','06:49','13:43','17:32','20:41','22:11'],
    '24': ['05:20','06:50','13:42','17:31','20:39','22:09'],
    '25': ['05:22','06:52','13:42','17:30','20:37','22:07'],
    '26': ['05:23','06:53','13:42','17:29','20:36','22:06'],
    '27': ['05:24','06:54','13:42','17:28','20:34','22:04'],
    '28': ['05:25','06:55','13:42','17:27','20:32','22:02'],
    '29': ['05:27','06:57','13:41','17:26','20:30','22:00'],
    '30': ['05:29','06:59','13:41','17:25','20:28','21:58'],
    '31': ['05:30','07:00','13:41','17:24','20:26','21:56'],
  },
  8: { // Septembre
    '1': ['05:31','07:01','13:40','17:23','20:24','21:54'],
    '2': ['05:32','07:02','13:40','17:21','20:22','21:52'],
    '3': ['05:33','07:03','13:39','17:20','20:20','21:50'],
    '4': ['05:34','07:04','13:39','17:19','20:18','21:48'],
    '5': ['05:35','07:05','13:38','17:18','20:16','21:46'],
    '6': ['05:37','07:07','13:38','17:16','20:14','21:44'],
    '7': ['05:38','07:08','13:38','17:15','20:12','21:42'],
    '8': ['05:39','07:09','13:37','17:14','20:10','21:40'],
    '9': ['05:40','07:10','13:37','17:13','20:09','21:39'],
    '10': ['05:42','07:12','13:37','17:11','20:07','21:37'],
    '11': ['05:43','07:13','13:36','17:10','20:05','21:35'],
    '12': ['05:44','07:14','13:36','17:09','20:03','21:33'],
    '13': ['05:45','07:15','13:35','17:08','20:01','21:31'],
    '14': ['05:47','07:17','13:35','17:06','19:59','21:29'],
    '15': ['05:48','07:18','13:35','17:04','19:57','21:27'],
    '16': ['05:49','07:19','13:35','17:03','19:55','21:25'],
    '17': ['05:50','07:20','13:34','17:02','19:53','21:23'],
    '18': ['05:52','07:22','13:34','17:00','19:51','21:21'],
    '19': ['05:53','07:23','13:34','16:59','19:49','21:19'],
    '20': ['05:54','07:24','13:34','16:58','19:47','21:17'],
    '21': ['05:55','07:25','13:32','16:57','19:45','21:16'],
    '22': ['05:57','07:27','13:32','16:56','19:43','21:13'],
    '23': ['05:58','07:28','13:32','16:55','19:41','21:11'],
    '24': ['05:59','07:29','13:32','16:53','19:39','21:09'],
    '25': ['06:00','07:30','13:31','16:52','19:37','21:07'],
    '26': ['06:02','07:32','13:31','16:51','19:35','21:05'],
    '27': ['06:03','07:33','13:31','16:49','19:33','21:03'],
    '28': ['06:04','07:34','13:31','16:47','19:31','21:01'],
    '29': ['06:05','07:35','13:30','16:46','19:29','20:59'],
    '30': ['06:06','07:36','13:30','16:45','19:27','20:57'],
  },
  9: { // Octobre
    '1': ['06:07','07:37','13:29','16:43','19:26','20:56'],
    '2': ['06:08','07:38','13:29','16:41','19:24','20:54'],
    '3': ['06:09','07:39','13:29','16:39','19:22','20:52'],
    '4': ['06:10','07:40','13:29','16:38','19:20','20:50'],
    '5': ['06:12','07:42','13:28','16:37','19:18','20:48'],
    '6': ['06:13','07:43','13:28','16:35','19:16','20:46'],
    '7': ['06:14','07:44','13:27','16:34','19:14','20:44'],
    '8': ['06:16','07:46','13:27','16:33','19:12','20:42'],
    '9': ['06:18','07:48','13:26','16:32','19:10','20:40'],
    '10': ['06:19','07:49','13:26','16:30','19:09','20:39'],
    '11': ['06:20','07:50','13:26','16:28','19:07','20:37'],
    '12': ['06:21','07:51','13:25','16:27','19:05','20:35'],
    '13': ['06:23','07:53','13:25','16:26','19:03','20:33'],
    '14': ['06:24','07:54','13:25','16:25','19:02','20:32'],
    '15': ['06:25','07:55','13:25','16:23','19:01','20:30'],
    '16': ['06:26','07:56','13:25','16:22','18:58','20:28'],
    '17': ['06:28','07:58','13:25','16:21','18:56','20:26'],
    '18': ['06:29','07:59','13:25','16:19','18:55','20:25'],
    '19': ['06:30','08:00','13:25','16:17','18:53','20:23'],
    '20': ['06:32','08:02','13:25','16:16','18:51','20:21'],
    '21': ['06:34','08:04','13:24','16:15','18:49','20:19'],
    '22': ['06:35','08:05','13:24','16:13','18:48','20:18'],
    '23': ['06:36','08:06','13:24','16:12','18:47','20:17'],
    '24': ['06:37','08:07','13:24','16:11','18:45','20:15'],
    '25': ['05:39','07:09','12:24','15:10','17:43','19:13'], // Passage heure d'hiver
    '26': ['05:40','07:10','12:24','15:08','17:41','19:11'],
    '27': ['05:41','07:11','12:24','15:07','17:40','19:10'],
    '28': ['05:43','07:13','12:24','15:06','17:38','19:08'],
    '29': ['05:45','07:15','12:24','15:05','17:36','19:06'],
    '30': ['05:46','07:16','12:23','15:04','17:35','19:05'],
    '31': ['05:47','07:17','12:23','15:03','17:33','19:03'],
  },
  10: { // Novembre
    '1': ['05:49','07:19','12:23','15:02','17:32','19:02'],
    '2': ['05:51','07:21','12:23','15:01','17:31','19:01'],
    '3': ['05:53','07:23','12:23','15:00','17:30','19:00'],
    '4': ['05:54','07:24','12:23','14:59','17:29','18:59'],
    '5': ['05:55','07:25','12:23','14:57','17:27','18:57'],
    '6': ['05:56','07:26','12:23','14:56','17:26','18:56'],
    '7': ['05:57','07:27','12:23','14:55','17:25','18:55'],
    '8': ['05:59','07:29','12:23','14:54','17:23','18:53'],
    '9': ['06:01','07:31','12:24','14:53','17:21','18:51'],
    '10': ['06:03','07:33','12:24','14:53','17:20','18:50'],
    '11': ['06:04','07:34','12:24','14:52','17:19','18:49'],
    '12': ['06:05','07:35','12:24','14:50','17:18','18:48'],
    '13': ['06:07','07:37','12:24','14:50','17:17','18:47'],
    '14': ['06:08','07:38','12:24','14:49','17:16','18:46'],
    '15': ['06:09','07:39','12:24','14:48','17:15','18:45'],
    '16': ['06:10','07:40','12:24','14:47','17:14','18:44'],
    '17': ['06:12','07:42','12:25','14:46','17:13','18:43'],
    '18': ['06:13','07:43','12:25','14:46','17:12','18:42'],
    '19': ['06:14','07:44','12:25','14:45','17:11','18:41'],
    '20': ['06:16','07:46','12:25','14:44','17:10','18:40'],
    '21': ['06:18','07:48','12:26','14:44','17:09','18:39'],
    '22': ['06:19','07:49','12:26','14:44','17:08','18:38'],
    '23': ['06:20','07:50','12:26','14:43','17:07','18:37'],
    '24': ['06:21','07:51','12:26','14:42','17:06','18:36'],
    '25': ['06:23','07:53','12:27','14:41','17:06','18:36'],
    '26': ['06:24','07:54','12:27','14:41','17:06','18:36'],
    '27': ['06:25','07:55','12:27','14:41','17:05','18:35'],
    '28': ['06:26','07:56','12:27','14:41','17:05','18:35'],
    '29': ['06:28','07:58','12:28','14:40','17:04','18:34'],
    '30': ['06:29','07:59','12:29','14:40','17:04','18:34'],
  },
  11: { // Décembre
    '1': ['06:31','08:01','12:29','14:39','17:03','18:33'],
    '2': ['06:32','08:02','12:29','14:39','17:03','18:33'],
    '3': ['06:33','08:03','12:30','14:39','17:03','18:33'],
    '4': ['06:34','08:04','12:30','14:39','17:03','18:33'],
    '5': ['06:35','08:05','12:31','14:38','17:02','18:32'],
    '6': ['06:36','08:06','12:31','14:38','17:02','18:32'],
    '7': ['06:37','08:07','12:32','14:38','17:02','18:32'],
    '8': ['06:38','08:08','12:32','14:38','17:02','18:32'],
    '9': ['06:39','08:09','12:33','14:38','17:01','18:31'],
    '10': ['06:40','08:10','12:33','14:38','17:01','18:31'],
    '11': ['06:41','08:11','12:33','14:38','17:01','18:31'],
    '12': ['06:42','08:12','12:33','14:38','17:01','18:31'],
    '13': ['06:43','08:13','12:34','14:38','17:01','18:31'],
    '14': ['06:44','08:14','12:34','14:38','17:01','18:31'],
    '15': ['06:45','08:15','12:35','14:38','17:01','18:31'],
    '16': ['06:45','08:15','12:35','14:38','17:01','18:31'],
    '17': ['06:46','08:16','12:36','14:39','17:02','18:32'],
    '18': ['06:46','08:16','12:36','14:39','17:02','18:32'],
    '19': ['06:47','08:17','12:37','14:40','17:02','18:32'],
    '20': ['06:47','08:17','12:37','14:40','17:02','18:32'],
    '21': ['06:48','08:18','12:38','14:41','17:03','18:33'],
    '22': ['06:48','08:18','12:38','14:41','17:03','18:33'],
    '23': ['06:49','08:19','12:39','14:42','17:04','18:34'],
    '24': ['06:49','08:19','12:39','14:42','17:04','18:34'],
    '25': ['06:50','08:20','12:40','14:43','17:05','18:35'],
    '26': ['06:50','08:20','12:40','14:43','17:05','18:35'],
    '27': ['06:50','08:20','12:41','14:44','17:06','18:36'],
    '28': ['06:50','08:20','12:41','14:45','17:07','18:37'],
    '29': ['06:51','08:21','12:42','14:46','17:08','18:38'],
    '30': ['06:51','08:21','12:42','14:46','17:09','18:39'],
    '31': ['06:51','08:21','12:42','14:46','17:10','18:40'],
  },
};

export const PrayerAPI = {
  // Horaires depuis le calendrier local 2026 (source: PDF officiel mosquée El Mohsinine)
  getTimesByCity: async (
    city: string = 'Bourg-en-Bresse',
    country: string = 'France'
  ): Promise<PrayerTimings> => {
    const now = getParisDate();
    const hourBlock = now.getHours() >= 20 ? 'night' : 'day';
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cacheKey = `local-times-${dateStr}-${hourBlock}`;
    const cached = getCached<PrayerTimings>(cacheKey);
    if (cached) return cached;

    const today = getParisDate();
    const currentHour = today.getHours();
    const currentMinutes = today.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;

    const getTimesForDay = (month: number, day: number): string[] => {
      const monthCal = calendar2026[month];
      if (!monthCal) return ['06:34','08:04','12:53','15:20','17:47','19:17'];
      return monthCal[day.toString()] || ['06:34','08:04','12:53','15:20','17:47','19:17'];
    };

    const todayTimes = getTimesForDay(today.getMonth(), today.getDate());
    const [ishaH, ishaM] = todayTimes[5].split(':').map(Number);
    const ishaInMinutes = ishaH * 60 + ishaM;

    let targetMonth = today.getMonth();
    let targetDay = today.getDate();

    if (currentTimeInMinutes >= ishaInMinutes) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetMonth = tomorrow.getMonth();
      targetDay = tomorrow.getDate();
    }

    const times = getTimesForDay(targetMonth, targetDay);

    let iqamaOffsets = ['+10', '+10', '+10', '+7', '+10'];
    try {
      const firebaseIqama = await getIqamaDelaysFromFirebase();
      if (firebaseIqama) {
        iqamaOffsets = [
          delayToOffset(firebaseIqama.fajr),
          delayToOffset(firebaseIqama.dhuhr),
          delayToOffset(firebaseIqama.asr),
          delayToOffset(firebaseIqama.maghrib),
          delayToOffset(firebaseIqama.isha),
        ];
      }
    } catch {}

    const timings: PrayerTimings = {
      Fajr: times[0],
      Sunrise: times[1],
      Dhuhr: times[2],
      Asr: times[3],
      Sunset: times[4],
      Maghrib: times[4],
      Isha: times[5],
      Imsak: times[0],
      Midnight: '00:00',
      Firstthird: '00:00',
      Lastthird: '00:00',
      Jumua: '13:30',
      IqamaFajr: calculateIqamaTime(times[0], iqamaOffsets[0]),
      IqamaDhuhr: calculateIqamaTime(times[2], iqamaOffsets[1]),
      IqamaAsr: calculateIqamaTime(times[3], iqamaOffsets[2]),
      IqamaMaghrib: calculateIqamaTime(times[4], iqamaOffsets[3]),
      IqamaIsha: calculateIqamaTime(times[5], iqamaOffsets[4]),
    };

    setCache(cacheKey, timings);
    return timings;
  },

  // Alias pour compatibilité
  getTimesByCoords: async (latitude: number, longitude: number): Promise<PrayerTimings> => {
    return PrayerAPI.getTimesByCity();
  },

  // Calendrier mensuel depuis le calendrier local 2026 (source: PDF officiel mosquée)
  getMonthlyCalendar: async (
    year: number,
    month: number,
    city: string = 'Bourg-en-Bresse',
    country: string = 'France'
  ): Promise<DayData[]> => {
    const cacheKey = `calendar-${year}-${month}`;
    const cached = getCached<DayData[]>(cacheKey);
    if (cached) return cached;

    const monthIndex = month - 1;
    const monthCalendar = calendar2026[monthIndex];

    if (!monthCalendar) {
      return [];
    }

    let iqamaOffsets = ['+10', '+10', '+10', '+7', '+10'];
    try {
      const firebaseIqama = await getIqamaDelaysFromFirebase();
      if (firebaseIqama) {
        iqamaOffsets = [
          delayToOffset(firebaseIqama.fajr),
          delayToOffset(firebaseIqama.dhuhr),
          delayToOffset(firebaseIqama.asr),
          delayToOffset(firebaseIqama.maghrib),
          delayToOffset(firebaseIqama.isha),
        ];
      }
    } catch {}

    const result: DayData[] = [];

    for (const [dayStr, timesArr] of Object.entries(monthCalendar)) {
      const dayNum = parseInt(dayStr, 10);

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
          method: { id: 99, name: 'Calendrier local', params: { Fajr: 12, Isha: 12 } },
        },
      });
    }

    setCache(cacheKey, result);
    return result;
  },

  // Date Hijri depuis Firestore (cache serveur) puis Aladhan (fallback)
  // Utilise adjustment=-1 pour s'aligner sur le calendrier de la Grande Mosquée de Paris / Mawaqit
  getHijriDate: async (): Promise<HijriDate> => {
    const today = getParisDate();
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
      logger.error('[PrayerAPI] Erreur Hijri:', error);
      // Fallback: calculer la date hijri via Intl (pas de hardcode)
      try {
        const now = new Date();
        const hijriFmt = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
          day: 'numeric', month: 'long', year: 'numeric',
          timeZone: 'Europe/Paris',
        });
        const parts = hijriFmt.formatToParts(now);
        const day = parts.find(p => p.type === 'day')?.value || '1';
        const monthEn = parts.find(p => p.type === 'month')?.value || '';
        const year = parts.find(p => p.type === 'year')?.value || '';
        // Aussi obtenir le mois en arabe
        const hijriFmtAr = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
          month: 'long', timeZone: 'Europe/Paris',
        });
        const monthAr = hijriFmtAr.format(now);
        // Mapper le numéro de mois
        const monthNames = ['Muharram','Safar','Rabi al-Awwal','Rabi al-Thani','Jumada al-Ula','Jumada al-Akhirah','Rajab','Shaban','Ramadan','Shawwal','Dhul-Qadah','Dhul-Hijjah'];
        const monthNum = monthNames.findIndex(m => monthEn.toLowerCase().includes(m.toLowerCase().substring(0, 4))) + 1;
        return {
          date: '',
          format: '',
          day,
          weekday: { en: '', ar: '' },
          month: { number: monthNum || 1, en: monthEn, ar: monthAr },
          year,
          designation: { abbreviated: 'AH', expanded: 'Anno Hegirae' },
          holidays: [],
        };
      } catch {
        return {
          date: '', format: '', day: '1',
          weekday: { en: '', ar: '' },
          month: { number: 1, en: '', ar: '' },
          year: '',
          designation: { abbreviated: 'AH', expanded: 'Anno Hegirae' },
          holidays: [],
        };
      }
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
      logger.error('[PrayerAPI] Erreur Qibla:', error);
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
    const today = getParisDate();

    return {
      timings,
      date: {
        readable: today.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }),
        timestamp: today.getTime().toString(),
        hijri,
        gregorian: {
          date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
          format: 'DD-MM-YYYY',
          day: today.getDate().toString(),
          weekday: { en: today.toLocaleDateString('en', { weekday: 'long', timeZone: 'Europe/Paris' }) },
          month: { number: today.getMonth() + 1, en: today.toLocaleDateString('en', { month: 'long', timeZone: 'Europe/Paris' }) },
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
    const now = getParisDate();
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

      if (prayerMinutes >= currentMinutes) {
        return prayer;
      }
    }

    // Si toutes les prières sont passées, retourner Fajr du lendemain
    return { ...prayers[0], name: 'Fajr (demain)', nameAr: 'الفجر (غدا)' };
  },

  // Retourne la prière en cours (fenêtre active)
  // Fajr: de Fajr à Fajr+1h (max 1 heure pour prier)
  // Dhuhr: de Dhuhr à Asr
  // Asr: de Asr à Maghrib
  // Maghrib: de Maghrib à Isha
  // Isha: de Isha à minuit
  getCurrentPrayer: (timings: PrayerTimings): { name: string; time: string; nameAr: string } | null => {
    const now = getParisDate();
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

    // Fenêtre Fajr: de Fajr à Fajr+1h (max 1 heure, ne dépasse pas Sunrise)
    const fajrEndMin = Math.min(fajrMin + 60, sunriseMin);
    if (currentMinutes >= fajrMin && currentMinutes < fajrEndMin) {
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

// Accès direct au calendrier 2026 pour un jour donné
export function getTimesForDate(month: number, day: number): string[] | null {
  const monthData = calendar2026[month];
  if (!monthData) return null;
  return monthData[String(day)] || null;
}
