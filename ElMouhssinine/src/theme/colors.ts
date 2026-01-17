import { Platform, Dimensions, StatusBar } from 'react-native';

// Couleurs du thème El Mouhssinine
export const colors = {
  background: '#8b5a2b', // Marron plus clair pour meilleur contraste
  surface: '#ffffff',
  card: '#ffffff',
  accent: '#c9a227',
  text: '#1a1a2e',
  textSecondary: '#4a4a68',
  textMuted: '#8e8ea0',
  border: 'rgba(0,0,0,0.08)',
  success: '#27ae60',
  error: '#e74c3c',
  primary: '#ffffff',

  // Gradients
  headerGradient: ['#6b4423', '#8b5a2b'], // Gradient ajusté
  navbarBg: 'rgba(107,68,35,0.98)', // Navbar ajustée

  // Transparents
  accentLight: 'rgba(201,162,39,0.15)',
  accentMedium: 'rgba(201,162,39,0.3)',

  // Accessibilité - Contraste amélioré (WCAG AA)
  // Sur fond sombre (#8b5a2b)
  textOnDark: '#ffffff',
  textOnDarkMuted: 'rgba(255,255,255,0.75)', // Meilleur contraste (était 0.5)
  placeholderOnDark: 'rgba(255,255,255,0.6)', // Meilleur contraste (était 0.3)
  disabledOnDark: 'rgba(255,255,255,0.6)', // Meilleur contraste (était 0.4)

  // Sur fond clair (#ffffff)
  textOnLight: '#1a1a2e',
  textOnLightMuted: 'rgba(0,0,0,0.65)', // Meilleur contraste
  placeholderOnLight: 'rgba(0,0,0,0.5)', // Meilleur contraste
  disabledOnLight: 'rgba(0,0,0,0.45)', // Meilleur contraste

  // États interactifs
  buttonDisabled: 'rgba(201,162,39,0.5)',
  inputBorder: 'rgba(0,0,0,0.15)',
  inputBorderFocus: '#c9a227',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  title: 28,
};

// ==================== RESPONSIVE HELPERS ====================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 390; // iPhone 14 reference

// Scale factor for responsive sizing
const scale = SCREEN_WIDTH / BASE_WIDTH;

// Width percentage helper
export const wp = (percentage: number): number => {
  return Math.round((percentage * SCREEN_WIDTH) / 100);
};

// Height percentage helper
export const hp = (percentage: number): number => {
  return Math.round((percentage * SCREEN_HEIGHT) / 100);
};

// Moderate scale for fonts and spacing (not too extreme)
export const moderateScale = (size: number, factor: number = 0.5): number => {
  return Math.round(size + (scale - 1) * size * factor);
};

// Screen size detection
export const isSmallScreen = SCREEN_WIDTH < 375;
export const isMediumScreen = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
export const isLargeScreen = SCREEN_WIDTH >= 414 && SCREEN_WIDTH < 744;
export const isTablet = SCREEN_WIDTH >= 744;

// Status bar height for header padding
export const HEADER_PADDING_TOP = Platform.OS === 'android'
  ? (StatusBar.currentHeight || 24) + 16
  : 60;

// ==================== PLATFORM SHADOWS ====================

// Cross-platform shadow helper
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

// Common shadow presets
export const shadows = {
  sm: platformShadow(2),
  md: platformShadow(4),
  lg: platformShadow(8),
  xl: platformShadow(12),
};

// ==================== TOUCH TARGET SIZES ====================

// Minimum touch target size (44px per Apple HIG)
export const MIN_TOUCH_SIZE = 44;

// Common button styles
export const buttonBase = {
  minHeight: MIN_TOUCH_SIZE,
  minWidth: MIN_TOUCH_SIZE,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
};

// ==================== RESPONSIVE WIDTHS ====================

// For cards and modals
export const MODAL_WIDTH = Math.min(wp(90), 500);
export const CARD_HORIZONTAL_MARGIN = wp(4);
