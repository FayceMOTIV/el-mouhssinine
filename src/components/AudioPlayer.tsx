import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';

interface AudioPlayerProps {
  audioUrl?: string;
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
  compact?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  title,
  subtitle,
  showProgress = true,
  compact = false,
  onPlay,
  onPause,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');

  const handlePlayPause = async () => {
    if (!audioUrl) return;

    if (isPlaying) {
      setIsPlaying(false);
      onPause?.();
    } else {
      setIsLoading(true);
      // Simuler le chargement
      setTimeout(() => {
        setIsLoading(false);
        setIsPlaying(true);
        onPlay?.();
        // Simuler la progression
        let p = 0;
        const interval = setInterval(() => {
          p += 1;
          setProgress(p);
          const mins = Math.floor(p * 0.03 / 60);
          const secs = Math.floor((p * 0.03) % 60);
          setCurrentTime(`${mins}:${secs.toString().padStart(2, '0')}`);
          if (p >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime('0:00');
          }
        }, 100);
      }, 500);
    }
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={handlePlayPause}
        disabled={!audioUrl}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text style={styles.compactIcon}>
            {isPlaying ? '⏸️' : '▶️'}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Info */}
      {(title || subtitle) && (
        <View style={styles.info}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          disabled={!audioUrl}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.playIcon}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          )}
        </TouchableOpacity>

        {showProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.time}>{currentTime}</Text>
              <Text style={styles.time}>{duration}</Text>
            </View>
          </View>
        )}
      </View>

      {!audioUrl && (
        <Text style={styles.noAudio}>Audio non disponible</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  compactContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(201,162,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactIcon: {
    fontSize: 18,
  },
  info: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  playIcon: {
    color: '#ffffff',
    fontSize: 18,
  },
  progressContainer: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(201,162,39,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  noAudio: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});

export default AudioPlayer;
