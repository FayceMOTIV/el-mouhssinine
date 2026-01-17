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
  {
    id: '8',
    texteFr: "Le croyant est le miroir du croyant.",
    texteAr: 'المؤمن مرآة المؤمن',
    source: 'Hadith Abu Dawud',
    actif: true,
  },
  {
    id: '9',
    texteFr: "Facilite et ne complique pas, annonce la bonne nouvelle et ne fais pas fuir.",
    texteAr: 'يسروا ولا تعسروا وبشروا ولا تنفروا',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '10',
    texteFr: "Le musulman est celui dont les musulmans sont à l'abri de sa langue et de sa main.",
    texteAr: 'المسلم من سلم المسلمون من لسانه ويده',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '11',
    texteFr: "Aucun de vous ne sera véritablement croyant tant qu'il n'aimera pas pour son frère ce qu'il aime pour lui-même.",
    texteAr: 'لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '12',
    texteFr: "La meilleure des invocations est celle du jour de Arafat.",
    texteAr: 'خير الدعاء دعاء يوم عرفة',
    source: 'Hadith Tirmidhi',
    actif: true,
  },
  {
    id: '13',
    texteFr: "Celui qui emprunte un chemin pour acquérir une science, Allah lui facilite un chemin vers le Paradis.",
    texteAr: 'من سلك طريقاً يلتمس فيه علماً سهل الله له به طريقاً إلى الجنة',
    source: 'Hadith Muslim',
    actif: true,
  },
  {
    id: '14',
    texteFr: "Les plus aimés d'entre vous auprès d'Allah sont ceux qui ont le meilleur caractère.",
    texteAr: 'إن أحبكم إلي وأقربكم مني مجلساً يوم القيامة أحاسنكم أخلاقاً',
    source: 'Hadith Tirmidhi',
    actif: true,
  },
  {
    id: '15',
    texteFr: "La pudeur fait partie de la foi.",
    texteAr: 'الحياء من الإيمان',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '16',
    texteFr: "Le fort n'est pas celui qui terrasse les gens, mais celui qui se maîtrise lors de la colère.",
    texteAr: 'ليس الشديد بالصرعة إنما الشديد الذي يملك نفسه عند الغضب',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '17',
    texteFr: "Fais preuve de bon comportement envers les gens.",
    texteAr: 'وخالق الناس بخلق حسن',
    source: 'Hadith Tirmidhi',
    actif: true,
  },
  {
    id: '18',
    texteFr: "L'invocation est l'essence de l'adoration.",
    texteAr: 'الدعاء هو العبادة',
    source: 'Hadith Tirmidhi',
    actif: true,
  },
  {
    id: '19',
    texteFr: "Quiconque croit en Allah et au Jour Dernier, qu'il honore son voisin.",
    texteAr: 'من كان يؤمن بالله واليوم الآخر فليكرم جاره',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '20',
    texteFr: "Préserve Allah, Il te préservera.",
    texteAr: 'احفظ الله يحفظك',
    source: 'Hadith Tirmidhi',
    actif: true,
  },
  {
    id: '21',
    texteFr: "La patience est lumière.",
    texteAr: 'والصبر ضياء',
    source: 'Hadith Muslim',
    actif: true,
  },
  {
    id: '22',
    texteFr: "Certes, Allah est Beau et Il aime la beauté.",
    texteAr: 'إن الله جميل يحب الجمال',
    source: 'Hadith Muslim',
    actif: true,
  },
  {
    id: '23',
    texteFr: "Le meilleur d'entre vous est celui qui est le plus utile aux gens.",
    texteAr: 'خير الناس أنفعهم للناس',
    source: 'Hadith Tabarani',
    actif: true,
  },
  {
    id: '24',
    texteFr: "Celui qui n'est pas miséricordieux envers les gens, Allah ne sera pas miséricordieux envers lui.",
    texteAr: 'من لا يرحم الناس لا يرحمه الله',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '25',
    texteFr: "Délaisse ce qui te fait douter pour ce qui ne te fait pas douter.",
    texteAr: 'دع ما يريبك إلى ما لا يريبك',
    source: 'Hadith Tirmidhi & Nasa\'i',
    actif: true,
  },
  {
    id: '26',
    texteFr: "Le Coran intercédera pour ses compagnons le Jour de la Résurrection.",
    texteAr: 'اقرؤوا القرآن فإنه يأتي يوم القيامة شفيعاً لأصحابه',
    source: 'Hadith Muslim',
    actif: true,
  },
  {
    id: '27',
    texteFr: "La recherche du savoir est une obligation pour chaque musulman.",
    texteAr: 'طلب العلم فريضة على كل مسلم',
    source: 'Hadith Ibn Majah',
    actif: true,
  },
  {
    id: '28',
    texteFr: "Les meilleurs d'entre vous sont ceux qui ont le meilleur comportement envers leurs épouses.",
    texteAr: 'خياركم خياركم لنسائهم',
    source: 'Hadith Tirmidhi',
    actif: true,
  },
  {
    id: '29',
    texteFr: "Celui qui montre le chemin vers un bien a la même récompense que celui qui l'accomplit.",
    texteAr: 'الدال على الخير كفاعله',
    source: 'Hadith Muslim',
    actif: true,
  },
  {
    id: '30',
    texteFr: "Dis la vérité même si elle est amère.",
    texteAr: 'قل الحق ولو كان مراً',
    source: 'Hadith Ibn Hibban',
    actif: true,
  },
  {
    id: '31',
    texteFr: "Allah ne regarde pas vos corps ni vos apparences, mais Il regarde vos cœurs.",
    texteAr: 'إن الله لا ينظر إلى أجسادكم ولا إلى صوركم ولكن ينظر إلى قلوبكم',
    source: 'Hadith Muslim',
    actif: true,
  },
  {
    id: '32',
    texteFr: "Quiconque fait ses ablutions parfaitement, ses péchés sortent de son corps.",
    texteAr: 'من توضأ فأحسن الوضوء خرجت خطاياه من جسده',
    source: 'Hadith Muslim',
    actif: true,
  },
  {
    id: '33',
    texteFr: "La prière est la clé du Paradis.",
    texteAr: 'مفتاح الجنة الصلاة',
    source: 'Hadith Ahmad',
    actif: true,
  },
  {
    id: '34',
    texteFr: "Celui qui jeûne le mois de Ramadan avec foi et espérance verra ses péchés passés pardonnés.",
    texteAr: 'من صام رمضان إيماناً واحتساباً غفر له ما تقدم من ذنبه',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '35',
    texteFr: "Les liens de parenté sont suspendus au Trône, et ils disent : Celui qui nous maintient, Allah le maintiendra.",
    texteAr: 'الرحم معلقة بالعرش تقول من وصلني وصله الله',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '36',
    texteFr: "Évitez les sept péchés destructeurs.",
    texteAr: 'اجتنبوا السبع الموبقات',
    source: 'Hadith Bukhari & Muslim',
    actif: true,
  },
  {
    id: '37',
    texteFr: "La main supérieure est meilleure que la main inférieure.",
    texteAr: 'اليد العليا خير من اليد السفلى',
    source: 'Hadith Bukhari & Muslim',
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
