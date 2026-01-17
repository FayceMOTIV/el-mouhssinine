import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, wp } from '../theme/colors';
import { QuranAPI, surahsInfo } from '../services/quranApi';
import { useLanguage } from '../context/LanguageContext';
import { SkeletonLoader } from '../components';

interface QuranScreenProps {
  navigation: any;
}

const QuranScreen: React.FC<QuranScreenProps> = ({ navigation }) => {
  const { t, isRTL } = useLanguage();
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

  const handleSurahPress = useCallback((surahNumber: number) => {
    navigation.navigate('Surah', { surahNumber });
  }, [navigation]);

  const renderSurahItem = useCallback(({ item: surah }: { item: typeof surahsInfo[0] }) => (
    <TouchableOpacity
      style={[styles.surahCard, isRTL && styles.surahCardRTL]}
      onPress={() => handleSurahPress(surah.number)}
      accessibilityLabel={`Sourate ${surah.number}, ${surah.translation || surah.englishName}, ${surah.ayahs || surah.numberOfAyahs} versets`}
      accessibilityRole="button"
      accessibilityHint="Appuyez pour lire cette sourate"
    >
      <View style={styles.surahNumber}>
        <Text style={styles.surahNumberText}>{surah.number}</Text>
      </View>
      <View style={styles.surahInfo}>
        <View style={styles.surahNames}>
          <Text style={[styles.surahEnglish, isRTL && styles.rtlText]}>{surah.englishName}</Text>
          <Text style={[styles.surahTranslation, isRTL && styles.rtlText]}>{surah.translation}</Text>
        </View>
        <View style={[styles.surahMeta, isRTL && styles.surahMetaRTL]}>
          <Text style={styles.surahAyahs}>{surah.ayahs} {t('verses')}</Text>
          <View
            style={[
              styles.surahTypeBadge,
              surah.type === 'Mecquoise'
                ? styles.meccanBadge
                : styles.medinanBadge,
            ]}
          >
            <Text style={styles.surahTypeText}>
              {surah.type === 'Mecquoise' ? t('meccan') : t('medinan')}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.surahArabic}>{surah.name}</Text>
    </TouchableOpacity>
  ), [isRTL, t, handleSurahPress]);

  const ListHeaderComponent = useCallback(() => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t('quranTitle')}</Text>
        <Text style={styles.arabicTitle}>{t('quranArabicTitle')}</Text>
        <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('surahsCount')}</Text>
      </View>

      <View style={styles.content}>
        {/* Barre de recherche */}
        <View style={[styles.searchContainer, isRTL && styles.searchContainerRTL]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, isRTL && styles.rtlText]}
            placeholder={t('searchSurah')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign={isRTL ? 'right' : 'left'}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filtres */}
        <View style={[styles.filterContainer, isRTL && styles.filterContainerRTL]}>
          {[
            { id: 'all', labelKey: 'allFilter' },
            { id: 'meccan', labelKey: 'meccanFilter' },
            { id: 'medinan', labelKey: 'medinanFilter' },
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
                {t(filter.labelKey as any)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Acces rapide aux sourates populaires */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t('popularSurahs')}</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[1, 36, 55, 56, 67, 112, 113, 114]}
            keyExtractor={(num) => num.toString()}
            style={[styles.popularScroll, isRTL && { transform: [{ scaleX: -1 }] }]}
            renderItem={({ item: num }) => {
              const surah = surahs.find((s) => s.number === num);
              if (!surah) return null;
              return (
                <TouchableOpacity
                  style={[styles.popularCard, isRTL && { transform: [{ scaleX: -1 }] }]}
                  onPress={() => handleSurahPress(num)}
                >
                  <Text style={styles.popularNumber}>{num}</Text>
                  <Text style={styles.popularName}>{surah.name}</Text>
                  <Text style={[styles.popularEnglish, isRTL && styles.rtlText]}>{surah.englishName}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Titre liste des sourates */}
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {filterType === 'all'
              ? t('allSurahsList')
              : filterType === 'meccan'
              ? t('meccanSurahsList')
              : t('medinanSurahsList')}
            {` (${filteredSurahs.length})`}
          </Text>
        </View>

        {loading && (
          <View style={{ gap: spacing.md }}>
            {[...Array(8)].map((_, i) => (
              <View key={i} style={[styles.surahCard, { flexDirection: 'row', alignItems: 'center' }]}>
                <SkeletonLoader width={50} height={50} borderRadius={25} />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <SkeletonLoader width="60%" height={18} borderRadius={4} />
                  <SkeletonLoader width="40%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
                </View>
                <SkeletonLoader width={30} height={30} borderRadius={15} />
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  ), [isRTL, t, searchQuery, filterType, surahs, filteredSurahs.length, loading, handleSurahPress]);

  const keyExtractor = useCallback((item: typeof surahsInfo[0]) => item.number.toString(), []);

  return (
    <View style={styles.container}>
      <FlatList
        data={loading ? [] : filteredSurahs}
        renderItem={renderSurahItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(_, index) => ({
          length: 76, // Approximate height of each surah card
          offset: 76 * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionTitleContainer: {
    marginBottom: spacing.md,
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
    width: wp(30),
    minWidth: 100,
    maxWidth: 140,
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
  // RTL Styles
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  searchContainerRTL: {
    flexDirection: 'row-reverse',
  },
  filterContainerRTL: {
    flexDirection: 'row-reverse',
  },
  surahCardRTL: {
    flexDirection: 'row-reverse',
  },
  surahMetaRTL: {
    flexDirection: 'row-reverse',
  },
});

export default QuranScreen;
