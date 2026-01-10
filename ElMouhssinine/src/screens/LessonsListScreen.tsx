import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { lessons, levels, getUserProgress, Lesson } from '../data/lessons';
import ProgressBar from '../components/ProgressBar';

interface LessonsListScreenProps {
  navigation: any;
}

const LessonsListScreen: React.FC<LessonsListScreenProps> = ({ navigation }) => {
  const [userProgress] = useState(getUserProgress());
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  const isLessonCompleted = (lessonId: string) => {
    return userProgress.lessonsCompleted.includes(lessonId);
  };

  const isLessonAvailable = (lesson: Lesson, index: number) => {
    // First lesson is always available
    if (index === 0) return true;
    // Subsequent lessons require previous one to be completed
    const previousLesson = lessons[index - 1];
    return isLessonCompleted(previousLesson.id);
  };

  const getFilteredLessons = () => {
    if (!selectedLevel) return lessons;
    return lessons.filter((lesson) => lesson.level === selectedLevel);
  };

  const handleLessonPress = (lesson: Lesson, index: number) => {
    if (isLessonAvailable(lesson, index)) {
      navigation.navigate('Lesson', { lesson });
    }
  };

  const completedCount = userProgress.lessonsCompleted.length;
  const totalCount = lessons.length;
  const overallProgress = (completedCount / totalCount) * 100;

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
            <Text style={styles.title}>Lecons</Text>
            <Text style={styles.arabicTitle}>الدروس</Text>
            <Text style={styles.subtitle}>
              {lessons.length} lecons disponibles
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Overall Progress */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Progression globale</Text>
              <Text style={styles.progressCount}>
                {completedCount}/{totalCount}
              </Text>
            </View>
            <ProgressBar progress={overallProgress} height={12} showLabel />
          </View>

          {/* Level Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.levelFilter}
          >
            <TouchableOpacity
              style={[
                styles.levelButton,
                !selectedLevel && styles.levelButtonActive,
              ]}
              onPress={() => setSelectedLevel(null)}
            >
              <Text
                style={[
                  styles.levelButtonText,
                  !selectedLevel && styles.levelButtonTextActive,
                ]}
              >
                Toutes
              </Text>
            </TouchableOpacity>
            {levels.map((level) => (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.levelButton,
                  selectedLevel === level.id && styles.levelButtonActive,
                ]}
                onPress={() => setSelectedLevel(level.id)}
              >
                <Text
                  style={[
                    styles.levelButtonText,
                    selectedLevel === level.id && styles.levelButtonTextActive,
                  ]}
                >
                  {level.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Lessons List */}
          <View style={styles.lessonsList}>
            {getFilteredLessons().map((lesson, index) => {
              const completed = isLessonCompleted(lesson.id);
              const available = isLessonAvailable(lesson, index);
              const level = levels.find((l) => l.id === lesson.level);

              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={[
                    styles.lessonCard,
                    completed && styles.lessonCardCompleted,
                    !available && styles.lessonCardLocked,
                  ]}
                  onPress={() => handleLessonPress(lesson, index)}
                  disabled={!available}
                >
                  <View style={styles.lessonHeader}>
                    <View
                      style={[
                        styles.lessonNumber,
                        completed && styles.lessonNumberCompleted,
                        !available && styles.lessonNumberLocked,
                      ]}
                    >
                      {completed ? (
                        <Text style={styles.checkmark}>OK</Text>
                      ) : !available ? (
                        <Text style={styles.lockIcon}>🔒</Text>
                      ) : (
                        <Text style={styles.lessonNumberText}>{lesson.order}</Text>
                      )}
                    </View>
                    <View style={styles.lessonInfo}>
                      <View style={styles.lessonTitleRow}>
                        <Text
                          style={[
                            styles.lessonTitle,
                            !available && styles.lessonTitleLocked,
                          ]}
                        >
                          {lesson.title}
                        </Text>
                      </View>
                      <Text style={styles.lessonTitleAr}>{lesson.titleAr}</Text>
                      <View style={styles.lessonMeta}>
                        <View style={styles.levelBadge}>
                          <Text style={styles.levelBadgeText}>
                            {level?.name}
                          </Text>
                        </View>
                        <Text style={styles.lessonDuration}>
                          {lesson.duration}
                        </Text>
                        <Text style={styles.lessonXP}>+{lesson.xp} XP</Text>
                      </View>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.lessonDescription,
                      !available && styles.lessonDescriptionLocked,
                    ]}
                    numberOfLines={2}
                  >
                    {lesson.description}
                  </Text>
                  {available && !completed && (
                    <View style={styles.startButton}>
                      <Text style={styles.startButtonText}>Commencer</Text>
                    </View>
                  )}
                  {completed && (
                    <View style={styles.reviewButton}>
                      <Text style={styles.reviewButtonText}>Reviser</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📚</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Progression</Text>
              <Text style={styles.infoText}>
                Completez chaque lecon pour debloquer la suivante. Les lecons
                sont concues pour etre faites dans l'ordre pour un apprentissage
                optimal.
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
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
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
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  progressCount: {
    fontSize: fontSize.md,
    color: colors.accent,
    fontWeight: '600',
  },
  levelFilter: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  levelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  levelButtonActive: {
    backgroundColor: colors.accent,
  },
  levelButtonText: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  levelButtonTextActive: {
    color: '#ffffff',
  },
  lessonsList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  lessonCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lessonCardCompleted: {
    borderColor: colors.success,
    backgroundColor: 'rgba(39,174,96,0.05)',
  },
  lessonCardLocked: {
    opacity: 0.6,
  },
  lessonHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  lessonNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  lessonNumberCompleted: {
    backgroundColor: colors.success,
  },
  lessonNumberLocked: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  lessonNumberText: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.accent,
  },
  checkmark: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  lockIcon: {
    fontSize: 16,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lessonTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  lessonTitleLocked: {
    color: colors.textMuted,
  },
  lessonTitleAr: {
    fontSize: fontSize.md,
    color: colors.accent,
    marginTop: 2,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  levelBadge: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  levelBadgeText: {
    fontSize: fontSize.xs,
    color: colors.accent,
  },
  lessonDuration: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  lessonXP: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: '600',
  },
  lessonDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  lessonDescriptionLocked: {
    color: colors.textMuted,
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#ffffff',
  },
  reviewButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  reviewButtonText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default LessonsListScreen;
