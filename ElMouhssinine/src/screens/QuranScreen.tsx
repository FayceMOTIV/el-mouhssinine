import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { QuranAPI, surahsInfo } from '../services/quranApi';

interface QuranScreenProps {
  navigation: any;
}

const QuranScreen: React.FC<QuranScreenProps> = ({ navigation }) => {
  const [surahs, setSurahs] = useState(surahsInfo);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'meccan' | 'medinan'>('all');

  useEffect(() => {
    loadSurahs();
  }, []);

  const loadSurahs = async () => {
    try {
      setLoading(true);
      const data = await QuranAPI.getAllSurahs();
      // Merge avec nos donnees locales pour avoir les traductions francaises
      const merged = surahsInfo.map((local, index) => ({
        ...local,
        ...(data[index] || {}),
      }));
      setSurahs(merged);
    } catch (error) {
      console.log('Utilisation des donnees hors-ligne');
    } finally {
      setLoading(false);
    }
  };

  const filteredSurahs = surahs.filter((surah) => {
    const matchesSearch =
      surah.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      surah.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      surah.translation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      surah.number.toString().includes(searchQuery);

    const matchesType =
      filterType === 'all' ||
      (filterType === 'meccan' && surah.type === 'Mecquoise') ||
      (filterType === 'medinan' && surah.type === 'Medinoise');

    return matchesSearch && matchesType;
  });

  const handleSurahPress = (surahNumber: number) => {
    navigation.navigate('Surah', { surahNumber });
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Le Saint Coran</Text>
          <Text style={styles.arabicTitle}>القرآن الكريم</Text>
          <Text style={styles.subtitle}>114 sourates</Text>
        </View>

        <View style={styles.content}>
          {/* Barre de recherche */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une sourate..."
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

          {/* Filtres */}
          <View style={styles.filterContainer}>
            {[
              { id: 'all', label: 'Toutes' },
              { id: 'meccan', label: 'Mecquoises' },
              { id: 'medinan', label: 'Medinoises' },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterButton,
                  filterType === filter.id && styles.filterButtonActive,
                ]}
                onPress={() => setFilterType(filter.id as any)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterType === filter.id && styles.filterButtonTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Acces rapide aux sourates populaires */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sourates populaires</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.popularScroll}
            >
              {[1, 36, 55, 56, 67, 112, 113, 114].map((num) => {
                const surah = surahs.find((s) => s.number === num);
                if (!surah) return null;
                return (
                  <TouchableOpacity
                    key={num}
                    style={styles.popularCard}
                    onPress={() => handleSurahPress(num)}
                  >
                    <Text style={styles.popularNumber}>{num}</Text>
                    <Text style={styles.popularName}>{surah.name}</Text>
                    <Text style={styles.popularEnglish}>{surah.englishName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Liste des sourates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {filterType === 'all'
                ? 'Toutes les sourates'
                : filterType === 'meccan'
                ? 'Sourates mecquoises'
                : 'Sourates medinoises'}
              {` (${filteredSurahs.length})`}
            </Text>

            {loading && (
              <ActivityIndicator
                size="large"
                color={colors.accent}
                style={{ marginVertical: 20 }}
              />
            )}

            {filteredSurahs.map((surah) => (
              <TouchableOpacity
                key={surah.number}
                style={styles.surahCard}
                onPress={() => handleSurahPress(surah.number)}
              >
                <View style={styles.surahNumber}>
                  <Text style={styles.surahNumberText}>{surah.number}</Text>
                </View>
                <View style={styles.surahInfo}>
                  <View style={styles.surahNames}>
                    <Text style={styles.surahEnglish}>{surah.englishName}</Text>
                    <Text style={styles.surahTranslation}>{surah.translation}</Text>
                  </View>
                  <View style={styles.surahMeta}>
                    <Text style={styles.surahAyahs}>{surah.ayahs} versets</Text>
                    <View
                      style={[
                        styles.surahTypeBadge,
                        surah.type === 'Mecquoise'
                          ? styles.meccanBadge
                          : styles.medinanBadge,
                      ]}
                    >
                      <Text style={styles.surahTypeText}>{surah.type}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.surahArabic}>{surah.name}</Text>
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
    marginBottom: spacing.md,
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
  filterContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
  },
  filterButtonText: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#ffffff',
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
  popularScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  popularCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginRight: spacing.md,
    width: 120,
    alignItems: 'center',
  },
  popularNumber: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.accent,
  },
  popularName: {
    fontSize: 18,
    color: colors.text,
    marginTop: 4,
  },
  popularEnglish: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  surahCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  surahNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  surahNumberText: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.accent,
  },
  surahInfo: {
    flex: 1,
  },
  surahNames: {
    marginBottom: 4,
  },
  surahEnglish: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  surahTranslation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  surahMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  surahAyahs: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  surahTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  meccanBadge: {
    backgroundColor: 'rgba(201,162,39,0.15)',
  },
  medinanBadge: {
    backgroundColor: 'rgba(39,174,96,0.15)',
  },
  surahTypeText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  surahArabic: {
    fontSize: 22,
    color: colors.accent,
    marginLeft: spacing.md,
  },
});

export default QuranScreen;
