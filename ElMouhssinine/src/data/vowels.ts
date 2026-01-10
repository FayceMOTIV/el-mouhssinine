// Voyelles et signes diacritiques arabes

export interface Vowel {
  id: string;
  name: string;
  nameAr: string;
  symbol: string;
  sound: string;
  example: string;
  exampleSound: string;
  description: string;
}

export const vowels: Vowel[] = [
  {
    id: 'fatha',
    name: 'Fatha',
    nameAr: 'فَتْحَة',
    symbol: 'ـَ',
    sound: 'a',
    example: 'بَ',
    exampleSound: 'ba',
    description: "Petit trait diagonal au-dessus. Se prononce 'a'."
  },
  {
    id: 'kasra',
    name: 'Kasra',
    nameAr: 'كَسْرَة',
    symbol: 'ـِ',
    sound: 'i',
    example: 'بِ',
    exampleSound: 'bi',
    description: "Petit trait diagonal en-dessous. Se prononce 'i'."
  },
  {
    id: 'damma',
    name: 'Damma',
    nameAr: 'ضَمَّة',
    symbol: 'ـُ',
    sound: 'u',
    example: 'بُ',
    exampleSound: 'bu',
    description: "Petit waw au-dessus. Se prononce 'ou'."
  },
  {
    id: 'sukun',
    name: 'Sukun',
    nameAr: 'سُكُون',
    symbol: 'ـْ',
    sound: '-',
    example: 'بْ',
    exampleSound: 'b',
    description: "Petit cercle au-dessus. Absence de voyelle."
  },
  {
    id: 'shadda',
    name: 'Shadda',
    nameAr: 'شَدَّة',
    symbol: 'ـّ',
    sound: 'double',
    example: 'بَّ',
    exampleSound: 'bba',
    description: "Petit w au-dessus. Double la lettre (gemination)."
  },
];

export interface Tanwin {
  name: string;
  nameAr: string;
  symbol: string;
  sound: string;
  example: string;
  description: string;
}

export const tanwin: Tanwin[] = [
  {
    name: 'Fathatan',
    nameAr: 'فَتْحَتَان',
    symbol: 'ـً',
    sound: 'an',
    example: 'كِتَابًا',
    description: "Double fatha. Se prononce 'an' à la fin d'un mot."
  },
  {
    name: 'Kasratan',
    nameAr: 'كَسْرَتَان',
    symbol: 'ـٍ',
    sound: 'in',
    example: 'كِتَابٍ',
    description: "Double kasra. Se prononce 'in' à la fin d'un mot."
  },
  {
    name: 'Dammatan',
    nameAr: 'ضَمَّتَان',
    symbol: 'ـٌ',
    sound: 'un',
    example: 'كِتَابٌ',
    description: "Double damma. Se prononce 'oun' à la fin d'un mot."
  },
];

// Voyelles longues
export interface LongVowel {
  name: string;
  nameAr: string;
  letters: string;
  sound: string;
  example: string;
  exampleMeaning: string;
  description: string;
}

export const longVowels: LongVowel[] = [
  {
    name: 'Alif (voyelle longue)',
    nameAr: 'ألف المد',
    letters: 'ـَا',
    sound: 'aa',
    example: 'بَاب',
    exampleMeaning: 'porte',
    description: "Fatha suivie de Alif. Voyelle 'a' prolongée."
  },
  {
    name: 'Waw (voyelle longue)',
    nameAr: 'واو المد',
    letters: 'ـُو',
    sound: 'uu',
    example: 'نُور',
    exampleMeaning: 'lumière',
    description: "Damma suivie de Waw. Voyelle 'ou' prolongée."
  },
  {
    name: 'Ya (voyelle longue)',
    nameAr: 'ياء المد',
    letters: 'ـِي',
    sound: 'ii',
    example: 'كَبِير',
    exampleMeaning: 'grand',
    description: "Kasra suivie de Ya. Voyelle 'i' prolongée."
  },
];

// Règles de lecture
export interface ReadingRule {
  name: string;
  nameAr: string;
  description: string;
  examples: string[];
}

export const readingRules: ReadingRule[] = [
  {
    name: 'Lam Shamsiya',
    nameAr: 'اللام الشمسية',
    description: "Le 'l' de l'article 'al' s'assimile aux lettres solaires (ت ث د ذ ر ز س ش ص ض ط ظ ل ن).",
    examples: ['الشَّمْس (ash-shams)', 'النُّور (an-nur)']
  },
  {
    name: 'Lam Qamariya',
    nameAr: 'اللام القمرية',
    description: "Le 'l' de l'article 'al' se prononce avec les lettres lunaires.",
    examples: ['القَمَر (al-qamar)', 'الكِتَاب (al-kitab)']
  },
  {
    name: 'Madd',
    nameAr: 'المد',
    description: "Prolongation de la voyelle sur 2, 4 ou 6 temps selon les règles.",
    examples: ['قَالَ (qaala)', 'يَقُولُ (yaquulu)']
  },
];
