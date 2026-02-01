import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, wp } from '../theme/colors';
import { arabicAlphabet } from '../data/alphabet';
import { lessons, levels, getUserProgress } from '../data/lessons';
import { vocabulary } from '../data/vocabulary';
import ProgressBar from '../components/ProgressBar';
import { useLanguage } from '../context/LanguageContext';

interface LearnArabicScreenProps {
  navigation: any;
}

const LearnArabicScreen: React.FC<LearnArabicScreenProps> = ({ navigation }) => {
  const { t, isRTL } = useLanguage();
  const [userProgress] = useState(getUserProgress());

  const modules = [
    {
      id: 'alphabet',
      titleKey: 'alphabet',
      titleArKey: 'alphabetArabic',
      descriptionKey: 'alphabetDescription',
      icon: 'ا ب ت',
      count: `${arabicAlphabet.length} ${t('letters')}`,
      progress: userProgress.lettersLearned.length / arabicAlphabet.length * 100,
      screen: 'Alphabet',
      color: colors.accent,
    },
    {
      id: 'lessons',
      titleKey: 'lessons',
      titleArKey: 'lessonsArabic',
      descriptionKey: 'lessonsDescription',
      icon: '📚',
      count: `${lessons.length} ${t('lessons')}`,
      progress: userProgress.lessonsCompleted.length / lessons.length * 100,
      screen: 'LessonsList',
      color: '#27ae60',
    },
    {
      id: 'vocabulary',
      titleKey: 'vocabulary',
      titleArKey: 'vocabularyArabic',
      descriptionKey: 'vocabularyDescription',
      icon: '📖',
      count: `${Object.values(vocabulary).reduce((acc, words) => acc + words.length, 0)} ${t('words')}`,
      progress: 0, // Pas de tracking vocabulaire implémenté
      screen: 'Vocabulary',
      color: '#3498db',
    },
    {
      id: 'practice',
      titleKey: 'training',
      titleArKey: 'trainingArabic',
      descriptionKey: 'trainingDescription',
      icon: '✍️',
      count: t('quizExercises'),
      progress: 0,
      screen: 'LessonsList',
      color: '#9b59b6',
    },
  ];

  const currentLevel = levels.find((l) => l.id === userProgress.currentLevel);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>{t('learnArabic')}</Text>
          <Text style={styles.arabicTitle}>{t('learnArabicArabic')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
            {t('learnArabicSubtitle')}
          </Text>
        </View>

        <View style={styles.content}>
          {/* Progress Card */}
          <View style={styles.progressCard}>
            <View style={[styles.progressHeader, isRTL && styles.progressHeaderRTL]}>
              <View>
                <Text style={[styles.progressLabel, isRTL && styles.rtlText]}>{t('yourLevel')}</Text>
                <Text style={[styles.levelName, isRTL && styles.rtlText]}>
                  {currentLevel?.name || t('beginner')}
                </Text>
                <Text style={[styles.levelNameAr, isRTL && styles.rtlText]}>
                  {currentLevel?.nameAr || 'مبتدئ'}
                </Text>
              </View>
              <View style={styles.xpContainer}>
                <Text style={styles.xpValue}>{userProgress.totalXP}</Text>
                <Text style={styles.xpLabel}>XP</Text>
              </View>
            </View>
            <View style={styles.progressBarContainer}>
              <ProgressBar
                progress={(userProgress.totalXP % 500) / 5}
                height={10}
                showLabel
                labelPosition="right"
              />
              <Text style={[styles.progressNote, isRTL && styles.rtlText]}>
                {500 - (userProgress.totalXP % 500)} {t('xpForNextLevel')}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={[styles.statsRow, isRTL && styles.statsRowRTL]}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {userProgress.lessonsCompleted.length}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('lessons')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {userProgress.lettersLearned.length}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('letters')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{userProgress.streak}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('streak')}</Text>
            </View>
          </View>

          {/* Modules */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t('learningModules')}</Text>

            {modules.map((module) => (
              <TouchableOpacity
                key={module.id}
                style={styles.moduleCard}
                onPress={() => navigation.navigate(module.screen)}
              >
                <View style={[styles.moduleContent, isRTL && styles.moduleContentRTL]}>
                  <View
                    style={[
                      styles.moduleIcon,
                      { backgroundColor: `${module.color}20` },
                    ]}
                  >
                    <Text style={styles.moduleIconText}>{module.icon}</Text>
                  </View>
                  <View style={styles.moduleInfo}>
                    <View style={[styles.moduleHeader, isRTL && styles.moduleHeaderRTL]}>
                      <Text style={[styles.moduleTitle, isRTL && styles.rtlText]}>{t(module.titleKey as any)}</Text>
                      <Text style={styles.moduleTitleAr}>{t(module.titleArKey as any)}</Text>
                    </View>
                    <Text style={[styles.moduleDescription, isRTL && styles.rtlText]}>
                      {t(module.descriptionKey as any)}
                    </Text>
                    <View style={[styles.moduleFooter, isRTL && styles.moduleFooterRTL]}>
                      <Text style={[styles.moduleCount, isRTL && styles.rtlText]}>{module.count}</Text>
                      {module.progress > 0 && (
                        <View style={styles.moduleProgress}>
                          <ProgressBar
                            progress={module.progress}
                            height={4}
                            color={module.color}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.chevron}>{isRTL ? '<' : '>'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Start */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t('quickStart')}</Text>

            <TouchableOpacity
              style={styles.quickStartCard}
              onPress={() => navigation.navigate('Alphabet')}
            >
              <View style={[styles.quickStartContent, isRTL && styles.quickStartContentRTL]}>
                <Text style={styles.quickStartIcon}>🎯</Text>
                <View style={styles.quickStartInfo}>
                  <Text style={[styles.quickStartTitle, isRTL && styles.rtlText]}>
                    {t('startWithAlphabet')}
                  </Text>
                  <Text style={[styles.quickStartDescription, isRTL && styles.rtlText]}>
                    {t('alphabetBaseInfo')}
                  </Text>
                </View>
              </View>
              <View style={styles.quickStartButton}>
                <Text style={styles.quickStartButtonText}>{t('start')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Tips */}
          <View style={[styles.tipsCard, isRTL && styles.tipsCardRTL]}>
            <Text style={styles.tipsIcon}>💡</Text>
            <View style={styles.tipsContent}>
              <Text style={[styles.tipsTitle, isRTL && styles.rtlText]}>{t('dailyTip')}</Text>
              <Text style={[styles.tipsText, isRTL && styles.rtlText]}>
                {t('dailyTipText')}
              </Text>
            </View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.accent,
  },
  arabicTitle: {
    fontSize: 28,
    color: colors.accent,
    marginTop: 4,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  progressCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  progressLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 4,
  },
  levelName: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  levelNameAr: {
    fontSize: fontSize.lg,
    color: colors.accent,
    marginTop: 2,
  },
  xpContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: 70,
  },
  xpValue: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.accent,
  },
  xpLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  progressBarContainer: {
    marginTop: spacing.sm,
  },
  progressNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.accent,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.md,
  },
  moduleCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  moduleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moduleIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  moduleIconText: {
    fontSize: 24,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  moduleTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  moduleTitleAr: {
    fontSize: fontSize.md,
    color: colors.accent,
  },
  moduleDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  moduleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  moduleCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  moduleProgress: {
    flex: 1,
    maxWidth: 100,
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  quickStartCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  quickStartContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  quickStartIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  quickStartInfo: {
    flex: 1,
  },
  quickStartTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  quickStartDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickStartButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  quickStartButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#ffffff',
  },
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
  },
  tipsIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  tipsText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // RTL Styles
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  progressHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  statsRowRTL: {
    flexDirection: 'row-reverse',
  },
  moduleContentRTL: {
    flexDirection: 'row-reverse',
  },
  moduleHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  moduleFooterRTL: {
    flexDirection: 'row-reverse',
  },
  quickStartContentRTL: {
    flexDirection: 'row-reverse',
  },
  tipsCardRTL: {
    flexDirection: 'row-reverse',
  },
});

export default LearnArabicScreen;
