import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  FlatList,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Member {
  name?: string;
  memberId?: string;
  membershipExpirationDate?: any;
  status?: string;
  paymentStatus?: 'paid' | 'pending' | 'virement_pending' | 'unpaid';
  subscriptionType?: 'mensuel' | 'annuel';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  members: Member[];
  isRTL?: boolean;
}

// COULEUR DE FOND SELON STATUT
const getBackgroundColor = (status?: string) => {
  switch (status) {
    case 'active':
    case 'actif':
      return '#065F46'; // Vert foncé
    case 'expiring':
      return '#B45309'; // Orange foncé
    case 'expired':
    case 'expiré':
      return '#991B1B'; // Rouge foncé
    case 'inactive':
      return '#374151'; // Gris foncé
    case 'unpaid':
    case 'en_attente_paiement':
      return '#92400E'; // Ambre foncé
    case 'en_attente_validation':
      return '#5B21B6'; // Violet foncé
    case 'en_attente_signature':
      return '#B45309'; // Orange foncé (signature)
    default:
      return '#065F46'; // Vert par défaut (actif)
  }
};

const getStatusText = (status?: string) => {
  switch (status) {
    case 'active':
    case 'actif':
      return 'ACTIF';
    case 'expiring':
      return 'EXPIRE BIENTÔT';
    case 'expired':
    case 'expiré':
      return 'EXPIRÉ';
    case 'inactive':
      return 'INACTIF';
    case 'en_attente_validation':
      return 'EN ATTENTE VALIDATION';
    case 'en_attente_signature':
      return 'EN ATTENTE SIGNATURE';
    case 'en_attente_paiement':
      return 'EN ATTENTE PAIEMENT';
    default:
      return 'ACTIF';
  }
};

const getPaymentStatusText = (paymentStatus?: string) => {
  switch (paymentStatus) {
    case 'paid':
      return 'PAYÉ';
    case 'pending':
    case 'virement_pending':
      return 'EN ATTENTE';
    case 'unpaid':
      return 'NON PAYÉ';
    default:
      return null; // Ne pas afficher si pas de statut
  }
};

const getPaymentStatusColor = (paymentStatus?: string) => {
  switch (paymentStatus) {
    case 'paid':
      return '#10B981'; // Vert
    case 'pending':
    case 'virement_pending':
      return '#F59E0B'; // Orange
    case 'unpaid':
      return '#EF4444'; // Rouge
    default:
      return 'rgba(255,255,255,0.5)';
  }
};

const MemberCardFullScreen: React.FC<Props> = ({ visible, onClose, members }) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isLandscape = width > height;

  // Membre actuel pour la couleur de fond
  const currentMember = members[currentIndex] || members[0];
  const backgroundColor = getBackgroundColor(currentMember?.status);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (!members || members.length === 0) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        onRequestClose={onClose}
        supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      >
        <View style={[styles.screen, { backgroundColor: '#374151' }]}>
          <StatusBar hidden />
          <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 16 }]} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.center}>
            <Text style={styles.errorText}>Aucun membre</Text>
          </View>
        </View>
      </Modal>
    );
  }

  const renderMemberCard = ({ item: member }: { item: Member }) => {
    const fullName = member.name || 'MEMBRE';
    const memberId = member.memberId || '00000';
    const digits = memberId.replace(/[^0-9]/g, '').slice(-5).padStart(5, '0');
    const statusText = getStatusText(member.status);
    const paymentStatusText = getPaymentStatusText(member.paymentStatus);
    const paymentStatusColor = getPaymentStatusColor(member.paymentStatus);

    // Type d'abonnement (seulement si payé)
    const subscriptionText = member.paymentStatus === 'paid' && member.subscriptionType
      ? member.subscriptionType === 'mensuel' ? 'MENSUEL' : 'ANNUEL'
      : null;

    let dateStr = '--/--';
    if (member.membershipExpirationDate) {
      try {
        const d = member.membershipExpirationDate.toDate
          ? member.membershipExpirationDate.toDate()
          : new Date(member.membershipExpirationDate);
        dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      } catch (e) {
        dateStr = '--/--';
      }
    }

    return (
      <View style={[styles.cardContainer, { width }]}>
        <View style={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 80 }]}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>م</Text>
            </View>
            <Text style={styles.mosqueName}>EL MOUHSSININE</Text>
            <Text style={styles.mosqueCity}>Bourg-en-Bresse</Text>
          </View>

          {/* STATUTS (Adhésion + Paiement + Type abonnement) */}
          <View style={styles.statusSection}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
            <View style={styles.statusRow}>
              {paymentStatusText && (
                <View style={[styles.paymentBadge, { backgroundColor: paymentStatusColor }]}>
                  <Text style={styles.paymentText}>{paymentStatusText}</Text>
                </View>
              )}
              {subscriptionText && (
                <View style={styles.subscriptionBadge}>
                  <Text style={styles.subscriptionText}>{subscriptionText}</Text>
                </View>
              )}
            </View>
          </View>

          {/* NUMÉRO */}
          <View style={styles.numberSection}>
            <Text style={styles.numberLabel}>N° MEMBRE</Text>
            <Text style={styles.number}>{digits}</Text>
          </View>

          {/* FOOTER */}
          <View style={[styles.footer, isLandscape && styles.footerLandscape]}>
            <View style={styles.footerItem}>
              <Text style={styles.label}>TITULAIRE</Text>
              <Text style={styles.value} numberOfLines={2}>{fullName.toUpperCase()}</Text>
            </View>
            <View style={styles.footerItem}>
              <Text style={styles.label}>VALIDITÉ</Text>
              <Text style={styles.value}>{dateStr}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
    >
      <View style={[styles.screen, { backgroundColor }]}>
        <StatusBar hidden />

        {/* BOUTON FERMER */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 16 }]}
          onPress={onClose}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* LISTE SWIPABLE */}
        <FlatList
          ref={flatListRef}
          data={members}
          renderItem={renderMemberCard}
          keyExtractor={(_, index) => `member-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          decelerationRate="fast"
          snapToInterval={width}
          snapToAlignment="center"
        />

        {/* INDICATEUR DE PAGE (DOTS) */}
        {members.length > 1 && (
          <View style={[styles.pagination, { bottom: insets.bottom + 20 }]}>
            {members.map((_, index) => {
              const inputRange = [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ];
              const dotScale = scrollX.interpolate({
                inputRange,
                outputRange: [0.8, 1.3, 0.8],
                extrapolate: 'clamp',
              });
              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.4, 1, 0.4],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={`dot-${index}`}
                  style={[
                    styles.dot,
                    {
                      transform: [{ scale: dotScale }],
                      opacity: dotOpacity,
                    },
                  ]}
                />
              );
            })}
            <Text style={styles.paginationText}>
              {currentIndex + 1} / {members.length}
            </Text>
          </View>
        )}

        {/* INSTRUCTION SWIPE */}
        {members.length > 1 && currentIndex === 0 && (
          <View style={[styles.swipeHint, { bottom: insets.bottom + 60 }]}>
            <Text style={styles.swipeHintText}>← Swipez pour voir les autres membres →</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '300',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFF',
    fontSize: 20,
  },
  cardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },

  // HEADER
  header: {
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
    color: '#FFF',
  },
  mosqueName: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
  },
  mosqueCity: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 4,
  },

  // STATUTS
  statusSection: {
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  statusText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  paymentText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subscriptionBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  subscriptionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // NUMÉRO
  numberSection: {
    alignItems: 'center',
  },
  numberLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    letterSpacing: 3,
    fontWeight: '600',
  },
  number: {
    color: '#FFF',
    fontSize: 72,
    fontWeight: '200',
    letterSpacing: 20,
    marginTop: 8,
  },

  // FOOTER
  footer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLandscape: {
    maxWidth: 500,
  },
  footerItem: {
    flex: 1,
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
  },
  value: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 6,
  },

  // PAGINATION
  pagination: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
    marginHorizontal: 6,
  },
  paginationText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginLeft: 16,
  },

  // SWIPE HINT
  swipeHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeHintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
});

export default MemberCardFullScreen;
