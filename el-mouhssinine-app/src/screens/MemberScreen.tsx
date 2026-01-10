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
} from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { getMember, updateMember, createMember } from '../services/firebase';
import { Member } from '../types';

const MemberScreen = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Simulé - à remplacer par Firebase Auth
  const [member, setMember] = useState<Member | null>({
    id: '1',
    name: 'Faïcal Kriouar',
    email: 'faical@example.com',
    phone: '06 XX XX XX XX',
    memberId: 'ELM-2024-0042',
    cotisationType: 'mensuel',
    cotisationStatus: 'active',
    nextPaymentDate: new Date('2026-02-01'),
    createdAt: new Date('2024-03-15'),
  });
  
  const [showCotisationModal, setShowCotisationModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [cotisationType, setCotisationType] = useState<'mensuel' | 'annuel'>('mensuel');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerName, setRegisterName] = useState('');

  // Test - toggle status
  const [isPaid, setIsPaid] = useState(true);

  const cotisationOptions = [
    { id: 'mensuel', label: 'Mensuel', amount: 10, description: '10€/mois - Prélèvement automatique' },
    { id: 'annuel', label: 'Annuel', amount: 100, description: '100€/an - Paiement unique' },
  ];

  const handlePayCotisation = () => {
    if (!paymentMethod) return;
    // TODO: Intégrer Stripe
    Alert.alert('Paiement', 'Redirection vers le paiement...');
    setShowCotisationModal(false);
  };

  const handleCancelSubscription = async () => {
    // TODO: Annuler via Stripe API
    Alert.alert(
      'Abonnement annulé',
      'Votre abonnement sera actif jusqu\'à la fin de la période en cours.',
      [{ text: 'OK', onPress: () => setShowCancelModal(false) }]
    );
  };

  const handleLogin = async () => {
    // TODO: Firebase Auth
    setIsLoggedIn(true);
    setShowLoginModal(false);
  };

  const handleRegister = async () => {
    // TODO: Firebase Auth + Firestore
    setIsLoggedIn(true);
    setShowLoginModal(false);
  };

  // Si non connecté
  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Espace Adhérent</Text>
          <Text style={styles.subtitle}>Gérez votre adhésion</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.notLoggedInCard}>
            <Text style={styles.notLoggedInIcon}>👤</Text>
            <Text style={styles.notLoggedInTitle}>Connectez-vous</Text>
            <Text style={styles.notLoggedInText}>
              Accédez à votre espace adhérent pour gérer votre cotisation et voir votre historique.
            </Text>
            
            <TouchableOpacity 
              style={styles.primaryBtn}
              onPress={() => { setIsRegistering(false); setShowLoginModal(true); }}
            >
              <Text style={styles.primaryBtnText}>Se connecter</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryBtn}
              onPress={() => { setIsRegistering(true); setShowLoginModal(true); }}
            >
              <Text style={styles.secondaryBtnText}>Créer un compte</Text>
            </TouchableOpacity>
          </View>

          {/* Avantages */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✨ Avantages adhérents</Text>
            {[
              { icon: '📧', text: 'Reçu fiscal automatique' },
              { icon: '🎓', text: 'Tarifs réduits cours & activités' },
              { icon: '🗳️', text: 'Droit de vote en AG' },
              { icon: '🔔', text: 'Notifications prioritaires' },
            ].map((item, index) => (
              <View key={index} style={styles.advantageItem}>
                <Text style={styles.advantageIcon}>{item.icon}</Text>
                <Text style={styles.advantageText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Modal Login/Register */}
        <Modal visible={showLoginModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLoginModal(false)}>
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>
                {isRegistering ? '📝 Créer un compte' : '🔐 Connexion'}
              </Text>

              {isRegistering && (
                <>
                  <Text style={styles.inputLabel}>Nom complet</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Votre nom"
                    value={registerName}
                    onChangeText={setRegisterName}
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={loginEmail}
                onChangeText={setLoginEmail}
              />

              <Text style={styles.inputLabel}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                secureTextEntry
                value={loginPassword}
                onChangeText={setLoginPassword}
              />

              <TouchableOpacity 
                style={styles.primaryBtn}
                onPress={isRegistering ? handleRegister : handleLogin}
              >
                <Text style={styles.primaryBtnText}>
                  {isRegistering ? 'Créer mon compte' : 'Se connecter'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
                <Text style={styles.switchAuthText}>
                  {isRegistering 
                    ? 'Déjà un compte ? Se connecter' 
                    : 'Pas de compte ? S\'inscrire'}
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
          <Text style={styles.title}>Espace Adhérent</Text>
          <Text style={styles.subtitle}>Bienvenue, {member?.name?.split(' ')[0]}</Text>
        </View>

        <View style={styles.content}>
          {/* Carte membre */}
          <View style={styles.memberCard}>
            <View style={styles.memberHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {member?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member?.name}</Text>
                <Text style={styles.memberEmail}>{member?.email}</Text>
              </View>
              <View style={[
                styles.statusBadge, 
                isPaid ? styles.statusBadgeActive : styles.statusBadgeExpired
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  isPaid ? styles.statusBadgeTextActive : styles.statusBadgeTextExpired
                ]}>
                  {isPaid ? '✓ À jour' : '✗ Expiré'}
                </Text>
              </View>
            </View>

            <View style={styles.memberDetails}>
              <View style={styles.memberDetailRow}>
                <Text style={styles.memberDetailLabel}>N° Adhérent</Text>
                <Text style={styles.memberDetailValue}>{member?.memberId}</Text>
              </View>
              <View style={styles.memberDetailRow}>
                <Text style={styles.memberDetailLabel}>Type</Text>
                <Text style={styles.memberDetailValue}>
                  {member?.cotisationType === 'mensuel' ? 'Mensuel (10€/mois)' : 'Annuel (100€/an)'}
                </Text>
              </View>
              {isPaid && member?.nextPaymentDate && (
                <View style={styles.memberDetailRow}>
                  <Text style={styles.memberDetailLabel}>Prochain paiement</Text>
                  <Text style={styles.memberDetailValue}>
                    {member.nextPaymentDate.toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Alerte si non payé */}
          {!isPaid && (
            <View style={styles.alertCard}>
              <Text style={styles.alertIcon}>⚠️</Text>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Cotisation expirée</Text>
                <Text style={styles.alertText}>
                  Renouvelez votre adhésion pour continuer à bénéficier des avantages.
                </Text>
              </View>
            </View>
          )}

          {/* Boutons cotisation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isPaid ? '💳 Ma cotisation' : '💳 Renouveler'}
            </Text>
            
            {!isPaid ? (
              <TouchableOpacity 
                style={styles.primaryBtn}
                onPress={() => setShowCotisationModal(true)}
              >
                <Text style={styles.primaryBtnText}>Payer ma cotisation</Text>
              </TouchableOpacity>
            ) : (
              <>
                {member?.cotisationType === 'mensuel' && (
                  <TouchableOpacity 
                    style={styles.cancelBtn}
                    onPress={() => setShowCancelModal(true)}
                  >
                    <Text style={styles.cancelBtnText}>Annuler mon abonnement</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={styles.secondaryBtn}
                  onPress={() => setShowCotisationModal(true)}
                >
                  <Text style={styles.secondaryBtnText}>Changer de formule</Text>
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

          {/* Déconnexion */}
          <TouchableOpacity 
            style={styles.logoutBtn}
            onPress={() => setIsLoggedIn(false)}
          >
            <Text style={styles.logoutBtnText}>🚪 Se déconnecter</Text>
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
            
            <Text style={styles.modalTitle}>💳 Cotisation annuelle</Text>

            {/* Options */}
            <Text style={styles.inputLabel}>Choisir une formule</Text>
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
              <Text style={styles.mensuelNote}>
                ✓ Sans engagement - Annulable à tout moment depuis l'application
              </Text>
            )}

            {/* Méthodes de paiement */}
            <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Mode de paiement</Text>
            {[
              { id: 'card', icon: '💳', label: 'Carte bancaire', desc: 'Visa, Mastercard, CB' },
              { id: 'apple', icon: '🍎', label: 'Apple Pay', desc: 'Paiement rapide' },
              ...(cotisationType === 'mensuel' ? [
                { id: 'sepa', icon: '🏦', label: 'Prélèvement SEPA', desc: 'Compte bancaire' }
              ] : [])
            ].map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentOption,
                  paymentMethod === method.id && styles.paymentOptionSelected
                ]}
                onPress={() => setPaymentMethod(method.id)}
              >
                <Text style={styles.paymentIcon}>{method.icon}</Text>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>{method.label}</Text>
                  <Text style={styles.paymentDesc}>{method.desc}</Text>
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
              <Text style={styles.primaryBtnText}>
                🔒 Payer {cotisationType === 'mensuel' ? '10€/mois' : '100€'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalDisclaimer}>
              {cotisationType === 'mensuel' 
                ? 'Vous pouvez annuler à tout moment • Reçu fiscal annuel'
                : 'Paiement sécurisé par Stripe • Reçu fiscal envoyé par email'
              }
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
              <Text style={styles.cancelTitle}>Annuler l'abonnement ?</Text>
              <Text style={styles.cancelText}>
                Êtes-vous sûr de vouloir annuler votre abonnement mensuel ?
              </Text>

              <View style={styles.cancelConsequences}>
                {[
                  'Annulation effective immédiatement',
                  'Plus aucun prélèvement',
                  'Statut actif jusqu\'au ' + (member?.nextPaymentDate?.toLocaleDateString('fr-FR') || '—'),
                  'Réabonnement possible à tout moment',
                ].map((item, index) => (
                  <View key={index} style={styles.cancelConsequenceItem}>
                    <Text style={styles.cancelConsequenceBullet}>•</Text>
                    <Text style={styles.cancelConsequenceText}>{item}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.cancelConfirmBtn}
                onPress={handleCancelSubscription}
              >
                <Text style={styles.cancelConfirmBtnText}>Confirmer l'annulation</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.keepSubscriptionBtn}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.keepSubscriptionBtnText}>Garder mon abonnement</Text>
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
});

export default MemberScreen;
