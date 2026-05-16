// Alphabet arabe complet avec les 28 lettres

export interface ArabicLetter {
  id: string;
  name: string;
  nameAr: string;
  sound: string;
  pronunciation: string;
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
    pronunciation: 'ā',
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
    name: 'Bā',
    nameAr: 'باء',
    sound: 'b',
    pronunciation: 'b',
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
    name: 'Tā',
    nameAr: 'تاء',
    sound: 't',
    pronunciation: 't',
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
    name: 'Thā',
    nameAr: 'ثاء',
    sound: 'th',
    pronunciation: 'th',
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
    name: 'Jīm',
    nameAr: 'جيم',
    sound: 'j',
    pronunciation: 'j',
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
    name: 'Ḥā',
    nameAr: 'حاء',
    sound: 'ḥ',
    pronunciation: 'ḥ',
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
    name: 'Khā',
    nameAr: 'خاء',
    sound: 'kh',
    pronunciation: 'kh',
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
    name: 'Dāl',
    nameAr: 'دال',
    sound: 'd',
    pronunciation: 'd',
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
    name: 'Dhāl',
    nameAr: 'ذال',
    sound: 'dh',
    pronunciation: 'dh',
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
    name: 'Rā',
    nameAr: 'راء',
    sound: 'r',
    pronunciation: 'r',
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
    name: 'Zāy',
    nameAr: 'زاي',
    sound: 'z',
    pronunciation: 'z',
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
    name: 'Sīn',
    nameAr: 'سين',
    sound: 's',
    pronunciation: 's',
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
    name: 'Shīn',
    nameAr: 'شين',
    sound: 'sh',
    pronunciation: 'sh',
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
    name: 'Ṣād',
    nameAr: 'صاد',
    sound: 'ṣ',
    pronunciation: 'ṣ',
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
    name: 'Ḍād',
    nameAr: 'ضاد',
    sound: 'ḍ',
    pronunciation: 'ḍ',
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
    name: 'Ṭā',
    nameAr: 'طاء',
    sound: 'ṭ',
    pronunciation: 'ṭ',
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
    name: 'Ẓā',
    nameAr: 'ظاء',
    sound: 'ẓ',
    pronunciation: 'ẓ',
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
    name: 'ʿAyn',
    nameAr: 'عين',
    sound: 'ʿ',
    pronunciation: 'ʿ',
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
    pronunciation: 'gh',
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
    name: 'Fā',
    nameAr: 'فاء',
    sound: 'f',
    pronunciation: 'f',
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
    name: 'Qāf',
    nameAr: 'قاف',
    sound: 'q',
    pronunciation: 'q',
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
    name: 'Kāf',
    nameAr: 'كاف',
    sound: 'k',
    pronunciation: 'k',
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
    name: 'Lām',
    nameAr: 'لام',
    sound: 'l',
    pronunciation: 'l',
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
    name: 'Mīm',
    nameAr: 'ميم',
    sound: 'm',
    pronunciation: 'm',
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
    name: 'Nūn',
    nameAr: 'نون',
    sound: 'n',
    pronunciation: 'n',
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
    name: 'Hā',
    nameAr: 'هاء',
    sound: 'h',
    pronunciation: 'h',
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
    name: 'Wāw',
    nameAr: 'واو',
    sound: 'w/u',
    pronunciation: 'w',
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
    name: 'Yā',
    nameAr: 'ياء',
    sound: 'y/i',
    pronunciation: 'y',
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
