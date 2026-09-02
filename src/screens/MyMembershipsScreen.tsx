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
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  HEADER_PADDING_TOP,
  platformShadow,
  isSmallScreen,
} from '../theme/colors';
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
import { getStatusBadgeConfig } from '../utils';
import { updateSubscriptionCard } from '../services/stripe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MyMembershipsScreen = () => {
  const navigation = useNavigation<any>();
  const { t, language, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [myMembership, setMyMembership] = useState<MyMembership | null>(null);
  const [inscribedMembers, setInscribedMembers] = useState<InscribedMember[]>(
    [],
  );
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mosqueeInfo, setMosqueeInfo] = useState<MosqueeInfo | null>(null);
  const [dataReceived, setDataReceived] = useState(false);
  const [isUpdatingCard, setIsUpdatingCard] = useState(false);

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
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const unsubscribeAuth = AuthService.onAuthStateChanged(async user => {
      // IMPORTANT: Nettoyer le listener précédent AVANT d'en créer un nouveau
      // Évite les memory leaks lors de changements d'utilisateur (logout/login)
      if (unsubscribeMembership) {
        unsubscribeMembership();
        unsubscribeMembership = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (user && user.email) {
        setUserEmail(user.email);
        setUserId(user.uid);
        setConnectionError(false);
        setDataReceived(false);

        // Timeout: si pas de données après 10s, probablement un problème de connexion
        timeoutId = setTimeout(() => {
          setLoading(false);
          setConnectionError(true);
        }, 10000);

        // S'abonner aux changements en temps réel de l'adhésion
        unsubscribeMembership = subscribeToMyMembership(
          user.email,
          (membership, error) => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            if (error) {
              setConnectionError(true);
            } else {
              setDataReceived(true);
              setConnectionError(false);
            }
            setMyMembership(membership);
            setLoading(false);
            setRefreshing(false);
          },
        );

        // Charger les membres inscrits
        await loadInscribedMembers(user.uid);
      } else {
        setUserEmail(null);
        setUserId(null);
        setMyMembership(null);
        setInscribedMembers([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMembership) {
        unsubscribeMembership();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
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

  // Source unique de vérité : getStatusBadgeConfig (utils/memberStatus.ts)
  const getStatusBadge = (status: string) => {
    const statusConfig = getStatusBadgeConfig(status);
    return (
      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
        <Text style={[styles.statusText, { color: statusConfig.color }]}>
          {language === 'ar' ? statusConfig.labelAr : statusConfig.label}
        </Text>
      </View>
    );
  };

  // Formater le type d'abonnement
  const formatFormule = (
    formule: 'mensuel' | 'annuel' | null | undefined,
  ): string => {
    if (!formule) return '-';
    if (language === 'ar') {
      return formule === 'mensuel' ? 'شهري' : 'سنوي';
    }
    return formule === 'mensuel' ? 'Mensuel' : 'Annuel';
  };

  // Changer la carte bancaire d'un abonnement en cours.
  // Sans ce bouton, un membre dont la carte expire n'a AUCUN moyen de se mettre
  // à jour depuis l'app : son prélèvement est refusé, son abonnement passe en
  // impayé, et il finit par écrire à la mosquée (cas réel du 02/09/2026).
  const handleUpdateCard = async () => {
    if (isUpdatingCard) return;
    setIsUpdatingCard(true);
    try {
      const result = await updateSubscriptionCard();

      if (result.cancelled) {
        // Fermeture volontaire : on ne raconte pas d'histoire, on ne fait rien.
        return;
      }

      if (!result.success) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Modification impossible',
          result.error ||
            (language === 'ar'
              ? 'تعذر تحديث البطاقة. حاول مرة أخرى.'
              : "La carte n'a pas pu être enregistrée. Réessayez ou contactez la mosquée."),
        );
        return;
      }

      const paidLine = result.invoicePaid
        ? language === 'ar'
          ? `\n\nتم تسوية اشتراكك المتأخر (${result.amountPaid ?? ''} €).`
          : `\n\nVotre cotisation en retard a été réglée${
              result.amountPaid ? ` (${result.amountPaid} €)` : ''
            }.`
        : '';

      Vibration.vibrate(50);
      Alert.alert(
        language === 'ar' ? 'تم تحديث البطاقة' : 'Carte mise à jour',
        (language === 'ar'
          ? 'ستُستخدم بطاقتك الجديدة في الاقتطاعات الشهرية القادمة.'
          : 'Votre nouvelle carte sera utilisée pour vos prochains prélèvements mensuels.') +
          paidLine,
      );
    } finally {
      setIsUpdatingCard(false);
    }
  };

  // Annuler un abonnement - redirige vers la messagerie
  const handleCancelSubscription = () => {
    Alert.alert(
      t('cancelSubscriptionConfirm'),
      language === 'ar'
        ? 'لإلغاء اشتراكك، يرجى إرسال طلب عبر الرسائل للتواصل مع المسجد.'
        : 'Pour résilier votre abonnement, veuillez envoyer une demande via la messagerie pour contacter la mosquée.',
      [
        { text: t('commonCancel'), style: 'cancel' },
        {
          text: t('commonSend'),
          onPress: () => navigation.navigate('Member'),
        },
      ],
    );
  };

  if (loading && !connectionError) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {language === 'ar' ? 'عضوياتي' : 'Mes Adhésions'}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.sm,
              marginTop: spacing.md,
            }}
          >
            {language === 'ar' ? 'جاري التحميل...' : 'Chargement...'}
          </Text>
        </View>
      </View>
    );
  }

  if (connectionError && !dataReceived) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {language === 'ar' ? 'عضوياتي' : 'Mes Adhésions'}
          </Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyText}>
            {language === 'ar'
              ? 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.'
              : 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.'}
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => {
              setLoading(true);
              setConnectionError(false);
              setDataReceived(false);
              // Force re-mount by navigating back and forth
              navigation.goBack();
              setTimeout(() => navigation.navigate('MyMemberships'), 100);
            }}
          >
            <Text style={styles.loginBtnText}>
              {language === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!userEmail) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
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
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Mon Adhésion */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            👤 {language === 'ar' ? 'عضويتي' : 'Mon Adhésion'}
          </Text>

          {myMembership ? (
            <>
              {/* Mon adhésion - Carte unique */}
              <View style={styles.unifiedCard}>
                {/* Header avec nom et statut */}
                <View style={styles.unifiedCardHeader}>
                  <View style={styles.unifiedCardAvatar}>
                    <Text style={styles.unifiedCardAvatarText}>
                      {myMembership.prenom?.[0]}
                      {myMembership.nom?.[0]}
                    </Text>
                  </View>
                  <View style={styles.unifiedCardNameSection}>
                    <Text
                      style={[styles.unifiedCardName, isRTL && styles.rtlText]}
                    >
                      {myMembership.prenom} {myMembership.nom}
                    </Text>
                    <Text style={styles.unifiedCardEmail} numberOfLines={1}>
                      {myMembership.email}
                    </Text>
                  </View>
                  {getStatusBadge(myMembership.status)}
                </View>

                {/* Infos principales */}
                <View style={styles.unifiedCardInfoGrid}>
                  <View style={styles.unifiedCardInfoItem}>
                    <Text style={styles.unifiedCardInfoLabel}>
                      📞 Téléphone
                    </Text>
                    <Text style={styles.unifiedCardInfoValue}>
                      {myMembership.telephone || '-'}
                    </Text>
                  </View>
                  <View style={styles.unifiedCardInfoItem}>
                    <Text style={styles.unifiedCardInfoLabel}>📋 Formule</Text>
                    <Text
                      style={[
                        styles.unifiedCardInfoValue,
                        styles.infoHighlight,
                      ]}
                    >
                      {formatFormule(myMembership.formule)}
                    </Text>
                  </View>
                  <View style={styles.unifiedCardInfoItem}>
                    <Text style={styles.unifiedCardInfoLabel}>💰 Montant</Text>
                    <Text
                      style={[
                        styles.unifiedCardInfoValue,
                        styles.infoHighlight,
                      ]}
                    >
                      {myMembership.montant ? `${myMembership.montant} €` : '-'}
                    </Text>
                  </View>
                  {myMembership.modePaiement && (
                    <View style={styles.unifiedCardInfoItem}>
                      <Text style={styles.unifiedCardInfoLabel}>
                        💳 Mode paiement
                      </Text>
                      <Text style={styles.unifiedCardInfoValue}>
                        {myMembership.modePaiement}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Statut paiement */}
                <View style={styles.paymentStatusRow}>
                  <Text style={styles.paymentStatusLabel}>
                    {language === 'ar' ? 'حالة الدفع:' : 'Paiement:'}
                  </Text>
                  {myMembership.status === 'actif' ||
                  myMembership.status === 'en_attente_validation' ? (
                    <View style={[styles.paymentBadge, styles.paymentPaid]}>
                      <Text style={styles.paymentBadgeText}>✓ Payé</Text>
                    </View>
                  ) : myMembership.status === 'en_attente_paiement' ||
                    myMembership.status === 'en_attente_signature' ? (
                    <View style={[styles.paymentBadge, styles.paymentPending]}>
                      <Text style={styles.paymentBadgeText}>⏳ En attente</Text>
                    </View>
                  ) : (
                    <View style={[styles.paymentBadge, styles.paymentUnpaid]}>
                      <Text style={styles.paymentBadgeText}>Non payé</Text>
                    </View>
                  )}
                </View>

                {/* Prélèvement refusé par la banque : le dire, au lieu de
                    laisser le membre découvrir le problème tout seul. */}
                {myMembership.paymentFailedAt && (
                  <View style={styles.paymentFailedBanner}>
                    <Text style={styles.paymentFailedTitle}>
                      {language === 'ar'
                        ? '⚠️ تم رفض آخر اقتطاع'
                        : '⚠️ Dernier prélèvement refusé'}
                    </Text>
                    <Text style={styles.paymentFailedText}>
                      {language === 'ar'
                        ? 'رفض البنك آخر اقتطاع شهري. حدّث بطاقتك أدناه لمتابعة اشتراكك.'
                        : `Votre banque a refusé le prélèvement du ${myMembership.paymentFailedAt.toLocaleDateString(
                            'fr-FR',
                          )} — le plus souvent une carte expirée ou remplacée. Mettez votre carte à jour ci-dessous pour que votre adhésion continue.`}
                    </Text>
                  </View>
                )}

                {/* Si inscrit par quelqu'un d'autre */}
                {myMembership.inscritPar && (
                  <View style={styles.inscritParBanner}>
                    <Text
                      style={[styles.inscritParText, isRTL && styles.rtlText]}
                    >
                      ℹ️ {language === 'ar' ? 'مسجل بواسطة' : 'Inscrit par'}{' '}
                      {myMembership.inscritPar.prenom}{' '}
                      {myMembership.inscritPar.nom}
                    </Text>
                  </View>
                )}

                {/* Boutons d'action */}
                <View style={styles.unifiedCardActions}>
                  {myMembership.status === 'en_attente_paiement' && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => navigation.navigate('Member')}
                    >
                      <Text style={styles.actionBtnText}>
                        💳 Payer maintenant
                      </Text>
                    </TouchableOpacity>
                  )}
                  {['expire', 'aucun', 'annule'].includes(
                    myMembership.status,
                  ) && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => navigation.navigate('Member')}
                    >
                      <Text style={styles.actionBtnText}>🔄 Renouveler</Text>
                    </TouchableOpacity>
                  )}
                  {/* Changer de carte : uniquement si un abonnement mensuel
                      existe réellement chez Stripe (sinon le serveur refuse). */}
                  {/* `en_attente_paiement` EXCLU volontairement : le serveur écrit
                      stripeSubscriptionId + cotisationType AVANT tout paiement.
                      Sans cette garde, un membre dont l'adhésion n'a jamais abouti
                      voyait le bouton, ressaisissait sa carte, s'entendait dire
                      « carte mise à jour » — et n'était jamais débité, parce que
                      finalizeCardUpdate ne règle une facture qu'en impayé. */}
                  {myMembership.stripeSubscriptionId &&
                    myMembership.cotisationType === 'mensuel' &&
                    myMembership.status !== 'en_attente_paiement' && (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          isUpdatingCard && styles.actionBtnDisabled,
                        ]}
                        onPress={handleUpdateCard}
                        disabled={isUpdatingCard}
                      >
                        {isUpdatingCard ? (
                          <ActivityIndicator size="small" color="#1a1a2e" />
                        ) : (
                          <Text style={styles.actionBtnText}>
                            {language === 'ar'
                              ? '💳 تحديث بطاقتي البنكية'
                              : '💳 Mettre à jour ma carte'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  {/* Bouton résilier pour tout abonnement actif */}
                  {(myMembership.status === 'actif' ||
                    myMembership.status === 'en_attente_validation' ||
                    myMembership.status === 'en_attente_signature' ||
                    myMembership.status === 'en_attente_paiement') && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={handleCancelSubscription}
                    >
                      <Text style={styles.cancelBtnText}>
                        {language === 'ar'
                          ? 'إلغاء الاشتراك'
                          : "Résilier l'abonnement"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Banner virement si en attente de paiement */}
              {myMembership.status === 'en_attente_paiement' && mosqueeInfo && (
                <View style={styles.virementBanner}>
                  <Text style={styles.virementBannerTitle}>
                    🏦{' '}
                    {language === 'ar'
                      ? 'معلومات التحويل البنكي'
                      : 'Informations pour le virement'}
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
                        Alert.alert(
                          '✓',
                          language === 'ar' ? 'تم نسخ IBAN' : 'IBAN copié',
                        );
                      }}
                    >
                      <Text style={styles.virementValue}>
                        {mosqueeInfo.iban}
                      </Text>
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
                        Alert.alert(
                          '✓',
                          language === 'ar' ? 'تم نسخ BIC' : 'BIC copié',
                        );
                      }}
                    >
                      <Text style={styles.virementValue}>
                        {mosqueeInfo.bic}
                      </Text>
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
                          Clipboard.setString(
                            myMembership.referenceVirement || '',
                          );
                          Vibration.vibrate(50);
                          Alert.alert(
                            '✓',
                            language === 'ar'
                              ? 'تم نسخ المرجع'
                              : 'Référence copiée',
                          );
                        }}
                      >
                        <Text
                          style={[styles.virementValue, styles.referenceValue]}
                        >
                          {myMembership.referenceVirement}
                        </Text>
                        <Text style={styles.copyIcon}>📋</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.virementNote}>
                    ⚠️{' '}
                    {language === 'ar'
                      ? 'يرجى ذكر المرجع في موضوع التحويل'
                      : "Merci d'indiquer la référence dans le motif du virement"}
                  </Text>
                </View>
              )}

              {/* Banner en attente de validation bureau */}
              {myMembership.status === 'en_attente_validation' && (
                <View style={styles.validationBanner}>
                  <Text style={styles.validationBannerIcon}>✅</Text>
                  <Text style={styles.validationBannerTitle}>
                    {language === 'ar' ? 'تم استلام الدفعة' : 'Paiement reçu'}
                  </Text>
                  <Text style={styles.validationBannerText}>
                    {language === 'ar'
                      ? 'عضويتك في انتظار التحقق من قبل المكتب. سيتم إعلامك بمجرد التحقق منها.'
                      : "Votre adhésion est en attente de validation par le bureau. Vous serez notifié dès qu'elle sera validée."}
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
                  {language === 'ar'
                    ? 'الاشتراك الآن'
                    : "S'inscrire maintenant"}
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
                👥{' '}
                {language === 'ar'
                  ? 'الأشخاص المسجلون بواسطتي'
                  : 'Personnes inscrites par moi'}
              </Text>
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>
                  {inscribedMembers.length}{' '}
                  {language === 'ar' ? 'شخص' : 'pers.'}
                </Text>
              </View>
            </View>

            {inscribedMembers.map(member => (
              <View key={member.id} style={styles.memberListItem}>
                <View style={styles.memberListHeader}>
                  <Text
                    style={[styles.memberListName, isRTL && styles.rtlText]}
                  >
                    {member.prenom} {member.nom}
                  </Text>
                  {getStatusBadge(member.status)}
                </View>

                {/* Statut paiement */}
                <View style={styles.paymentStatusRow}>
                  <Text style={styles.paymentStatusLabel}>
                    {language === 'ar' ? 'حالة الدفع:' : 'Paiement:'}
                  </Text>
                  {member.status === 'actif' || member.datePaiement ? (
                    <View style={[styles.paymentBadge, styles.paymentPaid]}>
                      <Text style={styles.paymentBadgeText}>✓ Payé</Text>
                    </View>
                  ) : member.status === 'en_attente_paiement' ? (
                    <View style={[styles.paymentBadge, styles.paymentPending]}>
                      <Text style={styles.paymentBadgeText}>
                        ⏳ En attente virement
                      </Text>
                    </View>
                  ) : member.status === 'en_attente_validation' ||
                    member.status === 'en_attente_signature' ? (
                    <View style={[styles.paymentBadge, styles.paymentPending]}>
                      <Text style={styles.paymentBadgeText}>⏳ En attente</Text>
                    </View>
                  ) : (
                    <View style={[styles.paymentBadge, styles.paymentUnpaid]}>
                      <Text style={styles.paymentBadgeText}>Non payé</Text>
                    </View>
                  )}
                </View>

                {/* Infos */}
                <View style={styles.memberListDetails}>
                  <Text style={styles.memberListDetail}>
                    📞 {member.telephone || '-'}
                  </Text>
                  <Text style={styles.memberListDetail}>
                    💰 {formatFormule(member.formule)} •{' '}
                    {member.montant ? `${member.montant} €` : '-'}
                  </Text>
                  {member.dateFin && (
                    <Text style={styles.memberListDetail}>
                      📅 Expire: {formatDate(member.dateFin)}
                    </Text>
                  )}
                </View>

                {/* Bouton résilier si actif */}
                {member.status === 'actif' && (
                  <TouchableOpacity
                    style={styles.cancelBtnSmall}
                    onPress={handleCancelSubscription}
                  >
                    <Text style={styles.cancelBtnText}>
                      {language === 'ar' ? 'إلغاء' : 'Résilier'}
                    </Text>
                  </TouchableOpacity>
                )}
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
    color: colors.accentText,
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
  // Validation banner styles
  validationBanner: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(139,92,246,0.1)',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    alignItems: 'center',
  },
  validationBannerIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  validationBannerTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: '#8b5cf6',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  validationBannerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  // Carte unifiée
  unifiedCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...platformShadow(4),
  },
  unifiedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  unifiedCardAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  unifiedCardAvatarText: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  unifiedCardNameSection: {
    flex: 1,
  },
  unifiedCardName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  unifiedCardEmail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  unifiedCardInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  unifiedCardInfoItem: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  unifiedCardInfoLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  unifiedCardInfoValue: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  unifiedCardActions: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: spacing.sm,
  },
  // Membre liste item
  memberListItem: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...platformShadow(2),
  },
  memberListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  memberListName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  paymentStatusLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  paymentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  paymentPaid: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  paymentPending: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  paymentUnpaid: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  paymentBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.text,
  },
  memberListDetails: {
    gap: spacing.xs,
  },
  memberListDetail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  actionBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  actionBtnText: {
    color: '#1a1a2e',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  paymentFailedBanner: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(230,81,0,0.12)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: '#e65100',
  },
  paymentFailedTitle: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: spacing.xs,
  },
  paymentFailedText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default MyMembershipsScreen;
