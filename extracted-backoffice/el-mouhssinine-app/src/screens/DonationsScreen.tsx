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
import { subscribeToProjects, getMosqueeInfo, createDonation } from '../services/firebase';
import { Project, MosqueeInfo } from '../types';
import Clipboard from '@react-native-clipboard/clipboard';

const DonationsScreen = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectType, setProjectType] = useState<'interne' | 'externe'>('interne');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showRIBModal, setShowRIBModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showZakatModal, setShowZakatModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [mosqueeInfo, setMosqueeInfo] = useState<MosqueeInfo | null>(null);
  const [copied, setCopied] = useState('');
  
  // Zakat
  const [zakatEpargne, setZakatEpargne] = useState('');
  const [zakatOr, setZakatOr] = useState('');
  const [zakatArgent, setZakatArgent] = useState('');

  const amounts = [10, 20, 50, 100, 200, 500];
  const nisab = 5000;

  // Données par défaut
  const defaultInternalProjects: Project[] = [
    { id: '1', name: 'Rénovation Salle de Prière', description: 'Travaux de rénovation et isolation thermique', goal: 15000, raised: 8500, icon: '🕌', isExternal: false, isActive: true },
    { id: '2', name: 'Aide aux Nécessiteux', description: 'Distribution alimentaire mensuelle', goal: 5000, raised: 3200, icon: '🤲', isExternal: false, isActive: true },
    { id: '3', name: 'École du Dimanche', description: 'Matériel pédagogique et fournitures', goal: 3000, raised: 1800, icon: '📚', isExternal: false, isActive: true },
  ];

  const defaultExternalProjects: Project[] = [
    { id: 'ext1', name: 'Mosquée de Gaza', description: 'Reconstruction après les bombardements', goal: 50000, raised: 32000, icon: '🇵🇸', lieu: 'Palestine', iban: 'PS92 PALS 0000 0400 0123 4567 890', isExternal: true, isActive: true },
    { id: 'ext2', name: 'Mosquée Al-Nour Lyon', description: 'Achat de nouveaux locaux', goal: 100000, raised: 45000, icon: '🏗️', lieu: 'Lyon, France', iban: 'FR76 3000 4028 3700 0100 0000 123', isExternal: true, isActive: true },
    { id: 'ext3', name: 'Puits au Sénégal', description: 'Construction de puits pour villages', goal: 8000, raised: 6500, icon: '💧', lieu: 'Sénégal', iban: 'SN08 S020 1101 0000 0012 3456 789', isExternal: true, isActive: true },
  ];

  useEffect(() => {
    const unsubProjects = subscribeToProjects((fetchedProjects) => {
      if (fetchedProjects.length > 0) {
        setProjects(fetchedProjects);
      }
    });

    getMosqueeInfo().then((info) => {
      if (info) setMosqueeInfo(info);
    });

    return () => unsubProjects();
  }, []);

  const displayProjects = projectType === 'interne' 
    ? (projects.filter(p => !p.isExternal).length > 0 ? projects.filter(p => !p.isExternal) : defaultInternalProjects)
    : (projects.filter(p => p.isExternal).length > 0 ? projects.filter(p => p.isExternal) : defaultExternalProjects);

  const getProgress = (raised: number, goal: number) => Math.min((raised / goal) * 100, 100);

  const getFinalAmount = () => {
    if (customAmount && parseFloat(customAmount) > 0) {
      return parseFloat(customAmount);
    }
    return selectedAmount || 0;
  };

  const getSelectedProjectData = () => {
    return [...defaultInternalProjects, ...defaultExternalProjects, ...projects].find(p => p.id === selectedProject);
  };

  const copyToClipboard = (text: string, field: string) => {
    Clipboard.setString(text.replace(/\s/g, ''));
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const handlePayment = async () => {
    if (!selectedProject || getFinalAmount() <= 0) return;
    
    // TODO: Intégrer Stripe
    Alert.alert('Paiement', 'Redirection vers le paiement...');
  };

  // Calcul Zakat
  const totalWealth = (parseFloat(zakatEpargne) || 0) + (parseFloat(zakatOr) || 0) + (parseFloat(zakatArgent) || 0);
  const zakatAmount = totalWealth >= nisab ? (totalWealth * 0.025) : 0;
  const isZakatEligible = totalWealth >= nisab;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Faire un Don</Text>
          <Text style={styles.subtitle}>Contribuez aux projets de notre communauté</Text>
        </View>

        <View style={styles.content}>
          {/* Toggle */}
          <View style={styles.tabToggle}>
            <TouchableOpacity
              style={[styles.tabBtn, projectType === 'interne' && styles.tabBtnActive]}
              onPress={() => { setProjectType('interne'); setSelectedProject(null); }}
            >
              <Text style={[styles.tabBtnText, projectType === 'interne' && styles.tabBtnTextActive]}>
                🕌 Notre Mosquée
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, projectType === 'externe' && styles.tabBtnActive]}
              onPress={() => { setProjectType('externe'); setSelectedProject(null); }}
            >
              <Text style={[styles.tabBtnText, projectType === 'externe' && styles.tabBtnTextActive]}>
                🌍 Autres Causes
              </Text>
            </TouchableOpacity>
          </View>

          {/* Projets */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {projectType === 'interne' ? 'Choisir un projet' : 'Aider d\'autres causes'}
            </Text>
            {displayProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={[styles.projectCard, selectedProject === project.id && styles.projectCardSelected]}
                onPress={() => setSelectedProject(project.id)}
              >
                <View style={styles.projectHeader}>
                  <View style={styles.projectIcon}>
                    <Text style={styles.projectIconText}>{project.icon}</Text>
                  </View>
                  <View style={styles.projectInfo}>
                    {project.lieu && (
                      <Text style={styles.projectLieu}>📍 {project.lieu}</Text>
                    )}
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.projectDescription}>{project.description}</Text>
                  </View>
                  {selectedProject === project.id && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${getProgress(project.raised, project.goal)}%` }]} />
                </View>
                <View style={styles.progressInfo}>
                  <Text style={styles.progressRaised}>{project.raised.toLocaleString()}€</Text>
                  <Text style={styles.progressGoal}>Objectif: {project.goal.toLocaleString()}€</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Montants */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Montant du don</Text>
            <View style={styles.amountsGrid}>
              {amounts.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.amountBtn,
                    selectedAmount === amount && !customAmount && styles.amountBtnSelected,
                  ]}
                  onPress={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                >
                  <Text style={[
                    styles.amountBtnText,
                    selectedAmount === amount && !customAmount && styles.amountBtnTextSelected,
                  ]}>
                    {amount}€
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Montant libre */}
            <Text style={styles.customAmountLabel}>Ou saisissez un montant libre :</Text>
            <View style={[styles.customAmountWrapper, customAmount ? styles.customAmountWrapperActive : null]}>
              <TextInput
                style={styles.customAmountInput}
                placeholder="Autre montant"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={customAmount}
                onChangeText={(text) => { setCustomAmount(text); setSelectedAmount(null); }}
              />
              <Text style={styles.customAmountSuffix}>€</Text>
            </View>
          </View>

          {/* Boutons */}
          <TouchableOpacity
            style={[styles.primaryBtn, (!selectedProject || getFinalAmount() <= 0) && styles.primaryBtnDisabled]}
            onPress={() => setShowPaymentModal(true)}
            disabled={!selectedProject || getFinalAmount() <= 0}
          >
            <Text style={styles.primaryBtnText}>
              💳 Payer {getFinalAmount() > 0 ? `${getFinalAmount()}€` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowRIBModal(true)}>
            <Text style={styles.secondaryBtnText}>🏦 Faire un virement</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.secondaryBtn, styles.zakatBtn]} 
            onPress={() => setShowZakatModal(true)}
          >
            <Text style={[styles.secondaryBtnText, styles.zakatBtnText]}>🧮 Calculer ma Zakat</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Les dons sont sécurisés et peuvent être déductibles d'impôts selon la réglementation en vigueur.
          </Text>
        </View>
      </ScrollView>

      {/* Modal RIB */}
      <Modal visible={showRIBModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowRIBModal(false)}>
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>🏦 Virement bancaire</Text>
            
            <View style={styles.ribCard}>
              <View style={styles.ribHeader}>
                <Text style={styles.ribIcon}>🕌</Text>
                <Text style={styles.ribTitulaire}>
                  {mosqueeInfo?.accountHolder || 'Association El Mouhssinine'}
                </Text>
                <Text style={styles.ribBanque}>
                  {mosqueeInfo?.bankName || 'Crédit Agricole'}
                </Text>
              </View>
              
              <View style={styles.ribRow}>
                <View>
                  <Text style={styles.ribLabel}>IBAN</Text>
                  <Text style={styles.ribValue}>
                    {mosqueeInfo?.iban || 'FR76 1234 5678 9012 3456 7890 123'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(mosqueeInfo?.iban || 'FR76123456789012345678901', 'iban')}
                >
                  <Text style={styles.copyBtnText}>{copied === 'iban' ? '✓' : '📋'}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={[styles.ribRow, styles.ribRowLast]}>
                <View>
                  <Text style={styles.ribLabel}>BIC</Text>
                  <Text style={styles.ribValue}>{mosqueeInfo?.bic || 'AGRIFRPP'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(mosqueeInfo?.bic || 'AGRIFRPP', 'bic')}
                >
                  <Text style={styles.copyBtnText}>{copied === 'bic' ? '✓' : '📋'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.modalDisclaimer}>
              Indiquez votre email en référence pour recevoir votre reçu fiscal
            </Text>
          </View>
        </View>
      </Modal>

      {/* Modal Paiement */}
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowPaymentModal(false)}>
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>💳 Don de {getFinalAmount()}€</Text>

            {getSelectedProjectData() && (
              <View style={styles.paymentProjectInfo}>
                <Text style={styles.paymentProjectIcon}>{getSelectedProjectData()?.icon}</Text>
                <View>
                  <Text style={styles.paymentProjectName}>{getSelectedProjectData()?.name}</Text>
                  {getSelectedProjectData()?.lieu && (
                    <Text style={styles.paymentProjectLieu}>📍 {getSelectedProjectData()?.lieu}</Text>
                  )}
                </View>
              </View>
            )}

            {['card', 'apple', 'google'].map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.paymentOption, paymentMethod === method && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text style={styles.paymentIcon}>
                  {method === 'card' ? '💳' : method === 'apple' ? '🍎' : '🟢'}
                </Text>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>
                    {method === 'card' ? 'Carte bancaire' : method === 'apple' ? 'Apple Pay' : 'Google Pay'}
                  </Text>
                  <Text style={styles.paymentDesc}>
                    {method === 'card' ? 'Visa, Mastercard, CB' : 'Paiement rapide et sécurisé'}
                  </Text>
                </View>
                {paymentMethod === method && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 20 }, !paymentMethod && styles.primaryBtnDisabled]}
              onPress={handlePayment}
              disabled={!paymentMethod}
            >
              <Text style={styles.primaryBtnText}>🔒 Payer {getFinalAmount()}€</Text>
            </TouchableOpacity>

            <Text style={styles.modalDisclaimer}>
              Paiement sécurisé par Stripe • Reçu fiscal envoyé par email
            </Text>
          </View>
        </View>
      </Modal>

      {/* Modal Zakat */}
      <Modal visible={showZakatModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowZakatModal(false)}>
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>🧮 Calculateur de Zakat</Text>

              <View style={styles.nisabInfo}>
                <Text style={styles.nisabText}>
                  <Text style={styles.nisabBold}>📌 Nisab actuel : </Text>
                  ~{nisab.toLocaleString()}€
                </Text>
                <Text style={styles.nisabSubtext}>(Valeur de 85g d'or ou 595g d'argent)</Text>
              </View>

              <Text style={styles.inputLabel}>💰 Épargne (comptes bancaires)</Text>
              <TextInput
                style={styles.zakatInput}
                placeholder="0"
                keyboardType="numeric"
                value={zakatEpargne}
                onChangeText={setZakatEpargne}
              />

              <Text style={styles.inputLabel}>🥇 Valeur de l'or possédé</Text>
              <TextInput
                style={styles.zakatInput}
                placeholder="0"
                keyboardType="numeric"
                value={zakatOr}
                onChangeText={setZakatOr}
              />

              <Text style={styles.inputLabel}>🥈 Valeur de l'argent possédé</Text>
              <TextInput
                style={styles.zakatInput}
                placeholder="0"
                keyboardType="numeric"
                value={zakatArgent}
                onChangeText={setZakatArgent}
              />

              <View style={[styles.zakatResult, isZakatEligible && styles.zakatResultEligible]}>
                <Text style={styles.zakatTotalLabel}>Total des biens : {totalWealth.toLocaleString()}€</Text>
                {isZakatEligible ? (
                  <>
                    <Text style={styles.zakatEligibleText}>✓ Vous êtes redevable de la Zakat</Text>
                    <Text style={styles.zakatAmountText}>{zakatAmount.toFixed(2)}€</Text>
                    <Text style={styles.zakatPercent}>(2.5% de vos biens)</Text>
                  </>
                ) : (
                  <Text style={styles.zakatNotEligible}>
                    Vos biens n'atteignent pas le Nisab.{'\n'}La Zakat n'est pas obligatoire.
                  </Text>
                )}
              </View>

              {isZakatEligible && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    setSelectedAmount(Math.ceil(zakatAmount));
                    setShowZakatModal(false);
                  }}
                >
                  <Text style={styles.primaryBtnText}>💝 Donner ma Zakat ({zakatAmount.toFixed(0)}€)</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.modalDisclaimer}>
                Ce calcul est une estimation. Consultez un savant pour plus de précision.
              </Text>
            </View>
          </ScrollView>
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
    color: 'rgba(255,255,255,0.8)',
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
  disclaimer: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
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
  ribValue: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
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
  // Zakat
  nisabInfo: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
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
  inputLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  zakatInput: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  zakatResult: {
    backgroundColor: '#f8f8fa',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
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
});

export default DonationsScreen;
