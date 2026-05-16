/**
 * SkeletonLoader - Composant de chargement squelette
 * Affiche une animation de chargement pour améliorer l'UX
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing } from '../theme/colors';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Composant SkeletonLoader individuel
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius: radius = 8,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius: radius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton pour une carte de prière
 */
export const PrayerCardSkeleton: React.FC = () => (
  <View style={styles.prayerCard}>
    <SkeletonLoader width={40} height={40} borderRadius={20} />
    <View style={styles.prayerCardContent}>
      <SkeletonLoader width={80} height={16} style={{ marginBottom: 8 }} />
      <SkeletonLoader width={60} height={24} />
    </View>
  </View>
);

/**
 * Skeleton pour une liste de prières (5 prières)
 */
export const PrayerListSkeleton: React.FC = () => (
  <View style={styles.prayerList}>
    {[1, 2, 3, 4, 5].map((i) => (
      <PrayerCardSkeleton key={i} />
    ))}
  </View>
);

/**
 * Skeleton pour une carte d'annonce
 */
export const AnnouncementCardSkeleton: React.FC = () => (
  <View style={styles.announcementCard}>
    <SkeletonLoader width="70%" height={20} style={{ marginBottom: 12 }} />
    <SkeletonLoader width="100%" height={14} style={{ marginBottom: 6 }} />
    <SkeletonLoader width="90%" height={14} style={{ marginBottom: 6 }} />
    <SkeletonLoader width="50%" height={14} />
  </View>
);

/**
 * Skeleton pour une liste d'annonces
 */
export const AnnouncementListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <View style={styles.announcementList}>
    {Array.from({ length: count }).map((_, i) => (
      <AnnouncementCardSkeleton key={i} />
    ))}
  </View>
);

/**
 * Skeleton pour un projet de don
 */
export const ProjectCardSkeleton: React.FC = () => (
  <View style={styles.projectCard}>
    <View style={styles.projectHeader}>
      <SkeletonLoader width={44} height={44} borderRadius={12} />
      <View style={styles.projectInfo}>
        <SkeletonLoader width={120} height={18} style={{ marginBottom: 6 }} />
        <SkeletonLoader width={80} height={14} />
      </View>
    </View>
    <SkeletonLoader width="100%" height={6} borderRadius={3} style={{ marginVertical: 12 }} />
    <View style={styles.projectFooter}>
      <SkeletonLoader width={60} height={14} />
      <SkeletonLoader width={80} height={14} />
    </View>
  </View>
);

/**
 * Skeleton pour l'écran d'accueil complet
 */
export const HomeScreenSkeleton: React.FC = () => (
  <View style={styles.homeScreen}>
    {/* Header */}
    <View style={styles.homeHeader}>
      <SkeletonLoader width={150} height={28} style={{ marginBottom: 8 }} />
      <SkeletonLoader width={200} height={16} />
    </View>

    {/* Horaires */}
    <View style={styles.homeSection}>
      <SkeletonLoader width={120} height={20} style={{ marginBottom: 16 }} />
      <PrayerListSkeleton />
    </View>

    {/* Annonces */}
    <View style={styles.homeSection}>
      <SkeletonLoader width={100} height={20} style={{ marginBottom: 16 }} />
      <AnnouncementListSkeleton count={2} />
    </View>
  </View>
);

/**
 * Skeleton pour le profil membre
 */
export const MemberProfileSkeleton: React.FC = () => (
  <View style={styles.memberProfile}>
    <View style={styles.memberHeader}>
      <SkeletonLoader width={56} height={56} borderRadius={28} />
      <View style={styles.memberInfo}>
        <SkeletonLoader width={120} height={20} style={{ marginBottom: 6 }} />
        <SkeletonLoader width={160} height={14} />
      </View>
      <SkeletonLoader width={80} height={28} borderRadius={14} />
    </View>
    <View style={styles.memberDetails}>
      <SkeletonLoader width="100%" height={16} style={{ marginBottom: 10 }} />
      <SkeletonLoader width="100%" height={16} style={{ marginBottom: 10 }} />
      <SkeletonLoader width="80%" height={16} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  // Prayer card
  prayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  prayerCardContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  prayerList: {
    gap: spacing.sm,
  },
  // Announcement card
  announcementCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  announcementList: {
    gap: spacing.md,
  },
  // Project card
  projectCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Home screen
  homeScreen: {
    padding: spacing.lg,
  },
  homeHeader: {
    marginBottom: spacing.xl,
  },
  homeSection: {
    marginBottom: spacing.xxl,
  },
  // Member profile
  memberProfile: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberDetails: {
    gap: spacing.sm,
  },
});

export default SkeletonLoader;
