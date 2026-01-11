import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { ArabicLetter, arabicAlphabet } from '../data/alphabet';
import ArabicLetterComponent from '../components/ArabicLetter';
import { speakArabic } from '../services/tts';

interface LetterDetailScreenProps {
  route: any;
  navigation: any;
}

const LetterDetailScreen: React.FC<LetterDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { letter } = route.params as { letter: ArabicLetter };
  const [showExamples, setShowExamples] = useState(true);

  const letterIndex = arabicAlphabet.findIndex((l) => l.id === letter.id);
  const previousLetter = letterIndex > 0 ? arabicAlphabet[letterIndex - 1] : null;
  const nextLetter =
    letterIndex < arabicAlphabet.length - 1
      ? arabicAlphabet[letterIndex + 1]
      : null;

  const handleNavigateLetter = (targetLetter: ArabicLetter) => {
    navigation.replace('LetterDetail', { letter: targetLetter });
  };

  const handlePlaySound = () => {
    speakArabic(letter.isolated);
  };

  const handlePlayExample = (arabicWord: string) => {
    speakArabic(arabicWord);
  };

  // Example words for each letter (simplified)
  const exampleWords: Record<string, Array<{ arabic: string; transliteration: string; translation: string }>> = {
    alif: [
      { arabic: 'أسد', transliteration: 'asad', translation: 'lion' },
      { arabic: 'أب', transliteration: 'ab', translation: 'pere' },
    ],
    ba: [
      { arabic: 'باب', transliteration: 'bab', translation: 'porte' },
      { arabic: 'بيت', transliteration: 'bayt', translation: 'maison' },
    ],
    ta: [
      { arabic: 'تمر', transliteration: 'tamr', translation: 'datte' },
      { arabic: 'تفاح', transliteration: 'tuffah', translation: 'pomme' },
    ],
    tha: [
      { arabic: 'ثلج', transliteration: 'thalj', translation: 'neige' },
      { arabic: 'ثوم', transliteration: 'thawm', translation: 'ail' },
    ],
    jim: [
      { arabic: 'جمل', transliteration: 'jamal', translation: 'chameau' },
      { arabic: 'جبل', transliteration: 'jabal', translation: 'montagne' },
    ],
    ha: [
      { arabic: 'حب', transliteration: 'hubb', translation: 'amour' },
      { arabic: 'حليب', transliteration: 'halib', translation: 'lait' },
    ],
    kha: [
      { arabic: 'خبز', transliteration: 'khubz', translation: 'pain' },
      { arabic: 'خير', transliteration: 'khayr', translation: 'bien' },
    ],
    dal: [
      { arabic: 'دار', transliteration: 'dar', translation: 'maison' },
      { arabic: 'دين', transliteration: 'din', translation: 'religion' },
    ],
    dhal: [
      { arabic: 'ذهب', transliteration: 'dhahab', translation: 'or' },
      { arabic: 'ذكر', transliteration: 'dhikr', translation: 'rappel' },
    ],
    ra: [
      { arabic: 'رب', transliteration: 'rabb', translation: 'seigneur' },
      { arabic: 'رحمة', transliteration: 'rahma', translation: 'misericorde' },
    ],
    zay: [
      { arabic: 'زيت', transliteration: 'zayt', translation: 'huile' },
      { arabic: 'زهر', transliteration: 'zahr', translation: 'fleur' },
    ],
    sin: [
      { arabic: 'سلام', transliteration: 'salam', translation: 'paix' },
      { arabic: 'سماء', transliteration: 'sama', translation: 'ciel' },
    ],
    shin: [
      { arabic: 'شمس', transliteration: 'shams', translation: 'soleil' },
      { arabic: 'شكر', transliteration: 'shukr', translation: 'gratitude' },
    ],
    sad: [
      { arabic: 'صلاة', transliteration: 'salat', translation: 'priere' },
      { arabic: 'صبر', transliteration: 'sabr', translation: 'patience' },
    ],
    dad: [
      { arabic: 'ضوء', transliteration: "daw'", translation: 'lumiere' },
    ],
    taa: [
      { arabic: 'طعام', transliteration: "ta'am", translation: 'nourriture' },
    ],
    dhaa: [
      { arabic: 'ظهر', transliteration: 'dhuhr', translation: 'midi' },
    ],
    ayn: [
      { arabic: 'عين', transliteration: "'ayn", translation: 'oeil' },
      { arabic: 'علم', transliteration: "'ilm", translation: 'science' },
    ],
    ghayn: [
      { arabic: 'غفور', transliteration: 'ghafur', translation: 'pardonneur' },
    ],
    fa: [
      { arabic: 'فجر', transliteration: 'fajr', translation: 'aube' },
    ],
    qaf: [
      { arabic: 'قلب', transliteration: 'qalb', translation: 'coeur' },
      { arabic: 'قرآن', transliteration: "qur'an", translation: 'coran' },
    ],
    kaf: [
      { arabic: 'كتاب', transliteration: 'kitab', translation: 'livre' },
    ],
    lam: [
      { arabic: 'ليل', transliteration: 'layl', translation: 'nuit' },
    ],
    mim: [
      { arabic: 'ماء', transliteration: "ma'", translation: 'eau' },
      { arabic: 'مسجد', transliteration: 'masjid', translation: 'mosquee' },
    ],
    nun: [
      { arabic: 'نور', transliteration: 'nur', translation: 'lumiere' },
    ],
    haa: [
      { arabic: 'هدى', transliteration: 'huda', translation: 'guidance' },
    ],
    waw: [
      { arabic: 'ورد', transliteration: 'ward', translation: 'rose' },
    ],
    ya: [
      { arabic: 'يد', transliteration: 'yad', translation: 'main' },
      { arabic: 'يوم', transliteration: 'yawm', translation: 'jour' },
    ],
  };

  const currentExamples = exampleWords[letter.id] || [];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{'<'} Alphabet</Text>
          </TouchableOpacity>
          <View style={styles.letterPosition}>
            <Text style={styles.positionText}>
              Lettre {letterIndex + 1} sur {arabicAlphabet.length}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Main Letter Card */}
          <ArabicLetterComponent letter={letter} showForms size="large" />

          {/* Description */}
          {letter.description && (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{letter.description}</Text>
            </View>
          )}

          {/* Pronunciation Guide */}
          <View style={styles.pronunciationCard}>
            <View style={styles.pronunciationHeader}>
              <Text style={styles.sectionTitle}>Prononciation</Text>
              <TouchableOpacity
                style={styles.audioButtonLarge}
                onPress={handlePlaySound}
              >
                <Text style={styles.audioButtonText}>🔊</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pronunciationContent}>
              <TouchableOpacity
                style={styles.soundBadge}
                onPress={handlePlaySound}
              >
                <Text style={styles.soundText}>/{letter.sound}/</Text>
              </TouchableOpacity>
              <Text style={styles.pronunciationHint}>
                Appuyez pour ecouter la prononciation
              </Text>
            </View>
          </View>

          {/* Examples */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowExamples(!showExamples)}
            >
              <Text style={styles.sectionTitle}>Exemples de mots</Text>
              <Text style={styles.expandIcon}>{showExamples ? '−' : '+'}</Text>
            </TouchableOpacity>

            {showExamples && currentExamples.length > 0 && (
              <View style={styles.examplesContainer}>
                {currentExamples.map((example, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.exampleCard}
                    onPress={() => handlePlayExample(example.arabic)}
                  >
                    <Text style={styles.exampleArabic}>{example.arabic}</Text>
                    <Text style={styles.exampleTranslit}>
                      {example.transliteration}
                    </Text>
                    <Text style={styles.exampleTranslation}>
                      {example.translation}
                    </Text>
                    <Text style={styles.exampleAudioHint}>🔊 Appuyer pour ecouter</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {showExamples && currentExamples.length === 0 && (
              <Text style={styles.noExamples}>
                Exemples a venir...
              </Text>
            )}
          </View>

          {/* Navigation between letters */}
          <View style={styles.navigationContainer}>
            <TouchableOpacity
              style={[styles.navButton, !previousLetter && styles.navButtonDisabled]}
              onPress={() => previousLetter && handleNavigateLetter(previousLetter)}
              disabled={!previousLetter}
            >
              <Text style={styles.navButtonIcon}>{'<'}</Text>
              {previousLetter && (
                <View style={styles.navButtonContent}>
                  <Text style={styles.navButtonLetter}>{previousLetter.isolated}</Text>
                  <Text style={styles.navButtonName}>{previousLetter.name}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, !nextLetter && styles.navButtonDisabled]}
              onPress={() => nextLetter && handleNavigateLetter(nextLetter)}
              disabled={!nextLetter}
            >
              {nextLetter && (
                <View style={styles.navButtonContent}>
                  <Text style={styles.navButtonLetter}>{nextLetter.isolated}</Text>
                  <Text style={styles.navButtonName}>{nextLetter.name}</Text>
                </View>
              )}
              <Text style={styles.navButtonIcon}>{'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {},
  backButtonText: {
    fontSize: fontSize.md,
    color: colors.accent,
  },
  letterPosition: {},
  positionText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  descriptionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  descriptionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  pronunciationCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  pronunciationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audioButtonLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(201,162,39,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioButtonText: {
    fontSize: 24,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  pronunciationContent: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  soundBadge: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  soundText: {
    fontSize: fontSize.xl,
    color: colors.accent,
    fontWeight: '600',
  },
  pronunciationHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  expandIcon: {
    fontSize: 24,
    color: colors.accent,
  },
  examplesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  exampleCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  exampleArabic: {
    fontSize: 28,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  exampleTranslit: {
    fontSize: fontSize.md,
    color: colors.text,
    fontStyle: 'italic',
  },
  exampleTranslation: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  exampleAudioHint: {
    fontSize: fontSize.xs,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  noExamples: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonIcon: {
    fontSize: fontSize.xl,
    color: colors.accent,
    fontWeight: '600',
  },
  navButtonContent: {
    alignItems: 'center',
  },
  navButtonLetter: {
    fontSize: 24,
    color: colors.text,
  },
  navButtonName: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});

export default LetterDetailScreen;
