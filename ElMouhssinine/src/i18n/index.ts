import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'fr' | 'ar';

export const translations = {
  fr: {
    // Navigation
    home: 'Accueil',
    donations: 'Dons',
    member: 'Adhérent',
    quran: 'Coran',
    more: 'Plus',

    // Home Screen
    welcome: 'السلام عليكم ورحمة الله وبركاته',
    mosqueName: 'El Mouhssinine',
    mosqueLocation: 'Mosquée - Bourg-en-Bresse',
    nextPrayer: 'Prochaine prière',
    todaySchedule: 'Horaires du jour',
    hijriCalendar: 'Calendrier Hégirien',

    // Prayers
    fajr: 'Fajr',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
    jumua: 'Jumu\'a',

    // Member Screen
    memberArea: 'Espace Adhérent',
    manageSubscription: 'Gérez votre adhésion',
    login: 'Se connecter',
    createAccount: 'Créer un compte',
    logout: 'Déconnexion',
    memberBenefits: 'Avantages adhérents',
    taxReceipt: 'Reçu fiscal automatique',
    reducedRates: 'Tarifs réduits cours & activités',
    votingRights: 'Droit de vote en AG',
    priorityNotifications: 'Notifications prioritaires',
    subscription: 'Cotisation',
    monthly: 'Mensuel',
    yearly: 'Annuel',
    perMonth: '/mois',
    perYear: '/an',

    // Donations
    donationsTitle: 'Dons & Projets',
    donate: 'Faire un don',
    viewProject: 'Voir le projet',
    collected: 'collectés',
    goal: 'Objectif',
    internalProjects: 'Projets internes',
    externalProjects: 'Projets externes',

    // Quran
    quranTitle: 'Le Saint Coran',
    surah: 'Sourate',
    verses: 'versets',
    meccan: 'Mecquoise',
    medinan: 'Médinoise',
    play: 'Écouter',
    favorite: 'Favoris',
    copy: 'Copier',

    // Invocations
    invocations: 'Invocations',
    morningAdhkar: 'Adhkar du matin',
    eveningAdhkar: 'Adhkar du soir',
    afterPrayer: 'Après la prière',
    beforeSleep: 'Avant de dormir',
    wakeUp: 'Au réveil',
    protection: 'Protection',
    repetitions: 'répétitions',

    // Learn Arabic
    learnArabic: 'Apprendre l\'arabe',
    alphabet: 'Alphabet',
    vowels: 'Voyelles',
    vocabulary: 'Vocabulaire',

    // Janaza
    janazaTitle: 'Salat Janaza',
    upcoming: 'À venir',
    condolences: 'Nous appartenons à Allah et c\'est vers Lui que nous retournerons',

    // More Screen
    settings: 'Paramètres',
    qiblaDirection: 'Direction Qibla',
    mosqueBankInfo: 'RIB Mosquée',
    mosqueInfo: 'Infos mosquée',
    notifications: 'Notifications',
    prayerReminder: 'Rappel prière',
    adhanSound: 'Son Adhan',
    jumuaReminder: 'Rappel Jumu\'a',
    language: 'Langue',
    french: 'Français',
    arabic: 'العربية',
    version: 'Version',
    enableReminders: 'Activer les rappels',
    reminderBefore: 'Rappel avant la prière',
    jumuaFriday: 'Rappel Jumu\'a (vendredi)',
    bankDetails: 'Coordonnées bancaires',
    information: 'Informations',
    prayerNotifications: 'Notifications de prière',
    address: 'Adresse',
    phone: 'Téléphone',
    email: 'Email',
    website: 'Site Web',

    // Common
    save: 'Enregistrer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    delete: 'Supprimer',
    edit: 'Modifier',
    close: 'Fermer',
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',

    // Days
    tomorrow: 'demain',
    today: 'aujourd\'hui',
    after: 'Après',

    // Events
    events: 'Événements',
    noEvents: 'Aucun événement à venir',

    // Spiritual
    spiritual: 'Spirituel',
  },

  ar: {
    // Navigation
    home: 'الرئيسية',
    donations: 'التبرعات',
    member: 'العضوية',
    quran: 'القرآن',
    more: 'المزيد',

    // Home Screen
    welcome: 'السلام عليكم ورحمة الله وبركاته',
    mosqueName: 'المحسنين',
    mosqueLocation: 'مسجد - بورغ أون بريس',
    nextPrayer: 'الصلاة القادمة',
    todaySchedule: 'مواقيت اليوم',
    hijriCalendar: 'التقويم الهجري',

    // Prayers
    fajr: 'الفجر',
    dhuhr: 'الظهر',
    asr: 'العصر',
    maghrib: 'المغرب',
    isha: 'العشاء',
    jumua: 'الجمعة',

    // Member Screen
    memberArea: 'منطقة العضو',
    manageSubscription: 'إدارة اشتراكك',
    login: 'تسجيل الدخول',
    createAccount: 'إنشاء حساب',
    logout: 'تسجيل الخروج',
    memberBenefits: 'مزايا العضوية',
    taxReceipt: 'إيصال ضريبي تلقائي',
    reducedRates: 'أسعار مخفضة للدورات',
    votingRights: 'حق التصويت',
    priorityNotifications: 'إشعارات ذات أولوية',
    subscription: 'الاشتراك',
    monthly: 'شهري',
    yearly: 'سنوي',
    perMonth: '/شهر',
    perYear: '/سنة',

    // Donations
    donationsTitle: 'التبرعات والمشاريع',
    donate: 'تبرع',
    viewProject: 'عرض المشروع',
    collected: 'تم جمعها',
    goal: 'الهدف',
    internalProjects: 'المشاريع الداخلية',
    externalProjects: 'المشاريع الخارجية',

    // Quran
    quranTitle: 'القرآن الكريم',
    surah: 'سورة',
    verses: 'آيات',
    meccan: 'مكية',
    medinan: 'مدنية',
    play: 'استماع',
    favorite: 'المفضلة',
    copy: 'نسخ',

    // Invocations
    invocations: 'الأذكار',
    morningAdhkar: 'أذكار الصباح',
    eveningAdhkar: 'أذكار المساء',
    afterPrayer: 'بعد الصلاة',
    beforeSleep: 'قبل النوم',
    wakeUp: 'عند الاستيقاظ',
    protection: 'الحماية',
    repetitions: 'مرات',

    // Learn Arabic
    learnArabic: 'تعلم العربية',
    alphabet: 'الأبجدية',
    vowels: 'الحركات',
    vocabulary: 'المفردات',

    // Janaza
    janazaTitle: 'صلاة الجنازة',
    upcoming: 'القادمة',
    condolences: 'إنا لله وإنا إليه راجعون',

    // More Screen
    settings: 'الإعدادات',
    qiblaDirection: 'اتجاه القبلة',
    mosqueBankInfo: 'معلومات البنك',
    mosqueInfo: 'معلومات المسجد',
    notifications: 'الإشعارات',
    prayerReminder: 'تذكير الصلاة',
    adhanSound: 'صوت الأذان',
    jumuaReminder: 'تذكير الجمعة',
    language: 'اللغة',
    french: 'Français',
    arabic: 'العربية',
    version: 'الإصدار',
    enableReminders: 'تفعيل التذكيرات',
    reminderBefore: 'تذكير قبل الصلاة',
    jumuaFriday: 'تذكير الجمعة',
    bankDetails: 'التفاصيل البنكية',
    information: 'المعلومات',
    prayerNotifications: 'إشعارات الصلاة',
    address: 'العنوان',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    website: 'الموقع',

    // Common
    save: 'حفظ',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    delete: 'حذف',
    edit: 'تعديل',
    close: 'إغلاق',
    loading: 'جاري التحميل...',
    error: 'خطأ',
    success: 'نجاح',

    // Days
    tomorrow: 'غداً',
    today: 'اليوم',
    after: 'بعد',

    // Events
    events: 'الفعاليات',
    noEvents: 'لا توجد فعاليات قادمة',

    // Spiritual
    spiritual: 'روحي',
  },
};

// Type for translation keys
export type TranslationKey = keyof typeof translations['fr'];

// Sauvegarder la langue
export const setLanguage = async (lang: Language): Promise<void> => {
  await AsyncStorage.setItem('app_language', lang);
};

// Récupérer la langue
export const getLanguage = async (): Promise<Language> => {
  const lang = await AsyncStorage.getItem('app_language');
  return (lang as Language) || 'fr';
};
