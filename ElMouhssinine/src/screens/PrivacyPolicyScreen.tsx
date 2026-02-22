import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, HEADER_PADDING_TOP } from '../theme/colors';

interface Props {
  onBack?: () => void;
}

const PrivacyPolicyScreen: React.FC<Props> = ({ onBack }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Politique de confidentialité</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.lastUpdate}>Dernière mise à jour : février 2025</Text>

        <Text style={styles.sectionTitle}>1. Responsable du traitement</Text>
        <Text style={styles.paragraph}>
          Association El Mouhssinine, mosquée située en France. Contact : via la messagerie de l'application.
        </Text>

        <Text style={styles.sectionTitle}>2. Données collectées</Text>
        <Text style={styles.paragraph}>
          • Identité : nom, prénom, email, téléphone{'\n'}
          • Localisation : calcul de la Qibla et horaires de prière (non stockée sur nos serveurs){'\n'}
          • Paiements : gérés par Stripe (nous ne stockons pas vos données bancaires){'\n'}
          • Token de notification : pour les rappels de prière et messages{'\n'}
          • Photo de profil (optionnelle)
        </Text>

        <Text style={styles.sectionTitle}>3. Finalités</Text>
        <Text style={styles.paragraph}>
          • Gestion des adhésions et cotisations{'\n'}
          • Envoi de notifications de prière{'\n'}
          • Communication entre l'association et ses membres{'\n'}
          • Calcul des horaires de prière et direction de la Qibla
        </Text>

        <Text style={styles.sectionTitle}>4. Base légale</Text>
        <Text style={styles.paragraph}>
          Le traitement est fondé sur votre consentement (article 6.1.a du RGPD) et sur l'exécution du contrat d'adhésion (article 6.1.b).
        </Text>

        <Text style={styles.sectionTitle}>5. Durée de conservation</Text>
        <Text style={styles.paragraph}>
          Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, vos données personnelles sont supprimées et vos contributions sont anonymisées.
        </Text>

        <Text style={styles.sectionTitle}>6. Vos droits</Text>
        <Text style={styles.paragraph}>
          Conformément au RGPD, vous disposez des droits suivants :{'\n'}
          • Droit d'accès à vos données{'\n'}
          • Droit de rectification{'\n'}
          • Droit à l'effacement (suppression du compte){'\n'}
          • Droit à la portabilité{'\n'}
          • Droit d'opposition{'\n\n'}
          Vous pouvez exercer ces droits via la messagerie de l'application ou en supprimant votre compte depuis l'écran "Plus".
        </Text>

        <Text style={styles.sectionTitle}>7. Sous-traitants</Text>
        <Text style={styles.paragraph}>
          • Firebase (Google) : hébergement et base de données{'\n'}
          • Stripe : traitement des paiements{'\n'}
          • Sentry : monitoring des erreurs (données anonymisées)
        </Text>

        <Text style={styles.sectionTitle}>8. Transferts hors UE</Text>
        <Text style={styles.paragraph}>
          Firebase (Google) et Stripe opèrent sous les clauses contractuelles types approuvées par la Commission européenne.
        </Text>

        <Text style={styles.sectionTitle}>9. Sécurité</Text>
        <Text style={styles.paragraph}>
          Nous mettons en œuvre des mesures techniques (chiffrement, règles de sécurité Firebase, authentification) et organisationnelles pour protéger vos données.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact</Text>
        <Text style={styles.paragraph}>
          Pour toute question relative à vos données personnelles, contactez-nous via la messagerie de l'application.
        </Text>

        <View style={styles.bottomSpacer} />
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
    paddingTop: HEADER_PADDING_TOP,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.accentDark,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backText: {
    color: colors.accent,
    fontSize: fontSize.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  lastUpdate: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default PrivacyPolicyScreen;
