/**
 * MemberCard - Carte de membre virtuelle El Mouhssinine
 * Style carte bancaire/badge avec gradient et animations
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  I18nManager,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius, fontSize, platformShadow, isSmallScreen } from '../theme/colors';

// Types pour le statut de la carte
export type MembershipStatus = 'active' | 'expiring' | 'expired' | 'inactive' | 'none';

interface MemberCardProps {
  member: {
    name?: string;
    firstName?: string;
    lastName?: string;
    memberId?: string;
    odIdNumber?: string;
    membershipExpirationDate?: Date | { toDate: () => Date } | string | null;
  } | null;
  onRenew?: () => void;
  isRTL?: boolean;
}

// Calcul du statut de l'adhesion
export const getMembershipStatus = (member: MemberCardProps['member']): MembershipStatus => {
  if (!member?.membershipExpirationDate) return 'none';

  let expiration: Date;

  // Gerer les differents formats de date (Firestore Timestamp, Date, string)
  if (typeof member.membershipExpirationDate === 'object' && 'toDate' in member.membershipExpirationDate) {
    expiration = member.membershipExpirationDate.toDate();
  } else if (member.membershipExpirationDate instanceof Date) {
    expiration = member.membershipExpirationDate;
  } else if (typeof member.membershipExpirationDate === 'string') {
    expiration = new Date(member.membershipExpirationDate);
  } else {
    return 'none';
  }

  const now = new Date();
  const diffDays = Math.floor((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 30) return 'active';      // Plus de 30 jours restants
  if (diffDays > 0) return 'expiring';     // Moins de 30 jours (avertissement)
  if (diffDays > -30) return 'expired';    // Expire depuis moins de 30 jours
  return 'inactive';                        // Expire depuis plus de 30 jours
};

// Configuration des statuts
const STATUS_CONFIG: Record<MembershipStatus, {
  badge: string;
  badgeColor: string;
  badgeBgColor: string;
  gradient: string[];
  message: string;
  messageAr: string;
}> = {
  active: {
    badge: 'ACTIVE',
    badgeColor: '#ffffff',
    badgeBgColor: 'rgba(76, 175, 80, 0.9)',
    gradient: ['#1B5E20', '#2E7D32'],
    message: 'Valide jusqu\'au',
    messageAr: 'صالحة حتى',
  },
  expiring: {
    badge: 'EXPIRE BIENTOT',
    badgeColor: '#ffffff',
    badgeBgColor: 'rgba(255, 152, 0, 0.9)',
    gradient: ['#1B5E20', '#2E7D32'],
    message: 'Expire dans',
    messageAr: 'تنتهي في',
  },
  expired: {
    badge: 'A RENOUVELER',
    badgeColor: '#ffffff',
    badgeBgColor: 'rgba(244, 67, 54, 0.9)',
    gradient: ['#616161', '#9E9E9E'],
    message: 'Cotisation a renouveler',
    messageAr: 'يجب تجديد الاشتراك',
  },
  inactive: {
    badge: 'EXPIREE',
    badgeColor: '#ffffff',
    badgeBgColor: 'rgba(158, 158, 158, 0.9)',
    gradient: ['#616161', '#9E9E9E'],
    message: 'Cotisation expiree',
    messageAr: 'انتهى الاشتراك',
  },
  none: {
    badge: '',
    badgeColor: '#ffffff',
    badgeBgColor: 'rgba(158, 158, 158, 0.9)',
    gradient: ['#616161', '#9E9E9E'],
    message: 'Aucune adhesion',
    messageAr: 'لا يوجد اشتراك',
  },
};

// Formater le numero de membre
const formatMemberNumber = (memberId?: string | null, odIdNumber?: string | number | null): string => {
  if (odIdNumber) {
    const num = typeof odIdNumber === 'number' ? odIdNumber : parseInt(odIdNumber, 10);
    return `N° ${String(num).padStart(5, '0')}`;
  }
  if (memberId) {
    // Si c'est un format ELM-YYYY-XXXX, extraire le numero
    const match = memberId.match(/(\d+)$/);
    if (match) {
      return `N° ${match[1].padStart(5, '0')}`;
    }
    return `N° ${memberId}`;
  }
  return 'N° -----';
};

// Formater la date
const formatDate = (date: Date, isRTL: boolean): string => {
  return date.toLocaleDateString(isRTL ? 'ar-SA' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Calculer les jours restants
const getDaysRemaining = (expirationDate: Date): number => {
  const now = new Date();
  return Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const MemberCard: React.FC<MemberCardProps> = ({ member, onRenew, isRTL = false }) => {
  // Animation d'apparition
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const status = getMembershipStatus(member);
  const config = STATUS_CONFIG[status];

  // Obtenir le nom complet
  const fullName = member?.name ||
    (member?.firstName && member?.lastName
      ? `${member.firstName} ${member.lastName}`
      : member?.firstName || member?.lastName || '---');

  // Obtenir le numero de membre
  const memberNumber = formatMemberNumber(member?.memberId, member?.odIdNumber);

  // Calculer le message de validite
  const getValidityMessage = (): string => {
    if (!member?.membershipExpirationDate) {
      return isRTL ? config.messageAr : config.message;
    }

    let expiration: Date;
    if (typeof member.membershipExpirationDate === 'object' && 'toDate' in member.membershipExpirationDate) {
      expiration = member.membershipExpirationDate.toDate();
    } else if (member.membershipExpirationDate instanceof Date) {
      expiration = member.membershipExpirationDate;
    } else if (typeof member.membershipExpirationDate === 'string') {
      expiration = new Date(member.membershipExpirationDate);
    } else {
      return isRTL ? config.messageAr : config.message;
    }

    if (status === 'active') {
      return `${isRTL ? config.messageAr : config.message} ${formatDate(expiration, isRTL)}`;
    }
    if (status === 'expiring') {
      const days = getDaysRemaining(expiration);
      return isRTL
        ? `${config.messageAr} ${days} يوم`
        : `${config.message} ${days} jour${days > 1 ? 's' : ''}`;
    }
    return isRTL ? config.messageAr : config.message;
  };

  const showRenewButton = status === 'expired' || status === 'inactive' || status === 'none';

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={config.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Header: Logo + Badge */}
        <View style={[styles.cardHeader, isRTL && styles.cardHeaderRTL]}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>EL MOUHSSININE</Text>
            <Text style={styles.logoSubtext}>MOSQUEE</Text>
          </View>
          <View style={styles.cardTypeContainer}>
            <Text style={[styles.cardType, isRTL && styles.rtlText]}>CARTE DE MEMBRE</Text>
            <Text style={[styles.cardTypeAr, !isRTL && { fontSize: 10 }]}>بطاقة العضوية</Text>
          </View>
        </View>

        {/* Nom du membre */}
        <View style={styles.nameContainer}>
          <Text style={[styles.memberName, isRTL && styles.rtlText]} numberOfLines={1}>
            {fullName.toUpperCase()}
          </Text>
        </View>

        {/* Numero + Validite */}
        <View style={[styles.cardFooter, isRTL && styles.cardFooterRTL]}>
          <View style={styles.infoBlock}>
            <Text style={[styles.infoLabel, isRTL && styles.rtlText]}>
              {isRTL ? 'رقم العضوية' : 'N° MEMBRE'}
            </Text>
            <Text style={[styles.infoValue, isRTL && styles.rtlText]}>{memberNumber}</Text>
          </View>
          <View style={[styles.infoBlock, styles.infoBlockRight]}>
            <Text style={[styles.infoLabel, isRTL && styles.rtlText]}>
              {isRTL ? 'الصلاحية' : 'VALIDITE'}
            </Text>
            <Text style={[styles.infoValue, isRTL && styles.rtlText]} numberOfLines={1}>
              {getValidityMessage()}
            </Text>
          </View>
        </View>

        {/* Badge de statut */}
        {status !== 'none' && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: config.badgeBgColor },
              isRTL && styles.statusBadgeRTL,
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: config.badgeColor }]}>
              {status === 'active' && '✅ '}
              {status === 'expiring' && '⚠️ '}
              {status === 'expired' && '🔴 '}
              {status === 'inactive' && '❌ '}
              {config.badge}
            </Text>
          </View>
        )}

        {/* Motif decoratif */}
        <View style={styles.decorativePattern}>
          <View style={styles.circle1} />
          <View style={styles.circle2} />
        </View>
      </LinearGradient>

      {/* Bouton Renouveler */}
      {showRenewButton && onRenew && (
        <TouchableOpacity style={styles.renewButton} onPress={onRenew} activeOpacity={0.8}>
          <Text style={[styles.renewButtonText, isRTL && styles.rtlText]}>
            {isRTL ? 'تجديد الاشتراك' : 'Renouveler mon adhesion'}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_RATIO = 1.586; // Ratio carte de credit standard (85.6mm x 54mm)
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 400);
const CARD_HEIGHT = CARD_WIDTH / CARD_RATIO;

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    overflow: 'hidden',
    position: 'relative',
    ...platformShadow(8),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  logoContainer: {
    alignItems: 'flex-start',
  },
  logoText: {
    color: '#ffffff',
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  logoSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: isSmallScreen ? 8 : 9,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 2,
  },
  cardTypeContainer: {
    alignItems: 'flex-end',
  },
  cardType: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: isSmallScreen ? 9 : 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardTypeAr: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: isSmallScreen ? 8 : 9,
    marginTop: 2,
    fontFamily: I18nManager.isRTL ? undefined : 'System',
  },
  nameContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  memberName: {
    color: '#ffffff',
    fontSize: isSmallScreen ? 18 : 22,
    fontWeight: '700',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardFooterRTL: {
    flexDirection: 'row-reverse',
  },
  infoBlock: {
    flex: 1,
  },
  infoBlockRight: {
    alignItems: 'flex-end',
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: isSmallScreen ? 8 : 9,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: isSmallScreen ? 11 : 13,
    fontWeight: '600',
  },
  statusBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: isSmallScreen ? 8 : 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeRTL: {
    right: 'auto',
    left: spacing.md,
  },
  statusBadgeText: {
    fontSize: isSmallScreen ? 9 : 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  decorativePattern: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 160,
    height: 160,
  },
  circle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  circle2: {
    position: 'absolute',
    left: 40,
    top: 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  renewButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    ...platformShadow(4),
  },
  renewButtonText: {
    color: '#1a1a2e',
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  rtlText: {
    textAlign: 'right',
  },
});

export default MemberCard;
