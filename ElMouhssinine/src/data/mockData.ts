// Données Mock réalistes pour la démo El Mouhssinine
// Ces données sont utilisées quand Firebase est vide ou en erreur

// ==================== ANNONCES ====================
export const mockAnnouncements = [
  {
    id: '1',
    title: 'Cours de Coran pour enfants',
    content: 'Les inscriptions pour les cours de Coran sont ouvertes. Tous les samedis de 14h à 16h. Places limitées.',
    isActive: true,
    publishedAt: new Date('2026-01-10'),
  },
  {
    id: '2',
    title: 'Collecte de vêtements',
    content: 'Une collecte de vêtements chauds pour les plus démunis aura lieu ce weekend. Merci de votre générosité.',
    isActive: true,
    publishedAt: new Date('2026-01-09'),
  },
  {
    id: '3',
    title: 'Conférence ce vendredi',
    content: 'Conférence sur "La patience en Islam" après la prière de Isha. Entrée libre.',
    isActive: true,
    publishedAt: new Date('2026-01-08'),
  },
];

// ==================== ÉVÉNEMENTS ====================
export const mockEvents = [
  {
    id: '1',
    title: 'Journée portes ouvertes',
    description: 'Venez découvrir notre mosquée et rencontrer la communauté. Programme: visite guidée, présentation des activités, collation offerte.',
    date: new Date('2026-01-25'),
    time: '14:00',
    location: 'Mosquée El Mouhssinine',
    isActive: true,
    category: 'communaute',
  },
  {
    id: '2',
    title: "Cours d'arabe - Niveau débutant",
    description: 'Nouveau cycle de cours d\'arabe pour débutants. Inscription obligatoire. Matériel fourni.',
    date: new Date('2026-02-01'),
    time: '10:00',
    location: 'Salle de cours',
    isActive: true,
    category: 'education',
  },
  {
    id: '3',
    title: 'Iftar communautaire',
    description: 'Iftar offert par la mosquée. Réservation recommandée. Participation libre pour les frais.',
    date: new Date('2026-03-10'),
    time: '19:30',
    location: 'Grande salle',
    isActive: true,
    category: 'ramadan',
  },
  {
    id: '4',
    title: 'Conférence: La patience en Islam',
    description: 'Par Sheikh Ahmed. Venez nombreux pour cette conférence enrichissante sur la patience et la persévérance.',
    date: new Date('2026-01-17'),
    time: '20:30',
    location: 'Salle principale',
    isActive: true,
    category: 'conference',
  },
  {
    id: '5',
    title: 'Cours de Tajwid',
    description: 'Apprenez les règles de récitation du Coran. Tous niveaux acceptés.',
    date: new Date('2026-01-18'),
    time: '14:00',
    location: "Salle d'étude",
    isActive: true,
    category: 'education',
  },
];

// ==================== SALAT JANAZA ====================
export const mockJanaza = [
  {
    id: '1',
    deceasedName: 'Mohamed Ben Ahmed',
    deceasedNameAr: 'محمد بن أحمد',
    prayerDate: new Date('2026-01-12'),
    prayerTime: 'Après Dhuhr',
    location: 'Mosquée El Mouhssinine',
    message: "Qu'Allah lui fasse miséricorde et l'accueille dans Son vaste paradis.",
    messageAr: 'رحمه الله وأسكنه فسيح جناته',
    isActive: true,
  },
];

// ==================== PROJETS / DONS ====================
export const mockProjects = [
  {
    id: '1',
    name: 'Rénovation salle de prière',
    description: 'Travaux de rénovation de la salle de prière principale : nouveau tapis, peinture, climatisation.',
    goal: 15000,
    raised: 8750,
    icon: '🕌',
    isExternal: false,
    isActive: true,
  },
  {
    id: '2',
    name: 'Achat de livres islamiques',
    description: "Constitution d'une bibliothèque avec des ouvrages en français et en arabe.",
    goal: 2000,
    raised: 1200,
    icon: '📚',
    isExternal: false,
    isActive: true,
  },
  {
    id: '3',
    name: 'Aide aux nécessiteux',
    description: 'Distribution alimentaire mensuelle pour les familles dans le besoin.',
    goal: 5000,
    raised: 3200,
    icon: '🤲',
    isExternal: false,
    isActive: true,
  },
  {
    id: 'ext1',
    name: 'Aide humanitaire - Gaza',
    description: 'Collecte pour nos frères et sœurs de Gaza. Fonds envoyés via le Secours Islamique France.',
    goal: 10000,
    raised: 7500,
    icon: '🇵🇸',
    isExternal: true,
    isActive: true,
    lieu: 'Gaza, Palestine',
    iban: 'Secours Islamique France',
  },
  {
    id: 'ext2',
    name: 'Construction de puits - Sénégal',
    description: "Construction de puits d'eau potable pour les villages ruraux du Sénégal.",
    goal: 8000,
    raised: 6500,
    icon: '💧',
    isExternal: true,
    isActive: true,
    lieu: 'Sénégal',
    iban: 'Islamic Relief',
  },
  {
    id: 'ext3',
    name: 'Mosquée Al-Nour Lyon',
    description: 'Achat de nouveaux locaux pour la mosquée Al-Nour de Lyon.',
    goal: 50000,
    raised: 32000,
    icon: '🏗️',
    isExternal: true,
    isActive: true,
    lieu: 'Lyon, France',
    iban: 'FR76 3000 4028 3700 0100 0000 123',
  },
];

// ==================== MEMBRES ====================
export const mockMembers = [
  {
    id: '1',
    firstName: 'Ahmed',
    lastName: 'Benali',
    email: 'ahmed.benali@email.com',
    phone: '06 12 34 56 78',
    memberSince: new Date('2024-01-15'),
    cotisationStatus: 'active',
    cotisationExpiry: new Date('2026-12-31'),
    cotisationAmount: 50,
  },
  {
    id: '2',
    firstName: 'Fatima',
    lastName: 'Kaddouri',
    email: 'fatima.k@email.com',
    phone: '06 98 76 54 32',
    memberSince: new Date('2023-06-01'),
    cotisationStatus: 'active',
    cotisationExpiry: new Date('2026-06-01'),
    cotisationAmount: 50,
  },
  {
    id: '3',
    firstName: 'Youssef',
    lastName: 'Mansouri',
    email: 'y.mansouri@email.com',
    phone: '07 11 22 33 44',
    memberSince: new Date('2025-03-10'),
    cotisationStatus: 'active',
    cotisationExpiry: new Date('2026-03-10'),
    cotisationAmount: 50,
  },
];

// ==================== POPUPS ====================
export const mockPopups = [
  {
    id: '1',
    titre: 'Bienvenue !',
    contenu: "Bienvenue sur l'application de la mosquée El Mouhssinine. Retrouvez les horaires de prière, les annonces et bien plus encore.",
    actif: true,
    dateDebut: '2026-01-01',
    dateFin: '2026-12-31',
    priorite: 1,
  },
];

// ==================== RAPPELS DU JOUR (Hadiths) ====================
export const mockRappels = [
  {
    id: '1',
    texteFr: 'Les actes ne valent que par leurs intentions, et chacun sera rétribué selon son intention.',
    texteAr: 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '2',
    texteFr: "Le meilleur d'entre vous est celui qui apprend le Coran et l'enseigne.",
    texteAr: 'خيركم من تعلم القرآن وعلمه',
    source: 'Hadith Bukhari',
    actif: true,
  },
  {
    id: '3',
    texteFr: "Souriez, c'est une aumône.",
    texteAr: 'تبسمك في وجه أخيك صدقة',
    source: 'Hadith Tirmidhi',
    actif: true,
  },
  {
    id: '4',
    texteFr: "Celui qui croit en Allah et au Jour Dernier, qu'il dise du bien ou qu'il se taise.",
    texteAr: 'من كان يؤمن بالله واليوم الآخر فليقل خيراً أو ليصمت',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '5',
    texteFr: 'Le paradis se trouve sous les pieds des mères.',
    texteAr: 'الجنة تحت أقدام الأمهات',
    source: 'Hadith Nasa\'i',
    actif: true,
  },
  {
    id: '6',
    texteFr: "La propreté fait partie de la foi.",
    texteAr: 'الطهور شطر الإيمان',
    source: 'Hadith Muslim',
    actif: true,
  },
  {
    id: '7',
    texteFr: "Celui qui ne remercie pas les gens ne remercie pas Allah.",
    texteAr: 'لا يشكر الله من لا يشكر الناس',
    source: 'Hadith Abu Dawud',
    actif: true,
  },
];

// ==================== INFOS MOSQUÉE ====================
export const mockMosqueeInfo = {
  name: 'Mosquée El Mouhssinine',
  address: '29 Rue de la Croix Blanche',
  postalCode: '01000',
  city: 'Bourg-en-Bresse',
  phone: '04 74 XX XX XX',
  email: 'contact@elmouhssinine.fr',
  website: 'www.mosqueebourgenbresse.fr',
  iban: 'FR76 XXXX XXXX XXXX XXXX XXXX XXX',
  bic: 'AGRIFRPP',
  bankName: 'Crédit Agricole',
  accountHolder: 'Association El Mouhssinine',
};

// ==================== SERVICES MOSQUÉE ====================
export const mockServices = [
  { icon: '🅿️', label: 'Parking', labelAr: 'موقف سيارات', available: true },
  { icon: '♿', label: 'Accès handicapés', labelAr: 'دخول المعاقين', available: true },
  { icon: '💧', label: "Salle d'ablution", labelAr: 'قاعة الوضوء', available: true },
  { icon: '👩', label: 'Espace femmes', labelAr: 'قسم النساء', available: true },
  { icon: '📚', label: 'Cours adultes', labelAr: 'دروس الكبار', available: true },
  { icon: '👶', label: 'Cours enfants', labelAr: 'دروس الأطفال', available: true },
];

// ==================== ACTIVITÉS ====================
export const mockActivites = [
  { icon: '🎉', label: 'Salat Al Aïd', labelAr: 'صلاة العيد', info: 'Dates à venir' },
  { icon: '🤲', label: 'Salat Janaza', labelAr: 'صلاة الجنازة', info: 'Selon annonces' },
  { icon: '🌙', label: 'Iftar Ramadan', labelAr: 'إفطار رمضان', info: 'Pendant Ramadan' },
  { icon: '📖', label: 'Cours enfants', labelAr: 'دروس الأطفال', info: 'Sam. & Dim.' },
];

// ==================== DATES ISLAMIQUES ====================
export const mockDatesIslamiques = [
  {
    id: '1',
    nom: 'Début Ramadan',
    nomAr: 'بداية رمضان',
    dateHijri: '1 Ramadan 1447',
    dateGregorien: '2026-03-01',
    icon: '🌙',
    approximatif: true,
  },
  {
    id: '2',
    nom: 'Aïd al-Fitr',
    nomAr: 'عيد الفطر',
    dateHijri: '1 Shawwal 1447',
    dateGregorien: '2026-03-30',
    icon: '🎉',
    approximatif: true,
  },
  {
    id: '3',
    nom: 'Aïd al-Adha',
    nomAr: 'عيد الأضحى',
    dateHijri: '10 Dhul Hijja 1447',
    dateGregorien: '2026-06-07',
    icon: '🐑',
    approximatif: true,
  },
  {
    id: '4',
    nom: 'Nouvel An Hégirien',
    nomAr: 'رأس السنة الهجرية',
    dateHijri: '1 Muharram 1448',
    dateGregorien: '2026-06-27',
    icon: '📅',
    approximatif: true,
  },
  {
    id: '5',
    nom: 'Mawlid',
    nomAr: 'المولد النبوي',
    dateHijri: '12 Rabi al-Awwal 1448',
    dateGregorien: '2026-09-05',
    icon: '🕌',
    approximatif: true,
  },
];

// ==================== HORAIRES IQAMA (Délais en minutes) ====================
export const mockIqama = {
  fajr: 15,
  dhuhr: 15,
  asr: 15,
  maghrib: 5,
  isha: 15,
};

// ==================== HORAIRES JUMUA ====================
export const mockJumua = {
  jumua1: '13:00',
  jumua2: '14:00',
};

// ==================== CATÉGORIES ÉVÉNEMENTS ====================
export const eventCategories = [
  { id: 'tous', label: 'Tous', labelAr: 'الكل' },
  { id: 'conference', label: 'Conférence', labelAr: 'محاضرة' },
  { id: 'education', label: 'Éducation', labelAr: 'تعليم' },
  { id: 'communaute', label: 'Communauté', labelAr: 'المجتمع' },
  { id: 'ramadan', label: 'Ramadan', labelAr: 'رمضان' },
];
