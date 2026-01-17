/**
 * EmptyState - Composant pour afficher un état vide illustré
 * Utilisé quand une liste est vide ou qu'il n'y a pas de données
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  buttonText?: string;
  onButtonPress?: () => void;
  style?: ViewStyle;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  buttonText,
  onButtonPress,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {buttonText && onButtonPress && (
        <TouchableOpacity
          style={styles.button}
          onPress={onButtonPress}
          activeOpacity={0.8}
          accessibilityLabel={buttonText}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Variantes prédéfinies pour usage courant
export const EmptyMessages: React.FC<{ onContact?: () => void }> = ({ onContact }) => (
  <EmptyState
    icon="📭"
    title="Aucun message"
    message="Vous n'avez pas encore de messages. Contactez la mosquée pour toute question."
    buttonText={onContact ? "Contacter la mosquée" : undefined}
    onButtonPress={onContact}
  />
);

export const EmptyProjects: React.FC = () => (
  <EmptyState
    icon="💝"
    title="Aucun projet actif"
    message="Il n'y a pas de projet de collecte en cours pour le moment."
  />
);

export const EmptyEvents: React.FC = () => (
  <EmptyState
    icon="📅"
    title="Aucun événement à venir"
    message="Revenez bientôt pour découvrir les prochains événements de la mosquée."
  />
);

export const EmptyAnnouncements: React.FC = () => (
  <EmptyState
    icon="📢"
    title="Aucune annonce"
    message="Il n'y a pas d'annonce pour le moment."
  />
);

export const EmptySearch: React.FC<{ query?: string }> = ({ query }) => (
  <EmptyState
    icon="🔍"
    title="Aucun résultat"
    message={query ? `Aucun résultat pour "${query}"` : "Essayez une autre recherche."}
  />
);

export const EmptyMembers: React.FC = () => (
  <EmptyState
    icon="👥"
    title="Aucun membre inscrit"
    message="Vous n'avez pas encore inscrit d'autres membres."
  />
);

export const ErrorState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <EmptyState
    icon="⚠️"
    title="Une erreur est survenue"
    message="Impossible de charger les données. Vérifiez votre connexion internet."
    buttonText={onRetry ? "Réessayer" : undefined}
    onButtonPress={onRetry}
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    minHeight: 250,
  },
  icon: {
    fontSize: 60,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default EmptyState;
