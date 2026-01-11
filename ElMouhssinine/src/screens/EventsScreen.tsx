import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { subscribeToEvents } from '../services/firebase';
import { useLanguage } from '../context/LanguageContext';
import { eventCategories } from '../data/mockData';

interface Event {
  id: string;
  title: string;
  description: string;
  date: Date | string;
  time: string;
  location: string;
  category?: string;
}

const EventsScreen: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('tous');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToEvents((data) => {
      setEvents(data as Event[]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredEvents =
    selectedCategory === 'tous'
      ? events
      : events.filter(event => event.category === selectedCategory);

  const onRefresh = () => {
    setRefreshing(true);
    // Les données se mettront à jour via le listener Firebase
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return date as string;

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'fr-FR', options);
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'conference':
        return '#4299e1';
      case 'education':
        return '#48bb78';
      case 'communaute':
        return colors.accent;
      case 'ramadan':
        return '#9f7aea';
      default:
        return colors.textMuted;
    }
  };

  const getCategoryLabel = (categoryId?: string) => {
    const cat = eventCategories.find(c => c.id === categoryId);
    if (!cat) return categoryId || '';
    return language === 'ar' ? cat.labelAr : cat.label;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t('events')}</Text>
        <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
          {language === 'ar' ? 'اكتشف أنشطتنا القادمة' : 'Découvrez nos prochaines activités'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={[styles.categoriesContent, isRTL && styles.categoriesContentRTL]}>
        {eventCategories.map(category => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              selectedCategory === category.id && styles.categoryButtonSelected,
            ]}
            onPress={() => setSelectedCategory(category.id)}>
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextSelected,
              ]}>
              {language === 'ar' ? category.labelAr : category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.eventsList}
        contentContainerStyle={styles.eventsContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }>
        {filteredEvents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
              {language === 'ar' ? 'لا توجد أحداث قادمة' : 'Aucun événement à venir'}
            </Text>
          </View>
        ) : (
          filteredEvents.map(event => (
            <TouchableOpacity key={event.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                {event.category && (
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: getCategoryColor(event.category) },
                    ]}>
                    <Text style={styles.categoryBadgeText}>
                      {getCategoryLabel(event.category)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.eventTitle, isRTL && styles.rtlText]}>{event.title}</Text>
              <Text style={[styles.eventDescription, isRTL && styles.rtlText]}>
                {event.description}
              </Text>
              <View style={styles.eventDetails}>
                <View style={[styles.eventDetail, isRTL && styles.eventDetailRTL]}>
                  <Text style={styles.detailIcon}>📅</Text>
                  <Text style={[styles.detailText, isRTL && styles.rtlText]}>
                    {formatDate(event.date)}
                  </Text>
                </View>
                <View style={[styles.eventDetail, isRTL && styles.eventDetailRTL]}>
                  <Text style={styles.detailIcon}>🕐</Text>
                  <Text style={[styles.detailText, isRTL && styles.rtlText]}>{event.time}</Text>
                </View>
                <View style={[styles.eventDetail, isRTL && styles.eventDetailRTL]}>
                  <Text style={styles.detailIcon}>📍</Text>
                  <Text style={[styles.detailText, isRTL && styles.rtlText]}>{event.location}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.registerButton}>
                <Text style={[styles.registerButtonText, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'التسجيل' : "S'inscrire"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  categoriesContainer: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoriesContentRTL: {
    flexDirection: 'row-reverse',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  categoryButtonSelected: {
    backgroundColor: colors.accent,
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: colors.primary,
  },
  eventsList: {
    flex: 1,
  },
  eventsContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  eventHeader: {
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  eventDetails: {
    gap: 8,
    marginBottom: 16,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDetailRTL: {
    flexDirection: 'row-reverse',
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  registerButton: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  registerButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default EventsScreen;
