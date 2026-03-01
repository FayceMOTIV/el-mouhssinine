import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  colors,
  spacing,
  fontSize,
  HEADER_PADDING_TOP,
  borderRadius,
} from '../theme/colors';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  onAccept: () => void;
}

const OnboardingConsentScreen: React.FC<Props> = ({ onAccept }) => {
  const [showPolicy, setShowPolicy] = useState(false);
  const insets = useSafeAreaInsets();

  if (showPolicy) {
    return <PrivacyPolicyScreen onBack={() => setShowPolicy(false)} />;
  }

  const handleAccept = async () => {
    try {
      await AsyncStorage.setItem('rgpd_accepted', new Date().toISOString());
      onAccept();
    } catch (e) {
      Alert.alert(
        'Erreur',
        'Impossible de sauvegarder votre consentement. Veuillez réessayer.',
      );
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bienvenue</Text>
        <Text style={styles.headerSubtitle}>مرحبا بكم</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Protection de vos données</Text>
        <Text style={styles.description}>
          L'application El Mouhssinine collecte certaines données personnelles
          pour fonctionner :
        </Text>

        <View style={styles.dataList}>
          <Text style={styles.dataItem}>
            • Votre nom et email pour l'adhésion
          </Text>
          <Text style={styles.dataItem}>
            • Votre position pour la Qibla et les horaires de prière
          </Text>
          <Text style={styles.dataItem}>
            • Les notifications pour les rappels de prière
          </Text>
          <Text style={styles.dataItem}>
            • Les paiements sécurisés via Stripe
          </Text>
        </View>

        <Text style={styles.description}>
          Vos données ne sont jamais vendues. Vous pouvez supprimer votre compte
          à tout moment.
        </Text>

        <TouchableOpacity
          onPress={() => setShowPolicy(true)}
          style={styles.policyLink}
        >
          <Text style={styles.policyLinkText}>
            Lire la politique de confidentialité complète →
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
          <Text style={styles.acceptButtonText}>J'accepte et je continue</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          En continuant, vous acceptez notre politique de confidentialité
          conformément au RGPD.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: HEADER_PADDING_TOP + 20,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.accentDark,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  description: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  dataList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  dataItem: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 26,
  },
  policyLink: {
    marginTop: spacing.sm,
  },
  policyLinkText: {
    fontSize: fontSize.md,
    color: colors.accent,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.xl,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
  footerNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 16,
  },
});

export default OnboardingConsentScreen;
