import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { ArabicLetter as ArabicLetterType } from '../data/alphabet';

interface ArabicLetterProps {
  letter: ArabicLetterType;
  showForms?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  selected?: boolean;
}

const ArabicLetterComponent: React.FC<ArabicLetterProps> = ({
  letter,
  showForms = false,
  size = 'medium',
  onPress,
  selected = false,
}) => {
  const letterSizes = {
    small: 32,
    medium: 48,
    large: 72,
  };

  const formSizes = {
    small: 20,
    medium: 28,
    large: 36,
  };

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[
        styles.container,
        selected && styles.containerSelected,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Lettre principale (forme isolee) */}
      <View style={styles.mainLetter}>
        <Text style={[styles.arabicLetter, { fontSize: letterSizes[size] }]}>
          {letter.isolated}
        </Text>
      </View>

      {/* Nom de la lettre */}
      <View style={styles.nameContainer}>
        <Text style={styles.latinName}>{letter.name}</Text>
        <Text style={styles.arabicName}>{letter.nameAr}</Text>
        <Text style={styles.sound}>/{letter.sound}/</Text>
      </View>

      {/* Les 4 formes */}
      {showForms && (
        <View style={styles.formsContainer}>
          <View style={styles.formItem}>
            <Text style={styles.formLabel}>Isolee</Text>
            <Text style={[styles.formLetter, { fontSize: formSizes[size] }]}>
              {letter.isolated}
            </Text>
          </View>
          <View style={styles.formItem}>
            <Text style={styles.formLabel}>Initiale</Text>
            <Text style={[styles.formLetter, { fontSize: formSizes[size] }]}>
              {letter.initial}
            </Text>
          </View>
          <View style={styles.formItem}>
            <Text style={styles.formLabel}>Mediale</Text>
            <Text style={[styles.formLetter, { fontSize: formSizes[size] }]}>
              {letter.medial}
            </Text>
          </View>
          <View style={styles.formItem}>
            <Text style={styles.formLabel}>Finale</Text>
            <Text style={[styles.formLetter, { fontSize: formSizes[size] }]}>
              {letter.final}
            </Text>
          </View>
        </View>
      )}

      {/* Indicateur de connexion */}
      {showForms && (
        <View style={styles.connectionInfo}>
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: letter.connectsLeft ? colors.success : colors.error },
            ]}
          />
          <Text style={styles.connectionText}>
            {letter.connectsLeft ? 'Se connecte a gauche' : 'Ne se connecte pas'}
          </Text>
        </View>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  containerSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(201,162,39,0.08)',
  },
  mainLetter: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  arabicLetter: {
    color: colors.accent,
    fontWeight: '300',
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  latinName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  arabicName: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sound: {
    fontSize: fontSize.sm,
    color: colors.accent,
    marginTop: 4,
  },
  formsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    marginTop: spacing.md,
  },
  formItem: {
    alignItems: 'center',
  },
  formLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  formLetter: {
    color: colors.text,
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  connectionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});

export default ArabicLetterComponent;
