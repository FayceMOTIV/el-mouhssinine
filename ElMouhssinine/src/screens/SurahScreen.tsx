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
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { QuranAPI, surahsInfo, reciters, SurahData, getAudioUrl } from '../services/quranApi';
import { playAudio, pauseAudio, stopAudio, getIsPlaying } from '../services/audioPlayer';
import { useTrackPlayerEvents, Event, State } from 'react-native-track-player';
import { useLanguage } from '../context/LanguageContext';

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
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [isPlayingSurah, setIsPlayingSurah] = useState(false);

  // Listener pour détecter la fin de lecture d'un verset
  useTrackPlayerEvents([Event.PlaybackState], async (event) => {
    if (event.state === State.Ended || event.state === State.Stopped) {
      setPlayingAyah(null);
    }
  });

  const surahInfo = surahsInfo.find((s) => s.number === surahNumber);

  // Clé AsyncStorage pour les favoris
  const FAVORITES_KEY = '@quran_favorites';

  // Charger les favoris depuis AsyncStorage au démarrage
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

  // URL pour la SOURATE COMPLÈTE
  const surahAudioUrl = `https://cdn.islamic.network/quran/audio-surah/128/${selectedReciter.id}/${surahNumber}.mp3`;

  // Jouer/Pause la sourate complète
  const handlePlaySurah = async () => {
    try {
      if (isPlayingSurah) {
        await pauseAudio();
        setIsPlayingSurah(false);
        setPlayingAyah(null);
      } else {
        // Arrêter tout audio en cours
        await stopAudio();
        setPlayingAyah(null);

        await playAudio(
          surahAudioUrl,
          `Sourate ${surahInfo?.englishName || surahNumber}`,
          selectedReciter.name
        );
        setIsPlayingSurah(true);
      }
    } catch (error) {
      console.error('Erreur audio sourate:', error);
      Alert.alert(t('audioError'), t('cannotPlaySurah'));
      setIsPlayingSurah(false);
    }
  };

  // Jouer l'audio d'un verset spécifique
  const handlePlayAudio = async (ayahNumber: number) => {
    const globalAyahNumber = surahData?.arabic.ayahs[ayahNumber - 1]?.number;
    if (!globalAyahNumber) return;

    // Si on clique sur le même verset en cours de lecture, on pause
    if (playingAyah === ayahNumber) {
      await pauseAudio();
      setPlayingAyah(null);
      return;
    }

    // Arrêter la lecture de sourate complète si en cours
    if (isPlayingSurah) {
      await stopAudio();
      setIsPlayingSurah(false);
    }

    const audioUrl = `https://cdn.islamic.network/quran/audio/128/${selectedReciter.id}/${globalAyahNumber}.mp3`;

    try {
      setPlayingAyah(ayahNumber);
      await playAudio(
        audioUrl,
        `Verset ${ayahNumber} - Sourate ${surahNumber}`,
        selectedReciter.name
      );
    } catch (error) {
      console.error('Erreur audio:', error);
      Alert.alert(t('audioError'), t('cannotPlayAudio'));
      setPlayingAyah(null);
    }
  };

  // Toggle favori (avec persistance AsyncStorage)
  const handleToggleFavorite = async (ayahNumber: number) => {
    const key = `${surahNumber}:${ayahNumber}`;
    const newFavorites = new Set(favorites);

    if (newFavorites.has(key)) {
      newFavorites.delete(key);
      Alert.alert(t('favoriteRemoved'), `${t('verse')} ${ayahNumber} ${t('verseRemovedFromFavorites')}`);
    } else {
      newFavorites.add(key);
      Alert.alert(t('favoriteAdded'), `${t('verse')} ${ayahNumber} ${t('verseAddedToFavorites')}`);
    }

    setFavorites(newFavorites);

    // Sauvegarder dans AsyncStorage
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
      navigation.replace('Surah', { surahNumber: surahNumber - 1 });
    }
  }, [surahNumber, navigation]);

  const handleNextSurah = useCallback(() => {
    if (surahNumber < 114) {
      navigation.replace('Surah', { surahNumber: surahNumber + 1 });
    }
  }, [surahNumber, navigation]);

  // IMPORTANT: Tous les useCallback AVANT le return conditionnel
  // Render individual ayah
  const renderAyah = useCallback(({ item: ayah, index }: { item: any; index: number }) => {
    const translation = surahData?.translation?.ayahs?.[index];
    const isSelected = selectedAyah === ayah.numberInSurah;

    return (
      <TouchableOpacity
        style={[styles.ayahCard, isSelected && styles.ayahCardSelected]}
        onPress={() => handleAyahPress(ayah.numberInSurah)}
        activeOpacity={0.7}
        accessibilityLabel={`${t('verse')} ${ayah.numberInSurah}${translation ? `: ${translation.text.substring(0, 100)}${translation.text.length > 100 ? '...' : ''}` : ''}`}
        accessibilityRole="button"
        accessibilityHint={t('tapToShowActions')}
      >
        <View style={styles.ayahHeader}>
          <View style={styles.ayahNumberBadge}>
            <Text style={styles.ayahNumberText}>{ayah.numberInSurah}</Text>
          </View>
          {isSelected && (
            <View style={styles.ayahActions}>
              <TouchableOpacity
                style={[styles.ayahActionButton, playingAyah === ayah.numberInSurah && styles.ayahActionButtonActive]}
                onPress={() => handlePlayAudio(ayah.numberInSurah)}
                accessibilityLabel={playingAyah === ayah.numberInSurah ? t('pauseVerse') : t('playVerse')}
                accessibilityRole="button"
              >
                <Text style={styles.ayahActionIcon}>{playingAyah === ayah.numberInSurah ? '⏸️' : '▶️'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ayahActionButton, isFavorite(ayah.numberInSurah) && styles.ayahActionButtonActive]}
                onPress={() => handleToggleFavorite(ayah.numberInSurah)}
                accessibilityLabel={isFavorite(ayah.numberInSurah) ? t('removeFromFavorites') : t('addToFavorites')}
                accessibilityRole="button"
              >
                <Text style={styles.ayahActionIcon}>{isFavorite(ayah.numberInSurah) ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ayahActionButton}
                onPress={() => handleCopyAyah(ayah.numberInSurah)}
                accessibilityLabel={t('copyVerse')}
                accessibilityRole="button"
              >
                <Text style={styles.ayahActionIcon}>📋</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.ayahArabic}>{ayah.text}</Text>

        {showTranslation && translation && (
          <Text style={styles.ayahTranslation}>{translation.text}</Text>
        )}
      </TouchableOpacity>
    );
  }, [surahData?.translation?.ayahs, selectedAyah, playingAyah, showTranslation, favorites, t]);

  const ListHeaderComponent = useCallback(() => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
          onPress={() => navigation.goBack()}
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

      {/* LECTEUR SOURATE COMPLÈTE */}
      <View style={[styles.audioPlayer, isRTL && styles.audioPlayerRTL]}>
        <TouchableOpacity onPress={handlePlaySurah} style={styles.playButton}>
          <Text style={styles.playIcon}>{isPlayingSurah ? '⏸️' : '▶️'}</Text>
        </TouchableOpacity>
        <View style={styles.playerInfo}>
          <Text style={[styles.playerTitle, isRTL && styles.rtlText]}>{t('listenFullSurah')}</Text>
          <Text style={[styles.playerReciter, isRTL && styles.rtlText]}>{selectedReciter.name}</Text>
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
  ), [isRTL, t, surahNumber, surahInfo, showTranslation, isPlayingSurah, selectedReciter, navigation, handlePlaySurah]);

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

  // Cleanup: arrêter l'audio quand on quitte l'écran
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // Écran de chargement APRÈS tous les hooks
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
        removeClippedSubviews={true}
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
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderRadius: 16,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#c9a227',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  playIcon: {
    fontSize: 24,
  },
  playerInfo: {
    flex: 1,
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
  ayahsContainer: {
    paddingHorizontal: spacing.lg,
  },
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
  ayahNumberText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.accent,
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
  ayahTranslation: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 24,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
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
  audioPlayerRTL: {
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
