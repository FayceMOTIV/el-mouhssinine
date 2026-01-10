import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { arabicAlphabet, letterGroups, specialLetters, ArabicLetter } from '../data/alphabet';

interface AlphabetScreenProps {
  navigation: any;
}

type ViewMode = 'grid' | 'list' | 'groups';

const AlphabetScreen: React.FC<AlphabetScreenProps> = ({ navigation }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showSpecial, setShowSpecial] = useState(false);

  const handleLetterPress = (letter: ArabicLetter) => {
    navigation.navigate('LetterDetail', { letter });
  };

  const renderGridView = () => (
    <View style={styles.gridContainer}>
      {arabicAlphabet.map((letter) => (
        <TouchableOpacity
          key={letter.id}
          style={styles.gridItem}
          onPress={() => handleLetterPress(letter)}
        >
          <Text style={styles.gridLetter}>{letter.isolated}</Text>
          <Text style={styles.gridName}>{letter.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderListView = () => (
    <View style={styles.listContainer}>
      {arabicAlphabet.map((letter, index) => (
        <TouchableOpacity
          key={letter.id}
          style={styles.listItem}
          onPress={() => handleLetterPress(letter)}
        >
          <View style={styles.listNumber}>
            <Text style={styles.listNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.listInfo}>
            <Text style={styles.listName}>{letter.name}</Text>
            <Text style={styles.listSound}>/{letter.sound}/</Text>
          </View>
          <View style={styles.listForms}>
            <Text style={styles.listFormLetter}>{letter.isolated}</Text>
            <Text style={styles.listFormLetter}>{letter.initial}</Text>
            <Text style={styles.listFormLetter}>{letter.medial}</Text>
            <Text style={styles.listFormLetter}>{letter.final}</Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderGroupsView = () => (
    <View style={styles.groupsContainer}>
      {letterGroups.map((group) => (
        <View key={group.id} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupNameAr}>{group.nameAr}</Text>
          </View>
          <Text style={styles.groupDescription}>{group.description}</Text>
          <View style={styles.groupLetters}>
            {group.letters.map((letterId) => {
              const letter = arabicAlphabet.find((l) => l.id === letterId);
              if (!letter) return null;
              return (
                <TouchableOpacity
                  key={letterId}
                  style={styles.groupLetter}
                  onPress={() => handleLetterPress(letter)}
                >
                  <Text style={styles.groupLetterText}>{letter.isolated}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );

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
            <Text style={styles.title}>Alphabet Arabe</Text>
            <Text style={styles.arabicTitle}>الحروف العربية</Text>
            <Text style={styles.subtitle}>
              {arabicAlphabet.length} lettres fondamentales
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* View Mode Toggle */}
          <View style={styles.viewToggle}>
            {[
              { id: 'grid', label: 'Grille' },
              { id: 'list', label: 'Liste' },
              { id: 'groups', label: 'Groupes' },
            ].map((mode) => (
              <TouchableOpacity
                key={mode.id}
                style={[
                  styles.toggleButton,
                  viewMode === mode.id && styles.toggleButtonActive,
                ]}
                onPress={() => setViewMode(mode.id as ViewMode)}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    viewMode === mode.id && styles.toggleButtonTextActive,
                  ]}
                >
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content based on view mode */}
          {viewMode === 'grid' && renderGridView()}
          {viewMode === 'list' && renderListView()}
          {viewMode === 'groups' && renderGroupsView()}

          {/* Special Letters */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowSpecial(!showSpecial)}
            >
              <Text style={styles.sectionTitle}>Lettres speciales</Text>
              <Text style={styles.expandIcon}>{showSpecial ? '−' : '+'}</Text>
            </TouchableOpacity>

            {showSpecial && (
              <View style={styles.specialLetters}>
                {specialLetters.map((letter) => (
                  <View key={letter.id} style={styles.specialCard}>
                    <View style={styles.specialHeader}>
                      <Text style={styles.specialLetter}>{letter.isolated}</Text>
                      <View>
                        <Text style={styles.specialName}>{letter.name}</Text>
                        <Text style={styles.specialNameAr}>{letter.nameAr}</Text>
                      </View>
                    </View>
                    <Text style={styles.specialDescription}>
                      {letter.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsIcon}>💡</Text>
            <View style={styles.tipsContent}>
              <Text style={styles.tipsTitle}>Conseil</Text>
              <Text style={styles.tipsText}>
                L'arabe s'ecrit de droite a gauche. Chaque lettre peut avoir jusqu'a 4 formes selon sa position dans le mot : isolee, initiale, mediale et finale.
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
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.xl,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  toggleButtonActive: {
    backgroundColor: colors.accent,
  },
  toggleButtonText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  gridItem: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLetter: {
    fontSize: 32,
    color: colors.accent,
  },
  gridName: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  listContainer: {
    marginBottom: spacing.xxl,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  listNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  listNumberText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.accent,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  listSound: {
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  listForms: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  listFormLetter: {
    fontSize: 18,
    color: colors.text,
    width: 24,
    textAlign: 'center',
  },
  chevron: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  groupsContainer: {
    marginBottom: spacing.xxl,
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  groupNameAr: {
    fontSize: fontSize.md,
    color: colors.accent,
  },
  groupDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  groupLetters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  groupLetter: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLetterText: {
    fontSize: 24,
    color: colors.accent,
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
  },
  expandIcon: {
    fontSize: 24,
    color: colors.accent,
  },
  specialLetters: {
    gap: spacing.md,
  },
  specialCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  specialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  specialLetter: {
    fontSize: 36,
    color: colors.accent,
  },
  specialName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  specialNameAr: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  specialDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
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

export default AlphabetScreen;
