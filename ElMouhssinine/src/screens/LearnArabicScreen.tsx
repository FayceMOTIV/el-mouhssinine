import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { arabicAlphabet } from '../data/alphabet';
import { lessons, levels, getUserProgress } from '../data/lessons';
import { vocabularyCategories, vocabulary } from '../data/vocabulary';
import ProgressBar from '../components/ProgressBar';

interface LearnArabicScreenProps {
  navigation: any;
}

const LearnArabicScreen: React.FC<LearnArabicScreenProps> = ({ navigation }) => {
  const [userProgress, setUserProgress] = useState(getUserProgress());

  const modules = [
    {
      id: 'alphabet',
      title: 'Alphabet Arabe',
      titleAr: 'الحروف العربية',
      description: 'Apprendre les 28 lettres de l\'alphabet arabe',
      icon: 'ا ب ت',
      count: `${arabicAlphabet.length} lettres`,
      progress: 45,
      screen: 'Alphabet',
      color: colors.accent,
    },
    {
      id: 'lessons',
      title: 'Lecons',
      titleAr: 'الدروس',
      description: 'Cours structures pour apprendre a lire et ecrire',
      icon: '📚',
      count: `${lessons.length} lecons`,
      progress: userProgress.lessonsCompleted.length / lessons.length * 100,
      screen: 'LessonsList',
      color: '#27ae60',
    },
    {
      id: 'vocabulary',
      title: 'Vocabulaire',
      titleAr: 'المفردات',
      description: 'Mots et expressions essentiels',
      icon: '📖',
      count: `${Object.values(vocabulary).reduce((acc, words) => acc + words.length, 0)} mots`,
      progress: 20,
      screen: 'Vocabulary',
      color: '#3498db',
    },
    {
      id: 'practice',
      title: 'Entrainement',
      titleAr: 'التدريب',
      description: 'Exercices de lecture et ecriture',
      icon: '✍️',
      count: 'Quiz & Exercices',
      progress: 0,
      screen: 'Practice',
      color: '#9b59b6',
    },
  ];

  const currentLevel = levels.find((l) => l.id === userProgress.currentLevel);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Apprendre l'Arabe</Text>
          <Text style={styles.arabicTitle}>تعلم العربية</Text>
          <Text style={styles.subtitle}>
            De l'alphabet a la lecture du Coran
          </Text>
        </View>

        <View style={styles.content}>
          {/* Progress Card */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressLabel}>Votre niveau</Text>
                <Text style={styles.levelName}>
                  {currentLevel?.name || 'Debutant'}
                </Text>
                <Text style={styles.levelNameAr}>
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
              <Text style={styles.progressNote}>
                {500 - (userProgress.totalXP % 500)} XP pour le niveau suivant
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {userProgress.lessonsCompleted.length}
              </Text>
              <Text style={styles.statLabel}>Lecons</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {userProgress.lettersLearned.length}
              </Text>
              <Text style={styles.statLabel}>Lettres</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{userProgress.streak}</Text>
              <Text style={styles.statLabel}>Serie</Text>
            </View>
          </View>

          {/* Modules */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modules d'apprentissage</Text>

            {modules.map((module) => (
              <TouchableOpacity
                key={module.id}
                style={styles.moduleCard}
                onPress={() => navigation.navigate(module.screen)}
              >
                <View style={styles.moduleContent}>
                  <View
                    style={[
                      styles.moduleIcon,
                      { backgroundColor: `${module.color}20` },
                    ]}
                  >
                    <Text style={styles.moduleIconText}>{module.icon}</Text>
                  </View>
                  <View style={styles.moduleInfo}>
                    <View style={styles.moduleHeader}>
                      <Text style={styles.moduleTitle}>{module.title}</Text>
                      <Text style={styles.moduleTitleAr}>{module.titleAr}</Text>
                    </View>
                    <Text style={styles.moduleDescription}>
                      {module.description}
                    </Text>
                    <View style={styles.moduleFooter}>
                      <Text style={styles.moduleCount}>{module.count}</Text>
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
                  <Text style={styles.chevron}>{'>'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Start */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Demarrage rapide</Text>

            <TouchableOpacity
              style={styles.quickStartCard}
              onPress={() => navigation.navigate('Alphabet')}
            >
              <View style={styles.quickStartContent}>
                <Text style={styles.quickStartIcon}>🎯</Text>
                <View style={styles.quickStartInfo}>
                  <Text style={styles.quickStartTitle}>
                    Commencer par l'alphabet
                  </Text>
                  <Text style={styles.quickStartDescription}>
                    La base de tout apprentissage de l'arabe
                  </Text>
                </View>
              </View>
              <View style={styles.quickStartButton}>
                <Text style={styles.quickStartButtonText}>Commencer</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsIcon}>💡</Text>
            <View style={styles.tipsContent}>
              <Text style={styles.tipsTitle}>Conseil du jour</Text>
              <Text style={styles.tipsText}>
                Pratiquez 10 minutes par jour pour un apprentissage efficace.
                La regularite est plus importante que la duree !
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
    paddingTop: 60,
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
});

export default LearnArabicScreen;
