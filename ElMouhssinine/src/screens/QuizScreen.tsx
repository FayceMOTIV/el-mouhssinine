import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, wp } from '../theme/colors';
import quizData from '../data/quizData.json';

const { width } = Dimensions.get('window');

type QuestionType = {
  id: number;
  type: 'qcm' | 'vrai_faux';
  question_fr: string;
  question_ar: string;
  choices_fr?: string[];
  choices_ar?: string[];
  correct_index?: number;
  correct?: boolean;
  explication_fr: string;
  explication_ar: string;
};

type Level = 'niveau1_debutant' | 'niveau2_intermediaire' | 'niveau3_avance';

const levels = [
  {
    id: 'niveau1_debutant' as Level,
    title: 'Debutant',
    titleAr: 'مبتدئ',
    description: '40 questions - Bases de l\'Islam',
    icon: '🌱',
    color: '#27ae60',
    questions: quizData.quiz.niveau1_debutant,
  },
  {
    id: 'niveau2_intermediaire' as Level,
    title: 'Intermediaire',
    titleAr: 'متوسط',
    description: '35 questions - Histoire & Fiqh',
    icon: '📚',
    color: '#f39c12',
    questions: quizData.quiz.niveau2_intermediaire,
  },
  {
    id: 'niveau3_avance' as Level,
    title: 'Avance',
    titleAr: 'متقدم',
    description: '35 questions - Sciences islamiques',
    icon: '🏆',
    color: '#e74c3c',
    questions: quizData.quiz.niveau3_avance,
  },
];

const QuizScreen: React.FC = () => {
  const [selectedLevel, setSelectedLevel] = useState<typeof levels[0] | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | boolean | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [quizFinished, setQuizFinished] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  const currentQuestion = selectedLevel?.questions[currentQuestionIndex] as QuestionType | undefined;

  const handleSelectLevel = (level: typeof levels[0]) => {
    setSelectedLevel(level);
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnswered(false);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setQuizFinished(false);
  };

  const handleAnswer = (answer: number | boolean) => {
    if (answered || !currentQuestion) return;

    setSelectedAnswer(answer);
    setAnswered(true);

    let correct = false;
    if (currentQuestion.type === 'qcm') {
      correct = answer === currentQuestion.correct_index;
    } else {
      correct = answer === currentQuestion.correct;
    }

    setIsCorrect(correct);
    if (correct) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (!selectedLevel) return;

    if (currentQuestionIndex < selectedLevel.questions.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setCurrentQuestionIndex((prev) => prev + 1);
        setAnswered(false);
        setSelectedAnswer(null);
        setIsCorrect(null);
      }, 150);
    } else {
      setQuizFinished(true);
    }
  };

  const handleRestart = () => {
    setSelectedLevel(null);
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnswered(false);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setQuizFinished(false);
  };

  const getScoreMessage = () => {
    if (!selectedLevel) return '';
    const percentage = (score / selectedLevel.questions.length) * 100;
    if (percentage >= 90) return 'Excellent ! MashaAllah !';
    if (percentage >= 70) return 'Tres bien ! Continuez ainsi !';
    if (percentage >= 50) return 'Bien ! Vous progressez !';
    return 'Continuez a apprendre, vous y arriverez !';
  };

  // Level Selection Screen
  if (!selectedLevel) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Quiz Islam</Text>
            <Text style={styles.arabicTitle}>اختبار الإسلام</Text>
            <Text style={styles.subtitle}>Testez vos connaissances</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>110</Text>
                <Text style={styles.statLabel}>Questions</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>3</Text>
                <Text style={styles.statLabel}>Niveaux</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>FR/AR</Text>
                <Text style={styles.statLabel}>Bilingue</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Choisissez un niveau</Text>

            {levels.map((level) => (
              <TouchableOpacity
                key={level.id}
                style={styles.levelCard}
                onPress={() => handleSelectLevel(level)}
              >
                <View style={[styles.levelIcon, { backgroundColor: `${level.color}20` }]}>
                  <Text style={styles.levelIconText}>{level.icon}</Text>
                </View>
                <View style={styles.levelInfo}>
                  <View style={styles.levelHeader}>
                    <Text style={styles.levelTitle}>{level.title}</Text>
                    <Text style={styles.levelTitleAr}>{level.titleAr}</Text>
                  </View>
                  <Text style={styles.levelDescription}>{level.description}</Text>
                </View>
                <View style={[styles.levelBadge, { backgroundColor: level.color }]}>
                  <Text style={styles.levelBadgeText}>{level.questions.length}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.tipCard}>
              <Text style={styles.tipIcon}>💡</Text>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Conseil</Text>
                <Text style={styles.tipText}>
                  Commencez par le niveau debutant pour consolider vos bases, puis progressez vers les niveaux superieurs.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Quiz Finished Screen
  if (quizFinished) {
    const percentage = Math.round((score / selectedLevel.questions.length) * 100);
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.finishedContainer}>
          <View style={styles.finishedCard}>
            <Text style={styles.finishedIcon}>
              {percentage >= 70 ? '🎉' : percentage >= 50 ? '👍' : '📖'}
            </Text>
            <Text style={styles.finishedTitle}>Quiz termine !</Text>
            <Text style={styles.finishedSubtitle}>{selectedLevel.title}</Text>

            <View style={styles.scoreCircle}>
              <Text style={styles.scorePercentage}>{percentage}%</Text>
              <Text style={styles.scoreDetail}>
                {score}/{selectedLevel.questions.length}
              </Text>
            </View>

            <Text style={styles.scoreMessage}>{getScoreMessage()}</Text>

            <View style={styles.finishedButtons}>
              <TouchableOpacity
                style={[styles.finishedButton, styles.retryButton]}
                onPress={() => handleSelectLevel(selectedLevel)}
              >
                <Text style={styles.retryButtonText}>Recommencer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.finishedButton, styles.backButton]}
                onPress={handleRestart}
              >
                <Text style={styles.backButtonText}>Autres niveaux</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Quiz Question Screen
  if (!currentQuestion) return null;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Progress Header */}
        <View style={styles.progressHeader}>
          <TouchableOpacity onPress={handleRestart} style={styles.quitButton}>
            <Text style={styles.quitButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              Question {currentQuestionIndex + 1}/{selectedLevel.questions.length}
            </Text>
            <Text style={styles.scoreText}>Score: {score}</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${((currentQuestionIndex + 1) / selectedLevel.questions.length) * 100}%`,
                backgroundColor: selectedLevel.color,
              },
            ]}
          />
        </View>

        <Animated.View style={[styles.questionContainer, { opacity: fadeAnim }]}>
          {/* Question */}
          <View style={styles.questionCard}>
            <View style={styles.questionTypeTag}>
              <Text style={styles.questionTypeText}>
                {currentQuestion.type === 'qcm' ? 'QCM' : 'Vrai/Faux'}
              </Text>
            </View>
            <Text style={styles.questionText}>{currentQuestion.question_fr}</Text>
            <Text style={styles.questionTextAr}>{currentQuestion.question_ar}</Text>
          </View>

          {/* Answers */}
          <View style={styles.answersContainer}>
            {currentQuestion.type === 'qcm' ? (
              currentQuestion.choices_fr?.map((choice, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrectAnswer = index === currentQuestion.correct_index;
                let buttonStyle = styles.answerButton;
                let textStyle = styles.answerText;

                if (answered) {
                  if (isCorrectAnswer) {
                    buttonStyle = { ...buttonStyle, ...styles.correctAnswer };
                    textStyle = { ...textStyle, ...styles.correctAnswerText };
                  } else if (isSelected && !isCorrectAnswer) {
                    buttonStyle = { ...buttonStyle, ...styles.wrongAnswer };
                    textStyle = { ...textStyle, ...styles.wrongAnswerText };
                  }
                } else if (isSelected) {
                  buttonStyle = { ...buttonStyle, ...styles.selectedAnswer };
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={buttonStyle}
                    onPress={() => handleAnswer(index)}
                    disabled={answered}
                  >
                    <View style={styles.answerIndex}>
                      <Text style={styles.answerIndexText}>
                        {String.fromCharCode(65 + index)}
                      </Text>
                    </View>
                    <Text style={textStyle}>{choice}</Text>
                    {answered && isCorrectAnswer && (
                      <Text style={styles.checkMark}>✓</Text>
                    )}
                    {answered && isSelected && !isCorrectAnswer && (
                      <Text style={styles.crossMark}>✕</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.answerButton,
                    styles.booleanButton,
                    answered && currentQuestion.correct === true && styles.correctAnswer,
                    answered && selectedAnswer === true && currentQuestion.correct !== true && styles.wrongAnswer,
                    !answered && selectedAnswer === true && styles.selectedAnswer,
                  ]}
                  onPress={() => handleAnswer(true)}
                  disabled={answered}
                >
                  <Text style={styles.booleanIcon}>✓</Text>
                  <Text style={[
                    styles.answerText,
                    answered && currentQuestion.correct === true && styles.correctAnswerText,
                    answered && selectedAnswer === true && currentQuestion.correct !== true && styles.wrongAnswerText,
                  ]}>Vrai</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.answerButton,
                    styles.booleanButton,
                    answered && currentQuestion.correct === false && styles.correctAnswer,
                    answered && selectedAnswer === false && currentQuestion.correct !== false && styles.wrongAnswer,
                    !answered && selectedAnswer === false && styles.selectedAnswer,
                  ]}
                  onPress={() => handleAnswer(false)}
                  disabled={answered}
                >
                  <Text style={styles.booleanIcon}>✕</Text>
                  <Text style={[
                    styles.answerText,
                    answered && currentQuestion.correct === false && styles.correctAnswerText,
                    answered && selectedAnswer === false && currentQuestion.correct !== false && styles.wrongAnswerText,
                  ]}>Faux</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Explanation (shown after answering) */}
          {answered && (
            <View style={[styles.explanationCard, isCorrect ? styles.explanationCorrect : styles.explanationWrong]}>
              <Text style={styles.explanationHeader}>
                {isCorrect ? '✅ Correct !' : '❌ Incorrect'}
              </Text>
              <Text style={styles.explanationText}>{currentQuestion.explication_fr}</Text>
              <Text style={styles.explanationTextAr}>{currentQuestion.explication_ar}</Text>
            </View>
          )}

          {/* Next Button */}
          {answered && (
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: selectedLevel.color }]}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>
                {currentQuestionIndex < selectedLevel.questions.length - 1
                  ? 'Question suivante'
                  : 'Voir le resultat'}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
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
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.accent,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.md,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  levelIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  levelIconText: {
    fontSize: 28,
  },
  levelInfo: {
    flex: 1,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  levelTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  levelTitleAr: {
    fontSize: fontSize.md,
    color: colors.accent,
  },
  levelDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  levelBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  levelBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: '#fff',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
  },
  tipIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  tipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // Progress Header
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  quitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitButtonText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  progressInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: spacing.md,
  },
  progressText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: fontSize.md,
    color: colors.accent,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: spacing.lg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  questionContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  questionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  questionTypeTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,162,39,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  questionTypeText: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: '600',
  },
  questionText: {
    fontSize: fontSize.lg,
    color: colors.text,
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  questionTextAr: {
    fontSize: fontSize.lg,
    color: colors.accent,
    textAlign: 'right',
    lineHeight: 32,
  },
  answersContainer: {
    gap: spacing.md,
  },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  booleanButton: {
    justifyContent: 'center',
  },
  booleanIcon: {
    fontSize: 20,
    marginRight: spacing.md,
    color: colors.textMuted,
  },
  selectedAnswer: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(201,162,39,0.1)',
  },
  correctAnswer: {
    borderColor: '#27ae60',
    backgroundColor: 'rgba(39,174,96,0.1)',
  },
  wrongAnswer: {
    borderColor: '#e74c3c',
    backgroundColor: 'rgba(231,76,60,0.1)',
  },
  answerIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  answerIndexText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textMuted,
  },
  answerText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  correctAnswerText: {
    color: '#27ae60',
    fontWeight: '600',
  },
  wrongAnswerText: {
    color: '#e74c3c',
  },
  checkMark: {
    fontSize: 20,
    color: '#27ae60',
    fontWeight: 'bold',
  },
  crossMark: {
    fontSize: 20,
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  explanationCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
  },
  explanationCorrect: {
    backgroundColor: 'rgba(39,174,96,0.1)',
    borderColor: 'rgba(39,174,96,0.3)',
  },
  explanationWrong: {
    backgroundColor: 'rgba(231,76,60,0.1)',
    borderColor: 'rgba(231,76,60,0.3)',
  },
  explanationHeader: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  explanationText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  explanationTextAr: {
    fontSize: fontSize.md,
    color: colors.accent,
    textAlign: 'right',
    lineHeight: 28,
  },
  nextButton: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  nextButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  // Finished Screen
  finishedContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  finishedCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  finishedIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  finishedTitle: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  finishedSubtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  scoreCircle: {
    width: wp(36),
    height: wp(36),
    borderRadius: wp(18),
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderWidth: 4,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  scorePercentage: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.accent,
  },
  scoreDetail: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: 4,
  },
  scoreMessage: {
    fontSize: fontSize.lg,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  finishedButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  finishedButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  retryButton: {
    backgroundColor: colors.accent,
  },
  retryButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
});

export default QuizScreen;
