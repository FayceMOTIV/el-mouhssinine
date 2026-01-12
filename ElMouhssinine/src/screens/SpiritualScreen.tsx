import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';

interface SpiritualScreenProps {
  navigation: any;
}

const SpiritualScreen: React.FC<SpiritualScreenProps> = ({ navigation }) => {
  const modules = [
    {
      id: 'quran',
      title: 'Le Saint Coran',
      titleAr: 'القرآن الكريم',
      description: '114 sourates avec traduction francaise',
      icon: '📖',
      screen: 'Quran',
      color: colors.accent,
    },
    {
      id: 'adhkar',
      title: 'Invocations',
      titleAr: 'الأذكار',
      description: 'Adhkar du matin, soir et plus',
      icon: '🤲',
      screen: 'Adhkar',
      color: '#27ae60',
    },
    {
      id: 'quiz',
      title: 'Quiz Islam',
      titleAr: 'اختبار الإسلام',
      description: '110 questions sur 3 niveaux',
      icon: '🎓',
      screen: 'Quiz',
      color: '#9b59b6',
    },
    {
      id: 'learnArabic',
      title: "Apprendre l'Arabe",
      titleAr: 'تعلم العربية',
      description: 'Alphabet, lecons et vocabulaire',
      icon: 'ا ب ت',
      screen: 'LearnArabic',
      color: '#3498db',
    },
  ];

  const quickAccess = [
    { id: 1, name: 'Al-Fatiha', nameAr: 'الفاتحة', surahNumber: 1 },
    { id: 36, name: 'Ya-Sin', nameAr: 'يس', surahNumber: 36 },
    { id: 55, name: 'Ar-Rahman', nameAr: 'الرحمن', surahNumber: 55 },
    { id: 67, name: 'Al-Mulk', nameAr: 'الملك', surahNumber: 67 },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Islam</Text>
          <Text style={styles.arabicTitle}>الإسلام</Text>
          <Text style={styles.subtitle}>Coran, Invocations, Quiz & Apprentissage</Text>
        </View>

        <View style={styles.content}>
          {/* Main Modules */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modules</Text>
            {modules.map((module) => (
              <TouchableOpacity
                key={module.id}
                style={styles.moduleCard}
                onPress={() => navigation.navigate(module.screen)}
              >
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
                </View>
                <Text style={styles.chevron}>{'>'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Access */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Acces rapide</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Quran')}>
                <Text style={styles.seeAllText}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickAccessScroll}
            >
              {quickAccess.map((surah) => (
                <TouchableOpacity
                  key={surah.id}
                  style={styles.quickAccessCard}
                  onPress={() =>
                    navigation.navigate('Surah', { surahNumber: surah.surahNumber })
                  }
                >
                  <Text style={styles.quickAccessNumber}>{surah.id}</Text>
                  <Text style={styles.quickAccessArabic}>{surah.nameAr}</Text>
                  <Text style={styles.quickAccessName}>{surah.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Daily Reminder */}
          <View style={styles.reminderCard}>
            <Text style={styles.reminderIcon}>💡</Text>
            <View style={styles.reminderContent}>
              <Text style={styles.reminderTitle}>Rappel du jour</Text>
              <Text style={styles.reminderText}>
                "Certes, c'est dans l'evocation d'Allah que les coeurs se
                tranquillisent."
              </Text>
              <Text style={styles.reminderSource}>Sourate Ar-Ra'd, 28</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Votre progression</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Sourates lues</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Lettres apprises</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Jours de suite</Text>
              </View>
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
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.md,
  },
  seeAllText: {
    fontSize: fontSize.sm,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  quickAccessScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  quickAccessCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginRight: spacing.md,
    width: 100,
    alignItems: 'center',
  },
  quickAccessNumber: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.accent,
  },
  quickAccessArabic: {
    fontSize: 20,
    color: colors.text,
    marginTop: 4,
  },
  quickAccessName: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  reminderCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
  },
  reminderIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  reminderText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  reminderSource: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
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
    textAlign: 'center',
  },
});

export default SpiritualScreen;
