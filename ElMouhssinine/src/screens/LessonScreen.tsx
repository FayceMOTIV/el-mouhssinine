import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { Lesson, LessonStep } from '../data/lessons';
import { arabicAlphabet } from '../data/alphabet';
import { vowels } from '../data/vowels';
import ProgressBar from '../components/ProgressBar';
import ArabicLetterComponent from '../components/ArabicLetter';

interface LessonScreenProps {
  route: any;
  navigation: any;
}

const LessonScreen: React.FC<LessonScreenProps> = ({ route, navigation }) => {
  const { lesson } = route.params as { lesson: Lesson };
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [completed, setCompleted] = useState(false);

  const currentStep = lesson.steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / lesson.steps.length) * 100;

  const handleNext = () => {
    if (currentStepIndex < lesson.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setCompleted(true);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
    setShowResult(true);

    if (currentStep.type === 'quiz' && answer === currentStep.content.correctAnswer) {
      setCorrectAnswers(correctAnswers + 1);
    }
  };

  const handleFinish = () => {
    const score = (correctAnswers / lesson.steps.filter((s) => s.type === 'quiz').length) * 100;
    Alert.alert(
      'Lecon terminee !',
      `Vous avez obtenu ${Math.round(score)}%\n+${lesson.xp} XP`,
      [
        {
          text: 'Continuer',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const renderStepContent = (step: LessonStep) => {
    switch (step.type) {
      case 'intro':
        return (
          <View style={styles.introContent}>
            <Text style={styles.introTitle}>{step.content.title}</Text>
            <Text style={styles.introText}>{step.content.text}</Text>
          </View>
        );

      case 'letter':
        const letter = arabicAlphabet.find((l) => l.id === step.content.letterId);
        if (!letter) return null;
        return (
          <View style={styles.letterContent}>
            <ArabicLetterComponent letter={letter} showForms size="large" />
            {step.content.explanation && (
              <Text style={styles.explanation}>{step.content.explanation}</Text>
            )}
          </View>
        );

      case 'vowel':
        const vowel = vowels.find((v) => v.id === step.content.vowelId);
        if (!vowel) return null;
        return (
          <View style={styles.vowelContent}>
            <View style={styles.vowelCard}>
              <Text style={styles.vowelSymbol}>{vowel.symbol}</Text>
              <Text style={styles.vowelName}>{vowel.name}</Text>
              <Text style={styles.vowelNameAr}>{vowel.nameAr}</Text>
              <Text style={styles.vowelSound}>/{vowel.sound}/</Text>
            </View>
            {step.content.explanation && (
              <Text style={styles.explanation}>{step.content.explanation}</Text>
            )}
            {vowel.example && (
              <View style={styles.examplesSection}>
                <Text style={styles.examplesTitle}>Exemple</Text>
                <View style={styles.examplesGrid}>
                  <View style={styles.exampleCard}>
                    <Text style={styles.exampleArabic}>{vowel.example}</Text>
                    <Text style={styles.exampleTranslit}>
                      {vowel.exampleSound}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        );

      case 'exercise':
        return (
          <View style={styles.exerciseContent}>
            <Text style={styles.exerciseInstruction}>
              {step.content.instruction}
            </Text>
            {step.content.items && (
              <View style={styles.exerciseItems}>
                {step.content.items.map((item: any, index: number) => (
                  <View key={index} style={styles.exerciseItem}>
                    <Text style={styles.exerciseItemArabic}>{item.arabic}</Text>
                    <Text style={styles.exerciseItemAnswer}>
                      {item.transliteration}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      case 'quiz':
        const isCorrect = selectedAnswer === step.content.correctAnswer;
        return (
          <View style={styles.quizContent}>
            <Text style={styles.quizQuestion}>{step.content.question}</Text>
            {step.content.arabicDisplay && (
              <Text style={styles.quizArabic}>{step.content.arabicDisplay}</Text>
            )}
            <View style={styles.quizOptions}>
              {step.content.options?.map((option: string) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption = option === step.content.correctAnswer;

                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.quizOption,
                      showResult && isCorrectOption && styles.quizOptionCorrect,
                      showResult && isSelected && !isCorrectOption && styles.quizOptionWrong,
                      isSelected && !showResult && styles.quizOptionSelected,
                    ]}
                    onPress={() => handleAnswerSelect(option)}
                    disabled={showResult}
                  >
                    <Text
                      style={[
                        styles.quizOptionText,
                        showResult && isCorrectOption && styles.quizOptionTextCorrect,
                        showResult && isSelected && !isCorrectOption && styles.quizOptionTextWrong,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {showResult && (
              <View
                style={[
                  styles.resultBanner,
                  isCorrect ? styles.resultCorrect : styles.resultWrong,
                ]}
              >
                <Text style={styles.resultIcon}>{isCorrect ? 'Correct !' : 'Incorrect'}</Text>
                {!isCorrect && step.content.explanation && (
                  <Text style={styles.resultExplanation}>
                    {step.content.explanation}
                  </Text>
                )}
              </View>
            )}
          </View>
        );

      case 'summary':
        return (
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>{step.content.title}</Text>
            {step.content.points && (
              <View style={styles.summaryPoints}>
                {step.content.points.map((point: string, index: number) => (
                  <View key={index} style={styles.summaryPoint}>
                    <Text style={styles.summaryBullet}>•</Text>
                    <Text style={styles.summaryPointText}>{point}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  if (completed) {
    const quizSteps = lesson.steps.filter((s) => s.type === 'quiz').length;
    const score = quizSteps > 0 ? (correctAnswers / quizSteps) * 100 : 100;

    return (
      <View style={styles.container}>
        <View style={styles.completedContainer}>
          <Text style={styles.completedIcon}>🎉</Text>
          <Text style={styles.completedTitle}>Lecon terminee !</Text>
          <Text style={styles.completedSubtitle}>{lesson.title}</Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Votre score</Text>
            <Text style={styles.scoreValue}>{Math.round(score)}%</Text>
            <Text style={styles.scoreDetail}>
              {correctAnswers}/{quizSteps} bonnes reponses
            </Text>
          </View>

          <View style={styles.xpEarned}>
            <Text style={styles.xpEarnedLabel}>XP gagnes</Text>
            <Text style={styles.xpEarnedValue}>+{lesson.xp}</Text>
          </View>

          <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
            <Text style={styles.finishButtonText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <ProgressBar progress={progress} height={8} />
          <Text style={styles.progressText}>
            {currentStepIndex + 1}/{lesson.steps.length}
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepContainer}>
          {renderStepContent(currentStep)}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {currentStep.type === 'quiz' ? (
          <TouchableOpacity
            style={[styles.nextButton, !showResult && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!showResult}
          >
            <Text style={styles.nextButtonText}>
              {currentStepIndex === lesson.steps.length - 1
                ? 'Terminer'
                : 'Suivant'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentStepIndex === lesson.steps.length - 1
                ? 'Terminer'
                : 'Suivant'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
    alignItems: 'center',
    gap: spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  progressContainer: {
    flex: 1,
  },
  progressText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  introContent: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  introTitle: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  introText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  letterContent: {
    alignItems: 'center',
  },
  explanation: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 24,
  },
  vowelContent: {
    alignItems: 'center',
  },
  vowelCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    width: '100%',
  },
  vowelSymbol: {
    fontSize: 72,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  vowelName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
  },
  vowelNameAr: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: 4,
  },
  vowelSound: {
    fontSize: fontSize.lg,
    color: colors.accent,
    marginTop: spacing.md,
  },
  examplesSection: {
    marginTop: spacing.xl,
    width: '100%',
  },
  examplesTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  examplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  exampleCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  exampleArabic: {
    fontSize: 28,
    color: colors.accent,
  },
  exampleTranslit: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  exerciseContent: {
    alignItems: 'center',
  },
  exerciseInstruction: {
    fontSize: fontSize.lg,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  exerciseItems: {
    width: '100%',
    gap: spacing.md,
  },
  exerciseItem: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseItemArabic: {
    fontSize: 28,
    color: colors.accent,
  },
  exerciseItemAnswer: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  quizContent: {
    alignItems: 'center',
  },
  quizQuestion: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  quizArabic: {
    fontSize: 48,
    color: colors.accent,
    marginBottom: spacing.xl,
  },
  quizOptions: {
    width: '100%',
    gap: spacing.md,
  },
  quizOption: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quizOptionSelected: {
    borderColor: colors.accent,
  },
  quizOptionCorrect: {
    borderColor: colors.success,
    backgroundColor: 'rgba(39,174,96,0.1)',
  },
  quizOptionWrong: {
    borderColor: colors.error,
    backgroundColor: 'rgba(231,76,60,0.1)',
  },
  quizOptionText: {
    fontSize: fontSize.lg,
    color: colors.text,
    textAlign: 'center',
  },
  quizOptionTextCorrect: {
    color: colors.success,
  },
  quizOptionTextWrong: {
    color: colors.error,
  },
  resultBanner: {
    width: '100%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  resultCorrect: {
    backgroundColor: 'rgba(39,174,96,0.15)',
  },
  resultWrong: {
    backgroundColor: 'rgba(231,76,60,0.15)',
  },
  resultIcon: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  resultExplanation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  summaryContent: {
    paddingVertical: spacing.lg,
  },
  summaryTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  summaryPoints: {
    gap: spacing.md,
  },
  summaryPoint: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  summaryBullet: {
    fontSize: fontSize.lg,
    color: colors.accent,
    marginRight: spacing.md,
  },
  summaryPointText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: 34,
  },
  nextButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: '#ffffff',
  },
  completedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  completedIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  completedTitle: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  completedSubtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  scoreCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xl,
  },
  scoreLabel: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.accent,
  },
  scoreDetail: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  xpEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  xpEarnedLabel: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  xpEarnedValue: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.success,
  },
  finishButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  finishButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default LessonScreen;
