import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useLanguage } from '../context/LanguageContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 12;
const CARD_WIDTH = SCREEN_WIDTH - (CARD_MARGIN * 2);
const CARD_HEIGHT = CARD_WIDTH * 0.6;

export type MembershipStatus = 'active' | 'expiring' | 'expired' | 'inactive' | 'unpaid' | 'none';

export const getMembershipStatus = (member: MemberCardProps['member']): MembershipStatus => {
  if (member?.status === 'en_attente_paiement' || member?.status === 'unpaid') {
    return 'unpaid';
  }
  if (!member?.membershipExpirationDate) return 'none';

  let expiration: Date;
  if (typeof member.membershipExpirationDate === 'object' && member.membershipExpirationDate?.toDate) {
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

interface MemberCardProps {
  member: {
    name?: string;
    memberId?: string;
    membershipExpirationDate?: any;
    status?: string;
  } | null;
  cardWidth?: number;
  onRenew?: () => void;
  onPay?: () => void;
  isRTL?: boolean;
}

const MemberCard: React.FC<MemberCardProps> = ({ member, cardWidth }) => {
  const { t, isRTL } = useLanguage();
  const width = cardWidth || CARD_WIDTH;
  const height = width * 0.55;

  const isExpired = member?.status === 'expired' || member?.status === 'inactive';
  const badgeText = isExpired ? t('memberCardExpired') : t('memberCardActive');
  const badgeColor = isExpired ? '#EF4444' : '#10B981';

  const formatDate = () => {
    if (!member?.membershipExpirationDate) return '--/--';
    try {
      const date = member.membershipExpirationDate.toDate ?
        member.membershipExpirationDate.toDate() :
        new Date(member.membershipExpirationDate);
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    } catch {
      return '--/--';
    }
  };

  const memberId = member?.memberId || '00000';
  const digits = memberId.slice(-5).padStart(5, '0').split('');
  const fullName = member?.name || 'MEMBRE';

  return (
    <View style={[styles.container, { width }]}>
      <LinearGradient
        colors={['#374151', '#1F2937', '#111827']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { width, height }]}
      >
        {/* HEADER */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <View style={[styles.headerLeft, isRTL && styles.headerLeftRTL]}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>م</Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.mosqueName, isRTL && styles.textRTL]}>EL MOUHSSININE</Text>
              <Text style={[styles.mosqueSubtitle, isRTL && styles.textRTL]} numberOfLines={1}>
                {t('memberCardCenter')} • {t('memberCardCity')}
              </Text>
            </View>
          </View>
          <View style={[styles.badge, { borderColor: badgeColor }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>
        </View>

        {/* NUMÉRO ADHÉRENT */}
        <View style={styles.numberSection}>
          <Text style={[styles.numberLabel, isRTL && styles.textRTL]}>{t('memberCardNumber')}</Text>
          <View style={[styles.digits, isRTL && styles.digitsRTL]}>
            {digits.map((digit, index) => (
              <Text key={index} style={styles.digit}>{digit}</Text>
            ))}
          </View>
        </View>

        {/* FOOTER */}
        <View style={[styles.footer, isRTL && styles.footerRTL]}>
          <View style={[styles.footerLeft, isRTL && styles.footerLeftRTL]}>
            <Text style={[styles.label, isRTL && styles.textRTL]}>{t('memberCardHolder')}</Text>
            <Text style={[styles.value, isRTL && styles.textRTL]} numberOfLines={1}>{fullName.toUpperCase()}</Text>
          </View>
          <View style={[styles.footerRight, isRTL && styles.footerRightRTL]}>
            <Text style={[styles.label, isRTL && styles.textRTL]}>{t('memberCardValid')}</Text>
            <Text style={[styles.value, isRTL && styles.textRTL]}>{formatDate()}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  headerTextContainer: {
    flex: 1,
  },
  mosqueName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  mosqueSubtitle: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  numberSection: {
    marginVertical: 8,
  },
  numberLabel: {
    fontSize: 10,
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 4,
  },
  digits: {
    flexDirection: 'row',
  },
  digit: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    marginRight: 16,
    fontVariant: ['tabular-nums'],
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
    flexShrink: 0,
  },
  label: {
    fontSize: 8,
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  // RTL Styles
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  headerLeftRTL: {
    flexDirection: 'row-reverse',
    marginRight: 0,
    marginLeft: 8,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  digitsRTL: {
    flexDirection: 'row-reverse',
  },
  footerRTL: {
    flexDirection: 'row-reverse',
  },
  footerLeftRTL: {
    alignItems: 'flex-end',
  },
  footerRightRTL: {
    alignItems: 'flex-start',
  },
});

export default MemberCard;
