import React, { useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { colors } from '../theme/colors';

interface Verse {
  number: number;
  numberInSurah: number;
  text: string;
  translation?: string;
}

interface QuranVerseProps {
  verse: Verse;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  showTranslation: boolean;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent, index: number) => void;
}

const QuranVerseComponent: React.FC<QuranVerseProps> = ({
  verse,
  index,
  isActive,
  isPlaying,
  showTranslation,
  onPress,
  onLayout,
}) => {
  // TOUTES les animations en useNativeDriver: false
  // pour éviter le crash "JS driven animation on animated node moved to native"
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;
  const soundBarAnims = useRef([
    new Animated.Value(0.4),
    new Animated.Value(0.7),
    new Animated.Value(0.5),
    new Animated.Value(0.8),
  ]).current;

  useEffect(() => {
    if (isActive && isPlaying) {
      // Pulsation douce
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.01,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
        ]),
      ).start();

      // Fond doré
      Animated.timing(bgAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Barres de son
      soundBarAnims.forEach((anim, i) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 0.5 + 0.5,
              duration: 200 + i * 50,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: Math.random() * 0.3 + 0.2,
              duration: 200 + i * 50,
              useNativeDriver: false,
            }),
          ]),
        ).start();
      });
    } else if (isActive && !isPlaying) {
      // Actif mais en pause
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);

      Animated.timing(bgAnim, {
        toValue: 0.7,
        duration: 200,
        useNativeDriver: false,
      }).start();

      soundBarAnims.forEach(anim => {
        anim.stopAnimation();
        anim.setValue(0.3);
      });
    } else {
      // Non actif — reset tout
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);

      Animated.timing(bgAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();

      soundBarAnims.forEach(anim => {
        anim.stopAnimation();
        anim.setValue(0.4);
      });
    }

    return () => {
      pulseAnim.stopAnimation();
      bgAnim.stopAnimation();
      soundBarAnims.forEach(anim => anim.stopAnimation());
    };
  }, [isActive, isPlaying]);

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [
      'transparent',
      'rgba(201, 162, 39, 0.08)',
      'rgba(201, 162, 39, 0.15)',
    ],
  });

  const borderLeftColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.accent],
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout?.(event, index);
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      onLayout={handleLayout}
    >
      <Animated.View
        style={[
          styles.verseContainer,
          {
            backgroundColor,
            borderLeftColor,
            borderLeftWidth: isActive ? 4 : 0,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Indicateur de lecture à gauche */}
        {isActive && isPlaying && (
          <View style={styles.playingIndicator}>
            <View style={styles.soundWave}>
              {soundBarAnims.map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.soundBar,
                    {
                      transform: [{
                        scaleY: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.25, 1],
                        }),
                      }],
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Numéro du verset */}
        <View style={styles.verseNumberContainer}>
          <View
            style={[
              styles.verseNumberBadge,
              isActive && styles.verseNumberBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.verseNumber,
                isActive && styles.verseNumberActive,
              ]}
            >
              {verse.numberInSurah}
            </Text>
          </View>
        </View>

        {/* Texte arabe */}
        <Text
          style={[styles.arabicText, isActive && styles.arabicTextActive]}
        >
          {verse.text}
        </Text>

        {/* Traduction */}
        {showTranslation && verse.translation && (
          <Text style={styles.translationText}>{verse.translation}</Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  verseContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingLeft: 20,
    marginVertical: 6,
    marginHorizontal: 12,
    borderRadius: 16,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 4,
    backgroundColor: colors.card,
  },
  playingIndicator: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -10,
    zIndex: 1,
  },
  soundWave: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    width: 20,
  },
  soundBar: {
    width: 3,
    height: 16,
    backgroundColor: colors.accent,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  verseNumberContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  verseNumberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  verseNumberBadgeActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  verseNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  verseNumberActive: {
    color: '#ffffff',
  },
  arabicText: {
    fontSize: 28,
    lineHeight: 52,
    textAlign: 'right',
    fontFamily: 'KFGQPC Uthmanic Script HAFS',
    color: colors.text,
    writingDirection: 'rtl',
  },
  arabicTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  translationText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'left',
    fontStyle: 'italic',
  },
});

// Memo pour éviter les re-renders inutiles
export const QuranVerse = memo(QuranVerseComponent, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.showTranslation === nextProps.showTranslation &&
    prevProps.verse.number === nextProps.verse.number
  );
});

export default QuranVerse;
