import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
  LayoutChangeEvent,
  ScrollView,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { QuranAPI, surahsInfo, reciters, SurahData, Reciter } from '../services/quranApi';

import { useLanguage } from '../context/LanguageContext';
import { useQuranPlayer, RepeatMode, PlaybackSpeed } from '../hooks/useQuranPlayer';
import { QuranVerse } from '../components/QuranVerse';
import { QuranMiniPlayer } from '../components/QuranMiniPlayer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Cache en mémoire (reset à chaque session app)
const surahCache = new Map<number, any>();

interface SurahScreenProps {
  route: any;
  navigation: any;
}

interface Verse {
  number: number;
  numberInSurah: number;
  text: string;
  translation?: string;
}

const SurahScreen: React.FC<SurahScreenProps> = ({ route, navigation }) => {
  const { t, isRTL } = useLanguage();
  const surahNumber = route.params?.surahNumber ?? 1; // Fallback sourate Al-Fatiha si params manquant
  const [loading, setLoading] = useState(true);
  const [surahData, setSurahData] = useState<{
    arabic: SurahData;
    translation: SurahData;
  } | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showReciterModal, setShowReciterModal] = useState(false);
  const [selectedReciter, setSelectedReciter] = useState(reciters[0]);
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const verseLayoutsRef = useRef<{ [key: number]: { y: number; height: number } }>({});

  const surahInfo = surahsInfo.find((s) => s.number === surahNumber);
  const FAVORITES_KEY = '@quran_favorites';

  // Préparer les versets pour le hook
  const verses: Verse[] = React.useMemo(() => {
    if (!surahData?.arabic?.ayahs) return [];
    return surahData.arabic.ayahs.map((ayah, index) => ({
      number: ayah.number,
      numberInSurah: ayah.numberInSurah,
      text: ayah.text,
      translation: surahData.translation?.ayahs?.[index]?.text,
    }));
  }, [surahData]);

  // Hook de lecture Karaoke
  const player = useQuranPlayer({
    verses,
    reciterCode: selectedReciter.id,
    surahNumber,
    surahName: surahInfo?.englishName,
    onVerseChange: (index) => {
      scrollToVerse(index);
    },
  });

  // Scroll vers un verset
  const scrollToVerse = useCallback((index: number) => {
    if (flatListRef.current && index >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.3,
        });
      }, 100);
    }
  }, []);

  // Charger les favoris
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const stored = await AsyncStorage.getItem(FAVORITES_KEY);
        if (stored) {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) {
            setFavorites(new Set(arr));
          }
        }
      } catch (e) {
        if (__DEV__) console.error('Erreur chargement favoris:', e);
      }
    };
    loadFavorites();
  }, []);

  // Toggle favori
  const handleToggleFavorite = async (ayahNumber: number) => {
    const key = `${surahNumber}:${ayahNumber}`;
    const newFavorites = new Set(favorites);

    if (newFavorites.has(key)) {
      newFavorites.delete(key);
    } else {
      newFavorites.add(key);
    }

    setFavorites(newFavorites);

    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...newFavorites]));
    } catch (e) {
      if (__DEV__) console.error('Erreur sauvegarde favoris:', e);
    }
  };

  // Copier le verset
  const handleCopyAyah = (ayahNumber: number) => {
    const ayah = surahData?.arabic.ayahs[ayahNumber - 1];
    const translationText = surahData?.translation.ayahs[ayahNumber - 1];

    if (ayah) {
      const textToCopy = `${ayah.text}\n\n${translationText?.text || ''}\n\n— ${t('surah')} ${surahInfo?.englishName}, ${t('verse')} ${ayahNumber}`;
      Clipboard.setString(textToCopy);
      Alert.alert(t('copied') as string, t('verseCopied') as string);
    }
  };

  const isFavorite = (ayahNumber: number) => favorites.has(`${surahNumber}:${ayahNumber}`);

  const handleAyahPress = (ayahNumber: number) => {
    setSelectedAyah(selectedAyah === ayahNumber ? null : ayahNumber);
  };

  // Lecture d'un verset spécifique
  const handlePlayVerse = async (index: number) => {
    if (!verses.length) return;
    console.log('[SurahScreen] handlePlayVerse:', index);
    setShowMiniPlayer(true);
    try {
      await player.playVerseAtIndex(index);
    } catch (error) {
      console.error('[SurahScreen] Erreur lecture verset:', error);
      Alert.alert('Erreur', 'Impossible de lire ce verset. Vérifiez votre connexion.');
    }
  };

  const handlePreviousSurah = useCallback(() => {
    if (surahNumber > 1) {
      player.stop();
      navigation.replace('Surah', { surahNumber: surahNumber - 1 });
    }
  }, [surahNumber, navigation, player]);

  const handleNextSurah = useCallback(() => {
    if (surahNumber < 114) {
      player.stop();
      navigation.replace('Surah', { surahNumber: surahNumber + 1 });
    }
  }, [surahNumber, navigation, player]);

  // Gestion du layout des versets
  const handleVerseLayout = useCallback((event: LayoutChangeEvent, index: number) => {
    const { y, height } = event.nativeEvent.layout;
    verseLayoutsRef.current[index] = { y, height };
  }, []);

  // Render verset avec le composant QuranVerse
  const renderAyah = useCallback(({ item: ayah, index }: { item: any; index: number }) => {
    const translation = surahData?.translation?.ayahs?.[index];
    const isSelected = selectedAyah === ayah.numberInSurah;
    const isActive = player.currentVerseIndex === index;

    return (
      <View>
        <QuranVerse
          verse={{
            number: ayah.number,
            numberInSurah: ayah.numberInSurah,
            text: ayah.text,
            translation: translation?.text,
          }}
          index={index}
          isActive={isActive}
          isPlaying={player.isPlaying}
          showTranslation={showTranslation}
          onPress={() => {
            handleAyahPress(ayah.numberInSurah);
            // Toujours lancer la lecture au clic sur un verset
            handlePlayVerse(index);
          }}
          onLayout={(event) => handleVerseLayout(event, index)}
        />

        {/* Actions sur le verset quand sélectionné */}
        {isSelected && (
          <View style={[styles.ayahActions, isRTL && styles.ayahActionsRTL]}>
            <TouchableOpacity
              style={[styles.ayahActionButton, isActive && styles.ayahActionButtonActive]}
              onPress={() => handlePlayVerse(index)}
            >
              <Text style={styles.ayahActionIcon}>
                {isActive && player.isPlaying ? '⏸️' : '▶️'}
              </Text>
              <Text style={styles.ayahActionText}>
                {isActive && player.isPlaying ? t('pauseVerse') : t('playVerse')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ayahActionButton, isFavorite(ayah.numberInSurah) && styles.ayahActionButtonActive]}
              onPress={() => handleToggleFavorite(ayah.numberInSurah)}
            >
              <Text style={styles.ayahActionIcon}>{isFavorite(ayah.numberInSurah) ? '❤️' : '🤍'}</Text>
              <Text style={styles.ayahActionText}>
                {isFavorite(ayah.numberInSurah) ? t('removeFromFavorites') : t('addToFavorites')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ayahActionButton}
              onPress={() => handleCopyAyah(ayah.numberInSurah)}
            >
              <Text style={styles.ayahActionIcon}>📋</Text>
              <Text style={styles.ayahActionText}>{t('copyVerse')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [surahData?.translation?.ayahs, selectedAyah, player.currentVerseIndex, player.isPlaying, showTranslation, favorites, t, isRTL]);

  const ListHeaderComponent = useCallback(() => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
          onPress={() => {
            player.stop();
            navigation.goBack();
          }}
        >
          <Text style={[styles.backButtonText, isRTL && styles.rtlText]}>
            {isRTL ? `${t('back')} ←` : `← ${t('back')}`}
          </Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.surahNumber, isRTL && styles.rtlText]}>{t('surah')} {surahNumber}</Text>
          <Text style={styles.surahArabicName}>{surahInfo?.name}</Text>
          <Text style={[styles.surahEnglishName, isRTL && styles.rtlText]}>{surahInfo?.englishName}</Text>
          <Text style={[styles.surahTranslation, isRTL && styles.rtlText]}>{surahInfo?.translation}</Text>
          <View style={[styles.surahMeta, isRTL && styles.surahMetaRTL]}>
            <Text style={styles.metaText}>{surahInfo?.ayahs} {t('verses')}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>
              {surahInfo?.type === 'Mecquoise' ? t('meccan') : t('medinan')}
            </Text>
          </View>
        </View>
      </View>

      {/* Options */}
      <View style={[styles.optionsBar, isRTL && styles.optionsBarRTL]}>
        <TouchableOpacity
          style={[styles.optionButton, showTranslation && styles.optionButtonActive, isRTL && styles.optionButtonRTL]}
          onPress={() => setShowTranslation(!showTranslation)}
        >
          <Text style={styles.optionIcon}>📖</Text>
          <Text style={[styles.optionText, showTranslation && styles.optionTextActive]}>
            {t('translation')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.optionButton, isRTL && styles.optionButtonRTL]}
          onPress={() => setShowReciterModal(true)}
        >
          <Text style={styles.optionIcon}>🎧</Text>
          <Text style={styles.optionText}>{t('reciter')}</Text>
        </TouchableOpacity>
      </View>

      {/* Lecteur Karaoke Pro */}
      <View style={[styles.karaokePlayer, isRTL && styles.karaokePlayerRTL]}>
        <TouchableOpacity
          style={[styles.mainPlayButton, (!verses.length || !player.isInitialized) && { opacity: 0.4 }]}
          disabled={!verses.length || !player.isInitialized}
          onPress={async () => {
            if (!verses.length) return;
            setShowMiniPlayer(true);
            await player.togglePlayPause();
          }}
        >
          <Text style={styles.mainPlayIcon}>
            {!player.isInitialized ? '⏳' : player.isLoading ? '⏳' : player.isPlaying ? '⏸️' : '▶️'}
          </Text>
        </TouchableOpacity>

        <View style={styles.playerMainInfo}>
          <Text style={[styles.playerTitle, isRTL && styles.rtlText]}>
            {t('listenWithKaraoke') || 'Mode Karaoke'}
          </Text>
          <Text style={[styles.playerSubtitle, isRTL && styles.rtlText]}>
            {selectedReciter.name} • {selectedReciter.nameAr}
          </Text>
          <Text style={[styles.playerHint, isRTL && styles.rtlText]}>
            {t('karaokeHint') || 'Cliquez sur un verset pour commencer'}
          </Text>
        </View>

        {/* Options rapides */}
        <View style={styles.quickOptions}>
          <TouchableOpacity
            style={styles.quickOptionButton}
            onPress={player.cycleRepeatMode}
          >
            <Text style={styles.quickOptionIcon}>
              {player.repeatMode === 'verse' ? '🔂' : player.repeatMode === 'surah' ? '🔁' : '➡️'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickOptionButton}
            onPress={() => player.changeSpeed()}
          >
            <Text style={styles.speedBadge}>{player.playbackSpeed}x</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bismillah */}
      {surahNumber !== 9 && surahNumber !== 1 && (
        <View style={styles.bismillahContainer}>
          <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          {showTranslation && !isRTL && (
            <Text style={styles.bismillahTranslation}>
              {t('bismillahTranslation')}
            </Text>
          )}
        </View>
      )}
    </>
  ), [isRTL, t, surahNumber, surahInfo, showTranslation, selectedReciter, player, navigation]);

  const ListFooterComponent = useCallback(() => (
    <View style={[styles.navigationContainer, isRTL && styles.navigationContainerRTL]}>
      <TouchableOpacity
        style={[styles.navButton, surahNumber === 1 && styles.navButtonDisabled]}
        onPress={handlePreviousSurah}
        disabled={surahNumber === 1}
      >
        <Text style={[styles.navButtonText, isRTL && styles.rtlText]}>
          {isRTL ? `${t('previousSurah')} →` : `← ${t('previousSurah')}`}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.navButton, surahNumber === 114 && styles.navButtonDisabled]}
        onPress={handleNextSurah}
        disabled={surahNumber === 114}
      >
        <Text style={[styles.navButtonText, isRTL && styles.rtlText]}>
          {isRTL ? `← ${t('nextSurah')}` : `${t('nextSurah')} →`}
        </Text>
      </TouchableOpacity>
    </View>
  ), [isRTL, t, surahNumber, handlePreviousSurah, handleNextSurah]);

  const keyExtractor = useCallback((item: any) => item.numberInSurah.toString(), []);

  // Gestion des erreurs de scroll
  const onScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: true,
        viewPosition: 0.3,
      });
    }, 500);
  }, []);

  // Chargement de la sourate
  const loadSurah = async () => {
    try {
      setLoading(true);

      // Vérifier le cache
      if (surahCache.has(surahNumber)) {
        setSurahData(surahCache.get(surahNumber));
        setLoading(false);
        return;
      }

      // Charger depuis l'API
      const data = await QuranAPI.getSurahFull(surahNumber);
      const surahFullData = {
        arabic: data.arabic,
        translation: data.translation,
      };

      // Mettre en cache
      surahCache.set(surahNumber, surahFullData);
      setSurahData(surahFullData);
    } catch (error) {
      if (__DEV__) console.error('Erreur chargement sourate:', error);
      Alert.alert(
        t('error') as string,
        t('errorLoadingSurah') as string,
        [
          { text: t('retry') as string, onPress: () => loadSurah() },
          { text: t('back') as string, onPress: () => navigation.goBack() },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurah();
  }, [surahNumber]);

  // Cleanup - utiliser player.stop() au lieu de stopAudio() pour respecter les flags internes
  useEffect(() => {
    return () => {
      player.stop();
    };
  }, []);

  // Afficher le mini player quand la lecture commence
  useEffect(() => {
    if (player.isPlaying || player.isLoading) {
      setShowMiniPlayer(true);
    }
  }, [player.isPlaying, player.isLoading]);

  // Cacher la tabBar quand le mini player est visible
  useEffect(() => {
    // setOptions sur tous les niveaux de parents pour cibler le Tab.Navigator
    const parents = [navigation.getParent(), navigation.getParent()?.getParent()].filter(Boolean);
    const defaultTabBarStyle = {
      backgroundColor: colors.accentDark,
      height: 90,
      paddingBottom: 25,
      paddingTop: 10,
      borderTopWidth: 0,
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row' as const,
    };

    parents.forEach(parent => {
      if (showMiniPlayer) {
        parent?.setOptions({
          tabBarStyle: { display: 'none' as const },
        });
      } else {
        parent?.setOptions({
          tabBarStyle: defaultTabBarStyle,
        });
      }
    });

    // Restaurer la tabBar quand on quitte l'écran
    return () => {
      parents.forEach(parent => {
        parent?.setOptions({
          tabBarStyle: defaultTabBarStyle,
        });
      });
    };
  }, [showMiniPlayer, navigation]);

  if (!surahNumber) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, marginBottom: spacing.md }}>
          {t('error') || 'Erreur'}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.accent, fontSize: fontSize.md }}>← {t('back') || 'Retour'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, isRTL && styles.rtlText]}>{t('loadingSurah')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={surahData?.arabic?.ayahs || []}
        renderItem={renderAyah}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          showMiniPlayer && { paddingBottom: 180 }
        ]}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={false}
        onScrollToIndexFailed={onScrollToIndexFailed}
        getItemLayout={(data, index) => ({
          length: showTranslation ? 220 : 150,
          offset: (showTranslation ? 220 : 150) * index + 450,
          index,
        })}
      />

      {/* Mini Player flottant */}
      {showMiniPlayer && verses.length > 0 && (
        <QuranMiniPlayer
          surahName={surahInfo?.englishName || ''}
          surahNameAr={surahInfo?.name}
          currentVerse={player.currentVerseIndex}
          totalVerses={verses.length}
          isPlaying={player.isPlaying}
          isLoading={player.isLoading}
          repeatMode={player.repeatMode}
          repeatCount={player.repeatCount}
          maxRepeat={player.maxRepeat}
          playbackSpeed={player.playbackSpeed}
          verseProgress={player.verseProgress}
          onPlayPause={player.togglePlayPause}
          onPrevious={player.previousVerse}
          onNext={player.nextVerse}
          onRepeatToggle={player.cycleRepeatMode}
          onSpeedChange={() => player.changeSpeed()}
          onStop={async () => {
            await player.stop();
            setShowMiniPlayer(false);
          }}
          onClose={() => {
            player.stop();
            setShowMiniPlayer(false);
          }}
        />
      )}

      {/* Modal Recitateur */}
      <Modal
        visible={showReciterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReciterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitleEmoji}>🎙️</Text>
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                  {t('chooseReciter')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowReciterModal(false)}
                style={styles.closeButtonContainer}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Liste des récitateurs */}
            <ScrollView
              style={styles.reciterList}
              showsVerticalScrollIndicator={false}
            >
              {reciters.map((reciter) => {
                const isSelected = selectedReciter.id === reciter.id;

                return (
                  <TouchableOpacity
                    key={reciter.id}
                    style={[
                      styles.reciterItem,
                      isSelected && styles.reciterItemSelected,
                    ]}
                    onPress={async () => {
                      setSelectedReciter(reciter);
                      setShowReciterModal(false);
                      player.updateReciterCode(reciter.id);
                      if (player.isPlaying) {
                        await player.playVerseAtIndex(player.currentVerseIndex);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Drapeau + Nom */}
                    <View style={[styles.reciterMainInfo, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={styles.reciterFlag}>{reciter.flag}</Text>
                      <View style={styles.reciterNames}>
                        <Text style={[
                          styles.reciterName,
                          isSelected && styles.reciterNameSelected,
                          isRTL && styles.rtlText,
                        ]}>
                          {reciter.name}
                        </Text>
                        <Text style={[
                          styles.reciterNameAr,
                          isSelected && styles.reciterNameArSelected,
                          isRTL && styles.rtlText,
                        ]}>
                          {reciter.nameAr}
                        </Text>
                        <Text style={[styles.reciterCountry, isRTL && styles.rtlText]}>
                          {reciter.country}
                        </Text>
                      </View>
                    </View>

                    {/* Checkmark */}
                    {isSelected && (
                      <View style={styles.checkmarkContainer}>
                        <Text style={styles.checkmark}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  header: {
    paddingTop: 50,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: fontSize.md,
    color: colors.accent,
    fontWeight: '500',
  },
  headerContent: {
    alignItems: 'center',
  },
  surahNumber: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  surahArabicName: {
    fontSize: 40,
    color: colors.accent,
    marginVertical: 8,
  },
  surahEnglishName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  surahTranslation: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: 2,
  },
  surahMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  metaDot: {
    marginHorizontal: spacing.sm,
    color: colors.textMuted,
  },
  optionsBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  optionButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  optionIcon: {
    fontSize: 16,
  },
  optionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  // Karaoke Player Pro
  karaokePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
  },
  karaokePlayerRTL: {
    flexDirection: 'row-reverse',
  },
  mainPlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  mainPlayIcon: {
    fontSize: 26,
  },
  playerMainInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  playerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  playerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  playerHint: {
    fontSize: 11,
    color: colors.accent,
    marginTop: 4,
    fontStyle: 'italic',
  },
  quickOptions: {
    flexDirection: 'column',
    gap: 8,
  },
  quickOptionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201,162,39,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickOptionIcon: {
    fontSize: 16,
  },
  speedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  bismillahContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  bismillah: {
    fontSize: 30,
    color: colors.accent,
  },
  bismillahTranslation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // Actions sur les versets
  ayahActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  ayahActionsRTL: {
    flexDirection: 'row-reverse',
  },
  ayahActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  ayahActionButtonActive: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderColor: colors.accent,
  },
  ayahActionIcon: {
    fontSize: 14,
  },
  ayahActionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    paddingBottom: 100,
  },
  navButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontWeight: '500',
  },
  // Modal Récitateur - Bottom Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end' as const,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitleContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  modalTitleEmoji: {
    fontSize: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  closeButtonContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  closeButton: {
    fontSize: 20,
    color: '#666666',
    fontWeight: '600' as const,
  },
  reciterList: {
    padding: 16,
  },
  reciterItem: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#F8F8F8',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reciterItemSelected: {
    backgroundColor: '#FFF9E6',
    borderColor: '#C9A227',
    shadowColor: '#C9A227',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  reciterMainInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
    gap: 16,
  },
  reciterFlag: {
    fontSize: 32,
  },
  reciterNames: {
    flex: 1,
  },
  reciterName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  reciterNameSelected: {
    color: '#000000',
    fontWeight: '700' as const,
  },
  reciterNameAr: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 2,
  },
  reciterNameArSelected: {
    color: '#333333',
    fontWeight: '600' as const,
  },
  reciterCountry: {
    fontSize: 13,
    color: '#999999',
    marginTop: 2,
  },
  checkmarkContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#C9A227',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  checkmark: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold' as const,
  },
  // RTL Styles
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  backButtonRTL: {
    alignSelf: 'flex-end',
  },
  surahMetaRTL: {
    flexDirection: 'row-reverse',
  },
  optionsBarRTL: {
    flexDirection: 'row-reverse',
  },
  optionButtonRTL: {
    flexDirection: 'row-reverse',
  },
  navigationContainerRTL: {
    flexDirection: 'row-reverse',
  },
});

export default SurahScreen;
