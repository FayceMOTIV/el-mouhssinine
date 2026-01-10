import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { adhkarCategories, AdhkarCategory } from '../data/adhkar';

interface AdhkarScreenProps {
  navigation: any;
}

const categoryIcons: Record<string, string> = {
  morning: '🌅',
  evening: '🌙',
  afterPrayer: '🤲',
  sleep: '😴',
  wakeup: '⏰',
  protection: '🛡️',
  travel: '✈️',
  food: '🍽️',
  mosque: '🕌',
  rain: '🌧️',
};

const AdhkarScreen: React.FC<AdhkarScreenProps> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = adhkarCategories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.nameAr.includes(searchQuery) ||
    category.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCategoryPress = (category: AdhkarCategory) => {
    navigation.navigate('AdhkarDetail', { category });
  };

  const getTotalAdhkar = () => {
    return adhkarCategories.reduce((total, cat) => total + cat.adhkar.length, 0);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Invocations</Text>
          <Text style={styles.arabicTitle}>الأذكار</Text>
          <Text style={styles.subtitle}>
            {adhkarCategories.length} categories - {getTotalAdhkar()} invocations
          </Text>
        </View>

        <View style={styles.content}>
          {/* Barre de recherche */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une categorie..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Acces rapide */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acces rapide</Text>
            <View style={styles.quickAccessGrid}>
              {['morning', 'evening', 'afterPrayer', 'sleep'].map((id) => {
                const category = adhkarCategories.find((c) => c.id === id);
                if (!category) return null;
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.quickAccessCard}
                    onPress={() => handleCategoryPress(category)}
                  >
                    <Text style={styles.quickAccessIcon}>
                      {categoryIcons[id]}
                    </Text>
                    <Text style={styles.quickAccessName}>{category.name}</Text>
                    <Text style={styles.quickAccessCount}>
                      {category.adhkar.length} invocations
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Toutes les categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Toutes les categories ({filteredCategories.length})
            </Text>

            {filteredCategories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryCard}
                onPress={() => handleCategoryPress(category)}
              >
                <View style={styles.categoryIcon}>
                  <Text style={styles.categoryIconText}>
                    {categoryIcons[category.id] || '📿'}
                  </Text>
                </View>
                <View style={styles.categoryInfo}>
                  <View style={styles.categoryNames}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryNameAr}>{category.nameAr}</Text>
                  </View>
                  {category.description && (
                    <Text style={styles.categoryDescription} numberOfLines={2}>
                      {category.description}
                    </Text>
                  )}
                  <Text style={styles.categoryCount}>
                    {category.adhkar.length} invocations
                  </Text>
                </View>
                <Text style={styles.chevron}>{'>'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>💡</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Le merite du dhikr</Text>
              <Text style={styles.infoText}>
                Le Prophete (paix et benedictions sur lui) a dit : "Les paroles les plus aimees d'Allah sont quatre : SubhanAllah, Alhamdulillah, La ilaha illa Allah et Allahou Akbar."
              </Text>
              <Text style={styles.infoSource}>Rapporte par Muslim</Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  clearIcon: {
    fontSize: 16,
    color: colors.textMuted,
    padding: spacing.sm,
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
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickAccessCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  quickAccessIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  quickAccessName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  quickAccessCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  categoryIconText: {
    fontSize: 24,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryNames: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  categoryName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  categoryNameAr: {
    fontSize: fontSize.md,
    color: colors.accent,
  },
  categoryDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
    marginLeft: spacing.sm,
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
  infoSource: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});

export default AdhkarScreen;
