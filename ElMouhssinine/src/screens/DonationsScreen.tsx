import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Vibration,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  HEADER_PADDING_TOP,
  wp,
  MODAL_WIDTH,
  isSmallScreen,
  isTablet,
  moderateScale,
} from '../theme/colors';
import {
  subscribeToProjects,
  subscribeToMosqueeInfo,
  createDonation,
  addDonation,
} from '../services/firebase';
import { Project, ProjectFile, MosqueeInfo } from '../types';
import Clipboard from '@react-native-clipboard/clipboard';
import { useLanguage } from '../context/LanguageContext';
import {
  makePayment,
  makeApplePayPayment,
  showPaymentError,
  showPaymentSuccess,
} from '../services/stripe';
import { isPlatformPaySupported } from '@stripe/stripe-react-native';
import { EmptyProjects } from '../components';
import { AuthService, MemberProfile } from '../services/auth';
import { BackgroundPattern } from '../components/BackgroundPattern';
import {
  getGoldPricePerGram,
  calculateNisab,
  NISAB_INFO,
} from '../services/goldPrice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DonationsScreen = () => {
  const { t, isRTL, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectType, setProjectType] = useState<'interne' | 'externe'>(
    'interne',
  );
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showRIBModal, setShowRIBModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showZakatModal, setShowZakatModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [mosqueeInfo, setMosqueeInfo] = useState<MosqueeInfo | null>(null);
  const [copied, setCopied] = useState('');
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [selectedProjectFiles, setSelectedProjectFiles] = useState<
    ProjectFile[]
  >([]);
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [showProjectDetailModal, setShowProjectDetailModal] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const processingRef = useRef(false); // Guard supplémentaire contre double paiement
  const [refreshing, setRefreshing] = useState(false);
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);

  // 3 pages : choix → formulaire identité → projets (existant)
  const [donPage, setDonPage] = useState<'choix' | 'formulaire' | 'projets'>(
    'choix',
  );

  // Formulaire identité donateur
  const [donorType, setDonorType] = useState<'particulier' | 'entreprise'>(
    'particulier',
  );
  const [donorFirstName, setDonorFirstName] = useState('');
  const [donorLastName, setDonorLastName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorAddress, setDonorAddress] = useState('');
  const [donorPostalCode, setDonorPostalCode] = useState('');
  const [donorCity, setDonorCity] = useState('');
  const [donorCompanyName, setDonorCompanyName] = useState('');
  const [donorSiret, setDonorSiret] = useState('');
  const [donorLegalRep, setDonorLegalRep] = useState('');
  const [donorFormFilled, setDonorFormFilled] = useState(false);

  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(
    null,
  );

  // Pré-remplir si user connecté + écouter changements de compte
  useEffect(() => {
    const unsubAuth = AuthService.onAuthStateChanged(async user => {
      if (user) {
        const profile = await AuthService.getMemberProfile(user.uid);
        if (profile) {
          setDonorFirstName(
            profile.prenom || profile.name?.split(' ')[0] || '',
          );
          setDonorLastName(
            profile.nom || profile.name?.split(' ').slice(1).join(' ') || '',
          );
          setDonorEmail(profile.email || user.email || '');
          const fullAddress = profile.adresse || profile.address || '';
          if (fullAddress) {
            setDonorAddress(fullAddress);
          }
          if (profile.codePostal) {
            setDonorPostalCode(profile.codePostal);
          }
          if (profile.ville) {
            setDonorCity(profile.ville);
          }
          // BUG 2 FIX: Extraire CP et ville depuis l'adresse complète
          // si les champs séparés sont absents (membres inscrits avant l'ajout de ces champs)
          if (!profile.codePostal && !profile.ville && fullAddress) {
            const cpMatch = fullAddress.match(/\b(\d{5})\b/);
            if (cpMatch) {
              setDonorPostalCode(cpMatch[1]);
              // Extraire la ville : texte après le code postal (nettoyé)
              const afterCp = fullAddress
                .substring(fullAddress.indexOf(cpMatch[1]) + 5)
                .replace(/^[\s,]+/, '')
                .trim();
              if (afterCp) {
                setDonorCity(afterCp.split(/[,\n]/)[0].trim());
              }
            }
          }
          setDonorFormFilled(true);
          setMemberProfile(profile);
        } else {
          setDonorEmail(user.email || '');
          setDonorFirstName('');
          setDonorLastName('');
          setDonorAddress('');
          setDonorPostalCode('');
          setDonorCity('');
          setDonorFormFilled(false);
          setMemberProfile(null);
        }
      } else {
        // Reset all donor info on logout
        setDonorFirstName('');
        setDonorLastName('');
        setDonorEmail('');
        setDonorAddress('');
        setDonorPostalCode('');
        setDonorCity('');
        setDonorFormFilled(false);
        setMemberProfile(null);
      }
    });
    return () => unsubAuth();
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

  const validateSIRET = (siret: string): boolean => {
    const cleaned = siret.replace(/\s/g, '');
    return /^\d{14}$/.test(cleaned);
  };

  const validateDonorForm = (): boolean => {
    if (donorType === 'particulier') {
      if (!donorFirstName.trim() || donorFirstName.trim().length < 2) {
        Alert.alert(t('commonError') as string, t('firstNameMin') as string);
        return false;
      }
      if (!donorLastName.trim() || donorLastName.trim().length < 2) {
        Alert.alert(t('commonError') as string, t('lastNameMin') as string);
        return false;
      }
    } else {
      if (!donorCompanyName.trim()) {
        Alert.alert(
          t('commonError') as string,
          t('companyNameRequired') as string,
        );
        return false;
      }
      if (!validateSIRET(donorSiret)) {
        Alert.alert(t('commonError') as string, t('siretInvalid') as string);
        return false;
      }
      if (!donorLegalRep.trim()) {
        Alert.alert(
          t('commonError') as string,
          t('legalRepRequired') as string,
        );
        return false;
      }
    }
    if (!donorEmail.trim() || !/\S+@\S+\.\S+/.test(donorEmail)) {
      Alert.alert(t('commonError') as string, t('invalidEmail') as string);
      return false;
    }
    if (!donorAddress.trim()) {
      Alert.alert(t('commonError') as string, t('addressRequired') as string);
      return false;
    }
    if (!donorPostalCode.trim() || !/^\d{5}$/.test(donorPostalCode.trim())) {
      Alert.alert(t('commonError') as string, t('postalCodeInvalid') as string);
      return false;
    }
    if (!donorCity.trim()) {
      Alert.alert(t('commonError') as string, t('cityRequired') as string);
      return false;
    }
    return true;
  };

  const getDonorInfo = () => ({
    email: donorEmail.trim(),
    address: donorAddress.trim(),
    postalCode: donorPostalCode.trim(),
    city: donorCity.trim(),
    ...(donorType === 'particulier'
      ? { firstName: donorFirstName.trim(), lastName: donorLastName.trim() }
      : {
          companyName: donorCompanyName.trim(),
          siret: donorSiret.replace(/\s/g, ''),
          legalRepresentative: donorLegalRep.trim(),
        }),
  });

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Les subscriptions Firebase se rechargent automatiquement
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Zakat
  const [zakatEpargne, setZakatEpargne] = useState('');
  const [zakatOr, setZakatOr] = useState('');
  const [zakatCash, setZakatCash] = useState(''); // Argent liquide (cash)
  const [zakatInvestissements, setZakatInvestissements] = useState(''); // Actions, SCPI, parts sociales

  // Nisab dynamique basé sur le cours de l'or
  const [nisab, setNisab] = useState(11985); // 85g × 141€ (fallback mars 2026)
  const [goldPrice, setGoldPrice] = useState(141);
  const [isGoldPriceRealTime, setIsGoldPriceRealTime] = useState(false);

  const amounts = [10, 20, 50, 100, 200, 500];

  // Charger le prix de l'or et calculer le Nisab
  useEffect(() => {
    const fetchNisab = async () => {
      try {
        const result = await getGoldPricePerGram();
        setGoldPrice(result.pricePerGram);
        setNisab(calculateNisab(result.pricePerGram));
        setIsGoldPriceRealTime(result.isRealTime);
      } catch (error) {
        if (__DEV__)
          console.log(
            'Erreur récupération prix or, utilisation valeur par défaut',
          );
        setIsGoldPriceRealTime(false);
      }
    };
    fetchNisab();
  }, []);

  // Générer une référence unique pour les virements
  const generateTransferReference = () => {
    const date = new Date();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `DON-${date.getFullYear()}${(date.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${random}`;
  };

  const [transferReference] = useState(generateTransferReference());

  // Pas de projets par défaut - tous les projets viennent de Firestore

  useEffect(() => {
    const unsubProjects = subscribeToProjects(fetchedProjects => {
      setProjects(fetchedProjects);
    });

    // Subscription temps réel pour IBAN et infos mosquée
    const unsubMosqueeInfo = subscribeToMosqueeInfo(info => {
      if (info) {
        if (__DEV__) console.log('🏦 MosqueeInfo updated:', info.iban);
        setMosqueeInfo(info);
      }
    });

    return () => {
      unsubProjects?.();
      unsubMosqueeInfo?.();
    };
  }, []);

  // Fonction helper pour déterminer si un projet est externe
  const isProjectExternal = (p: Project) =>
    p.isExternal || (p as any).categorie === 'externe';

  const displayProjects =
    projectType === 'interne'
      ? projects.filter(p => !isProjectExternal(p))
      : projects.filter(p => isProjectExternal(p));

  const getProgress = (raised: number, goal: number) => {
    if (!goal || goal <= 0) return 0;
    return Math.min((raised / goal) * 100, 100);
  };

  const getFinalAmount = () => {
    if (customAmount && parseFloat(customAmount) > 0) {
      return parseFloat(customAmount);
    }
    return selectedAmount || 0;
  };

  const getSelectedProjectData = () => {
    return projects.find(p => p.id === selectedProject);
  };

  const getProjectWithFiles = (projectId: string): Project | undefined => {
    // Chercher dans les projets Firebase
    const firebaseProject = projects.find(p => p.id === projectId);
    if (
      firebaseProject &&
      firebaseProject.fichiers &&
      firebaseProject.fichiers.length > 0
    ) {
      return firebaseProject;
    }
    return firebaseProject;
  };

  const handleViewProject = (projectId: string) => {
    const project = getProjectWithFiles(projectId);
    if (project?.fichiers && project.fichiers.length > 0) {
      setSelectedProjectFiles(project.fichiers);
      setSelectedProjectName(project.name);
      setShowFilesModal(true);
    }
  };

  const handleViewProjectDetails = (projectId: string) => {
    // Chercher dans les projets Firebase
    const project = projects.find(p => p.id === projectId);
    if (project) {
      // Vérifier si c'est un projet interne avec fichiers
      const projectWithFiles = getProjectWithFiles(projectId);
      setDetailProject(projectWithFiles || project);
      setShowProjectDetailModal(true);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    Clipboard.setString(text.replace(/\s/g, ''));
    // Haptic feedback sur copie
    Vibration.vibrate(50);
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const handlePayment = async () => {
    console.log(
      '[Donations] handlePayment appelé, method:',
      paymentMethod,
      'processing:',
      isProcessingPayment,
      'ref:',
      processingRef.current,
    );
    // PROTECTION DOUBLE PAIEMENT: Verrouillage IMMÉDIAT via ref (synchrone)
    if (isProcessingPayment || processingRef.current) {
      console.log('[Donations] Paiement déjà en cours, ignoré');
      return;
    }
    // Verrouiller IMMÉDIATEMENT avant toute logique async
    processingRef.current = true;

    if (!selectedProject || getFinalAmount() <= 0) {
      console.log(
        '[Donations] Pas de projet sélectionné ou montant <= 0:',
        selectedProject,
        getFinalAmount(),
      );
      processingRef.current = false;
      return;
    }

    const amount = getFinalAmount();
    const project = getSelectedProjectData();

    // Si virement bancaire, afficher le modal RIB
    if (paymentMethod === 'virement') {
      processingRef.current = false;
      setShowPaymentModal(false);
      setShowRIBModal(true);
      return;
    }

    // SÉCURITÉ: Vérifier si l'utilisateur est connecté pour les reçus fiscaux
    const currentUser = AuthService.getCurrentUser();
    const isAnonymous = !currentUser;

    // Avertir l'utilisateur non connecté que le don sera anonyme
    if (isAnonymous) {
      return new Promise<void>(resolve => {
        Alert.alert(
          'Don anonyme',
          "Vous n'êtes pas connecté. Votre don sera enregistré de manière anonyme.\n\nVoulez-vous continuer ?",
          [
            {
              text: t('commonCancel') as string,
              style: 'cancel',
              onPress: () => {
                processingRef.current = false;
                resolve();
              },
            },
            {
              text: 'Continuer',
              onPress: async () => {
                await processPayment(amount, project, true);
                resolve();
              },
            },
            {
              text: 'Me connecter',
              onPress: () => {
                processingRef.current = false;
                setShowPaymentModal(false);
                Alert.alert(
                  'Connexion requise',
                  'Rendez-vous dans l\'onglet "Membre" pour vous connecter, puis revenez faire votre don.',
                );
                resolve();
              },
            },
          ],
          { cancelable: true },
        );
      });
    }

    // Utilisateur connecté, procéder au paiement
    await processPayment(amount, project, false);
  };

  // Fonction séparée pour le traitement du paiement
  const processPayment = async (
    amount: number,
    project: Project | undefined,
    isAnonymous: boolean,
  ) => {
    setIsProcessingPayment(true);
    processingRef.current = true;
    const currentUser = AuthService.getCurrentUser();

    try {
      // BUG 3 FIX: Ajouter donorName + userId dans les metadata Stripe
      // pour que le webhook sauvegarde le nom du donateur (pas "Anonyme")
      const donorFullName =
        donorType === 'particulier'
          ? `${donorFirstName.trim()} ${donorLastName.trim()}`.trim()
          : donorCompanyName.trim();
      const paymentParams = {
        amount,
        description: `Don - ${project?.name || 'Mosquée El Mohsinine'}`,
        type: 'donation' as const,
        metadata: {
          projectId: selectedProject || undefined,
          projectName: project?.name || '',
          isAnonymous: isAnonymous,
          donorEmail: donorEmail || currentUser?.email?.toLowerCase() || '',
          userId: currentUser?.uid || '',
          donorName: isAnonymous
            ? 'Anonyme'
            : donorFullName || donorEmail || '',
          donorType: donorType,
          // Sérialiser donorInfo pour le webhook (metadata Stripe = strings uniquement)
          donorInfo:
            donorFormFilled || donPage === 'formulaire'
              ? JSON.stringify(getDonorInfo())
              : undefined,
        },
      };

      // Apple Pay → flux natif direct / CB → PaymentSheet CB uniquement
      const result =
        paymentMethod === 'apple'
          ? await makeApplePayPayment(paymentParams)
          : await makePayment(paymentParams);

      if (result.success && result.paymentIntentId) {
        // Enregistrer le don dans Firebase avec donorType + donorInfo
        // Retry une fois si l'écriture Firebase échoue (paiement déjà confirmé par Stripe)
        const donationData = {
          projectId: selectedProject || '',
          projectName: project?.name || '',
          amount,
          stripePaymentIntentId: result.paymentIntentId,
          paymentMethod: paymentMethod || 'card',
          isAnonymous: isAnonymous,
          donorEmail: donorEmail || currentUser?.email?.toLowerCase() || '',
          donorName: isAnonymous
            ? 'Anonyme'
            : donorFullName || donorEmail || '',
          donorType:
            donorFormFilled || donPage === 'formulaire' ? donorType : undefined,
          donorInfo:
            donorFormFilled || donPage === 'formulaire'
              ? getDonorInfo()
              : undefined,
        };
        try {
          await addDonation(donationData);
        } catch (firebaseError) {
          // Retry une fois — le paiement Stripe est déjà confirmé
          if (__DEV__)
            console.warn(
              '[Donations] Firebase write failed, retrying...',
              firebaseError,
            );
          await addDonation(donationData);
        }

        // Fermer le modal et afficher succès
        setShowPaymentModal(false);

        // Message de succès
        Alert.alert(
          t('commonSuccess') as string,
          t('paymentSuccess') as string,
        );

        // Reset complet et retour page 1
        setSelectedProject(null);
        setSelectedAmount(null);
        setCustomAmount('');
        setPaymentMethod(null);
        setDonorType('particulier');
        setDonorFirstName('');
        setDonorLastName('');
        setDonorEmail('');
        setDonorAddress('');
        setDonorPostalCode('');
        setDonorCity('');
        setDonorCompanyName('');
        setDonorSiret('');
        setDonorLegalRep('');
        setDonorFormFilled(false);
        setDonPage('choix');
      } else {
        showPaymentError(result.error || 'Une erreur est survenue');
      }
    } catch (error) {
      const err = error as Error;
      if (__DEV__) console.error('Erreur paiement:', err);
      showPaymentError(err?.message || 'Une erreur est survenue');
    } finally {
      setIsProcessingPayment(false);
      processingRef.current = false;
    }
  };

  // Calcul Zakat
  // Total = Épargne + Or + Investissements + Argent liquide (cash)
  const totalWealth =
    (parseFloat(zakatEpargne) || 0) +
    (parseFloat(zakatOr) || 0) +
    (parseFloat(zakatInvestissements) || 0) +
    (parseFloat(zakatCash) || 0);
  const zakatAmount =
    totalWealth >= nisab ? totalWealth * NISAB_INFO.zakatRate : 0;
  const isZakatEligible = totalWealth >= nisab;

  return (
    <BackgroundPattern>
      <KeyboardAvoidingView
        style={{ flex: 1, paddingBottom: insets.bottom }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent, '#D4AF37']}
              progressBackgroundColor="#FFFFFF"
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t('donateAmount')}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
              {t('contributeMessage')}
            </Text>
          </View>

          <View style={styles.content}>
            {/* ========== PAGE 1 : CHOIX TYPE DE DON ========== */}
            {donPage === 'choix' && (
              <>
                {/* 3 gros boutons */}
                <TouchableOpacity
                  style={styles.donChoiceBtn}
                  onPress={() => setDonPage('formulaire')}
                >
                  <Text style={styles.donChoiceIcon}>🕌</Text>
                  <View style={styles.donChoiceInfo}>
                    <Text
                      style={[styles.donChoiceTitle, isRTL && styles.rtlText]}
                    >
                      {language === 'ar' ? 'تبرع للمسجد' : 'Don a la mosquee'}
                    </Text>
                    <Text
                      style={[styles.donChoiceDesc, isRTL && styles.rtlText]}
                    >
                      {language === 'ar'
                        ? 'دعم عام لجمعية المحسنين'
                        : "Soutien general a l'association El Mohsinine"}
                    </Text>
                  </View>
                  <Text style={styles.donChoiceArrow}>{isRTL ? '←' : '→'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.donChoiceBtn}
                  onPress={() => {
                    setProjectType('interne');
                    setDonPage('projets');
                  }}
                >
                  <Text style={styles.donChoiceIcon}>📋</Text>
                  <View style={styles.donChoiceInfo}>
                    <Text
                      style={[styles.donChoiceTitle, isRTL && styles.rtlText]}
                    >
                      {language === 'ar' ? 'مشروع محلي' : 'Projet local'}
                    </Text>
                    <Text
                      style={[styles.donChoiceDesc, isRTL && styles.rtlText]}
                    >
                      {language === 'ar'
                        ? 'مشاريع المسجد الجارية'
                        : 'Projets en cours de la mosquee'}
                    </Text>
                  </View>
                  <Text style={styles.donChoiceArrow}>{isRTL ? '←' : '→'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.donChoiceBtn}
                  onPress={() => {
                    setProjectType('externe');
                    setDonPage('projets');
                  }}
                >
                  <Text style={styles.donChoiceIcon}>🌍</Text>
                  <View style={styles.donChoiceInfo}>
                    <Text
                      style={[styles.donChoiceTitle, isRTL && styles.rtlText]}
                    >
                      {language === 'ar' ? 'قضية خارجية' : 'Cause externe'}
                    </Text>
                    <Text
                      style={[styles.donChoiceDesc, isRTL && styles.rtlText]}
                    >
                      {language === 'ar'
                        ? 'مساجد وجمعيات أخرى'
                        : 'Autres mosquees et associations'}
                    </Text>
                  </View>
                  <Text style={styles.donChoiceArrow}>{isRTL ? '←' : '→'}</Text>
                </TouchableOpacity>

                {/* Calculateur Zakat */}
                <TouchableOpacity
                  style={[
                    styles.secondaryBtn,
                    styles.zakatBtn,
                    { marginTop: spacing.xl },
                  ]}
                  onPress={() => setShowZakatModal(true)}
                >
                  <Text
                    style={[
                      styles.secondaryBtnText,
                      styles.zakatBtnText,
                      isRTL && styles.rtlText,
                    ]}
                  >
                    🧮 {t('calculateZakat')}
                  </Text>
                </TouchableOpacity>

                {/* Reçu fiscal */}
                <View style={styles.receiptInfoCard}>
                  <Text style={styles.receiptInfoIcon}>🧾</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.receiptInfoTitle, isRTL && styles.rtlText]}
                    >
                      {language === 'ar' ? 'إيصال ضريبي' : 'Reçu fiscal'}
                    </Text>
                    <Text
                      style={[styles.receiptInfoDesc, isRTL && styles.rtlText]}
                    >
                      {language === 'ar'
                        ? `تبرعاتكم لعام ${new Date().getFullYear()} معفاة من الضرائب. سيتم إرسال الإيصال الضريبي في بداية ${
                            new Date().getFullYear() + 1
                          }.`
                        : `Vos dons ${new Date().getFullYear()} sont déductibles des impôts. Le reçu fiscal sera envoyé début ${
                            new Date().getFullYear() + 1
                          }.`}
                    </Text>
                  </View>
                </View>

                {/* Moyens de paiement acceptes */}
                <View style={styles.paymentSection}>
                  <Text
                    style={[
                      styles.paymentSectionTitle,
                      isRTL && styles.rtlText,
                    ]}
                  >
                    {t('acceptedPayments')}
                  </Text>
                  <View style={styles.paymentGrid}>
                    <View style={styles.paymentItem}>
                      <Text style={styles.paymentItemIcon}>💳</Text>
                      <Text
                        style={[
                          styles.paymentItemText,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {t('creditCard')}
                      </Text>
                    </View>
                    <View style={styles.applePayButton}>
                      <Image
                        source={require('../assets/apple-logo.png')}
                        style={styles.appleLogo}
                      />
                      <Text style={styles.applePayText}>Pay</Text>
                    </View>
                    {Platform.OS !== 'ios' && (
                      <View style={styles.googlePayButton}>
                        <Image
                          source={require('../assets/google-logo.png')}
                          style={styles.googleLogo}
                        />
                        <Text style={styles.googlePayText}>Pay</Text>
                      </View>
                    )}
                    <View style={styles.paymentItem}>
                      <Text style={styles.paymentItemIcon}>🏦</Text>
                      <Text
                        style={[
                          styles.paymentItemText,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {t('bankTransfer')}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.disclaimer, isRTL && styles.rtlText]}>
                  {t('donationDisclaimer')}
                </Text>
              </>
            )}

            {/* ========== PAGE 2 : FORMULAIRE IDENTITE + MONTANT ========== */}
            {donPage === 'formulaire' && (
              <>
                {/* Bouton retour */}
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setDonPage('choix')}
                >
                  <Text style={styles.backBtnText}>
                    {isRTL ? '→' : '←'} {language === 'ar' ? 'رجوع' : 'Retour'}
                  </Text>
                </TouchableOpacity>

                {/* Toggle particulier / entreprise */}
                <View style={[styles.tabToggle, isRTL && styles.tabToggleRTL]}>
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      donorType === 'particulier' && styles.tabBtnActive,
                    ]}
                    onPress={() => setDonorType('particulier')}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        donorType === 'particulier' && styles.tabBtnTextActive,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      👤 {language === 'ar' ? 'فرد' : 'Particulier'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      donorType === 'entreprise' && styles.tabBtnActive,
                    ]}
                    onPress={() => setDonorType('entreprise')}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        donorType === 'entreprise' && styles.tabBtnTextActive,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      🏢 {language === 'ar' ? 'شركة' : 'Entreprise'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Formulaire identite */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                    {language === 'ar'
                      ? '📝 معلومات المتبرع'
                      : '📝 Vos informations'}
                  </Text>

                  {donorType === 'particulier' ? (
                    <>
                      <Text
                        style={[styles.inputLabel, isRTL && styles.rtlText]}
                      >
                        {language === 'ar' ? 'الاسم الأول *' : 'Prenom *'}
                      </Text>
                      <TextInput
                        style={[styles.formInput, isRTL && styles.rtlText]}
                        placeholder={
                          language === 'ar' ? 'الاسم الأول' : 'Votre prenom'
                        }
                        placeholderTextColor={colors.textMuted}
                        value={donorFirstName}
                        onChangeText={setDonorFirstName}
                        autoCapitalize="words"
                      />

                      <Text
                        style={[styles.inputLabel, isRTL && styles.rtlText]}
                      >
                        {language === 'ar' ? 'اسم العائلة *' : 'Nom *'}
                      </Text>
                      <TextInput
                        style={[styles.formInput, isRTL && styles.rtlText]}
                        placeholder={
                          language === 'ar' ? 'اسم العائلة' : 'Votre nom'
                        }
                        placeholderTextColor={colors.textMuted}
                        value={donorLastName}
                        onChangeText={setDonorLastName}
                        autoCapitalize="words"
                      />
                    </>
                  ) : (
                    <>
                      <Text
                        style={[styles.inputLabel, isRTL && styles.rtlText]}
                      >
                        {language === 'ar'
                          ? 'اسم الشركة *'
                          : "Nom de l'entreprise *"}
                      </Text>
                      <TextInput
                        style={[styles.formInput, isRTL && styles.rtlText]}
                        placeholder={
                          language === 'ar' ? 'اسم الشركة' : 'Raison sociale'
                        }
                        placeholderTextColor={colors.textMuted}
                        value={donorCompanyName}
                        onChangeText={setDonorCompanyName}
                        autoCapitalize="words"
                      />

                      <Text
                        style={[styles.inputLabel, isRTL && styles.rtlText]}
                      >
                        {language === 'ar'
                          ? 'رقم SIRET (14 رقم) *'
                          : 'SIRET (14 chiffres) *'}
                      </Text>
                      <TextInput
                        style={[styles.formInput, isRTL && styles.rtlText]}
                        placeholder="123 456 789 00012"
                        placeholderTextColor={colors.textMuted}
                        value={donorSiret}
                        onChangeText={setDonorSiret}
                        keyboardType="numeric"
                        maxLength={17}
                      />

                      <Text
                        style={[styles.inputLabel, isRTL && styles.rtlText]}
                      >
                        {language === 'ar'
                          ? 'الممثل القانوني *'
                          : 'Representant legal *'}
                      </Text>
                      <TextInput
                        style={[styles.formInput, isRTL && styles.rtlText]}
                        placeholder={
                          language === 'ar' ? 'الاسم الكامل' : 'Nom et prenom'
                        }
                        placeholderTextColor={colors.textMuted}
                        value={donorLegalRep}
                        onChangeText={setDonorLegalRep}
                        autoCapitalize="words"
                      />
                    </>
                  )}

                  {/* Champs communs */}
                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                    {language === 'ar' ? 'البريد الإلكتروني *' : 'Email *'}
                  </Text>
                  <TextInput
                    style={[styles.formInput, isRTL && styles.rtlText]}
                    placeholder="email@exemple.com"
                    placeholderTextColor={colors.textMuted}
                    value={donorEmail}
                    onChangeText={setDonorEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                    {language === 'ar' ? 'العنوان *' : 'Adresse *'}
                  </Text>
                  <TextInput
                    style={[styles.formInput, isRTL && styles.rtlText]}
                    placeholder={
                      language === 'ar' ? 'رقم وشارع' : 'Numero et rue'
                    }
                    placeholderTextColor={colors.textMuted}
                    value={donorAddress}
                    onChangeText={setDonorAddress}
                  />

                  <View
                    style={[
                      styles.formRow,
                      isRTL && { flexDirection: 'row-reverse' },
                    ]}
                  >
                    <View style={styles.formHalf}>
                      <Text
                        style={[styles.inputLabel, isRTL && styles.rtlText]}
                      >
                        {language === 'ar'
                          ? 'الرمز البريدي *'
                          : 'Code postal *'}
                      </Text>
                      <TextInput
                        style={[styles.formInput, isRTL && styles.rtlText]}
                        placeholder="01000"
                        placeholderTextColor={colors.textMuted}
                        value={donorPostalCode}
                        onChangeText={setDonorPostalCode}
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                    <View style={styles.formHalf}>
                      <Text
                        style={[styles.inputLabel, isRTL && styles.rtlText]}
                      >
                        {language === 'ar' ? 'المدينة *' : 'Ville *'}
                      </Text>
                      <TextInput
                        style={[styles.formInput, isRTL && styles.rtlText]}
                        placeholder={language === 'ar' ? 'المدينة' : 'Ville'}
                        placeholderTextColor={colors.textMuted}
                        value={donorCity}
                        onChangeText={setDonorCity}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                </View>

                {/* Montant */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                    💰 {t('donationAmount')}
                  </Text>
                  <View style={styles.amountsGrid}>
                    {amounts.map(amount => (
                      <TouchableOpacity
                        key={amount}
                        style={[
                          styles.amountBtn,
                          selectedAmount === amount &&
                            !customAmount &&
                            styles.amountBtnSelected,
                        ]}
                        onPress={() => {
                          setSelectedAmount(amount);
                          setCustomAmount('');
                        }}
                      >
                        <Text
                          style={[
                            styles.amountBtnText,
                            selectedAmount === amount &&
                              !customAmount &&
                              styles.amountBtnTextSelected,
                          ]}
                        >
                          {amount}€
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text
                    style={[styles.customAmountLabel, isRTL && styles.rtlText]}
                  >
                    {t('customAmountLabel')}
                  </Text>
                  <View
                    style={[
                      styles.customAmountWrapper,
                      customAmount ? styles.customAmountWrapperActive : null,
                      isRTL && styles.customAmountWrapperRTL,
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.customAmountInput,
                        isRTL && styles.rtlText,
                      ]}
                      placeholder={t('otherAmount')}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={customAmount}
                      onChangeText={text => {
                        setCustomAmount(text);
                        setSelectedAmount(null);
                      }}
                    />
                    <Text style={styles.customAmountSuffix}>€</Text>
                  </View>
                </View>

                {/* Bouton payer */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    getFinalAmount() <= 0 && styles.primaryBtnDisabled,
                  ]}
                  onPress={() => {
                    if (getFinalAmount() <= 0) return;
                    if (!validateDonorForm()) return;
                    // Selectionner le premier projet interne disponible
                    const defaultProject = projects.filter(
                      p => !isProjectExternal(p),
                    )[0];
                    if (defaultProject) {
                      setSelectedProject(defaultProject.id);
                    }
                    setShowPaymentModal(true);
                  }}
                  disabled={getFinalAmount() <= 0}
                >
                  <Text
                    style={[styles.primaryBtnText, isRTL && styles.rtlText]}
                  >
                    💳{' '}
                    {language === 'ar'
                      ? 'متابعة الدفع'
                      : 'Continuer vers le paiement'}{' '}
                    {getFinalAmount() > 0 ? `${getFinalAmount()}€` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    if (!validateDonorForm()) return;
                    setShowRIBModal(true);
                  }}
                >
                  <Text
                    style={[styles.secondaryBtnText, isRTL && styles.rtlText]}
                  >
                    🏦 {t('bankTransfer')}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ========== PAGE 3 : PROJETS (existant) ========== */}
            {donPage === 'projets' && (
              <>
                {/* Bouton retour */}
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => {
                    setDonPage('choix');
                    setSelectedProject(null);
                  }}
                >
                  <Text style={styles.backBtnText}>
                    {isRTL ? '→' : '←'} {language === 'ar' ? 'رجوع' : 'Retour'}
                  </Text>
                </TouchableOpacity>

                {/* Toggle interne/externe */}
                <View style={[styles.tabToggle, isRTL && styles.tabToggleRTL]}>
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      projectType === 'interne' && styles.tabBtnActive,
                    ]}
                    onPress={() => {
                      setProjectType('interne');
                      setSelectedProject(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        projectType === 'interne' && styles.tabBtnTextActive,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      🕌 {t('ourMosque')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      projectType === 'externe' && styles.tabBtnActive,
                    ]}
                    onPress={() => {
                      setProjectType('externe');
                      setSelectedProject(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        projectType === 'externe' && styles.tabBtnTextActive,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      🌍 {t('otherCauses')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Projets */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                    {projectType === 'interne'
                      ? t('chooseProject')
                      : t('helpOtherCauses')}
                  </Text>
                  {displayProjects.length === 0 ? (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                      <Text
                        style={{
                          fontSize: 16,
                          color: '#666',
                          textAlign: 'center',
                        }}
                      >
                        {projectType === 'interne'
                          ? 'Aucun projet interne disponible pour le moment'
                          : 'Aucun projet externe disponible pour le moment'}
                      </Text>
                    </View>
                  ) : (
                    displayProjects.map(project => (
                      <TouchableOpacity
                        key={project.id}
                        style={[
                          styles.projectCard,
                          selectedProject === project.id &&
                            styles.projectCardSelected,
                        ]}
                        onPress={() => setSelectedProject(project.id)}
                      >
                        <View style={styles.projectHeader}>
                          <View style={styles.projectIcon}>
                            <Text style={styles.projectIconText}>
                              {project.icon}
                            </Text>
                          </View>
                          <View style={styles.projectInfo}>
                            {project.lieu && (
                              <Text style={styles.projectLieu}>
                                📍 {project.lieu}
                              </Text>
                            )}
                            <Text style={styles.projectName}>
                              {project.name}
                            </Text>
                          </View>
                          {selectedProject === project.id && (
                            <View style={styles.checkmark}>
                              <Text style={styles.checkmarkText}>✓</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${getProgress(
                                  project.raised,
                                  project.goal,
                                )}%`,
                              },
                            ]}
                          />
                        </View>
                        <View
                          style={[
                            styles.progressInfo,
                            isRTL && styles.progressInfoRTL,
                          ]}
                        >
                          <Text style={styles.progressRaised}>
                            {project.raised.toLocaleString()}€
                          </Text>
                          <Text style={styles.progressGoal}>
                            {t('goal')}: {project.goal.toLocaleString()}€
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.voirProjetBtn}
                          onPress={() => handleViewProjectDetails(project.id)}
                        >
                          <Text
                            style={[
                              styles.voirProjetBtnText,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            👁️ {t('viewDetails') || 'Voir details'}
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                {/* Montants - Uniquement pour projets internes */}
                {projectType === 'interne' && (
                  <View style={styles.section}>
                    <Text
                      style={[styles.sectionTitle, isRTL && styles.rtlText]}
                    >
                      💰 {t('donationAmount')}
                    </Text>
                    <View style={styles.amountsGrid}>
                      {amounts.map(amount => (
                        <TouchableOpacity
                          key={amount}
                          style={[
                            styles.amountBtn,
                            selectedAmount === amount &&
                              !customAmount &&
                              styles.amountBtnSelected,
                          ]}
                          onPress={() => {
                            setSelectedAmount(amount);
                            setCustomAmount('');
                          }}
                        >
                          <Text
                            style={[
                              styles.amountBtnText,
                              selectedAmount === amount &&
                                !customAmount &&
                                styles.amountBtnTextSelected,
                            ]}
                          >
                            {amount}€
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text
                      style={[
                        styles.customAmountLabel,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {t('customAmountLabel')}
                    </Text>
                    <View
                      style={[
                        styles.customAmountWrapper,
                        customAmount ? styles.customAmountWrapperActive : null,
                        isRTL && styles.customAmountWrapperRTL,
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.customAmountInput,
                          isRTL && styles.rtlText,
                        ]}
                        placeholder={t('otherAmount')}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        value={customAmount}
                        onChangeText={text => {
                          setCustomAmount(text);
                          setSelectedAmount(null);
                        }}
                      />
                      <Text style={styles.customAmountSuffix}>€</Text>
                    </View>
                  </View>
                )}

                {/* Message pour projets externes */}
                {projectType === 'externe' && selectedProject && (
                  <View style={styles.externalProjectMessage}>
                    <Text style={styles.externalProjectMessageIcon}>💸</Text>
                    <Text
                      style={[
                        styles.externalProjectMessageText,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL
                        ? `لدعم هذا المشروع، قم بالتحويل البنكي باستخدام IBAN المشروع ومرجع: "${
                            getSelectedProjectData()?.name
                          }"`
                        : `Pour soutenir ce projet, effectuez un virement avec l'IBAN du projet et la reference : "${
                            getSelectedProjectData()?.name
                          }"`}
                    </Text>
                  </View>
                )}

                {/* Message sélection projet */}
                {!selectedProject && (
                  <View style={styles.selectProjectHint}>
                    <Text style={styles.selectProjectHintIcon}>☝️</Text>
                    <Text
                      style={[
                        styles.selectProjectHintText,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL
                        ? 'يرجى اختيار مشروع قبل متابعة الدفع'
                        : 'Veuillez sélectionner un projet avant de poursuivre le paiement'}
                    </Text>
                  </View>
                )}

                {/* Boutons - Differents selon le type de projet */}
                {projectType === 'interne' ? (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        (!selectedProject || getFinalAmount() <= 0) &&
                          styles.primaryBtnDisabled,
                      ]}
                      onPress={() => setShowPaymentModal(true)}
                      disabled={!selectedProject || getFinalAmount() <= 0}
                    >
                      <Text
                        style={[styles.primaryBtnText, isRTL && styles.rtlText]}
                      >
                        💳 {t('payButton')}{' '}
                        {getFinalAmount() > 0 ? `${getFinalAmount()}€` : ''}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => setShowRIBModal(true)}
                    >
                      <Text
                        style={[
                          styles.secondaryBtnText,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        🏦 {t('bankTransfer')}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      !selectedProject && styles.primaryBtnDisabled,
                    ]}
                    onPress={() => setShowRIBModal(true)}
                    disabled={!selectedProject}
                  >
                    <Text
                      style={[styles.primaryBtnText, isRTL && styles.rtlText]}
                    >
                      🏦 {t('viewTransferInfo')}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.secondaryBtn, styles.zakatBtn]}
                  onPress={() => setShowZakatModal(true)}
                >
                  <Text
                    style={[
                      styles.secondaryBtnText,
                      styles.zakatBtnText,
                      isRTL && styles.rtlText,
                    ]}
                  >
                    🧮 {t('calculateZakat')}
                  </Text>
                </TouchableOpacity>

                {/* Moyens de paiement */}
                <View style={styles.paymentSection}>
                  <Text
                    style={[
                      styles.paymentSectionTitle,
                      isRTL && styles.rtlText,
                    ]}
                  >
                    {t('acceptedPayments')}
                  </Text>
                  {projectType === 'externe' ? (
                    <View>
                      <View style={styles.externalPaymentNotice}>
                        <Text style={styles.externalPaymentNoticeIcon}>⚠️</Text>
                        <Text
                          style={[
                            styles.externalPaymentNoticeText,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {t('externalTransferOnly')}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.paymentGrid,
                          { justifyContent: 'center' },
                        ]}
                      >
                        <View style={styles.paymentItem}>
                          <Text style={styles.paymentItemIcon}>🏦</Text>
                          <Text
                            style={[
                              styles.paymentItemText,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {t('bankTransfer')}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[styles.paymentNote, isRTL && styles.rtlText]}
                      >
                        {t('useProjectIban')}
                      </Text>
                    </View>
                  ) : (
                    <View>
                      <View style={styles.paymentGrid}>
                        <View style={styles.paymentItem}>
                          <Text style={styles.paymentItemIcon}>💳</Text>
                          <Text
                            style={[
                              styles.paymentItemText,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {t('creditCard')}
                          </Text>
                        </View>
                        <View style={styles.applePayButton}>
                          <Image
                            source={require('../assets/apple-logo.png')}
                            style={styles.appleLogo}
                          />
                          <Text style={styles.applePayText}>Pay</Text>
                        </View>
                        {Platform.OS !== 'ios' && (
                          <View style={styles.googlePayButton}>
                            <Image
                              source={require('../assets/google-logo.png')}
                              style={styles.googleLogo}
                            />
                            <Text style={styles.googlePayText}>Pay</Text>
                          </View>
                        )}
                        <View style={styles.paymentItem}>
                          <Text style={styles.paymentItemIcon}>🏦</Text>
                          <Text
                            style={[
                              styles.paymentItemText,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {t('bankTransfer')}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[styles.paymentNote, isRTL && styles.rtlText]}
                      >
                        {t('onlinePaymentSoon')}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.disclaimer, isRTL && styles.rtlText]}>
                  {t('donationDisclaimer')}
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal RIB */}
      <Modal visible={showRIBModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowRIBModal(false)}
            >
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              🏦 {t('bankTransferTitle')}
            </Text>

            {/* Si projet externe sélectionné : afficher UNIQUEMENT le RIB du projet */}
            {(() => {
              const selectedProjectData = getSelectedProjectData();
              const isExternal =
                selectedProjectData &&
                (projectType === 'externe' ||
                  isProjectExternal(selectedProjectData));
              return isExternal && selectedProjectData?.iban;
            })() ? (
              <View style={styles.ribCard}>
                <View style={styles.ribHeader}>
                  <Text style={styles.ribIcon}>
                    {getSelectedProjectData()?.icon || '🌍'}
                  </Text>
                  <Text style={[styles.ribTitulaire, isRTL && styles.rtlText]}>
                    {getSelectedProjectData()?.name}
                  </Text>
                  {getSelectedProjectData()?.lieu && (
                    <Text style={[styles.ribBanque, isRTL && styles.rtlText]}>
                      📍 {getSelectedProjectData()?.lieu}
                    </Text>
                  )}
                </View>

                <View
                  style={[
                    styles.ribRow,
                    styles.ribRowLast,
                    isRTL && styles.ribRowRTL,
                  ]}
                >
                  <View style={styles.ribValueContainer}>
                    <Text style={[styles.ribLabel, isRTL && styles.rtlText]}>
                      IBAN
                    </Text>
                    <Text
                      style={styles.ribValue}
                      adjustsFontSizeToFit={true}
                      numberOfLines={1}
                      minimumFontScale={0.7}
                    >
                      {getSelectedProjectData()?.iban}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() =>
                      copyToClipboard(
                        getSelectedProjectData()?.iban || '',
                        'iban-externe',
                      )
                    }
                    accessibilityLabel="Copier l'IBAN du projet"
                    accessibilityRole="button"
                    accessibilityHint="Copie l'IBAN dans le presse-papier"
                  >
                    <Text style={styles.copyBtnText}>
                      {copied === 'iban-externe' ? '✓' : '📋'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text
                  style={[styles.externalProjectNote, isRTL && styles.rtlText]}
                >
                  ⚠️ {t('externalProjectNote')}
                </Text>
              </View>
            ) : (
              /* Projet interne ou aucun projet : afficher le RIB de la mosquée */
              <View style={styles.ribCard}>
                <View style={styles.ribHeader}>
                  <Text style={styles.ribIcon}>🕌</Text>
                  <Text style={[styles.ribTitulaire, isRTL && styles.rtlText]}>
                    {mosqueeInfo?.accountHolder || 'Association El Mohsinine'}
                  </Text>
                  <Text style={[styles.ribBanque, isRTL && styles.rtlText]}>
                    {mosqueeInfo?.bankName || 'Crédit Agricole'}
                  </Text>
                </View>

                <View style={[styles.ribRow, isRTL && styles.ribRowRTL]}>
                  <View style={styles.ribValueContainer}>
                    <Text style={[styles.ribLabel, isRTL && styles.rtlText]}>
                      IBAN
                    </Text>
                    <Text
                      style={styles.ribValue}
                      adjustsFontSizeToFit={true}
                      numberOfLines={1}
                      minimumFontScale={0.7}
                    >
                      {mosqueeInfo?.iban || 'IBAN indisponible'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() =>
                      mosqueeInfo?.iban
                        ? copyToClipboard(mosqueeInfo.iban, 'iban')
                        : null
                    }
                    accessibilityLabel="Copier l'IBAN de la mosquée"
                    accessibilityRole="button"
                    accessibilityHint="Copie l'IBAN dans le presse-papier"
                  >
                    <Text style={styles.copyBtnText}>
                      {copied === 'iban' ? '✓' : '📋'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.ribRow, isRTL && styles.ribRowRTL]}>
                  <View>
                    <Text style={[styles.ribLabel, isRTL && styles.rtlText]}>
                      BIC
                    </Text>
                    <Text style={styles.ribValue}>
                      {mosqueeInfo?.bic || 'AGRIFRPP'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() =>
                      copyToClipboard(mosqueeInfo?.bic || 'AGRIFRPP', 'bic')
                    }
                    accessibilityLabel="Copier le code BIC"
                    accessibilityRole="button"
                    accessibilityHint="Copie le code BIC dans le presse-papier"
                  >
                    <Text style={styles.copyBtnText}>
                      {copied === 'bic' ? '✓' : '📋'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Référence virement */}
                <View
                  style={[
                    styles.ribRow,
                    styles.ribRowLast,
                    isRTL && styles.ribRowRTL,
                  ]}
                >
                  <View>
                    <Text style={[styles.ribLabel, isRTL && styles.rtlText]}>
                      {t('transferReference')}
                    </Text>
                    <Text style={[styles.ribValue, styles.referenceValue]}>
                      {transferReference}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() =>
                      copyToClipboard(transferReference, 'reference')
                    }
                    accessibilityLabel={t('transferReference') as string}
                    accessibilityRole="button"
                    accessibilityHint="Copie la référence dans le presse-papier"
                  >
                    <Text style={styles.copyBtnText}>
                      {copied === 'reference' ? '✓' : '📋'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Paiement */}
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowPaymentModal(false)}
            >
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              💳 {t('donationOf')} {getFinalAmount()}€
            </Text>

            {getSelectedProjectData() && (
              <View
                style={[
                  styles.paymentProjectInfo,
                  isRTL && styles.paymentProjectInfoRTL,
                ]}
              >
                <Text style={styles.paymentProjectIcon}>
                  {getSelectedProjectData()?.icon}
                </Text>
                <View>
                  <Text
                    style={[styles.paymentProjectName, isRTL && styles.rtlText]}
                  >
                    {getSelectedProjectData()?.name}
                  </Text>
                  {getSelectedProjectData()?.lieu && (
                    <Text
                      style={[
                        styles.paymentProjectLieu,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      📍 {getSelectedProjectData()?.lieu}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Si projet externe : uniquement virement */}
            {(() => {
              const selectedProjectData = getSelectedProjectData();
              const isExternal =
                selectedProjectData &&
                (projectType === 'externe' ||
                  isProjectExternal(selectedProjectData));

              if (isExternal) {
                // Projets externes : virement uniquement
                return (
                  <View>
                    <View style={styles.externalPaymentNotice}>
                      <Text style={styles.externalPaymentNoticeIcon}>⚠️</Text>
                      <Text
                        style={[
                          styles.externalPaymentNoticeText,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {t('externalTransferOnly')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.paymentOption,
                        paymentMethod === 'virement' &&
                          styles.paymentOptionSelected,
                        isRTL && styles.paymentOptionRTL,
                      ]}
                      onPress={() => setPaymentMethod('virement')}
                    >
                      <Text style={styles.paymentIcon}>🏦</Text>
                      <View style={styles.paymentInfo}>
                        <Text
                          style={[styles.paymentTitle, isRTL && styles.rtlText]}
                        >
                          {t('bankTransfer')}
                        </Text>
                        <Text
                          style={[styles.paymentDesc, isRTL && styles.rtlText]}
                        >
                          {t('useProjectIban')}
                        </Text>
                      </View>
                      {paymentMethod === 'virement' && (
                        <View style={styles.checkmark}>
                          <Text style={styles.checkmarkText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }

              // Projets internes : CB + Apple Pay si disponible
              const paymentMethods =
                Platform.OS === 'ios'
                  ? ['card', ...(isApplePayAvailable ? ['apple'] : [])]
                  : ['card'];
              return paymentMethods.map(method => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.paymentOption,
                    paymentMethod === method && styles.paymentOptionSelected,
                    isRTL && styles.paymentOptionRTL,
                  ]}
                  onPress={() => setPaymentMethod(method)}
                >
                  {method === 'card' ? (
                    <Text style={styles.paymentIcon}>💳</Text>
                  ) : method === 'apple' ? (
                    <Image
                      source={require('../assets/apple-logo.png')}
                      style={styles.paymentLogoIcon}
                    />
                  ) : (
                    <Image
                      source={require('../assets/google-logo.png')}
                      style={styles.paymentLogoIcon}
                    />
                  )}
                  <View style={styles.paymentInfo}>
                    <Text
                      style={[styles.paymentTitle, isRTL && styles.rtlText]}
                    >
                      {method === 'card'
                        ? t('cardPayment')
                        : method === 'apple'
                        ? 'Apple Pay'
                        : 'Google Pay'}
                    </Text>
                    <Text style={[styles.paymentDesc, isRTL && styles.rtlText]}>
                      {method === 'card'
                        ? t('visaMastercard')
                        : t('fastSecurePayment')}
                    </Text>
                  </View>
                  {paymentMethod === method && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ));
            })()}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { marginTop: 20 },
                (!paymentMethod || isProcessingPayment) &&
                  styles.primaryBtnDisabled,
              ]}
              onPress={handlePayment}
              disabled={!paymentMethod || isProcessingPayment}
            >
              {isProcessingPayment ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.primaryBtnText, isRTL && styles.rtlText]}>
                  🔒 {t('payButton')} {getFinalAmount()}€
                </Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.modalDisclaimer, isRTL && styles.rtlText]}>
              {t('securePayment')}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Modal Fichiers du projet */}
      <Modal visible={showFilesModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowFilesModal(false)}
            >
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              📁 {selectedProjectName}
            </Text>
            <Text style={[styles.filesSubtitle, isRTL && styles.rtlText]}>
              {t('projectDocuments')}
            </Text>

            {selectedProjectFiles.map(fichier => (
              <TouchableOpacity
                key={fichier.id}
                style={[styles.fichierItem, isRTL && styles.fichierItemRTL]}
                onPress={async () => {
                  if (fichier.url) {
                    if (__DEV__)
                      console.log('[Fichier] Ouverture URL:', fichier.url);
                    try {
                      const canOpen = await Linking.canOpenURL(fichier.url);
                      if (canOpen) {
                        await Linking.openURL(fichier.url);
                      } else {
                        Alert.alert(
                          t('error') as string,
                          t('cannotOpenFile') as string,
                        );
                      }
                    } catch (err: any) {
                      if (__DEV__)
                        console.error('Erreur ouverture fichier:', err);
                      Alert.alert(
                        t('error') as string,
                        t('cannotOpenFile') as string,
                      );
                    }
                  } else {
                    Alert.alert(
                      t('error') as string,
                      t('cannotOpenFile') as string,
                    );
                  }
                }}
              >
                <Text style={styles.fichierIcon}>
                  {fichier.type === 'pdf'
                    ? '📄'
                    : fichier.type === 'image'
                    ? '🖼️'
                    : '📎'}
                </Text>
                <View style={styles.fichierInfo}>
                  <Text style={[styles.fichierNom, isRTL && styles.rtlText]}>
                    {fichier.nom}
                  </Text>
                  <Text style={[styles.fichierType, isRTL && styles.rtlText]}>
                    {fichier.type.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.fichierArrow}>{isRTL ? '←' : '→'}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setShowFilesModal(false)}
            >
              <Text style={[styles.secondaryBtnText, isRTL && styles.rtlText]}>
                {t('close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Zakat — même pattern que les autres modaux + KAV pour le clavier */}
      <Modal visible={showZakatModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.zakatModalContainer}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                <View style={styles.zakatModalContent}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setShowZakatModal(false)}
                  >
                    <Text style={styles.closeBtnText}>×</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                    🧮 {t('zakatCalculator')}
                  </Text>

                  <View style={styles.nisabInfo}>
                    <Text style={[styles.nisabText, isRTL && styles.rtlText]}>
                      <Text style={styles.nisabBold}>
                        📌 {t('currentNisab')} :{' '}
                      </Text>
                      ~{nisab.toLocaleString()}€
                    </Text>
                    <Text
                      style={[styles.nisabSubtext, isRTL && styles.rtlText]}
                    >
                      {language === 'ar'
                        ? `(قيمة 85 غرام ذهب بسعر ${goldPrice}€/غ)`
                        : `(Valeur de 85g d'or à ${goldPrice}€/g)`}
                    </Text>
                    <View
                      style={[
                        styles.goldPriceIndicator,
                        isGoldPriceRealTime
                          ? styles.goldPriceRealTime
                          : styles.goldPriceApprox,
                      ]}
                    >
                      <Text
                        style={[
                          styles.goldPriceIndicatorText,
                          isGoldPriceRealTime
                            ? styles.goldPriceRealTimeText
                            : styles.goldPriceApproxText,
                        ]}
                      >
                        {isGoldPriceRealTime
                          ? language === 'ar'
                            ? '✓ سعر الذهب في الوقت الفعلي'
                            : "✓ Cours de l'or en temps réel"
                          : language === 'ar'
                          ? '⚠️ سعر تقريبي'
                          : '⚠️ Cours approximatif'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                    💰 {t('savingsLabel')}
                  </Text>
                  <TextInput
                    style={[styles.zakatInput, isRTL && styles.rtlText]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={zakatEpargne}
                    onChangeText={setZakatEpargne}
                  />

                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                    🥇 {t('goldValueLabel')}
                  </Text>
                  <TextInput
                    style={[styles.zakatInput, isRTL && styles.rtlText]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={zakatOr}
                    onChangeText={setZakatOr}
                  />

                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                    📈 {t('investmentsLabel')}
                  </Text>
                  <TextInput
                    style={[styles.zakatInput, isRTL && styles.rtlText]}
                    placeholder={
                      language === 'ar'
                        ? 'أسهم، عقارات...'
                        : 'Actions, SCPI, parts...'
                    }
                    keyboardType="numeric"
                    value={zakatInvestissements}
                    onChangeText={setZakatInvestissements}
                  />

                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                    💵 {t('cashValueLabel')}
                  </Text>
                  <TextInput
                    style={[styles.zakatInput, isRTL && styles.rtlText]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={zakatCash}
                    onChangeText={setZakatCash}
                  />

                  <View
                    style={[
                      styles.zakatResult,
                      isZakatEligible && styles.zakatResultEligible,
                    ]}
                  >
                    <Text
                      style={[styles.zakatTotalLabel, isRTL && styles.rtlText]}
                    >
                      {t('totalAssets')} : {totalWealth.toLocaleString()}€
                    </Text>
                    {isZakatEligible ? (
                      <>
                        <Text
                          style={[
                            styles.zakatEligibleText,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          ✓ {t('zakatEligible')}
                        </Text>
                        <Text style={styles.zakatAmountText}>
                          {zakatAmount.toFixed(2)}€
                        </Text>
                        <Text
                          style={[styles.zakatPercent, isRTL && styles.rtlText]}
                        >
                          {t('ofYourAssets')}
                        </Text>
                      </>
                    ) : (
                      <Text
                        style={[
                          styles.zakatNotEligible,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {t('zakatNotEligible')}
                      </Text>
                    )}
                  </View>

                  {isZakatEligible && (
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => {
                        const zakatInt = Math.ceil(zakatAmount);
                        setSelectedAmount(null);
                        setCustomAmount(String(zakatInt));
                        setShowZakatModal(false);
                        setDonPage('formulaire');
                      }}
                    >
                      <Text
                        style={[styles.primaryBtnText, isRTL && styles.rtlText]}
                      >
                        💝 {t('giveMyZakat')} ({zakatAmount.toFixed(0)}€)
                      </Text>
                    </TouchableOpacity>
                  )}

                  <Text
                    style={[styles.modalDisclaimer, isRTL && styles.rtlText]}
                  >
                    {t('zakatDisclaimer')}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Détails du projet */}
      <Modal visible={showProjectDetailModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowProjectDetailModal(false)}
              >
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>

              {detailProject && (
                <>
                  {/* Header du projet */}
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailIcon}>{detailProject.icon}</Text>
                    <Text style={[styles.detailTitle, isRTL && styles.rtlText]}>
                      {detailProject.name}
                    </Text>
                    {detailProject.lieu && (
                      <Text
                        style={[styles.detailLieu, isRTL && styles.rtlText]}
                      >
                        📍 {detailProject.lieu}
                      </Text>
                    )}
                  </View>

                  {/* Description complète */}
                  <View style={styles.detailSection}>
                    <Text
                      style={[
                        styles.detailDescription,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {detailProject.description}
                    </Text>
                  </View>

                  {/* Stats du projet */}
                  <View style={styles.detailStats}>
                    <View
                      style={[
                        styles.detailStatRow,
                        isRTL && styles.detailStatRowRTL,
                      ]}
                    >
                      <Text style={styles.detailStatIcon}>💰</Text>
                      <Text
                        style={[
                          styles.detailStatLabel,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {t('goal') || 'Objectif'}
                      </Text>
                      <Text style={styles.detailStatValue}>
                        {detailProject.goal.toLocaleString()}€
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.detailStatRow,
                        isRTL && styles.detailStatRowRTL,
                      ]}
                    >
                      <Text style={styles.detailStatIcon}>✅</Text>
                      <Text
                        style={[
                          styles.detailStatLabel,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {t('collected') || 'Collecté'}
                      </Text>
                      <Text
                        style={[
                          styles.detailStatValue,
                          styles.detailStatValueSuccess,
                        ]}
                      >
                        {detailProject.raised.toLocaleString()}€
                      </Text>
                    </View>

                    {/* Barre de progression */}
                    <View style={styles.detailProgressContainer}>
                      <View style={styles.detailProgressBar}>
                        <View
                          style={[
                            styles.detailProgressFill,
                            {
                              width: `${getProgress(
                                detailProject.raised,
                                detailProject.goal,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.detailProgressPercent}>
                        {Math.round(
                          getProgress(detailProject.raised, detailProject.goal),
                        )}
                        %
                      </Text>
                    </View>

                    {/* Montant restant */}
                    <Text
                      style={[styles.detailRemaining, isRTL && styles.rtlText]}
                    >
                      🎯 {t('remaining') || 'Reste à collecter'}:{' '}
                      {Math.max(
                        0,
                        detailProject.goal - detailProject.raised,
                      ).toLocaleString()}
                      €
                    </Text>
                  </View>

                  {/* Fichiers/Documents si disponibles */}
                  {detailProject.fichiers &&
                    detailProject.fichiers.length > 0 && (
                      <View style={styles.detailFilesSection}>
                        <Text
                          style={[
                            styles.detailFilesTitle,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          📁 {t('projectDocuments') || 'Documents du projet'}
                        </Text>
                        {detailProject.fichiers.map(fichier => (
                          <TouchableOpacity
                            key={fichier.id}
                            style={[
                              styles.fichierItem,
                              isRTL && styles.fichierItemRTL,
                            ]}
                            onPress={async () => {
                              if (fichier.url) {
                                if (__DEV__)
                                  console.log(
                                    '[Fichier] Ouverture URL:',
                                    fichier.url,
                                  );
                                try {
                                  const canOpen = await Linking.canOpenURL(
                                    fichier.url,
                                  );
                                  if (canOpen) {
                                    await Linking.openURL(fichier.url);
                                  } else {
                                    Alert.alert(
                                      t('error') as string,
                                      t('cannotOpenFile') as string,
                                    );
                                  }
                                } catch (err: any) {
                                  if (__DEV__)
                                    console.error(
                                      'Erreur ouverture fichier:',
                                      err,
                                    );
                                  Alert.alert(
                                    t('error') as string,
                                    t('cannotOpenFile') as string,
                                  );
                                }
                              } else {
                                Alert.alert(
                                  t('error') as string,
                                  t('cannotOpenFile') as string,
                                );
                              }
                            }}
                          >
                            <Text style={styles.fichierIcon}>
                              {fichier.type === 'pdf'
                                ? '📄'
                                : fichier.type === 'image'
                                ? '🖼️'
                                : '📎'}
                            </Text>
                            <View style={styles.fichierInfo}>
                              <Text
                                style={[
                                  styles.fichierNom,
                                  isRTL && styles.rtlText,
                                ]}
                              >
                                {fichier.nom}
                              </Text>
                              <Text
                                style={[
                                  styles.fichierType,
                                  isRTL && styles.rtlText,
                                ]}
                              >
                                {fichier.type.toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.fichierArrow}>
                              {isRTL ? '←' : '→'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                  {/* IBAN pour projets externes */}
                  {detailProject.isExternal && detailProject.iban && (
                    <View style={styles.detailIbanSection}>
                      <Text
                        style={[
                          styles.detailIbanTitle,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        🏦 {t('bankTransfer') || 'Virement bancaire'}
                      </Text>
                      <View style={[styles.ribRow, isRTL && styles.ribRowRTL]}>
                        <View>
                          <Text
                            style={[styles.ribLabel, isRTL && styles.rtlText]}
                          >
                            IBAN
                          </Text>
                          <Text style={styles.ribValue}>
                            {detailProject.iban}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() =>
                            copyToClipboard(detailProject.iban!, 'detail-iban')
                          }
                          accessibilityLabel="Copier l'IBAN du projet"
                          accessibilityRole="button"
                          accessibilityHint="Copie l'IBAN dans le presse-papier"
                        >
                          <Text style={styles.copyBtnText}>
                            {copied === 'detail-iban' ? '✓' : '📋'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Bouton Faire un don */}
                  <TouchableOpacity
                    style={styles.detailDonateBtn}
                    onPress={() => {
                      setSelectedProject(detailProject.id);
                      setShowProjectDetailModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.detailDonateBtnText,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      💝 {t('donateToProject') || 'Faire un don à ce projet'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setShowProjectDetailModal(false)}
                  >
                    <Text
                      style={[styles.secondaryBtnText, isRTL && styles.rtlText]}
                    >
                      {t('close') || 'Fermer'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </BackgroundPattern>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: HEADER_PADDING_TOP,
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
    color: colors.textSecondary,
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
    color: colors.text,
    marginBottom: spacing.md,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: '#e8e8ed',
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.xl,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabBtnTextActive: {
    color: colors.accent,
  },
  projectCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  projectCardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(201,162,39,0.08)',
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  projectIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: '#f0f0f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  projectIconText: {
    fontSize: 24,
  },
  projectInfo: {
    flex: 1,
  },
  projectLieu: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: 2,
  },
  projectName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  projectDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
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
  progressBar: {
    height: 6,
    backgroundColor: '#e8e8ed',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressRaised: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontWeight: '600',
  },
  progressGoal: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  amountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.lg,
  },
  amountBtn: {
    width: '31%',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  amountBtnSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(201,162,39,0.1)',
  },
  amountBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  amountBtnTextSelected: {
    color: colors.accent,
  },
  customAmountLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  customAmountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f5',
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  customAmountWrapperActive: {
    borderColor: colors.accent,
  },
  customAmountInput: {
    flex: 1,
    padding: spacing.lg,
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
  },
  customAmountSuffix: {
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.accent,
  },
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
  zakatBtn: {
    borderColor: colors.success,
  },
  zakatBtnText: {
    color: colors.success,
  },
  receiptInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '12',
    borderWidth: 1,
    borderColor: colors.accent + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  receiptInfoIcon: {
    fontSize: moderateScale(28),
  },
  receiptInfoTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 2,
  },
  receiptInfoDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  disclaimer: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalScrollContent: {
    flex: 1,
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
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
  // RIB styles
  ribCard: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  ribHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  ribIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  ribTitulaire: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.accent,
  },
  ribBanque: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  ribRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  ribRowLast: {
    borderBottomWidth: 0,
  },
  ribLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ribValueContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  ribValue: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  referenceValue: {
    color: colors.accent,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  copyBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  copyBtnText: {
    fontSize: fontSize.sm,
    color: '#ffffff',
    fontWeight: '600',
  },
  externalProjectNote: {
    fontSize: fontSize.xs,
    color: '#E65100',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  // Payment options
  paymentProjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  paymentProjectIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  paymentProjectName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  paymentProjectLieu: {
    fontSize: fontSize.xs,
    color: colors.accent,
  },
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
  // Zakat modal
  zakatModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 380,
    maxHeight: Dimensions.get('window').height * 0.85,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  zakatModalContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  // Zakat
  nisabInfo: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  nisabText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  nisabBold: {
    fontWeight: 'bold',
    color: colors.text,
  },
  nisabSubtext: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  goldPriceIndicator: {
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  goldPriceRealTime: {
    backgroundColor: 'rgba(39,174,96,0.15)',
  },
  goldPriceApprox: {
    backgroundColor: 'rgba(230,126,34,0.15)',
  },
  goldPriceIndicatorText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  goldPriceRealTimeText: {
    color: colors.success,
  },
  goldPriceApproxText: {
    color: '#E67E22',
  },
  inputLabel: {
    fontSize: isSmallScreen ? moderateScale(13) : moderateScale(14),
    color: colors.textSecondary,
    marginBottom: 4,
  },
  zakatInput: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: isSmallScreen ? fontSize.md : fontSize.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    width: '100%' as any,
  },
  zakatResult: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  zakatResultEligible: {
    backgroundColor: 'rgba(39,174,96,0.1)',
    borderColor: 'rgba(39,174,96,0.2)',
  },
  zakatTotalLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 4,
  },
  zakatEligibleText: {
    fontSize: fontSize.md,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  zakatAmountText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.success,
  },
  zakatPercent: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  zakatNotEligible: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Voir projet styles
  voirProjetBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  voirProjetBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.accent,
  },
  filesSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  fichierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  fichierIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  fichierInfo: {
    flex: 1,
  },
  fichierNom: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  fichierType: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  fichierArrow: {
    fontSize: fontSize.lg,
    color: colors.accent,
  },
  // RTL Styles
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tabToggleRTL: {
    flexDirection: 'row-reverse',
  },
  progressInfoRTL: {
    flexDirection: 'row-reverse',
  },
  customAmountWrapperRTL: {
    flexDirection: 'row-reverse',
  },
  ribRowRTL: {
    flexDirection: 'row-reverse',
  },
  paymentProjectInfoRTL: {
    flexDirection: 'row-reverse',
  },
  paymentOptionRTL: {
    flexDirection: 'row-reverse',
  },
  fichierItemRTL: {
    flexDirection: 'row-reverse',
  },
  // Payment methods section
  paymentSection: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  paymentSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  paymentItem: {
    width: '48%',
    backgroundColor: 'rgba(201,162,39,0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paymentItemIcon: {
    fontSize: 20,
  },
  paymentItemText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  applePayButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  applePayText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appleLogo: {
    width: 20,
    height: 24,
    marginRight: 8,
    tintColor: '#FFFFFF',
  },
  applePayLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#333333',
  },
  googlePayButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  googlePayText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3C4043',
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  paymentLogoIcon: {
    width: 24,
    height: 24,
    marginRight: spacing.md,
  },
  paymentNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  // Detail Modal styles
  detailHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  detailIcon: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  detailTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
  },
  detailLieu: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  detailSection: {
    marginBottom: spacing.xl,
  },
  detailDescription: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  detailStats: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  detailStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  detailStatRowRTL: {
    flexDirection: 'row-reverse',
  },
  detailStatIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  detailStatLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  detailStatValue: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  detailStatValueSuccess: {
    color: colors.success,
  },
  detailProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  detailProgressBar: {
    flex: 1,
    height: 12,
    backgroundColor: '#e8e8ed',
    borderRadius: 6,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  detailProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 6,
  },
  detailProgressPercent: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.accent,
    minWidth: 50,
    textAlign: 'right',
  },
  detailRemaining: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  detailFilesSection: {
    marginBottom: spacing.xl,
  },
  detailFilesTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  detailIbanSection: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  detailIbanTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  detailDonateBtn: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  detailDonateBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  // External project message (in main page)
  selectProjectHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.10)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  selectProjectHintIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  selectProjectHintText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  externalProjectMessage: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  externalProjectMessageIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  externalProjectMessageText: {
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  // External payment notice
  externalPaymentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(230,81,0,0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(230,81,0,0.3)',
  },
  externalPaymentNoticeIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  externalPaymentNoticeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#E65100',
    fontWeight: '500',
  },
  // PAGE 1 : Choix type de don
  donChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  donChoiceIcon: {
    fontSize: 36,
    marginRight: spacing.md,
  },
  donChoiceInfo: {
    flex: 1,
  },
  donChoiceTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  donChoiceDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  donChoiceArrow: {
    fontSize: fontSize.xxl,
    color: colors.accent,
    fontWeight: '300',
  },
  // PAGE 2 : Formulaire identite
  backBtn: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtnText: {
    fontSize: fontSize.lg,
    color: colors.accent,
    fontWeight: '600',
  },
  formInput: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  formHalf: {
    flex: 1,
  },
});

export default DonationsScreen;
