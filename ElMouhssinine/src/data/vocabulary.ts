// Vocabulaire islamique et arabe courant

export interface VocabularyWord {
  id: number;
  arabic: string;
  transliteration: string;
  translation: string;
  category: string;
  example?: string;
  exampleTranslation?: string;
}

export interface VocabularyCategory {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  description: string;
}

export const vocabularyCategories: VocabularyCategory[] = [
  {
    id: 'islamic',
    name: 'Termes islamiques',
    nameAr: 'مصطلحات إسلامية',
    icon: '🕌',
    description: 'Vocabulaire religieux essentiel'
  },
  {
    id: 'greetings',
    name: 'Salutations',
    nameAr: 'التحيات',
    icon: '👋',
    description: 'Formules de politesse'
  },
  {
    id: 'prayers',
    name: 'Priere',
    nameAr: 'الصلاة',
    icon: '🤲',
    description: 'Vocabulaire lie a la priere'
  },
  {
    id: 'family',
    name: 'Famille',
    nameAr: 'العائلة',
    icon: '👨‍👩‍👧‍👦',
    description: 'Membres de la famille'
  },
  {
    id: 'numbers',
    name: 'Nombres',
    nameAr: 'الأرقام',
    icon: '🔢',
    description: 'Les chiffres en arabe'
  },
  {
    id: 'days',
    name: 'Jours et mois',
    nameAr: 'الأيام والشهور',
    icon: '📅',
    description: 'Le calendrier'
  },
  {
    id: 'nature',
    name: 'Nature',
    nameAr: 'الطبيعة',
    icon: '🌿',
    description: 'Elements naturels'
  },
  {
    id: 'body',
    name: 'Corps humain',
    nameAr: 'جسم الإنسان',
    icon: '🧍',
    description: 'Parties du corps'
  },
];

export const vocabulary: Record<string, VocabularyWord[]> = {
  islamic: [
    { id: 1, arabic: 'اللّٰه', transliteration: 'Allah', translation: 'Dieu', category: 'islamic' },
    { id: 2, arabic: 'إِسْلام', transliteration: 'Islam', translation: 'Soumission (a Dieu)', category: 'islamic' },
    { id: 3, arabic: 'مُسْلِم', transliteration: 'Muslim', translation: 'Musulman (celui qui se soumet)', category: 'islamic' },
    { id: 4, arabic: 'قُرْآن', transliteration: 'Qur\'an', translation: 'Coran (la recitation)', category: 'islamic' },
    { id: 5, arabic: 'صَلاة', transliteration: 'Salah', translation: 'Priere rituelle', category: 'islamic' },
    { id: 6, arabic: 'صِيام', transliteration: 'Siyam', translation: 'Jeune', category: 'islamic' },
    { id: 7, arabic: 'زَكاة', transliteration: 'Zakah', translation: 'Aumone obligatoire', category: 'islamic' },
    { id: 8, arabic: 'حَجّ', transliteration: 'Hajj', translation: 'Pelerinage', category: 'islamic' },
    { id: 9, arabic: 'شَهادة', transliteration: 'Shahadah', translation: 'Attestation de foi', category: 'islamic' },
    { id: 10, arabic: 'إِيمان', transliteration: 'Iman', translation: 'Foi', category: 'islamic' },
    { id: 11, arabic: 'إِحْسان', transliteration: 'Ihsan', translation: 'Excellence dans l\'adoration', category: 'islamic' },
    { id: 12, arabic: 'تَقْوَى', transliteration: 'Taqwa', translation: 'Crainte pieuse de Dieu', category: 'islamic' },
    { id: 13, arabic: 'سُنَّة', transliteration: 'Sunnah', translation: 'Tradition prophetique', category: 'islamic' },
    { id: 14, arabic: 'حَديث', transliteration: 'Hadith', translation: 'Parole prophetique', category: 'islamic' },
    { id: 15, arabic: 'مَسْجِد', transliteration: 'Masjid', translation: 'Mosquee', category: 'islamic' },
    { id: 16, arabic: 'كَعْبة', transliteration: 'Ka\'bah', translation: 'La Kaaba', category: 'islamic' },
    { id: 17, arabic: 'قِبْلة', transliteration: 'Qiblah', translation: 'Direction de la priere', category: 'islamic' },
    { id: 18, arabic: 'وُضوء', transliteration: 'Wudu\'', translation: 'Ablutions', category: 'islamic' },
    { id: 19, arabic: 'أَذان', transliteration: 'Adhan', translation: 'Appel a la priere', category: 'islamic' },
    { id: 20, arabic: 'إِمام', transliteration: 'Imam', translation: 'Guide de priere', category: 'islamic' },
    { id: 21, arabic: 'جَنَّة', transliteration: 'Jannah', translation: 'Paradis', category: 'islamic' },
    { id: 22, arabic: 'نار', transliteration: 'Nar', translation: 'Feu (Enfer)', category: 'islamic' },
    { id: 23, arabic: 'مَلَك', transliteration: 'Malak', translation: 'Ange', category: 'islamic' },
    { id: 24, arabic: 'نَبِيّ', transliteration: 'Nabi', translation: 'Prophete', category: 'islamic' },
    { id: 25, arabic: 'رَسول', transliteration: 'Rasul', translation: 'Messager', category: 'islamic' },
  ],
  greetings: [
    { id: 1, arabic: 'السَّلامُ عَلَيْكُم', transliteration: 'As-salamu alaykum', translation: 'Que la paix soit sur vous', category: 'greetings' },
    { id: 2, arabic: 'وَعَلَيْكُمُ السَّلام', transliteration: 'Wa alaykum as-salam', translation: 'Et sur vous la paix', category: 'greetings' },
    { id: 3, arabic: 'صَباحُ الخَيْر', transliteration: 'Sabah al-khayr', translation: 'Bonjour (matin)', category: 'greetings' },
    { id: 4, arabic: 'مَساءُ الخَيْر', transliteration: 'Masa\' al-khayr', translation: 'Bonsoir', category: 'greetings' },
    { id: 5, arabic: 'مَرْحَبا', transliteration: 'Marhaba', translation: 'Bienvenue', category: 'greetings' },
    { id: 6, arabic: 'أَهْلاً وَسَهْلاً', transliteration: 'Ahlan wa sahlan', translation: 'Bienvenue (plus formel)', category: 'greetings' },
    { id: 7, arabic: 'شُكْراً', transliteration: 'Shukran', translation: 'Merci', category: 'greetings' },
    { id: 8, arabic: 'جَزاكَ اللهُ خَيْراً', transliteration: 'Jazak Allahu khayran', translation: 'Qu\'Allah te recompense par le bien', category: 'greetings' },
    { id: 9, arabic: 'عَفْواً', transliteration: '\'Afwan', translation: 'De rien / Pardon', category: 'greetings' },
    { id: 10, arabic: 'مَعَ السَّلامة', transliteration: 'Ma\'a as-salamah', translation: 'Au revoir (avec la paix)', category: 'greetings' },
    { id: 11, arabic: 'إِنْ شاءَ الله', transliteration: 'In sha\' Allah', translation: 'Si Dieu le veut', category: 'greetings' },
    { id: 12, arabic: 'ما شاءَ الله', transliteration: 'Ma sha\' Allah', translation: 'Ce qu\'Allah a voulu (admiration)', category: 'greetings' },
    { id: 13, arabic: 'الحَمْدُ لِلّه', transliteration: 'Al-hamdu lillah', translation: 'Louange a Allah', category: 'greetings' },
    { id: 14, arabic: 'سُبْحانَ الله', transliteration: 'Subhan Allah', translation: 'Gloire a Allah', category: 'greetings' },
    { id: 15, arabic: 'اللهُ أَكْبَر', transliteration: 'Allahu akbar', translation: 'Allah est le Plus Grand', category: 'greetings' },
    { id: 16, arabic: 'بارَكَ اللهُ فيك', transliteration: 'Barak Allahu fik', translation: 'Qu\'Allah te benisse', category: 'greetings' },
    { id: 17, arabic: 'يَرْحَمُكَ الله', transliteration: 'Yarhamuk Allah', translation: 'Qu\'Allah te fasse misericorde', category: 'greetings' },
  ],
  prayers: [
    { id: 1, arabic: 'الفَجْر', transliteration: 'Al-Fajr', translation: 'L\'aube', category: 'prayers' },
    { id: 2, arabic: 'الظُّهْر', transliteration: 'Adh-Dhuhr', translation: 'Le midi', category: 'prayers' },
    { id: 3, arabic: 'العَصْر', transliteration: 'Al-\'Asr', translation: 'L\'apres-midi', category: 'prayers' },
    { id: 4, arabic: 'المَغْرِب', transliteration: 'Al-Maghrib', translation: 'Le coucher du soleil', category: 'prayers' },
    { id: 5, arabic: 'العِشاء', transliteration: 'Al-\'Isha\'', translation: 'La nuit', category: 'prayers' },
    { id: 6, arabic: 'رَكْعة', transliteration: 'Rak\'ah', translation: 'Unite de priere', category: 'prayers' },
    { id: 7, arabic: 'سُجود', transliteration: 'Sujud', translation: 'Prosternation', category: 'prayers' },
    { id: 8, arabic: 'رُكوع', transliteration: 'Ruku\'', translation: 'Inclinaison', category: 'prayers' },
    { id: 9, arabic: 'قِيام', transliteration: 'Qiyam', translation: 'Station debout', category: 'prayers' },
    { id: 10, arabic: 'تَشَهُّد', transliteration: 'Tashahhud', translation: 'Attestation', category: 'prayers' },
    { id: 11, arabic: 'تَسْليم', transliteration: 'Taslim', translation: 'Salutation finale', category: 'prayers' },
    { id: 12, arabic: 'سُورة', transliteration: 'Surah', translation: 'Chapitre du Coran', category: 'prayers' },
    { id: 13, arabic: 'آية', transliteration: 'Ayah', translation: 'Verset', category: 'prayers' },
    { id: 14, arabic: 'الجُمُعة', transliteration: 'Al-Jumu\'ah', translation: 'Le vendredi', category: 'prayers' },
    { id: 15, arabic: 'خُطْبة', transliteration: 'Khutbah', translation: 'Sermon', category: 'prayers' },
  ],
  family: [
    { id: 1, arabic: 'أَب', transliteration: 'Ab', translation: 'Pere', category: 'family' },
    { id: 2, arabic: 'أُمّ', transliteration: 'Umm', translation: 'Mere', category: 'family' },
    { id: 3, arabic: 'اِبْن', transliteration: 'Ibn', translation: 'Fils', category: 'family' },
    { id: 4, arabic: 'بِنْت', transliteration: 'Bint', translation: 'Fille', category: 'family' },
    { id: 5, arabic: 'أَخ', transliteration: 'Akh', translation: 'Frere', category: 'family' },
    { id: 6, arabic: 'أُخْت', transliteration: 'Ukht', translation: 'Soeur', category: 'family' },
    { id: 7, arabic: 'جَدّ', transliteration: 'Jadd', translation: 'Grand-pere', category: 'family' },
    { id: 8, arabic: 'جَدَّة', transliteration: 'Jaddah', translation: 'Grand-mere', category: 'family' },
    { id: 9, arabic: 'عَمّ', transliteration: '\'Amm', translation: 'Oncle paternel', category: 'family' },
    { id: 10, arabic: 'خال', transliteration: 'Khal', translation: 'Oncle maternel', category: 'family' },
    { id: 11, arabic: 'عَمَّة', transliteration: '\'Ammah', translation: 'Tante paternelle', category: 'family' },
    { id: 12, arabic: 'خالة', transliteration: 'Khalah', translation: 'Tante maternelle', category: 'family' },
    { id: 13, arabic: 'زَوْج', transliteration: 'Zawj', translation: 'Epoux', category: 'family' },
    { id: 14, arabic: 'زَوْجة', transliteration: 'Zawjah', translation: 'Epouse', category: 'family' },
    { id: 15, arabic: 'عائِلة', transliteration: '\'A\'ilah', translation: 'Famille', category: 'family' },
  ],
  numbers: [
    { id: 1, arabic: 'واحِد', transliteration: 'Wahid', translation: 'Un (1)', category: 'numbers' },
    { id: 2, arabic: 'اِثْنان', transliteration: 'Ithnan', translation: 'Deux (2)', category: 'numbers' },
    { id: 3, arabic: 'ثَلاثة', transliteration: 'Thalathah', translation: 'Trois (3)', category: 'numbers' },
    { id: 4, arabic: 'أَرْبَعة', transliteration: 'Arba\'ah', translation: 'Quatre (4)', category: 'numbers' },
    { id: 5, arabic: 'خَمْسة', transliteration: 'Khamsah', translation: 'Cinq (5)', category: 'numbers' },
    { id: 6, arabic: 'سِتَّة', transliteration: 'Sittah', translation: 'Six (6)', category: 'numbers' },
    { id: 7, arabic: 'سَبْعة', transliteration: 'Sab\'ah', translation: 'Sept (7)', category: 'numbers' },
    { id: 8, arabic: 'ثَمانية', transliteration: 'Thamaniyah', translation: 'Huit (8)', category: 'numbers' },
    { id: 9, arabic: 'تِسْعة', transliteration: 'Tis\'ah', translation: 'Neuf (9)', category: 'numbers' },
    { id: 10, arabic: 'عَشَرة', transliteration: '\'Asharah', translation: 'Dix (10)', category: 'numbers' },
    { id: 11, arabic: 'مِئة', transliteration: 'Mi\'ah', translation: 'Cent (100)', category: 'numbers' },
    { id: 12, arabic: 'أَلْف', transliteration: 'Alf', translation: 'Mille (1000)', category: 'numbers' },
  ],
  days: [
    { id: 1, arabic: 'الأَحَد', transliteration: 'Al-Ahad', translation: 'Dimanche', category: 'days' },
    { id: 2, arabic: 'الإِثْنَيْن', transliteration: 'Al-Ithnayn', translation: 'Lundi', category: 'days' },
    { id: 3, arabic: 'الثُّلاثاء', transliteration: 'Ath-Thulatha\'', translation: 'Mardi', category: 'days' },
    { id: 4, arabic: 'الأَرْبِعاء', transliteration: 'Al-Arbi\'a\'', translation: 'Mercredi', category: 'days' },
    { id: 5, arabic: 'الخَميس', transliteration: 'Al-Khamis', translation: 'Jeudi', category: 'days' },
    { id: 6, arabic: 'الجُمُعة', transliteration: 'Al-Jumu\'ah', translation: 'Vendredi', category: 'days' },
    { id: 7, arabic: 'السَّبْت', transliteration: 'As-Sabt', translation: 'Samedi', category: 'days' },
    { id: 8, arabic: 'يَوْم', transliteration: 'Yawm', translation: 'Jour', category: 'days' },
    { id: 9, arabic: 'أُسْبوع', transliteration: 'Usbu\'', translation: 'Semaine', category: 'days' },
    { id: 10, arabic: 'شَهْر', transliteration: 'Shahr', translation: 'Mois', category: 'days' },
    { id: 11, arabic: 'سَنة', transliteration: 'Sanah', translation: 'Annee', category: 'days' },
    { id: 12, arabic: 'مُحَرَّم', transliteration: 'Muharram', translation: 'Muharram (1er mois)', category: 'days' },
    { id: 13, arabic: 'صَفَر', transliteration: 'Safar', translation: 'Safar (2e mois)', category: 'days' },
    { id: 14, arabic: 'رَمَضان', transliteration: 'Ramadan', translation: 'Ramadan (9e mois)', category: 'days' },
    { id: 15, arabic: 'ذو الحِجَّة', transliteration: 'Dhul Hijjah', translation: 'Dhul Hijjah (12e mois)', category: 'days' },
  ],
  nature: [
    { id: 1, arabic: 'سَماء', transliteration: 'Sama\'', translation: 'Ciel', category: 'nature' },
    { id: 2, arabic: 'أَرْض', transliteration: 'Ard', translation: 'Terre', category: 'nature' },
    { id: 3, arabic: 'شَمْس', transliteration: 'Shams', translation: 'Soleil', category: 'nature' },
    { id: 4, arabic: 'قَمَر', transliteration: 'Qamar', translation: 'Lune', category: 'nature' },
    { id: 5, arabic: 'نَجْم', transliteration: 'Najm', translation: 'Etoile', category: 'nature' },
    { id: 6, arabic: 'ماء', transliteration: 'Ma\'', translation: 'Eau', category: 'nature' },
    { id: 7, arabic: 'نار', transliteration: 'Nar', translation: 'Feu', category: 'nature' },
    { id: 8, arabic: 'هَواء', transliteration: 'Hawa\'', translation: 'Air', category: 'nature' },
    { id: 9, arabic: 'بَحْر', transliteration: 'Bahr', translation: 'Mer', category: 'nature' },
    { id: 10, arabic: 'نَهْر', transliteration: 'Nahr', translation: 'Fleuve', category: 'nature' },
    { id: 11, arabic: 'جَبَل', transliteration: 'Jabal', translation: 'Montagne', category: 'nature' },
    { id: 12, arabic: 'شَجَرة', transliteration: 'Shajarah', translation: 'Arbre', category: 'nature' },
    { id: 13, arabic: 'زَهْرة', transliteration: 'Zahrah', translation: 'Fleur', category: 'nature' },
    { id: 14, arabic: 'مَطَر', transliteration: 'Matar', translation: 'Pluie', category: 'nature' },
    { id: 15, arabic: 'رِيح', transliteration: 'Rih', translation: 'Vent', category: 'nature' },
  ],
  body: [
    { id: 1, arabic: 'رَأْس', transliteration: 'Ra\'s', translation: 'Tete', category: 'body' },
    { id: 2, arabic: 'وَجْه', transliteration: 'Wajh', translation: 'Visage', category: 'body' },
    { id: 3, arabic: 'عَيْن', transliteration: '\'Ayn', translation: 'Oeil', category: 'body' },
    { id: 4, arabic: 'أُذُن', transliteration: 'Udhun', translation: 'Oreille', category: 'body' },
    { id: 5, arabic: 'أَنْف', transliteration: 'Anf', translation: 'Nez', category: 'body' },
    { id: 6, arabic: 'فَم', transliteration: 'Fam', translation: 'Bouche', category: 'body' },
    { id: 7, arabic: 'يَد', transliteration: 'Yad', translation: 'Main', category: 'body' },
    { id: 8, arabic: 'رِجْل', transliteration: 'Rijl', translation: 'Pied/Jambe', category: 'body' },
    { id: 9, arabic: 'قَلْب', transliteration: 'Qalb', translation: 'Coeur', category: 'body' },
    { id: 10, arabic: 'صَدْر', transliteration: 'Sadr', translation: 'Poitrine', category: 'body' },
    { id: 11, arabic: 'بَطْن', transliteration: 'Batn', translation: 'Ventre', category: 'body' },
    { id: 12, arabic: 'ظَهْر', transliteration: 'Dhahr', translation: 'Dos', category: 'body' },
  ],
};
