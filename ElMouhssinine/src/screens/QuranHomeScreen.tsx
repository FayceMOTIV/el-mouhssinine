import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, wp, hp } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

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
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
              <Text style={styles.buttonSubtitle}>Page par page</Text>
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
              <Text style={styles.buttonSubtitle}>Récitation audio</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>114 sourates • 6236 versets</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: isSmallScreen ? 12 : 20,
    paddingBottom: isSmallScreen ? 6 : 10,
    alignItems: 'center',
  },
  title: {
    fontSize: isSmallScreen ? 22 : 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  arabicTitle: {
    fontSize: isSmallScreen ? 18 : 24,
    color: colors.accent,
    marginTop: 4,
    fontFamily: 'System',
  },
  rtlText: {
    textAlign: 'right',
  },
  quoteContainer: {
    marginHorizontal: isSmallScreen ? 12 : 20,
    marginVertical: isSmallScreen ? 12 : 20,
    padding: isSmallScreen ? 12 : 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  quoteArabic: {
    fontSize: isSmallScreen ? 16 : 20,
    color: colors.accent,
    textAlign: 'center',
    lineHeight: isSmallScreen ? 26 : 32,
    marginBottom: isSmallScreen ? 8 : 12,
  },
  quoteFr: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: isSmallScreen ? 18 : 20,
  },
  quoteRef: {
    fontSize: isSmallScreen ? 10 : 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: isSmallScreen ? 6 : 8,
  },
  buttonsContainer: {
    flex: 1,
    paddingHorizontal: isSmallScreen ? 12 : 20,
    justifyContent: 'center',
    gap: isSmallScreen ? 12 : 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: isSmallScreen ? 14 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonIcon: {
    fontSize: isSmallScreen ? 28 : 40,
    marginRight: isSmallScreen ? 10 : 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: isSmallScreen ? 14 : 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  buttonTitleAr: {
    fontSize: isSmallScreen ? 13 : 16,
    color: colors.accentText,
    marginTop: 2,
  },
  buttonSubtitle: {
    fontSize: isSmallScreen ? 11 : 13,
    color: colors.textMuted,
    marginTop: isSmallScreen ? 2 : 4,
  },
  footer: {
    paddingVertical: isSmallScreen ? 12 : 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: isSmallScreen ? 11 : 13,
    color: colors.textMuted,
  },
});

export default QuranHomeScreen;
