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
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, platformShadow, isSmallScreen } from '../theme/colors';
import {
  subscribeToCotisationPrices,
  CotisationPrices,
  addPayment,
  getMosqueeInfo,
  MosqueeInfo,
  createMember,
  getMembersInscribedBy,
  InscribedMember,
} from '../services/firebase';
import { AuthService, MemberProfile } from '../services/auth';
import { makePayment, showPaymentError, showPaymentSuccess } from '../services/stripe';
import { subscribeToMembersTopic, saveFCMTokenToFirestore } from '../services/notifications';
import { useLanguage } from '../context/LanguageContext';
import MemberCard from '../components/MemberCard';
import MemberCardFullScreen from '../components/MemberCardFullScreen';

// ============================================================
// MEMBER SCREEN - Refonte UX épurée
// Flow: Connexion → Paiement → Carte de membre
// ============================================================

const MemberScreen = () => {
  const navigation = useNavigation<any>();
  const { t, isRTL } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();

  // États principaux
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [inscribedMembers, setInscribedMembers] = useState<InscribedMember[]>([]);

  // Prix et infos
  const [formulePrices, setFormulePrices] = useState<CotisationPrices>({ mensuel: 10, annuel: 100 });
  const [mosqueeInfo, setMosqueeInfo] = useState<MosqueeInfo | null>(null);

  // Modales
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCardFullScreen, setShowCardFullScreen] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);

  // Formulaire connexion
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerNom, setRegisterNom] = useState('');
  const [registerPrenom, setRegisterPrenom] = useState('');
  const [registerTelephone, setRegisterTelephone] = useState('');
  const [registerAdresse, setRegisterAdresse] = useState('');
  const [registerGenre, setRegisterGenre] = useState<'homme' | 'femme' | ''>('');
  const [registerDateNaissance, setRegisterDateNaissance] = useState('');
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Paiement
  const [selectedFormule, setSelectedFormule] = useState<'mensuel' | 'annuel'>('annuel');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Famille
  const [familyMembers, setFamilyMembers] = useState<{id: string; nom: string; prenom: string; telephone: string; adresse: string; genre: 'homme' | 'femme' | ''; dateNaissance: string; accepte: boolean}[]>([]);
  const [familyFormule, setFamilyFormule] = useState<'mensuel' | 'annuel'>('annuel');

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async (user) => {
      setIsLoading(true);
      if (user) {
        setIsLoggedIn(true);
        await loadMemberData(user.uid);
      } else {
        setIsLoggedIn(false);
        setMemberProfile(null);
        setIsPaid(false);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCotisationPrices(setFormulePrices);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    getMosqueeInfo().then(setMosqueeInfo);
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
        console.log('Error checking first visit:', error);
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
      } else if (retryCount < MAX_RETRIES) {
        // Race condition: le document Firestore n'est peut-être pas encore créé
        // Attendre et réessayer
        await new Promise<void>(resolve => setTimeout(() => resolve(), RETRY_DELAY));
        return loadMemberData(uid, retryCount + 1);
      }
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), RETRY_DELAY));
        return loadMemberData(uid, retryCount + 1);
      }
      console.error('Error loading member data:', error);
    }
  };

  // ============================================================
  // AUTH HANDLERS
  // ============================================================

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setAuthLoading(true);
    try {
      await AuthService.signIn(loginEmail.trim(), loginPassword);
      setShowLoginModal(false);
      resetLoginForm();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Échec de la connexion');
    } finally {
      setAuthLoading(false);
    }
  };

  // Fonction pour vérifier si la personne est majeure
  const isAdult = (dateNaissance: string): boolean => {
    const parts = dateNaissance.split('/');
    if (parts.length !== 3) return false;
    const birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

  const handleRegister = async () => {
    // Validation
    if (!registerNom.trim() || !registerPrenom.trim() || !registerTelephone.trim() ||
        !registerAdresse.trim() || !loginEmail.trim() || !loginPassword.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (!registerGenre) {
      Alert.alert('Erreur', 'Veuillez sélectionner votre genre');
      return;
    }

    if (!registerDateNaissance.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre date de naissance');
      return;
    }

    // Vérification de la majorité
    if (!isAdult(registerDateNaissance)) {
      Alert.alert(
        'Inscription impossible',
        'Vous devez être majeur (18 ans ou plus) pour devenir membre de l\'association. Merci de votre compréhension.'
      );
      return;
    }

    if (!acceptedRules) {
      Alert.alert('Erreur', 'Veuillez accepter le règlement intérieur');
      return;
    }

    if (loginPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setAuthLoading(true);
    try {
      await AuthService.signUp(
        loginEmail.trim(),
        loginPassword,
        `${registerPrenom.trim()} ${registerNom.trim()}`,
        registerTelephone.trim(),
        registerAdresse.trim(),
        registerGenre,
        registerDateNaissance
      );
      setShowLoginModal(false);
      resetLoginForm();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Échec de la création du compte');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre email');
      return;
    }

    setAuthLoading(true);
    try {
      await AuthService.resetPassword(forgotEmail.trim());
      Alert.alert('Email envoyé', 'Vérifiez votre boîte mail pour réinitialiser votre mot de passe');
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t('logout'),
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            await AuthService.signOut();
          },
        },
      ]
    );
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
    if (isProcessingPayment || !memberProfile) return;

    const amount = formulePrices[selectedFormule];

    if (method === 'virement') {
      const reference = `ADH-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      Alert.alert(
        '🏦 Virement bancaire',
        `IBAN: ${mosqueeInfo?.iban || 'FR76 XXXX XXXX XXXX'}\nBIC: ${mosqueeInfo?.bic || 'XXXXXXXX'}\n\nMontant: ${amount}€\nRéférence: ${reference}\n\nImportant: Indiquez la référence dans le motif du virement.`,
        [{ text: 'Compris', style: 'default' }]
      );
      setShowPaymentModal(false);
      return;
    }

    setIsProcessingPayment(true);
    try {
      const paymentResult = await makePayment({
        amount,
        description: `Cotisation ${selectedFormule} - El Mouhssinine`,
        type: 'cotisation',
        metadata: {
          memberId: memberProfile.memberId || '',
          memberName: memberProfile.name,
          period: selectedFormule,
        },
      });

      if (paymentResult.success && paymentResult.paymentIntentId) {
        await addPayment({
          memberId: memberProfile.memberId || '',
          memberName: memberProfile.name,
          amount,
          stripePaymentIntentId: paymentResult.paymentIntentId,
          paymentMethod: method === 'apple' ? 'Apple Pay' : 'CB',
          period: selectedFormule,
        });

        showPaymentSuccess('cotisation');
        setShowPaymentModal(false);

        // Recharger les données
        const user = AuthService.getCurrentUser();
        if (user) await loadMemberData(user.uid);
      }
    } catch (error: any) {
      showPaymentError(error.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ============================================================
  // FAMILY HANDLERS
  // ============================================================

  const addFamilyMember = () => {
    setFamilyMembers([...familyMembers, {
      id: Date.now().toString(),
      nom: '',
      prenom: '',
      telephone: '',
      adresse: '',
      genre: '',
      dateNaissance: '',
      accepte: false,
    }]);
  };

  const removeFamilyMember = (id: string) => {
    setFamilyMembers(familyMembers.filter(m => m.id !== id));
  };

  const updateFamilyMember = (id: string, field: string, value: any) => {
    setFamilyMembers(familyMembers.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const handlePayFamily = async (method: 'card' | 'apple' | 'virement') => {
    if (isProcessingPayment || !memberProfile || familyMembers.length === 0) return;

    // Validation
    for (const member of familyMembers) {
      if (!member.nom.trim() || !member.prenom.trim() || !member.telephone.trim() || !member.adresse.trim()) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs pour chaque membre');
        return;
      }
      if (!member.genre) {
        Alert.alert('Erreur', `Veuillez sélectionner le genre pour ${member.prenom || 'ce membre'}`);
        return;
      }
      if (!member.dateNaissance.trim()) {
        Alert.alert('Erreur', `Veuillez entrer la date de naissance pour ${member.prenom || 'ce membre'}`);
        return;
      }
      if (!isAdult(member.dateNaissance)) {
        Alert.alert(
          'Inscription impossible',
          `${member.prenom || 'Ce membre'} doit être majeur (18 ans ou plus) pour devenir membre de l'association.`
        );
        return;
      }
      if (!member.accepte) {
        Alert.alert('Erreur', `${member.prenom} doit accepter le règlement intérieur`);
        return;
      }
    }

    const totalAmount = familyMembers.length * formulePrices[familyFormule];
    const paiementId = `PAY-${Date.now()}`;

    if (method === 'virement') {
      const reference = `FAM-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Créer les membres en attente
      const nameParts = memberProfile.name.split(' ');
      const payeurPrenom = nameParts[0] || '';
      const payeurNom = nameParts.slice(1).join(' ') || memberProfile.name;

      for (const member of familyMembers) {
        await createMember({
          email: `${member.prenom.toLowerCase()}.${member.nom.toLowerCase()}@inscrit-par-${memberProfile.email}`,
          nom: member.nom,
          prenom: member.prenom,
          telephone: member.telephone,
          adresse: member.adresse,
          genre: member.genre,
          dateNaissance: member.dateNaissance,
          accepteReglement: true,
          inscritPar: { odUserId: memberProfile.uid, nom: payeurNom, prenom: payeurPrenom },
          status: 'en_attente_paiement',
          referenceVirement: reference,
          formule: familyFormule,
          montant: formulePrices[familyFormule],
        });
      }

      Alert.alert(
        '🏦 Virement bancaire',
        `Montant total: ${totalAmount}€ (${familyMembers.length} membre${familyMembers.length > 1 ? 's' : ''} - ${familyFormule})\n\nIBAN: ${mosqueeInfo?.iban || 'FR76 XXXX XXXX XXXX'}\nRéférence: ${reference}`,
        [{ text: 'Compris' }]
      );

      setShowFamilyModal(false);
      setFamilyMembers([]);

      const user = AuthService.getCurrentUser();
      if (user) await loadMemberData(user.uid);
      return;
    }

    setIsProcessingPayment(true);
    try {
      const paymentResult = await makePayment({
        amount: totalAmount,
        description: `Cotisation famille ${familyFormule} (${familyMembers.length}) - El Mouhssinine`,
        type: 'cotisation',
        metadata: {
          memberId: memberProfile.memberId || '',
          memberName: memberProfile.name,
          period: familyFormule,
          membersCount: familyMembers.length.toString(),
        },
      });

      if (paymentResult.success && paymentResult.paymentIntentId) {
        const timestamp = new Date();
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
          await createMember({
            email: `${member.prenom.toLowerCase()}.${member.nom.toLowerCase()}@inscrit-par-${memberProfile.email}`,
            nom: member.nom,
            prenom: member.prenom,
            telephone: member.telephone,
            adresse: member.adresse,
            genre: member.genre,
            dateNaissance: member.dateNaissance,
            accepteReglement: true,
            inscritPar: { odUserId: memberProfile.uid, nom: payeurNom2, prenom: payeurPrenom2 },
            status: 'en_attente_signature',
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
      }
    } catch (error: any) {
      showPaymentError(error.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ============================================================
  // RENDER: LOADING
  // ============================================================

  if (isLoading) {
    return (
      <View style={styles.container}>
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
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🕌</Text>
            <Text style={[styles.title, isRTL && styles.rtlText]}>{t('memberArea')}</Text>
          </View>

          {/* Card connexion */}
          <View style={styles.card}>
            <Text style={styles.cardIcon}>👤</Text>
            <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>{t('connectYourself')}</Text>
            <Text style={[styles.cardSubtitle, isRTL && styles.rtlText]}>
              {t('accessMemberArea')}
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => { setIsRegistering(false); setShowLoginModal(true); }}
            >
              <Text style={styles.primaryButtonText}>{t('login')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => { setIsRegistering(true); setShowLoginModal(true); }}
            >
              <Text style={styles.secondaryButtonText}>{t('createAccount')}</Text>
            </TouchableOpacity>
          </View>

          {/* Avantages */}
          <View style={styles.benefitsSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>✨ {t('memberBenefits')}</Text>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>📧</Text>
              <Text style={[styles.benefitText, isRTL && styles.rtlText]}>{t('taxReceipt')}</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>🗳️</Text>
              <Text style={[styles.benefitText, isRTL && styles.rtlText]}>{t('votingRights')}</Text>
            </View>
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
                Bienvenue à la mosquée El Mouhssinine !
              </Text>
              <Text style={[styles.welcomeText, isRTL && styles.rtlText]}>
                Rejoignez notre communauté en devenant membre de l'association. En tant que membre, vous bénéficiez de nombreux avantages :
              </Text>
              <View style={styles.welcomeBenefits}>
                <Text style={styles.welcomeBenefit}>✅ Reçu fiscal pour vos dons (déduction d'impôts)</Text>
                <Text style={styles.welcomeBenefit}>✅ Droit de vote aux assemblées générales</Text>
                <Text style={styles.welcomeBenefit}>✅ Participation aux décisions de la mosquée</Text>
                <Text style={styles.welcomeBenefit}>✅ Accès aux événements réservés aux membres</Text>
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
      </View>
    );
  }

  // ============================================================
  // RENDER: LOGGED IN - NO SUBSCRIPTION
  // ============================================================

  // Préparation des cartes de membre (utilisateur + inscrits)
  const getPaymentStatus = (profile: MemberProfile | InscribedMember): 'paid' | 'pending' | 'virement_pending' | 'unpaid' => {
    // Pour MemberProfile
    if ('cotisationStatus' in profile) {
      const status = profile.cotisationStatus as string;
      if (status === 'actif' || status === 'active') return 'paid';
      if (status === 'en_attente_paiement') return 'pending';
      return 'unpaid';
    }
    // Pour InscribedMember
    if (profile.status === 'actif' || profile.status === 'active') return 'paid';
    if (profile.status === 'en_attente_paiement') return 'virement_pending';
    if (profile.status === 'en_attente_signature') return 'paid'; // Payé mais pas encore signé
    if (profile.datePaiement) return 'paid';
    return 'unpaid';
  };

  const memberForCard = memberProfile ? {
    name: memberProfile.name,
    memberId: memberProfile.memberId,
    membershipExpirationDate: memberProfile.cotisationExpiry,
    status: memberProfile.cotisationStatus || 'inactive',
    paymentStatus: getPaymentStatus(memberProfile),
    subscriptionType: memberProfile.cotisationType || undefined,
  } : null;

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

  if (!isPaid) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header avec nom */}
          <View style={styles.header}>
            <Text style={[styles.greeting, isRTL && styles.rtlText]}>
              {isRTL ? `${memberProfile?.name?.split(' ')[0] || ''} 👋 مرحبا` : `Bonjour, ${memberProfile?.name?.split(' ')[0] || ''} 👋`}
            </Text>
          </View>

          {/* Bouton voir ma carte de membre */}
          <TouchableOpacity
            style={styles.memberCardButton}
            onPress={() => setShowCardFullScreen(true)}
          >
            <Text style={styles.memberCardButtonIcon}>🪪</Text>
            <View style={styles.memberCardButtonContent}>
              <Text style={[styles.memberCardButtonText, isRTL && styles.rtlText]}>
                Voir ma carte de membre
              </Text>
              <Text style={[styles.memberCardButtonSubtext, isRTL && styles.rtlText]}>
                Afficher en plein écran
              </Text>
            </View>
            <Text style={styles.memberCardButtonArrow}>→</Text>
          </TouchableOpacity>

          {/* Bouton voir mes adhésions */}
          <TouchableOpacity
            style={styles.membershipsButton}
            onPress={() => navigation.navigate('MyMemberships')}
          >
            <Text style={styles.membershipsButtonIcon}>👥</Text>
            <View style={styles.membershipsButtonContent}>
              <Text style={[styles.membershipsButtonText, isRTL && styles.rtlText]}>
                Voir mes adhésions
              </Text>
              <Text style={[styles.membershipsButtonSubtext, isRTL && styles.rtlText]}>
                {inscribedMembers.length > 0
                  ? `${inscribedMembers.length + 1} membre${inscribedMembers.length > 0 ? 's' : ''}`
                  : 'Détails et statuts'}
              </Text>
            </View>
            <Text style={styles.membershipsButtonArrow}>→</Text>
          </TouchableOpacity>

          {/* Card Devenir membre */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>Activer ma cotisation</Text>
            <Text style={[styles.cardSubtitle, isRTL && styles.rtlText]}>
              Choisissez votre formule d'adhésion
            </Text>

            {/* Formules */}
            <View style={styles.formulesContainer}>
              <TouchableOpacity
                style={[styles.formuleOption, selectedFormule === 'mensuel' && styles.formuleSelected]}
                onPress={() => setSelectedFormule('mensuel')}
              >
                <Text style={[styles.formuleLabel, selectedFormule === 'mensuel' && styles.formuleLabelSelected]}>
                  Mensuel
                </Text>
                <Text style={[styles.formulePrice, selectedFormule === 'mensuel' && styles.formulePriceSelected]}>
                  {formulePrices.mensuel}€
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formuleOption, selectedFormule === 'annuel' && styles.formuleSelected]}
                onPress={() => setSelectedFormule('annuel')}
              >
                <Text style={[styles.formuleLabel, selectedFormule === 'annuel' && styles.formuleLabelSelected]}>
                  Annuel
                </Text>
                <Text style={[styles.formulePrice, selectedFormule === 'annuel' && styles.formulePriceSelected]}>
                  {formulePrices.annuel}€
                </Text>
                {formulePrices.annuel < formulePrices.mensuel * 12 && (
                  <View style={styles.economyBadge}>
                    <Text style={styles.economyText}>-{Math.round((1 - formulePrices.annuel / (formulePrices.mensuel * 12)) * 100)}%</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowPaymentModal(true)}
            >
              <Text style={styles.primaryButtonText}>Payer {formulePrices[selectedFormule]}€</Text>
            </TouchableOpacity>
          </View>

          {/* Bouton inscrire famille */}
          <TouchableOpacity
            style={styles.familyButton}
            onPress={() => setShowFamilyModal(true)}
          >
            <Text style={styles.familyButtonIcon}>👨‍👩‍👧‍👦</Text>
            <View style={styles.familyButtonContent}>
              <Text style={[styles.familyButtonText, isRTL && styles.rtlText]}>{t('registerFamily')}</Text>
              <Text style={[styles.familyButtonSubtext, isRTL && styles.rtlText]}>
                Inscrire famille, amis...
              </Text>
            </View>
            <Text style={styles.familyButtonArrow}>→</Text>
          </TouchableOpacity>

          {/* Déconnexion */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>{t('logout')}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Modales */}
        <MemberCardFullScreen
          visible={showCardFullScreen}
          onClose={() => setShowCardFullScreen(false)}
          members={allMembersForCard}
          isRTL={isRTL}
        />

        {renderPaymentModal()}
        {renderFamilyModal()}
      </View>
    );
  }

  // ============================================================
  // RENDER: LOGGED IN - WITH SUBSCRIPTION (MAIN VIEW)
  // ============================================================

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header avec nom */}
        <View style={styles.header}>
          <Text style={[styles.greeting, isRTL && styles.rtlText]}>
            {isRTL ? `${memberProfile?.name?.split(' ')[0] || ''} 👋 مرحبا` : `Bonjour, ${memberProfile?.name?.split(' ')[0] || ''} 👋`}
          </Text>
        </View>

        {/* Bouton voir ma carte de membre */}
        <TouchableOpacity
          style={styles.memberCardButton}
          onPress={() => setShowCardFullScreen(true)}
        >
          <Text style={styles.memberCardButtonIcon}>🪪</Text>
          <View style={styles.memberCardButtonContent}>
            <Text style={[styles.memberCardButtonText, isRTL && styles.rtlText]}>
              Voir ma carte de membre
            </Text>
            <Text style={[styles.memberCardButtonSubtext, isRTL && styles.rtlText]}>
              {inscribedMembers.length > 0 ? `${inscribedMembers.length + 1} cartes disponibles` : 'Afficher en plein écran'}
            </Text>
          </View>
          <Text style={styles.memberCardButtonArrow}>→</Text>
        </TouchableOpacity>

        {/* Bouton voir mes adhésions */}
        <TouchableOpacity
          style={styles.membershipsButton}
          onPress={() => navigation.navigate('MyMemberships')}
        >
          <Text style={styles.membershipsButtonIcon}>👥</Text>
          <View style={styles.membershipsButtonContent}>
            <Text style={[styles.membershipsButtonText, isRTL && styles.rtlText]}>
              Voir mes adhésions
            </Text>
            <Text style={[styles.membershipsButtonSubtext, isRTL && styles.rtlText]}>
              {inscribedMembers.length > 0
                ? `${inscribedMembers.length + 1} membre${inscribedMembers.length > 0 ? 's' : ''} (vous + ${inscribedMembers.length} inscrit${inscribedMembers.length > 1 ? 's' : ''})`
                : 'Détails et statuts'}
            </Text>
          </View>
          <Text style={styles.membershipsButtonArrow}>→</Text>
        </TouchableOpacity>

        {/* Bouton inscrire famille */}
        <TouchableOpacity
          style={styles.familyButton}
          onPress={() => setShowFamilyModal(true)}
        >
          <Text style={styles.familyButtonIcon}>➕</Text>
          <View style={styles.familyButtonContent}>
            <Text style={[styles.familyButtonText, isRTL && styles.rtlText]}>Inscrire d'autres personnes</Text>
            <Text style={[styles.familyButtonSubtext, isRTL && styles.rtlText]}>
              Famille, amis...
            </Text>
          </View>
          <Text style={styles.familyButtonArrow}>→</Text>
        </TouchableOpacity>

        {/* Renouveler si bientôt expiré */}
        {memberProfile?.cotisationExpiry && (() => {
          const expiryValue = memberProfile.cotisationExpiry as any;
          const expiry = expiryValue instanceof Date
            ? expiryValue
            : expiryValue?.toDate?.() || new Date(expiryValue);
          const daysLeft = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

          if (daysLeft <= 30 && daysLeft > 0) {
            return (
              <TouchableOpacity
                style={styles.renewButton}
                onPress={() => setShowPaymentModal(true)}
              >
                <Text style={styles.renewButtonText}>
                  ⚠️ Expire dans {daysLeft} jours - Renouveler
                </Text>
              </TouchableOpacity>
            );
          }
          return null;
        })()}

        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>{t('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modales */}
      <MemberCardFullScreen
        visible={showCardFullScreen}
        onClose={() => setShowCardFullScreen(false)}
        members={allMembersForCard}
        isRTL={isRTL}
      />

      {renderPaymentModal()}
      {renderFamilyModal()}
    </View>
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
            <TouchableOpacity style={styles.closeButton} onPress={() => { setShowLoginModal(false); resetLoginForm(); }}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            {showForgotPassword ? (
              // Mot de passe oublié
              <>
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>🔑 Mot de passe oublié</Text>

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
                  style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
                  onPress={handleForgotPassword}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Envoyer le lien</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowForgotPassword(false)}>
                  <Text style={styles.linkText}>← Retour à la connexion</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Connexion / Inscription
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                        style={[styles.genreOption, registerGenre === 'homme' && styles.genreSelected]}
                        onPress={() => setRegisterGenre('homme')}
                      >
                        <Text style={[styles.genreText, registerGenre === 'homme' && styles.genreTextSelected]}>
                          Homme
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.genreOption, registerGenre === 'femme' && styles.genreSelected]}
                        onPress={() => setRegisterGenre('femme')}
                      >
                        <Text style={[styles.genreText, registerGenre === 'femme' && styles.genreTextSelected]}>
                          Femme
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.inputLabel}>Date de naissance * (JJ/MM/AAAA)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="01/01/1990"
                      placeholderTextColor="#999"
                      value={registerDateNaissance}
                      onChangeText={setRegisterDateNaissance}
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
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#999"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry
                />

                {isRegistering && (
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setAcceptedRules(!acceptedRules)}
                  >
                    <View style={[styles.checkbox, acceptedRules && styles.checkboxChecked]}>
                      {acceptedRules && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>J'accepte le règlement intérieur *</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
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

                <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
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
  // MODAL: PAYMENT
  // ============================================================

  function renderPaymentModal() {
    return (
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowPaymentModal(false)}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>💳 Paiement</Text>

            <View style={styles.paymentSummary}>
              <Text style={styles.paymentSummaryLabel}>Cotisation {selectedFormule}</Text>
              <Text style={styles.paymentSummaryAmount}>{formulePrices[selectedFormule]}€</Text>
            </View>

            {/* Méthodes de paiement */}
            <TouchableOpacity
              style={styles.paymentMethod}
              onPress={() => handlePayment('card')}
              disabled={isProcessingPayment}
            >
              <Text style={styles.paymentMethodIcon}>💳</Text>
              <View style={styles.paymentMethodContent}>
                <Text style={styles.paymentMethodTitle}>Carte bancaire</Text>
                <Text style={styles.paymentMethodSubtitle}>Visa, Mastercard</Text>
              </View>
              {isProcessingPayment ? <ActivityIndicator /> : <Text style={styles.paymentMethodArrow}>→</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentMethod, styles.applePayMethod]}
              onPress={() => handlePayment('apple')}
              disabled={isProcessingPayment}
            >
              <Image source={require('../assets/apple-logo.png')} style={styles.appleLogo} />
              <View style={styles.paymentMethodContent}>
                <Text style={[styles.paymentMethodTitle, styles.applePayText]}>Apple Pay</Text>
                <Text style={[styles.paymentMethodSubtitle, styles.applePaySubtext]}>Paiement rapide</Text>
              </View>
              {isProcessingPayment ? <ActivityIndicator /> : <Text style={[styles.paymentMethodArrow, styles.applePayText]}>→</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.paymentMethod}
              onPress={() => handlePayment('virement')}
              disabled={isProcessingPayment}
            >
              <Text style={styles.paymentMethodIcon}>🏦</Text>
              <View style={styles.paymentMethodContent}>
                <Text style={styles.paymentMethodTitle}>Virement bancaire</Text>
                <Text style={styles.paymentMethodSubtitle}>Paiement différé</Text>
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.familyModalContent}>
            {/* Header */}
            <View style={styles.familyModalHeader}>
              <Text style={[styles.familyModalTitle, isRTL && styles.rtlText]}>👨‍👩‍👧‍👦 Inscrire des proches</Text>
              <TouchableOpacity
                style={styles.familyCloseButton}
                onPress={() => { setShowFamilyModal(false); setFamilyMembers([]); }}
              >
                <Text style={styles.familyCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Sélecteur de formule */}
            <View style={styles.familyFormuleSelector}>
              <TouchableOpacity
                style={[styles.familyFormuleOption, familyFormule === 'mensuel' && styles.familyFormuleSelected]}
                onPress={() => setFamilyFormule('mensuel')}
              >
                <Text style={[styles.familyFormuleLabel, familyFormule === 'mensuel' && styles.familyFormuleLabelSelected]}>
                  Mensuel
                </Text>
                <Text style={[styles.familyFormulePrice, familyFormule === 'mensuel' && styles.familyFormulePriceSelected]}>
                  {formulePrices.mensuel}€/mois
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.familyFormuleOption, familyFormule === 'annuel' && styles.familyFormuleSelected]}
                onPress={() => setFamilyFormule('annuel')}
              >
                <Text style={[styles.familyFormuleLabel, familyFormule === 'annuel' && styles.familyFormuleLabelSelected]}>
                  Annuel
                </Text>
                <Text style={[styles.familyFormulePrice, familyFormule === 'annuel' && styles.familyFormulePriceSelected]}>
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
                    <Text style={styles.familyMemberNumber}>Membre {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeFamilyMember(member.id)}>
                      <Text style={styles.removeButton}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.familyInput}
                    placeholder="Nom"
                    placeholderTextColor="#999"
                    value={member.nom}
                    onChangeText={(v) => updateFamilyMember(member.id, 'nom', v)}
                  />
                  <TextInput
                    style={styles.familyInput}
                    placeholder="Prénom"
                    placeholderTextColor="#999"
                    value={member.prenom}
                    onChangeText={(v) => updateFamilyMember(member.id, 'prenom', v)}
                  />
                  <TextInput
                    style={styles.familyInput}
                    placeholder="Téléphone"
                    placeholderTextColor="#999"
                    value={member.telephone}
                    onChangeText={(v) => updateFamilyMember(member.id, 'telephone', v)}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.familyInput}
                    placeholder="Adresse"
                    placeholderTextColor="#999"
                    value={member.adresse}
                    onChangeText={(v) => updateFamilyMember(member.id, 'adresse', v)}
                  />

                  <Text style={styles.familyInputLabel}>Genre *</Text>
                  <View style={styles.familyGenreContainer}>
                    <TouchableOpacity
                      style={[styles.familyGenreOption, member.genre === 'homme' && styles.familyGenreSelected]}
                      onPress={() => updateFamilyMember(member.id, 'genre', 'homme')}
                    >
                      <Text style={[styles.familyGenreText, member.genre === 'homme' && styles.familyGenreTextSelected]}>
                        Homme
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.familyGenreOption, member.genre === 'femme' && styles.familyGenreSelected]}
                      onPress={() => updateFamilyMember(member.id, 'genre', 'femme')}
                    >
                      <Text style={[styles.familyGenreText, member.genre === 'femme' && styles.familyGenreTextSelected]}>
                        Femme
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.familyInput}
                    placeholder="Date de naissance (JJ/MM/AAAA)"
                    placeholderTextColor="#999"
                    value={member.dateNaissance}
                    onChangeText={(v) => updateFamilyMember(member.id, 'dateNaissance', v)}
                    keyboardType="numeric"
                    maxLength={10}
                  />

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => updateFamilyMember(member.id, 'accepte', !member.accepte)}
                  >
                    <View style={[styles.checkbox, member.accepte && styles.checkboxChecked]}>
                      {member.accepte && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>Accepte le règlement intérieur</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addMemberButton} onPress={addFamilyMember}>
                <Text style={styles.addMemberButtonText}>+ Ajouter une personne</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Footer avec total et boutons */}
            {familyMembers.length > 0 && (
              <View style={styles.familyFooter}>
                <View style={styles.familyTotalRow}>
                  <Text style={styles.familyTotalLabel}>
                    {familyMembers.length} personne{familyMembers.length > 1 ? 's' : ''} × {formulePrices[familyFormule]}€
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
                    <Text style={styles.familyPayButtonText}>💳 Payer par carte</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.familyPaymentOptions}>
                  <TouchableOpacity
                    style={styles.familyPayOptionButton}
                    onPress={() => handlePayFamily('apple')}
                    disabled={isProcessingPayment}
                  >
                    <Text style={styles.familyPayOptionText}> Pay</Text>
                  </TouchableOpacity>

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
    backgroundColor: colors.background,
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
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
    paddingBottom: spacing.xl,
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
});

export default MemberScreen;
