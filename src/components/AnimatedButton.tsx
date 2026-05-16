/**
 * AnimatedButton - Bouton avec animation scale au press
 * Améliore l'UX avec un feedback visuel tactile
 */
import React, { useRef } from 'react';
import {
  Animated,
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
  Text,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';

interface AnimatedButtonProps {
  onPress: () => void;
  title?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  onPress,
  title,
  children,
  style,
  textStyle,
  disabled = false,
  loading = false,
  variant = 'primary',
  haptic = true,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;

    // Haptic feedback
    if (haptic) {
      Vibration.vibrate(10);
    }

    onPress();
  };

  const variantStyles = {
    primary: {
      container: styles.primaryContainer,
      text: styles.primaryText,
    },
    secondary: {
      container: styles.secondaryContainer,
      text: styles.secondaryText,
    },
    danger: {
      container: styles.dangerContainer,
      text: styles.dangerText,
    },
    ghost: {
      container: styles.ghostContainer,
      text: styles.ghostText,
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
    >
      <Animated.View
        style={[
          styles.container,
          currentVariant.container,
          (disabled || loading) && styles.disabled,
          { transform: [{ scale: scaleAnim }] },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'secondary' || variant === 'ghost' ? colors.accent : '#ffffff'}
            size="small"
          />
        ) : children ? (
          children
        ) : (
          <Text style={[styles.text, currentVariant.text, textStyle]}>{title}</Text>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

/**
 * AnimatedIconButton - Bouton icône avec animation
 */
export const AnimatedIconButton: React.FC<{
  icon: string;
  onPress: () => void;
  size?: number;
  color?: string;
  haptic?: boolean;
  accessibilityLabel: string;
}> = ({ icon, onPress, size = 24, color = colors.text, haptic = true, accessibilityLabel }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePress = () => {
    if (haptic) Vibration.vibrate(10);
    onPress();
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.iconButton, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={{ fontSize: size, color }}>{icon}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  // Primary variant
  primaryContainer: {
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: '#ffffff',
  },
  // Secondary variant
  secondaryContainer: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  secondaryText: {
    color: colors.accent,
  },
  // Danger variant
  dangerContainer: {
    backgroundColor: colors.error,
  },
  dangerText: {
    color: '#ffffff',
  },
  // Ghost variant
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: colors.accent,
  },
  // Icon button
  iconButton: {
    padding: spacing.sm,
  },
});

export default AnimatedButton;
