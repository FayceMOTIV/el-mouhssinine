/**
 * Toast - Composant de notification non-bloquante
 * Alternative élégante aux Alert natifs
 */
import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';

// Types
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: (id: string) => void;
}

// Contexte
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Configuration des types
const toastConfig: Record<ToastType, { icon: string; bgColor: string; textColor: string }> = {
  success: {
    icon: '✓',
    bgColor: 'rgba(39, 174, 96, 0.95)',
    textColor: '#ffffff',
  },
  error: {
    icon: '✕',
    bgColor: 'rgba(231, 76, 60, 0.95)',
    textColor: '#ffffff',
  },
  info: {
    icon: 'ℹ',
    bgColor: 'rgba(52, 152, 219, 0.95)',
    textColor: '#ffffff',
  },
  warning: {
    icon: '⚠',
    bgColor: 'rgba(241, 196, 15, 0.95)',
    textColor: '#000000',
  },
};

// Composant Toast individuel
const ToastItem: React.FC<{
  toast: ToastData;
  onHide: (id: string) => void;
}> = ({ toast, onHide }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = toastConfig[toast.type];

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide après la durée
    const timer = setTimeout(() => {
      hideAnimation();
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, []);

  const hideAnimation = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onHide(toast.id));
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          backgroundColor: config.bgColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={hideAnimation}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, { color: config.textColor }]}>{config.icon}</Text>
        </View>
        <Text style={[styles.message, { color: config.textColor }]} numberOfLines={2}>
          {toast.message}
        </Text>
        <TouchableOpacity onPress={hideAnimation} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: config.textColor }]}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Provider
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <SafeAreaView style={styles.toastWrapper} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onHide={hideToast} />
        ))}
      </SafeAreaView>
    </ToastContext.Provider>
  );
};

// Hook
export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Fonctions utilitaires pour usage sans hook (via singleton)
let toastInstance: ToastContextValue | null = null;

export const setToastInstance = (instance: ToastContextValue) => {
  toastInstance = instance;
};

export const toast = {
  success: (message: string, duration?: number) => {
    toastInstance?.showToast(message, 'success', duration);
  },
  error: (message: string, duration?: number) => {
    toastInstance?.showToast(message, 'error', duration);
  },
  info: (message: string, duration?: number) => {
    toastInstance?.showToast(message, 'info', duration);
  },
  warning: (message: string, duration?: number) => {
    toastInstance?.showToast(message, 'warning', duration);
  },
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: 400,
    width: '95%',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  closeBtn: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  closeText: {
    fontSize: 24,
    fontWeight: '300',
    opacity: 0.7,
  },
});

export default ToastProvider;
