// Alphabet arabe complet avec les 28 lettres

export interface ArabicLetter {
  id: string;
  name: string;
  nameAr: string;
  sound: string;
  isolated: string;
  initial: string;
  medial: string;
  final: string;
  audio: string;
  description: string;
  connectsLeft: boolean;
}

export const arabicAlphabet: ArabicLetter[] = [
  {
    id: 'alif',
    name: 'Alif',
    nameAr: 'ألف',
    sound: 'a',
    isolated: 'ا',
    initial: 'ا',
    medial: 'ـا',
    final: 'ـا',
    audio: 'alif.mp3',
    description: "Première lettre. Se prononce comme le 'a' français. Ne se connecte jamais à gauche.",
    connectsLeft: false
  },
  {
    id: 'ba',
    name: 'Ba',
    nameAr: 'باء',
    sound: 'b',
    isolated: 'ب',
    initial: 'بـ',
    medial: 'ـبـ',
    final: 'ـب',
    audio: 'ba.mp3',
    description: "Se prononce comme le 'b' français. Le point est en dessous.",
    connectsLeft: true
  },
  {
    id: 'ta',
    name: 'Ta',
    nameAr: 'تاء',
    sound: 't',
    isolated: 'ت',
    initial: 'تـ',
    medial: 'ـتـ',
    final: 'ـت',
    audio: 'ta.mp3',
    description: "Se prononce comme le 't' français. Deux points au-dessus.",
    connectsLeft: true
  },
  {
    id: 'tha',
    name: 'Tha',
    nameAr: 'ثاء',
    sound: 'th',
    isolated: 'ث',
    initial: 'ثـ',
    medial: 'ـثـ',
    final: 'ـث',
    audio: 'tha.mp3',
    description: "Se prononce comme le 'th' anglais de 'think'. Trois points au-dessus.",
    connectsLeft: true
  },
  {
    id: 'jim',
    name: 'Jim',
    nameAr: 'جيم',
    sound: 'j',
    isolated: 'ج',
    initial: 'جـ',
    medial: 'ـجـ',
    final: 'ـج',
    audio: 'jim.mp3',
    description: "Se prononce comme le 'j' français.",
    connectsLeft: true
  },
  {
    id: 'ha',
    name: 'Ha',
    nameAr: 'حاء',
    sound: 'ḥ',
    isolated: 'ح',
    initial: 'حـ',
    medial: 'ـحـ',
    final: 'ـح',
    audio: 'ha.mp3',
    description: "Son guttural, comme un souffle profond de la gorge.",
    connectsLeft: true
  },
  {
    id: 'kha',
    name: 'Kha',
    nameAr: 'خاء',
    sound: 'kh',
    isolated: 'خ',
    initial: 'خـ',
    medial: 'ـخـ',
    final: 'ـخ',
    audio: 'kha.mp3',
    description: "Comme le 'r' grasseyé ou le 'ch' allemand de 'Bach'.",
    connectsLeft: true
  },
  {
    id: 'dal',
    name: 'Dal',
    nameAr: 'دال',
    sound: 'd',
    isolated: 'د',
    initial: 'د',
    medial: 'ـد',
    final: 'ـد',
    audio: 'dal.mp3',
    description: "Se prononce comme le 'd' français. Ne se connecte jamais à gauche.",
    connectsLeft: false
  },
  {
    id: 'dhal',
    name: 'Dhal',
    nameAr: 'ذال',
    sound: 'dh',
    isolated: 'ذ',
    initial: 'ذ',
    medial: 'ـذ',
    final: 'ـذ',
    audio: 'dhal.mp3',
    description: "Comme le 'th' anglais de 'the'. Ne se connecte jamais à gauche.",
    connectsLeft: false
  },
  {
    id: 'ra',
    name: 'Ra',
    nameAr: 'راء',
    sound: 'r',
    isolated: 'ر',
    initial: 'ر',
    medial: 'ـر',
    final: 'ـر',
    audio: 'ra.mp3',
    description: "R roulé. Ne se connecte jamais à gauche.",
    connectsLeft: false
  },
  {
    id: 'zay',
    name: 'Zay',
    nameAr: 'زاي',
    sound: 'z',
    isolated: 'ز',
    initial: 'ز',
    medial: 'ـز',
    final: 'ـز',
    audio: 'zay.mp3',
    description: "Se prononce comme le 'z' français. Ne se connecte jamais à gauche.",
    connectsLeft: false
  },
  {
    id: 'sin',
    name: 'Sin',
    nameAr: 'سين',
    sound: 's',
    isolated: 'س',
    initial: 'سـ',
    medial: 'ـسـ',
    final: 'ـس',
    audio: 'sin.mp3',
    description: "Se prononce comme le 's' français.",
    connectsLeft: true
  },
  {
    id: 'shin',
    name: 'Shin',
    nameAr: 'شين',
    sound: 'sh',
    isolated: 'ش',
    initial: 'شـ',
    medial: 'ـشـ',
    final: 'ـش',
    audio: 'shin.mp3',
    description: "Se prononce comme le 'ch' français.",
    connectsLeft: true
  },
  {
    id: 'sad',
    name: 'Sad',
    nameAr: 'صاد',
    sound: 'ṣ',
    isolated: 'ص',
    initial: 'صـ',
    medial: 'ـصـ',
    final: 'ـص',
    audio: 'sad.mp3',
    description: "S emphatique, prononcé avec la langue plus en arrière.",
    connectsLeft: true
  },
  {
    id: 'dad',
    name: 'Dad',
    nameAr: 'ضاد',
    sound: 'ḍ',
    isolated: 'ض',
    initial: 'ضـ',
    medial: 'ـضـ',
    final: 'ـض',
    audio: 'dad.mp3',
    description: "D emphatique. Lettre unique à l'arabe, d'où 'langue du Dad'.",
    connectsLeft: true
  },
  {
    id: 'taa',
    name: 'Ta (emphatique)',
    nameAr: 'طاء',
    sound: 'ṭ',
    isolated: 'ط',
    initial: 'طـ',
    medial: 'ـطـ',
    final: 'ـط',
    audio: 'ta_emphatic.mp3',
    description: "T emphatique, prononcé avec la langue plus en arrière.",
    connectsLeft: true
  },
  {
    id: 'dhaa',
    name: 'Dha',
    nameAr: 'ظاء',
    sound: 'ẓ',
    isolated: 'ظ',
    initial: 'ظـ',
    medial: 'ـظـ',
    final: 'ـظ',
    audio: 'dha.mp3',
    description: "Dh emphatique.",
    connectsLeft: true
  },
  {
    id: 'ayn',
    name: 'Ayn',
    nameAr: 'عين',
    sound: 'ʿ',
    isolated: 'ع',
    initial: 'عـ',
    medial: 'ـعـ',
    final: 'ـع',
    audio: 'ayn.mp3',
    description: "Son guttural profond, contraction de la gorge. Unique à l'arabe.",
    connectsLeft: true
  },
  {
    id: 'ghayn',
    name: 'Ghayn',
    nameAr: 'غين',
    sound: 'gh',
    isolated: 'غ',
    initial: 'غـ',
    medial: 'ـغـ',
    final: 'ـغ',
    audio: 'ghayn.mp3',
    description: "Comme le 'r' parisien grasseyé.",
    connectsLeft: true
  },
  {
    id: 'fa',
    name: 'Fa',
    nameAr: 'فاء',
    sound: 'f',
    isolated: 'ف',
    initial: 'فـ',
    medial: 'ـفـ',
    final: 'ـف',
    audio: 'fa.mp3',
    description: "Se prononce comme le 'f' français.",
    connectsLeft: true
  },
  {
    id: 'qaf',
    name: 'Qaf',
    nameAr: 'قاف',
    sound: 'q',
    isolated: 'ق',
    initial: 'قـ',
    medial: 'ـقـ',
    final: 'ـق',
    audio: 'qaf.mp3',
    description: "K guttural profond, prononcé du fond de la gorge.",
    connectsLeft: true
  },
  {
    id: 'kaf',
    name: 'Kaf',
    nameAr: 'كاف',
    sound: 'k',
    isolated: 'ك',
    initial: 'كـ',
    medial: 'ـكـ',
    final: 'ـك',
    audio: 'kaf.mp3',
    description: "Se prononce comme le 'k' français.",
    connectsLeft: true
  },
  {
    id: 'lam',
    name: 'Lam',
    nameAr: 'لام',
    sound: 'l',
    isolated: 'ل',
    initial: 'لـ',
    medial: 'ـلـ',
    final: 'ـل',
    audio: 'lam.mp3',
    description: "Se prononce comme le 'l' français.",
    connectsLeft: true
  },
  {
    id: 'mim',
    name: 'Mim',
    nameAr: 'ميم',
    sound: 'm',
    isolated: 'م',
    initial: 'مـ',
    medial: 'ـمـ',
    final: 'ـم',
    audio: 'mim.mp3',
    description: "Se prononce comme le 'm' français.",
    connectsLeft: true
  },
  {
    id: 'nun',
    name: 'Nun',
    nameAr: 'نون',
    sound: 'n',
    isolated: 'ن',
    initial: 'نـ',
    medial: 'ـنـ',
    final: 'ـن',
    audio: 'nun.mp3',
    description: "Se prononce comme le 'n' français.",
    connectsLeft: true
  },
  {
    id: 'haa',
    name: 'Ha (léger)',
    nameAr: 'هاء',
    sound: 'h',
    isolated: 'ه',
    initial: 'هـ',
    medial: 'ـهـ',
    final: 'ـه',
    audio: 'ha_light.mp3',
    description: "H aspiré léger, comme en anglais 'hello'.",
    connectsLeft: true
  },
  {
    id: 'waw',
    name: 'Waw',
    nameAr: 'واو',
    sound: 'w/u',
    isolated: 'و',
    initial: 'و',
    medial: 'ـو',
    final: 'ـو',
    audio: 'waw.mp3',
    description: "Comme le 'w' anglais ou le 'ou' français. Ne se connecte jamais à gauche.",
    connectsLeft: false
  },
  {
    id: 'ya',
    name: 'Ya',
    nameAr: 'ياء',
    sound: 'y/i',
    isolated: 'ي',
    initial: 'يـ',
    medial: 'ـيـ',
    final: 'ـي',
    audio: 'ya.mp3',
    description: "Comme le 'y' de 'yaourt' ou le 'i' long.",
    connectsLeft: true
  },
];

export interface SpecialLetter {
  id: string;
  name: string;
  nameAr: string;
  isolated: string;
  forms?: string[];
  form?: string;
  description: string;
}

export const specialLetters: SpecialLetter[] = [
  {
    id: 'hamza',
    name: 'Hamza',
    nameAr: 'همزة',
    isolated: 'ء',
    forms: ['ء', 'أ', 'إ', 'ئ', 'ؤ'],
    description: "Coup de glotte, comme une petite pause."
  },
  {
    id: 'ta_marbuta',
    name: 'Ta Marbuta',
    nameAr: 'تاء مربوطة',
    isolated: 'ة',
    form: 'ة',
    description: "T final féminin, prononcé 'a' ou 'at'."
  },
  {
    id: 'alif_maqsura',
    name: 'Alif Maqsura',
    nameAr: 'ألف مقصورة',
    isolated: 'ى',
    form: 'ى',
    description: "A final, ressemble au Ya sans points."
  },
];

export interface LetterGroup {
  id: string;
  name: string;
  nameAr: string;
  letters: string[];
  description: string;
}

// Groupes de lettres par forme similaire
export const letterGroups: LetterGroup[] = [
  {
    id: 'ba_ta_tha',
    name: 'Groupe Ba-Ta-Tha',
    nameAr: 'ب ت ث',
    letters: ['ba', 'ta', 'tha'],
    description: 'Même forme de base, différenciées par les points'
  },
  {
    id: 'jim_ha_kha',
    name: 'Groupe Jim-Ha-Kha',
    nameAr: 'ج ح خ',
    letters: ['jim', 'ha', 'kha'],
    description: 'Forme arrondie avec crochet'
  },
  {
    id: 'dal_dhal',
    name: 'Groupe Dal-Dhal',
    nameAr: 'د ذ',
    letters: ['dal', 'dhal'],
    description: 'Forme simple, ne se connectent pas à gauche'
  },
  {
    id: 'ra_zay',
    name: 'Groupe Ra-Zay',
    nameAr: 'ر ز',
    letters: ['ra', 'zay'],
    description: 'Forme courbée, ne se connectent pas à gauche'
  },
  {
    id: 'sin_shin',
    name: 'Groupe Sin-Shin',
    nameAr: 'س ش',
    letters: ['sin', 'shin'],
    description: 'Forme en dents'
  },
  {
    id: 'sad_dad',
    name: 'Groupe Sad-Dad',
    nameAr: 'ص ض',
    letters: ['sad', 'dad'],
    description: 'Forme ovale emphatique'
  },
  {
    id: 'taa_dhaa',
    name: 'Groupe Ta-Dha (emphatiques)',
    nameAr: 'ط ظ',
    letters: ['taa', 'dhaa'],
    description: 'Forme verticale emphatique'
  },
  {
    id: 'ayn_ghayn',
    name: 'Groupe Ayn-Ghayn',
    nameAr: 'ع غ',
    letters: ['ayn', 'ghayn'],
    description: 'Forme en boucle'
  },
  {
    id: 'fa_qaf',
    name: 'Groupe Fa-Qaf',
    nameAr: 'ف ق',
    letters: ['fa', 'qaf'],
    description: 'Forme arrondie avec queue'
  },
];
