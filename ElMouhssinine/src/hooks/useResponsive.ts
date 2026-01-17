import { useState, useEffect } from 'react';
import { Dimensions, Platform, StatusBar, ScaledSize } from 'react-native';

interface ResponsiveValues {
  // Screen categories
  isSmallScreen: boolean;    // < 375px (iPhone SE, small Androids)
  isMediumScreen: boolean;   // 375-414px (iPhone 14, Pixel 7)
  isLargeScreen: boolean;    // 414-744px (iPhone Pro Max, Galaxy S24)
  isTablet: boolean;         // >= 744px (iPad, Galaxy Tab)

  // Screen dimensions
  screenWidth: number;
  screenHeight: number;

  // Platform
  isIOS: boolean;
  isAndroid: boolean;

  // Safe area
  statusBarHeight: number;

  // Responsive helpers
  wp: (percentage: number) => number;  // Width percentage
  hp: (percentage: number) => number;  // Height percentage
  fs: (size: number) => number;        // Font size scaling
  spacing: (base: number) => number;   // Spacing scaling
}

const useResponsive = (): ResponsiveValues => {
  const [dimensions, setDimensions] = useState<ScaledSize>(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;

  // Base width for scaling (iPhone 14 as reference)
  const baseWidth = 390;
  const baseHeight = 844;

  // Scale factor for fonts and spacing
  const scale = width / baseWidth;
  const verticalScale = height / baseHeight;
  const moderateScale = (size: number, factor: number = 0.5) =>
    size + (scale - 1) * size * factor;

  // Width percentage
  const wp = (percentage: number): number => {
    return Math.round((percentage * width) / 100);
  };

  // Height percentage
  const hp = (percentage: number): number => {
    return Math.round((percentage * height) / 100);
  };

  // Font size scaling (moderate to avoid too big/small)
  const fs = (size: number): number => {
    const scaledSize = moderateScale(size, 0.3);
    // Clamp between 80% and 120% of original
    return Math.round(Math.min(Math.max(scaledSize, size * 0.85), size * 1.15));
  };

  // Spacing scaling
  const spacing = (base: number): number => {
    return Math.round(moderateScale(base, 0.25));
  };

  // Status bar height
  const statusBarHeight = Platform.OS === 'android'
    ? StatusBar.currentHeight || 24
    : 0;

  return {
    // Screen categories
    isSmallScreen: width < 375,
    isMediumScreen: width >= 375 && width < 414,
    isLargeScreen: width >= 414 && width < 744,
    isTablet: width >= 744,

    // Screen dimensions
    screenWidth: width,
    screenHeight: height,

    // Platform
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',

    // Safe area
    statusBarHeight,

    // Responsive helpers
    wp,
    hp,
    fs,
    spacing,
  };
};

export default useResponsive;

// Platform-specific shadow styles helper
export const platformShadow = (elevation: number = 4) => {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: 0.15 + (elevation * 0.02),
      shadowRadius: elevation,
    },
    android: {
      elevation,
    },
  });
};

// Responsive text component helper
export const responsiveText = (baseSize: number, screenWidth: number) => {
  const scale = screenWidth / 390;
  return Math.round(Math.min(Math.max(baseSize * scale, baseSize * 0.85), baseSize * 1.15));
};
