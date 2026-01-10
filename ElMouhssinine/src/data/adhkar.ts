// Invocations islamiques (Adhkar)

export interface Dhikr {
  id: string;
  name?: string;
  arabic: string;
  translation: string;
  transliteration: string;
  repetitions: number;
  source: string;
  benefit?: string;
}

export interface AdhkarCategory {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  description: string;
  adhkar: Dhikr[];
}

export const adhkarCategories: AdhkarCategory[] = [
  {
    id: 'morning',
    name: 'Adhkar du matin',
    nameAr: 'أذكار الصباح',
    icon: '🌅',
    description: 'A reciter apres Fajr jusqu\'au lever du soleil',
    adhkar: [
      {
        id: 'morning_1',
        arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
        translation: 'Nous voila au matin et le royaume appartient a Allah. Louange a Allah.',
        transliteration: 'Asbahna wa asbahal mulku lillah, walhamdulillah',
        repetitions: 1,
        source: 'Muslim',
        benefit: 'Protection pour la journee'
      },
      {
        id: 'morning_2',
        arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
        translation: 'O Allah, c\'est par Toi que nous nous retrouvons au matin et c\'est par Toi que nous nous retrouvons au soir.',
        transliteration: 'Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namutu wa ilaykan nushur.',
        repetitions: 1,
        source: 'Tirmidhi'
      },
      {
        id: 'morning_3',
        arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
        translation: 'Gloire et louange a Allah.',
        transliteration: 'Subhanallahi wa bihamdihi.',
        repetitions: 100,
        source: 'Bukhari, Muslim',
        benefit: 'Ses peches seront pardonnes'
      },
    ]
  },
  {
    id: 'evening',
    name: 'Adhkar du soir',
    nameAr: 'أذكار المساء',
    icon: '🌆',
    description: 'A reciter apres Asr jusqu\'au coucher du soleil',
    adhkar: [
      {
        id: 'evening_1',
        arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
        translation: 'Nous voila au soir et le royaume appartient a Allah. Louange a Allah.',
        transliteration: 'Amsayna wa amsal mulku lillah, walhamdulillah',
        repetitions: 1,
        source: 'Muslim'
      },
      {
        id: 'evening_2',
        arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
        translation: 'Je cherche refuge dans les paroles parfaites d\'Allah contre le mal de ce qu\'Il a cree.',
        transliteration: 'A\'udhu bikalimatiLlahit-tammati min sharri ma khalaq.',
        repetitions: 3,
        source: 'Muslim',
        benefit: 'Protection pour la nuit'
      },
    ]
  },
  {
    id: 'afterPrayer',
    name: 'Apres la priere',
    nameAr: 'أذكار بعد الصلاة',
    icon: '🤲',
    description: 'A reciter apres chaque priere obligatoire',
    adhkar: [
      {
        id: 'afterPrayer_1',
        arabic: 'أَسْتَغْفِرُ اللهَ',
        translation: 'Je demande pardon a Allah.',
        transliteration: 'Astaghfirullah.',
        repetitions: 3,
        source: 'Muslim'
      },
      {
        id: 'afterPrayer_2',
        arabic: 'سُبْحَانَ اللهِ',
        translation: 'Gloire a Allah.',
        transliteration: 'Subhanallah.',
        repetitions: 33,
        source: 'Bukhari, Muslim'
      },
      {
        id: 'afterPrayer_3',
        arabic: 'الْحَمْدُ لِلَّهِ',
        translation: 'Louange a Allah.',
        transliteration: 'Alhamdulillah.',
        repetitions: 33,
        source: 'Bukhari, Muslim'
      },
      {
        id: 'afterPrayer_4',
        arabic: 'اللهُ أَكْبَرُ',
        translation: 'Allah est le Plus Grand.',
        transliteration: 'Allahu Akbar.',
        repetitions: 33,
        source: 'Bukhari, Muslim'
      },
    ]
  },
  {
    id: 'sleep',
    name: 'Avant de dormir',
    nameAr: 'أذكار النوم',
    icon: '😴',
    description: 'A reciter avant de s\'endormir',
    adhkar: [
      {
        id: 'sleep_1',
        arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
        translation: 'C\'est en Ton nom, o Allah, que je meurs et que je vis.',
        transliteration: 'Bismika Allahumma amutu wa ahya.',
        repetitions: 1,
        source: 'Bukhari'
      },
      {
        id: 'sleep_2',
        arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
        translation: 'O Allah, protege-moi de Ton chatiment le jour ou Tu ressusciteras Tes serviteurs.',
        transliteration: 'Allahumma qini \'adhabaka yawma tab\'athu \'ibadak.',
        repetitions: 3,
        source: 'Abu Dawud'
      },
    ]
  },
  {
    id: 'wakeup',
    name: 'Au reveil',
    nameAr: 'أذكار الاستيقاظ',
    icon: '☀️',
    description: 'A reciter au reveil',
    adhkar: [
      {
        id: 'wakeup_1',
        arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
        translation: 'Louange a Allah qui nous a redonne la vie apres nous avoir fait mourir, et c\'est vers Lui la resurrection.',
        transliteration: 'Alhamdulillahil-ladhi ahyana ba\'da ma amatana wa ilayhin-nushur.',
        repetitions: 1,
        source: 'Bukhari'
      },
    ]
  },
  {
    id: 'protection',
    name: 'Protection',
    nameAr: 'أذكار الحماية',
    icon: '🛡️',
    description: 'Pour la protection contre le mal',
    adhkar: [
      {
        id: 'protection_1',
        name: 'Ayat Al-Kursi',
        arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
        translation: 'Allah! Point de divinite a part Lui, le Vivant, Celui qui subsiste par lui-meme.',
        transliteration: 'Allahu la ilaha illa huwal hayyul qayyum...',
        repetitions: 1,
        source: 'Coran 2:255'
      },
      {
        id: 'protection_2',
        name: 'Sourate Al-Ikhlas',
        arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
        translation: 'Dis: Il est Allah, Unique.',
        transliteration: 'Qul huwallahu ahad.',
        repetitions: 3,
        source: 'Coran 112'
      },
    ]
  },
  {
    id: 'travel',
    name: 'Voyage',
    nameAr: 'أذكار السفر',
    icon: '✈️',
    description: 'Invocations pour le voyage',
    adhkar: [
      {
        id: 'travel_1',
        arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ',
        translation: 'Gloire a Celui qui a mis ceci a notre service alors que nous n\'etions pas capables de le faire.',
        transliteration: 'Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin.',
        repetitions: 1,
        source: 'Muslim'
      },
    ]
  },
  {
    id: 'food',
    name: 'Repas',
    nameAr: 'أذكار الطعام',
    icon: '🍽️',
    description: 'Avant et apres le repas',
    adhkar: [
      {
        id: 'food_1',
        name: 'Avant le repas',
        arabic: 'بِسْمِ اللَّهِ',
        translation: 'Au nom d\'Allah.',
        transliteration: 'Bismillah.',
        repetitions: 1,
        source: 'Bukhari, Muslim'
      },
      {
        id: 'food_2',
        name: 'Apres le repas',
        arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا',
        translation: 'Louange a Allah qui m\'a nourri de ceci.',
        transliteration: 'Alhamdulillahil-ladhi at\'amani hadha.',
        repetitions: 1,
        source: 'Abu Dawud',
        benefit: 'Ses peches anterieurs seront pardonnes'
      },
    ]
  },
  {
    id: 'mosque',
    name: 'Mosquee',
    nameAr: 'أذكار المسجد',
    icon: '🕌',
    description: 'Entree et sortie de la mosquee',
    adhkar: [
      {
        id: 'mosque_1',
        name: 'En entrant',
        arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
        translation: 'O Allah, ouvre-moi les portes de Ta misericorde.',
        transliteration: 'Allahummaftah li abwaba rahmatik.',
        repetitions: 1,
        source: 'Muslim'
      },
      {
        id: 'mosque_2',
        name: 'En sortant',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ',
        translation: 'O Allah, je Te demande de Ta grace.',
        transliteration: 'Allahumma inni as\'aluka min fadlik.',
        repetitions: 1,
        source: 'Muslim'
      },
    ]
  },
  {
    id: 'rain',
    name: 'Pluie et tonnerre',
    nameAr: 'أذكار المطر والرعد',
    icon: '🌧️',
    description: 'Lors de la pluie et du tonnerre',
    adhkar: [
      {
        id: 'rain_1',
        name: 'Quand il pleut',
        arabic: 'اللَّهُمَّ صَيِّبًا نَافِعًا',
        translation: 'O Allah, qu\'elle soit une pluie benefique.',
        transliteration: 'Allahumma sayyiban nafi\'a.',
        repetitions: 1,
        source: 'Bukhari'
      },
    ]
  },
];
