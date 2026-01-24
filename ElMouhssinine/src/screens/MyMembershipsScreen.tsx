import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Vibration,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, platformShadow, isSmallScreen } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { AuthService } from '../services/auth';
import {
  subscribeToMyMembership,
  getMembersInscribedBy,
  getMosqueeInfo,
  MyMembership,
  InscribedMember,
  MosqueeInfo,
} from '../services/firebase';
import MemberCard, { getMembershipStatus } from '../components/MemberCard';

const MyMembershipsScreen = () => {
  const navigation = useNavigation<any>();
  const { t, language, isRTL } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myMembership, setMyMembership] = useState<MyMembership | null>(null);
  const [inscribedMembers, setInscribedMembers] = useState<InscribedMember[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mosqueeInfo, setMosqueeInfo] = useState<MosqueeInfo | null>(null);

  // Charger les membres inscrits par l'utilisateur
  const loadInscribedMembers = async (uid: string) => {
    try {
      const inscribed = await getMembersInscribedBy(uid);
      setInscribedMembers(inscribed);
    } catch (error) {
      console.error('[MyMemberships] Error loading inscribed members:', error);
    }
  };

  // Écouter l'état d'authentification Firebase et s'abonner aux changements en temps réel
  useEffect(() => {
    let unsubscribeMembership: (() => void) | null = null;

    const unsubscribeAuth = AuthService.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        setUserEmail(user.email);
        setUserId(user.uid);

        // S'abonner aux changements en temps réel de l'adhésion
        unsubscribeMembership = subscribeToMyMembership(user.email, (membership) => {
          setMyMembership(membership);
          setLoading(false);
          setRefreshing(false);
        });

        // Charger les membres inscrits
        await loadInscribedMembers(user.uid);
      } else {
        setUserEmail(null);
        setUserId(null);
        setMyMembership(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMembership) {
        unsubscribeMembership();
      }
    };
  }, []);

  // Charger les infos de la mosquée (IBAN, etc.)
  useEffect(() => {
    const loadMosqueeInfo = async () => {
      const info = await getMosqueeInfo();
      setMosqueeInfo(info);
    };
    loadMosqueeInfo();
  }, []);

  const onRefresh = async () => {
    if (userId) {
      setRefreshing(true);
      await loadInscribedMembers(userId);
      // Note: myMembership se met à jour automatiquement via le listener temps réel
      setTimeout(() => setRefreshing(false), 500); // Feedback visuel
    }
  };

  // Formater une date
  const formatDate = (date: Date | undefined): string => {
    if (!date) return '-';
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Obtenir le badge de statut
  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; labelAr: string; color: string; bg: string }> = {
      actif: { label: 'Actif', labelAr: 'نشط', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
      active: { label: 'Actif', labelAr: 'نشط', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
      en_attente_signature: { label: 'En attente signature', labelAr: 'في انتظار التوقيع', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
      en_attente_paiement: { label: 'En attente paiement', labelAr: 'في انتظار الدفع', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
      pending: { label: 'En attente', labelAr: 'في الانتظار', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
      expire: { label: 'Expiré', labelAr: 'منتهي', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
      expired: { label: 'Expiré', labelAr: 'منتهي', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
      aucun: { label: 'Aucun', labelAr: 'لا يوجد', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
    };

    const statusConfig = config[status] || config.en_attente_signature;

    return (
      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
        <Text style={[styles.statusText, { color: statusConfig.color }]}>
          {language === 'ar' ? statusConfig.labelAr : statusConfig.label}
        </Text>
      </View>
    );
  };

  // Formater le type d'abonnement
  const formatFormule = (formule: 'mensuel' | 'annuel' | null | undefined): string => {
    if (!formule) return '-';
    if (language === 'ar') {
      return formule === 'mensuel' ? 'شهري' : 'سنوي';
    }
    return formule === 'mensuel' ? 'Mensuel' : 'Annuel';
  };

  // Annuler un abonnement - redirige vers la messagerie
  const handleCancelSubscription = () => {
    Alert.alert(
      language === 'ar' ? 'إلغاء الاشتراك' : 'Résilier l\'abonnement',
      language === 'ar'
        ? 'لإلغاء اشتراكك، يرجى إرسال طلب عبر الرسائل للتواصل مع المسجد.'
        : 'Pour résilier votre abonnement, veuillez envoyer une demande via la messagerie pour contacter la mosquée.',
      [
        { text: language === 'ar' ? 'إلغاء' : 'Annuler', style: 'cancel' },
        {
          text: language === 'ar' ? 'إرسال رسالة' : 'Envoyer un message',
          onPress: () => navigation.navigate('Messages'),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {language === 'ar' ? 'عضوياتي' : 'Mes Adhésions'}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (!userEmail) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {language === 'ar' ? 'عضوياتي' : 'Mes Adhésions'}
          </Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyText}>
            {language === 'ar'
              ? 'يجب تسجيل الدخول لعرض عضوياتك'
              : 'Connectez-vous pour voir vos adhésions'}
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => navigation.navigate('Member')}
          >
            <Text style={styles.loginBtnText}>
              {language === 'ar' ? 'تسجيل الدخول' : 'Se connecter'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {language === 'ar' ? 'عضوياتي' : 'Mes Adhésions'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Mon Adhésion - Carte de membre */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            👤 {language === 'ar' ? 'بطاقة عضويتي' : 'Ma Carte de Membre'}
          </Text>

          {myMembership ? (
            <>
              {/* Carte de membre avec design professionnel */}
              <MemberCard
                member={{
                  name: `${myMembership.prenom} ${myMembership.nom}`,
                  memberId: myMembership.id,
                  membershipExpirationDate: myMembership.dateFin || null,
                  status: myMembership.status === 'en_attente_paiement' ? 'en_attente_paiement' : myMembership.status,
                }}
                isRTL={isRTL}
                onPay={myMembership.status === 'en_attente_paiement' ? () => navigation.navigate('Member') : undefined}
                onRenew={['expire', 'expired', 'inactive', 'none'].includes(myMembership.status) ? () => navigation.navigate('Member') : undefined}
              />

              {/* Détails supplémentaires */}
              <View style={styles.detailsCard}>
                <Text style={[styles.detailsTitle, isRTL && styles.rtlText]}>
                  📋 {language === 'ar' ? 'التفاصيل' : 'Détails'}
                </Text>

                <View style={styles.infoGrid}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                    </Text>
                    <Text style={[styles.infoValue, isRTL && styles.rtlText]} numberOfLines={1}>
                      {myMembership.email}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {language === 'ar' ? 'الهاتف' : 'Téléphone'}
                    </Text>
                    <Text style={styles.infoValue}>{myMembership.telephone || '-'}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {language === 'ar' ? 'نوع الاشتراك' : 'Formule'}
                    </Text>
                    <Text style={[styles.infoValue, styles.infoHighlight]}>
                      {formatFormule(myMembership.formule)} • {myMembership.montant ? `${myMembership.montant} €` : '-'}
                    </Text>
                  </View>

                  {myMembership.modePaiement && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>
                        {language === 'ar' ? 'طريقة الدفع' : 'Paiement'}
                      </Text>
                      <Text style={styles.infoValue}>{myMembership.modePaiement}</Text>
                    </View>
                  )}
                </View>

                {/* Bouton résilier pour tout abonnement actif */}
                {(myMembership.status === 'actif' || myMembership.status === 'active') && (
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSubscription}>
                    <Text style={styles.cancelBtnText}>
                      {language === 'ar' ? 'إلغاء الاشتراك' : 'Résilier l\'abonnement'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Si inscrit par quelqu'un d'autre */}
                {myMembership.inscritPar && (
                  <View style={styles.inscritParBanner}>
                    <Text style={[styles.inscritParText, isRTL && styles.rtlText]}>
                      ℹ️ {language === 'ar' ? 'مسجل بواسطة' : 'Inscrit par'}{' '}
                      {myMembership.inscritPar.prenom} {myMembership.inscritPar.nom}
                    </Text>
                  </View>
                )}
              </View>

              {/* Banner virement si en attente de paiement */}
              {myMembership.status === 'en_attente_paiement' && mosqueeInfo && (
                <View style={styles.virementBanner}>
                  <Text style={styles.virementBannerTitle}>
                    🏦 {language === 'ar' ? 'معلومات التحويل البنكي' : 'Informations pour le virement'}
                  </Text>
                  <Text style={styles.virementBannerSubtitle}>
                    {language === 'ar'
                      ? 'أكمل دفعتك عبر التحويل البنكي'
                      : 'Finalisez votre paiement par virement'}
                  </Text>

                  <View style={styles.virementInfoRow}>
                    <Text style={styles.virementLabel}>IBAN</Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => {
                        Clipboard.setString(mosqueeInfo.iban || '');
                        Vibration.vibrate(50);
                        Alert.alert('✓', language === 'ar' ? 'تم نسخ IBAN' : 'IBAN copié');
                      }}
                    >
                      <Text style={styles.virementValue}>{mosqueeInfo.iban}</Text>
                      <Text style={styles.copyIcon}>📋</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.virementInfoRow}>
                    <Text style={styles.virementLabel}>BIC</Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => {
                        Clipboard.setString(mosqueeInfo.bic || '');
                        Vibration.vibrate(50);
                        Alert.alert('✓', language === 'ar' ? 'تم نسخ BIC' : 'BIC copié');
                      }}
                    >
                      <Text style={styles.virementValue}>{mosqueeInfo.bic}</Text>
                      <Text style={styles.copyIcon}>📋</Text>
                    </TouchableOpacity>
                  </View>

                  {myMembership.referenceVirement && (
                    <View style={styles.virementInfoRow}>
                      <Text style={styles.virementLabel}>
                        {language === 'ar' ? 'المرجع' : 'Référence'}
                      </Text>
                      <TouchableOpacity
                        style={styles.copyBtn}
                        onPress={() => {
                          Clipboard.setString(myMembership.referenceVirement || '');
                          Vibration.vibrate(50);
                          Alert.alert('✓', language === 'ar' ? 'تم نسخ المرجع' : 'Référence copiée');
                        }}
                      >
                        <Text style={[styles.virementValue, styles.referenceValue]}>
                          {myMembership.referenceVirement}
                        </Text>
                        <Text style={styles.copyIcon}>📋</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.virementNote}>
                    ⚠️ {language === 'ar'
                      ? 'يرجى ذكر المرجع في موضوع التحويل'
                      : 'Merci d\'indiquer la référence dans le motif du virement'}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noMembershipCard}>
              <Text style={styles.noMembershipIcon}>📋</Text>
              <Text style={[styles.noMembershipText, isRTL && styles.rtlText]}>
                {language === 'ar'
                  ? 'لم يتم العثور على عضوية لهذا البريد الإلكتروني'
                  : 'Aucune adhésion trouvée pour cet email'}
              </Text>
              <TouchableOpacity
                style={styles.subscribeBtn}
                onPress={() => navigation.navigate('Member')}
              >
                <Text style={styles.subscribeBtnText}>
                  {language === 'ar' ? 'الاشتراك الآن' : 'S\'inscrire maintenant'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Personnes inscrites par moi */}
        {inscribedMembers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                👥 {language === 'ar' ? 'الأشخاص المسجلون بواسطتي' : 'Personnes inscrites par moi'}
              </Text>
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>
                  {inscribedMembers.length} {language === 'ar' ? 'شخص' : 'pers.'}
                </Text>
              </View>
            </View>

            {inscribedMembers.map((member) => (
              <View key={member.id}>
                {/* Carte de membre avec design identique */}
                <MemberCard
                  member={{
                    name: `${member.prenom} ${member.nom}`,
                    memberId: member.id,
                    membershipExpirationDate: member.dateFin || null,
                    status: member.status === 'en_attente_paiement' ? 'en_attente_paiement' : member.status,
                  }}
                  isRTL={isRTL}
                />

                {/* Infos supplémentaires sous la carte */}
                <View style={styles.inscribedMemberInfo}>
                  <Text style={styles.inscribedMemberDetail}>
                    📞 {member.telephone || '-'}
                  </Text>
                  <Text style={styles.inscribedMemberDetail}>
                    💰 {formatFormule(member.formule)} • {member.montant ? `${member.montant} €` : '-'}
                  </Text>
                  {(member.status === 'actif' || member.status === 'active') && (
                    <TouchableOpacity style={styles.cancelBtnSmall} onPress={handleCancelSubscription}>
                      <Text style={styles.cancelBtnText}>
                        {language === 'ar' ? 'إلغاء' : 'Résilier'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Espace en bas */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  backButtonText: {
    fontSize: 24,
    color: colors.text,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.accent,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  loginBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  loginBtnText: {
    color: '#1a1a2e',
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  totalBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  totalBadgeText: {
    color: '#1a1a2e',
    fontSize: fontSize.xs,
    fontWeight: 'bold',
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    marginTop: spacing.sm,
    marginHorizontal: 24,
    ...platformShadow(3),
  },
  detailsTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: spacing.md,
  },
  inscribedMemberInfo: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: 24,
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
    ...platformShadow(2),
  },
  inscribedMemberDetail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  infoGrid: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  infoHighlight: {
    color: colors.accent,
    fontWeight: 'bold',
  },
  infoDate: {
    color: '#22c55e',
  },
  cancelBtn: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#ef4444',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cancelBtnSmall: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  inscritParBanner: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(201,162,39,0.1)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  inscritParText: {
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  noMembershipCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...platformShadow(2),
  },
  noMembershipIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  noMembershipText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  subscribeBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  subscribeBtnText: {
    color: '#1a1a2e',
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  memberCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...platformShadow(2),
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  memberName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  memberDetails: {
    gap: spacing.xs,
  },
  memberDetail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  // Virement banner styles
  virementBanner: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(59,130,246,0.1)',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  virementBannerTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: spacing.xs,
  },
  virementBannerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  virementInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  virementLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  virementValue: {
    fontSize: isSmallScreen ? fontSize.xs : fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    marginLeft: spacing.sm,
  },
  referenceValue: {
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  copyIcon: {
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
  },
  virementNote: {
    fontSize: fontSize.xs,
    color: '#f59e0b',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default MyMembershipsScreen;
