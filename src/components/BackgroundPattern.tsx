import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, Pattern, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BackgroundPatternProps {
  children: React.ReactNode;
}

export const BackgroundPattern: React.FC<BackgroundPatternProps> = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* SVG Pattern Layer */}
      <View style={styles.patternContainer}>
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id="arabesque"
              patternUnits="userSpaceOnUse"
              width="60"
              height="60"
            >
              {/* Motif géométrique islamique simplifié - +10% visibilité */}
              <Path
                d="M30 0 L60 30 L30 60 L0 30 Z"
                fill="none"
                stroke={colors.accentDark}
                strokeWidth="0.6"
                opacity="0.12"
              />
              <Path
                d="M30 15 L45 30 L30 45 L15 30 Z"
                fill="none"
                stroke={colors.accent}
                strokeWidth="0.6"
                opacity="0.09"
              />
              {/* Points décoratifs aux intersections */}
              <Path
                d="M30 28 A2 2 0 1 1 30 32 A2 2 0 1 1 30 28"
                fill={colors.accent}
                opacity="0.15"
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#arabesque)`} />
        </Svg>
      </View>

      {/* Content Layer */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  patternContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});

export default BackgroundPattern;
