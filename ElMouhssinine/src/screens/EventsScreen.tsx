import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category: string;
}

const events: Event[] = [
  {
    id: '1',
    title: 'Conférence Islamique',
    description:
      'Une conférence sur les fondements de la foi avec Sheikh Mohamed.',
    date: '15 Janvier 2026',
    time: 'Après Maghrib - 19h30',
    location: 'Salle de prière principale',
    category: 'Conférence',
  },
  {
    id: '2',
    title: 'Cours de Tajwid',
    description:
      'Apprentissage des règles de récitation du Coran. Tous niveaux acceptés.',
    date: 'Tous les Samedis',
    time: '14h00 - 15h30',
    location: 'Salle d\'étude',
    category: 'Cours',
  },
  {
    id: '3',
    title: 'Iftar Communautaire',
    description:
      'Rupture du jeûne en communauté pendant le mois de Ramadan.',
    date: 'Durant Ramadan',
    time: 'Au coucher du soleil',
    location: 'Salle polyvalente',
    category: 'Événement',
  },
  {
    id: '4',
    title: 'Cours d\'Arabe',
    description:
      'Initiation à la langue arabe pour débutants et intermédiaires.',
    date: 'Tous les Dimanches',
    time: '10h00 - 12h00',
    location: 'Salle d\'étude',
    category: 'Cours',
  },
  {
    id: '5',
    title: 'Assemblée Générale',
    description:
      'Assemblée générale annuelle de l\'association. Présence des adhérents requise.',
    date: '28 Février 2026',
    time: '15h00 - 18h00',
    location: 'Salle polyvalente',
    category: 'Réunion',
  },
];

const categories = ['Tous', 'Conférence', 'Cours', 'Événement', 'Réunion'];

const EventsScreen: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [refreshing, setRefreshing] = useState(false);

  const filteredEvents =
    selectedCategory === 'Tous'
      ? events
      : events.filter(event => event.category === selectedCategory);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Conférence':
        return '#4299e1';
      case 'Cours':
        return '#48bb78';
      case 'Événement':
        return colors.accent;
      case 'Réunion':
        return '#ed8936';
      default:
        return colors.textMuted;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Événements</Text>
        <Text style={styles.subtitle}>
          Découvrez nos prochaines activités
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}>
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonSelected,
            ]}
            onPress={() => setSelectedCategory(category)}>
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextSelected,
              ]}>
              {category}
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
        {(filteredEvents || []).map(event => (
          <TouchableOpacity key={event.id} style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: getCategoryColor(event.category) },
                ]}>
                <Text style={styles.categoryBadgeText}>{event.category}</Text>
              </View>
            </View>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventDescription}>{event.description}</Text>
            <View style={styles.eventDetails}>
              <View style={styles.eventDetail}>
                <Text style={styles.detailIcon}>📅</Text>
                <Text style={styles.detailText}>{event.date}</Text>
              </View>
              <View style={styles.eventDetail}>
                <Text style={styles.detailIcon}>🕐</Text>
                <Text style={styles.detailText}>{event.time}</Text>
              </View>
              <View style={styles.eventDetail}>
                <Text style={styles.detailIcon}>📍</Text>
                <Text style={styles.detailText}>{event.location}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.registerButton}>
              <Text style={styles.registerButtonText}>S'inscrire</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
});

export default EventsScreen;
