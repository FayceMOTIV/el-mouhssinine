import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { QuranAPI, surahsInfo, reciters, SurahData, getAudioUrl } from '../services/quranApi';

interface SurahScreenProps {
  route: any;
  navigation: any;
}

const SurahScreen: React.FC<SurahScreenProps> = ({ route, navigation }) => {
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

  const surahInfo = surahsInfo.find((s) => s.number === surahNumber);

  // Jouer l'audio d'un verset
  const handlePlayAudio = async (ayahNumber: number) => {
    const globalAyahNumber = surahData?.arabic.ayahs[ayahNumber - 1]?.number;
    if (!globalAyahNumber) return;

    const audioUrl = `https://cdn.islamic.network/quran/audio/128/${selectedReciter.id}/${globalAyahNumber}.mp3`;

    try {
      setPlayingAyah(ayahNumber);
      // Ouvrir dans le navigateur ou lecteur audio externe
      const supported = await Linking.canOpenURL(audioUrl);
      if (supported) {
        await Linking.openURL(audioUrl);
      } else {
        Alert.alert('Audio', `Verset ${ayahNumber}\nRecitateur: ${selectedReciter.name}`);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de lire l\'audio');
    } finally {
      setPlayingAyah(null);
    }
  };

  // Toggle favori
  const handleToggleFavorite = (ayahNumber: number) => {
    const key = `${surahNumber}:${ayahNumber}`;
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(key)) {
        newFavorites.delete(key);
        Alert.alert('Favori retiré', `Verset ${ayahNumber} retiré des favoris`);
      } else {
        newFavorites.add(key);
        Alert.alert('Favori ajouté', `Verset ${ayahNumber} ajouté aux favoris`);
      }
      return newFavorites;
    });
  };

  // Copier le verset
  const handleCopyAyah = (ayahNumber: number) => {
    const ayah = surahData?.arabic.ayahs[ayahNumber - 1];
    const translation = surahData?.translation.ayahs[ayahNumber - 1];

    if (ayah) {
      const textToCopy = `${ayah.text}\n\n${translation?.text || ''}\n\n— Sourate ${surahInfo?.englishName}, Verset ${ayahNumber}`;
      Clipboard.setString(textToCopy);
      Alert.alert('Copié !', 'Le verset a été copié dans le presse-papiers');
    }
  };

  const isFavorite = (ayahNumber: number) => favorites.has(`${surahNumber}:${ayahNumber}`);

  useEffect(() => {
    loadSurah();
  }, [surahNumber]);

  const loadSurah = async () => {
    try {
      setLoading(true);
      const data = await QuranAPI.getSurahFull(surahNumber);
      setSurahData({
        arabic: data.arabic,
        translation: data.translation,
      });
    } catch (error) {
      console.error('Erreur chargement sourate:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAyahPress = (ayahNumber: number) => {
    setSelectedAyah(selectedAyah === ayahNumber ? null : ayahNumber);
  };

  const handlePreviousSurah = () => {
    if (surahNumber > 1) {
      navigation.replace('Surah', { surahNumber: surahNumber - 1 });
    }
  };

  const handleNextSurah = () => {
    if (surahNumber < 114) {
      navigation.replace('Surah', { surahNumber: surahNumber + 1 });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Chargement de la sourate...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{'<'} Retour</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.surahNumber}>Sourate {surahNumber}</Text>
            <Text style={styles.surahArabicName}>{surahInfo?.name}</Text>
            <Text style={styles.surahEnglishName}>{surahInfo?.englishName}</Text>
            <Text style={styles.surahTranslation}>{surahInfo?.translation}</Text>
            <View style={styles.surahMeta}>
              <Text style={styles.metaText}>{surahInfo?.ayahs} versets</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{surahInfo?.type}</Text>
            </View>
          </View>
        </View>

        {/* Options */}
        <View style={styles.optionsBar}>
          <TouchableOpacity
            style={[styles.optionButton, showTranslation && styles.optionButtonActive]}
            onPress={() => setShowTranslation(!showTranslation)}
          >
            <Text style={styles.optionIcon}>📖</Text>
            <Text style={[styles.optionText, showTranslation && styles.optionTextActive]}>
              Traduction
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => setShowReciterModal(true)}
          >
            <Text style={styles.optionIcon}>🎧</Text>
            <Text style={styles.optionText}>Recitateur</Text>
          </TouchableOpacity>
        </View>

        {/* Bismillah */}
        {surahNumber !== 9 && surahNumber !== 1 && (
          <View style={styles.bismillahContainer}>
            <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
            {showTranslation && (
              <Text style={styles.bismillahTranslation}>
                Au nom d'Allah, le Tout Misericordieux, le Tres Misericordieux
              </Text>
            )}
          </View>
        )}

        {/* Versets */}
        <View style={styles.ayahsContainer}>
          {surahData?.arabic.ayahs.map((ayah, index) => {
            const translation = surahData.translation.ayahs[index];
            const isSelected = selectedAyah === ayah.numberInSurah;

            return (
              <TouchableOpacity
                key={ayah.numberInSurah}
                style={[styles.ayahCard, isSelected && styles.ayahCardSelected]}
                onPress={() => handleAyahPress(ayah.numberInSurah)}
                activeOpacity={0.7}
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
                      >
                        <Text style={styles.ayahActionIcon}>{playingAyah === ayah.numberInSurah ? '⏸️' : '▶️'}</Text>
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

                <Text style={styles.ayahArabic}>{ayah.text}</Text>

                {showTranslation && translation && (
                  <Text style={styles.ayahTranslation}>{translation.text}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Navigation entre sourates */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[styles.navButton, surahNumber === 1 && styles.navButtonDisabled]}
            onPress={handlePreviousSurah}
            disabled={surahNumber === 1}
          >
            <Text style={styles.navButtonText}>{'<'} Sourate precedente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, surahNumber === 114 && styles.navButtonDisabled]}
            onPress={handleNextSurah}
            disabled={surahNumber === 114}
          >
            <Text style={styles.navButtonText}>Sourate suivante {'>'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Recitateur */}
      <Modal visible={showReciterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowReciterModal(false)}
            >
              <Text style={styles.closeButtonText}>x</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Choisir un recitateur</Text>
            {reciters.map((reciter) => (
              <TouchableOpacity
                key={reciter.id}
                style={[
                  styles.reciterOption,
                  selectedReciter.id === reciter.id && styles.reciterOptionSelected,
                ]}
                onPress={() => {
                  setSelectedReciter(reciter);
                  setShowReciterModal(false);
                }}
              >
                <View style={styles.reciterInfo}>
                  <Text style={styles.reciterName}>{reciter.name}</Text>
                  <Text style={styles.reciterNameAr}>{reciter.nameAr}</Text>
                </View>
                {selectedReciter.id === reciter.id && (
                  <Text style={styles.checkmark}>OK</Text>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
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
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  surahArabicName: {
    fontSize: 36,
    color: colors.accent,
  },
  surahEnglishName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 4,
  },
  surahTranslation: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  surahMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.5)',
  },
  metaDot: {
    marginHorizontal: spacing.sm,
    color: 'rgba(255,255,255,0.3)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  optionButtonActive: {
    backgroundColor: colors.accent,
  },
  optionIcon: {
    fontSize: 16,
  },
  optionText: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  bismillahContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  bismillah: {
    fontSize: 28,
    color: colors.accent,
  },
  bismillahTranslation: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
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
});

export default SurahScreen;
