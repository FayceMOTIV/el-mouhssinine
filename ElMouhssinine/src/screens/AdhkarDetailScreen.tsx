import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { AdhkarCategory, Dhikr } from '../data/adhkar';
import { useLanguage } from '../context/LanguageContext';

interface AdhkarDetailScreenProps {
  route: any;
  navigation: any;
}

const AdhkarDetailScreen: React.FC<AdhkarDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { t, isRTL } = useLanguage();
  const { category } = route.params as { category: AdhkarCategory };
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [repetitionCounts, setRepetitionCounts] = useState<Record<string, number>>({});

  // Clé de stockage unique par catégorie
  const storageKey = `adhkar_progress_${category.id}`;

  // Charger la progression sauvegardée au montage
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved) {
          const { completed, counts } = JSON.parse(saved);
          if (completed) setCompletedIds(new Set(completed));
          if (counts) setRepetitionCounts(counts);
        }
      } catch (error) {
        // Silencieux - pas de progression sauvegardée
      }
    };
    loadProgress();
  }, [storageKey]);

  // Sauvegarder la progression à chaque changement
  useEffect(() => {
    const saveProgress = async () => {
      try {
        const data = {
          completed: Array.from(completedIds),
          counts: repetitionCounts,
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      } catch (error) {
        // Silencieux - erreur de sauvegarde non critique
      }
    };
    // Sauvegarder seulement si on a des données
    if (completedIds.size > 0 || Object.keys(repetitionCounts).length > 0) {
      saveProgress();
    }
  }, [completedIds, repetitionCounts, storageKey]);

  const handleDhikrPress = (dhikr: Dhikr) => {
    setExpandedId(expandedId === dhikr.id ? null : dhikr.id);
  };

  const handleRepetition = (dhikr: Dhikr) => {
    const currentCount = repetitionCounts[dhikr.id] || 0;
    const newCount = currentCount + 1;

    if (newCount >= dhikr.repetitions) {
      setCompletedIds((prev) => new Set(prev).add(dhikr.id));
      setRepetitionCounts((prev) => ({ ...prev, [dhikr.id]: 0 }));
    } else {
      setRepetitionCounts((prev) => ({ ...prev, [dhikr.id]: newCount }));
    }
  };

  const handleShare = async (dhikr: Dhikr) => {
    try {
      await Share.share({
        message: `${dhikr.arabic}\n\n${dhikr.translation}\n\n(${dhikr.transliteration})\n\nSource: ${dhikr.source}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const resetProgress = async () => {
    setCompletedIds(new Set());
    setRepetitionCounts({});
    // Effacer aussi la sauvegarde
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      // Silencieux
    }
  };

  const completedCount = completedIds.size;
  const totalCount = category?.adhkar?.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {isRTL ? category.nameAr : category.name}
            </Text>
            <Text style={styles.arabicTitle}>
              {isRTL ? category.name : category.nameAr}
            </Text>
            {category.description && (
              <Text style={[styles.description, isRTL && styles.rtlText]}>{category.description}</Text>
            )}
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={[styles.progressHeader, isRTL && styles.progressHeaderRTL]}>
            <Text style={[styles.progressText, isRTL && styles.rtlText]}>
              {completedCount}/{totalCount} {t('completed')}
            </Text>
            {completedCount > 0 && (
              <TouchableOpacity onPress={resetProgress}>
                <Text style={[styles.resetButton, isRTL && styles.rtlText]}>{t('reset')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Adhkar List */}
        <View style={styles.adhkarList}>
          {(category?.adhkar || []).map((dhikr, index) => {
            const isExpanded = expandedId === dhikr.id;
            const isCompleted = completedIds.has(dhikr.id);
            const currentReps = repetitionCounts[dhikr.id] || 0;

            return (
              <TouchableOpacity
                key={dhikr.id}
                style={[
                  styles.dhikrCard,
                  isExpanded && styles.dhikrCardExpanded,
                  isCompleted && styles.dhikrCardCompleted,
                ]}
                onPress={() => handleDhikrPress(dhikr)}
                activeOpacity={0.7}
              >
                {/* Header */}
                <View style={[styles.dhikrHeader, isRTL && styles.dhikrHeaderRTL]}>
                  <View style={styles.dhikrNumber}>
                    <Text style={styles.dhikrNumberText}>{index + 1}</Text>
                  </View>
                  <View style={[styles.dhikrMeta, isRTL && styles.dhikrMetaRTL]}>
                    <Text style={styles.dhikrRepetitions}>
                      {dhikr.repetitions > 1
                        ? `${dhikr.repetitions} ${t('times')}`
                        : `1 ${t('times')}`}
                    </Text>
                    {isCompleted && (
                      <Text style={styles.completedBadge}>{t('done')}</Text>
                    )}
                  </View>
                </View>

                {/* Arabic Text */}
                <Text style={styles.dhikrArabic}>{dhikr.arabic}</Text>

                {/* Expanded Content */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* Transliteration */}
                    <View style={styles.translitSection}>
                      <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>{t('transliteration')}</Text>
                      <Text style={[styles.transliteration, isRTL && styles.rtlText]}>
                        {dhikr.transliteration}
                      </Text>
                    </View>

                    {/* Translation */}
                    <View style={styles.translationSection}>
                      <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>{t('translationLabel')}</Text>
                      <Text style={[styles.translation, isRTL && styles.rtlText]}>{dhikr.translation}</Text>
                    </View>

                    {/* Source */}
                    <View style={styles.sourceSection}>
                      <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>{t('source')}</Text>
                      <Text style={[styles.source, isRTL && styles.rtlText]}>{dhikr.source}</Text>
                    </View>

                    {/* Benefit */}
                    {dhikr.benefit && (
                      <View style={[styles.benefitSection, isRTL && styles.benefitSectionRTL]}>
                        <Text style={styles.benefitIcon}>✨</Text>
                        <Text style={[styles.benefit, isRTL && styles.rtlText]}>{dhikr.benefit}</Text>
                      </View>
                    )}

                    {/* Actions */}
                    <View style={[styles.actions, isRTL && styles.actionsRTL]}>
                      <TouchableOpacity
                        style={[
                          styles.countButton,
                          isCompleted && styles.countButtonCompleted,
                        ]}
                        onPress={() => handleRepetition(dhikr)}
                        disabled={isCompleted}
                      >
                        <Text style={styles.countButtonText}>
                          {isCompleted
                            ? t('finished')
                            : `${currentReps}/${dhikr.repetitions}`}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.shareButton, isRTL && styles.shareButtonRTL]}
                        onPress={() => handleShare(dhikr)}
                      >
                        <Text style={styles.shareButtonIcon}>📤</Text>
                        <Text style={styles.shareButtonText}>{t('share')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Expand indicator */}
                {!isExpanded && (
                  <Text style={[styles.expandIndicator, isRTL && styles.rtlText]}>
                    {t('tapToSeeMore')}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Completion message */}
        {completedCount === totalCount && totalCount > 0 && (
          <View style={styles.completionCard}>
            <Text style={styles.completionIcon}>🎉</Text>
            <Text style={[styles.completionTitle, isRTL && styles.rtlText]}>{t('congratulations')}</Text>
            <Text style={[styles.completionText, isRTL && styles.rtlText]}>
              {t('completionMessage')}
            </Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
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
  description: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  progressSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  resetButton: {
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(201,162,39,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  adhkarList: {
    paddingHorizontal: spacing.lg,
  },
  dhikrCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dhikrCardExpanded: {
    borderColor: colors.accent,
  },
  dhikrCardCompleted: {
    backgroundColor: 'rgba(39,174,96,0.1)',
    borderColor: colors.success,
  },
  dhikrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dhikrNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dhikrNumberText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.accent,
  },
  dhikrMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dhikrRepetitions: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  completedBadge: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: '600',
    backgroundColor: 'rgba(39,174,96,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  dhikrArabic: {
    fontSize: 24,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 44,
  },
  expandIndicator: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  expandedContent: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  translitSection: {
    marginBottom: spacing.md,
  },
  transliteration: {
    fontSize: fontSize.md,
    color: colors.accent,
    fontStyle: 'italic',
  },
  translationSection: {
    marginBottom: spacing.md,
  },
  translation: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  sourceSection: {
    marginBottom: spacing.md,
  },
  source: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  benefitSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  benefitIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  benefit: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.accent,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  countButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  countButtonCompleted: {
    backgroundColor: colors.success,
  },
  countButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#ffffff',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  shareButtonIcon: {
    fontSize: 16,
  },
  shareButtonText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  completionCard: {
    backgroundColor: 'rgba(39,174,96,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(39,174,96,0.3)',
  },
  completionIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  completionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.success,
    marginBottom: spacing.sm,
  },
  completionText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomPadding: {
    height: 100,
  },
  // RTL Styles
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  backButtonRTL: {
    alignSelf: 'flex-end',
  },
  progressHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  dhikrHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  dhikrMetaRTL: {
    flexDirection: 'row-reverse',
  },
  benefitSectionRTL: {
    flexDirection: 'row-reverse',
  },
  actionsRTL: {
    flexDirection: 'row-reverse',
  },
  shareButtonRTL: {
    flexDirection: 'row-reverse',
  },
});

export default AdhkarDetailScreen;
