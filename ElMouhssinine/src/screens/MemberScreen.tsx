import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { getMember, updateMember, createMember } from '../services/firebase';
import { AuthService, MemberProfile } from '../services/auth';
import { StripeService, cotisationPrices } from '../services/stripe';
import { Member } from '../types';
import { useLanguage } from '../context/LanguageContext';

const MemberScreen = () => {
  const { t, isRTL } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [member, setMember] = useState<Member | null>(null);

  const [showCotisationModal, setShowCotisationModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [cotisationType, setCotisationType] = useState<'mensuel' | 'annuel'>('mensuel');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');

  // Cotisation status
  const [isPaid, setIsPaid] = useState(false);

  // Charger les donnees du membre depuis Firestore
  const loadMemberData = async (uid: string) => {
    try {
      const profile = await AuthService.getMemberProfile(uid);
      if (profile) {
        setMemberProfile(profile);
        setMember({
          id: profile.uid,
          name: profile.name,
          email: profile.email,
          phone: profile.phone || '',
          memberId: profile.memberId,
          cotisationType: profile.cotisationType || 'mensuel',
          cotisationStatus: profile.cotisationStatus,
          nextPaymentDate: profile.cotisationExpiry,
          createdAt: profile.createdAt,
        });
        setIsPaid(AuthService.isCotisationActive(profile));
      }
    } catch (error) {
      console.error('Error loading member data:', error);
    }
  };

  // Ecouter l'etat de connexion Firebase
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async (user) => {
      setIsLoading(true);
      if (user) {
        setIsLoggedIn(true);
        await loadMemberData(user.uid);
      } else {
        setIsLoggedIn(false);
        setMemberProfile(null);
        setMember(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const cotisationOptions = [
    { id: 'mensuel', label: 'Mensuel', amount: 10, description: '10€/mois - Prélèvement automatique' },
    { id: 'annuel', label: 'Annuel', amount: 100, description: '100€/an - Paiement unique' },
  ];

  const handlePayCotisation = async () => {
    if (!paymentMethod || !memberProfile) return;

    // Utiliser Stripe (placeholder pour l'instant)
    const result = await StripeService.createSubscription(
      cotisationType,
      memberProfile.email,
      memberProfile.memberId
    );

    if (result.error) {
      Alert.alert(
        'Information',
        result.error + '\n\nCoordonnees bancaires :\nIBAN: FR76 XXXX XXXX XXXX\nBIC: AGRIFRPP\nBeneficiaire: Association El Mouhssinine'
      );
    } else {
      Alert.alert('Succes', 'Paiement effectue avec succes !');
      // Recharger les donnees du membre
      const user = AuthService.getCurrentUser();
      if (user) {
        await loadMemberData(user.uid);
      }
    }
    setShowCotisationModal(false);
  };

  const handleCancelSubscription = async () => {
    // TODO: Annuler via Stripe API quand configure
    Alert.alert(
      'Abonnement annule',
      'Votre abonnement sera actif jusqu\'a la fin de la periode en cours.',
      [{ text: 'OK', onPress: () => setShowCancelModal(false) }]
    );
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }

    setAuthLoading(true);
    const result = await AuthService.signIn(loginEmail, loginPassword);
    setAuthLoading(false);

    if (!result.success) {
      Alert.alert('Erreur de connexion', result.error);
    } else {
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
    }
  };

  const handleRegister = async () => {
    if (!loginEmail || !loginPassword || !registerName) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }

    if (loginPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caracteres.');
      return;
    }

    setAuthLoading(true);
    const result = await AuthService.signUp(loginEmail, loginPassword, registerName);
    setAuthLoading(false);

    if (!result.success) {
      Alert.alert('Erreur d\'inscription', result.error);
    } else {
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
      setRegisterName('');
      Alert.alert('Bienvenue !', 'Votre compte a ete cree avec succes.');
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      Alert.alert('Erreur', 'Veuillez entrer votre adresse email.');
      return;
    }

    setAuthLoading(true);
    const result = await AuthService.resetPassword(forgotEmail);
    setAuthLoading(false);

    if (result.success) {
      Alert.alert('Email envoye', 'Consultez votre boite mail pour reinitialiser votre mot de passe.');
      setShowForgotPasswordModal(false);
      setForgotEmail('');
    } else {
      Alert.alert('Erreur', result.error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Deconnexion',
      'Etes-vous sur de vouloir vous deconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Deconnecter',
          style: 'destructive',
          onPress: async () => {
            await AuthService.signOut();
          },
        },
      ]
    );
  };

  // Ecran de chargement
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>{t('loading')}</Text>
      </View>
    );
  }

  // Si non connecté
  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.header}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>{t('memberArea')}</Text>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('manageSubscription')}</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.notLoggedInCard}>
            <Text style={styles.notLoggedInIcon}>👤</Text>
            <Text style={[styles.notLoggedInTitle, isRTL && styles.rtlText]}>{t('connectYourself')}</Text>
            <Text style={[styles.notLoggedInText, isRTL && styles.rtlText]}>
              {t('accessMemberArea')}
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => { setIsRegistering(false); setShowLoginModal(true); }}
            >
              <Text style={[styles.primaryBtnText, isRTL && styles.rtlText]}>{t('login')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => { setIsRegistering(true); setShowLoginModal(true); }}
            >
              <Text style={[styles.secondaryBtnText, isRTL && styles.rtlText]}>{t('createAccount')}</Text>
            </TouchableOpacity>
          </View>

          {/* Avantages */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>✨ {t('memberBenefits')}</Text>
            {[
              { icon: '📧', textKey: 'taxReceipt' },
              { icon: '🗳️', textKey: 'votingRights' },
            ].map((item, index) => (
              <View key={index} style={[styles.advantageItem, isRTL && styles.advantageItemRTL]}>
                <Text style={styles.advantageIcon}>{item.icon}</Text>
                <Text style={[styles.advantageText, isRTL && styles.rtlText]}>{t(item.textKey as any)}</Text>
              </View>
            ))}
          </View>
        </View>
        </ScrollView>

        {/* Modal Login/Register */}
        <Modal visible={showLoginModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLoginModal(false)}>
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>

              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {isRegistering ? `📝 ${t('createAccount')}` : `🔐 ${t('login')}`}
              </Text>

              {isRegistering && (
                <>
                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>{t('fullName')}</Text>
                  <TextInput
                    style={[styles.input, isRTL && styles.rtlText]}
                    placeholder={t('yourName')}
                    value={registerName}
                    onChangeText={setRegisterName}
                  />
                </>
              )}

              <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>{t('email')}</Text>
              <TextInput
                style={[styles.input, isRTL && styles.rtlText]}
                placeholder="votre@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={loginEmail}
                onChangeText={setLoginEmail}
              />

              <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>{t('password')}</Text>
              <TextInput
                style={[styles.input, isRTL && styles.rtlText]}
                placeholder="••••••••"
                secureTextEntry
                value={loginPassword}
                onChangeText={setLoginPassword}
              />

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={isRegistering ? handleRegister : handleLogin}
              >
                <Text style={[styles.primaryBtnText, isRTL && styles.rtlText]}>
                  {isRegistering ? t('createMyAccount') : t('login')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
                <Text style={[styles.switchAuthText, isRTL && styles.rtlText]}>
                  {isRegistering ? t('alreadyAccount') : t('noAccount')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Si connecté
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>{t('memberArea')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('welcomeUser')} {member?.name?.split(' ')[0]}</Text>
        </View>

        <View style={styles.content}>
          {/* Carte membre */}
          <View style={styles.memberCard}>
            <View style={[styles.memberHeader, isRTL && styles.memberHeaderRTL]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {member?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, isRTL && styles.rtlText]}>{member?.name}</Text>
                <Text style={[styles.memberEmail, isRTL && styles.rtlText]}>{member?.email}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                isPaid ? styles.statusBadgeActive : styles.statusBadgeExpired
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  isPaid ? styles.statusBadgeTextActive : styles.statusBadgeTextExpired
                ]}>
                  {isPaid ? `✓ ${t('upToDate')}` : `✗ ${t('expired')}`}
                </Text>
              </View>
            </View>

            <View style={styles.memberDetails}>
              <View style={[styles.memberDetailRow, isRTL && styles.memberDetailRowRTL]}>
                <Text style={[styles.memberDetailLabel, isRTL && styles.rtlText]}>{t('memberNumber')}</Text>
                <Text style={styles.memberDetailValue}>{member?.memberId}</Text>
              </View>
              <View style={[styles.memberDetailRow, isRTL && styles.memberDetailRowRTL]}>
                <Text style={[styles.memberDetailLabel, isRTL && styles.rtlText]}>{t('type')}</Text>
                <Text style={[styles.memberDetailValue, isRTL && styles.rtlText]}>
                  {member?.cotisationType === 'mensuel' ? `${t('monthly')} (10€${t('perMonth')})` : `${t('yearly')} (100€${t('perYear')})`}
                </Text>
              </View>
              {isPaid && member?.nextPaymentDate && (
                <View style={[styles.memberDetailRow, isRTL && styles.memberDetailRowRTL]}>
                  <Text style={[styles.memberDetailLabel, isRTL && styles.rtlText]}>{t('nextPaymentDate')}</Text>
                  <Text style={styles.memberDetailValue}>
                    {member.nextPaymentDate.toLocaleDateString(isRTL ? 'ar-SA' : 'fr-FR')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Alerte si non payé */}
          {!isPaid && (
            <View style={[styles.alertCard, isRTL && styles.alertCardRTL]}>
              <Text style={styles.alertIcon}>⚠️</Text>
              <View style={styles.alertContent}>
                <Text style={[styles.alertTitle, isRTL && styles.rtlText]}>{t('cotisationExpired')}</Text>
                <Text style={[styles.alertText, isRTL && styles.rtlText]}>
                  {t('renewMessage')}
                </Text>
              </View>
            </View>
          )}

          {/* Boutons cotisation */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isPaid ? `💳 ${t('myCotisation')}` : `💳 ${t('renew')}`}
            </Text>

            {!isPaid ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setShowCotisationModal(true)}
              >
                <Text style={[styles.primaryBtnText, isRTL && styles.rtlText]}>{t('payCotisation')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                {member?.cotisationType === 'mensuel' && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowCancelModal(true)}
                  >
                    <Text style={[styles.cancelBtnText, isRTL && styles.rtlText]}>{t('cancelSubscription')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setShowCotisationModal(true)}
                >
                  <Text style={[styles.secondaryBtnText, isRTL && styles.rtlText]}>{t('changeFormula')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Test buttons - à supprimer en prod */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧪 Test (dev only)</Text>
            <View style={styles.testButtons}>
              <TouchableOpacity 
                style={[styles.testBtn, isPaid && styles.testBtnActive]}
                onPress={() => setIsPaid(true)}
              >
                <Text style={styles.testBtnText}>✓ Payé</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.testBtn, !isPaid && styles.testBtnDanger]}
                onPress={() => setIsPaid(false)}
              >
                <Text style={styles.testBtnText}>✗ Non payé</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Deconnexion */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <Text style={[styles.logoutBtnText, isRTL && styles.rtlText]}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Cotisation */}
      <Modal visible={showCotisationModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowCotisationModal(false)}>
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>

            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>💳 {t('annualCotisation')}</Text>

            {/* Options */}
            <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>{t('chooseFormula')}</Text>
            {cotisationOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.cotisationOption,
                  cotisationType === option.id && styles.cotisationOptionSelected
                ]}
                onPress={() => setCotisationType(option.id as 'mensuel' | 'annuel')}
              >
                <View style={styles.cotisationOptionHeader}>
                  <Text style={styles.cotisationOptionLabel}>{option.label}</Text>
                  <Text style={styles.cotisationOptionAmount}>{option.amount}€</Text>
                </View>
                <Text style={styles.cotisationOptionDesc}>{option.description}</Text>
                {cotisationType === option.id && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {cotisationType === 'mensuel' && (
              <Text style={[styles.mensuelNote, isRTL && styles.rtlText]}>
                ✓ {t('noCommitment')}
              </Text>
            )}

            {/* Méthodes de paiement */}
            <Text style={[styles.inputLabel, isRTL && styles.rtlText, { marginTop: spacing.lg }]}>{t('paymentMethod')}</Text>
            {[
              { id: 'card', icon: '💳', labelKey: 'cardPayment', descKey: 'visaMastercard', isApple: false },
              { id: 'apple', icon: '', label: 'Apple Pay', descKey: 'fastPayment', isApple: true },
              ...(cotisationType === 'mensuel' ? [
                { id: 'sepa', icon: '🏦', labelKey: 'bankTransfer', descKey: 'bankAccount', isApple: false }
              ] : [])
            ].map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentOption,
                  paymentMethod === method.id && styles.paymentOptionSelected,
                  method.isApple && styles.applePayOption,
                  isRTL && styles.paymentOptionRTL
                ]}
                onPress={() => setPaymentMethod(method.id)}
              >
                {method.isApple ? (
                  <Image
                    source={require('../assets/apple-logo.png')}
                    style={styles.appleLogo}
                  />
                ) : method.icon ? (
                  <Text style={styles.paymentIcon}>{method.icon}</Text>
                ) : null}
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentTitle, isRTL && styles.rtlText, method.isApple && styles.applePayText]}>{(method as any).labelKey ? t((method as any).labelKey) : (method as any).label}</Text>
                  <Text style={[styles.paymentDesc, isRTL && styles.rtlText, method.isApple && styles.applePayTextMuted]}>{t((method as any).descKey as any)}</Text>
                </View>
                {paymentMethod === method.id && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: spacing.lg }, !paymentMethod && styles.primaryBtnDisabled]}
              onPress={handlePayCotisation}
              disabled={!paymentMethod}
            >
              <Text style={[styles.primaryBtnText, isRTL && styles.rtlText]}>
                🔒 {t('payButton')} {cotisationType === 'mensuel' ? `10€${t('perMonth')}` : '100€'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.modalDisclaimer, isRTL && styles.rtlText]}>
              {cotisationType === 'mensuel' ? t('cancelAnytime') : t('securePayment')}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Modal Annulation */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowCancelModal(false)}>
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>

            <View style={styles.cancelModalContent}>
              <Text style={styles.cancelIcon}>⚠️</Text>
              <Text style={[styles.cancelTitle, isRTL && styles.rtlText]}>{t('cancelSubscriptionConfirm')}</Text>
              <Text style={[styles.cancelText, isRTL && styles.rtlText]}>
                {t('cancelSubscriptionQuestion')}
              </Text>

              <View style={styles.cancelConsequences}>
                {[
                  t('immediateCancel'),
                  t('noMoreDebit'),
                  `${t('activeUntil')} ${member?.nextPaymentDate?.toLocaleDateString(isRTL ? 'ar-SA' : 'fr-FR') || '—'}`,
                  t('resubscribePossible'),
                ].map((item, index) => (
                  <View key={index} style={[styles.cancelConsequenceItem, isRTL && styles.cancelConsequenceItemRTL]}>
                    <Text style={styles.cancelConsequenceBullet}>•</Text>
                    <Text style={[styles.cancelConsequenceText, isRTL && styles.rtlText]}>{item}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.cancelConfirmBtn}
                onPress={handleCancelSubscription}
              >
                <Text style={[styles.cancelConfirmBtnText, isRTL && styles.rtlText]}>{t('confirmCancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.keepSubscriptionBtn}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={[styles.keepSubscriptionBtnText, isRTL && styles.rtlText]}>{t('keepSubscription')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.md,
  },
  // Not logged in
  notLoggedInCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  notLoggedInIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  notLoggedInTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  notLoggedInText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  advantageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  advantageIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  advantageText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  // Member card
  memberCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
  },
  memberEmail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(39,174,96,0.15)',
  },
  statusBadgeExpired: {
    backgroundColor: 'rgba(231,76,60,0.15)',
  },
  statusBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  statusBadgeTextActive: {
    color: colors.success,
  },
  statusBadgeTextExpired: {
    color: colors.error,
  },
  memberDetails: {},
  memberDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  memberDetailLabel: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  memberDetailValue: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  // Alert
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.2)',
  },
  alertIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 2,
  },
  alertText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  // Buttons
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  secondaryBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.accent,
  },
  cancelBtn: {
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cancelBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.error,
  },
  logoutBtn: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  logoutBtnText: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.6)',
  },
  // Test buttons
  testButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  testBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  testBtnActive: {
    borderColor: colors.success,
    backgroundColor: 'rgba(39,174,96,0.1)',
  },
  testBtnDanger: {
    borderColor: colors.error,
    backgroundColor: 'rgba(231,76,60,0.1)',
  },
  testBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 28,
    color: colors.textMuted,
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  modalDisclaimer: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  // Input
  inputLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  switchAuthText: {
    fontSize: fontSize.sm,
    color: colors.accent,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  // Cotisation options
  cotisationOption: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  cotisationOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(201,162,39,0.08)',
  },
  cotisationOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cotisationOptionLabel: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  cotisationOptionAmount: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.accent,
  },
  cotisationOptionDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  mensuelNote: {
    fontSize: fontSize.sm,
    color: colors.success,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  // Payment options
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(201,162,39,0.08)',
  },
  paymentIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  applePayOption: {
    backgroundColor: '#000000',
    borderWidth: 0,
  },
  applePayIconText: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  applePayText: {
    color: '#FFFFFF',
  },
  applePayTextMuted: {
    color: 'rgba(255,255,255,0.7)',
  },
  appleLogo: {
    width: 20,
    height: 24,
    marginRight: spacing.md,
    tintColor: '#FFFFFF',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  paymentDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  checkmark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Cancel modal
  cancelModalContent: {
    alignItems: 'center',
  },
  cancelIcon: {
    fontSize: 50,
    marginBottom: spacing.lg,
  },
  cancelTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.error,
    marginBottom: spacing.sm,
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cancelConsequences: {
    alignSelf: 'stretch',
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  cancelConsequenceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cancelConsequenceBullet: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  cancelConsequenceText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  cancelConfirmBtn: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: spacing.md,
  },
  cancelConfirmBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  keepSubscriptionBtn: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  keepSubscriptionBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  // RTL Styles
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  advantageItemRTL: {
    flexDirection: 'row-reverse',
  },
  memberHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  memberDetailRowRTL: {
    flexDirection: 'row-reverse',
  },
  alertCardRTL: {
    flexDirection: 'row-reverse',
  },
  paymentOptionRTL: {
    flexDirection: 'row-reverse',
  },
  cancelConsequenceItemRTL: {
    flexDirection: 'row-reverse',
  },
});

export default MemberScreen;
