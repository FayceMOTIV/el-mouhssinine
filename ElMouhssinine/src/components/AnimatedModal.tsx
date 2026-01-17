/**
 * AnimatedModal - Modal avec animation fade + scale
 * Améliore l'UX des modales avec des transitions fluides
 */
import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  Dimensions,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  closeOnBackdrop?: boolean;
  animationType?: 'fade' | 'scale' | 'slideUp';
}

const AnimatedModal: React.FC<AnimatedModalProps> = ({
  visible,
  onClose,
  children,
  style,
  contentStyle,
  closeOnBackdrop = true,
  animationType = 'scale',
}) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      // Animation d'entrée
      if (animationType === 'slideUp') {
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(translateYAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 10,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 65,
            friction: 8,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      // Reset pour prochaine ouverture
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      translateYAnim.setValue(100);
    }
  }, [visible, animationType]);

  const handleClose = () => {
    // Animation de sortie
    const exitAnimation = animationType === 'slideUp'
      ? Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 100,
            duration: 200,
            useNativeDriver: true,
          }),
        ])
      : Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.9,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]);

    exitAnimation.start(() => onClose());
  };

  const getTransform = () => {
    if (animationType === 'slideUp') {
      return [{ translateY: translateYAnim }];
    }
    if (animationType === 'scale') {
      return [{ scale: scaleAnim }];
    }
    return [];
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback
            onPress={closeOnBackdrop ? handleClose : undefined}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        <Animated.View
          style={[
            styles.content,
            contentStyle,
            {
              opacity: opacityAnim,
              transform: getTransform(),
            },
          ]}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/**
 * BottomSheet - Variante slide up depuis le bas
 */
export const AnimatedBottomSheet: React.FC<Omit<AnimatedModalProps, 'animationType'>> = (props) => (
  <AnimatedModal {...props} animationType="slideUp" contentStyle={styles.bottomSheet} />
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    margin: spacing.lg,
    maxWidth: SCREEN_WIDTH - spacing.lg * 2,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    margin: 0,
    maxWidth: '100%',
    paddingBottom: spacing.xxl,
  },
});

export default AnimatedModal;
