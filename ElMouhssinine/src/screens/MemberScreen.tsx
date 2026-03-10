import React, { useState, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  HEADER_PADDING_TOP,
  platformShadow,
  isSmallScreen,
  isTablet,
  moderateScale,
} from '../theme/colors';
import {
  subscribeToCotisationPrices,
  CotisationPrices,
  getMosqueeInfo,
  MosqueeInfo,
  createMember,
  getMembersInscribedBy,
  InscribedMember,
  subscribeToMemberProfile,
  MemberProfileRealtime,
  subscribeToReglement,
  ReglementData,
  requestRecuFiscal,
  cancelSubscription,
} from '../services/firebase';
import {
  AuthService,
  MemberProfile,
  validateEmailQuality,
} from '../services/auth';
import {
  makePayment,
  makeApplePayPayment,
  makeSubscription,
  makeApplePaySubscription,
  showPaymentError,
  showPaymentSuccess,
} from '../services/stripe';
import { isPlatformPaySupported } from '@stripe/stripe-react-native';
import {
  subscribeToMembersTopic,
  saveFCMTokenToFirestore,
  removeFCMTokenFromFirestore,
} from '../services/notifications';
import { useLanguage } from '../context/LanguageContext';
import MemberCard from '../components/MemberCard';
import MemberCardFullScreen from '../components/MemberCardFullScreen';
import { logger } from '../utils';
import { computeMemberStatus } from '../utils/memberStatus';
import {
  logError,
  logBreadcrumb,
  trackEvent,
  startTrace,
  setUserForCrashlytics,
  Events,
} from '../services/monitoring';
import { BackgroundPattern } from '../components/BackgroundPattern';
import firestore from '@react-native-firebase/firestore';
import firebase from '@react-native-firebase/app';
import '@react-native-firebase/functions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ============================================================
// MEMBER SCREEN - Refonte UX épurée
// Flow: Connexion → Paiement → Carte de membre
// ============================================================

const MemberScreen = () => {
  const navigation = useNavigation<any>();
  const { t, isRTL, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // États principaux
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(
    null,
  );
  const [isPaid, setIsPaid] = useState(false);
  const [inscribedMembers, setInscribedMembers] = useState<InscribedMember[]>(
    [],
  );
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // 3 pages : 'sympathisant' | 'devenir_adherent' | 'membre_actif'
  const [memberPage, setMemberPage] = useState<
    'sympathisant' | 'devenir_adherent' | 'membre_actif'
  >('sympathisant');
  const [isExpired, setIsExpired] = useState(false);
  const [contextMessage, setContextMessage] = useState<string | null>(null);

  // Prix et infos
  const [formulePrices, setFormulePrices] = useState<CotisationPrices>({
    mensuel: 10,
    annuel: 100,
  });
  const [mosqueeInfo, setMosqueeInfo] = useState<MosqueeInfo | null>(null);

  // Modales
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCardFullScreen, setShowCardFullScreen] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showReglementModal, setShowReglementModal] = useState(false);

  // Règlement intérieur
  const [reglement, setReglement] = useState<ReglementData | null>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [acceptedReglement, setAcceptedReglement] = useState(false);

  // Formulaire connexion
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const isRegistrationInProgress = useRef(false); // Empêche le changement de vue pendant l'inscription
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerNom, setRegisterNom] = useState('');
  const [registerPrenom, setRegisterPrenom] = useState('');
  const [registerTelephone, setRegisterTelephone] = useState('');
  const [registerAdresse, setRegisterAdresse] = useState('');
  const [registerGenre, setRegisterGenre] = useState<'homme' | 'femme' | ''>(
    '',
  );
  const [registerDateNaissance, setRegisterDateNaissance] = useState('');
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Paiement
  const [selectedFormule, setSelectedFormule] = useState<'mensuel' | 'annuel'>(
    'annuel',
  );
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const isProcessingRef = useRef(false); // BUG 7 FIX: Verrou synchrone anti-double tap
  const paymentSucceededRef = useRef(false); // BUG D FIX: Empêche de payer plusieurs fois dans la même session
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);

  // Reçu fiscal
  const [selectedRecuYear, setSelectedRecuYear] = useState(
    new Date().getFullYear() - 1,
  );
  const [sendingRecuFiscal, setSendingRecuFiscal] = useState(false);

  // Historique par année
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([
    new Date().getFullYear(),
  ]);
  const [showDonationsModal, setShowDonationsModal] = useState(false);
  const [showAdhesionsModal, setShowAdhesionsModal] = useState(false);

  // Calculer cotisation (fixe) et don (surplus)
  // Utilise les prix de Firebase (formulePrices) pour respecter les prix configurés dans le backoffice
  const getPaymentBreakdown = (
    formule: 'mensuel' | 'annuel',
    totalAmount?: number,
  ) => {
    const cotisationFixe = formulePrices[formule]; // Prix depuis Firebase, pas hardcodé
    const total =
      totalAmount && totalAmount >= cotisationFixe
        ? totalAmount
        : cotisationFixe;
    const don = Math.max(0, total - cotisationFixe);
    return { cotisation: cotisationFixe, don, total };
  };

  // Montant total à payer (cotisation + don optionnel)
  const getCurrentAmount = () => {
    const minAmount = formulePrices[selectedFormule];
    const customNum = parseInt(customAmount, 10);
    if (customAmount && !isNaN(customNum) && customNum >= minAmount) {
      return customNum;
    }
    return minAmount;
  };

  // Famille
  const [familyMembers, setFamilyMembers] = useState<
    {
      id: string;
      nom: string;
      prenom: string;
      telephone: string;
      adresse: string;
      genre: 'homme' | 'femme' | '';
      dateNaissance: string;
      accepte: boolean;
    }[]
  >([]);
  const [familyFormule, setFamilyFormule] = useState<'mensuel' | 'annuel'>(
    'annuel',
  );

  // ============================================================
  // EFFECTS
  // ============================================================

  // Listener pour profil membre en temps réel (useRef pour éviter stale closure avec useState)
  const memberProfileUnsubscribeRef = useRef<(() => void) | null>(null);
  const paymentHistoryUnsubscribeRef = useRef<(() => void) | null>(null);
  const donationHistoryUnsubscribeRef = useRef<(() => void) | null>(null);
  const donationByEmailUnsubscribeRef = useRef<(() => void) | null>(null);
  // Build 249 - Refs pour fusionner payments + donations en temps réel
  const paymentsRef = React.useRef<any[]>([]);
  const donationsRef = React.useRef<any[]>([]);
  const donationsByEmailRef = React.useRef<any[]>([]);

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async user => {
      // Ne pas changer la vue pendant l'inscription (évite le flash modal)
      if (isRegistrationInProgress.current) {
        return;
      }

      setIsLoading(true);

      // Nettoyer les anciens listeners si existants
      if (memberProfileUnsubscribeRef.current) {
        memberProfileUnsubscribeRef.current();
        memberProfileUnsubscribeRef.current = null;
      }
      if (paymentHistoryUnsubscribeRef.current) {
        paymentHistoryUnsubscribeRef.current();
        paymentHistoryUnsubscribeRef.current = null;
      }
      if (donationHistoryUnsubscribeRef.current) {
        donationHistoryUnsubscribeRef.current();
        donationHistoryUnsubscribeRef.current = null;
      }
      if (donationByEmailUnsubscribeRef.current) {
        donationByEmailUnsubscribeRef.current();
        donationByEmailUnsubscribeRef.current = null;
      }

      if (user) {
        setIsLoggedIn(true);
        setUserForCrashlytics(user.uid);

        // S10: Vérifier paiement interrompu (3DS)
        checkPendingPayment();

        // Souscrire au profil en temps réel (se met à jour depuis le backoffice)
        const unsubMember = subscribeToMemberProfile(
          user.uid,
          user.email || '',
          profile => {
            if (profile) {
              // Convertir MemberProfileRealtime vers MemberProfile
              const memberProf: MemberProfile = {
                uid: user.uid,
                name: `${profile.prenom} ${profile.nom}`.trim(),
                email: profile.email,
                memberId: profile.memberId,
                nom: profile.nom,
                prenom: profile.prenom,
                cotisationType: profile.cotisation.type,
                cotisationStatus: profile.cotisation.status as
                  | 'actif'
                  | 'expire'
                  | 'en_attente_paiement'
                  | 'en_attente_validation'
                  | 'en_attente_signature'
                  | 'aucun'
                  | 'sympathisant'
                  | 'annule',
                cotisationExpiry: profile.cotisation.dateFin || undefined,
                telephone: profile.telephone,
                adresse: profile.adresse,
                createdAt: new Date(),
              };
              setMemberProfile(memberProf);

              // Source unique de vérité : computeMemberStatus
              const resolvedStatus = computeMemberStatus({
                status: profile.cotisation.status,
                cotisationDateFin: profile.cotisation.dateFin,
              });
              const isActive = resolvedStatus === 'actif';
              setIsPaid(isActive);
              setIsExpired(resolvedStatus === 'expire');

              // Determiner la page membre
              if (isActive) {
                setMemberPage('membre_actif');
                setContextMessage(null);
              } else if (resolvedStatus === 'expire') {
                setMemberPage('devenir_adherent');
                setContextMessage(
                  'Votre cotisation a expiré. Renouvelez pour rester membre actif.',
                );
              } else if (resolvedStatus === 'annule') {
                setMemberPage('devenir_adherent');
                setContextMessage(
                  'Votre adhésion a été annulée. Contactez la mosquée si besoin.',
                );
              } else if (
                resolvedStatus === 'sympathisant' ||
                resolvedStatus === 'aucun'
              ) {
                setMemberPage('sympathisant');
              } else {
                // en_attente_validation, en_attente_signature, en_attente_paiement
                setMemberPage('devenir_adherent');
              }

              // Charger les membres inscrits (une seule fois)
              getMembersInscribedBy(user.uid).then(setInscribedMembers);
            } else {
              // Profil pas encore créé, charger via la méthode classique (pour création initiale)
              loadMemberData(user.uid);
            }
            setIsLoading(false);
          },
        );

        memberProfileUnsubscribeRef.current = unsubMember;

        // Build 249 - Historique paiements + dons fusionnés en temps réel
        setLoadingHistory(true);

        // Fonction de fusion payments + donations (par uid + par email), triés par date, dédupliqués
        const mergeAndSetHistory = () => {
          // Fusionner donations par uid + par email, dédupliquer par id
          const donationsMap = new Map<string, any>();
          donationsRef.current.forEach((d: any) => donationsMap.set(d.id, d));
          donationsByEmailRef.current.forEach((d: any) => {
            if (!donationsMap.has(d.id)) donationsMap.set(d.id, d);
          });
          const all = [
            ...paymentsRef.current,
            ...Array.from(donationsMap.values()),
          ];
          all.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
          });
          setPaymentHistory(all);
          // Calculer les années disponibles dynamiquement
          const yearsSet = new Set<number>([new Date().getFullYear()]);
          all.forEach((p: any) => {
            const d = p.createdAt?.toDate?.() || new Date(p.createdAt);
            if (d && !isNaN(d.getTime())) yearsSet.add(d.getFullYear());
          });
          setAvailableYears(Array.from(yearsSet).sort((a, b) => b - a));
          setLoadingHistory(false);
        };

        // Listener cotisations (collection payments)
        const unsubHistory = firestore()
          .collection('payments')
          .where('metadata.memberId', '==', user.uid)
          .onSnapshot(
            snapshot => {
              paymentsRef.current = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
                _type: 'cotisation',
              }));
              mergeAndSetHistory();
            },
            (error: any) => {
              console.warn(
                '[MemberScreen] payments query error:',
                error?.code,
                error?.message,
              );
              paymentsRef.current = [];
              mergeAndSetHistory();
            },
          );
        paymentHistoryUnsubscribeRef.current = unsubHistory;

        // Listener dons (collection donations)
        const unsubDonations = firestore()
          .collection('donations')
          .where('userId', '==', user.uid)
          .onSnapshot(
            snapshot => {
              donationsRef.current = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
                _type: 'donation',
              }));
              mergeAndSetHistory();
            },
            error => {
              if (__DEV__)
                console.error('Error loading donation history:', error);
              donationsRef.current = [];
              mergeAndSetHistory();
            },
          );
        donationHistoryUnsubscribeRef.current = unsubDonations;

        // Build 261 - Second listener donations par email (attrape les dons sans userId)
        const userEmail = user.email?.toLowerCase();
        if (userEmail) {
          const unsubDonationsByEmail = firestore()
            .collection('donations')
            .where('donateurEmail', '==', userEmail)
            .onSnapshot(
              snapshot => {
                donationsByEmailRef.current = snapshot.docs.map(doc => ({
                  ...doc.data(),
                  id: doc.id,
                  _type: 'donation',
                }));
                mergeAndSetHistory();
              },
              error => {
                if (__DEV__)
                  console.error('Error loading donations by email:', error);
                donationsByEmailRef.current = [];
                mergeAndSetHistory();
              },
            );
          donationByEmailUnsubscribeRef.current = unsubDonationsByEmail;
        }

        // S'abonner aux notifications et sauvegarder le token
        await subscribeToMembersTopic();
        await saveFCMTokenToFirestore(user.uid);
      } else {
        // Listeners déjà nettoyés en haut du callback (lignes 163-174)
        paymentsRef.current = [];
        donationsRef.current = [];
        donationsByEmailRef.current = [];
        paymentSucceededRef.current = false;
        isProcessingRef.current = false;
        setIsLoggedIn(false);
        setMemberProfile(null);
        setIsPaid(false);
        setIsExpired(false);
        setInscribedMembers([]);
        setPaymentHistory([]);
        setAvailableYears([new Date().getFullYear()]);
        setHistoryYear(new Date().getFullYear());
        setMemberPage('sympathisant');
        setContextMessage(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (memberProfileUnsubscribeRef.current) {
        memberProfileUnsubscribeRef.current();
      }
      if (paymentHistoryUnsubscribeRef.current) {
        paymentHistoryUnsubscribeRef.current();
      }
      if (donationHistoryUnsubscribeRef.current) {
        donationHistoryUnsubscribeRef.current();
      }
      if (donationByEmailUnsubscribeRef.current) {
        donationByEmailUnsubscribeRef.current();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Runs once on mount, cleanup handled internally
  }, []);

  useEffect(() => {
    const unsubPrices = subscribeToCotisationPrices(prices =>
      setFormulePrices(prices),
    );
    return () => {
      unsubPrices?.();
    };
  }, []);

  useEffect(() => {
    getMosqueeInfo().then(setMosqueeInfo);
  }, []);

  // Vérifier disponibilité Apple Pay au mount
  useEffect(() => {
    if (Platform.OS === 'ios') {
      isPlatformPaySupported()
        .then(supported => {
          setIsApplePayAvailable(supported);
        })
        .catch(() => setIsApplePayAvailable(false));
    }
  }, []);

  // Charger le règlement
  useEffect(() => {
    const unsubscribe = subscribeToReglement(setReglement);
    return () => unsubscribe();
  }, []);

  // Vérifier si c'est la première visite pour afficher le message de bienvenue
  useEffect(() => {
    const checkFirstVisit = async () => {
      try {
        const hasVisited = await AsyncStorage.getItem('memberScreenVisited');
        if (!hasVisited && !isLoggedIn) {
          setShowWelcomeModal(true);
          await AsyncStorage.setItem('memberScreenVisited', 'true');
        }
      } catch (error) {
        if (__DEV__) console.log('Error checking first visit:', error);
      }
    };
    if (!isLoading) {
      checkFirstVisit();
    }
  }, [isLoading, isLoggedIn]);

  // ============================================================
  // DATA LOADING
  // ============================================================

  const loadMemberData = async (uid: string, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 500; // ms

    try {
      const profile = await AuthService.getMemberProfile(uid);
      if (profile) {
        setMemberProfile(profile);
        setIsPaid(AuthService.isCotisationActive(profile));
        await subscribeToMembersTopic();
        await saveFCMTokenToFirestore(uid);

        // Récupérer les membres inscrits
        const inscribed = await getMembersInscribedBy(uid);
        setInscribedMembers(inscribed);

        // L'historique est chargé en temps réel via onSnapshot dans l'effet auth principal
      } else if (retryCount < MAX_RETRIES) {
        // Race condition: le document Firestore n'est peut-être pas encore créé
        // Attendre et réessayer
        await new Promise<void>(resolve =>
          setTimeout(() => resolve(), RETRY_DELAY),
        );
        return loadMemberData(uid, retryCount + 1);
      }
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        await new Promise<void>(resolve =>
          setTimeout(() => resolve(), RETRY_DELAY),
        );
        return loadMemberData(uid, retryCount + 1);
      }
      if (__DEV__) console.error('Error loading member data:', error);
    }
  };

  // ============================================================
  // AUTH HANDLERS
  // ============================================================

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      Alert.alert(t('commonError'), t('fillAllFields'));
      return;
    }

    setAuthLoading(true);
    try {
      const result = await AuthService.signIn(loginEmail.trim(), loginPassword);
      if (result.success) {
        setShowLoginModal(false);
        resetLoginForm();
      } else {
        Alert.alert(t('commonError'), result.error || t('networkError'));
      }
    } catch (error) {
      const err = error as Error;
      Alert.alert(t('commonError'), err?.message || t('networkError'));
    } finally {
      setAuthLoading(false);
    }
  };

  // Fonction pour vérifier si la personne est majeure
  const isAdult = (dateNaissance: string): boolean => {
    const parts = dateNaissance.split('/');
    if (parts.length !== 3) return false;
    const birthDate = new Date(
      parseInt(parts[2], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[0], 10),
    );
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age >= 16;
  };

  // Auto-formatter la date de naissance (JJ/MM/AAAA)
  const formatDateInput = (text: string): string => {
    // Garde uniquement les chiffres
    const numbers = text.replace(/[^0-9]/g, '');
    // Limite à 8 chiffres (JJMMAAAA)
    const limited = numbers.slice(0, 8);
    // Formate avec les "/"
    if (limited.length <= 2) return limited;
    if (limited.length <= 4)
      return `${limited.slice(0, 2)}/${limited.slice(2)}`;
    return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`;
  };

  const handleRegister = async () => {
    // Regex de validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^0[1-9][0-9]{8}$/;

    // 1. Validation champs vides
    if (
      !registerNom.trim() ||
      !registerPrenom.trim() ||
      !registerTelephone.trim() ||
      !registerAdresse.trim() ||
      !loginEmail.trim() ||
      !loginPassword.trim()
    ) {
      Alert.alert(t('commonError'), t('fillAllFields'));
      return;
    }

    // 2. Validation format email (B3)
    if (!emailRegex.test(loginEmail.trim())) {
      Alert.alert(t('commonError'), t('invalidEmail'));
      return;
    }

    // 2b. Validation qualité email (typos, domaines bidon)
    const emailError = validateEmailQuality(loginEmail.trim());
    if (emailError) {
      Alert.alert(t('commonError'), emailError);
      return;
    }

    // 3. Validation format téléphone français (B4)
    const cleanPhone = registerTelephone.replace(/\s/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert(t('commonError'), t('phoneRequired'));
      return;
    }

    if (!registerGenre) {
      Alert.alert(t('commonError'), t('selectGender'));
      return;
    }

    if (!registerDateNaissance.trim()) {
      Alert.alert(t('commonError'), t('enterBirthdate'));
      return;
    }

    // 4. Validation âge minimum 16 ans (B6)
    if (!isAdult(registerDateNaissance)) {
      Alert.alert(t('commonError'), t('membershipImpossible'));
      return;
    }

    if (loginPassword.length < 6) {
      Alert.alert(t('commonError'), t('passwordMinLength'));
      return;
    }

    // 5. Validation règlement accepté (B5 - CRITIQUE)
    if (!acceptedRules) {
      Alert.alert(t('commonError'), t('mustAcceptRulesMsg'));
      return;
    }

    setAuthLoading(true);
    isRegistrationInProgress.current = true; // Bloque le changement de vue pendant l'inscription

    try {
      const result = await AuthService.signUp(
        loginEmail.trim(),
        loginPassword,
        `${registerPrenom.trim()} ${registerNom.trim()}`,
        registerTelephone.trim(),
        registerAdresse.trim(),
        registerGenre,
        registerDateNaissance,
      );

      isRegistrationInProgress.current = false; // Réactive le listener auth

      if (result.success && result.user) {
        // Inscription réussie - mettre à jour l'état manuellement
        setIsLoggedIn(true);
        setShowLoginModal(false);
        resetLoginForm();

        // Charger le profil membre
        loadMemberData(result.user.uid);

        // Bug 19 Fix: Popup bienvenue + vérification email
        if (!result.user.emailVerified) {
          Alert.alert(t('thanksForRegistration'), t('verificationEmailSent'), [
            { text: t('commonOk'), style: 'default' },
            {
              text: t('commonRetry'),
              onPress: () => result.user?.sendEmailVerification(),
            },
          ]);
        } else {
          Alert.alert(t('thanksForRegistration'), t('emailSent'), [
            { text: t('commonOk'), style: 'default' },
          ]);
        }
      } else if (!result.success) {
        Alert.alert(t('commonError'), result.error || t('networkError'));
      }
    } catch (error) {
      isRegistrationInProgress.current = false; // Réactive le listener auth même en cas d'erreur
      const err = error as Error;
      Alert.alert(t('commonError'), err?.message || t('networkError'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert(t('commonError'), t('invalidEmail'));
      return;
    }

    setAuthLoading(true);
    try {
      const result = await AuthService.resetPassword(forgotEmail.trim());
      if (result.success) {
        Alert.alert(t('emailSent'), t('verificationEmailSent'));
        setShowForgotPassword(false);
        setForgotEmail('');
      } else {
        Alert.alert(t('commonError'), result.error || t('networkError'));
      }
    } catch (error) {
      const err = error as Error;
      Alert.alert(t('commonError'), err?.message || t('networkError'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(t('logout'), t('logoutConfirm'), [
      { text: t('commonCancel'), style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: async () => {
          // Supprimer le token FCM avant déconnexion
          const uid = AuthService.getCurrentUser()?.uid;
          if (uid) {
            await removeFCMTokenFromFirestore(uid).catch(() => {});
          }
          await AuthService.signOut();
        },
      },
    ]);
  };

  // Demander l'envoi du reçu fiscal
  const handleRequestRecuFiscal = async (yearParam?: number) => {
    const year = yearParam ?? selectedRecuYear;
    if (!memberProfile?.email) {
      Alert.alert(t('commonError'), t('invalidEmail'));
      return;
    }

    setSendingRecuFiscal(true);
    try {
      const result = await requestRecuFiscal(memberProfile.email, year);
      if (result.success) {
        Alert.alert(
          t('emailSent'),
          language === 'ar'
            ? `تم إرسال إيصالك الضريبي بمبلغ ${result.montantTotal?.toFixed(
                2,
              )}€ إلى ${memberProfile.email}`
            : `Votre reçu fiscal de ${result.montantTotal?.toFixed(
                2,
              )}€ a été envoyé à ${memberProfile.email}`,
        );
      } else {
        Alert.alert(t('commonError'), result.message);
      }
    } catch (error) {
      const err = error as Error;
      Alert.alert(t('commonError'), err?.message || t('networkError'));
    } finally {
      setSendingRecuFiscal(false);
    }
  };

  const resetLoginForm = () => {
    setLoginEmail('');
    setLoginPassword('');
    setRegisterNom('');
    setRegisterPrenom('');
    setRegisterTelephone('');
    setRegisterAdresse('');
    setRegisterGenre('');
    setRegisterDateNaissance('');
    setAcceptedRules(false);
    setIsRegistering(false);
  };

  // ============================================================
  // PAYMENT HANDLERS
  // ============================================================

  const handlePayment = async (method: 'card' | 'apple' | 'virement') => {
    // Bloquer si email non vérifié (reload pour obtenir le statut à jour)
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
      try {
        await currentUser.reload();
      } catch {
        // Ignore reload error (offline, etc.)
      }
    }
    if (currentUser && !currentUser.emailVerified) {
      Alert.alert(
        language === 'ar'
          ? '📧 تحقق من بريدك الإلكتروني'
          : '📧 Vérifiez votre email',
        language === 'ar'
          ? 'يجب عليك تأكيد بريدك الإلكتروني قبل الاشتراك. تحقق من صندوق الوارد الخاص بك.'
          : 'Vous devez vérifier votre adresse email avant de souscrire une adhésion. Consultez votre boîte de réception.',
        [
          { text: t('commonOk'), style: 'cancel' },
          {
            text: language === 'ar' ? 'إعادة إرسال' : "Renvoyer l'email",
            onPress: async () => {
              try {
                await currentUser.sendEmailVerification();
                Alert.alert('✅', t('verificationEmailSent'));
              } catch {
                Alert.alert(
                  t('commonError'),
                  language === 'ar'
                    ? 'خطأ في إرسال البريد'
                    : "Erreur lors de l'envoi",
                );
              }
            },
          },
        ],
      );
      return;
    }

    console.log(
      '[Member] handlePayment appelé, method:',
      method,
      'processing:',
      isProcessingPayment,
      'ref:',
      isProcessingRef.current,
      'profile:',
      !!memberProfile,
    );
    if (paymentSucceededRef.current) {
      console.log('[Member] Paiement déjà réussi dans cette session, bloqué');
      return;
    }
    if (isProcessingRef.current || isProcessingPayment || !memberProfile) {
      console.log(
        '[Member] Bloqué - processing:',
        isProcessingRef.current,
        isProcessingPayment,
        'profile:',
        !!memberProfile,
      );
      return;
    }
    isProcessingRef.current = true; // BUG 7 FIX: Verrou synchrone immédiat

    const totalAmount = getCurrentAmount();
    const breakdown = getPaymentBreakdown(selectedFormule, totalAmount);

    if (method === 'virement') {
      const reference = `ADH-${new Date().getFullYear()}-${Math.random()
        .toString(36)
        .substr(2, 6)
        .toUpperCase()}`;

      // Mettre à jour le membre avec status 'en_attente_paiement' pour que le backoffice le voie
      try {
        // BUG FIX: status/statut sont des champs protégés (affectedKeys dans Firestore rules)
        // L'app ne doit JAMAIS écrire status — seul admin/CF peut le modifier
        // referenceVirement suffit comme signal pour le backoffice
        await AuthService.updateMemberProfile(memberProfile.uid, {
          referenceVirement: reference,
          formule: selectedFormule,
          montantAttendu: breakdown.total,
        } as any);
        logger.log(
          '[Virement] Membre mis à jour avec status en_attente_paiement',
        );
      } catch (updateError) {
        logger.error('[Virement] Erreur mise à jour membre:', updateError);
        // Continuer quand même pour afficher l'alerte
      }

      let message = `IBAN: ${mosqueeInfo?.iban || 'IBAN indisponible'}\nBIC: ${
        mosqueeInfo?.bic || 'BIC indisponible'
      }\n\nCotisation: ${breakdown.cotisation}€`;
      if (breakdown.don > 0) {
        message += `\nDon: ${breakdown.don}€`;
      }
      message += `\nTotal: ${breakdown.total}€\n\nRéférence: ${reference}\n\nImportant: Indiquez la référence dans le motif du virement.`;
      Alert.alert(t('bankTransferTitle'), message, [
        { text: t('commonUnderstood'), style: 'default' },
      ]);
      setShowPaymentModal(false);
      setCustomAmount('');

      // Recharger les données pour refléter le changement de status
      const user = AuthService.getCurrentUser();
      if (user) await loadMemberData(user.uid);
      isProcessingRef.current = false; // BUG 7 FIX: Reset verrou sur virement
      return;
    }

    setIsProcessingPayment(true);
    logBreadcrumb('Demarrage paiement cotisation');
    trackEvent(Events.PAYMENT_STARTED, { type: selectedFormule });
    const paymentTrace = await startTrace('payment_flow');
    try {
      // IMPORTANT: Utiliser makeSubscription pour les cotisations mensuelles (paiement récurrent)
      // et makePayment pour les cotisations annuelles (paiement unique)
      // Apple Pay → flux natif direct / CB → PaymentSheet CB uniquement
      const isMensuel = selectedFormule === 'mensuel';
      const isApplePay = method === 'apple';

      let paymentResult: any;
      let subscriptionId: string | undefined;

      const paymentDescription =
        breakdown.don > 0
          ? `Cotisation ${selectedFormule} (${breakdown.cotisation}€) + Don (${breakdown.don}€) - El Mohsinine`
          : `Cotisation ${selectedFormule} - El Mohsinine`;

      const paymentMeta = {
        memberId: memberProfile.uid,
        memberIdDisplay: memberProfile.memberId || '',
        memberName: memberProfile.name,
        email: memberProfile.email,
        period: selectedFormule,
        montantCotisation: breakdown.cotisation,
        montantDon: breakdown.don,
      };

      if (isMensuel) {
        // Abonnement récurrent mensuel via Stripe Subscriptions
        const subscriptionFn = isApplePay
          ? makeApplePaySubscription
          : makeSubscription;
        const subscriptionResult = await subscriptionFn({
          amount: breakdown.total,
          description: paymentDescription,
          type: 'cotisation',
          metadata: paymentMeta,
        });

        paymentResult = subscriptionResult;
        subscriptionId = subscriptionResult.subscriptionId;
      } else {
        // Paiement unique annuel
        const paymentFn = isApplePay ? makeApplePayPayment : makePayment;
        paymentResult = await paymentFn({
          amount: breakdown.total,
          description: paymentDescription,
          type: 'cotisation',
          metadata: paymentMeta,
        });
      }

      // S10: Sauvegarder paymentIntentId pour récupération 3DS interrompu
      if (paymentResult.paymentIntentId) {
        await AsyncStorage.setItem('pendingPaymentIntentId', paymentResult.paymentIntentId);
      }

      if (paymentResult.success && paymentResult.paymentIntentId) {
        // S10: Nettoyer le paiement pending
        await AsyncStorage.removeItem('pendingPaymentIntentId');
        // BUG A FIX: NE PAS écrire dans payments/ ni members/ côté client
        // Le webhook Stripe (admin SDK) gère tout :
        // 1. Crée payments/{paymentIntentId} (avec montant cotisation + don si applicable)
        // 2. Met à jour le membre (status: 'en_attente_validation')
        // 3. Envoie l'email de confirmation
        // Les Firestore rules bloquent les champs critiques pour les non-admins

        // BUG D FIX: Marquer le paiement comme réussi pour empêcher les doublons
        paymentSucceededRef.current = true;
        await paymentTrace.stop();
        trackEvent(Events.PAYMENT_SUCCESS, {
          type: selectedFormule,
          amount: String(breakdown.total),
        });

        setShowPaymentModal(false);
        setCustomAmount('');

        // S6: UI optimiste + onSnapshot pour confirmer le traitement webhook
        Alert.alert(
          t('congratulations'),
          'Paiement reçu ! Traitement en cours...',
          [{ text: t('commonOk'), style: 'default' }],
        );

        setMemberPage('membre_actif');
        setContextMessage(null);
        setIsPaid(true);
        setIsExpired(false);

        // Écouter le changement de statut Firestore (webhook Stripe)
        const currentUid = AuthService.getCurrentUser()?.uid;
        if (currentUid) {
          const memberDocRef = firestore().collection('members').doc(currentUid);
          let unsubSnapshot: (() => void) | null = null;
          const timeoutId = setTimeout(() => {
            unsubSnapshot?.();
          }, 30000);
          unsubSnapshot = memberDocRef.onSnapshot(
            (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (data?.status === 'en_attente_validation' || data?.status === 'actif') {
                  clearTimeout(timeoutId);
                  unsubSnapshot?.();
                }
              }
            },
            (err) => {
              console.log('onSnapshot error (non-bloquant):', err.message);
              clearTimeout(timeoutId);
            },
          );
        }
      } else if (
        paymentResult.error &&
        paymentResult.error !== 'Paiement annulé'
      ) {
        // S10: Nettoyer si erreur explicite
        await AsyncStorage.removeItem('pendingPaymentIntentId');
        showPaymentError(paymentResult.error);
      }
    } catch (error) {
      const err = error as Error;
      await paymentTrace.stop();
      logError(err, { screen: 'MemberScreen', action: 'payment' });
      trackEvent(Events.PAYMENT_FAILED, {
        reason: (err?.message || 'unknown').substring(0, 50),
      });
      showPaymentError(err?.message || 'Une erreur est survenue');
    } finally {
      setIsProcessingPayment(false);
      isProcessingRef.current = false; // BUG 7 FIX: Reset verrou
    }
  };

  // ============================================================
  // S10: Vérifier paiement interrompu au chargement
  // ============================================================
  const checkPendingPayment = async () => {
    try {
      const pendingId = await AsyncStorage.getItem('pendingPaymentIntentId');
      if (!pendingId) return;

      const checkPending = firebase.app().functions('europe-west1').httpsCallable('checkPendingPayment');
      const result = await checkPending({ paymentIntentId: pendingId });
      const status = (result.data as any)?.status;

      if (status === 'succeeded' || status === 'already_processed') {
        await AsyncStorage.removeItem('pendingPaymentIntentId');
      } else if (status === 'expired') {
        await AsyncStorage.removeItem('pendingPaymentIntentId');
        Alert.alert('Paiement expiré', 'Votre paiement précédent a expiré. Veuillez réessayer.');
      } else if (status === 'pending') {
        Alert.alert(
          'Paiement en attente',
          'Un paiement nécessite une action de votre part (vérification 3D Secure).',
          [
            { text: 'Ignorer', style: 'cancel', onPress: () => AsyncStorage.removeItem('pendingPaymentIntentId') },
            { text: 'Réessayer', onPress: () => AsyncStorage.removeItem('pendingPaymentIntentId') },
          ],
        );
      }
    } catch (err) {
      console.log('checkPendingPayment non-bloquant:', (err as Error).message);
    }
  };

  // ============================================================
  // FAMILY HANDLERS
  // ============================================================

  const addFamilyMember = () => {
    setFamilyMembers([
      ...familyMembers,
      {
        id: Date.now().toString(),
        nom: '',
        prenom: '',
        telephone: '',
        adresse: '',
        genre: '',
        dateNaissance: '',
        accepte: false,
      },
    ]);
  };

  const removeFamilyMember = (id: string) => {
    setFamilyMembers(familyMembers.filter(m => m.id !== id));
  };

  const updateFamilyMember = (id: string, field: string, value: any) => {
    setFamilyMembers(
      familyMembers.map(m => (m.id === id ? { ...m, [field]: value } : m)),
    );
  };

  const handlePayFamily = async (method: 'card' | 'apple' | 'virement') => {
    if (paymentSucceededRef.current) {
      console.log(
        '[Member] Paiement famille déjà réussi dans cette session, bloqué',
      );
      return;
    }
    if (
      isProcessingRef.current ||
      isProcessingPayment ||
      !memberProfile ||
      familyMembers.length === 0
    )
      return;
    isProcessingRef.current = true; // BUG 7 FIX: Verrou synchrone immédiat

    // Validation
    for (const member of familyMembers) {
      if (
        !member.nom.trim() ||
        !member.prenom.trim() ||
        !member.telephone.trim() ||
        !member.adresse.trim()
      ) {
        Alert.alert(t('commonError'), t('fillAllFields'));
        isProcessingRef.current = false;
        return;
      }
      if (!member.genre) {
        Alert.alert(t('commonError'), t('selectGender'));
        isProcessingRef.current = false;
        return;
      }
      if (!member.dateNaissance.trim()) {
        Alert.alert(t('commonError'), t('enterBirthdate'));
        isProcessingRef.current = false;
        return;
      }
      if (!isAdult(member.dateNaissance)) {
        Alert.alert(t('membershipImpossible'), t('membershipImpossible'));
        isProcessingRef.current = false;
        return;
      }
      if (!member.accepte) {
        Alert.alert(t('commonError'), t('mustAcceptRulesMsg'));
        isProcessingRef.current = false;
        return;
      }
    }

    const totalAmount = familyMembers.length * formulePrices[familyFormule];
    const paiementId = `PAY-${Date.now()}`;

    if (method === 'virement') {
      const reference = `FAM-${new Date().getFullYear()}-${Math.random()
        .toString(36)
        .substr(2, 6)
        .toUpperCase()}`;

      // Créer les membres en attente
      const nameParts = memberProfile.name.split(' ');
      const payeurPrenom = nameParts[0] || '';
      const payeurNom = nameParts.slice(1).join(' ') || memberProfile.name;

      for (const member of familyMembers) {
        await createMember({
          email: '',
          nom: member.nom,
          prenom: member.prenom,
          telephone: member.telephone,
          adresse: member.adresse,
          genre: member.genre,
          dateNaissance: member.dateNaissance,
          accepteReglement: true,
          inscritPar: {
            odUserId: memberProfile.uid,
            nom: payeurNom,
            prenom: payeurPrenom,
          },
          status: 'en_attente_paiement',
          referenceVirement: reference,
          formule: familyFormule,
          montant: formulePrices[familyFormule],
        });
      }

      Alert.alert(
        t('bankTransferTitle'),
        `Montant total: ${totalAmount}€ (${familyMembers.length} membre${
          familyMembers.length > 1 ? 's' : ''
        } - ${familyFormule})\n\nIBAN: ${
          mosqueeInfo?.iban || 'IBAN indisponible'
        }\nRéférence: ${reference}`,
        [{ text: t('commonUnderstood') }],
      );

      setShowFamilyModal(false);
      setFamilyMembers([]);

      const user = AuthService.getCurrentUser();
      if (user) await loadMemberData(user.uid);
      isProcessingRef.current = false; // BUG 7 FIX: Reset verrou sur virement famille
      return;
    }

    setIsProcessingPayment(true);
    try {
      const familyPayFn =
        method === 'apple' ? makeApplePayPayment : makePayment;
      const paymentResult = await familyPayFn({
        amount: totalAmount,
        description: `Cotisation famille ${familyFormule} (${familyMembers.length}) - El Mohsinine`,
        type: 'cotisation',
        metadata: {
          memberId: memberProfile.uid, // UID Firebase (doc ID) - PAS le format ELM-XXXX
          memberIdDisplay: memberProfile.memberId || '', // Format ELM-XXXX pour affichage uniquement
          memberName: memberProfile.name,
          email: memberProfile.email, // Email pour sendRecuFiscal
          period: familyFormule,
          membersCount: familyMembers.length.toString(),
          montantCotisation: totalAmount,
          montantDon: 0,
        },
      });

      if (paymentResult.success && paymentResult.paymentIntentId) {
        // BUG D FIX: Marquer le paiement comme réussi pour empêcher les doublons
        paymentSucceededRef.current = true;

        const timestamp = new Date();
        // FIX B3: Pour les membres famille, pas de dateFin existante à prolonger
        // (ce sont de nouveaux membres), donc on utilise now comme base
        const getDateFin = () => {
          const d = new Date();
          if (familyFormule === 'mensuel') d.setMonth(d.getMonth() + 1);
          else d.setFullYear(d.getFullYear() + 1);
          return d;
        };

        const nameParts2 = memberProfile.name.split(' ');
        const payeurPrenom2 = nameParts2[0] || '';
        const payeurNom2 = nameParts2.slice(1).join(' ') || memberProfile.name;

        for (const member of familyMembers) {
          // BUG FIX: 'en_attente_validation' n'est PAS dans la liste autorisée du allow create
          // Firestore rules autorisent: en_attente_paiement, en_attente_signature, pending, sympathisant
          // Le webhook payment_intent.succeeded mettra 'en_attente_validation' via admin SDK
          await createMember({
            email: '',
            nom: member.nom,
            prenom: member.prenom,
            telephone: member.telephone,
            adresse: member.adresse,
            genre: member.genre,
            dateNaissance: member.dateNaissance,
            accepteReglement: true,
            inscritPar: {
              odUserId: memberProfile.uid,
              nom: payeurNom2,
              prenom: payeurPrenom2,
            },
            status: 'en_attente_paiement',
            dateInscription: timestamp,
            datePaiement: timestamp,
            paiementId,
            montant: formulePrices[familyFormule],
            modePaiement: method === 'apple' ? 'Apple Pay' : 'CB',
            formule: familyFormule,
            cotisation: {
              type: familyFormule,
              montant: formulePrices[familyFormule],
              dateDebut: timestamp,
              dateFin: getDateFin(),
            },
          });
        }

        showPaymentSuccess('cotisation');
        setShowFamilyModal(false);
        setFamilyMembers([]);

        const user = AuthService.getCurrentUser();
        if (user) await loadMemberData(user.uid);
      } else if (
        paymentResult.error &&
        paymentResult.error !== 'Paiement annulé'
      ) {
        showPaymentError(paymentResult.error);
      }
    } catch (error) {
      const err = error as Error;
      logError(err, { screen: 'MemberScreen', action: 'family_payment' });
      trackEvent(Events.PAYMENT_FAILED, {
        reason: (err?.message || 'unknown').substring(0, 50),
      });
      showPaymentError(err?.message || 'Une erreur est survenue');
    } finally {
      setIsProcessingPayment(false);
      isProcessingRef.current = false; // BUG 7 FIX: Reset verrou
    }
  };

  // ============================================================
  // RENDER: LOADING
  // ============================================================

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  // ============================================================
  // RENDER: NOT LOGGED IN
  // ============================================================

  if (!isLoggedIn) {
    return (
      <BackgroundPattern>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(100, insets.bottom) },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🕌</Text>
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t('memberArea')}
            </Text>
          </View>

          {/* Card connexion */}
          <View style={styles.card}>
            <Text style={styles.cardIcon}>👤</Text>
            <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
              {t('connectYourself')}
            </Text>
            <Text style={[styles.cardSubtitle, isRTL && styles.rtlText]}>
              {t('accessMemberArea')}
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setIsRegistering(false);
                setShowLoginModal(true);
              }}
            >
              <Text style={styles.primaryButtonText}>{t('login')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setIsRegistering(true);
                setShowLoginModal(true);
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {t('createAccount')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Modal Login */}
        {renderLoginModal()}

        {/* Modal Bienvenue */}
        <Modal visible={showWelcomeModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.welcomeModalContent}>
              <Text style={styles.welcomeEmoji}>🕌</Text>
              <Text style={[styles.welcomeTitle, isRTL && styles.rtlText]}>
                Bienvenue à la mosquée El Mohsinine !
              </Text>
              <Text style={[styles.welcomeText, isRTL && styles.rtlText]}>
                Rejoignez notre communauté en devenant membre de l'association.
                En tant que membre, vous bénéficiez de nombreux avantages :
              </Text>
              <View style={styles.welcomeBenefits}>
                <Text style={styles.welcomeBenefit}>
                  ✅ Reçu fiscal pour vos dons (déduction d'impôts)
                </Text>
                <Text style={styles.welcomeBenefit}>
                  ✅ Droit de vote aux assemblées générales
                </Text>
                <Text style={styles.welcomeBenefit}>
                  ✅ Participation aux décisions de la mosquée
                </Text>
                <Text style={styles.welcomeBenefit}>
                  ✅ Accès aux événements réservés aux membres
                </Text>
              </View>
              <TouchableOpacity
                style={styles.welcomeButton}
                onPress={() => {
                  setShowWelcomeModal(false);
                  setIsRegistering(true);
                  setShowLoginModal(true);
                }}
              >
                <Text style={styles.welcomeButtonText}>Devenir membre</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.welcomeLaterButton}
                onPress={() => setShowWelcomeModal(false)}
              >
                <Text style={styles.welcomeLaterText}>Plus tard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </BackgroundPattern>
    );
  }

  // ============================================================
  // RENDER: LOGGED IN - NO SUBSCRIPTION
  // ============================================================

  // Vérifier si le membre est sympathisant
  const isSympathisant =
    memberProfile &&
    ((memberProfile as any).cotisationStatus === 'sympathisant' ||
      (memberProfile as any).status === 'sympathisant' ||
      (memberProfile.cotisationStatus === 'aucun' &&
        !memberProfile.cotisationExpiry));

  // Vérifier si le membre attend la validation du bureau
  const isAwaitingValidation =
    memberProfile &&
    ((memberProfile as any).cotisationStatus === 'en_attente_validation' ||
      (memberProfile as any).status === 'en_attente_validation');

  // Préparation des cartes de membre (utilisateur + inscrits)
  const getPaymentStatus = (
    profile: MemberProfile | InscribedMember,
  ): 'paid' | 'pending' | 'virement_pending' | 'unpaid' => {
    // Pour MemberProfile
    if ('cotisationStatus' in profile) {
      const status = profile.cotisationStatus as string;
      if (status === 'actif') return 'paid';
      if (status === 'en_attente_paiement') return 'pending';
      if (status === 'en_attente_validation') return 'pending';
      if (status === 'en_attente_signature') return 'pending';
      return 'unpaid';
    }
    // Pour InscribedMember
    if (profile.status === 'actif') return 'paid';
    if (profile.status === 'en_attente_paiement') return 'pending';
    if (profile.status === 'en_attente_validation') return 'pending';
    if (profile.status === 'en_attente_signature') return 'pending';
    if (profile.datePaiement) return 'paid';
    return 'unpaid';
  };

  const memberForCard = memberProfile
    ? {
        name: memberProfile.name,
        memberId: memberProfile.memberId,
        membershipExpirationDate: memberProfile.cotisationExpiry,
        status: memberProfile.cotisationStatus || 'aucun',
        paymentStatus: getPaymentStatus(memberProfile),
        subscriptionType: memberProfile.cotisationType || undefined,
      }
    : null;

  // Tous les membres pour le swipe (utilisateur + inscrits)
  const allMembersForCard = [
    ...(memberForCard ? [memberForCard] : []),
    ...inscribedMembers.map(m => ({
      name: `${m.prenom} ${m.nom}`,
      memberId: m.id,
      membershipExpirationDate: m.dateFin,
      status: m.status,
      paymentStatus: getPaymentStatus(m),
      subscriptionType: m.formule || undefined,
    })),
  ];

  // ============================================================
  // RENDER: 3 PAGES MEMBRE
  // ============================================================

  return (
    <BackgroundPattern>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(100, insets.bottom) },
        ]}
      >
        {/* Header avec nom */}
        <View style={styles.header}>
          <Text style={[styles.greeting, isRTL && styles.rtlText]}>
            {isRTL
              ? `${memberProfile?.name?.split(' ')[0] || ''} 👋 مرحبا`
              : `Bonjour, ${memberProfile?.name?.split(' ')[0] || ''} 👋`}
          </Text>
        </View>

        {/* ============================================ */}
        {/* PAGE 1 : MEMBRE SYMPATHISANT                */}
        {/* ============================================ */}
        {memberPage === 'sympathisant' && (
          <>
            {/* Titre page */}
            <View style={styles.pageTitleContainer}>
              <Text style={styles.pageTitle}>MEMBRE SYMPATHISANT</Text>
            </View>

            <View style={styles.card}>
              <Text
                style={[
                  styles.cardSubtitle,
                  isRTL && styles.rtlText,
                  { fontSize: 16, lineHeight: 24 },
                ]}
              >
                Bienvenue {memberProfile?.name?.split(' ')[0] || ''},{'\n\n'}Te
                voilà membre sympathisant, tu as accès à toutes les
                fonctionnalités de l'application, tu seras informé des
                événements de la mosquée.
                {'\n\n'}Si tu veux aller plus loin et devenir membre actif
                (adhérent de l'association Centre Culturel Islamique de
                Bourg-en-Bresse) clique ici :
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 24 }]}
                onPress={() => setMemberPage('devenir_adherent')}
              >
                <Text style={styles.primaryButtonText}>
                  Devenir membre actif
                </Text>
              </TouchableOpacity>
            </View>

            {/* Déconnexion */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>{t('logout')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ============================================ */}
        {/* PAGE 2 : DEVENIR ADHÉRENT (paiement)        */}
        {/* ============================================ */}
        {memberPage === 'devenir_adherent' && (
          <>
            {/* Titre page */}
            <View style={styles.pageTitleContainer}>
              <Text style={styles.pageTitle}>ESPACE ADHÉRENT</Text>
              <Text style={[styles.pageSubtitle]}>
                Pour devenir membre actif
              </Text>
            </View>

            {/* Message contextuel (expiration ou annulation) */}
            {contextMessage && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cardSubtitle,
                    { color: '#ef4444', fontWeight: '600' },
                  ]}
                >
                  {contextMessage}
                </Text>
              </View>
            )}

            {/* En attente de validation */}
            {isAwaitingValidation && (
              <View style={styles.card}>
                <Text style={styles.cardIcon}>⏳</Text>
                <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
                  Adhésion en cours de validation
                </Text>
                <Text style={[styles.cardSubtitle, isRTL && styles.rtlText]}>
                  Votre paiement a été reçu. Le bureau va valider votre adhésion
                  prochainement.
                </Text>
              </View>
            )}

            {/* Section Avantages */}
            <View style={styles.card}>
              <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
                Avantages d'être adhérent :
              </Text>
              <View style={styles.sympathisantBenefits}>
                <View style={styles.advantageRow}>
                  <Text style={styles.advantageIcon}>✨</Text>
                  <Text style={styles.benefitItem}>
                    Tu deviens un soutien fort de ta mosquée et tu gagnes des
                    hassanates
                  </Text>
                </View>
                <View style={styles.advantageRow}>
                  <Text style={styles.advantageIcon}>🗳️</Text>
                  <Text style={styles.benefitItem}>
                    Tu as le droit de vote à chaque assemblée générale/élection
                  </Text>
                </View>
                <View style={styles.advantageRow}>
                  <Text style={styles.advantageIcon}>🎫</Text>
                  <Text style={styles.benefitItem}>
                    Tu as le droit à la carte membre
                  </Text>
                </View>
              </View>
            </View>

            {/* Section Paiement */}
            {!isAwaitingValidation && (
              <View style={styles.card}>
                <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
                  Activer ma cotisation
                </Text>
                <Text style={[styles.cardSubtitle, isRTL && styles.rtlText]}>
                  Choisissez votre formule d'adhésion
                </Text>

                {/* Formules */}
                <View style={styles.formulesContainer}>
                  <TouchableOpacity
                    style={[
                      styles.formuleOption,
                      selectedFormule === 'mensuel' && styles.formuleSelected,
                    ]}
                    onPress={() => setSelectedFormule('mensuel')}
                  >
                    <Text
                      style={[
                        styles.formuleLabel,
                        selectedFormule === 'mensuel' &&
                          styles.formuleLabelSelected,
                      ]}
                    >
                      Mensuel
                    </Text>
                    <Text
                      style={[
                        styles.formulePrice,
                        selectedFormule === 'mensuel' &&
                          styles.formulePriceSelected,
                      ]}
                    >
                      {formulePrices.mensuel}€/mois
                    </Text>
                    <Text
                      style={[
                        styles.formuleDesc,
                        selectedFormule === 'mensuel' &&
                          styles.formuleDescSelected,
                      ]}
                    >
                      Paiement récurrent
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.formuleOption,
                      selectedFormule === 'annuel' && styles.formuleSelected,
                    ]}
                    onPress={() => setSelectedFormule('annuel')}
                  >
                    <Text
                      style={[
                        styles.formuleLabel,
                        selectedFormule === 'annuel' &&
                          styles.formuleLabelSelected,
                      ]}
                    >
                      Annuel
                    </Text>
                    <Text
                      style={[
                        styles.formulePrice,
                        selectedFormule === 'annuel' &&
                          styles.formulePriceSelected,
                      ]}
                    >
                      {formulePrices.annuel}€/an
                    </Text>
                    <Text
                      style={[
                        styles.formuleDesc,
                        selectedFormule === 'annuel' &&
                          styles.formuleDescSelected,
                      ]}
                    >
                      Paiement unique
                    </Text>
                    {formulePrices.annuel < formulePrices.mensuel * 12 && (
                      <View style={styles.economyBadge}>
                        <Text style={styles.economyText}>
                          -
                          {Math.round(
                            (1 -
                              formulePrices.annuel /
                                (formulePrices.mensuel * 12)) *
                              100,
                          )}
                          %
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    setHasScrolledToEnd(false);
                    setAcceptedReglement(false);
                    setShowReglementModal(true);
                  }}
                >
                  <Text style={styles.primaryButtonText}>
                    Activer ma cotisation
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bouton retour si vient de PAGE 1 */}
            {isSympathisant && !isExpired && (
              <TouchableOpacity
                style={[
                  styles.logoutButton,
                  {
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.accent,
                  },
                ]}
                onPress={() => setMemberPage('sympathisant')}
              >
                <Text
                  style={[styles.logoutButtonText, { color: colors.accent }]}
                >
                  Retour
                </Text>
              </TouchableOpacity>
            )}

            {/* Déconnexion */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>{t('logout')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ============================================ */}
        {/* PAGE 3 : MEMBRE ACTIF (adhérent)            */}
        {/* ============================================ */}
        {memberPage === 'membre_actif' && (
          <>
            {/* Titre page */}
            <View style={styles.pageTitleContainer}>
              <Text style={styles.pageTitle}>MEMBRE ACTIF</Text>
            </View>

            {/* Bouton voir ma carte de membre */}
            <TouchableOpacity
              style={styles.memberCardButton}
              onPress={() => setShowCardFullScreen(true)}
            >
              <Text style={styles.memberCardButtonIcon}>🪪</Text>
              <View style={styles.memberCardButtonContent}>
                <Text
                  style={[styles.memberCardButtonText, isRTL && styles.rtlText]}
                >
                  Voir ma carte de membre
                </Text>
                <Text
                  style={[
                    styles.memberCardButtonSubtext,
                    isRTL && styles.rtlText,
                  ]}
                >
                  {inscribedMembers.length > 0
                    ? `${inscribedMembers.length + 1} cartes disponibles`
                    : 'Afficher en plein écran'}
                </Text>
              </View>
              <Text style={styles.memberCardButtonArrow}>→</Text>
            </TouchableOpacity>

            {/* Bouton inscrire des proches */}
            <TouchableOpacity
              style={styles.familyButton}
              onPress={() => setShowFamilyModal(true)}
            >
              <Text style={styles.familyButtonIcon}>👥</Text>
              <View style={styles.familyButtonContent}>
                <Text
                  style={[styles.familyButtonText, isRTL && styles.rtlText]}
                >
                  Inscrire des proches
                </Text>
                <Text
                  style={[styles.familyButtonSubtext, isRTL && styles.rtlText]}
                >
                  Famille, amis...
                </Text>
              </View>
              <Text style={styles.familyButtonArrow}>→</Text>
            </TouchableOpacity>

            {/* Bouton voir mes adhésions */}
            <TouchableOpacity
              style={styles.membershipsButton}
              onPress={() => navigation.navigate('MyMemberships')}
            >
              <Text style={styles.membershipsButtonIcon}>📋</Text>
              <View style={styles.membershipsButtonContent}>
                <Text
                  style={[
                    styles.membershipsButtonText,
                    isRTL && styles.rtlText,
                  ]}
                >
                  Voir mes adhésions
                </Text>
                <Text
                  style={[
                    styles.membershipsButtonSubtext,
                    isRTL && styles.rtlText,
                  ]}
                >
                  {inscribedMembers.length > 0
                    ? `${inscribedMembers.length + 1} membre${
                        inscribedMembers.length > 0 ? 's' : ''
                      }`
                    : 'Détails et statuts'}
                </Text>
              </View>
              <Text style={styles.membershipsButtonArrow}>→</Text>
            </TouchableOpacity>

            {/* Bouton modifier mon profil */}
            {memberProfile && (
              <TouchableOpacity
                style={styles.membershipsButton}
                onPress={() =>
                  navigation.navigate('ProfileEdit', {
                    uid: memberProfile.uid,
                    nom: memberProfile.nom || '',
                    prenom: memberProfile.prenom || '',
                    telephone: memberProfile.telephone || '',
                    adresse: memberProfile.adresse || '',
                    email: memberProfile.email || '',
                  })
                }
              >
                <Text style={styles.membershipsButtonIcon}>✏️</Text>
                <View style={styles.membershipsButtonContent}>
                  <Text
                    style={[
                      styles.membershipsButtonText,
                      isRTL && styles.rtlText,
                    ]}
                  >
                    Modifier mon profil
                  </Text>
                  <Text
                    style={[
                      styles.membershipsButtonSubtext,
                      isRTL && styles.rtlText,
                    ]}
                  >
                    Nom, téléphone, adresse
                  </Text>
                </View>
                <Text style={styles.membershipsButtonArrow}>→</Text>
              </TouchableOpacity>
            )}

            {/* Message si annulation déjà programmée */}
            {memberProfile?.subscriptionCancelPending &&
              memberProfile?.cotisationType === 'mensuel' &&
              isPaid && (
                <View
                  style={[
                    styles.card,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderColor: '#f59e0b',
                      borderWidth: 1,
                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20, marginRight: 12 }}>🔔</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: '#f59e0b', fontSize: 15 },
                      ]}
                    >
                      {language === 'ar'
                        ? 'تم جدولة الإلغاء'
                        : 'Annulation programmée'}
                    </Text>
                    <Text style={[styles.cardSubtitle, { fontSize: 12 }]}>
                      {language === 'ar'
                        ? 'ستبقى عضويتك نشطة حتى نهاية الفترة الحالية'
                        : "Votre adhésion reste active jusqu'à la fin de la période en cours"}
                    </Text>
                  </View>
                </View>
              )}

            {/* Bouton annuler abonnement mensuel (masqué si annulation déjà programmée) */}
            {memberProfile?.cotisationType === 'mensuel' &&
              isPaid &&
              !memberProfile?.subscriptionCancelPending && (
                <TouchableOpacity
                  style={[
                    styles.card,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderColor: '#ef4444',
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => {
                    Alert.alert(
                      t('cancelSubscription'),
                      t('cancelSubscriptionQuestion'),
                      [
                        {
                          text: t('commonNo'),
                          style: 'cancel',
                        },
                        {
                          text: t('commonConfirm'),
                          style: 'destructive',
                          onPress: async () => {
                            if (isProcessingRef.current) return;
                            isProcessingRef.current = true;
                            try {
                              const result = await cancelSubscription();
                              if (result.success) {
                                // Marquer l'annulation programmée — le membre garde l'accès
                                // jusqu'à fin de période (cancel_at_period_end côté Stripe)
                                setMemberProfile((prev: any) =>
                                  prev
                                    ? {
                                        ...prev,
                                        subscriptionCancelPending: true,
                                      }
                                    : null,
                                );

                                Alert.alert(
                                  t('subscriptionCancelled'),
                                  language === 'ar'
                                    ? 'سيظل اشتراكك ساريًا حتى نهاية الفترة المدفوعة'
                                    : "Votre abonnement sera actif jusqu'à la fin de la période payée.",
                                );

                                // Recharger depuis Firestore en arrière-plan
                                const user = AuthService.getCurrentUser();
                                if (user) loadMemberData(user.uid);
                              } else {
                                Alert.alert(t('commonError'), result.message);
                              }
                            } catch (err: any) {
                              Alert.alert(
                                t('commonError'),
                                err?.message || t('networkError'),
                              );
                            } finally {
                              isProcessingRef.current = false;
                            }
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 12 }}>❌</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: '#ef4444', fontSize: 15 },
                      ]}
                    >
                      {language === 'ar'
                        ? 'إلغاء اشتراكي الشهري'
                        : 'Annuler mon abonnement mensuel'}
                    </Text>
                    <Text style={[styles.cardSubtitle, { fontSize: 12 }]}>
                      {language === 'ar'
                        ? 'إيقاف الخصم التلقائي'
                        : 'Arrêter le prélèvement automatique'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

            {/* Renouveler si bientôt expiré */}
            {memberProfile?.cotisationExpiry &&
              (() => {
                const expiryValue = memberProfile.cotisationExpiry as any;
                const expiry =
                  expiryValue instanceof Date
                    ? expiryValue
                    : expiryValue?.toDate?.() || new Date(expiryValue);
                const daysLeft = Math.floor(
                  (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                );

                if (daysLeft <= 30 && daysLeft > 0) {
                  return (
                    <TouchableOpacity
                      style={styles.renewButton}
                      onPress={() => setShowPaymentModal(true)}
                    >
                      <Text style={styles.renewButtonText}>
                        {'⚠️ ' +
                          t('expiresInDays').replace(
                            '{days}',
                            String(daysLeft),
                          )}
                      </Text>
                    </TouchableOpacity>
                  );
                }
                return null;
              })()}

            {/* Déconnexion */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>{t('logout')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Build 266 - Historique séparé : deux boutons Dons / Adhésions */}
        {isLoggedIn && (
          <View style={[styles.card, { alignItems: 'stretch' }]}>
            <Text style={[styles.cardTitle, { marginBottom: 16 }]}>
              {'💳 ' + t('paymentHistoryTitle')}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowDonationsModal(true)}
                style={{
                  flex: 1,
                  backgroundColor: colors.accent + '15',
                  borderRadius: 12,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.accent + '30',
                }}
              >
                <Text style={{ fontSize: 28, marginBottom: 6 }}>🤲</Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: colors.text,
                  }}
                >
                  {t('myDonations')}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {
                    paymentHistory.filter((p: any) => p._type === 'donation')
                      .length
                  }{' '}
                  {t('paymentTypeDonation').toLowerCase()}(s)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowAdhesionsModal(true)}
                style={{
                  flex: 1,
                  backgroundColor: '#3b82f620',
                  borderRadius: 12,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#3b82f640',
                }}
              >
                <Text style={{ fontSize: 28, marginBottom: 6 }}>📋</Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: colors.text,
                  }}
                >
                  {t('myAdhesions')}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {
                    paymentHistory.filter((p: any) => p._type === 'cotisation')
                      .length
                  }{' '}
                  {t('paymentTypeCotisationAnnuel').split(' ')[0].toLowerCase()}
                  (s)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal Dons */}
      <Modal
        visible={showDonationsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDonationsModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '85%',
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: '700', color: colors.text }}
              >
                {'🤲 ' + t('myDonations')}
              </Text>
              <TouchableOpacity onPress={() => setShowDonationsModal(false)}>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.accent,
                    fontWeight: '600',
                  }}
                >
                  {t('close')}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {(() => {
                const donations = paymentHistory
                  .filter((p: any) => p._type === 'donation')
                  .sort((a: any, b: any) => {
                    const dA =
                      a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const dB =
                      b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return dB.getTime() - dA.getTime();
                  });
                if (donations.length === 0) {
                  return (
                    <Text
                      style={{
                        textAlign: 'center',
                        color: colors.textMuted,
                        paddingVertical: 32,
                      }}
                    >
                      {t('noDonationsYet')}
                    </Text>
                  );
                }
                // Grouper par année
                const byYear: Record<number, any[]> = {};
                donations.forEach((p: any) => {
                  const d =
                    p.createdAt?.toDate?.() || new Date(p.createdAt || 0);
                  const y = d.getFullYear();
                  if (!byYear[y]) byYear[y] = [];
                  byYear[y].push(p);
                });
                const years = Object.keys(byYear)
                  .map(Number)
                  .sort((a, b) => b - a);
                const locale = language === 'ar' ? 'ar-SA' : 'fr-FR';

                return years.map(year => {
                  const items = byYear[year];
                  const totalYear = items.reduce(
                    (sum: number, p: any) => sum + (p.amount || p.montant || 0),
                    0,
                  );
                  return (
                    <View key={year}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingVertical: 10,
                          paddingHorizontal: 4,
                          marginTop: years.indexOf(year) > 0 ? 12 : 0,
                          borderBottomWidth: 2,
                          borderBottomColor: colors.accent,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: '800',
                            color: colors.text,
                          }}
                        >
                          {year}
                        </Text>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: colors.accent,
                          }}
                        >
                          {totalYear.toFixed(2)} €
                        </Text>
                      </View>
                      {items.map((payment: any) => {
                        const date =
                          payment.createdAt?.toDate?.() ||
                          new Date(payment.createdAt);
                        const dateStr = date.toLocaleDateString(locale, {
                          day: '2-digit',
                          month: 'long',
                        });
                        const timeStr = date.toLocaleTimeString(locale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const paymentMethod =
                          payment.modePaiement || payment.paymentMethod || '';
                        let status = t('statusPaid');
                        let statusColor = colors.accent;
                        if (
                          payment.statut === 'refunded' ||
                          payment.status === 'refunded'
                        ) {
                          status = t('statusRefunded');
                          statusColor = '#f97316';
                        }
                        return (
                          <View
                            key={payment.id}
                            style={{
                              backgroundColor: colors.background,
                              borderRadius: 12,
                              padding: 14,
                              marginBottom: 10,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    fontSize: 15,
                                    fontWeight: '600',
                                    color: colors.text,
                                  }}
                                >
                                  {(
                                    payment.amount ||
                                    payment.montant ||
                                    0
                                  ).toFixed(2)}{' '}
                                  €
                                </Text>
                                {payment.projetNom ? (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: colors.textMuted,
                                      marginTop: 2,
                                    }}
                                  >
                                    {t('donationProject')} : {payment.projetNom}
                                  </Text>
                                ) : null}
                              </View>
                              <View
                                style={{
                                  backgroundColor: statusColor + '20',
                                  paddingHorizontal: 10,
                                  paddingVertical: 3,
                                  borderRadius: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: statusColor,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {status}
                                </Text>
                              </View>
                            </View>
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                marginTop: 8,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: colors.textMuted,
                                }}
                              >
                                {dateStr} {t('atTimeShort')} {timeStr}
                              </Text>
                              {paymentMethod ? (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: colors.textMuted,
                                  }}
                                >
                                  {paymentMethod === 'card'
                                    ? t('paymentMethodCB')
                                    : paymentMethod}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Adhésions */}
      <Modal
        visible={showAdhesionsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAdhesionsModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '85%',
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: '700', color: colors.text }}
              >
                {'📋 ' + t('myAdhesions')}
              </Text>
              <TouchableOpacity onPress={() => setShowAdhesionsModal(false)}>
                <Text
                  style={{ fontSize: 16, color: '#3b82f6', fontWeight: '600' }}
                >
                  {t('close')}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {(() => {
                const adhesions = paymentHistory
                  .filter((p: any) => p._type === 'cotisation')
                  .sort((a: any, b: any) => {
                    const dA =
                      a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const dB =
                      b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return dB.getTime() - dA.getTime();
                  });
                if (adhesions.length === 0) {
                  return (
                    <Text
                      style={{
                        textAlign: 'center',
                        color: colors.textMuted,
                        paddingVertical: 32,
                      }}
                    >
                      {t('noAdhesionsYet')}
                    </Text>
                  );
                }
                // Grouper par année
                const byYear: Record<number, any[]> = {};
                adhesions.forEach((p: any) => {
                  const d =
                    p.createdAt?.toDate?.() || new Date(p.createdAt || 0);
                  const y = d.getFullYear();
                  if (!byYear[y]) byYear[y] = [];
                  byYear[y].push(p);
                });
                const years = Object.keys(byYear)
                  .map(Number)
                  .sort((a, b) => b - a);
                const locale = language === 'ar' ? 'ar-SA' : 'fr-FR';

                return years.map(year => {
                  const items = byYear[year];
                  const totalYear = items.reduce(
                    (sum: number, p: any) => sum + (p.amount || p.montant || 0),
                    0,
                  );
                  return (
                    <View key={year}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingVertical: 10,
                          paddingHorizontal: 4,
                          marginTop: years.indexOf(year) > 0 ? 12 : 0,
                          borderBottomWidth: 2,
                          borderBottomColor: colors.accent,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: '800',
                            color: colors.text,
                          }}
                        >
                          {year}
                        </Text>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: colors.accent,
                          }}
                        >
                          {totalYear.toFixed(2)} €
                        </Text>
                      </View>
                      {items.map((payment: any) => {
                        const date =
                          payment.createdAt?.toDate?.() ||
                          new Date(payment.createdAt);
                        const dateStr = date.toLocaleDateString(locale, {
                          day: '2-digit',
                          month: 'long',
                        });
                        const timeStr = date.toLocaleTimeString(locale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const paymentMethod =
                          payment.modePaiement || payment.paymentMethod || '';
                        const period =
                          payment.metadata?.period || payment.period || '';
                        const isMensuel = period === 'mensuel';
                        let status = t('statusPaid');
                        let statusColor = colors.accent;
                        if (payment.status === 'refunded') {
                          status = t('statusRefunded');
                          statusColor = '#f97316';
                        } else if (payment.status === 'failed') {
                          status = t('statusFailed');
                          statusColor = '#ef4444';
                        }
                        return (
                          <View
                            key={payment.id}
                            style={{
                              backgroundColor: colors.background,
                              borderRadius: 12,
                              padding: 14,
                              marginBottom: 10,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    fontSize: 15,
                                    fontWeight: '600',
                                    color: colors.text,
                                  }}
                                >
                                  {(
                                    payment.amount ||
                                    payment.montant ||
                                    0
                                  ).toFixed(2)}{' '}
                                  €
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: isMensuel
                                      ? '#3b82f6'
                                      : colors.accent,
                                    marginTop: 2,
                                    fontWeight: '500',
                                  }}
                                >
                                  {isMensuel
                                    ? '🔄 ' + t('paymentTypeCotisationMensuel')
                                    : '📋 ' + t('paymentTypeCotisationAnnuel')}
                                </Text>
                              </View>
                              <View
                                style={{
                                  backgroundColor: statusColor + '20',
                                  paddingHorizontal: 10,
                                  paddingVertical: 3,
                                  borderRadius: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: statusColor,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {status}
                                </Text>
                              </View>
                            </View>
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                marginTop: 8,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: colors.textMuted,
                                }}
                              >
                                {dateStr} {t('atTimeShort')} {timeStr}
                              </Text>
                              {paymentMethod ? (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: colors.textMuted,
                                  }}
                                >
                                  {paymentMethod === 'card'
                                    ? t('paymentMethodCB')
                                    : paymentMethod}
                                </Text>
                              ) : null}
                            </View>
                            {payment.memberName ? (
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: colors.textMuted,
                                  marginTop: 4,
                                }}
                              >
                                {t('adhesionMember')} : {payment.memberName}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modales */}
      <MemberCardFullScreen
        visible={showCardFullScreen}
        onClose={() => setShowCardFullScreen(false)}
        members={allMembersForCard}
        isRTL={isRTL}
      />

      {renderReglementModal()}
      {renderPaymentModal()}
      {renderFamilyModal()}
    </BackgroundPattern>
  );

  // ============================================================
  // MODAL: LOGIN
  // ============================================================

  function renderLoginModal() {
    return (
      <Modal visible={showLoginModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowLoginModal(false);
                resetLoginForm();
              }}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            {showForgotPassword ? (
              // Mot de passe oublié
              <>
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                  🔑 Mot de passe oublié
                </Text>

                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="votre@email.com"
                  placeholderTextColor="#999"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    authLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleForgotPassword}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Envoyer le lien
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowForgotPassword(false)}>
                  <Text style={styles.linkText}>← Retour à la connexion</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Connexion / Inscription
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                  {isRegistering ? '📝 Créer un compte' : '🔐 Connexion'}
                </Text>

                {isRegistering && (
                  <>
                    <Text style={styles.inputLabel}>Nom *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Votre nom de famille"
                      placeholderTextColor="#999"
                      value={registerNom}
                      onChangeText={setRegisterNom}
                    />

                    <Text style={styles.inputLabel}>Prénom *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Votre prénom"
                      placeholderTextColor="#999"
                      value={registerPrenom}
                      onChangeText={setRegisterPrenom}
                    />

                    <Text style={styles.inputLabel}>Téléphone *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0612345678"
                      placeholderTextColor="#999"
                      value={registerTelephone}
                      onChangeText={setRegisterTelephone}
                      keyboardType="phone-pad"
                    />

                    <Text style={styles.inputLabel}>Adresse *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Votre adresse"
                      placeholderTextColor="#999"
                      value={registerAdresse}
                      onChangeText={setRegisterAdresse}
                    />

                    <Text style={styles.inputLabel}>Genre *</Text>
                    <View style={styles.genreContainer}>
                      <TouchableOpacity
                        style={[
                          styles.genreOption,
                          registerGenre === 'homme' && styles.genreSelected,
                        ]}
                        onPress={() => setRegisterGenre('homme')}
                      >
                        <Text
                          style={[
                            styles.genreText,
                            registerGenre === 'homme' &&
                              styles.genreTextSelected,
                          ]}
                        >
                          Homme
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.genreOption,
                          registerGenre === 'femme' && styles.genreSelected,
                        ]}
                        onPress={() => setRegisterGenre('femme')}
                      >
                        <Text
                          style={[
                            styles.genreText,
                            registerGenre === 'femme' &&
                              styles.genreTextSelected,
                          ]}
                        >
                          Femme
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.inputLabel}>
                      Date de naissance * (JJ/MM/AAAA)
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="01/01/1990"
                      placeholderTextColor="#999"
                      value={registerDateNaissance}
                      onChangeText={text =>
                        setRegisterDateNaissance(formatDateInput(text))
                      }
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </>
                )}

                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="votre@email.com"
                  placeholderTextColor="#999"
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>Mot de passe *</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor="#999"
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.eyeIcon}>
                      {showPassword ? '🙈' : '👁️'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isRegistering && (
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setAcceptedRules(!acceptedRules)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        acceptedRules && styles.checkboxChecked,
                      ]}
                    >
                      {acceptedRules && (
                        <Text style={styles.checkboxCheck}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      J'accepte le règlement intérieur de la mosquée
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    authLoading && styles.buttonDisabled,
                  ]}
                  onPress={isRegistering ? handleRegister : handleLogin}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {isRegistering ? 'Créer mon compte' : 'Se connecter'}
                    </Text>
                  )}
                </TouchableOpacity>

                {!isRegistering && (
                  <TouchableOpacity onPress={() => setShowForgotPassword(true)}>
                    <Text style={styles.linkText}>Mot de passe oublié ?</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setIsRegistering(!isRegistering)}
                >
                  <Text style={styles.switchText}>
                    {isRegistering
                      ? 'Déjà un compte ? Se connecter'
                      : 'Pas de compte ? Créer un compte'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  // ============================================================
  // MODAL: RÈGLEMENT
  // ============================================================

  function renderReglementModal() {
    const handleScroll = (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      const paddingToBottom = 50;
      if (
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - paddingToBottom
      ) {
        setHasScrolledToEnd(true);
      }
    };

    const handleContinueToPayment = () => {
      if (!hasScrolledToEnd) {
        Alert.alert(t('mustReadRules'), t('mustReadRulesMsg'));
        return;
      }
      if (!acceptedReglement) {
        Alert.alert(t('mustAcceptRules'), t('mustAcceptRulesMsg'));
        return;
      }
      setShowReglementModal(false);
      setShowPaymentModal(true);
    };

    return (
      <Modal visible={showReglementModal} transparent animationType="slide">
        <View style={styles.familyModalOverlay}>
          <View style={styles.familyModalContent}>
            {/* Header */}
            <View style={styles.familyModalHeader}>
              <Text style={[styles.familyModalTitle, isRTL && styles.rtlText]}>
                📜 Statuts et Règlement
              </Text>
              <TouchableOpacity
                style={styles.familyCloseButton}
                onPress={() => {
                  setShowReglementModal(false);
                  setHasScrolledToEnd(false);
                  setAcceptedReglement(false);
                }}
              >
                <Text style={styles.familyCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Contenu avec scroll */}
            <ScrollView
              style={styles.reglementScrollView}
              onScroll={handleScroll}
              scrollEventThrottle={400}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.reglementText, isRTL && styles.rtlText]}>
                {reglement?.contenu || 'Chargement du règlement...'}
              </Text>

              {/* Indicateur de fin */}
              <View style={styles.reglementEndMarker}>
                <Text style={styles.reglementEndText}>
                  ─── Fin du document ───
                </Text>
              </View>
            </ScrollView>

            {/* Footer avec checkbox et bouton */}
            <View style={styles.reglementFooter}>
              {!hasScrolledToEnd && (
                <View style={styles.scrollWarning}>
                  <Text style={styles.scrollWarningText}>
                    ⬇️ Faites défiler jusqu'en bas pour continuer
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAcceptedReglement(!acceptedReglement)}
              >
                <View
                  style={[
                    styles.checkbox,
                    acceptedReglement && styles.checkboxChecked,
                  ]}
                >
                  {acceptedReglement && (
                    <Text style={styles.checkboxCheck}>✓</Text>
                  )}
                </View>
                <Text style={[styles.checkboxLabel, { flex: 1 }]}>
                  J'ai lu et j'accepte les statuts et le règlement intérieur
                </Text>
              </TouchableOpacity>

              <View style={styles.reglementWarning}>
                <Text style={styles.reglementWarningText}>
                  ⚠️ En cas de refus d'adhésion par le bureau, votre paiement
                  sera converti en don (éligible au reçu fiscal).
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!hasScrolledToEnd || !acceptedReglement) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleContinueToPayment}
              >
                <Text style={styles.primaryButtonText}>
                  Continuer vers le paiement
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ============================================================
  // MODAL: PAYMENT
  // ============================================================

  function renderPaymentModal() {
    const totalAmount = getCurrentAmount();
    const breakdown = getPaymentBreakdown(selectedFormule, totalAmount);
    const minAmount = formulePrices[selectedFormule];

    return (
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowPaymentModal(false);
                setCustomAmount('');
              }}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              💳 Paiement
            </Text>

            {/* Montant personnalisable */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>
                Montant (minimum {minAmount}€)
              </Text>
              <View style={styles.amountInputContainer}>
                <TextInput
                  style={styles.amountInput}
                  value={customAmount || String(minAmount)}
                  onChangeText={text => {
                    const num = text.replace(/[^0-9]/g, '');
                    setCustomAmount(num);
                  }}
                  keyboardType="numeric"
                  placeholder={String(minAmount)}
                  placeholderTextColor="#999"
                />
                <Text style={styles.amountCurrency}>€</Text>
              </View>
              <Text style={styles.amountHint}>
                Vous pouvez donner plus pour soutenir la mosquée
              </Text>
            </View>

            {/* Répartition cotisation / don */}
            <View style={styles.breakdownSection}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  📋 Cotisation {selectedFormule}
                </Text>
                <Text style={styles.breakdownValue}>
                  {breakdown.cotisation}€
                </Text>
              </View>
              {breakdown.don > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabelDon}>
                    🎁 Don (reçu fiscal)
                  </Text>
                  <Text style={styles.breakdownValueDon}>{breakdown.don}€</Text>
                </View>
              )}
              <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                <Text style={styles.breakdownLabelTotal}>Total</Text>
                <Text style={styles.breakdownValueTotal}>
                  {breakdown.total}€
                </Text>
              </View>
            </View>

            {breakdown.don > 0 && (
              <View style={styles.donInfo}>
                <Text style={styles.donInfoText}>
                  ℹ️ Vous recevrez un reçu fiscal pour votre don de{' '}
                  {breakdown.don}€ (déduction de 66% des impôts)
                </Text>
              </View>
            )}

            {/* Méthodes de paiement */}
            <TouchableOpacity
              style={styles.paymentMethod}
              onPress={() => handlePayment('card')}
              disabled={isProcessingPayment}
            >
              <Text style={styles.paymentMethodIcon}>💳</Text>
              <View style={styles.paymentMethodContent}>
                <Text
                  style={styles.paymentMethodTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  CB
                </Text>
                <Text style={styles.paymentMethodSubtitle}>
                  Visa, Mastercard
                </Text>
              </View>
              {isProcessingPayment ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.paymentMethodArrow}>→</Text>
              )}
            </TouchableOpacity>

            {Platform.OS === 'ios' && isApplePayAvailable && (
              <TouchableOpacity
                style={[styles.paymentMethod, styles.applePayMethod]}
                onPress={() => handlePayment('apple')}
                disabled={isProcessingPayment}
              >
                <Image
                  source={require('../assets/apple-logo.png')}
                  style={styles.appleLogo}
                />
                <View style={styles.paymentMethodContent}>
                  <Text
                    style={[styles.paymentMethodTitle, styles.applePayText]}
                  >
                    Apple Pay
                  </Text>
                  <Text
                    style={[
                      styles.paymentMethodSubtitle,
                      styles.applePaySubtext,
                    ]}
                  >
                    Paiement rapide
                  </Text>
                </View>
                {isProcessingPayment ? (
                  <ActivityIndicator />
                ) : (
                  <Text
                    style={[styles.paymentMethodArrow, styles.applePayText]}
                  >
                    →
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {Platform.OS !== 'ios' && (
              <TouchableOpacity
                style={[styles.paymentMethod, styles.googlePayMethod]}
                onPress={() => handlePayment('card')}
                disabled={isProcessingPayment}
              >
                <Image
                  source={require('../assets/google-logo.png')}
                  style={styles.googleLogo}
                />
                <View style={styles.paymentMethodContent}>
                  <Text style={styles.paymentMethodTitle}>Google Pay</Text>
                  <Text style={styles.paymentMethodSubtitle}>
                    Paiement rapide
                  </Text>
                </View>
                {isProcessingPayment ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.paymentMethodArrow}>→</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.paymentMethod}
              onPress={() => handlePayment('virement')}
              disabled={isProcessingPayment}
            >
              <Text style={styles.paymentMethodIcon}>🏦</Text>
              <View style={styles.paymentMethodContent}>
                <Text style={styles.paymentMethodTitle}>Virement bancaire</Text>
                <Text style={styles.paymentMethodSubtitle}>
                  Paiement différé
                </Text>
              </View>
              <Text style={styles.paymentMethodArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ============================================================
  // MODAL: FAMILY
  // ============================================================

  function renderFamilyModal() {
    const totalAmount = familyMembers.length * formulePrices[familyFormule];

    return (
      <Modal visible={showFamilyModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.familyModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
        >
          <View style={styles.familyModalContent}>
            {/* Header */}
            <View style={styles.familyModalHeader}>
              <Text style={[styles.familyModalTitle, isRTL && styles.rtlText]}>
                👨‍👩‍👧‍👦 Inscrire des proches
              </Text>
              <TouchableOpacity
                style={styles.familyCloseButton}
                onPress={() => {
                  setShowFamilyModal(false);
                  setFamilyMembers([]);
                }}
              >
                <Text style={styles.familyCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Sélecteur de formule */}
            <View style={styles.familyFormuleSelector}>
              <TouchableOpacity
                style={[
                  styles.familyFormuleOption,
                  familyFormule === 'mensuel' && styles.familyFormuleSelected,
                ]}
                onPress={() => setFamilyFormule('mensuel')}
              >
                <Text
                  style={[
                    styles.familyFormuleLabel,
                    familyFormule === 'mensuel' &&
                      styles.familyFormuleLabelSelected,
                  ]}
                >
                  Mensuel
                </Text>
                <Text
                  style={[
                    styles.familyFormulePrice,
                    familyFormule === 'mensuel' &&
                      styles.familyFormulePriceSelected,
                  ]}
                >
                  {formulePrices.mensuel}€/mois
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.familyFormuleOption,
                  familyFormule === 'annuel' && styles.familyFormuleSelected,
                ]}
                onPress={() => setFamilyFormule('annuel')}
              >
                <Text
                  style={[
                    styles.familyFormuleLabel,
                    familyFormule === 'annuel' &&
                      styles.familyFormuleLabelSelected,
                  ]}
                >
                  Annuel
                </Text>
                <Text
                  style={[
                    styles.familyFormulePrice,
                    familyFormule === 'annuel' &&
                      styles.familyFormulePriceSelected,
                  ]}
                >
                  {formulePrices.annuel}€/an
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.familyScrollContent}
            >
              {familyMembers.map((member, index) => (
                <View key={member.id} style={styles.familyMemberCard}>
                  <View style={styles.familyMemberHeader}>
                    <Text style={styles.familyMemberNumber}>
                      Membre {index + 1}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeFamilyMember(member.id)}
                    >
                      <Text style={styles.removeButton}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.familyInput}
                    placeholder="Nom"
                    placeholderTextColor="#999"
                    value={member.nom}
                    onChangeText={v => updateFamilyMember(member.id, 'nom', v)}
                  />
                  <TextInput
                    style={styles.familyInput}
                    placeholder="Prénom"
                    placeholderTextColor="#999"
                    value={member.prenom}
                    onChangeText={v =>
                      updateFamilyMember(member.id, 'prenom', v)
                    }
                  />
                  <TextInput
                    style={styles.familyInput}
                    placeholder="Téléphone"
                    placeholderTextColor="#999"
                    value={member.telephone}
                    onChangeText={v =>
                      updateFamilyMember(member.id, 'telephone', v)
                    }
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.familyInput}
                    placeholder="Adresse"
                    placeholderTextColor="#999"
                    value={member.adresse}
                    onChangeText={v =>
                      updateFamilyMember(member.id, 'adresse', v)
                    }
                  />

                  <Text style={styles.familyInputLabel}>Genre *</Text>
                  <View style={styles.familyGenreContainer}>
                    <TouchableOpacity
                      style={[
                        styles.familyGenreOption,
                        member.genre === 'homme' && styles.familyGenreSelected,
                      ]}
                      onPress={() =>
                        updateFamilyMember(member.id, 'genre', 'homme')
                      }
                    >
                      <Text
                        style={[
                          styles.familyGenreText,
                          member.genre === 'homme' &&
                            styles.familyGenreTextSelected,
                        ]}
                      >
                        Homme
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.familyGenreOption,
                        member.genre === 'femme' && styles.familyGenreSelected,
                      ]}
                      onPress={() =>
                        updateFamilyMember(member.id, 'genre', 'femme')
                      }
                    >
                      <Text
                        style={[
                          styles.familyGenreText,
                          member.genre === 'femme' &&
                            styles.familyGenreTextSelected,
                        ]}
                      >
                        Femme
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.familyInput}
                    placeholder="Date de naissance (JJ/MM/AAAA)"
                    placeholderTextColor="#999"
                    value={member.dateNaissance}
                    onChangeText={v =>
                      updateFamilyMember(
                        member.id,
                        'dateNaissance',
                        formatDateInput(v),
                      )
                    }
                    keyboardType="numeric"
                    maxLength={10}
                  />

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() =>
                      updateFamilyMember(member.id, 'accepte', !member.accepte)
                    }
                  >
                    <View
                      style={[
                        styles.checkbox,
                        member.accepte && styles.checkboxChecked,
                      ]}
                    >
                      {member.accepte && (
                        <Text style={styles.checkboxCheck}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      Accepte le règlement intérieur
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addMemberButton}
                onPress={addFamilyMember}
              >
                <Text style={styles.addMemberButtonText}>
                  + Ajouter une personne
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Footer avec total et boutons */}
            {familyMembers.length > 0 && (
              <View style={styles.familyFooter}>
                <View style={styles.familyTotalRow}>
                  <Text style={styles.familyTotalLabel}>
                    {familyMembers.length} personne
                    {familyMembers.length > 1 ? 's' : ''} ×{' '}
                    {formulePrices[familyFormule]}€
                  </Text>
                  <Text style={styles.familyTotalAmount}>{totalAmount}€</Text>
                </View>

                <TouchableOpacity
                  style={styles.familyPayButton}
                  onPress={() => handlePayFamily('card')}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.familyPayButtonText}>
                      💳 Payer par carte
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.familyPaymentOptions}>
                  {isApplePayAvailable && (
                    <TouchableOpacity
                      style={styles.familyPayOptionButton}
                      onPress={() => handlePayFamily('apple')}
                      disabled={isProcessingPayment}
                    >
                      <Text style={styles.familyPayOptionText}> Pay</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.familyPayOptionButton}
                    onPress={() => handlePayFamily('virement')}
                    disabled={isProcessingPayment}
                  >
                    <Text style={styles.familyPayOptionText}>🏦 Virement</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: HEADER_PADDING_TOP,
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  pageTitleContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  greeting: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...platformShadow(3),
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Benefits section
  benefitsSection: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  advantageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  advantageIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  benefitItem: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  benefitText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Formules
  formulesContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  formuleOption: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  formuleSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '10',
  },
  formuleLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  formuleLabelSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
  formulePrice: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  formulePriceSelected: {
    color: colors.accent,
  },
  formuleDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  formuleDescSelected: {
    color: colors.accent,
  },
  economyBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  economyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  // Member card button
  memberCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...platformShadow(3),
  },
  memberCardButtonIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  memberCardButtonContent: {
    flex: 1,
  },
  memberCardButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  memberCardButtonSubtext: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  memberCardButtonArrow: {
    fontSize: fontSize.lg,
    color: '#fff',
  },

  // Family & Memberships buttons
  familyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...platformShadow(2),
  },
  familyButtonIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  familyButtonContent: {
    flex: 1,
  },
  familyButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  familyButtonSubtext: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  familyButtonArrow: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },

  membershipsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '15',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  membershipsButtonIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  membershipsButtonContent: {
    flex: 1,
  },
  membershipsButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
  },
  membershipsButtonSubtext: {
    fontSize: fontSize.xs,
    color: colors.accent + 'AA',
    marginTop: 2,
  },
  membershipsButtonArrow: {
    fontSize: fontSize.lg,
    color: colors.accent,
  },

  // Member card section
  memberCardSection: {
    marginBottom: spacing.lg,
  },
  viewCardButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  viewCardButtonText: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontWeight: '500',
  },

  // Renew button
  renewButton: {
    backgroundColor: '#F5920020',
    borderWidth: 1,
    borderColor: '#F59200',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  renewButtonText: {
    color: '#F59200',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Logout
  logoutButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  logoutButtonText: {
    fontSize: fontSize.sm,
    color: colors.error,
  },
  // Reçu Fiscal
  recuFiscalSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  recuFiscalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  recuFiscalCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  recuFiscalInfo: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  recuYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  recuYearText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  recuNotAvailable: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  recuFiscalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  recuFiscalButtonDisabled: {
    backgroundColor: 'rgba(201,162,39,0.4)',
  },
  recuFiscalButtonIcon: {
    fontSize: 14,
  },
  recuFiscalButtonText: {
    fontSize: fontSize.sm,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 28,
    color: colors.textMuted,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Input
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 15,
    padding: 5,
  },
  eyeIcon: {
    fontSize: 20,
  },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    flex: 1,
  },

  // Links
  linkText: {
    fontSize: fontSize.sm,
    color: colors.accent,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  switchText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    textDecorationLine: 'underline',
  },

  // Payment methods
  paymentSummary: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  paymentSummaryLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  paymentSummaryAmount: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  // Montant personnalisable
  amountSection: {
    marginBottom: spacing.md,
  },
  amountLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  amountInput: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: spacing.md,
  },
  amountCurrency: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.accent,
  },
  amountHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  // Répartition cotisation/don
  breakdownSection: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  breakdownLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  breakdownValue: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  breakdownLabelDon: {
    fontSize: fontSize.sm,
    color: '#22c55e',
  },
  breakdownValueDon: {
    fontSize: fontSize.sm,
    color: '#22c55e',
    fontWeight: '600',
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  breakdownLabelTotal: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
  },
  breakdownValueTotal: {
    fontSize: fontSize.lg,
    color: colors.accent,
    fontWeight: '700',
  },
  donInfo: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  donInfoText: {
    fontSize: fontSize.xs,
    color: '#22c55e',
    textAlign: 'center',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  applePayMethod: {
    backgroundColor: '#000',
  },
  googlePayMethod: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  googleLogo: {
    width: 22,
    height: 22,
    marginRight: spacing.md,
  },
  paymentMethodIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  appleLogo: {
    width: 20,
    height: 24,
    marginRight: spacing.md,
    tintColor: '#fff',
  },
  paymentMethodContent: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  paymentMethodSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  applePayText: {
    color: '#fff',
  },
  applePaySubtext: {
    color: 'rgba(255,255,255,0.7)',
  },
  paymentMethodArrow: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },

  // Family modal - Full screen
  familyModalOverlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  familyModalContent: {
    flex: 1,
    paddingTop: HEADER_PADDING_TOP,
  },
  familyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  familyModalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  familyCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyCloseButtonText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  familyFormuleSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  familyFormuleOption: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  familyFormuleSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  familyFormuleLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 4,
  },
  familyFormuleLabelSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
  familyFormulePrice: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  familyFormulePriceSelected: {
    color: colors.accent,
  },
  familyScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 150, // Extra padding for keyboard
  },
  familyMemberCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...platformShadow(2),
  },
  familyMemberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  familyMemberNumber: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.accent,
  },
  removeButton: {
    fontSize: 20,
    color: colors.error,
    padding: spacing.xs,
  },
  familyInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addMemberButton: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addMemberButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
  },
  familyFooter: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing.xl,
  },
  familyTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  familyTotalLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  familyTotalAmount: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  familyPayButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  familyPayButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  familyPaymentOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  familyPayOptionButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  familyPayOptionText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
  },

  // RTL
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  // Règlement modal
  reglementScrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  reglementText: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 22,
  },
  reglementEndMarker: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  reglementEndText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  reglementFooter: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scrollWarning: {
    backgroundColor: colors.accent + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  scrollWarningText: {
    fontSize: fontSize.sm,
    color: colors.accent,
    textAlign: 'center',
  },
  reglementWarning: {
    backgroundColor: '#F5920015',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
  },
  reglementWarningText: {
    fontSize: fontSize.xs,
    color: '#F59200',
    textAlign: 'center',
  },

  // Sympathisant benefits
  sympathisantBenefits: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  // Genre selector
  genreContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  genreOption: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  genreSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  genreText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    fontWeight: '500',
  },
  genreTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },

  // Family genre selector
  familyInputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  familyGenreContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  familyGenreOption: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  familyGenreSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  familyGenreText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  familyGenreTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },

  // Welcome modal
  welcomeModalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  welcomeEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  welcomeTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  welcomeText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  welcomeBenefits: {
    alignSelf: 'stretch',
    marginBottom: spacing.lg,
  },
  welcomeBenefit: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  welcomeButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  welcomeButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  welcomeLaterButton: {
    paddingVertical: spacing.sm,
  },
  welcomeLaterText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Year Filter Buttons
  yearButton: {
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  yearButtonActive: {
    backgroundColor: '#C9A227',
  },
  yearButtonInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8B7355',
  },
  yearButtonText: {
    fontSize: isTablet
      ? moderateScale(16)
      : isSmallScreen
      ? moderateScale(12)
      : moderateScale(14),
    fontWeight: '600' as const,
  },
  yearButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  yearButtonTextInactive: {
    color: '#8B7355',
  },

  // Payment History
  paymentHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: isSmallScreen ? spacing.sm : spacing.md,
  },
  paymentHistoryItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentHistoryDate: {
    fontSize: isSmallScreen ? fontSize.sm : fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  paymentHistoryType: {
    fontSize: isSmallScreen ? fontSize.xs : fontSize.sm,
    color: colors.textSecondary,
  },
  paymentHistoryAmount: {
    fontSize: isSmallScreen ? fontSize.md : fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  paymentHistoryStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  paymentHistoryStatusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

export default MemberScreen;
