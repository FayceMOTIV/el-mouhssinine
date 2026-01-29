// Service API pour le Coran - Al-Quran Cloud API

const BASE_URL = 'https://api.alquran.cloud/v1';

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

export interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  audio?: string;
}

export interface SurahData {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Ayah[];
}

export interface SearchResult {
  count: number;
  matches: {
    number: number;
    text: string;
    surah: {
      number: number;
      name: string;
      englishName: string;
    };
    numberInSurah: number;
  }[];
}

// Cache pour les donnees avec limite de taille (évite memory leak)
const cache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 1000 * 60 * 60 * 24 * 7; // 7 jours (le Coran ne change pas)
const MAX_CACHE_SIZE = 150; // Limite max d'entrées dans le cache

const getCached = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  // Supprimer l'entrée expirée
  if (cached) {
    cache.delete(key);
  }
  return null;
};

const setCache = (key: string, data: any) => {
  // Si cache plein, supprimer les entrées les plus anciennes (LRU simple)
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { data, timestamp: Date.now() });
};

export const QuranAPI = {
  // Liste des 114 sourates
  getAllSurahs: async (): Promise<Surah[]> => {
    const cacheKey = 'all-surahs';
    const cached = getCached<Surah[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${BASE_URL}/surah`);
      const json = await response.json();
      if (json.code === 200) {
        setCache(cacheKey, json.data);
        return json.data;
      }
      throw new Error(json.status);
    } catch (error) {
      console.error('Erreur getAllSurahs:', error);
      throw error;
    }
  },

  // Une sourate complete (arabe)
  getSurah: async (surahNumber: number): Promise<SurahData> => {
    const cacheKey = `surah-${surahNumber}`;
    const cached = getCached<SurahData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${BASE_URL}/surah/${surahNumber}`);
      const json = await response.json();
      if (json.code === 200) {
        setCache(cacheKey, json.data);
        return json.data;
      }
      throw new Error(json.status);
    } catch (error) {
      console.error('Erreur getSurah:', error);
      throw error;
    }
  },

  // Une sourate avec traduction francaise
  getSurahWithTranslation: async (surahNumber: number): Promise<SurahData> => {
    const cacheKey = `surah-fr-${surahNumber}`;
    const cached = getCached<SurahData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${BASE_URL}/surah/${surahNumber}/fr.hamidullah`);
      const json = await response.json();
      if (json.code === 200) {
        setCache(cacheKey, json.data);
        return json.data;
      }
      throw new Error(json.status);
    } catch (error) {
      console.error('Erreur getSurahWithTranslation:', error);
      throw error;
    }
  },

  // Une sourate avec plusieurs editions (arabe + traduction + audio)
  getSurahFull: async (surahNumber: number): Promise<{
    arabic: SurahData;
    translation: SurahData;
    audio: SurahData;
  }> => {
    const cacheKey = `surah-full-${surahNumber}`;
    const cached = getCached<{ arabic: SurahData; translation: SurahData; audio: SurahData }>(cacheKey);
    if (cached) return cached;

    try {
      const editions = 'quran-uthmani,fr.hamidullah,ar.alafasy';
      const response = await fetch(`${BASE_URL}/surah/${surahNumber}/editions/${editions}`);
      const json = await response.json();
      if (json.code === 200 && json.data.length === 3) {
        const result = {
          arabic: json.data[0],
          translation: json.data[1],
          audio: json.data[2],
        };
        setCache(cacheKey, result);
        return result;
      }
      throw new Error(json.status);
    } catch (error) {
      console.error('Erreur getSurahFull:', error);
      throw error;
    }
  },

  // Audio d'une sourate
  getSurahAudio: async (surahNumber: number, reciter: string = 'ar.alafasy'): Promise<SurahData> => {
    const cacheKey = `surah-audio-${surahNumber}-${reciter}`;
    const cached = getCached<SurahData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${BASE_URL}/surah/${surahNumber}/${reciter}`);
      const json = await response.json();
      if (json.code === 200) {
        setCache(cacheKey, json.data);
        return json.data;
      }
      throw new Error(json.status);
    } catch (error) {
      console.error('Erreur getSurahAudio:', error);
      throw error;
    }
  },

  // Recherche dans le Coran
  search: async (query: string, language: string = 'fr'): Promise<SearchResult> => {
    try {
      const edition = language === 'fr' ? 'fr.hamidullah' : 'quran-uthmani';
      const response = await fetch(`${BASE_URL}/search/${encodeURIComponent(query)}/all/${edition}`);
      const json = await response.json();
      if (json.code === 200) {
        return json.data;
      }
      throw new Error(json.status);
    } catch (error) {
      console.error('Erreur search:', error);
      throw error;
    }
  },

  // Un verset specifique
  getAyah: async (surahNumber: number, ayahNumber: number): Promise<{
    arabic: Ayah;
    translation: Ayah;
  }> => {
    try {
      const response = await fetch(`${BASE_URL}/ayah/${surahNumber}:${ayahNumber}/editions/quran-uthmani,fr.hamidullah`);
      const json = await response.json();
      if (json.code === 200 && json.data.length === 2) {
        return {
          arabic: json.data[0],
          translation: json.data[1],
        };
      }
      throw new Error(json.status);
    } catch (error) {
      console.error('Erreur getAyah:', error);
      throw error;
    }
  },

  // Page du Coran
  getPage: async (pageNumber: number): Promise<Ayah[]> => {
    try {
      const response = await fetch(`${BASE_URL}/page/${pageNumber}/quran-uthmani`);
      const json = await response.json();
      if (json.code === 200) {
        return json.data.ayahs;
      }
      throw new Error(json.status);
    } catch (error) {
      console.error('Erreur getPage:', error);
      throw error;
    }
  },

  // Juz (partie du Coran)
  getJuz: async (juzNumber: number): Promise<Ayah[]> => {
    try {
      const response = await fetch(`${BASE_URL}/juz/${juzNumber}/quran-uthmani`);
      const json = await response.json();
      if (json.code === 200) {
        return json.data.ayahs;
      }
      throw new Error(json.status);
    } catch (error) {
      console.error('Erreur getJuz:', error);
      throw error;
    }
  },
};

// URL audio d'une sourate complete
export const getAudioUrl = (surahNumber: number, reciter: string = 'ar.alafasy'): string => {
  return `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${surahNumber}.mp3`;
};

// Liste des recitateurs disponibles
export const reciters = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', nameAr: 'مشاري العفاسي' },
  { id: 'ar.abdulbasit', name: 'Abdul Basit Abdul Samad', nameAr: 'عبد الباسط عبد الصمد' },
  { id: 'ar.abdurrahmaansudais', name: 'Abdurrahman As-Sudais', nameAr: 'عبدالرحمن السديس' },
  { id: 'ar.hudhaify', name: 'Ali Al-Hudhaify', nameAr: 'علي الحذيفي' },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq Al-Minshawi', nameAr: 'محمد صديق المنشاوي' },
  { id: 'ar.saoodshuraym', name: 'Saud Al-Shuraim', nameAr: 'سعود الشريم' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', nameAr: 'محمود خليل الحصري' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al-Muaiqly', nameAr: 'ماهر المعيقلي' },
];

// Donnees statiques des sourates (pour usage hors-ligne)
export const surahsInfo = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', translation: 'L\'Ouverture', ayahs: 7, type: 'Mecquoise' },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqara', translation: 'La Vache', ayahs: 286, type: 'Medinoise' },
  { number: 3, name: 'آل عمران', englishName: 'Al-Imran', translation: 'La Famille d\'Imran', ayahs: 200, type: 'Medinoise' },
  { number: 4, name: 'النساء', englishName: 'An-Nisa', translation: 'Les Femmes', ayahs: 176, type: 'Medinoise' },
  { number: 5, name: 'المائدة', englishName: 'Al-Ma\'ida', translation: 'La Table Servie', ayahs: 120, type: 'Medinoise' },
  { number: 6, name: 'الأنعام', englishName: 'Al-An\'am', translation: 'Les Bestiaux', ayahs: 165, type: 'Mecquoise' },
  { number: 7, name: 'الأعراف', englishName: 'Al-A\'raf', translation: 'Les Hauteurs', ayahs: 206, type: 'Mecquoise' },
  { number: 8, name: 'الأنفال', englishName: 'Al-Anfal', translation: 'Le Butin', ayahs: 75, type: 'Medinoise' },
  { number: 9, name: 'التوبة', englishName: 'At-Tawba', translation: 'Le Repentir', ayahs: 129, type: 'Medinoise' },
  { number: 10, name: 'يونس', englishName: 'Yunus', translation: 'Jonas', ayahs: 109, type: 'Mecquoise' },
  { number: 11, name: 'هود', englishName: 'Hud', translation: 'Houd', ayahs: 123, type: 'Mecquoise' },
  { number: 12, name: 'يوسف', englishName: 'Yusuf', translation: 'Joseph', ayahs: 111, type: 'Mecquoise' },
  { number: 13, name: 'الرعد', englishName: 'Ar-Ra\'d', translation: 'Le Tonnerre', ayahs: 43, type: 'Medinoise' },
  { number: 14, name: 'إبراهيم', englishName: 'Ibrahim', translation: 'Abraham', ayahs: 52, type: 'Mecquoise' },
  { number: 15, name: 'الحجر', englishName: 'Al-Hijr', translation: 'Al-Hijr', ayahs: 99, type: 'Mecquoise' },
  { number: 16, name: 'النحل', englishName: 'An-Nahl', translation: 'Les Abeilles', ayahs: 128, type: 'Mecquoise' },
  { number: 17, name: 'الإسراء', englishName: 'Al-Isra', translation: 'Le Voyage Nocturne', ayahs: 111, type: 'Mecquoise' },
  { number: 18, name: 'الكهف', englishName: 'Al-Kahf', translation: 'La Caverne', ayahs: 110, type: 'Mecquoise' },
  { number: 19, name: 'مريم', englishName: 'Maryam', translation: 'Marie', ayahs: 98, type: 'Mecquoise' },
  { number: 20, name: 'طه', englishName: 'Ta-Ha', translation: 'Ta-Ha', ayahs: 135, type: 'Mecquoise' },
  { number: 21, name: 'الأنبياء', englishName: 'Al-Anbiya', translation: 'Les Prophetes', ayahs: 112, type: 'Mecquoise' },
  { number: 22, name: 'الحج', englishName: 'Al-Hajj', translation: 'Le Pelerinage', ayahs: 78, type: 'Medinoise' },
  { number: 23, name: 'المؤمنون', englishName: 'Al-Mu\'minun', translation: 'Les Croyants', ayahs: 118, type: 'Mecquoise' },
  { number: 24, name: 'النور', englishName: 'An-Nur', translation: 'La Lumiere', ayahs: 64, type: 'Medinoise' },
  { number: 25, name: 'الفرقان', englishName: 'Al-Furqan', translation: 'Le Discernement', ayahs: 77, type: 'Mecquoise' },
  { number: 26, name: 'الشعراء', englishName: 'Ash-Shu\'ara', translation: 'Les Poetes', ayahs: 227, type: 'Mecquoise' },
  { number: 27, name: 'النمل', englishName: 'An-Naml', translation: 'Les Fourmis', ayahs: 93, type: 'Mecquoise' },
  { number: 28, name: 'القصص', englishName: 'Al-Qasas', translation: 'Le Recit', ayahs: 88, type: 'Mecquoise' },
  { number: 29, name: 'العنكبوت', englishName: 'Al-Ankabut', translation: 'L\'Araignee', ayahs: 69, type: 'Mecquoise' },
  { number: 30, name: 'الروم', englishName: 'Ar-Rum', translation: 'Les Romains', ayahs: 60, type: 'Mecquoise' },
  { number: 31, name: 'لقمان', englishName: 'Luqman', translation: 'Luqman', ayahs: 34, type: 'Mecquoise' },
  { number: 32, name: 'السجدة', englishName: 'As-Sajda', translation: 'La Prosternation', ayahs: 30, type: 'Mecquoise' },
  { number: 33, name: 'الأحزاب', englishName: 'Al-Ahzab', translation: 'Les Coalises', ayahs: 73, type: 'Medinoise' },
  { number: 34, name: 'سبأ', englishName: 'Saba', translation: 'Saba', ayahs: 54, type: 'Mecquoise' },
  { number: 35, name: 'فاطر', englishName: 'Fatir', translation: 'Le Createur', ayahs: 45, type: 'Mecquoise' },
  { number: 36, name: 'يس', englishName: 'Ya-Sin', translation: 'Ya-Sin', ayahs: 83, type: 'Mecquoise' },
  { number: 37, name: 'الصافات', englishName: 'As-Saffat', translation: 'Les Ranges', ayahs: 182, type: 'Mecquoise' },
  { number: 38, name: 'ص', englishName: 'Sad', translation: 'Sad', ayahs: 88, type: 'Mecquoise' },
  { number: 39, name: 'الزمر', englishName: 'Az-Zumar', translation: 'Les Groupes', ayahs: 75, type: 'Mecquoise' },
  { number: 40, name: 'غافر', englishName: 'Ghafir', translation: 'Le Pardonneur', ayahs: 85, type: 'Mecquoise' },
  { number: 41, name: 'فصلت', englishName: 'Fussilat', translation: 'Les Detailles', ayahs: 54, type: 'Mecquoise' },
  { number: 42, name: 'الشورى', englishName: 'Ash-Shura', translation: 'La Consultation', ayahs: 53, type: 'Mecquoise' },
  { number: 43, name: 'الزخرف', englishName: 'Az-Zukhruf', translation: 'L\'Ornement', ayahs: 89, type: 'Mecquoise' },
  { number: 44, name: 'الدخان', englishName: 'Ad-Dukhan', translation: 'La Fumee', ayahs: 59, type: 'Mecquoise' },
  { number: 45, name: 'الجاثية', englishName: 'Al-Jathiya', translation: 'L\'Agenouillee', ayahs: 37, type: 'Mecquoise' },
  { number: 46, name: 'الأحقاف', englishName: 'Al-Ahqaf', translation: 'Al-Ahqaf', ayahs: 35, type: 'Mecquoise' },
  { number: 47, name: 'محمد', englishName: 'Muhammad', translation: 'Muhammad', ayahs: 38, type: 'Medinoise' },
  { number: 48, name: 'الفتح', englishName: 'Al-Fath', translation: 'La Victoire', ayahs: 29, type: 'Medinoise' },
  { number: 49, name: 'الحجرات', englishName: 'Al-Hujurat', translation: 'Les Appartements', ayahs: 18, type: 'Medinoise' },
  { number: 50, name: 'ق', englishName: 'Qaf', translation: 'Qaf', ayahs: 45, type: 'Mecquoise' },
  { number: 51, name: 'الذاريات', englishName: 'Adh-Dhariyat', translation: 'Qui Eparpillent', ayahs: 60, type: 'Mecquoise' },
  { number: 52, name: 'الطور', englishName: 'At-Tur', translation: 'Le Mont', ayahs: 49, type: 'Mecquoise' },
  { number: 53, name: 'النجم', englishName: 'An-Najm', translation: 'L\'Etoile', ayahs: 62, type: 'Mecquoise' },
  { number: 54, name: 'القمر', englishName: 'Al-Qamar', translation: 'La Lune', ayahs: 55, type: 'Mecquoise' },
  { number: 55, name: 'الرحمن', englishName: 'Ar-Rahman', translation: 'Le Tout Misericordieux', ayahs: 78, type: 'Medinoise' },
  { number: 56, name: 'الواقعة', englishName: 'Al-Waqi\'a', translation: 'L\'Evenement', ayahs: 96, type: 'Mecquoise' },
  { number: 57, name: 'الحديد', englishName: 'Al-Hadid', translation: 'Le Fer', ayahs: 29, type: 'Medinoise' },
  { number: 58, name: 'المجادلة', englishName: 'Al-Mujadila', translation: 'La Discussion', ayahs: 22, type: 'Medinoise' },
  { number: 59, name: 'الحشر', englishName: 'Al-Hashr', translation: 'L\'Exode', ayahs: 24, type: 'Medinoise' },
  { number: 60, name: 'الممتحنة', englishName: 'Al-Mumtahina', translation: 'L\'Eprouvee', ayahs: 13, type: 'Medinoise' },
  { number: 61, name: 'الصف', englishName: 'As-Saff', translation: 'Le Rang', ayahs: 14, type: 'Medinoise' },
  { number: 62, name: 'الجمعة', englishName: 'Al-Jumu\'a', translation: 'Le Vendredi', ayahs: 11, type: 'Medinoise' },
  { number: 63, name: 'المنافقون', englishName: 'Al-Munafiqun', translation: 'Les Hypocrites', ayahs: 11, type: 'Medinoise' },
  { number: 64, name: 'التغابن', englishName: 'At-Taghabun', translation: 'La Grande Perte', ayahs: 18, type: 'Medinoise' },
  { number: 65, name: 'الطلاق', englishName: 'At-Talaq', translation: 'Le Divorce', ayahs: 12, type: 'Medinoise' },
  { number: 66, name: 'التحريم', englishName: 'At-Tahrim', translation: 'L\'Interdiction', ayahs: 12, type: 'Medinoise' },
  { number: 67, name: 'الملك', englishName: 'Al-Mulk', translation: 'La Royaute', ayahs: 30, type: 'Mecquoise' },
  { number: 68, name: 'القلم', englishName: 'Al-Qalam', translation: 'La Plume', ayahs: 52, type: 'Mecquoise' },
  { number: 69, name: 'الحاقة', englishName: 'Al-Haqqah', translation: 'Celle Qui Montre La Verite', ayahs: 52, type: 'Mecquoise' },
  { number: 70, name: 'المعارج', englishName: 'Al-Ma\'arij', translation: 'Les Voies d\'Ascension', ayahs: 44, type: 'Mecquoise' },
  { number: 71, name: 'نوح', englishName: 'Nuh', translation: 'Noe', ayahs: 28, type: 'Mecquoise' },
  { number: 72, name: 'الجن', englishName: 'Al-Jinn', translation: 'Les Djinns', ayahs: 28, type: 'Mecquoise' },
  { number: 73, name: 'المزمل', englishName: 'Al-Muzzammil', translation: 'L\'Enveloppe', ayahs: 20, type: 'Mecquoise' },
  { number: 74, name: 'المدثر', englishName: 'Al-Muddaththir', translation: 'Le Revetu d\'un Manteau', ayahs: 56, type: 'Mecquoise' },
  { number: 75, name: 'القيامة', englishName: 'Al-Qiyamah', translation: 'La Resurrection', ayahs: 40, type: 'Mecquoise' },
  { number: 76, name: 'الإنسان', englishName: 'Al-Insan', translation: 'L\'Homme', ayahs: 31, type: 'Medinoise' },
  { number: 77, name: 'المرسلات', englishName: 'Al-Mursalat', translation: 'Les Envoyees', ayahs: 50, type: 'Mecquoise' },
  { number: 78, name: 'النبأ', englishName: 'An-Naba', translation: 'La Nouvelle', ayahs: 40, type: 'Mecquoise' },
  { number: 79, name: 'النازعات', englishName: 'An-Nazi\'at', translation: 'Les Anges Qui Arrachent', ayahs: 46, type: 'Mecquoise' },
  { number: 80, name: 'عبس', englishName: '\'Abasa', translation: 'Il S\'est Renfrogne', ayahs: 42, type: 'Mecquoise' },
  { number: 81, name: 'التكوير', englishName: 'At-Takwir', translation: 'L\'Obscurcissement', ayahs: 29, type: 'Mecquoise' },
  { number: 82, name: 'الانفطار', englishName: 'Al-Infitar', translation: 'La Rupture', ayahs: 19, type: 'Mecquoise' },
  { number: 83, name: 'المطففين', englishName: 'Al-Mutaffifin', translation: 'Les Fraudeurs', ayahs: 36, type: 'Mecquoise' },
  { number: 84, name: 'الانشقاق', englishName: 'Al-Inshiqaq', translation: 'La Dechirure', ayahs: 25, type: 'Mecquoise' },
  { number: 85, name: 'البروج', englishName: 'Al-Buruj', translation: 'Les Constellations', ayahs: 22, type: 'Mecquoise' },
  { number: 86, name: 'الطارق', englishName: 'At-Tariq', translation: 'L\'Astre Nocturne', ayahs: 17, type: 'Mecquoise' },
  { number: 87, name: 'الأعلى', englishName: 'Al-A\'la', translation: 'Le Tres-Haut', ayahs: 19, type: 'Mecquoise' },
  { number: 88, name: 'الغاشية', englishName: 'Al-Ghashiyah', translation: 'L\'Enveloppante', ayahs: 26, type: 'Mecquoise' },
  { number: 89, name: 'الفجر', englishName: 'Al-Fajr', translation: 'L\'Aube', ayahs: 30, type: 'Mecquoise' },
  { number: 90, name: 'البلد', englishName: 'Al-Balad', translation: 'La Cite', ayahs: 20, type: 'Mecquoise' },
  { number: 91, name: 'الشمس', englishName: 'Ash-Shams', translation: 'Le Soleil', ayahs: 15, type: 'Mecquoise' },
  { number: 92, name: 'الليل', englishName: 'Al-Layl', translation: 'La Nuit', ayahs: 21, type: 'Mecquoise' },
  { number: 93, name: 'الضحى', englishName: 'Ad-Duha', translation: 'Le Jour Montant', ayahs: 11, type: 'Mecquoise' },
  { number: 94, name: 'الشرح', englishName: 'Ash-Sharh', translation: 'L\'Ouverture', ayahs: 8, type: 'Mecquoise' },
  { number: 95, name: 'التين', englishName: 'At-Tin', translation: 'Le Figuier', ayahs: 8, type: 'Mecquoise' },
  { number: 96, name: 'العلق', englishName: 'Al-\'Alaq', translation: 'L\'Adherence', ayahs: 19, type: 'Mecquoise' },
  { number: 97, name: 'القدر', englishName: 'Al-Qadr', translation: 'La Destinee', ayahs: 5, type: 'Mecquoise' },
  { number: 98, name: 'البينة', englishName: 'Al-Bayyina', translation: 'La Preuve', ayahs: 8, type: 'Medinoise' },
  { number: 99, name: 'الزلزلة', englishName: 'Az-Zalzalah', translation: 'Le Tremblement de Terre', ayahs: 8, type: 'Medinoise' },
  { number: 100, name: 'العاديات', englishName: 'Al-\'Adiyat', translation: 'Les Coursiers', ayahs: 11, type: 'Mecquoise' },
  { number: 101, name: 'القارعة', englishName: 'Al-Qari\'a', translation: 'Le Fracas', ayahs: 11, type: 'Mecquoise' },
  { number: 102, name: 'التكاثر', englishName: 'At-Takathur', translation: 'La Course aux Richesses', ayahs: 8, type: 'Mecquoise' },
  { number: 103, name: 'العصر', englishName: 'Al-\'Asr', translation: 'Le Temps', ayahs: 3, type: 'Mecquoise' },
  { number: 104, name: 'الهمزة', englishName: 'Al-Humazah', translation: 'Le Calomniateur', ayahs: 9, type: 'Mecquoise' },
  { number: 105, name: 'الفيل', englishName: 'Al-Fil', translation: 'L\'Elephant', ayahs: 5, type: 'Mecquoise' },
  { number: 106, name: 'قريش', englishName: 'Quraysh', translation: 'Quraysh', ayahs: 4, type: 'Mecquoise' },
  { number: 107, name: 'الماعون', englishName: 'Al-Ma\'un', translation: 'L\'Ustensile', ayahs: 7, type: 'Mecquoise' },
  { number: 108, name: 'الكوثر', englishName: 'Al-Kawthar', translation: 'L\'Abondance', ayahs: 3, type: 'Mecquoise' },
  { number: 109, name: 'الكافرون', englishName: 'Al-Kafirun', translation: 'Les Infideles', ayahs: 6, type: 'Mecquoise' },
  { number: 110, name: 'النصر', englishName: 'An-Nasr', translation: 'Le Secours', ayahs: 3, type: 'Medinoise' },
  { number: 111, name: 'المسد', englishName: 'Al-Masad', translation: 'Les Fibres', ayahs: 5, type: 'Mecquoise' },
  { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', translation: 'Le Monotheisme Pur', ayahs: 4, type: 'Mecquoise' },
  { number: 113, name: 'الفلق', englishName: 'Al-Falaq', translation: 'L\'Aube Naissante', ayahs: 5, type: 'Mecquoise' },
  { number: 114, name: 'الناس', englishName: 'An-Nas', translation: 'Les Hommes', ayahs: 6, type: 'Mecquoise' },
];
