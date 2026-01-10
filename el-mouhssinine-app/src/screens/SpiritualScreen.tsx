import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { Sourate, Dua } from '../types';

const SpiritualScreen = () => {
  const [selectedSourate, setSelectedSourate] = useState<number | null>(null);

  const sourates: Sourate[] = [
    { id: 1, name: 'Al-Fatiha', nameAr: 'الفاتحة', verses: 7, type: 'Mecquoise' },
    { id: 36, name: 'Ya-Sin', nameAr: 'يس', verses: 83, type: 'Mecquoise' },
    { id: 55, name: 'Ar-Rahman', nameAr: 'الرحمن', verses: 78, type: 'Médinoise' },
    { id: 56, name: "Al-Waqi'a", nameAr: 'الواقعة', verses: 96, type: 'Mecquoise' },
    { id: 67, name: 'Al-Mulk', nameAr: 'الملك', verses: 30, type: 'Mecquoise' },
    { id: 112, name: 'Al-Ikhlas', nameAr: 'الإخلاص', verses: 4, type: 'Mecquoise' },
    { id: 113, name: 'Al-Falaq', nameAr: 'الفلق', verses: 5, type: 'Mecquoise' },
    { id: 114, name: 'An-Nas', nameAr: 'الناس', verses: 6, type: 'Mecquoise' },
  ];

  const duas: Dua[] = [
    { id: 1, name: 'Adhkar du matin', nameAr: 'أذكار الصباح', icon: '🌅', count: 12 },
    { id: 2, name: 'Adhkar du soir', nameAr: 'أذكار المساء', icon: '🌆', count: 12 },
    { id: 3, name: 'Après la prière', nameAr: 'بعد الصلاة', icon: '🤲', count: 8 },
    { id: 4, name: 'Avant de dormir', nameAr: 'قبل النوم', icon: '😴', count: 6 },
    { id: 5, name: 'Protection', nameAr: 'الحماية', icon: '🛡️', count: 5 },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📖 Spirituel</Text>
          <Text style={styles.subtitle}>Coran & Invocations</Text>
        </View>

        <View style={styles.content}>
          {/* Section Coran */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📖 Lecture du Coran</Text>
            
            {/* Continuer la lecture */}
            <View style={styles.continueCard}>
              <Text style={styles.continueLabel}>Continuer la lecture</Text>
              <Text style={styles.continueSourate}>Sourate Al-Baqara</Text>
              <Text style={styles.continueVerset}>Verset 142 / 286</Text>
              
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '49%' }]} />
              </View>
              
              <TouchableOpacity style={styles.continueBtn}>
                <Text style={styles.continueBtnText}>▶️ Reprendre</Text>
              </TouchableOpacity>
            </View>

            {/* Sourates populaires */}
            <Text style={styles.subsectionTitle}>Sourates populaires</Text>
            {sourates.map((sourate) => (
              <TouchableOpacity
                key={sourate.id}
                style={styles.sourateCard}
                onPress={() => setSelectedSourate(sourate.id)}
              >
                <View style={styles.sourateNumber}>
                  <Text style={styles.sourateNumberText}>{sourate.id}</Text>
                </View>
                <View style={styles.sourateInfo}>
                  <Text style={styles.sourateName}>{sourate.name}</Text>
                  <Text style={styles.sourateDetails}>
                    {sourate.verses} versets • {sourate.type}
                  </Text>
                </View>
                <Text style={styles.sourateArabic}>{sourate.nameAr}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Section Invocations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🤲 Invocations (Duas)</Text>
            {duas.map((dua) => (
              <TouchableOpacity key={dua.id} style={styles.duaCard}>
                <View style={styles.duaIcon}>
                  <Text style={styles.duaIconText}>{dua.icon}</Text>
                </View>
                <View style={styles.duaInfo}>
                  <Text style={styles.duaName}>{dua.name}</Text>
                  <Text style={styles.duaCount}>{dua.count} invocations</Text>
                </View>
                <Text style={styles.duaArrow}>→</Text>
              </TouchableOpacity>
            ))}
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
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
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
  subsectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  continueCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  continueLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 4,
  },
  continueSourate: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  continueVerset: {
    fontSize: fontSize.sm,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e8e8ed',
    borderRadius: 3,
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  continueBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: 20,
  },
  continueBtnText: {
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  sourateCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sourateNumber: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sourateNumberText: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.accent,
  },
  sourateInfo: {
    flex: 1,
  },
  sourateName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  sourateDetails: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  sourateArabic: {
    fontSize: 20,
    color: colors.accent,
  },
  duaCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  duaIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  duaIconText: {
    fontSize: 22,
  },
  duaInfo: {
    flex: 1,
  },
  duaName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  duaCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  duaArrow: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
});

export default SpiritualScreen;
