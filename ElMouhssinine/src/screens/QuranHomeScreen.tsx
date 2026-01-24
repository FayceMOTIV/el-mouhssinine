import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';

type RootStackParamList = {
  QuranHome: undefined;
  Quran: undefined;
  QuranRead: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const QuranHomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { t, isRTL } = useLanguage();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t('quran')}
        </Text>
        <Text style={[styles.arabicTitle, isRTL && styles.rtlText]}>
          القرآن الكريم
        </Text>
      </View>

      {/* Citation */}
      <View style={styles.quoteContainer}>
        <Text style={styles.quoteArabic}>
          إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ
        </Text>
        <Text style={styles.quoteFr}>
          "C'est Nous qui avons fait descendre le Rappel, et c'est Nous qui en sommes gardien"
        </Text>
        <Text style={styles.quoteRef}>- Sourate Al-Hijr, verset 9</Text>
      </View>

      {/* Boutons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('QuranRead')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonIcon}>📖</Text>
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonTitle}>Lire le Coran</Text>
            <Text style={styles.buttonTitleAr}>قراءة القرآن</Text>
            <Text style={styles.buttonSubtitle}>Page par page comme un Mushaf</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Quran')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonIcon}>🎧</Text>
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonTitle}>Écouter le Coran</Text>
            <Text style={styles.buttonTitleAr}>الاستماع للقرآن</Text>
            <Text style={styles.buttonSubtitle}>Récitation audio des sourates</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>114 sourates • 6236 versets</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textOnDark,
  },
  arabicTitle: {
    fontSize: 24,
    color: colors.accent,
    marginTop: 4,
    fontFamily: 'System',
  },
  rtlText: {
    textAlign: 'right',
  },
  quoteContainer: {
    marginHorizontal: 20,
    marginVertical: 20,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  quoteArabic: {
    fontSize: 20,
    color: colors.accent,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
  },
  quoteFr: {
    fontSize: 14,
    color: colors.textOnDark,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  quoteRef: {
    fontSize: 12,
    color: colors.textOnDarkMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  buttonsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  buttonTitleAr: {
    fontSize: 16,
    color: colors.accent,
    marginTop: 2,
  },
  buttonSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: colors.textOnDarkMuted,
  },
});

export default QuranHomeScreen;
