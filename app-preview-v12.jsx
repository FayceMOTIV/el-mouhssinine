import React, { useState } from 'react';

// Couleurs du thème El Mouhssinine - Thème clair
const colors = {
  background: '#7f4f24',
  surface: '#ffffff',
  card: '#ffffff',
  accent: '#c9a227',
  text: '#1a1a2e',
  textSecondary: '#4a4a68',
  textMuted: '#8e8ea0',
  border: 'rgba(0,0,0,0.08)',
  success: '#27ae60',
  primary: '#ffffff',
};

// Données RIB de la mosquée
const mosqueeRIB = {
  banque: 'Crédit Agricole',
  titulaire: 'Association El Mouhssinine',
  iban: 'FR76 1234 5678 9012 3456 7890 123',
  bic: 'AGRIFRPP',
};

// Projets internes mosquée
const projetsInternes = [
  { id: '1', name: 'Rénovation Salle de Prière', description: 'Travaux de rénovation et isolation thermique', goal: 15000, raised: 8500, icon: '🕌' },
  { id: '2', name: 'Aide aux Nécessiteux', description: 'Distribution alimentaire mensuelle', goal: 5000, raised: 3200, icon: '🤲' },
  { id: '3', name: 'École du Dimanche', description: 'Matériel pédagogique et fournitures', goal: 3000, raised: 1800, icon: '📚' },
];

// Projets externes (autres mosquées/causes)
const projetsExternes = [
  { id: 'ext1', name: 'Mosquée de Gaza', description: 'Reconstruction après les bombardements', goal: 50000, raised: 32000, icon: '🇵🇸', lieu: 'Palestine', iban: 'PS92 PALS 0000 0400 0123 4567 890' },
  { id: 'ext2', name: 'Mosquée Al-Nour Lyon', description: 'Achat de nouveaux locaux', goal: 100000, raised: 45000, icon: '🏗️', lieu: 'Lyon, France', iban: 'FR76 3000 4028 3700 0100 0000 123' },
  { id: 'ext3', name: 'Puits au Sénégal', description: 'Construction de puits pour villages', goal: 8000, raised: 6500, icon: '💧', lieu: 'Sénégal', iban: 'SN08 S020 1101 0000 0012 3456 789' },
];

// Horaires de prière (simulés)
const prayerTimes = [
  { name: 'Fajr', time: '06:45', icon: '🌅' },
  { name: 'Dhuhr', time: '13:15', icon: '☀️' },
  { name: 'Asr', time: '15:45', icon: '🌤️' },
  { name: 'Maghrib', time: '18:02', icon: '🌅' },
  { name: 'Isha', time: '19:30', icon: '🌙' },
];

// Calendrier Hégirien
const islamicDates = [
  { name: 'Ramadan', date: '1er Ramadan 1447', gregorian: '28 Février 2026', daysLeft: 50, icon: '🌙' },
  { name: 'Aïd al-Fitr', date: '1er Chawwal 1447', gregorian: '30 Mars 2026', daysLeft: 80, icon: '🎉' },
  { name: 'Aïd al-Adha', date: '10 Dhul Hijja 1447', gregorian: '6 Juin 2026', daysLeft: 148, icon: '🐑' },
];

const todayHijri = {
  day: '9',
  month: 'Rajab',
  year: '1447',
  gregorian: '9 Janvier 2026'
};

// Sourates populaires
const sourates = [
  { id: 1, name: 'Al-Fatiha', nameAr: 'الفاتحة', verses: 7, type: 'Mecquoise' },
  { id: 36, name: 'Ya-Sin', nameAr: 'يس', verses: 83, type: 'Mecquoise' },
  { id: 55, name: 'Ar-Rahman', nameAr: 'الرحمن', verses: 78, type: 'Médinoise' },
  { id: 56, name: 'Al-Waqi\'a', nameAr: 'الواقعة', verses: 96, type: 'Mecquoise' },
  { id: 67, name: 'Al-Mulk', nameAr: 'الملك', verses: 30, type: 'Mecquoise' },
  { id: 112, name: 'Al-Ikhlas', nameAr: 'الإخلاص', verses: 4, type: 'Mecquoise' },
  { id: 113, name: 'Al-Falaq', nameAr: 'الفلق', verses: 5, type: 'Mecquoise' },
  { id: 114, name: 'An-Nas', nameAr: 'الناس', verses: 6, type: 'Mecquoise' },
];

// Invocations
const duas = [
  { id: 1, name: 'Adhkar du matin', nameAr: 'أذكار الصباح', icon: '🌅', count: 12 },
  { id: 2, name: 'Adhkar du soir', nameAr: 'أذكار المساء', icon: '🌆', count: 12 },
  { id: 3, name: 'Après la prière', nameAr: 'بعد الصلاة', icon: '🤲', count: 8 },
  { id: 4, name: 'Avant de dormir', nameAr: 'قبل النوم', icon: '😴', count: 6 },
  { id: 5, name: 'Protection', nameAr: 'الحماية', icon: '🛡️', count: 5 },
];

// Options cotisation
const cotisationOptions = [
  { id: 'mensuel', label: 'Mensuel', amount: 10, description: '10€/mois - Prélèvement automatique' },
  { id: 'annuel', label: 'Annuel', amount: 100, description: '100€/an - Paiement unique' },
];

export default function ElMouhssinineApp() {
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [projectType, setProjectType] = useState('interne');
  const [showRIBModal, setShowRIBModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [copied, setCopied] = useState('');
  
  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifMinutes, setNotifMinutes] = useState(10);
  const [adhanSound, setAdhanSound] = useState(true);
  const [jumuaReminder, setJumuaReminder] = useState(true);
  
  // Zakat
  const [showZakatModal, setShowZakatModal] = useState(false);
  const [zakatEpargne, setZakatEpargne] = useState('');
  const [zakatOr, setZakatOr] = useState('');
  const [zakatArgent, setZakatArgent] = useState('');
  
  // Coran
  const [selectedSourate, setSelectedSourate] = useState(null);
  
  // États Adhérent
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [cotisationType, setCotisationType] = useState('mensuel');
  const [showCotisationModal, setShowCotisationModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [hasPaidCotisation, setHasPaidCotisation] = useState(false); // false = pas encore payé
  const [memberStatus, setMemberStatus] = useState({
    name: 'Faïcal Kriouar',
    email: 'faical@example.com',
    memberId: 'ELM-2024-0042',
    cotisationStatus: 'expired', // 'active', 'expired', 'none'
    nextPayment: null,
    type: null
  });

  const amounts = [10, 20, 50, 100, 200, 500];

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text.replace(/\s/g, ''));
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const getProgress = (raised, goal) => Math.min((raised / goal) * 100, 100);

  const getSelectedProjectData = () => {
    if (!selectedProject) return null;
    const allProjects = [...projetsInternes, ...projetsExternes];
    return allProjects.find(p => p.id === selectedProject);
  };

  const getFinalAmount = () => {
    if (customAmount && parseFloat(customAmount) > 0) {
      return parseFloat(customAmount);
    }
    return selectedAmount || 0;
  };

  // ==================== STYLES ====================
  const styles = {
    container: { 
      minHeight: '100vh', 
      background: colors.background, 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
      color: colors.text,
      maxWidth: '430px',
      margin: '0 auto',
      position: 'relative',
    },
    header: { padding: '20px 16px 16px' },
    title: { fontSize: '28px', fontWeight: 'bold', color: colors.accent, marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: 'rgba(255,255,255,0.7)' },
    content: { padding: '0 16px', paddingBottom: '100px' },
    section: { marginBottom: '24px' },
    sectionTitle: { fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' },
    
    // Tab Toggle
    tabToggle: { display: 'flex', background: '#e8e8ed', borderRadius: '12px', padding: '4px', marginBottom: '20px' },
    tabBtn: { flex: 1, padding: '12px 8px', borderRadius: '10px', border: 'none', background: 'transparent', color: colors.textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
    tabBtnActive: { background: '#ffffff', color: colors.accent, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
    
    // Cards
    card: { background: colors.card, borderRadius: '16px', padding: '16px', marginBottom: '12px', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
    cardSelected: { borderColor: colors.accent, background: `rgba(201,162,39,0.08)`, boxShadow: '0 2px 12px rgba(201,162,39,0.15)' },
    projectHeader: { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' },
    projectIcon: { fontSize: '28px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.surface, borderRadius: '12px' },
    projectInfo: { flex: 1 },
    projectLieu: { fontSize: '11px', color: colors.accent, fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' },
    projectName: { fontSize: '16px', fontWeight: '600', color: colors.text },
    projectDescription: { fontSize: '13px', color: colors.textSecondary, marginBottom: '12px' },
    checkmark: { width: '26px', height: '26px', borderRadius: '13px', background: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary, fontWeight: 'bold', fontSize: '14px' },
    
    // Progress
    progressBar: { height: '6px', background: '#e8e8ed', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' },
    progressFill: { height: '100%', background: `linear-gradient(90deg, ${colors.accent}, #d4b84a)`, borderRadius: '3px', transition: 'width 0.3s' },
    progressInfo: { display: 'flex', justifyContent: 'space-between', fontSize: '12px' },
    progressText: { color: colors.accent, fontWeight: '600' },
    progressGoal: { color: colors.textMuted },
    
    // Amounts
    amountsGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' },
    amountBtn: { padding: '14px 0', width: 'calc(33.33% - 7px)', background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', color: colors.text, fontSize: '17px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' },
    amountBtnSelected: { borderColor: colors.accent, background: `rgba(201,162,39,0.1)`, color: colors.accent, boxShadow: '0 2px 8px rgba(201,162,39,0.2)' },
    
    // Custom Amount Input
    customAmountContainer: { marginBottom: '20px' },
    customAmountLabel: { fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' },
    customAmountInputWrapper: { display: 'flex', alignItems: 'center', background: colors.surface, borderRadius: '12px', border: `2px solid ${colors.border}`, overflow: 'hidden' },
    customAmountInput: { flex: 1, padding: '16px', background: 'transparent', border: 'none', color: colors.text, fontSize: '18px', fontWeight: '600', outline: 'none' },
    customAmountSuffix: { padding: '16px', color: colors.accent, fontSize: '18px', fontWeight: '600' },
    
    // Buttons
    primaryBtn: { width: '100%', padding: '18px', background: `linear-gradient(135deg, ${colors.accent}, #d4b84a)`, border: 'none', borderRadius: '14px', color: '#ffffff', fontSize: '17px', fontWeight: '700', cursor: 'pointer', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(201,162,39,0.3)' },
    secondaryBtn: { width: '100%', padding: '16px', background: 'transparent', border: `2px solid ${colors.accent}`, borderRadius: '14px', color: colors.accent, fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    disabledBtn: { opacity: 0.5, cursor: 'not-allowed' },
    
    // RIB Card
    ribCard: { background: `linear-gradient(135deg, #f8f8fa, #ffffff)`, borderRadius: '16px', padding: '20px', marginBottom: '16px', border: `1px solid rgba(0,0,0,0.06)`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
    ribHeader: { textAlign: 'center', marginBottom: '20px' },
    ribIcon: { fontSize: '48px', marginBottom: '8px' },
    ribTitulaire: { fontSize: '18px', fontWeight: '600', color: colors.accent },
    ribBanque: { fontSize: '12px', color: colors.textMuted },
    ribRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${colors.border}` },
    ribRowLast: { borderBottom: 'none' },
    ribLabel: { fontSize: '11px', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '4px' },
    ribValue: { fontSize: '14px', color: colors.text, fontWeight: '500', fontFamily: 'monospace', letterSpacing: '0.5px' },
    copyBtn: { padding: '8px 14px', background: colors.accent, border: 'none', borderRadius: '8px', color: colors.primary, fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
    
    // Navbar
    navbar: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '430px', background: `rgba(92,58,26,0.98)`, backdropFilter: 'blur(20px)', borderTop: `1px solid rgba(255,255,255,0.1)`, display: 'flex', justifyContent: 'space-around', padding: '8px 0 24px', zIndex: 100 },
    navItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '8px 12px', transition: 'color 0.2s' },
    navItemActive: { color: colors.accent },
    navIcon: { fontSize: '22px' },
    navLabel: { fontSize: '10px', textTransform: 'uppercase', fontWeight: '500' },
    
    // Modal
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' },
    modalContent: { background: '#ffffff', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
    modalTitle: { fontSize: '22px', fontWeight: '600', color: colors.accent, marginBottom: '20px', textAlign: 'center' },
    closeBtn: { position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: colors.textMuted, fontSize: '28px', cursor: 'pointer', lineHeight: 1 },
    
    // Payment Options
    paymentOption: { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', background: '#f8f8fa', borderRadius: '14px', marginBottom: '10px', cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s' },
    paymentOptionSelected: { borderColor: colors.accent, background: `rgba(201,162,39,0.08)` },
    paymentIcon: { fontSize: '28px' },
    paymentInfo: { flex: 1 },
    paymentTitle: { fontSize: '15px', fontWeight: '600', color: colors.text },
    paymentDesc: { fontSize: '12px', color: colors.textMuted },
    
    // Prayer Times
    prayerCard: { background: '#ffffff', borderRadius: '16px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' },
    prayerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid rgba(0,0,0,0.06)` },
    prayerRowLast: { borderBottom: 'none' },
    prayerName: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: colors.text },
    prayerTime: { fontSize: '16px', fontWeight: '600', color: colors.accent },
    nextPrayer: { background: `rgba(201,162,39,0.1)`, borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '20px', border: '1px solid rgba(201,162,39,0.2)' },
    nextPrayerLabel: { fontSize: '12px', color: colors.textMuted, marginBottom: '4px' },
    nextPrayerName: { fontSize: '20px', fontWeight: '600', color: colors.accent },
    nextPrayerTime: { fontSize: '14px', color: colors.text },
    countdown: { fontSize: '32px', fontWeight: 'bold', color: colors.accent, marginTop: '8px' },
    
    // Member Card
    memberCard: { background: `linear-gradient(135deg, #ffffff, #f8f8fa)`, borderRadius: '20px', padding: '24px', marginBottom: '20px', border: `2px solid ${colors.accent}`, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(201,162,39,0.15)' },
    memberCardBg: { position: 'absolute', top: '-50%', right: '-30%', width: '200px', height: '200px', background: `radial-gradient(circle, rgba(201,162,39,0.1) 0%, transparent 70%)`, borderRadius: '50%' },
    memberAvatar: { width: '60px', height: '60px', borderRadius: '30px', background: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '12px' },
    memberName: { fontSize: '20px', fontWeight: '600', color: colors.text, marginBottom: '4px' },
    memberEmail: { fontSize: '13px', color: colors.textMuted, marginBottom: '12px' },
    memberId: { fontSize: '12px', color: colors.accent, fontFamily: 'monospace', background: colors.surface, padding: '6px 12px', borderRadius: '20px', display: 'inline-block' },
    statusBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', marginTop: '12px' },
    statusActive: { background: 'rgba(39, 174, 96, 0.2)', color: '#27ae60' },
    statusInactive: { background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c' },
    
    // Cotisation Options
    cotisationOption: { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', background: '#ffffff', borderRadius: '14px', marginBottom: '10px', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.08)', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' },
    cotisationOptionSelected: { borderColor: colors.accent, background: `rgba(201,162,39,0.08)`, boxShadow: '0 2px 8px rgba(201,162,39,0.15)' },
    cotisationIcon: { width: '50px', height: '50px', borderRadius: '12px', background: '#f0f0f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' },
    cotisationInfo: { flex: 1 },
    cotisationLabel: { fontSize: '16px', fontWeight: '600', color: colors.text },
    cotisationDesc: { fontSize: '12px', color: colors.textMuted },
    cotisationPrice: { fontSize: '18px', fontWeight: 'bold', color: colors.accent },
    
    // Info rows
    infoRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: `1px solid ${colors.border}` },
    infoIcon: { fontSize: '20px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.surface, borderRadius: '10px' },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: '11px', color: colors.textMuted },
    infoValue: { fontSize: '14px', color: colors.text },
    
    // Disclaimer
    disclaimer: { fontSize: '12px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: '18px', marginTop: '8px' },
  };

  // ==================== ÉCRAN ACCUEIL ====================
  const HomeScreen = () => (
    <>
      {/* Logo Salam Aleykoum */}
      <div style={{
        background: 'linear-gradient(135deg, #5c3a1a 0%, #7f4f24 100%)',
        padding: '30px 20px 20px',
        textAlign: 'center',
        borderBottomLeftRadius: '30px',
        borderBottomRightRadius: '30px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          fontSize: '42px',
          fontFamily: 'serif',
          color: colors.accent,
          marginBottom: '8px',
          lineHeight: 1.3,
          textShadow: '0 2px 10px rgba(201,162,39,0.3)'
        }}>
          السلام عليكم ورحمة الله
        </div>
        <div style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '2px',
          textTransform: 'uppercase'
        }}>
          Que la paix et la miséricorde d'Allah soient sur vous
        </div>
        <div style={{
          width: '60px',
          height: '3px',
          background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
          margin: '16px auto 0',
          borderRadius: '2px'
        }}></div>
      </div>

      <div style={styles.header}>
        <h1 style={styles.title}>🕌 El Mouhssinine</h1>
        <p style={styles.subtitle}>Mosquée - Bourg-en-Bresse</p>
      </div>
      
      <div style={styles.content}>
        {/* Prochaine prière */}
        <div style={styles.nextPrayer}>
          <div style={styles.nextPrayerLabel}>Prochaine prière</div>
          <div style={styles.nextPrayerName}>☀️ Dhuhr</div>
          <div style={styles.nextPrayerTime}>13:15</div>
          <div style={styles.countdown}>01:23:45</div>
        </div>

        {/* Horaires */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🕐 Horaires du jour</h2>
          <div style={styles.prayerCard}>
            {prayerTimes.map((prayer, index) => (
              <div 
                key={prayer.name} 
                style={{
                  ...styles.prayerRow, 
                  ...(index === prayerTimes.length - 1 ? styles.prayerRowLast : {}),
                  ...(prayer.name === 'Dhuhr' ? { background: `rgba(212,175,55,0.1)`, margin: '0 -16px', padding: '12px 16px', borderRadius: '8px' } : {})
                }}
              >
                <span style={styles.prayerName}>
                  <span>{prayer.icon}</span>
                  {prayer.name}
                </span>
                <span style={styles.prayerTime}>{prayer.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendrier Hégirien */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📅 Calendrier Hégirien</h2>
          <div style={{...styles.card, cursor: 'default', background: 'linear-gradient(135deg, #ffffff, #f8f8fa)'}}>
            <div style={{textAlign: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.06)'}}>
              <div style={{fontSize: '14px', color: colors.textMuted, marginBottom: '4px'}}>Aujourd'hui</div>
              <div style={{fontSize: '28px', fontWeight: 'bold', color: colors.accent}}>{todayHijri.day} {todayHijri.month}</div>
              <div style={{fontSize: '16px', color: colors.text}}>{todayHijri.year} H</div>
              <div style={{fontSize: '12px', color: colors.textMuted, marginTop: '4px'}}>{todayHijri.gregorian}</div>
            </div>
            <div style={{fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '10px'}}>Prochains événements</div>
            {islamicDates.map((event, index) => (
              <div key={event.name} style={{
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '10px 0',
                borderBottom: index < islamicDates.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none'
              }}>
                <div style={{fontSize: '24px'}}>{event.icon}</div>
                <div style={{flex: 1}}>
                  <div style={{fontSize: '14px', fontWeight: '600', color: colors.text}}>{event.name}</div>
                  <div style={{fontSize: '11px', color: colors.textMuted}}>{event.gregorian}</div>
                </div>
                <div style={{
                  background: `rgba(201,162,39,0.15)`,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: colors.accent
                }}>
                  J-{event.daysLeft}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Annonces */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📢 Annonces</h2>
          <div style={{...styles.card, cursor: 'default'}}>
            <div style={{fontSize: '15px', fontWeight: '600', color: colors.text, marginBottom: '8px'}}>
              Cours de Coran pour enfants
            </div>
            <div style={{fontSize: '13px', color: colors.textSecondary, marginBottom: '8px'}}>
              Reprise des cours chaque samedi à 14h. Inscription obligatoire.
            </div>
            <div style={{fontSize: '11px', color: colors.textMuted}}>Publié le 8 janvier 2026</div>
          </div>
          <div style={{...styles.card, cursor: 'default'}}>
            <div style={{fontSize: '15px', fontWeight: '600', color: colors.text, marginBottom: '8px'}}>
              Collecte vêtements chauds
            </div>
            <div style={{fontSize: '13px', color: colors.textSecondary, marginBottom: '8px'}}>
              Dépôt possible tous les jours après la prière de Maghrib.
            </div>
            <div style={{fontSize: '11px', color: colors.textMuted}}>Publié le 5 janvier 2026</div>
          </div>
        </div>

        {/* Prière Mortuaire - Salat Janaza */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🕯️ Prière Mortuaire</h2>
          <div style={{...styles.card, cursor: 'default', background: 'linear-gradient(135deg, rgba(30,58,95,0.8), rgba(26,39,68,0.9))', border: `1px solid ${colors.border}`}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px'}}>
              <div style={{width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'}}>
                🤲
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: '16px', fontWeight: '600', color: '#ffffff'}}>Salat Janaza</div>
                <div style={{fontSize: '13px', color: colors.accent}}>Aujourd'hui après Dhuhr</div>
              </div>
            </div>
            <div style={{background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px', marginBottom: '12px'}}>
              <div style={{fontSize: '14px', color: '#ffffff', marginBottom: '4px'}}>
                <strong>Défunt(e) :</strong> Fatima Benali (رحمها الله)
              </div>
              <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.7)'}}>
                Que Allah lui accorde Sa miséricorde et l'accueille dans Son vaste Paradis.
              </div>
            </div>
            <div style={{display: 'flex', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)'}}>
              <span>📍 Salle principale</span>
              <span>•</span>
              <span>🕐 13h30</span>
            </div>
          </div>
          
          {/* Message si pas de Janaza */}
          {false && (
            <div style={{...styles.card, cursor: 'default', textAlign: 'center', padding: '24px'}}>
              <div style={{fontSize: '24px', marginBottom: '8px', opacity: 0.5}}>🤲</div>
              <div style={{fontSize: '14px', color: colors.textMuted}}>
                Aucune prière mortuaire prévue
              </div>
            </div>
          )}
        </div>

        {/* Événements */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📅 Prochains événements</h2>
          <div style={{...styles.card, cursor: 'default'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '14px'}}>
              <div style={{
                width: '50px', 
                height: '50px', 
                borderRadius: '12px', 
                background: `rgba(201,162,39,0.15)`, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <div style={{fontSize: '16px', fontWeight: 'bold', color: colors.accent, lineHeight: 1}}>12</div>
                <div style={{fontSize: '10px', color: colors.accent}}>JAN</div>
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: '15px', fontWeight: '600', color: colors.text}}>Conférence : La patience en Islam</div>
                <div style={{fontSize: '12px', color: colors.textSecondary}}>Dimanche à 15h00 • Salle principale</div>
              </div>
            </div>
          </div>
          <div style={{...styles.card, cursor: 'default'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '14px'}}>
              <div style={{
                width: '50px', 
                height: '50px', 
                borderRadius: '12px', 
                background: `rgba(201,162,39,0.15)`, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <div style={{fontSize: '16px', fontWeight: 'bold', color: colors.accent, lineHeight: 1}}>18</div>
                <div style={{fontSize: '10px', color: colors.accent}}>JAN</div>
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: '15px', fontWeight: '600', color: colors.text}}>Repas communautaire</div>
                <div style={{fontSize: '12px', color: colors.textSecondary}}>Samedi à 19h30 • Après Maghrib</div>
              </div>
            </div>
          </div>
          <div style={{...styles.card, cursor: 'default'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '14px'}}>
              <div style={{
                width: '50px', 
                height: '50px', 
                borderRadius: '12px', 
                background: `rgba(201,162,39,0.15)`, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <div style={{fontSize: '16px', fontWeight: 'bold', color: colors.accent, lineHeight: 1}}>25</div>
                <div style={{fontSize: '10px', color: colors.accent}}>JAN</div>
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: '15px', fontWeight: '600', color: colors.text}}>Sortie familiale</div>
                <div style={{fontSize: '12px', color: colors.textSecondary}}>Samedi à 10h00 • Inscription requise</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // ==================== ÉCRAN DONS ====================
  const DonationsScreen = () => (
    <>
      <div style={styles.header}>
        <h1 style={styles.title}>Faire un Don</h1>
        <p style={styles.subtitle}>Contribuez aux projets de notre communauté</p>
      </div>
      
      <div style={styles.content}>
        {/* Toggle Interne/Externe */}
        <div style={styles.tabToggle}>
          <button 
            style={{...styles.tabBtn, ...(projectType === 'interne' ? styles.tabBtnActive : {})}}
            onClick={() => { setProjectType('interne'); setSelectedProject(null); }}
          >
            🕌 Notre Mosquée
          </button>
          <button 
            style={{...styles.tabBtn, ...(projectType === 'externe' ? styles.tabBtnActive : {})}}
            onClick={() => { setProjectType('externe'); setSelectedProject(null); }}
          >
            🌍 Autres Causes
          </button>
        </div>

        {/* Projets Internes */}
        {projectType === 'interne' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Choisir un projet</h2>
            {projetsInternes.map(project => (
              <div
                key={project.id}
                style={{...styles.card, ...(selectedProject === project.id ? styles.cardSelected : {})}}
                onClick={() => setSelectedProject(project.id)}
              >
                <div style={styles.projectHeader}>
                  <div style={styles.projectIcon}>{project.icon}</div>
                  <div style={styles.projectInfo}>
                    <div style={styles.projectName}>{project.name}</div>
                    <div style={styles.projectDescription}>{project.description}</div>
                  </div>
                  {selectedProject === project.id && <div style={styles.checkmark}>✓</div>}
                </div>
                <div style={styles.progressBar}>
                  <div style={{...styles.progressFill, width: `${getProgress(project.raised, project.goal)}%`}}></div>
                </div>
                <div style={styles.progressInfo}>
                  <span style={styles.progressText}>{project.raised.toLocaleString()}€</span>
                  <span style={styles.progressGoal}>Objectif: {project.goal.toLocaleString()}€</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Projets Externes */}
        {projectType === 'externe' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Aider d'autres causes</h2>
            {projetsExternes.map(project => (
              <div
                key={project.id}
                style={{...styles.card, ...(selectedProject === project.id ? styles.cardSelected : {})}}
                onClick={() => setSelectedProject(project.id)}
              >
                <div style={styles.projectHeader}>
                  <div style={styles.projectIcon}>{project.icon}</div>
                  <div style={styles.projectInfo}>
                    <div style={styles.projectLieu}>📍 {project.lieu}</div>
                    <div style={styles.projectName}>{project.name}</div>
                    <div style={styles.projectDescription}>{project.description}</div>
                  </div>
                  {selectedProject === project.id && <div style={styles.checkmark}>✓</div>}
                </div>
                <div style={styles.progressBar}>
                  <div style={{...styles.progressFill, width: `${getProgress(project.raised, project.goal)}%`}}></div>
                </div>
                <div style={styles.progressInfo}>
                  <span style={styles.progressText}>{project.raised.toLocaleString()}€</span>
                  <span style={styles.progressGoal}>Objectif: {project.goal.toLocaleString()}€</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Montants prédéfinis */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>💰 Montant du don</h2>
          <div style={styles.amountsGrid}>
            {amounts.map(amount => (
              <button
                key={amount}
                style={{
                  ...styles.amountBtn, 
                  ...(selectedAmount === amount && !customAmount ? styles.amountBtnSelected : {})
                }}
                onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
              >
                {amount}€
              </button>
            ))}
          </div>
          
          {/* Montant libre */}
          <div style={styles.customAmountContainer}>
            <div style={styles.customAmountLabel}>Ou saisissez un montant libre :</div>
            <div style={{
              ...styles.customAmountInputWrapper,
              ...(customAmount ? { borderColor: colors.accent } : {})
            }}>
              <input 
                type="number"
                placeholder="Autre montant"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                style={styles.customAmountInput}
              />
              <span style={styles.customAmountSuffix}>€</span>
            </div>
          </div>
        </div>

        {/* Boutons */}
        <button 
          style={{
            ...styles.primaryBtn, 
            ...((!selectedProject || getFinalAmount() <= 0) ? styles.disabledBtn : {})
          }}
          onClick={() => selectedProject && getFinalAmount() > 0 && setShowPaymentModal(true)}
        >
          💳 Payer {getFinalAmount() > 0 ? `${getFinalAmount()}€` : ''}
        </button>
        
        <button style={styles.secondaryBtn} onClick={() => setShowRIBModal(true)}>
          🏦 Faire un virement
        </button>
        
        <button 
          style={{...styles.secondaryBtn, borderColor: '#27ae60', color: '#27ae60'}} 
          onClick={() => setShowZakatModal(true)}
        >
          🧮 Calculer ma Zakat
        </button>
        
        <p style={styles.disclaimer}>
          Les dons sont sécurisés et peuvent être déductibles d'impôts selon la réglementation en vigueur.
        </p>
      </div>
    </>
  );

  // ==================== ÉCRAN ADHÉRENT ====================
  const MemberScreen = () => (
    <>
      <div style={styles.header}>
        <h1 style={styles.title}>Espace Adhérent</h1>
        <p style={styles.subtitle}>Gérez votre adhésion à la mosquée</p>
      </div>
      
      <div style={styles.content}>
        {isLoggedIn ? (
          <>
            {/* Carte membre */}
            <div style={styles.memberCard}>
              <div style={styles.memberCardBg}></div>
              <div style={styles.memberAvatar}>👤</div>
              <div style={styles.memberName}>{memberStatus.name}</div>
              <div style={styles.memberEmail}>{memberStatus.email}</div>
              <div style={styles.memberId}>N° {memberStatus.memberId}</div>
              <div style={{
                ...styles.statusBadge,
                ...(memberStatus.cotisationStatus === 'active' ? styles.statusActive : styles.statusInactive)
              }}>
                {memberStatus.cotisationStatus === 'active' ? '✓ Cotisation à jour' : '⚠ Cotisation non payée'}
              </div>
            </div>

            {/* Si cotisation active - Afficher infos */}
            {memberStatus.cotisationStatus === 'active' && memberStatus.nextPayment && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>📋 Ma cotisation</h2>
                <div style={{...styles.card, cursor: 'default'}}>
                  <div style={styles.infoRow}>
                    <div style={styles.infoIcon}>💳</div>
                    <div style={styles.infoContent}>
                      <div style={styles.infoLabel}>Type</div>
                      <div style={styles.infoValue}>
                        {memberStatus.type === 'mensuel' ? 'Mensuel (10€/mois)' : 'Annuel (100€/an)'}
                      </div>
                    </div>
                  </div>
                  <div style={{...styles.infoRow, borderBottom: 'none'}}>
                    <div style={styles.infoIcon}>📅</div>
                    <div style={styles.infoContent}>
                      <div style={styles.infoLabel}>Prochain prélèvement</div>
                      <div style={styles.infoValue}>{memberStatus.nextPayment}</div>
                    </div>
                  </div>
                </div>
                
                {/* Bouton annuler abonnement mensuel */}
                {memberStatus.type === 'mensuel' && (
                  <button 
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'transparent',
                      border: '1px solid rgba(231,76,60,0.3)',
                      borderRadius: '10px',
                      color: '#e74c3c',
                      fontSize: '14px',
                      cursor: 'pointer',
                      marginTop: '8px'
                    }}
                    onClick={() => setShowCancelModal(true)}
                  >
                    ✕ Annuler mon abonnement mensuel
                  </button>
                )}
              </div>
            )}

            {/* Si pas de cotisation active - Invitation à payer */}
            {memberStatus.cotisationStatus !== 'active' && (
              <div style={{...styles.card, cursor: 'default', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', marginBottom: '20px'}}>
                <div style={{textAlign: 'center', padding: '8px'}}>
                  <div style={{fontSize: '32px', marginBottom: '8px'}}>⚠️</div>
                  <div style={{fontSize: '16px', fontWeight: '600', color: '#e74c3c'}}>
                    Cotisation non réglée
                  </div>
                </div>
              </div>
            )}

            {/* Choisir / Changer de formule */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                {memberStatus.cotisationStatus === 'active' ? '🔄 Changer de formule' : '💳 Régler ma cotisation'}
              </h2>
              
              {cotisationOptions.map(option => (
                <div key={option.id}>
                  <div
                    style={{
                      ...styles.cotisationOption,
                      ...(cotisationType === option.id ? styles.cotisationOptionSelected : {})
                    }}
                    onClick={() => setCotisationType(option.id)}
                  >
                    <div style={styles.cotisationIcon}>
                      {option.id === 'mensuel' ? '🔄' : '📅'}
                    </div>
                    <div style={styles.cotisationInfo}>
                      <div style={styles.cotisationLabel}>{option.label}</div>
                      <div style={styles.cotisationDesc}>{option.description}</div>
                    </div>
                    <div style={styles.cotisationPrice}>
                      {option.amount}€
                    </div>
                    {cotisationType === option.id && <div style={styles.checkmark}>✓</div>}
                  </div>
                  {option.id === 'mensuel' && (
                    <div style={{
                      fontSize: '12px',
                      color: '#27ae60',
                      textAlign: 'center',
                      padding: '8px 12px',
                      marginTop: '-6px',
                      marginBottom: '10px'
                    }}>
                      ✓ Sans engagement - Annulable à tout moment depuis l'application
                    </div>
                  )}
                </div>
              ))}

              <button 
                style={{...styles.primaryBtn, marginTop: '16px'}}
                onClick={() => setShowCotisationModal(true)}
              >
                {memberStatus.cotisationStatus === 'active' 
                  ? (memberStatus.type === cotisationType ? '🔄 Renouveler' : '💳 Changer de formule')
                  : '💳 Payer ma cotisation'
                }
              </button>
              
              <button style={styles.secondaryBtn} onClick={() => setShowRIBModal(true)}>
                🏦 Payer par virement
              </button>
            </div>

            {/* Bouton test pour simuler paiement */}
            <div style={{...styles.card, cursor: 'default', background: colors.surface, marginBottom: '20px'}}>
              <div style={{fontSize: '12px', color: colors.textMuted, marginBottom: '8px', textAlign: 'center'}}>🧪 Test - Simuler état</div>
              <div style={{display: 'flex', gap: '8px'}}>
                <button 
                  style={{...styles.secondaryBtn, flex: 1, marginBottom: 0, padding: '10px', fontSize: '12px'}}
                  onClick={() => setMemberStatus({...memberStatus, cotisationStatus: 'active', nextPayment: '15 février 2026', type: 'mensuel'})}
                >
                  ✓ Payé
                </button>
                <button 
                  style={{...styles.secondaryBtn, flex: 1, marginBottom: 0, padding: '10px', fontSize: '12px', borderColor: '#e74c3c', color: '#e74c3c'}}
                  onClick={() => setMemberStatus({...memberStatus, cotisationStatus: 'expired', nextPayment: null, type: null})}
                >
                  ✗ Non payé
                </button>
              </div>
            </div>

            {/* Déconnexion */}
            <button 
              style={{...styles.secondaryBtn, borderColor: '#e74c3c', color: '#e74c3c'}}
              onClick={() => setIsLoggedIn(false)}
            >
              🚪 Se déconnecter
            </button>
          </>
        ) : (
          <>
            {/* Formulaire connexion */}
            <div style={{...styles.card, cursor: 'default', padding: '24px'}}>
              <div style={{textAlign: 'center', marginBottom: '20px'}}>
                <div style={{fontSize: '48px', marginBottom: '12px'}}>🕌</div>
                <h3 style={{color: colors.accent, marginBottom: '8px'}}>Espace Adhérent</h3>
                <p style={{fontSize: '13px', color: colors.textMuted}}>Connectez-vous ou créez votre compte</p>
              </div>
              
              <div style={{marginBottom: '12px'}}>
                <input 
                  type="email" 
                  placeholder="Email" 
                  style={{...styles.customAmountInput, width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: '15px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.text}}
                />
              </div>
              <div style={{marginBottom: '20px'}}>
                <input 
                  type="password" 
                  placeholder="Mot de passe" 
                  style={{...styles.customAmountInput, width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: '15px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.text}}
                />
              </div>
              
              <button style={styles.primaryBtn} onClick={() => setIsLoggedIn(true)}>
                Se connecter
              </button>
              <button style={styles.secondaryBtn}>
                Créer un compte
              </button>
            </div>

            {/* Tarifs */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>💰 Tarifs cotisation</h2>
              {cotisationOptions.map(option => (
                <div key={option.id} style={{...styles.card, cursor: 'default'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <div style={{fontSize: '16px', fontWeight: '600', color: colors.text}}>{option.label}</div>
                      <div style={{fontSize: '13px', color: colors.textMuted}}>{option.description}</div>
                    </div>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: colors.accent}}>{option.amount}€</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );

  // ==================== ÉCRAN SPIRITUEL (Coran & Duas) ====================
  const SpiritualScreen = () => (
    <>
      <div style={styles.header}>
        <h1 style={styles.title}>📖 Spirituel</h1>
        <p style={styles.subtitle}>Coran & Invocations</p>
      </div>
      
      <div style={styles.content}>
        {/* Section Coran */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📖 Lecture du Coran</h2>
          <div style={{...styles.card, cursor: 'default', padding: '20px', textAlign: 'center', marginBottom: '16px'}}>
            <div style={{fontSize: '12px', color: colors.textMuted, marginBottom: '4px'}}>Continuer la lecture</div>
            <div style={{fontSize: '18px', fontWeight: '600', color: colors.text, marginBottom: '4px'}}>Sourate Al-Baqara</div>
            <div style={{fontSize: '13px', color: colors.accent, marginBottom: '12px'}}>Verset 142 / 286</div>
            <div style={{
              height: '6px',
              background: '#e8e8ed',
              borderRadius: '3px',
              overflow: 'hidden',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '49%',
                height: '100%',
                background: `linear-gradient(90deg, ${colors.accent}, #d4b84a)`,
                borderRadius: '3px'
              }}></div>
            </div>
            <button style={{
              padding: '12px 24px',
              background: colors.accent,
              border: 'none',
              borderRadius: '20px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              ▶️ Reprendre
            </button>
          </div>
          
          <div style={{fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '10px'}}>Sourates populaires</div>
          {sourates.map(sourate => (
            <div 
              key={sourate.id} 
              style={{
                ...styles.card, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '14px',
                marginBottom: '8px',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: `rgba(201,162,39,0.15)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
                color: colors.accent
              }}>
                {sourate.id}
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: '15px', fontWeight: '600', color: colors.text}}>{sourate.name}</div>
                <div style={{fontSize: '12px', color: colors.textMuted}}>{sourate.verses} versets • {sourate.type}</div>
              </div>
              <div style={{fontSize: '20px', color: colors.accent, fontFamily: 'serif'}}>{sourate.nameAr}</div>
            </div>
          ))}
        </div>

        {/* Section Invocations */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🤲 Invocations (Duas)</h2>
          {duas.map(dua => (
            <div 
              key={dua.id} 
              style={{
                ...styles.card, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '14px',
                marginBottom: '8px',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: `rgba(201,162,39,0.15)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}>
                {dua.icon}
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: '15px', fontWeight: '600', color: colors.text}}>{dua.name}</div>
                <div style={{fontSize: '12px', color: colors.textMuted}}>{dua.count} invocations</div>
              </div>
              <div style={{fontSize: '16px', color: colors.textSecondary}}>→</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  // ==================== ÉCRAN PLUS ====================
  const MoreScreen = () => (
    <>
      <div style={styles.header}>
        <h1 style={styles.title}>Plus</h1>
      </div>
      
      <div style={styles.content}>
        {/* Direction Qibla */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🧭 Direction de la Qibla</h2>
          <div style={{...styles.card, cursor: 'default', textAlign: 'center', padding: '24px'}}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '60px',
              background: 'linear-gradient(135deg, #f8f8fa, #ffffff)',
              border: `3px solid ${colors.accent}`,
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: '0 4px 20px rgba(201,162,39,0.2)'
            }}>
              {/* Boussole */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* Aiguille */}
                <div style={{
                  transform: 'rotate(119deg)',
                  transformOrigin: 'center center'
                }}>
                  <div style={{
                    width: '0',
                    height: '0',
                    borderLeft: '10px solid transparent',
                    borderRight: '10px solid transparent',
                    borderBottom: `45px solid ${colors.accent}`,
                  }}></div>
                  <div style={{
                    width: '4px',
                    height: '35px',
                    background: colors.textMuted,
                    marginLeft: '8px',
                    marginTop: '-2px'
                  }}></div>
                </div>
              </div>
              {/* Centre */}
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '6px',
                background: colors.text,
                zIndex: 10
              }}></div>
              {/* Points cardinaux */}
              <div style={{position: 'absolute', top: '8px', fontSize: '12px', fontWeight: 'bold', color: colors.textMuted}}>N</div>
              <div style={{position: 'absolute', bottom: '8px', fontSize: '12px', fontWeight: 'bold', color: colors.textMuted}}>S</div>
              <div style={{position: 'absolute', left: '10px', fontSize: '12px', fontWeight: 'bold', color: colors.textMuted}}>O</div>
              <div style={{position: 'absolute', right: '10px', fontSize: '12px', fontWeight: 'bold', color: colors.textMuted}}>E</div>
            </div>
            <div style={{fontSize: '18px', fontWeight: '600', color: colors.text, marginBottom: '4px'}}>
              119° Sud-Est
            </div>
            <div style={{fontSize: '13px', color: colors.textSecondary, marginBottom: '12px'}}>
              Direction de La Mecque depuis Bourg-en-Bresse
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: colors.accent,
              background: `rgba(201,162,39,0.1)`,
              padding: '8px 14px',
              borderRadius: '20px'
            }}>
              🕋 Kaaba - La Mecque
            </div>
          </div>
        </div>

        {/* Section RIB */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🏦 Coordonnées bancaires</h2>
          <div style={styles.ribCard}>
            <div style={styles.ribHeader}>
              <div style={styles.ribIcon}>🕌</div>
              <div style={styles.ribTitulaire}>{mosqueeRIB.titulaire}</div>
              <div style={styles.ribBanque}>{mosqueeRIB.banque}</div>
            </div>
            
            <div style={styles.ribRow}>
              <div>
                <div style={styles.ribLabel}>IBAN</div>
                <div style={styles.ribValue}>{mosqueeRIB.iban}</div>
              </div>
              <button 
                style={styles.copyBtn} 
                onClick={() => copyToClipboard(mosqueeRIB.iban, 'iban')}
              >
                {copied === 'iban' ? '✓ Copié' : '📋 Copier'}
              </button>
            </div>
            
            <div style={{...styles.ribRow, ...styles.ribRowLast}}>
              <div>
                <div style={styles.ribLabel}>BIC / SWIFT</div>
                <div style={styles.ribValue}>{mosqueeRIB.bic}</div>
              </div>
              <button 
                style={styles.copyBtn} 
                onClick={() => copyToClipboard(mosqueeRIB.bic, 'bic')}
              >
                {copied === 'bic' ? '✓' : '📋'}
              </button>
            </div>
          </div>
          <p style={styles.disclaimer}>
            Indiquez votre email en référence du virement pour recevoir votre reçu fiscal.
          </p>
        </div>

        {/* Infos Mosquée */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📍 Informations</h2>
          <div style={{...styles.card, cursor: 'default'}}>
            <div style={{...styles.infoRow, justifyContent: 'space-between'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px', flex: 1}}>
                <div style={styles.infoIcon}>📍</div>
                <div style={styles.infoContent}>
                  <div style={styles.infoLabel}>Adresse</div>
                  <div style={styles.infoValue}>123 Rue de la Mosquée, 01000 Bourg-en-Bresse</div>
                </div>
              </div>
              <button 
                style={{...styles.copyBtn, padding: '6px 10px', fontSize: '11px'}}
                onClick={() => copyToClipboard('123 Rue de la Mosquée, 01000 Bourg-en-Bresse', 'adresse')}
              >
                {copied === 'adresse' ? '✓' : '📋'}
              </button>
            </div>
            <a href="tel:+33474XXXXXX" style={{...styles.infoRow, textDecoration: 'none', cursor: 'pointer'}}>
              <div style={styles.infoIcon}>📞</div>
              <div style={styles.infoContent}>
                <div style={styles.infoLabel}>Téléphone</div>
                <div style={{...styles.infoValue, color: colors.accent}}>04 74 XX XX XX</div>
              </div>
              <span style={{fontSize: '18px', color: colors.accent}}>→</span>
            </a>
            <a href="mailto:contact@elmouhssinine.fr" style={{...styles.infoRow, textDecoration: 'none', cursor: 'pointer'}}>
              <div style={styles.infoIcon}>✉️</div>
              <div style={styles.infoContent}>
                <div style={styles.infoLabel}>Email</div>
                <div style={{...styles.infoValue, color: colors.accent}}>contact@elmouhssinine.fr</div>
              </div>
              <span style={{fontSize: '18px', color: colors.accent}}>→</span>
            </a>
            <a href="https://el-mouhssinine.web.app" target="_blank" rel="noopener noreferrer" style={{...styles.infoRow, borderBottom: 'none', textDecoration: 'none', cursor: 'pointer'}}>
              <div style={styles.infoIcon}>🌐</div>
              <div style={styles.infoContent}>
                <div style={styles.infoLabel}>Site Web</div>
                <div style={{...styles.infoValue, color: colors.accent}}>el-mouhssinine.web.app</div>
              </div>
              <span style={{fontSize: '18px', color: colors.accent}}>→</span>
            </a>
          </div>
        </div>

        {/* Version */}
        <div style={{textAlign: 'center', padding: '20px 0'}}>
          <p style={{fontSize: '12px', color: colors.textMuted}}>Version 1.0.0</p>
          <p style={{fontSize: '11px', color: colors.textMuted}}>© 2026 El Mouhssinine</p>
        </div>

        {/* Section Notifications */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🔔 Notifications de prière</h2>
          <div style={{...styles.card, cursor: 'default'}}>
            {/* Toggle principal */}
            <div style={{...styles.infoRow, justifyContent: 'space-between'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <div style={styles.infoIcon}>🔔</div>
                <div style={styles.infoContent}>
                  <div style={styles.infoValue}>Activer les rappels</div>
                </div>
              </div>
              <div 
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                style={{
                  width: '50px',
                  height: '28px',
                  borderRadius: '14px',
                  background: notificationsEnabled ? colors.accent : '#e0e0e0',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '12px',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: notificationsEnabled ? '24px' : '2px',
                  transition: 'left 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}></div>
              </div>
            </div>
            
            {notificationsEnabled && (
              <>
                {/* Minutes avant */}
                <div style={{...styles.infoRow, justifyContent: 'space-between'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <div style={styles.infoIcon}>⏱️</div>
                    <div style={styles.infoContent}>
                      <div style={styles.infoValue}>Rappel avant la prière</div>
                    </div>
                  </div>
                  <select 
                    value={notifMinutes}
                    onChange={(e) => setNotifMinutes(Number(e.target.value))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,0,0,0.1)',
                      background: '#f8f8fa',
                      color: colors.text,
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>
                
                {/* Son Adhan */}
                <div style={{...styles.infoRow, justifyContent: 'space-between'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <div style={styles.infoIcon}>🔊</div>
                    <div style={styles.infoContent}>
                      <div style={styles.infoValue}>Son de l'Adhan</div>
                    </div>
                  </div>
                  <div 
                    onClick={() => setAdhanSound(!adhanSound)}
                    style={{
                      width: '50px',
                      height: '28px',
                      borderRadius: '14px',
                      background: adhanSound ? colors.accent : '#e0e0e0',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '12px',
                      background: '#fff',
                      position: 'absolute',
                      top: '2px',
                      left: adhanSound ? '24px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></div>
                  </div>
                </div>
                
                {/* Rappel Jumu'a */}
                <div style={{...styles.infoRow, borderBottom: 'none', justifyContent: 'space-between'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <div style={styles.infoIcon}>🕌</div>
                    <div style={styles.infoContent}>
                      <div style={styles.infoValue}>Rappel Jumu'a (vendredi)</div>
                    </div>
                  </div>
                  <div 
                    onClick={() => setJumuaReminder(!jumuaReminder)}
                    style={{
                      width: '50px',
                      height: '28px',
                      borderRadius: '14px',
                      background: jumuaReminder ? colors.accent : '#e0e0e0',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '12px',
                      background: '#fff',
                      position: 'absolute',
                      top: '2px',
                      left: jumuaReminder ? '24px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // ==================== MODAL RIB ====================
  const RIBModal = () => {
    const projectData = getSelectedProjectData();
    const isExternal = projectData && projectData.lieu;
    const ribToShow = isExternal ? { iban: projectData.iban, titulaire: projectData.name, banque: projectData.lieu } : mosqueeRIB;
    
    return (
      <div style={styles.modal} onClick={() => setShowRIBModal(false)}>
        <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
          <button style={styles.closeBtn} onClick={() => setShowRIBModal(false)}>×</button>
          <h2 style={styles.modalTitle}>🏦 Virement bancaire</h2>
          
          {selectedProject && isExternal && (
            <div style={{background: `rgba(212,175,55,0.1)`, borderRadius: '12px', padding: '12px', marginBottom: '16px', textAlign: 'center'}}>
              <span style={{fontSize: '12px', color: colors.accent}}>Don pour : {projectData.name}</span>
            </div>
          )}
          
          <div style={styles.ribCard}>
            <div style={styles.ribHeader}>
              <div style={styles.ribIcon}>{isExternal ? projectData.icon : '🕌'}</div>
              <div style={styles.ribTitulaire}>{ribToShow.titulaire}</div>
              <div style={styles.ribBanque}>{isExternal ? `📍 ${ribToShow.banque}` : ribToShow.banque}</div>
            </div>
            
            <div style={styles.ribRow}>
              <div>
                <div style={styles.ribLabel}>IBAN</div>
                <div style={{...styles.ribValue, fontSize: '12px'}}>{ribToShow.iban}</div>
              </div>
              <button 
                style={styles.copyBtn} 
                onClick={() => copyToClipboard(ribToShow.iban, 'modal-iban')}
              >
                {copied === 'modal-iban' ? '✓' : '📋'}
              </button>
            </div>
            
            {!isExternal && (
              <div style={{...styles.ribRow, ...styles.ribRowLast}}>
                <div>
                  <div style={styles.ribLabel}>BIC</div>
                  <div style={styles.ribValue}>{mosqueeRIB.bic}</div>
                </div>
              </div>
            )}
          </div>

          <p style={styles.disclaimer}>
            Indiquez votre email en référence pour recevoir votre reçu fiscal
          </p>
        </div>
      </div>
    );
  };

  // ==================== MODAL PAIEMENT ====================
  const PaymentModal = () => {
    const projectData = getSelectedProjectData();
    const amount = getFinalAmount();
    
    return (
      <div style={styles.modal} onClick={() => setShowPaymentModal(false)}>
        <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
          <button style={styles.closeBtn} onClick={() => setShowPaymentModal(false)}>×</button>
          <h2 style={styles.modalTitle}>💳 Don de {amount}€</h2>
          
          {projectData && (
            <div style={{background: colors.card, borderRadius: '12px', padding: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px'}}>
              <span style={{fontSize: '24px'}}>{projectData.icon}</span>
              <div>
                <div style={{fontSize: '14px', fontWeight: '600'}}>{projectData.name}</div>
                {projectData.lieu && <div style={{fontSize: '11px', color: colors.accent}}>📍 {projectData.lieu}</div>}
              </div>
            </div>
          )}
          
          <div 
            style={{...styles.paymentOption, ...(paymentMethod === 'card' ? styles.paymentOptionSelected : {})}}
            onClick={() => setPaymentMethod('card')}
          >
            <span style={styles.paymentIcon}>💳</span>
            <div style={styles.paymentInfo}>
              <div style={styles.paymentTitle}>Carte bancaire</div>
              <div style={styles.paymentDesc}>Visa, Mastercard, CB</div>
            </div>
            {paymentMethod === 'card' && <div style={styles.checkmark}>✓</div>}
          </div>

          <div 
            style={{...styles.paymentOption, ...(paymentMethod === 'apple' ? styles.paymentOptionSelected : {})}}
            onClick={() => setPaymentMethod('apple')}
          >
            <span style={styles.paymentIcon}>🍎</span>
            <div style={styles.paymentInfo}>
              <div style={styles.paymentTitle}>Apple Pay</div>
              <div style={styles.paymentDesc}>Paiement rapide et sécurisé</div>
            </div>
            {paymentMethod === 'apple' && <div style={styles.checkmark}>✓</div>}
          </div>

          <div 
            style={{...styles.paymentOption, ...(paymentMethod === 'google' ? styles.paymentOptionSelected : {})}}
            onClick={() => setPaymentMethod('google')}
          >
            <span style={styles.paymentIcon}>🟢</span>
            <div style={styles.paymentInfo}>
              <div style={styles.paymentTitle}>Google Pay</div>
              <div style={styles.paymentDesc}>Paiement via Google</div>
            </div>
            {paymentMethod === 'google' && <div style={styles.checkmark}>✓</div>}
          </div>

          <button 
            style={{...styles.primaryBtn, marginTop: '20px', opacity: paymentMethod ? 1 : 0.5}}
          >
            🔒 Payer {amount}€
          </button>

          <p style={{...styles.disclaimer, fontSize: '11px'}}>
            Paiement sécurisé par Stripe • Reçu fiscal envoyé par email
          </p>
        </div>
      </div>
    );
  };

  // ==================== MODAL COTISATION ====================
  const CotisationModal = () => {
    const selectedCotisation = cotisationOptions.find(c => c.id === cotisationType);
    
    return (
      <div style={styles.modal} onClick={() => setShowCotisationModal(false)}>
        <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
          <button style={styles.closeBtn} onClick={() => setShowCotisationModal(false)}>×</button>
          <h2 style={styles.modalTitle}>💳 Cotisation {selectedCotisation.label}</h2>
          
          <div style={{background: colors.card, borderRadius: '12px', padding: '20px', marginBottom: '20px', textAlign: 'center'}}>
            <div style={{fontSize: '40px', marginBottom: '8px'}}>
              {cotisationType === 'mensuel' ? '🔄' : '📅'}
            </div>
            <div style={{fontSize: '32px', fontWeight: 'bold', color: colors.accent}}>
              {selectedCotisation.amount}€
            </div>
            <div style={{fontSize: '14px', color: colors.textMuted}}>
              {cotisationType === 'mensuel' ? 'par mois' : 'par an'}
            </div>
            {cotisationType === 'mensuel' && (
              <div style={{fontSize: '12px', color: colors.accent, marginTop: '8px'}}>
                Prélèvement automatique chaque mois
              </div>
            )}
          </div>
          
          <div 
            style={{...styles.paymentOption, ...(paymentMethod === 'card' ? styles.paymentOptionSelected : {})}}
            onClick={() => setPaymentMethod('card')}
          >
            <span style={styles.paymentIcon}>💳</span>
            <div style={styles.paymentInfo}>
              <div style={styles.paymentTitle}>Carte bancaire</div>
              <div style={styles.paymentDesc}>
                {cotisationType === 'mensuel' ? 'Prélèvement automatique' : 'Paiement unique'}
              </div>
            </div>
            {paymentMethod === 'card' && <div style={styles.checkmark}>✓</div>}
          </div>

          <div 
            style={{...styles.paymentOption, ...(paymentMethod === 'apple' ? styles.paymentOptionSelected : {})}}
            onClick={() => setPaymentMethod('apple')}
          >
            <span style={styles.paymentIcon}>🍎</span>
            <div style={styles.paymentInfo}>
              <div style={styles.paymentTitle}>Apple Pay</div>
              <div style={styles.paymentDesc}>Paiement rapide et sécurisé</div>
            </div>
            {paymentMethod === 'apple' && <div style={styles.checkmark}>✓</div>}
          </div>

          {cotisationType === 'mensuel' && (
            <div 
              style={{...styles.paymentOption, ...(paymentMethod === 'sepa' ? styles.paymentOptionSelected : {})}}
              onClick={() => setPaymentMethod('sepa')}
            >
              <span style={styles.paymentIcon}>🏦</span>
              <div style={styles.paymentInfo}>
                <div style={styles.paymentTitle}>Prélèvement SEPA</div>
                <div style={styles.paymentDesc}>Depuis votre compte bancaire</div>
              </div>
              {paymentMethod === 'sepa' && <div style={styles.checkmark}>✓</div>}
            </div>
          )}

          <button 
            style={{...styles.primaryBtn, marginTop: '20px', opacity: paymentMethod ? 1 : 0.5}}
          >
            🔒 {cotisationType === 'mensuel' ? `S'abonner ${selectedCotisation.amount}€/mois` : `Payer ${selectedCotisation.amount}€`}
          </button>

          <p style={{...styles.disclaimer, fontSize: '11px'}}>
            {cotisationType === 'mensuel' 
              ? 'Vous pouvez annuler à tout moment • Reçu fiscal annuel'
              : 'Paiement sécurisé par Stripe • Reçu fiscal envoyé par email'
            }
          </p>
        </div>
      </div>
    );
  };

  // ==================== MODAL ZAKAT ====================
  const ZakatModal = () => {
    const nisab = 5000; // Nisab en euros (approximatif)
    const totalWealth = (parseFloat(zakatEpargne) || 0) + (parseFloat(zakatOr) || 0) + (parseFloat(zakatArgent) || 0);
    const zakatAmount = totalWealth >= nisab ? (totalWealth * 0.025) : 0;
    const isEligible = totalWealth >= nisab;
    
    return (
      <div style={styles.modal} onClick={() => setShowZakatModal(false)}>
        <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
          <button style={styles.closeBtn} onClick={() => setShowZakatModal(false)}>×</button>
          <h2 style={styles.modalTitle}>🧮 Calculateur de Zakat</h2>
          
          <div style={{
            background: '#f8f8fa',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: colors.textSecondary
          }}>
            <strong style={{color: colors.text}}>📌 Nisab actuel :</strong> ~{nisab.toLocaleString()}€<br/>
            <span style={{fontSize: '11px'}}>(Valeur de 85g d'or ou 595g d'argent)</span>
          </div>
          
          <div style={{marginBottom: '16px'}}>
            <label style={{fontSize: '13px', color: colors.textSecondary, marginBottom: '6px', display: 'block'}}>
              💰 Épargne (comptes bancaires)
            </label>
            <input 
              type="number"
              placeholder="0"
              value={zakatEpargne}
              onChange={(e) => setZakatEpargne(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid rgba(0,0,0,0.1)',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <div style={{marginBottom: '16px'}}>
            <label style={{fontSize: '13px', color: colors.textSecondary, marginBottom: '6px', display: 'block'}}>
              🥇 Valeur de l'or possédé
            </label>
            <input 
              type="number"
              placeholder="0"
              value={zakatOr}
              onChange={(e) => setZakatOr(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid rgba(0,0,0,0.1)',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <div style={{marginBottom: '20px'}}>
            <label style={{fontSize: '13px', color: colors.textSecondary, marginBottom: '6px', display: 'block'}}>
              🥈 Valeur de l'argent possédé
            </label>
            <input 
              type="number"
              placeholder="0"
              value={zakatArgent}
              onChange={(e) => setZakatArgent(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid rgba(0,0,0,0.1)',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          {/* Résultat */}
          <div style={{
            background: isEligible ? 'rgba(39,174,96,0.1)' : 'rgba(0,0,0,0.03)',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center',
            marginBottom: '16px',
            border: isEligible ? '1px solid rgba(39,174,96,0.2)' : '1px solid rgba(0,0,0,0.06)'
          }}>
            <div style={{fontSize: '13px', color: colors.textMuted, marginBottom: '4px'}}>
              Total des biens : {totalWealth.toLocaleString()}€
            </div>
            {isEligible ? (
              <>
                <div style={{fontSize: '14px', color: '#27ae60', marginBottom: '8px'}}>
                  ✓ Vous êtes redevable de la Zakat
                </div>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: '#27ae60'}}>
                  {zakatAmount.toFixed(2)}€
                </div>
                <div style={{fontSize: '12px', color: colors.textMuted, marginTop: '4px'}}>
                  (2.5% de vos biens)
                </div>
              </>
            ) : (
              <div style={{fontSize: '14px', color: colors.textMuted}}>
                Vos biens n'atteignent pas le Nisab.<br/>
                La Zakat n'est pas obligatoire.
              </div>
            )}
          </div>
          
          {isEligible && (
            <button 
              style={styles.primaryBtn}
              onClick={() => {
                setSelectedAmount(Math.ceil(zakatAmount));
                setShowZakatModal(false);
                setCurrentTab('donations');
              }}
            >
              💝 Donner ma Zakat ({zakatAmount.toFixed(0)}€)
            </button>
          )}
          
          <p style={{fontSize: '11px', color: colors.textMuted, textAlign: 'center'}}>
            Ce calcul est une estimation. Consultez un savant pour plus de précision.
          </p>
        </div>
      </div>
    );
  };

  // ==================== MODAL ANNULATION ====================
  const CancelModal = () => (
    <div style={styles.modal} onClick={() => setShowCancelModal(false)}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={() => setShowCancelModal(false)}>×</button>
        
        <div style={{textAlign: 'center', marginBottom: '24px'}}>
          <div style={{fontSize: '50px', marginBottom: '16px'}}>⚠️</div>
          <h2 style={{fontSize: '20px', fontWeight: '600', color: '#e74c3c', marginBottom: '8px'}}>
            Annuler l'abonnement ?
          </h2>
          <p style={{fontSize: '14px', color: colors.textSecondary, lineHeight: '1.5'}}>
            Êtes-vous sûr de vouloir annuler votre abonnement mensuel ?
          </p>
        </div>
        
        <div style={{
          background: '#f8f8fa',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{fontSize: '13px', color: colors.textSecondary, marginBottom: '12px'}}>
            <strong style={{color: colors.text}}>Ce qui va se passer :</strong>
          </div>
          <ul style={{margin: 0, paddingLeft: '20px', fontSize: '13px', color: colors.textSecondary, lineHeight: '1.8'}}>
            <li>Votre abonnement sera annulé immédiatement</li>
            <li>Plus aucun prélèvement ne sera effectué</li>
            <li>Votre statut adhérent restera actif jusqu'au {memberStatus.nextPayment}</li>
            <li>Vous pourrez vous réabonner à tout moment</li>
          </ul>
        </div>
        
        <button 
          style={{
            width: '100%',
            padding: '16px',
            background: '#e74c3c',
            border: 'none',
            borderRadius: '12px',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '12px'
          }}
          onClick={() => {
            setMemberStatus({...memberStatus, cotisationStatus: 'expired', nextPayment: null, type: null});
            setShowCancelModal(false);
          }}
        >
          ✕ Confirmer l'annulation
        </button>
        
        <button 
          style={{
            width: '100%',
            padding: '14px',
            background: 'transparent',
            border: '2px solid #27ae60',
            borderRadius: '12px',
            color: '#27ae60',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
          onClick={() => setShowCancelModal(false)}
        >
          ← Garder mon abonnement
        </button>
      </div>
    </div>
  );

  // ==================== RENDER ====================
  return (
    <div style={styles.container}>
      {currentTab === 'home' && <HomeScreen />}
      {currentTab === 'donations' && <DonationsScreen />}
      {currentTab === 'member' && <MemberScreen />}
      {currentTab === 'spiritual' && <SpiritualScreen />}
      {currentTab === 'more' && <MoreScreen />}
      
      {showRIBModal && <RIBModal />}
      {showPaymentModal && <PaymentModal />}
      {showCotisationModal && <CotisationModal />}
      {showCancelModal && <CancelModal />}
      {showZakatModal && <ZakatModal />}

      {/* Navbar */}
      <nav style={styles.navbar}>
        {[
          { id: 'home', icon: '🕌', label: 'Accueil' },
          { id: 'donations', icon: '💝', label: 'Dons' },
          { id: 'member', icon: '👤', label: 'Adhérent' },
          { id: 'spiritual', icon: '📖', label: 'Spirituel' },
          { id: 'more', icon: '☰', label: 'Plus' },
        ].map(item => (
          <button
            key={item.id}
            style={{...styles.navItem, ...(currentTab === item.id ? styles.navItemActive : {})}}
            onClick={() => setCurrentTab(item.id)}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
