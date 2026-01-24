/**
 * MemberCard - Carte de membre virtuelle El Mouhssinine
 * Design premium style carte bancaire
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius, platformShadow } from '../theme/colors';

export type MembershipStatus = 'active' | 'expiring' | 'expired' | 'inactive' | 'unpaid' | 'none';

interface MemberCardProps {
  member: {
    name?: string;
    firstName?: string;
    lastName?: string;
    memberId?: string;
    odIdNumber?: string;
    membershipExpirationDate?: Date | { toDate: () => Date } | string | null;
    status?: string;
  } | null;
  onRenew?: () => void;
  onPay?: () => void;
  isRTL?: boolean;
}

export const getMembershipStatus = (member: MemberCardProps['member']): MembershipStatus => {
  if (member?.status === 'en_attente_paiement' || member?.status === 'unpaid') {
    return 'unpaid';
  }
  if (!member?.membershipExpirationDate) return 'none';

  let expiration: Date;
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

  if (diffDays > 30) return 'active';
  if (diffDays > 0) return 'expiring';
  if (diffDays > -30) return 'expired';
  return 'inactive';
};

const STATUS_CONFIG: Record<MembershipStatus, {
  badge: string;
  badgeAr: string;
  badgeColor: string;
  gradient: string[];
  accentColor: string;
}> = {
  active: {
    badge: 'MEMBRE ACTIF',
    badgeAr: 'عضو نشط',
    badgeColor: '#4CAF50',
    gradient: ['#0D1B2A', '#1B2838', '#243447'],
    accentColor: '#C9A227',
  },
  expiring: {
    badge: 'EXPIRE BIENTÔT',
    badgeAr: 'تنتهي قريباً',
    badgeColor: '#FF9800',
    gradient: ['#0D1B2A', '#1B2838', '#243447'],
    accentColor: '#FF9800',
  },
  expired: {
    badge: 'À RENOUVELER',
    badgeAr: 'يجب التجديد',
    badgeColor: '#F44336',
    gradient: ['#2C1810', '#3D2317', '#4A2C1C'],
    accentColor: '#C9A227',
  },
  inactive: {
    badge: 'EXPIRÉE',
    badgeAr: 'منتهية',
    badgeColor: '#9E9E9E',
    gradient: ['#2A2A2A', '#3A3A3A', '#4A4A4A'],
    accentColor: '#888888',
  },
  unpaid: {
    badge: 'EN ATTENTE',
    badgeAr: 'في انتظار',
    badgeColor: '#FF9800',
    gradient: ['#1A1A2E', '#25253D', '#2D2D4A'],
    accentColor: '#C9A227',
  },
  none: {
    badge: 'MEMBRE',
    badgeAr: 'عضو',
    badgeColor: '#888888',
    gradient: ['#2A2A2A', '#3A3A3A', '#4A4A4A'],
    accentColor: '#888888',
  },
};

const generateMemberNumber = (memberId?: string | null): string => {
  if (!memberId) return '00000';
  const digits = memberId.replace(/[^0-9]/g, '');
  if (digits.length > 0) {
    return digits.substring(0, 5).padStart(5, '0');
  }
  let hash = 0;
  for (let i = 0; i < memberId.length; i++) {
    hash = ((hash << 5) - hash) + memberId.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash % 100000).toString().padStart(5, '0');
};

const formatDate = (date: Date): string => {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${year}`;
};

const MemberCard: React.FC<MemberCardProps> = ({ member, onRenew, onPay, isRTL = false }) => {
  const { width: screenWidth } = useWindowDimensions();
  const cardMargin = 16;
  const cardWidth = screenWidth - (cardMargin * 2);
  // Hauteur minimum garantie de 220pt + ratio pour écrans larges
  const cardHeight = Math.max(220, cardWidth * 0.58);

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

  const fullName = member?.name ||
    (member?.firstName && member?.lastName
      ? `${member.firstName} ${member.lastName}`
      : member?.firstName || member?.lastName || 'MEMBRE');

  const memberNumber = generateMemberNumber(member?.memberId);

  let validityText = '--/--';
  if (member?.membershipExpirationDate) {
    let expDate: Date | null = null;
    if (typeof member.membershipExpirationDate === 'object' && 'toDate' in member.membershipExpirationDate) {
      expDate = member.membershipExpirationDate.toDate();
    } else if (member.membershipExpirationDate instanceof Date) {
      expDate = member.membershipExpirationDate;
    } else if (typeof member.membershipExpirationDate === 'string') {
      expDate = new Date(member.membershipExpirationDate);
    }
    if (expDate && !isNaN(expDate.getTime())) {
      validityText = formatDate(expDate);
    }
  }

  const showRenewButton = status === 'expired' || status === 'inactive' || status === 'none';
  const showPayButton = status === 'unpaid';

  return (
    <Animated.View style={[
      styles.container,
      {
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
        marginHorizontal: cardMargin,
      }
    ]}>
      <View style={styles.cardShadow}>
        <LinearGradient
          colors={config.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { width: cardWidth, minHeight: cardHeight }]}
        >
          {/* Motif décoratif fond */}
          <View style={styles.patternContainer}>
            <Text style={[styles.patternText, { color: config.accentColor }]}>۞</Text>
            <Text style={[styles.patternText2, { color: config.accentColor }]}>۞</Text>
          </View>

          {/* Header - Logo et nom mosquée */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={[styles.logoCircle, { borderColor: config.accentColor }]}>
                <Text style={[styles.logoText, { color: config.accentColor }]}>م</Text>
              </View>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.mosqueName, { color: config.accentColor }]}>EL MOUHSSININE</Text>
              <Text style={styles.mosqueSubtitle}>Centre Islamique • Bourg-en-Bresse</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: config.badgeColor }]} />
            </View>
          </View>

          {/* Numéro de membre style carte */}
          <View style={styles.numberSection}>
            <Text style={styles.memberNumberLabel}>N° ADHÉRENT</Text>
            <Text style={styles.memberNumber}>
              {memberNumber.split('').map((digit, i) => (
                <Text key={i}>
                  {digit}
                  {i < memberNumber.length - 1 && i % 4 === 3 ? '  ' : ' '}
                </Text>
              ))}
            </Text>
          </View>

          {/* Footer - Nom et validité */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Text style={styles.label}>TITULAIRE</Text>
              <Text style={styles.memberName} numberOfLines={1} adjustsFontSizeToFit>
                {fullName.toUpperCase()}
              </Text>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.label}>VALIDE</Text>
              <Text style={styles.validity}>{validityText}</Text>
            </View>
          </View>

          {/* Badge statut */}
          <View style={[styles.badge, { borderColor: config.badgeColor }]}>
            <Text style={[styles.badgeText, { color: config.badgeColor }]}>
              {isRTL ? config.badgeAr : config.badge}
            </Text>
          </View>

          {/* Ligne décorative */}
          <View style={[styles.decorLine, { backgroundColor: config.accentColor }]} />
        </LinearGradient>
      </View>

      {/* Boutons d'action */}
      {showPayButton && onPay && (
        <TouchableOpacity style={styles.actionBtn} onPress={onPay} activeOpacity={0.8}>
          <LinearGradient
            colors={['#C9A227', '#D4AF37', '#C9A227']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionBtnGradient}
          >
            <Text style={styles.actionBtnText}>Payer ma cotisation</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {showRenewButton && onRenew && (
        <TouchableOpacity style={styles.actionBtn} onPress={onRenew} activeOpacity={0.8}>
          <LinearGradient
            colors={['#C9A227', '#D4AF37', '#C9A227']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionBtnGradient}
          >
            <Text style={styles.actionBtnText}>Renouveler mon adhésion</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  cardShadow: {
    borderRadius: 16,
    ...platformShadow(12),
  },
  card: {
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  patternContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  patternText: {
    position: 'absolute',
    right: -20,
    top: -20,
    fontSize: 120,
    opacity: 0.03,
  },
  patternText2: {
    position: 'absolute',
    left: -30,
    bottom: -30,
    fontSize: 100,
    opacity: 0.02,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    marginRight: 12,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  mosqueName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  mosqueSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statusBadge: {
    padding: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  numberSection: {
    marginTop: 8,
  },
  memberNumberLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  memberNumber: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '300',
    letterSpacing: 4,
    fontFamily: 'Courier',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  memberName: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 1,
    maxWidth: 180,
  },
  validity: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 1,
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  decorLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.8,
  },
  actionBtn: {
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...platformShadow(4),
  },
  actionBtnGradient: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#1a1a2e',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default MemberCard;
