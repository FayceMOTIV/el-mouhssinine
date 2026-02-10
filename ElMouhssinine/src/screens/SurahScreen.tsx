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
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { Event, State, useTrackPlayerEvents } from 'react-native-track-player';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { QuranAPI, surahsInfo, reciters, SurahData, getVerseAudioUrl } from '../services/quranApi';
import { setupPlayer, stopAudio } from '../services/audioPlayer';
import { useLanguage } from '../context/LanguageContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SurahScreenProps {
  route: any;
  navigation: any;
}

const SurahScreen: React.FC<SurahScreenProps> = ({ route, navigation }) => {
  const { t, isRTL } = useLanguage();
  const { surahNumber } = route.params;
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

  // Mode Karaoke - États
  const [isKaraokePlaying, setIsKaraokePlaying] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(-1);
  const [isPaused, setIsPaused] = useState(false);

  // Refs pour le scroll automatique
  const flatListRef = useRef<FlatList>(null);
  const versesRef = useRef<any[]>([]);

  const surahInfo = surahsInfo.find((s) => s.number === surahNumber);
  const FAVORITES_KEY = '@quran_favorites';

  // Écouter les événements TrackPlayer pour le mode Karaoke
  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError], async (event) => {
    if (event.type === Event.PlaybackError) {
      console.error('Erreur lecture audio:', event);
      setIsKaraokePlaying(false);
      setCurrentVerseIndex(-1);
      return;
    }

    if (event.type === Event.PlaybackState) {
      // Quand un verset se termine, passer au suivant
      if (event.state === State.Ended && isKaraokePlaying && !isPaused) {
        const verses = surahData?.arabic?.ayahs || [];
        const nextIndex = currentVerseIndex + 1;

        if (nextIndex < verses.length) {
          // Jouer le verset suivant
          await playVerseAtIndex(nextIndex);
        } else {
          // Fin de la sourate
          setIsKaraokePlaying(false);
          setCurrentVerseIndex(-1);
          setIsPaused(false);
        }
      }
    }
  });

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

  // Fonction pour jouer un verset à un index donné
  const playVerseAtIndex = async (index: number) => {
    const verses = surahData?.arabic?.ayahs || [];
    if (index < 0 || index >= verses.length) return;

    const verse = verses[index];
    const globalVerseNumber = verse.number; // Numéro global 1-6236
    const audioUrl = getVerseAudioUrl(globalVerseNumber, selectedReciter.id);

    try {
      await setupPlayer();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: `verse-${globalVerseNumber}`,
        url: audioUrl,
        title: `${t('verse')} ${verse.numberInSurah} - ${surahInfo?.englishName || ''}`,
        artist: selectedReciter.name,
      });

      setCurrentVerseIndex(index);
      setIsKaraokePlaying(true);
      setIsPaused(false);

      // Scroll vers le verset avec un petit délai
      setTimeout(() => {
        scrollToVerse(index);
      }, 100);

      await TrackPlayer.play();
    } catch (error) {
      console.error('Erreur lecture verset:', error);
      Alert.alert(t('audioError'), t('cannotPlayAudio'));
      setIsKaraokePlaying(false);
      setCurrentVerseIndex(-1);
    }
  };

  // Scroll automatique vers le verset en cours
  const scrollToVerse = (index: number) => {
    if (flatListRef.current && index >= 0) {
      flatListRef.current.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.3, // Position le verset à 30% du haut
      });
    }
  };

  // Démarrer/Reprendre la lecture Karaoke
  const handlePlayKaraoke = async () => {
    if (isKaraokePlaying && !isPaused) {
      // Pause
      await TrackPlayer.pause();
      setIsPaused(true);
    } else if (isPaused) {
      // Reprendre
      await TrackPlayer.play();
      setIsPaused(false);
    } else {
      // Démarrer depuis le début ou le verset sélectionné
      const startIndex = selectedAyah ? selectedAyah - 1 : 0;
      await playVerseAtIndex(startIndex);
    }
  };

  // Arrêter complètement
  const handleStopKaraoke = async () => {
    await stopAudio();
    setIsKaraokePlaying(false);
    setCurrentVerseIndex(-1);
    setIsPaused(false);
  };

  // Jouer un verset spécifique (clic sur le verset)
  const handlePlayVerse = async (ayahNumberInSurah: number) => {
    const index = ayahNumberInSurah - 1;
    await playVerseAtIndex(index);
  };

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
      Alert.alert(t('copied'), t('verseCopied'));
    }
  };

  const isFavorite = (ayahNumber: number) => favorites.has(`${surahNumber}:${ayahNumber}`);

  const handleAyahPress = (ayahNumber: number) => {
    setSelectedAyah(selectedAyah === ayahNumber ? null : ayahNumber);
  };

  const handlePreviousSurah = useCallback(() => {
    if (surahNumber > 1) {
      handleStopKaraoke();
      navigation.replace('Surah', { surahNumber: surahNumber - 1 });
    }
  }, [surahNumber, navigation]);

  const handleNextSurah = useCallback(() => {
    if (surahNumber < 114) {
      handleStopKaraoke();
      navigation.replace('Surah', { surahNumber: surahNumber + 1 });
    }
  }, [surahNumber, navigation]);

  // Render individual ayah avec surlignage Karaoke
  const renderAyah = useCallback(({ item: ayah, index }: { item: any; index: number }) => {
    const translation = surahData?.translation?.ayahs?.[index];
    const isSelected = selectedAyah === ayah.numberInSurah;
    const isCurrentlyPlaying = currentVerseIndex === index && isKaraokePlaying;

    return (
      <TouchableOpacity
        style={[
          styles.ayahCard,
          isSelected && styles.ayahCardSelected,
          isCurrentlyPlaying && styles.ayahCardPlaying,
        ]}
        onPress={() => handleAyahPress(ayah.numberInSurah)}
        activeOpacity={0.7}
        accessibilityLabel={`${t('verse')} ${ayah.numberInSurah}`}
        accessibilityRole="button"
      >
        <View style={styles.ayahHeader}>
          <View style={[
            styles.ayahNumberBadge,
            isCurrentlyPlaying && styles.ayahNumberBadgePlaying,
          ]}>
            <Text style={[
              styles.ayahNumberText,
              isCurrentlyPlaying && styles.ayahNumberTextPlaying,
            ]}>
              {ayah.numberInSurah}
            </Text>
          </View>

          {/* Indicateur de lecture en cours */}
          {isCurrentlyPlaying && (
            <View style={styles.playingIndicator}>
              <Text style={styles.playingIcon}>🔊</Text>
            </View>
          )}

          {isSelected && (
            <View style={styles.ayahActions}>
              <TouchableOpacity
                style={[styles.ayahActionButton, isCurrentlyPlaying && styles.ayahActionButtonActive]}
                onPress={() => handlePlayVerse(ayah.numberInSurah)}
              >
                <Text style={styles.ayahActionIcon}>
                  {isCurrentlyPlaying && !isPaused ? '⏸️' : '▶️'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ayahActionButton, isFavorite(ayah.numberInSurah) && styles.ayahActionButtonActive]}
                onPress={() => handleToggleFavorite(ayah.numberInSurah)}
              >
                <Text style={styles.ayahActionIcon}>{isFavorite(ayah.numberInSurah) ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ayahActionButton}
                onPress={() => handleCopyAyah(ayah.numberInSurah)}
              >
                <Text style={styles.ayahActionIcon}>📋</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={[
          styles.ayahArabic,
          isCurrentlyPlaying && styles.ayahArabicPlaying,
        ]}>
          {ayah.text}
        </Text>

        {showTranslation && translation && (
          <Text style={[
            styles.ayahTranslation,
            isCurrentlyPlaying && styles.ayahTranslationPlaying,
          ]}>
            {translation.text}
          </Text>
        )}
      </TouchableOpacity>
    );
  }, [surahData?.translation?.ayahs, selectedAyah, currentVerseIndex, isKaraokePlaying, isPaused, showTranslation, favorites, t]);

  const ListHeaderComponent = useCallback(() => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
          onPress={() => {
            handleStopKaraoke();
            navigation.goBack();
          }}
        >
          <Text style={[styles.backButtonText, isRTL && styles.rtlText]}>
            {isRTL ? `${t('back')} >` : `< ${t('back')}`}
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

      {/* LECTEUR KARAOKE */}
      <View style={[styles.karaokePlayer, isRTL && styles.karaokePlayerRTL]}>
        <View style={styles.karaokeControls}>
          <TouchableOpacity onPress={handlePlayKaraoke} style={styles.playButton}>
            <Text style={styles.playIcon}>
              {isKaraokePlaying && !isPaused ? '⏸️' : '▶️'}
            </Text>
          </TouchableOpacity>
          {isKaraokePlaying && (
            <TouchableOpacity onPress={handleStopKaraoke} style={styles.stopButton}>
              <Text style={styles.stopIcon}>⏹️</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.playerInfo}>
          <Text style={[styles.playerTitle, isRTL && styles.rtlText]}>
            {isKaraokePlaying
              ? `${t('verse')} ${currentVerseIndex + 1} / ${surahData?.arabic?.ayahs?.length || 0}`
              : t('listenWithKaraoke') || 'Mode Karaoke'}
          </Text>
          <Text style={[styles.playerReciter, isRTL && styles.rtlText]}>
            {selectedReciter.name}
          </Text>
          {isKaraokePlaying && (
            <Text style={[styles.playerHint, isRTL && styles.rtlText]}>
              {t('karaokeHint') || 'Suivi automatique du texte'}
            </Text>
          )}
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
  ), [isRTL, t, surahNumber, surahInfo, showTranslation, isKaraokePlaying, isPaused, currentVerseIndex, selectedReciter, surahData?.arabic?.ayahs?.length, navigation]);

  const ListFooterComponent = useCallback(() => (
    <View style={[styles.navigationContainer, isRTL && styles.navigationContainerRTL]}>
      <TouchableOpacity
        style={[styles.navButton, surahNumber === 1 && styles.navButtonDisabled]}
        onPress={handlePreviousSurah}
        disabled={surahNumber === 1}
      >
        <Text style={[styles.navButtonText, isRTL && styles.rtlText]}>
          {isRTL ? `${t('previousSurah')} >` : `< ${t('previousSurah')}`}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.navButton, surahNumber === 114 && styles.navButtonDisabled]}
        onPress={handleNextSurah}
        disabled={surahNumber === 114}
      >
        <Text style={[styles.navButtonText, isRTL && styles.rtlText]}>
          {isRTL ? `< ${t('nextSurah')}` : `${t('nextSurah')} >`}
        </Text>
      </TouchableOpacity>
    </View>
  ), [isRTL, t, surahNumber, handlePreviousSurah, handleNextSurah]);

  const keyExtractor = useCallback((item: any) => item.numberInSurah.toString(), []);

  // Gestion des erreurs de scroll
  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
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
      const data = await QuranAPI.getSurahFull(surahNumber);
      setSurahData({
        arabic: data.arabic,
        translation: data.translation,
      });
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

  // Cleanup
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

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
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={false} // Important pour le scroll automatique
        onScrollToIndexFailed={onScrollToIndexFailed}
        getItemLayout={(data, index) => ({
          length: 180, // Hauteur approximative d'un verset
          offset: 180 * index + 400, // 400 = hauteur du header approximative
          index,
        })}
      />

      {/* Modal Recitateur */}
      <Modal visible={showReciterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowReciterModal(false)}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{t('chooseReciter')}</Text>
            {reciters.map((reciter) => (
              <TouchableOpacity
                key={reciter.id}
                style={[
                  styles.reciterOption,
                  selectedReciter.id === reciter.id && styles.reciterOptionSelected,
                  isRTL && styles.reciterOptionRTL,
                ]}
                onPress={() => {
                  setSelectedReciter(reciter);
                  setShowReciterModal(false);
                  // Si en lecture, redémarrer avec le nouveau récitateur
                  if (isKaraokePlaying) {
                    playVerseAtIndex(currentVerseIndex);
                  }
                }}
              >
                <View style={styles.reciterInfo}>
                  <Text style={[styles.reciterName, isRTL && styles.rtlText]}>{reciter.name}</Text>
                  <Text style={[styles.reciterNameAr, isRTL && styles.rtlText]}>{reciter.nameAr}</Text>
                </View>
                {selectedReciter.id === reciter.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
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
    paddingHorizontal: spacing.lg,
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
    fontSize: 36,
    color: colors.accent,
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
    borderColor: 'rgba(0,0,0,0.1)',
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
  // Karaoke Player Styles
  karaokePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderRadius: 16,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  karaokePlayerRTL: {
    flexDirection: 'row-reverse',
  },
  karaokeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#c9a227',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 24,
  },
  stopIcon: {
    fontSize: 18,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  playerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  playerReciter: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  playerHint: {
    fontSize: 11,
    color: colors.accent,
    marginTop: 2,
    fontStyle: 'italic',
  },
  bismillahContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  bismillah: {
    fontSize: 28,
    color: colors.accent,
  },
  bismillahTranslation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // Ayah Card Styles
  ayahCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ayahCardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(201,162,39,0.05)',
  },
  // Style Karaoke - Verset en cours de lecture
  ayahCardPlaying: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderColor: colors.accent,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  ayahHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ayahNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahNumberBadgePlaying: {
    backgroundColor: colors.accent,
  },
  ayahNumberText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.accent,
  },
  ayahNumberTextPlaying: {
    color: '#ffffff',
  },
  playingIndicator: {
    marginLeft: spacing.sm,
  },
  playingIcon: {
    fontSize: 16,
  },
  ayahActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ayahActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201,162,39,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahActionButtonActive: {
    backgroundColor: 'rgba(201,162,39,0.3)',
  },
  ayahActionIcon: {
    fontSize: 16,
  },
  ayahArabic: {
    fontSize: 26,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 50,
    marginBottom: spacing.md,
  },
  ayahArabicPlaying: {
    color: colors.primary,
    fontWeight: '500',
  },
  ayahTranslation: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 24,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  ayahTranslationPlaying: {
    color: colors.text,
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
    borderColor: 'rgba(0,0,0,0.1)',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.textMuted,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  reciterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reciterOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(201,162,39,0.08)',
  },
  reciterInfo: {
    flex: 1,
  },
  reciterName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  reciterNameAr: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  checkmark: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.accent,
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
  reciterOptionRTL: {
    flexDirection: 'row-reverse',
  },
});

export default SurahScreen;
