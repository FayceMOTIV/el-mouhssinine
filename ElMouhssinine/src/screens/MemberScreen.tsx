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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, wp, MODAL_WIDTH, platformShadow, isSmallScreen } from '../theme/colors';
import { getMember, updateMember, createMember, getMembersInscribedBy, InscribedMember, subscribeToCotisationPrices, CotisationPrices, addPayment, getMosqueeInfo, MosqueeInfo } from '../services/firebase';
import { AuthService, MemberProfile } from '../services/auth';
import { makePayment, showPaymentError, showPaymentSuccess } from '../services/stripe';
import { subscribeToMembersTopic, unsubscribeFromMembersTopic, saveFCMTokenToFirestore } from '../services/notifications';
import { Member } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { SkeletonLoader, MemberProfileSkeleton, MemberCard } from '../components';

// Type pour les membres supplémentaires
interface AdditionalMember {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string;
  accepteReglement: boolean;
}

const MemberScreen = () => {
  const navigation = useNavigation<any>();
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
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerNom, setRegisterNom] = useState('');
  const [registerPrenom, setRegisterPrenom] = useState('');
  const [registerTelephone, setRegisterTelephone] = useState('');
  const [registerAdresse, setRegisterAdresse] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [acceptedRules, setAcceptedRules] = useState(false); // Checkbox règlement
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // Formule d'adhésion - Prix dynamiques depuis Firestore
  const [selectedFormule, setSelectedFormule] = useState<'mensuel' | 'annuel'>('annuel');
  const [formulePrices, setFormulePrices] = useState<CotisationPrices>({ mensuel: 10, annuel: 100 });
  const getFormulePrice = () => formulePrices[selectedFormule];

  // Validations
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // Validation téléphone : FR (0X XX XX XX XX) ou international (+XX X XX XX XX XX)
  const validatePhone = (phone: string) => {
    const cleanPhone = phone.replace(/[\s.-]/g, '');
    const frenchRegex = /^0[1-9]\d{8}$/;
    const internationalRegex = /^\+[1-9]\d{6,14}$/;
    return frenchRegex.test(cleanPhone) || internationalRegex.test(cleanPhone);
  };
  const validateField = (value: string) => value.trim().length > 0;

  // Cotisation status
  const [isPaid, setIsPaid] = useState(false);

  // Multi-membres
  const [additionalMembers, setAdditionalMembers] = useState<AdditionalMember[]>([]);
  const [showMultiMemberModal, setShowMultiMemberModal] = useState(false);
  const [includeMyself, setIncludeMyself] = useState(true); // L'utilisateur connecté s'inclut-il?
  const [multiMemberStep, setMultiMemberStep] = useState<'form' | 'payment'>('form'); // Étape du parcours
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null); // Mode de paiement sélectionné

  // Personnes inscrites par l'utilisateur connecté
  const [inscribedMembers, setInscribedMembers] = useState<InscribedMember[]>([]);

  // Infos mosquée (IBAN, BIC, etc.)
  const [mosqueeInfo, setMosqueeInfo] = useState<MosqueeInfo | null>(null);

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
        // S'abonner au topic membres pour recevoir les notifications reservees aux adherents
        await subscribeToMembersTopic();
        // Sauvegarder le token FCM pour notifications personnelles
        await saveFCMTokenToFirestore(uid);

        // Charger les personnes inscrites par cet utilisateur
        const inscribed = await getMembersInscribedBy(uid);
        setInscribedMembers(inscribed);
      }
    } catch (error) {
      console.error('Error loading member data:', error);
      Alert.alert(
        t('error'),
        isRTL ? 'حدث خطأ أثناء تحميل الملف الشخصي' : 'Erreur lors du chargement du profil'
      );
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

  // Charger les prix des cotisations depuis Firestore
  useEffect(() => {
    const unsubscribe = subscribeToCotisationPrices((prices) => {
      setFormulePrices(prices);
    });
    return () => unsubscribe();
  }, []);

  // Charger les infos de la mosquée (IBAN, BIC, etc.)
  useEffect(() => {
    const loadMosqueeInfo = async () => {
      const info = await getMosqueeInfo();
      setMosqueeInfo(info);
    };
    loadMosqueeInfo();
  }, []);

  // Générer une référence de virement unique
  const generateVirementReference = () => {
    return `ADH-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  };

  // Note: Le paiement mensuel N'EST PAS récurrent - renouvellement manuel chaque mois
  const cotisationOptions = [
    { id: 'mensuel', label: 'Mensuel', amount: formulePrices.mensuel, description: `${formulePrices.mensuel}€ - Renouvellement manuel` },
    { id: 'annuel', label: 'Annuel', amount: formulePrices.annuel, description: `${formulePrices.annuel}€/an - Paiement unique` },
  ];

  const handlePayCotisation = async () => {
    // PROTECTION DOUBLE PAIEMENT: Vérifier si déjà en cours
    if (isProcessingPayment) {
      console.log('Paiement déjà en cours, ignoré');
      return;
    }

    if (!paymentMethod || !memberProfile) return;

    const amount = formulePrices[cotisationType];

    // Si virement bancaire, afficher les coordonnées
    if (paymentMethod === 'virement') {
      const reference = generateVirementReference();
      const iban = mosqueeInfo?.iban || 'FR76 XXXX XXXX XXXX XXXX XXXX XXX';
      const bic = mosqueeInfo?.bic || 'AGRIFRPP';
      const beneficiaire = mosqueeInfo?.accountHolder || 'Association El Mouhssinine';
      Alert.alert(
        'Virement bancaire',
        `Montant: ${amount}€\n\nCoordonnées bancaires:\nIBAN: ${iban}\nBIC: ${bic}\nBénéficiaire: ${beneficiaire}\n\nRéférence obligatoire: ${reference}\n\n⏳ Votre adhésion sera activée dès réception du paiement.`,
        [{ text: 'OK', onPress: () => setShowCotisationModal(false) }]
      );
      return;
    }

    // Si paiement en espèces
    if (paymentMethod === 'especes') {
      Alert.alert(
        '💵 Paiement en espèces',
        `Montant à régler: ${amount}€\n\nRendez-vous au comptoir de la mosquée avec cette somme.\n\n⏳ Votre adhésion sera activée dès réception du paiement.`,
        [{ text: 'OK', onPress: () => setShowCotisationModal(false) }]
      );
      return;
    }

    // Paiement par carte/Apple Pay/Google Pay via Stripe
    setIsProcessingPayment(true);

    try {
      const result = await makePayment({
        amount,
        description: `Cotisation ${cotisationType} - Mosquée El Mouhssinine`,
        type: 'cotisation',
        metadata: {
          memberId: memberProfile.memberId,
          memberName: `${memberProfile.prenom} ${memberProfile.nom}`,
          period: cotisationType,
        },
      });

      if (result.success && result.paymentIntentId) {
        // Enregistrer le paiement dans Firebase
        await addPayment({
          memberId: memberProfile.memberId,
          memberName: `${memberProfile.prenom} ${memberProfile.nom}`,
          amount,
          stripePaymentIntentId: result.paymentIntentId,
          paymentMethod: paymentMethod || 'card',
          period: cotisationType,
        });

        // Fermer le modal et afficher succès
        setShowCotisationModal(false);
        showPaymentSuccess('cotisation');

        // Recharger les données du membre
        const user = AuthService.getCurrentUser();
        if (user) {
          await loadMemberData(user.uid);
        }

        // Reset
        setPaymentMethod(null);
      } else {
        showPaymentError(result.error || 'Une erreur est survenue');
      }
    } catch (error: any) {
      console.error('Erreur paiement cotisation:', error);
      showPaymentError(error.message || 'Une erreur est survenue');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCancelSubscription = async () => {
    // Fonctionnalité non disponible pour l'instant - contacter l'admin
    setShowCancelModal(false);
    Alert.alert(
      isRTL ? 'غير متاح' : 'Non disponible',
      isRTL
        ? 'لإلغاء اشتراكك، يرجى الاتصال بإدارة المسجد مباشرة أو زيارة مكتب الاستقبال.'
        : 'Pour annuler votre abonnement, veuillez contacter l\'administration de la mosquée ou vous rendre à l\'accueil.',
      [{ text: 'OK' }]
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
      // Charger les données du membre après connexion réussie
      if (result.user) {
        await loadMemberData(result.user.uid);
      }
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
    }
  };

  const handleRegister = async () => {
    // Reset des erreurs
    const errors: {[key: string]: string} = {};

    // Validations
    if (!validateField(registerNom)) {
      errors.nom = 'Le nom est obligatoire';
    }
    if (!validateField(registerPrenom)) {
      errors.prenom = 'Le prénom est obligatoire';
    }
    if (!validateField(registerTelephone)) {
      errors.telephone = 'Le téléphone est obligatoire';
    } else if (!validatePhone(registerTelephone)) {
      errors.telephone = 'Format invalide (ex: 0612345678)';
    }
    if (!validateField(registerAdresse)) {
      errors.adresse = 'L\'adresse est obligatoire';
    }
    if (!validateEmail(loginEmail)) {
      errors.email = 'Email invalide';
    }
    if (loginPassword.length < 6) {
      errors.password = 'Minimum 6 caractères';
    }
    if (!acceptedRules) {
      errors.reglement = 'Vous devez accepter le règlement';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setAuthLoading(true);
    const fullName = `${registerPrenom} ${registerNom}`;
    const result = await AuthService.signUp(loginEmail, loginPassword, fullName, registerTelephone, registerAdresse);
    setAuthLoading(false);

    if (!result.success) {
      Alert.alert('Erreur d\'inscription', result.error);
    } else {
      // Recharger les données du membre après inscription réussie
      // (le document Firestore vient d'être créé par signUp)
      if (result.user) {
        await loadMemberData(result.user.uid);
      }
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
      setRegisterNom('');
      setRegisterPrenom('');
      setRegisterTelephone('');
      setRegisterAdresse('');
      setAcceptedRules(false);
      setFormErrors({});
      Alert.alert('Bienvenue !', 'Votre compte a été créé avec succès.');
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
            // Se desabonner du topic membres lors de la deconnexion
            await unsubscribeFromMembersTopic();
            await AuthService.signOut();
          },
        },
      ]
    );
  };

  // ==================== MULTI-ADHERENTS ====================

  const addAdditionalMember = () => {
    const newMember: AdditionalMember = {
      id: Date.now().toString(),
      nom: '',
      prenom: '',
      telephone: '',
      adresse: '',
      accepteReglement: false,
    };
    setAdditionalMembers([...additionalMembers, newMember]);
  };

  const removeAdditionalMember = (id: string) => {
    setAdditionalMembers(additionalMembers.filter(m => m.id !== id));
  };

  const updateAdditionalMember = (id: string, field: keyof AdditionalMember, value: string | boolean) => {
    setAdditionalMembers(additionalMembers.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const getTotalAmount = () => {
    let count = includeMyself ? 1 : 0;
    count += additionalMembers.length;
    return count * getFormulePrice();
  };

  const getTotalMembersCount = () => {
    let count = includeMyself ? 1 : 0;
    count += additionalMembers.length;
    return count;
  };

  const isAdditionalMemberValid = (m: AdditionalMember) => {
    return m.nom.trim() && m.prenom.trim() && validatePhone(m.telephone) && m.adresse.trim() && m.accepteReglement;
  };

  // Obtenir les erreurs de validation pour un membre additionnel
  const getAdditionalMemberErrors = (m: AdditionalMember): { telephone?: string } => {
    const errors: { telephone?: string } = {};
    if (m.telephone.trim() && !validatePhone(m.telephone)) {
      errors.telephone = 'Format invalide (ex: 0612345678)';
    }
    return errors;
  };

  const areAllAdditionalMembersValid = () => {
    return additionalMembers.every(isAdditionalMemberValid);
  };

  const canProceedToPayment = () => {
    if (getTotalMembersCount() === 0) return false;
    if (additionalMembers.length > 0 && !areAllAdditionalMembersValid()) return false;
    return true;
  };

  const handlePayMultipleMembers = async () => {
    // PROTECTION DOUBLE PAIEMENT: Vérifier si déjà en cours
    if (isProcessingPayment) {
      console.log('Paiement déjà en cours, ignoré');
      return;
    }

    if (!canProceedToPayment() || !memberProfile || !selectedPaymentMethod) return;

    const totalAmount = getTotalAmount();
    const isVirement = selectedPaymentMethod === 'virement';
    const isEspeces = selectedPaymentMethod === 'especes';

    // Activer le verrou de paiement
    setIsProcessingPayment(true);

    try {
      // ========== PAIEMENT VIREMENT ==========
      if (isVirement) {
        const timestamp = new Date();
        const paiementId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const referenceVirement = generateVirementReference();

        const nameParts = memberProfile.name.split(' ');
        const inscritParData = {
          odUserId: memberProfile.uid,
          nom: nameParts.slice(1).join(' ') || '',
          prenom: nameParts[0] || '',
        };

        // Sauvegarder chaque membre avec status en_attente_paiement
        for (const addMember of additionalMembers) {
          await createMember({
            nom: addMember.nom,
            prenom: addMember.prenom,
            telephone: addMember.telephone,
            adresse: addMember.adresse,
            email: '',
            inscritPar: inscritParData,
            status: 'en_attente_paiement',
            dateInscription: timestamp,
            datePaiement: null,
            paiementId: paiementId,
            referenceVirement: referenceVirement,
            montant: getFormulePrice(),
            modePaiement: 'virement',
            formule: selectedFormule,
            cotisation: {
              type: selectedFormule,
              montant: getFormulePrice(),
              dateDebut: null,
              dateFin: null,
            },
          });
        }

        // Si l'utilisateur s'inclut lui-même dans le virement
        if (includeMyself && memberProfile.email) {
          // Créer/mettre à jour le membre pour l'utilisateur connecté
          await createMember({
            nom: nameParts.slice(1).join(' ') || memberProfile.name,
            prenom: nameParts[0] || '',
            telephone: memberProfile.telephone || '',
            adresse: memberProfile.adresse || '',
            email: memberProfile.email,
            status: 'en_attente_paiement',
            dateInscription: timestamp,
            datePaiement: null,
            paiementId: paiementId,
            referenceVirement: referenceVirement,
            montant: getFormulePrice(),
            modePaiement: 'virement',
            formule: selectedFormule,
            cotisation: {
              type: selectedFormule,
              montant: getFormulePrice(),
              dateDebut: null,
              dateFin: null,
            },
          });
        }

        const iban = mosqueeInfo?.iban || 'FR76 XXXX XXXX XXXX XXXX XXXX XXX';
        const bic = mosqueeInfo?.bic || 'AGRIFRPP';
        const beneficiaire = mosqueeInfo?.accountHolder || 'Association El Mouhssinine';

        Alert.alert(
          'Inscription enregistrée ! 📝',
          `${getTotalMembersCount()} membre(s) inscrit(s).\n\n` +
          `💰 Montant à virer : ${totalAmount}€\n\n` +
          `🏦 Coordonnées bancaires :\n` +
          `IBAN : ${iban}\n` +
          `BIC : ${bic}\n` +
          `Bénéficiaire : ${beneficiaire}\n\n` +
          `📋 Référence obligatoire : ${referenceVirement}\n\n` +
          `⏳ Votre adhésion sera activée dès réception du paiement.`,
          [{ text: 'Compris', onPress: () => {
            setShowMultiMemberModal(false);
            setAdditionalMembers([]);
            setMultiMemberStep('form');
            setSelectedPaymentMethod(null);
          }}]
        );

        // Recharger les données
        const user = AuthService.getCurrentUser();
        if (user) await loadMemberData(user.uid);
        return;
      }

      // ========== PAIEMENT ESPECES ==========
      if (isEspeces) {
        const timestamp = new Date();
        const paiementId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const nameParts = memberProfile.name.split(' ');
        const inscritParData = {
          odUserId: memberProfile.uid,
          nom: nameParts.slice(1).join(' ') || '',
          prenom: nameParts[0] || '',
        };

        // Sauvegarder chaque membre avec status en_attente_paiement
        for (const addMember of additionalMembers) {
          await createMember({
            nom: addMember.nom,
            prenom: addMember.prenom,
            telephone: addMember.telephone,
            adresse: addMember.adresse,
            email: '',
            inscritPar: inscritParData,
            status: 'en_attente_paiement',
            dateInscription: timestamp,
            datePaiement: null,
            paiementId: paiementId,
            montant: getFormulePrice(),
            modePaiement: 'especes',
            formule: selectedFormule,
            cotisation: {
              type: selectedFormule,
              montant: getFormulePrice(),
              dateDebut: null,
              dateFin: null,
            },
          });
        }

        // Si l'utilisateur s'inclut lui-même
        if (includeMyself && memberProfile.email) {
          await createMember({
            nom: nameParts.slice(1).join(' ') || memberProfile.name,
            prenom: nameParts[0] || '',
            telephone: memberProfile.telephone || '',
            adresse: memberProfile.adresse || '',
            email: memberProfile.email,
            status: 'en_attente_paiement',
            dateInscription: timestamp,
            datePaiement: null,
            paiementId: paiementId,
            montant: getFormulePrice(),
            modePaiement: 'especes',
            formule: selectedFormule,
            cotisation: {
              type: selectedFormule,
              montant: getFormulePrice(),
              dateDebut: null,
              dateFin: null,
            },
          });
        }

        Alert.alert(
          'Inscription enregistrée ! 📝',
          `${getTotalMembersCount()} membre(s) inscrit(s).\n\n` +
          `💵 Montant à régler en espèces : ${totalAmount}€\n\n` +
          `📍 Rendez-vous au comptoir de la mosquée pour effectuer le paiement.\n\n` +
          `⏳ Votre adhésion sera activée dès réception du paiement.`,
          [{ text: 'Compris', onPress: () => {
            setShowMultiMemberModal(false);
            setAdditionalMembers([]);
            setMultiMemberStep('form');
            setSelectedPaymentMethod(null);
          }}]
        );

        // Recharger les données
        const userEsp = AuthService.getCurrentUser();
        if (userEsp) await loadMemberData(userEsp.uid);
        return;
      }

      // ========== PAIEMENT CB / APPLE PAY ==========
      // 1. Appeler Stripe pour le paiement
      const paymentResult = await makePayment({
        amount: totalAmount,
        description: `Cotisation ${selectedFormule} x${getTotalMembersCount()} - Mosquée El Mouhssinine`,
        type: 'cotisation',
        metadata: {
          memberId: memberProfile.memberId,
          memberName: memberProfile.name,
          period: selectedFormule,
          membersCount: getTotalMembersCount().toString(),
        },
      });

      if (!paymentResult.success || !paymentResult.paymentIntentId) {
        showPaymentError(paymentResult.error || 'Le paiement a échoué');
        return;
      }

      // 2. Paiement réussi - Sauvegarder les membres
      const timestamp = new Date();
      const paiementId = paymentResult.paymentIntentId;

      const nameParts = memberProfile.name.split(' ');
      const inscritParData = {
        odUserId: memberProfile.uid,
        nom: nameParts.slice(1).join(' ') || '',
        prenom: nameParts[0] || '',
      };

      const getDateFin = () => {
        if (selectedFormule === 'mensuel') {
          return new Date(timestamp.getFullYear(), timestamp.getMonth() + 1, timestamp.getDate());
        }
        return new Date(timestamp.getFullYear() + 1, timestamp.getMonth(), timestamp.getDate());
      };

      // Sauvegarder chaque membre supplémentaire
      for (const addMember of additionalMembers) {
        await createMember({
          nom: addMember.nom,
          prenom: addMember.prenom,
          telephone: addMember.telephone,
          adresse: addMember.adresse,
          email: '',
          inscritPar: inscritParData,
          status: 'en_attente_signature', // Payé mais doit signer au bureau
          dateInscription: timestamp,
          datePaiement: timestamp,
          paiementId: paiementId,
          referenceVirement: null,
          montant: getFormulePrice(),
          modePaiement: selectedPaymentMethod,
          formule: selectedFormule,
          cotisation: {
            type: selectedFormule,
            montant: getFormulePrice(),
            dateDebut: timestamp,
            dateFin: getDateFin(),
          },
        });
      }

      // 3. Si l'utilisateur s'inclut lui-même, enregistrer son paiement
      if (includeMyself && memberProfile.memberId) {
        await addPayment({
          memberId: memberProfile.memberId,
          memberName: memberProfile.name,
          amount: getFormulePrice(),
          stripePaymentIntentId: paiementId,
          paymentMethod: selectedPaymentMethod,
          period: selectedFormule,
        });
      }

      // 4. Afficher succès
      showPaymentSuccess('cotisation');
      setShowMultiMemberModal(false);
      setAdditionalMembers([]);
      setMultiMemberStep('form');
      setSelectedPaymentMethod(null);

      // 5. Recharger les données
      const user = AuthService.getCurrentUser();
      if (user) await loadMemberData(user.uid);

    } catch (error: any) {
      console.error('Error in handlePayMultipleMembers:', error);
      showPaymentError(error.message || 'Une erreur est survenue lors du paiement.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Ecran de chargement avec skeleton
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <SkeletonLoader width={200} height={28} borderRadius={4} />
            <SkeletonLoader width={150} height={18} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
          <View style={styles.content}>
            <MemberProfileSkeleton />
            <View style={{ marginTop: spacing.xl }}>
              <SkeletonLoader width="100%" height={50} borderRadius={12} />
              <SkeletonLoader width="100%" height={50} borderRadius={12} style={{ marginTop: spacing.md }} />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Si non connecté
  if (!isLoggedIn) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
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
              accessibilityLabel={t('login')}
              accessibilityRole="button"
            >
              <Text style={[styles.primaryBtnText, isRTL && styles.rtlText]}>{t('login')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => { setIsRegistering(true); setShowLoginModal(true); }}
              accessibilityLabel={t('createAccount')}
              accessibilityRole="button"
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
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalContent, { maxHeight: '85%' }]}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLoginModal(false)}>
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>

              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {isRegistering ? `📝 ${t('createAccount')}` : `🔐 ${t('login')}`}
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {isRegistering && (
                  <>
                    {/* Nom */}
                    <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>Nom *</Text>
                    <TextInput
                      style={[styles.input, isRTL && styles.rtlText, formErrors.nom && styles.inputError]}
                      placeholder="Votre nom de famille"
                      value={registerNom}
                      onChangeText={(text) => { setRegisterNom(text); setFormErrors({...formErrors, nom: ''}); }}
                    />
                    {formErrors.nom && <Text style={styles.errorText}>{formErrors.nom}</Text>}

                    {/* Prénom */}
                    <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>Prénom *</Text>
                    <TextInput
                      style={[styles.input, isRTL && styles.rtlText, formErrors.prenom && styles.inputError]}
                      placeholder="Votre prénom"
                      value={registerPrenom}
                      onChangeText={(text) => { setRegisterPrenom(text); setFormErrors({...formErrors, prenom: ''}); }}
                    />
                    {formErrors.prenom && <Text style={styles.errorText}>{formErrors.prenom}</Text>}

                    {/* Téléphone */}
                    <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>Téléphone *</Text>
                    <TextInput
                      style={[styles.input, isRTL && styles.rtlText, formErrors.telephone && styles.inputError]}
                      placeholder="0612345678"
                      keyboardType="phone-pad"
                      value={registerTelephone}
                      onChangeText={(text) => { setRegisterTelephone(text); setFormErrors({...formErrors, telephone: ''}); }}
                      maxLength={10}
                    />
                    {formErrors.telephone && <Text style={styles.errorText}>{formErrors.telephone}</Text>}

                    {/* Adresse */}
                    <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>Adresse *</Text>
                    <TextInput
                      style={[styles.input, isRTL && styles.rtlText, formErrors.adresse && styles.inputError]}
                      placeholder="Votre adresse postale"
                      value={registerAdresse}
                      onChangeText={(text) => { setRegisterAdresse(text); setFormErrors({...formErrors, adresse: ''}); }}
                    />
                    {formErrors.adresse && <Text style={styles.errorText}>{formErrors.adresse}</Text>}
                  </>
                )}

                {/* Email */}
                <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>{t('email')} *</Text>
                <TextInput
                  style={[styles.input, isRTL && styles.rtlText, formErrors.email && styles.inputError]}
                  placeholder="votre@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={loginEmail}
                  onChangeText={(text) => { setLoginEmail(text); setFormErrors({...formErrors, email: ''}); }}
                />
                {formErrors.email && <Text style={styles.errorText}>{formErrors.email}</Text>}

                {/* Mot de passe */}
                <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>{t('password')} *</Text>
                <TextInput
                  style={[styles.input, isRTL && styles.rtlText, formErrors.password && styles.inputError]}
                  placeholder="••••••••"
                  secureTextEntry
                  value={loginPassword}
                  onChangeText={(text) => { setLoginPassword(text); setFormErrors({...formErrors, password: ''}); }}
                />
                {formErrors.password && <Text style={styles.errorText}>{formErrors.password}</Text>}

              {/* Choix formule (inscription uniquement) */}
              {isRegistering && (
                <>
                  <Text style={[styles.inputLabel, isRTL && styles.rtlText, { marginTop: spacing.md }]}>Formule d'adhésion *</Text>
                  <View style={styles.formuleContainer}>
                    <TouchableOpacity
                      style={[styles.formuleOption, selectedFormule === 'mensuel' && styles.formuleOptionSelected]}
                      onPress={() => setSelectedFormule('mensuel')}
                    >
                      <View style={[styles.formuleRadio, selectedFormule === 'mensuel' && styles.formuleRadioSelected]} />
                      <View>
                        <Text style={styles.formuleTitle}>Mensuel</Text>
                        <Text style={styles.formulePrice}>{formulePrices.mensuel}€</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.formuleOption, selectedFormule === 'annuel' && styles.formuleOptionSelected]}
                      onPress={() => setSelectedFormule('annuel')}
                    >
                      <View style={[styles.formuleRadio, selectedFormule === 'annuel' && styles.formuleRadioSelected]} />
                      <View>
                        <Text style={styles.formuleTitle}>Annuel</Text>
                        <Text style={styles.formulePrice}>{formulePrices.annuel}€/an</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.formuleNote}>
                    💡 Note : Le paiement mensuel n'est pas automatique. Le renouvellement sera à effectuer manuellement chaque mois.
                  </Text>
                </>
              )}

              {/* Checkbox règlement intérieur - uniquement pour inscription */}
              {isRegistering && (
                <TouchableOpacity
                  style={[styles.rulesCheckbox, formErrors.reglement && { borderColor: '#E53935' }]}
                  onPress={() => { setAcceptedRules(!acceptedRules); setFormErrors({...formErrors, reglement: ''}); }}
                >
                  <View style={[styles.checkbox, acceptedRules && styles.checkboxChecked]}>
                    {acceptedRules && <Text style={styles.checkboxCheck}>✓</Text>}
                  </View>
                  <Text style={[styles.rulesText, isRTL && styles.rtlText]}>
                    En devenant membre, j'accepte le règlement intérieur de l'association El Mouhssinine et m'engage à le respecter.
                  </Text>
                </TouchableOpacity>
              )}
              {formErrors.reglement && <Text style={styles.errorText}>{formErrors.reglement}</Text>}

              <TouchableOpacity
                style={[styles.primaryBtn, isRegistering && !acceptedRules && styles.primaryBtnDisabled]}
                onPress={isRegistering ? handleRegister : handleLogin}
                disabled={isRegistering && !acceptedRules}
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
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // Si connecté
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>{t('memberArea')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('welcomeUser')} {member?.name?.split(' ')[0]}</Text>
        </View>

        {/* Carte de membre virtuelle */}
        <MemberCard
          member={memberProfile ? {
            name: memberProfile.name,
            firstName: memberProfile.prenom,
            lastName: memberProfile.nom,
            memberId: memberProfile.memberId,
            membershipExpirationDate: memberProfile.cotisationExpiry,
          } : null}
          onRenew={() => setShowCotisationModal(true)}
          isRTL={isRTL}
        />

        <View style={styles.content}>
          {/* Détails complémentaires du membre */}
          <View style={styles.memberDetailsCard}>
            <View style={[styles.memberDetailRow, isRTL && styles.memberDetailRowRTL]}>
              <Text style={[styles.memberDetailLabel, isRTL && styles.rtlText]}>{t('email')}</Text>
              <Text style={[styles.memberDetailValue, isRTL && styles.rtlText]}>{member?.email}</Text>
            </View>
            <View style={[styles.memberDetailRow, isRTL && styles.memberDetailRowRTL]}>
              <Text style={[styles.memberDetailLabel, isRTL && styles.rtlText]}>{t('type')}</Text>
              <Text style={[styles.memberDetailValue, isRTL && styles.rtlText]}>
                {member?.cotisationType === 'mensuel' ? `${t('monthly')} (${formulePrices.mensuel}€${t('perMonth')})` : `${t('yearly')} (${formulePrices.annuel}€${t('perYear')})`}
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

          {/* Bouton Mes Adhésions */}
          <TouchableOpacity
            style={styles.myMembershipsBtn}
            onPress={() => navigation.navigate('MyMemberships')}
            accessibilityLabel={t('manageMySubscriptions')}
            accessibilityRole="button"
            accessibilityHint={t('viewDetailsAndMembers')}
          >
            <Text style={styles.myMembershipsBtnIcon}>📋</Text>
            <View style={styles.myMembershipsBtnContent}>
              <Text style={[styles.myMembershipsBtnTitle, isRTL && styles.rtlText]}>
                {t('manageMySubscriptions')}
              </Text>
              <Text style={[styles.myMembershipsBtnSubtitle, isRTL && styles.rtlText]}>
                {t('viewDetailsAndMembers')}
              </Text>
            </View>
            <Text style={styles.myMembershipsBtnArrow}>→</Text>
          </TouchableOpacity>

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

          {/* Section : Personnes inscrites par l'utilisateur */}
          {inscribedMembers.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>👥 Mes adhésions</Text>
              <View style={styles.inscribedList}>
                {inscribedMembers.map((m) => (
                  <View key={m.id} style={styles.inscribedItem}>
                    <View style={styles.inscribedInfo}>
                      <Text style={styles.inscribedName}>{m.prenom} {m.nom}</Text>
                      <Text style={styles.inscribedPhone}>{m.telephone}</Text>
                    </View>
                    <View style={[
                      styles.inscribedStatus,
                      m.status === 'actif' ? styles.inscribedStatusActive : styles.inscribedStatusPending
                    ]}>
                      <Text style={[
                        styles.inscribedStatusText,
                        m.status === 'actif' ? styles.inscribedStatusTextActive : styles.inscribedStatusTextPending
                      ]}>
                        {m.status === 'actif' ? '✅ Actif' : '⏳ En attente sign.'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.inscribedNote}>
                Les membres en attente doivent passer au bureau pour signer leur fiche d'adhésion.
              </Text>
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

          {/* Section Multi-membres */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>👥 {t('registerFamily')}</Text>
            <Text style={[styles.sectionSubtitle, isRTL && styles.rtlText]}>
              {t('registerFamilyDesc')}
            </Text>
            <TouchableOpacity
              style={styles.multiMemberBtn}
              onPress={() => setShowMultiMemberModal(true)}
              accessibilityLabel={t('registerOtherMembers')}
              accessibilityRole="button"
              accessibilityHint={t('registerFamilyDesc')}
            >
              <Text style={styles.multiMemberBtnIcon}>👨‍👩‍👧‍👦</Text>
              <View style={styles.multiMemberBtnContent}>
                <Text style={[styles.multiMemberBtnText, isRTL && styles.rtlText]}>
                  {t('registerOtherMembers')}
                </Text>
                <Text style={[styles.multiMemberBtnSubtext, isRTL && styles.rtlText]}>
                  {getFormulePrice()}€ {t('pricePerPerson')}
                </Text>
              </View>
              <Text style={styles.multiMemberBtnArrow}>→</Text>
            </TouchableOpacity>
          </View>

{/* Boutons de test - uniquement en développement */}
          {__DEV__ && (
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
          )}

          {/* Deconnexion */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            accessibilityLabel={t('logout')}
            accessibilityRole="button"
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
              { id: 'virement', icon: '🏦', labelKey: 'bankTransfer', descKey: 'deferredPayment', isApple: false },
              { id: 'especes', icon: '💵', labelKey: 'cashPayment', descKey: 'payAtCounter', isApple: false }
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
              style={[styles.primaryBtn, { marginTop: spacing.lg }, (!paymentMethod || isProcessingPayment) && styles.primaryBtnDisabled]}
              onPress={handlePayCotisation}
              disabled={!paymentMethod || isProcessingPayment}
            >
              {isProcessingPayment ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.primaryBtnText, isRTL && styles.rtlText]}>
                  🔒 {t('payButton')} {formulePrices[cotisationType]}€{cotisationType === 'mensuel' ? t('perMonth') : ''}
                </Text>
              )}
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

      {/* Modal Multi-membres */}
      <Modal visible={showMultiMemberModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.multiMemberScrollView}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.multiMemberModalContent}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setShowMultiMemberModal(false);
                  setAdditionalMembers([]);
                  setMultiMemberStep('form');
                  setSelectedPaymentMethod(null);
                }}
              >
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>

              {/* Indicateur d'étapes */}
              <View style={styles.stepsIndicator}>
                <View style={[styles.stepDot, multiMemberStep === 'form' && styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, multiMemberStep === 'payment' && styles.stepDotActive]} />
              </View>

              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {multiMemberStep === 'form' ? '👥 Inscription groupée' : '💳 Mode de paiement'}
              </Text>
              <Text style={[styles.multiMemberSubtitle, isRTL && styles.rtlText]}>
                {multiMemberStep === 'form'
                  ? 'Inscrivez plusieurs membres en un seul paiement'
                  : `Total à payer : ${getTotalAmount()}€`
                }
              </Text>

              {/* Contenu étape formulaire */}
              {multiMemberStep === 'form' && (
                <>
              {/* Sélecteur de formule */}
              <Text style={[styles.inputLabel, isRTL && styles.rtlText, { marginTop: spacing.md }]}>
                Formule d'adhésion
              </Text>
              <View style={styles.formuleContainer}>
                <TouchableOpacity
                  style={[styles.formuleOption, selectedFormule === 'mensuel' && styles.formuleOptionSelected]}
                  onPress={() => setSelectedFormule('mensuel')}
                >
                  <View style={[styles.formuleRadio, selectedFormule === 'mensuel' && styles.formuleRadioSelected]} />
                  <View>
                    <Text style={styles.formuleTitle}>Mensuel</Text>
                    <Text style={styles.formulePrice}>{formulePrices.mensuel}€/mois</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formuleOption, selectedFormule === 'annuel' && styles.formuleOptionSelected]}
                  onPress={() => setSelectedFormule('annuel')}
                >
                  <View style={[styles.formuleRadio, selectedFormule === 'annuel' && styles.formuleRadioSelected]} />
                  <View>
                    <Text style={styles.formuleTitle}>Annuel</Text>
                    <Text style={styles.formulePrice}>{formulePrices.annuel}€/an</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Option: M'inclure */}
              <TouchableOpacity
                style={[styles.includeMyselfOption, includeMyself && styles.includeMyselfOptionActive]}
                onPress={() => setIncludeMyself(!includeMyself)}
              >
                <View style={[styles.checkbox, includeMyself && styles.checkboxChecked]}>
                  {includeMyself && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <View style={styles.includeMyselfContent}>
                  <Text style={[styles.includeMyselfText, isRTL && styles.rtlText]}>
                    M'inclure dans l'inscription
                  </Text>
                  <Text style={[styles.includeMyselfName, isRTL && styles.rtlText]}>
                    {member?.name} • {getFormulePrice()}€
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Liste des membres supplémentaires */}
              {additionalMembers.map((addMember, index) => (
                <View key={addMember.id} style={styles.additionalMemberCard}>
                  <View style={styles.additionalMemberHeader}>
                    <Text style={[styles.additionalMemberTitle, isRTL && styles.rtlText]}>
                      👤 Membre #{index + 1}
                    </Text>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeAdditionalMember(addMember.id)}
                    >
                      <Text style={styles.removeBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.additionalMemberForm}>
                    <TextInput
                      style={[styles.input, styles.halfInput, isRTL && styles.rtlText]}
                      placeholder="Nom *"
                      placeholderTextColor={colors.textMuted}
                      value={addMember.nom}
                      onChangeText={(v) => updateAdditionalMember(addMember.id, 'nom', v)}
                    />
                    <TextInput
                      style={[styles.input, styles.halfInput, isRTL && styles.rtlText]}
                      placeholder="Prénom *"
                      placeholderTextColor={colors.textMuted}
                      value={addMember.prenom}
                      onChangeText={(v) => updateAdditionalMember(addMember.id, 'prenom', v)}
                    />
                  </View>

                  <TextInput
                    style={[
                      styles.input,
                      isRTL && styles.rtlText,
                      getAdditionalMemberErrors(addMember).telephone && styles.inputError
                    ]}
                    placeholder="Téléphone * (ex: 0612345678)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={addMember.telephone}
                    onChangeText={(v) => updateAdditionalMember(addMember.id, 'telephone', v)}
                    maxLength={10}
                  />
                  {getAdditionalMemberErrors(addMember).telephone && (
                    <Text style={styles.errorText}>{getAdditionalMemberErrors(addMember).telephone}</Text>
                  )}

                  <TextInput
                    style={[styles.input, styles.addressInput, isRTL && styles.rtlText]}
                    placeholder="Adresse complète *"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={2}
                    value={addMember.adresse}
                    onChangeText={(v) => updateAdditionalMember(addMember.id, 'adresse', v)}
                  />

                  {/* Checkbox règlement */}
                  <TouchableOpacity
                    style={styles.memberRulesCheckbox}
                    onPress={() => updateAdditionalMember(addMember.id, 'accepteReglement', !addMember.accepteReglement)}
                  >
                    <View style={[styles.checkbox, styles.checkboxSmall, addMember.accepteReglement && styles.checkboxChecked]}>
                      {addMember.accepteReglement && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                    <Text style={[styles.memberRulesText, isRTL && styles.rtlText]}>
                      Je confirme que cette personne souhaite devenir membre et accepte les statuts et le règlement de l'association. Elle devra passer au bureau signer la fiche d'adhésion pour finaliser son inscription.
                    </Text>
                  </TouchableOpacity>

                  {/* Indicateur de validité */}
                  {!isAdditionalMemberValid(addMember) && (
                    <Text style={styles.validationWarning}>
                      ⚠️ Tous les champs sont obligatoires
                    </Text>
                  )}
                </View>
              ))}

              {/* Bouton ajouter */}
              <TouchableOpacity
                style={styles.addMemberBtn}
                onPress={addAdditionalMember}
              >
                <Text style={styles.addMemberBtnText}>+ Ajouter un membre</Text>
              </TouchableOpacity>
                </>
              )}

              {/* Récapitulatif - visible sur les deux étapes */}
              {getTotalMembersCount() > 0 && (
                <View style={styles.recapCard}>
                  <Text style={[styles.recapTitle, isRTL && styles.rtlText]}>📋 Récapitulatif</Text>

                  {/* Formule sélectionnée */}
                  <View style={[styles.recapRow, isRTL && styles.recapRowRTL]}>
                    <Text style={[styles.recapName, isRTL && styles.rtlText]}>
                      Formule : {selectedFormule === 'mensuel' ? `Mensuel (${formulePrices.mensuel}€)` : `Annuel (${formulePrices.annuel}€/an)`}
                    </Text>
                  </View>

                  {includeMyself && (
                    <View style={[styles.recapRow, isRTL && styles.recapRowRTL]}>
                      <Text style={[styles.recapName, isRTL && styles.rtlText]}>• Moi-même ({member?.name})</Text>
                      <Text style={styles.recapAmount}>{getFormulePrice()}€</Text>
                    </View>
                  )}

                  {additionalMembers.map((m, i) => (
                    <View key={m.id} style={[styles.recapRow, isRTL && styles.recapRowRTL]}>
                      <Text style={[styles.recapName, isRTL && styles.rtlText]}>
                        • {m.prenom || 'Prénom'} {m.nom || 'Nom'}
                        {!isAdditionalMemberValid(m) && ' ⚠️'}
                      </Text>
                      <Text style={styles.recapAmount}>{getFormulePrice()}€</Text>
                    </View>
                  ))}

                  <View style={styles.recapDivider} />

                  <View style={[styles.recapRow, styles.recapTotalRow, isRTL && styles.recapRowRTL]}>
                    <Text style={[styles.recapTotalLabel, isRTL && styles.rtlText]}>TOTAL</Text>
                    <Text style={styles.recapTotalAmount}>{getTotalAmount()}€</Text>
                  </View>
                </View>
              )}

              {/* ÉTAPE 1 : Bouton continuer vers paiement */}
              {multiMemberStep === 'form' && (
                <>
                  <TouchableOpacity
                    style={[styles.primaryBtn, !canProceedToPayment() && styles.primaryBtnDisabled]}
                    onPress={() => setMultiMemberStep('payment')}
                    disabled={!canProceedToPayment()}
                  >
                    <Text style={[styles.primaryBtnText, isRTL && styles.rtlText]}>
                      Continuer → Paiement
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.modalDisclaimer, isRTL && styles.rtlText]}>
                    Les membres inscrits devront passer au bureau de la mosquée pour signer leur fiche d'adhésion.
                  </Text>
                </>
              )}

              {/* ÉTAPE 2 : Choix du mode de paiement */}
              {multiMemberStep === 'payment' && (
                <>
                  <Text style={[styles.inputLabel, isRTL && styles.rtlText, { marginTop: spacing.lg }]}>
                    Choisissez votre mode de paiement
                  </Text>

                  {/* Options de paiement */}
                  {[
                    { id: 'card', icon: '💳', label: 'Carte bancaire', desc: 'Visa, Mastercard' },
                    { id: 'apple', icon: '', label: 'Apple Pay', desc: 'Paiement rapide', isApple: true },
                    { id: 'virement', icon: '🏦', label: 'Virement bancaire', desc: 'Paiement différé' },
                    { id: 'especes', icon: '💵', label: 'Espèces', desc: 'Payer au comptoir' },
                  ].map((method) => (
                    <TouchableOpacity
                      key={method.id}
                      style={[
                        styles.paymentOption,
                        selectedPaymentMethod === method.id && styles.paymentOptionSelected,
                        method.isApple && styles.applePayOption,
                      ]}
                      onPress={() => setSelectedPaymentMethod(method.id)}
                    >
                      {method.isApple ? (
                        <Image
                          source={require('../assets/apple-logo.png')}
                          style={styles.appleLogo}
                        />
                      ) : (
                        <Text style={styles.paymentIcon}>{method.icon}</Text>
                      )}
                      <View style={styles.paymentInfo}>
                        <Text style={[styles.paymentTitle, method.isApple && styles.applePayText]}>
                          {method.label}
                        </Text>
                        <Text style={[styles.paymentDesc, method.isApple && styles.applePayTextMuted]}>
                          {method.desc}
                        </Text>
                      </View>
                      {selectedPaymentMethod === method.id && (
                        <View style={styles.checkmark}>
                          <Text style={styles.checkmarkText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}

                  {/* Boutons retour + payer */}
                  <View style={styles.paymentButtonsRow}>
                    <TouchableOpacity
                      style={styles.backStepBtn}
                      onPress={() => setMultiMemberStep('form')}
                    >
                      <Text style={styles.backStepBtnText}>← Retour</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.payNowBtn, (!selectedPaymentMethod || isProcessingPayment) && styles.primaryBtnDisabled]}
                      onPress={handlePayMultipleMembers}
                      disabled={!selectedPaymentMethod || isProcessingPayment}
                    >
                      {isProcessingPayment ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>
                          🔒 Payer {getTotalAmount()}€
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.modalDisclaimer, isRTL && styles.rtlText]}>
                    Paiement sécurisé • Les membres devront signer au bureau de la mosquée
                  </Text>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  // Member card (legacy - unused)
  memberCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  // Détails complémentaires du membre (nouvelle version simplifiée)
  memberDetailsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
  // Inscribed members section
  inscribedList: {
    gap: spacing.sm,
  },
  inscribedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  inscribedInfo: {
    flex: 1,
  },
  inscribedName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  inscribedPhone: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  inscribedStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  inscribedStatusActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  inscribedStatusPending: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  inscribedStatusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  inscribedStatusTextActive: {
    color: '#4CAF50',
  },
  inscribedStatusTextPending: {
    color: '#FF9800',
  },
  inscribedNote: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  // Buttons
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: isSmallScreen ? fontSize.md : fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: borderRadius.lg,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  secondaryBtnText: {
    fontSize: isSmallScreen ? fontSize.md : fontSize.lg,
    fontWeight: '600',
    color: colors.accent,
  },
  cancelBtn: {
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: borderRadius.lg,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cancelBtnText: {
    fontSize: isSmallScreen ? fontSize.md : fontSize.lg,
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
    padding: isSmallScreen ? spacing.lg : spacing.xxl,
    width: isSmallScreen ? '96%' : '92%', // Plus large sur petits écrans
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
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  inputError: {
    borderColor: '#E53935',
    borderWidth: 2,
  },
  errorText: {
    color: '#E53935',
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  formuleContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  formuleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formuleOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(0, 150, 136, 0.1)',
  },
  formuleRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: spacing.sm,
  },
  formuleRadioSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  formuleTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#333',
  },
  formulePrice: {
    fontSize: fontSize.sm,
    color: '#666',
  },
  formuleNote: {
    fontSize: fontSize.xs,
    color: '#888',
    fontStyle: 'italic',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
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
    padding: isSmallScreen ? spacing.md : spacing.lg,
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
    padding: isSmallScreen ? spacing.md : spacing.lg,
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
    padding: isSmallScreen ? spacing.md : spacing.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: spacing.md,
  },
  cancelConfirmBtnText: {
    fontSize: isSmallScreen ? fontSize.md : fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  keepSubscriptionBtn: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.lg,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  keepSubscriptionBtnText: {
    fontSize: isSmallScreen ? fontSize.md : fontSize.lg,
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
  // Checkbox règlement intérieur
  rulesCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
  },
  checkboxCheck: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rulesText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // ==================== MULTI-ADHERENTS STYLES ====================
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  multiMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  multiMemberBtnIcon: {
    fontSize: isSmallScreen ? 26 : 32,
    marginRight: spacing.md,
  },
  multiMemberBtnContent: {
    flex: 1,
  },
  multiMemberBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  multiMemberBtnSubtext: {
    fontSize: fontSize.sm,
    color: colors.accent,
    marginTop: 2,
  },
  multiMemberBtnArrow: {
    fontSize: fontSize.xl,
    color: colors.accent,
  },
  // Multi-member modal
  multiMemberScrollView: {
    flex: 1,
    width: '100%',
  },
  multiMemberModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: isSmallScreen ? spacing.md : spacing.xl,
    margin: isSmallScreen ? spacing.sm : spacing.lg,
    marginTop: isSmallScreen ? 40 : 60,
    marginBottom: isSmallScreen ? 20 : 40,
  },
  multiMemberSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  includeMyselfOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.lg,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  includeMyselfOptionActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(201,162,39,0.08)',
  },
  includeMyselfContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  includeMyselfText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  includeMyselfName: {
    fontSize: fontSize.sm,
    color: colors.accent,
    marginTop: 2,
  },
  // Additional member card
  additionalMemberCard: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.lg,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  additionalMemberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  additionalMemberTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  removeBtn: {
    padding: spacing.sm,
  },
  removeBtnText: {
    fontSize: 18,
  },
  additionalMemberForm: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  addressInput: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  memberRulesCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  checkboxSmall: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  memberRulesText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 16,
    marginLeft: spacing.sm,
  },
  validationWarning: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.sm,
  },
  // Add member button
  addMemberBtn: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    padding: isSmallScreen ? spacing.md : spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  addMemberBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
  },
  // Recap card
  recapCard: {
    backgroundColor: 'rgba(201,162,39,0.08)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
  },
  recapTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  recapRowRTL: {
    flexDirection: 'row-reverse',
  },
  recapName: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  recapAmount: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
  },
  recapDivider: {
    height: 1,
    backgroundColor: 'rgba(201,162,39,0.3)',
    marginVertical: spacing.md,
  },
  recapTotalRow: {
    paddingVertical: spacing.sm,
  },
  recapTotalLabel: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  recapTotalAmount: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.accent,
  },
  // Steps indicator
  stepsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(201,162,39,0.3)',
  },
  stepDotActive: {
    backgroundColor: colors.accent,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(201,162,39,0.3)',
    marginHorizontal: spacing.sm,
  },
  // Payment buttons row
  paymentButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  backStepBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  backStepBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
  },
  payNowBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  // Bouton Mes Adhésions
  myMembershipsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.accent,
    ...platformShadow(2),
  },
  myMembershipsBtnIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  myMembershipsBtnContent: {
    flex: 1,
  },
  myMembershipsBtnTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent,
  },
  myMembershipsBtnSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  myMembershipsBtnArrow: {
    fontSize: 24,
    color: colors.accent,
    fontWeight: 'bold',
  },
});

export default MemberScreen;
