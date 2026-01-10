import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius, fontSize } from '../theme/colors';

interface ProgressBarProps {
  progress: number; // 0 to 100
  height?: number;
  showLabel?: boolean;
  labelPosition?: 'inside' | 'right';
  color?: string;
  backgroundColor?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  showLabel = false,
  labelPosition = 'right',
  color = colors.accent,
  backgroundColor = 'rgba(201,162,39,0.2)',
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, backgroundColor }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clampedProgress}%`,
              backgroundColor: color,
              height,
            },
          ]}
        />
        {showLabel && labelPosition === 'inside' && clampedProgress > 15 && (
          <Text style={[styles.labelInside, { lineHeight: height }]}>
            {Math.round(clampedProgress)}%
          </Text>
        )}
      </View>
      {showLabel && labelPosition === 'right' && (
        <Text style={styles.labelRight}>{Math.round(clampedProgress)}%</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    borderRadius: borderRadius.full,
  },
  labelInside: {
    position: 'absolute',
    right: 8,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: '#ffffff',
  },
  labelRight: {
    marginLeft: 8,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.accent,
    minWidth: 40,
    textAlign: 'right',
  },
});

export default ProgressBar;
