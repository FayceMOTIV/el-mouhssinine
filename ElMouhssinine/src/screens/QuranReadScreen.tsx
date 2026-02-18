import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  PanResponder,
  Animated,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius } from '../theme/colors';

// API Quran
const QURAN_API = 'https://api.alquran.cloud/v1';

// Info des sourates
const surahsInfo = [
  { number: 1, name: 'Al-Fatiha', nameAr: 'الفاتحة', startPage: 1 },
  { number: 2, name: 'Al-Baqarah', nameAr: 'البقرة', startPage: 2 },
  { number: 3, name: 'Aal-Imran', nameAr: 'آل عمران', startPage: 50 },
  { number: 4, name: 'An-Nisa', nameAr: 'النساء', startPage: 77 },
  { number: 5, name: 'Al-Ma\'idah', nameAr: 'المائدة', startPage: 106 },
  { number: 6, name: 'Al-An\'am', nameAr: 'الأنعام', startPage: 128 },
  { number: 7, name: 'Al-A\'raf', nameAr: 'الأعراف', startPage: 151 },
  { number: 8, name: 'Al-Anfal', nameAr: 'الأنفال', startPage: 177 },
  { number: 9, name: 'At-Tawbah', nameAr: 'التوبة', startPage: 187 },
  { number: 10, name: 'Yunus', nameAr: 'يونس', startPage: 208 },
  { number: 11, name: 'Hud', nameAr: 'هود', startPage: 221 },
  { number: 12, name: 'Yusuf', nameAr: 'يوسف', startPage: 235 },
  { number: 13, name: 'Ar-Ra\'d', nameAr: 'الرعد', startPage: 249 },
  { number: 14, name: 'Ibrahim', nameAr: 'إبراهيم', startPage: 255 },
  { number: 15, name: 'Al-Hijr', nameAr: 'الحجر', startPage: 262 },
  { number: 16, name: 'An-Nahl', nameAr: 'النحل', startPage: 267 },
  { number: 17, name: 'Al-Isra', nameAr: 'الإسراء', startPage: 282 },
  { number: 18, name: 'Al-Kahf', nameAr: 'الكهف', startPage: 293 },
  { number: 19, name: 'Maryam', nameAr: 'مريم', startPage: 305 },
  { number: 20, name: 'Ta-Ha', nameAr: 'طه', startPage: 312 },
  { number: 21, name: 'Al-Anbiya', nameAr: 'الأنبياء', startPage: 322 },
  { number: 22, name: 'Al-Hajj', nameAr: 'الحج', startPage: 332 },
  { number: 23, name: 'Al-Mu\'minun', nameAr: 'المؤمنون', startPage: 342 },
  { number: 24, name: 'An-Nur', nameAr: 'النور', startPage: 350 },
  { number: 25, name: 'Al-Furqan', nameAr: 'الفرقان', startPage: 359 },
  { number: 26, name: 'Ash-Shu\'ara', nameAr: 'الشعراء', startPage: 367 },
  { number: 27, name: 'An-Naml', nameAr: 'النمل', startPage: 377 },
  { number: 28, name: 'Al-Qasas', nameAr: 'القصص', startPage: 385 },
  { number: 29, name: 'Al-Ankabut', nameAr: 'العنكبوت', startPage: 396 },
  { number: 30, name: 'Ar-Rum', nameAr: 'الروم', startPage: 404 },
  { number: 31, name: 'Luqman', nameAr: 'لقمان', startPage: 411 },
  { number: 32, name: 'As-Sajdah', nameAr: 'السجدة', startPage: 415 },
  { number: 33, name: 'Al-Ahzab', nameAr: 'الأحزاب', startPage: 418 },
  { number: 34, name: 'Saba', nameAr: 'سبأ', startPage: 428 },
  { number: 35, name: 'Fatir', nameAr: 'فاطر', startPage: 434 },
  { number: 36, name: 'Ya-Sin', nameAr: 'يس', startPage: 440 },
  { number: 37, name: 'As-Saffat', nameAr: 'الصافات', startPage: 446 },
  { number: 38, name: 'Sad', nameAr: 'ص', startPage: 453 },
  { number: 39, name: 'Az-Zumar', nameAr: 'الزمر', startPage: 458 },
  { number: 40, name: 'Ghafir', nameAr: 'غافر', startPage: 467 },
  { number: 41, name: 'Fussilat', nameAr: 'فصلت', startPage: 477 },
  { number: 42, name: 'Ash-Shura', nameAr: 'الشورى', startPage: 483 },
  { number: 43, name: 'Az-Zukhruf', nameAr: 'الزخرف', startPage: 489 },
  { number: 44, name: 'Ad-Dukhan', nameAr: 'الدخان', startPage: 496 },
  { number: 45, name: 'Al-Jathiyah', nameAr: 'الجاثية', startPage: 499 },
  { number: 46, name: 'Al-Ahqaf', nameAr: 'الأحقاف', startPage: 502 },
  { number: 47, name: 'Muhammad', nameAr: 'محمد', startPage: 507 },
  { number: 48, name: 'Al-Fath', nameAr: 'الفتح', startPage: 511 },
  { number: 49, name: 'Al-Hujurat', nameAr: 'الحجرات', startPage: 515 },
  { number: 50, name: 'Qaf', nameAr: 'ق', startPage: 518 },
  { number: 51, name: 'Adh-Dhariyat', nameAr: 'الذاريات', startPage: 520 },
  { number: 52, name: 'At-Tur', nameAr: 'الطور', startPage: 523 },
  { number: 53, name: 'An-Najm', nameAr: 'النجم', startPage: 526 },
  { number: 54, name: 'Al-Qamar', nameAr: 'القمر', startPage: 528 },
  { number: 55, name: 'Ar-Rahman', nameAr: 'الرحمن', startPage: 531 },
  { number: 56, name: 'Al-Waqi\'ah', nameAr: 'الواقعة', startPage: 534 },
  { number: 57, name: 'Al-Hadid', nameAr: 'الحديد', startPage: 537 },
  { number: 58, name: 'Al-Mujadila', nameAr: 'المجادلة', startPage: 542 },
  { number: 59, name: 'Al-Hashr', nameAr: 'الحشر', startPage: 545 },
  { number: 60, name: 'Al-Mumtahanah', nameAr: 'الممتحنة', startPage: 549 },
  { number: 61, name: 'As-Saff', nameAr: 'الصف', startPage: 551 },
  { number: 62, name: 'Al-Jumu\'ah', nameAr: 'الجمعة', startPage: 553 },
  { number: 63, name: 'Al-Munafiqun', nameAr: 'المنافقون', startPage: 554 },
  { number: 64, name: 'At-Taghabun', nameAr: 'التغابن', startPage: 556 },
  { number: 65, name: 'At-Talaq', nameAr: 'الطلاق', startPage: 558 },
  { number: 66, name: 'At-Tahrim', nameAr: 'التحريم', startPage: 560 },
  { number: 67, name: 'Al-Mulk', nameAr: 'الملك', startPage: 562 },
  { number: 68, name: 'Al-Qalam', nameAr: 'القلم', startPage: 564 },
  { number: 69, name: 'Al-Haqqah', nameAr: 'الحاقة', startPage: 566 },
  { number: 70, name: 'Al-Ma\'arij', nameAr: 'المعارج', startPage: 568 },
  { number: 71, name: 'Nuh', nameAr: 'نوح', startPage: 570 },
  { number: 72, name: 'Al-Jinn', nameAr: 'الجن', startPage: 572 },
  { number: 73, name: 'Al-Muzzammil', nameAr: 'المزمل', startPage: 574 },
  { number: 74, name: 'Al-Muddaththir', nameAr: 'المدثر', startPage: 575 },
  { number: 75, name: 'Al-Qiyamah', nameAr: 'القيامة', startPage: 577 },
  { number: 76, name: 'Al-Insan', nameAr: 'الإنسان', startPage: 578 },
  { number: 77, name: 'Al-Mursalat', nameAr: 'المرسلات', startPage: 580 },
  { number: 78, name: 'An-Naba', nameAr: 'النبأ', startPage: 582 },
  { number: 79, name: 'An-Nazi\'at', nameAr: 'النازعات', startPage: 583 },
  { number: 80, name: 'Abasa', nameAr: 'عبس', startPage: 585 },
  { number: 81, name: 'At-Takwir', nameAr: 'التكوير', startPage: 586 },
  { number: 82, name: 'Al-Infitar', nameAr: 'الانفطار', startPage: 587 },
  { number: 83, name: 'Al-Mutaffifin', nameAr: 'المطففين', startPage: 587 },
  { number: 84, name: 'Al-Inshiqaq', nameAr: 'الانشقاق', startPage: 589 },
  { number: 85, name: 'Al-Buruj', nameAr: 'البروج', startPage: 590 },
  { number: 86, name: 'At-Tariq', nameAr: 'الطارق', startPage: 591 },
  { number: 87, name: 'Al-A\'la', nameAr: 'الأعلى', startPage: 591 },
  { number: 88, name: 'Al-Ghashiyah', nameAr: 'الغاشية', startPage: 592 },
  { number: 89, name: 'Al-Fajr', nameAr: 'الفجر', startPage: 593 },
  { number: 90, name: 'Al-Balad', nameAr: 'البلد', startPage: 594 },
  { number: 91, name: 'Ash-Shams', nameAr: 'الشمس', startPage: 595 },
  { number: 92, name: 'Al-Layl', nameAr: 'الليل', startPage: 595 },
  { number: 93, name: 'Ad-Duha', nameAr: 'الضحى', startPage: 596 },
  { number: 94, name: 'Ash-Sharh', nameAr: 'الشرح', startPage: 596 },
  { number: 95, name: 'At-Tin', nameAr: 'التين', startPage: 597 },
  { number: 96, name: 'Al-Alaq', nameAr: 'العلق', startPage: 597 },
  { number: 97, name: 'Al-Qadr', nameAr: 'القدر', startPage: 598 },
  { number: 98, name: 'Al-Bayyinah', nameAr: 'البينة', startPage: 598 },
  { number: 99, name: 'Az-Zalzalah', nameAr: 'الزلزلة', startPage: 599 },
  { number: 100, name: 'Al-Adiyat', nameAr: 'العاديات', startPage: 599 },
  { number: 101, name: 'Al-Qari\'ah', nameAr: 'القارعة', startPage: 600 },
  { number: 102, name: 'At-Takathur', nameAr: 'التكاثر', startPage: 600 },
  { number: 103, name: 'Al-Asr', nameAr: 'العصر', startPage: 601 },
  { number: 104, name: 'Al-Humazah', nameAr: 'الهمزة', startPage: 601 },
  { number: 105, name: 'Al-Fil', nameAr: 'الفيل', startPage: 601 },
  { number: 106, name: 'Quraysh', nameAr: 'قريش', startPage: 602 },
  { number: 107, name: 'Al-Ma\'un', nameAr: 'الماعون', startPage: 602 },
  { number: 108, name: 'Al-Kawthar', nameAr: 'الكوثر', startPage: 602 },
  { number: 109, name: 'Al-Kafirun', nameAr: 'الكافرون', startPage: 603 },
  { number: 110, name: 'An-Nasr', nameAr: 'النصر', startPage: 603 },
  { number: 111, name: 'Al-Masad', nameAr: 'المسد', startPage: 603 },
  { number: 112, name: 'Al-Ikhlas', nameAr: 'الإخلاص', startPage: 604 },
  { number: 113, name: 'Al-Falaq', nameAr: 'الفلق', startPage: 604 },
  { number: 114, name: 'An-Nas', nameAr: 'الناس', startPage: 604 },
];

// Juz info
const juzInfo = Array.from({ length: 30 }, (_, i) => ({
  number: i + 1,
  name: `Juz ${i + 1}`,
  startPage: Math.floor(1 + (i * 604) / 30),
}));

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  surah: { number: number; name: string; englishName: string };
}

const STORAGE_KEY_PAGE = '@quran_current_page';
const STORAGE_KEY_BOOKMARKS = '@quran_bookmarks';
const STORAGE_KEY_LANG = '@quran_language';
const STORAGE_KEY_FONTSIZE = '@quran_fontsize';
const TOTAL_PAGES = 604;
const MIN_FONT_SIZE = 18;
const MAX_FONT_SIZE = 36;
const DEFAULT_FONT_SIZE = 24;

const QuranReadScreen: React.FC = () => {
  const navigation = useNavigation();
  const [currentPage, setCurrentPage] = useState(1);
  const [arabicAyahs, setArabicAyahs] = useState<Ayah[]>([]);
  const [frenchAyahs, setFrenchAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArabic, setShowArabic] = useState(true);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);
  const [searchTab, setSearchTab] = useState<'surah' | 'page' | 'juz'>('surah');
  const [pageInput, setPageInput] = useState('');
  const [textFontSize, setTextFontSize] = useState(DEFAULT_FONT_SIZE);

  const isMountedRef = useRef(true);
  const translateX = useRef(new Animated.Value(0)).current;

  // Masquer la tab bar quand cet écran est affiché
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({ tabBarStyle: { display: 'none' } });
    }
    return () => {
      if (parent) {
        parent.setOptions({
          tabBarStyle: {
            backgroundColor: colors.accentDark,
            height: 90,
            paddingBottom: 25,
            paddingTop: 10,
            borderTopWidth: 0,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          },
        });
      }
    };
  }, [navigation]);

  // Charger la page sauvegardée et les favoris
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const [savedPage, savedBookmarks, savedLang, savedFontSize] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_PAGE),
          AsyncStorage.getItem(STORAGE_KEY_BOOKMARKS),
          AsyncStorage.getItem(STORAGE_KEY_LANG),
          AsyncStorage.getItem(STORAGE_KEY_FONTSIZE),
        ]);

        if (savedPage) setCurrentPage(parseInt(savedPage, 10));
        if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
        if (savedLang) setShowArabic(savedLang === 'ar');
        if (savedFontSize) setTextFontSize(parseInt(savedFontSize, 10));
      } catch (e) {
        console.error('Erreur chargement données:', e);
      }
    };
    loadSavedData();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Sauvegarder la page courante
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_PAGE, currentPage.toString());
  }, [currentPage]);

  // Sauvegarder les favoris
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(bookmarks));
  }, [bookmarks]);

  // Sauvegarder la langue
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_LANG, showArabic ? 'ar' : 'fr');
  }, [showArabic]);

  // Sauvegarder la taille de police
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_FONTSIZE, textFontSize.toString());
  }, [textFontSize]);

  // Augmenter la taille de police
  const increaseFontSize = () => {
    setTextFontSize(prev => Math.min(prev + 2, MAX_FONT_SIZE));
  };

  // Diminuer la taille de police
  const decreaseFontSize = () => {
    setTextFontSize(prev => Math.max(prev - 2, MIN_FONT_SIZE));
  };

  // Clé de cache pour une page
  const getCacheKey = (page: number) => `@quran_page_${page}`;

  // Charger une page (avec cache offline)
  const loadPage = useCallback(async (page: number) => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Vérifier le cache local d'abord
      const cacheKey = getCacheKey(page);
      const cached = await AsyncStorage.getItem(cacheKey);

      if (cached) {
        try {
          const { arabic, french } = JSON.parse(cached);
          // Valider que le cache contient des données valides
          if (Array.isArray(arabic) && arabic.length > 0 &&
              Array.isArray(french) && french.length > 0) {
            if (!isMountedRef.current) return;
            setArabicAyahs(arabic);
            setFrenchAyahs(french);
            setLoading(false);
            return; // Cache hit, pas besoin de fetch
          }
        } catch {
          // Cache corrompu, continuer avec le fetch
          await AsyncStorage.removeItem(cacheKey);
        }
      }

      // 2. Pas de cache valide, fetch depuis l'API
      const [arResponse, frResponse] = await Promise.all([
        fetch(`${QURAN_API}/page/${page}/ar.alafasy`),
        fetch(`${QURAN_API}/page/${page}/fr.hamidullah`),
      ]);

      if (!arResponse.ok || !frResponse.ok) {
        throw new Error('Erreur API');
      }

      const [arData, frData] = await Promise.all([
        arResponse.json(),
        frResponse.json(),
      ]);

      if (!isMountedRef.current) return;

      if (arData.data?.ayahs && frData.data?.ayahs) {
        setArabicAyahs(arData.data.ayahs);
        setFrenchAyahs(frData.data.ayahs);

        // 3. Sauvegarder dans le cache pour utilisation offline
        const cacheData = {
          arabic: arData.data.ayahs,
          french: frData.data.ayahs,
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } else {
        throw new Error('Données invalides');
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      if (__DEV__) console.error('Erreur chargement page:', e);
      setError('Impossible de charger cette page. Vérifiez votre connexion.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadPage(currentPage);
  }, [currentPage, loadPage]);

  // Navigation
  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < TOTAL_PAGES) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage]);

  // Gestion des swipes (style Mushaf / livre arabe)
  // Dans un Mushaf, on tourne les pages de droite à gauche pour avancer
  // Swipe gauche = page suivante, Swipe droite = page précédente
  // NOTE: Ne pas bloquer le scroll vertical (permet de lire les longues pages)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Ne pas capturer au touch initial
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Capturer SEULEMENT si swipe horizontal significatif ET > vertical
        // Cela permet au ScrollView de gérer le scroll vertical normalement
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        return isHorizontalSwipe && Math.abs(gestureState.dx) > 30;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -100 && currentPage < TOTAL_PAGES) {
          // Swipe gauche = page suivante (comme tourner une page de Mushaf)
          Animated.timing(translateX, {
            toValue: -300,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setCurrentPage(prev => prev + 1);
            translateX.setValue(0);
          });
        } else if (gestureState.dx > 100 && currentPage > 1) {
          // Swipe droite = page précédente (retour en arrière)
          Animated.timing(translateX, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setCurrentPage(prev => prev - 1);
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Bookmarks
  const toggleBookmark = () => {
    if (bookmarks.includes(currentPage)) {
      setBookmarks(bookmarks.filter(p => p !== currentPage));
    } else {
      setBookmarks([...bookmarks, currentPage].sort((a, b) => a - b));
    }
  };

  const isBookmarked = bookmarks.includes(currentPage);

  // Trouver la sourate courante
  const getCurrentSurah = () => {
    for (let i = surahsInfo.length - 1; i >= 0; i--) {
      if (surahsInfo[i].startPage <= currentPage) {
        return surahsInfo[i];
      }
    }
    return surahsInfo[0];
  };

  const currentSurah = getCurrentSurah();
  const ayahs = showArabic ? arabicAyahs : frenchAyahs;

  // Rendu des ayahs
  const renderAyahs = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPage(currentPage)}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!ayahs || ayahs.length === 0) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Aucun contenu disponible</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.pageContent}>
          {/* Bismillah pour début de sourate */}
          {ayahs[0]?.numberInSurah === 1 && ayahs[0]?.surah?.number !== 9 && ayahs[0]?.surah?.number !== 1 && (
            <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          )}

          {/* Nom de la sourate si début */}
          {ayahs[0]?.numberInSurah === 1 && (
            <View style={styles.surahHeader}>
              <Text style={styles.surahName}>{currentSurah.nameAr}</Text>
              <Text style={styles.surahNameLatin}>{currentSurah.name}</Text>
            </View>
          )}

          {/* Ayahs */}
          <Text style={[
            styles.ayahsText,
            showArabic && styles.arabicText,
            { fontSize: textFontSize, lineHeight: textFontSize * (showArabic ? 2 : 1.8) }
          ]}>
            {ayahs.map((ayah, index) => (
              <Text key={index}>
                {ayah.text}
                <Text style={[styles.ayahNumber, { fontSize: textFontSize * 0.6 }]}> ﴿{ayah.numberInSurah}﴾ </Text>
              </Text>
            ))}
          </Text>
        </View>
      </ScrollView>
    );
  };

  // Modal de recherche
  const renderSearchModal = () => (
    <Modal visible={showSearchModal} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aller à...</Text>
              <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              {(['surah', 'page', 'juz'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, searchTab === tab && styles.activeTab]}
                  onPress={() => setSearchTab(tab)}
                >
                  <Text style={[styles.tabText, searchTab === tab && styles.activeTabText]}>
                    {tab === 'surah' ? 'Sourate' : tab === 'page' ? 'Page' : 'Juz'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Contenu selon le tab */}
            {searchTab === 'surah' && (
              <FlatList
                data={surahsInfo}
                keyExtractor={item => item.number.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                      setCurrentPage(item.startPage);
                      setShowSearchModal(false);
                    }}
                  >
                    <Text style={styles.listItemNumber}>{item.number}</Text>
                    <View style={styles.listItemText}>
                      <Text style={styles.listItemTitle}>{item.nameAr}</Text>
                      <Text style={styles.listItemSubtitle}>{item.name} - Page {item.startPage}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
              />
            )}

            {searchTab === 'page' && (
              <View style={styles.pageInputContainer}>
                <Text style={styles.pageInputLabel}>Numéro de page (1-604)</Text>
                <TextInput
                  style={styles.pageInput}
                  keyboardType="number-pad"
                  value={pageInput}
                  onChangeText={setPageInput}
                  placeholder="Ex: 255"
                  placeholderTextColor="#999999"
                  maxLength={3}
                  returnKeyType="go"
                  onSubmitEditing={() => {
                    const page = parseInt(pageInput, 10);
                    if (page >= 1 && page <= TOTAL_PAGES) {
                      Keyboard.dismiss();
                      setCurrentPage(page);
                      setShowSearchModal(false);
                      setPageInput('');
                    }
                  }}
                />
                <TouchableOpacity
                  style={[
                    styles.goButton,
                    (!pageInput || parseInt(pageInput, 10) < 1 || parseInt(pageInput, 10) > TOTAL_PAGES) && styles.goButtonDisabled
                  ]}
                  onPress={() => {
                    const page = parseInt(pageInput, 10);
                    if (page >= 1 && page <= TOTAL_PAGES) {
                      Keyboard.dismiss();
                      setCurrentPage(page);
                      setShowSearchModal(false);
                      setPageInput('');
                    }
                  }}
                  disabled={!pageInput || parseInt(pageInput, 10) < 1 || parseInt(pageInput, 10) > TOTAL_PAGES}
                >
                  <Text style={styles.goButtonText}>Aller à la page</Text>
                </TouchableOpacity>
                {pageInput && (parseInt(pageInput, 10) < 1 || parseInt(pageInput, 10) > TOTAL_PAGES) && (
                  <Text style={styles.pageInputError}>Page invalide (1-604)</Text>
                )}
              </View>
            )}

            {searchTab === 'juz' && (
              <FlatList
                data={juzInfo}
                keyExtractor={item => item.number.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                      setCurrentPage(item.startPage);
                      setShowSearchModal(false);
                    }}
                  >
                    <Text style={styles.listItemNumber}>{item.number}</Text>
                    <View style={styles.listItemText}>
                      <Text style={styles.listItemTitle}>Juz' {item.number}</Text>
                      <Text style={styles.listItemSubtitle}>Page {item.startPage}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // Modal des favoris
  const renderBookmarksModal = () => (
    <Modal visible={showBookmarksModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📖 Mes pages sauvegardées</Text>
            <TouchableOpacity onPress={() => setShowBookmarksModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {bookmarks.length === 0 ? (
            <View style={styles.emptyBookmarks}>
              <Text style={styles.emptyBookmarksText}>Aucune page sauvegardée</Text>
              <Text style={styles.emptyBookmarksHint}>
                Appuyez sur "Sauver" en haut pour mémoriser une page
              </Text>
            </View>
          ) : (
            <FlatList
              data={bookmarks}
              keyExtractor={item => item.toString()}
              renderItem={({ item }) => {
                const surah = surahsInfo.find(s => s.startPage <= item) || surahsInfo[0];
                return (
                  <TouchableOpacity
                    style={styles.bookmarkItem}
                    onPress={() => {
                      setCurrentPage(item);
                      setShowBookmarksModal(false);
                    }}
                  >
                    <View>
                      <Text style={styles.bookmarkPage}>Page {item}</Text>
                      <Text style={styles.bookmarkSurah}>{surah.nameAr} - {surah.name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setBookmarks(bookmarks.filter(b => b !== item))}
                      style={styles.deleteBookmark}
                    >
                      <Text style={styles.deleteBookmarkText}>🗑️</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
              style={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* Bouton retour */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.surahTitle}>{currentSurah.nameAr}</Text>
            <Text style={styles.pageNumber}>Page {currentPage} / {TOTAL_PAGES}</Text>
          </View>

          {/* Marque-page avec label */}
          <TouchableOpacity onPress={toggleBookmark} style={styles.bookmarkButton}>
            <Text style={styles.bookmarkIcon}>{isBookmarked ? '🔖' : '📑'}</Text>
            <Text style={styles.bookmarkLabel}>{isBookmarked ? 'Sauvé' : 'Sauver'}</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(currentPage / TOTAL_PAGES) * 100}%` }]} />
        </View>
      </View>

      {/* Contenu */}
      <Animated.View
        style={[styles.content, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {renderAyahs()}
      </Animated.View>

      {/* Footer - Barre de navigation */}
      <View style={styles.footer}>
        {/* Flèche précédent */}
        <TouchableOpacity
          style={[styles.navArrow, currentPage === 1 && styles.navArrowDisabled]}
          onPress={goToPrevPage}
          disabled={currentPage === 1}
        >
          <Text style={[styles.navArrowText, currentPage === 1 && styles.navArrowTextDisabled]}>◀</Text>
        </TouchableOpacity>

        {/* Mes marque-pages */}
        <TouchableOpacity style={styles.footerButton} onPress={() => setShowBookmarksModal(true)}>
          <Text style={styles.footerButtonIcon}>🔖</Text>
          <Text style={styles.footerButtonLabel}>Mes pages</Text>
        </TouchableOpacity>

        {/* Recherche */}
        <TouchableOpacity style={styles.footerButton} onPress={() => setShowSearchModal(true)}>
          <Text style={styles.footerButtonIcon}>🔍</Text>
          <Text style={styles.footerButtonLabel}>Recherche</Text>
        </TouchableOpacity>

        {/* Taille de police */}
        <View style={styles.fontSizeControls}>
          <TouchableOpacity
            style={[styles.fontSizeBtn, textFontSize <= MIN_FONT_SIZE && styles.fontSizeBtnDisabled]}
            onPress={decreaseFontSize}
            disabled={textFontSize <= MIN_FONT_SIZE}
          >
            <Text style={styles.fontSizeBtnText}>A-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fontSizeBtn, textFontSize >= MAX_FONT_SIZE && styles.fontSizeBtnDisabled]}
            onPress={increaseFontSize}
            disabled={textFontSize >= MAX_FONT_SIZE}
          >
            <Text style={styles.fontSizeBtnText}>A+</Text>
          </TouchableOpacity>
        </View>

        {/* Toggle Langue */}
        <TouchableOpacity
          style={[styles.footerButton, styles.langToggle, !showArabic && styles.langToggleFr]}
          onPress={() => setShowArabic(!showArabic)}
        >
          <Text style={styles.footerButtonIcon}>{showArabic ? 'ع' : 'Fr'}</Text>
          <Text style={styles.footerButtonLabel}>{showArabic ? 'Arabe' : 'Français'}</Text>
        </TouchableOpacity>

        {/* Flèche suivant */}
        <TouchableOpacity
          style={[styles.navArrow, currentPage === TOTAL_PAGES && styles.navArrowDisabled]}
          onPress={goToNextPage}
          disabled={currentPage === TOTAL_PAGES}
        >
          <Text style={[styles.navArrowText, currentPage === TOTAL_PAGES && styles.navArrowTextDisabled]}>▶</Text>
        </TouchableOpacity>
      </View>

      {renderSearchModal()}
      {renderBookmarksModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 24,
    color: colors.accent,
  },
  bookmarkButton: {
    alignItems: 'center',
    padding: 6,
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
    borderRadius: 8,
    minWidth: 50,
  },
  bookmarkIcon: {
    fontSize: 18,
  },
  bookmarkLabel: {
    fontSize: 9,
    color: colors.accent,
    marginTop: 2,
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
  },
  surahTitle: {
    fontSize: 20,
    color: colors.accent,
    fontWeight: 'bold',
  },
  pageNumber: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    backgroundColor: '#FDF5E6',
    margin: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  pageContent: {
    minHeight: '100%',
  },
  bismillah: {
    fontSize: 24,
    textAlign: 'center',
    color: colors.primary,
    marginBottom: 16,
    fontFamily: 'System',
  },
  surahHeader: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
  surahName: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: 'bold',
  },
  surahNameLatin: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  ayahsText: {
    fontSize: 18,
    lineHeight: 32,
    color: colors.text,
    textAlign: 'justify',
  },
  arabicText: {
    fontSize: 24,
    lineHeight: 48,
    textAlign: 'right',
    fontFamily: 'System',
  },
  ayahNumber: {
    fontSize: 14,
    color: colors.accent,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,162,39,0.3)',
  },
  navArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowDisabled: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  navArrowText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navArrowTextDisabled: {
    color: 'rgba(0,0,0,0.3)',
  },
  footerButton: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  footerButtonIcon: {
    fontSize: 20,
    color: colors.text,
  },
  footerButtonLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  langToggle: {
    backgroundColor: 'rgba(201,162,39,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  langToggleFr: {
    backgroundColor: 'rgba(52,152,219,0.2)',
  },
  fontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fontSizeBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  fontSizeBtnDisabled: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  fontSizeBtnText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '40%',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    fontSize: 24,
    color: colors.textMuted,
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.accent,
    fontWeight: 'bold',
  },
  list: {
    maxHeight: 500,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 40,
    fontWeight: 'bold',
    marginRight: 12,
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '500',
  },
  listItemSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  pageInputContainer: {
    padding: 20,
    alignItems: 'center',
  },
  pageInputLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
  },
  pageInput: {
    width: '100%',
    height: 50,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 22,
    textAlign: 'center',
    color: '#1a1a2e',
    backgroundColor: '#ffffff',
    fontWeight: '600',
  },
  goButton: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 180,
  },
  goButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  goButtonText: {
    color: '#1a1a2e',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  pageInputError: {
    marginTop: 8,
    color: '#e74c3c',
    fontSize: 13,
  },
  emptyBookmarks: {
    padding: 40,
    alignItems: 'center',
  },
  emptyBookmarksText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  emptyBookmarksHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  bookmarkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bookmarkPage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  bookmarkSurah: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  deleteBookmark: {
    padding: 8,
  },
  deleteBookmarkText: {
    fontSize: 18,
  },
});

export default QuranReadScreen;
