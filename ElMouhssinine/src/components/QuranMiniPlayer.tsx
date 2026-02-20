import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { RepeatMode, PlaybackSpeed } from '../hooks/useQuranPlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuranMiniPlayerProps {
  surahName: string;
  surahNameAr?: string;
  currentVerse: number;
  totalVerses: number;
  isPlaying: boolean;
  isLoading: boolean;
  repeatMode: RepeatMode;
  repeatCount: number;
  maxRepeat: number;
  playbackSpeed: PlaybackSpeed;
  verseProgress: number;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRepeatToggle: () => void;
  onSpeedChange: () => void;
  onStop: () => void;
  onClose?: () => void;
}

export const QuranMiniPlayer: React.FC<QuranMiniPlayerProps> = ({
  surahName,
  surahNameAr,
  currentVerse,
  totalVerses,
  isPlaying,
  isLoading,
  repeatMode,
  repeatCount,
  maxRepeat,
  playbackSpeed,
  verseProgress,
  onPlayPause,
  onPrevious,
  onNext,
  onRepeatToggle,
  onSpeedChange,
  onStop,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const loadingAnim = useRef(new Animated.Value(0)).current;

  // Animation d'entrée
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, []);

  // Animation de progression
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: verseProgress,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [verseProgress]);

  // Animation de chargement
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(loadingAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(loadingAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      loadingAnim.stopAnimation();
      loadingAnim.setValue(0);
    }
  }, [isLoading]);

  const overallProgress = ((currentVerse + 1) / totalVerses) * 100;

  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'verse':
        return '1';
      case 'surah':
        return 'All';
      case 'range':
        return 'A-B';
      default:
        return '';
    }
  };

  const getRepeatLabel = () => {
    switch (repeatMode) {
      case 'verse':
        return `${repeatCount + 1}/${maxRepeat}`;
      case 'surah':
        return 'Sourate';
      case 'range':
        return 'Plage';
      default:
        return 'Off';
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const loadingOpacity = loadingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Barre de progression de la sourate */}
      <View style={styles.surahProgressBar}>
        <View style={[styles.surahProgressFill, { width: `${overallProgress}%` }]} />
      </View>

      {/* Barre de progression du verset actuel */}
      <View style={styles.verseProgressBar}>
        <Animated.View style={[styles.verseProgressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.content}>
        {/* Info à gauche */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.surahName} numberOfLines={1}>
              {surahName}
            </Text>
            {surahNameAr && (
              <Text style={styles.surahNameAr} numberOfLines={1}>
                {surahNameAr}
              </Text>
            )}
          </View>
          <Text style={styles.verseInfo}>
            Verset {currentVerse + 1} / {totalVerses}
          </Text>
        </View>

        {/* Contrôles au centre/droite */}
        <View style={styles.controls}>
          {/* Vitesse */}
          <TouchableOpacity
            onPress={onSpeedChange}
            style={styles.secondaryButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.speedText}>{playbackSpeed}x</Text>
          </TouchableOpacity>

          {/* Répétition */}
          <TouchableOpacity
            onPress={onRepeatToggle}
            style={[
              styles.secondaryButton,
              repeatMode !== 'none' && styles.secondaryButtonActive,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.repeatIcon,
                repeatMode !== 'none' && styles.repeatIconActive,
              ]}
            >
              {repeatMode !== 'none' ? '🔁' : '➡️'}
            </Text>
            {repeatMode !== 'none' && (
              <Text style={styles.repeatLabel}>{getRepeatLabel()}</Text>
            )}
          </TouchableOpacity>

          {/* Précédent */}
          <TouchableOpacity
            onPress={onPrevious}
            style={styles.controlButton}
            disabled={currentVerse === 0}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.controlIcon,
                currentVerse === 0 && styles.controlIconDisabled,
              ]}
            >
              ⏮
            </Text>
          </TouchableOpacity>

          {/* Play/Pause */}
          <TouchableOpacity
            onPress={onPlayPause}
            style={styles.playButton}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <Animated.Text style={[styles.playIcon, { opacity: loadingOpacity }]}>
                ⏳
              </Animated.Text>
            ) : (
              <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶️'}</Text>
            )}
          </TouchableOpacity>

          {/* Suivant */}
          <TouchableOpacity
            onPress={onNext}
            style={styles.controlButton}
            disabled={currentVerse === totalVerses - 1}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.controlIcon,
                currentVerse === totalVerses - 1 && styles.controlIconDisabled,
              ]}
            >
              ⏭
            </Text>
          </TouchableOpacity>

          {/* Stop */}
          <TouchableOpacity
            onPress={onStop}
            style={styles.stopButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.stopIcon}>⏹</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bouton fermer */}
      {onClose && (
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.closeIcon}>×</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  surahProgressBar: {
    height: 2,
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  surahProgressFill: {
    height: '100%',
    backgroundColor: 'rgba(201, 162, 39, 0.4)',
  },
  verseProgressBar: {
    height: 3,
    backgroundColor: 'rgba(201, 162, 39, 0.2)',
    overflow: 'hidden',
  },
  verseProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  surahName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    maxWidth: SCREEN_WIDTH * 0.25,
  },
  surahNameAr: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    fontFamily: 'System',
  },
  verseInfo: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 4,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonActive: {
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
  },
  speedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  repeatIcon: {
    fontSize: 14,
  },
  repeatIconActive: {
    // Active state
  },
  repeatLabel: {
    fontSize: 9,
    color: colors.accent,
    fontWeight: '600',
    marginTop: 1,
    textAlign: 'center',
  },
  controlButton: {
    padding: 8,
  },
  controlIcon: {
    fontSize: 18,
  },
  controlIconDisabled: {
    opacity: 0.3,
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playIcon: {
    fontSize: 22,
    color: '#fff',
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  stopIcon: {
    fontSize: 16,
    color: '#e74c3c',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '300',
    lineHeight: 20,
  },
});

export default QuranMiniPlayer;
