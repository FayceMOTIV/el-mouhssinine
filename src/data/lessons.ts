// Cours d'arabe structures

export interface LessonStep {
  type: 'intro' | 'letter' | 'vowel' | 'exercise' | 'quiz' | 'summary';
  content: {
    title?: string;
    text?: string;
    arabic?: string;
    audio?: string;
    letterId?: string;
    vowelId?: string;
    instruction?: string;
    items?: Array<{ arabic: string; transliteration: string }>;
    question?: string;
    arabicDisplay?: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
    points?: string[];
  };
}

export interface Lesson {
  id: string;
  order: number;
  title: string;
  titleAr: string;
  description: string;
  duration: string;
  xp: number;
  level: string;
  category: string;
  steps: LessonStep[];
  prerequisites?: string[];
}

export const lessons: Lesson[] = [
  {
    id: 'lesson_1',
    order: 1,
    title: 'Introduction a l\'alphabet arabe',
    titleAr: 'مقدمة في الحروف العربية',
    description: 'Decouvrez les bases de l\'alphabet arabe et ses caracteristiques uniques.',
    duration: '10 min',
    xp: 50,
    level: 'debutant',
    category: 'alphabet',
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Bienvenue!',
          text: 'L\'alphabet arabe compte 28 lettres. Il s\'ecrit de droite a gauche.'
        }
      },
      {
        type: 'letter',
        content: {
          title: 'Alif - ا',
          letterId: 'alif',
          explanation: 'La premiere lettre. Elle ne se connecte jamais a la lettre suivante.'
        }
      },
      {
        type: 'letter',
        content: {
          title: 'Ba - ب',
          letterId: 'ba',
          explanation: 'Se prononce comme le B francais. Le point est EN-DESSOUS.'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle lettre a un point en-dessous?',
          arabicDisplay: 'ب',
          options: ['Ta', 'Ba', 'Tha', 'Nun'],
          correctAnswer: 'Ba',
          explanation: 'Ba (ب) a un point en-dessous.'
        }
      },
      {
        type: 'summary',
        content: {
          title: 'Bravo!',
          points: [
            'Vous avez appris Alif et Ba',
            'L\'arabe s\'ecrit de droite a gauche',
            'Les points distinguent les lettres'
          ]
        }
      }
    ]
  },
  {
    id: 'lesson_2',
    order: 2,
    title: 'Les lettres Ba, Ta, Tha',
    titleAr: 'ب ت ث',
    description: 'Trois lettres avec la meme forme de base.',
    duration: '15 min',
    xp: 75,
    level: 'debutant',
    category: 'alphabet',
    prerequisites: ['lesson_1'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Un groupe de lettres similaires',
          text: 'Ba, Ta et Tha ont la meme forme de base. Seuls les points changent!'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'ba',
          explanation: '1 point EN-DESSOUS - Son: B'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'ta',
          explanation: '2 points AU-DESSUS - Son: T'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'tha',
          explanation: '3 points AU-DESSUS - Son: TH anglais'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Combien de points a la lettre Tha (ث)?',
          options: ['1', '2', '3', '0'],
          correctAnswer: '3',
          explanation: 'Tha a 3 points au-dessus.'
        }
      }
    ]
  },
  {
    id: 'lesson_3',
    order: 3,
    title: 'Les voyelles courtes',
    titleAr: 'الحركات',
    description: 'Apprenez les trois voyelles de base.',
    duration: '20 min',
    xp: 100,
    level: 'debutant',
    category: 'voyelles',
    prerequisites: ['lesson_1'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Les voyelles en arabe',
          text: 'En arabe, les voyelles sont des petits signes places au-dessus ou en-dessous des lettres.'
        }
      },
      {
        type: 'vowel',
        content: {
          vowelId: 'fatha',
          explanation: 'Petit trait diagonal AU-DESSUS - Son: A court'
        }
      },
      {
        type: 'vowel',
        content: {
          vowelId: 'kasra',
          explanation: 'Petit trait diagonal EN-DESSOUS - Son: I court'
        }
      },
      {
        type: 'vowel',
        content: {
          vowelId: 'damma',
          explanation: 'Petit "و" AU-DESSUS - Son: OU court'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Lisez ces syllabes:',
          items: [
            { arabic: 'بَ', transliteration: 'ba' },
            { arabic: 'بِ', transliteration: 'bi' },
            { arabic: 'بُ', transliteration: 'bu' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Comment se lit بُ?',
          options: ['ba', 'bi', 'bu', 'b'],
          correctAnswer: 'bu',
          explanation: 'La Damma donne le son "ou".'
        }
      }
    ]
  },
  {
    id: 'lesson_4',
    order: 4,
    title: 'Les lettres Jim, Ha, Kha',
    titleAr: 'ج ح خ',
    description: 'Trois nouvelles lettres avec des sons uniques.',
    duration: '15 min',
    xp: 75,
    level: 'debutant',
    category: 'alphabet',
    prerequisites: ['lesson_2'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Un nouveau groupe',
          text: 'Ces trois lettres ont la meme forme de base mais des points differents.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'jim',
          explanation: '1 point AU MILIEU - Son: J francais'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'ha',
          explanation: 'SANS point - Son: H aspire fort'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'kha',
          explanation: '1 point AU-DESSUS - Son: comme le "ch" allemand ou espagnol (jota)'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle lettre n\'a pas de point?',
          arabicDisplay: 'ح',
          options: ['Jim', 'Ha', 'Kha', 'Ba'],
          correctAnswer: 'Ha',
          explanation: 'Ha (ح) n\'a pas de point.'
        }
      },
      {
        type: 'summary',
        content: {
          title: 'Excellent!',
          points: [
            'Jim (ج) = J avec 1 point au milieu',
            'Ha (ح) = H aspire sans point',
            'Kha (خ) = son guttural avec 1 point au-dessus'
          ]
        }
      }
    ]
  },
  {
    id: 'lesson_5',
    order: 5,
    title: 'Les lettres Dal, Dhal',
    titleAr: 'د ذ',
    description: 'Deux lettres qui ne se connectent pas a gauche.',
    duration: '12 min',
    xp: 60,
    level: 'debutant',
    category: 'alphabet',
    prerequisites: ['lesson_2'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Lettres speciales',
          text: 'Dal et Dhal ne se connectent jamais a la lettre qui suit (comme Alif).'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'dal',
          explanation: 'SANS point - Son: D francais'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'dhal',
          explanation: '1 point AU-DESSUS - Son: TH anglais de "the"'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle lettre se prononce comme le "th" de "the"?',
          options: ['Dal', 'Dhal', 'Tha', 'Ta'],
          correctAnswer: 'Dhal',
          explanation: 'Dhal (ذ) se prononce comme le "th" de "the" en anglais.'
        }
      }
    ]
  },
  {
    id: 'lesson_6',
    order: 6,
    title: 'Les lettres Ra, Za',
    titleAr: 'ر ز',
    description: 'Deux lettres qui ne se connectent pas non plus.',
    duration: '10 min',
    xp: 50,
    level: 'debutant',
    category: 'alphabet',
    prerequisites: ['lesson_5'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Encore deux lettres speciales',
          text: 'Comme Dal et Dhal, Ra et Za ne se connectent pas a gauche.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'ra',
          explanation: 'SANS point - Son: R roule'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'zay',
          explanation: '1 point AU-DESSUS - Son: Z francais'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Combien de lettres arabes ne se connectent pas a gauche?',
          options: ['2', '4', '6', '8'],
          correctAnswer: '6',
          explanation: 'Alif, Dal, Dhal, Ra, Zay et Waw ne se connectent pas.'
        }
      }
    ]
  },
  {
    id: 'lesson_7',
    order: 7,
    title: 'Les lettres Sin, Shin',
    titleAr: 'س ش',
    description: 'Les "dents" de l\'alphabet arabe.',
    duration: '12 min',
    xp: 60,
    level: 'debutant',
    category: 'alphabet',
    prerequisites: ['lesson_4'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Les lettres dentees',
          text: 'Sin et Shin ont trois petites "dents" caracteristiques.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'sin',
          explanation: 'SANS point - Son: S francais'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'shin',
          explanation: '3 points AU-DESSUS - Son: CH francais'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Lisez ces mots:',
          items: [
            { arabic: 'شَمْس', transliteration: 'shams (soleil)' },
            { arabic: 'سَلام', transliteration: 'salam (paix)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Comment dit-on "paix" en arabe?',
          options: ['shams', 'salam', 'sama', 'shay'],
          correctAnswer: 'salam',
          explanation: 'Salam (سَلام) signifie "paix".'
        }
      }
    ]
  },
  {
    id: 'lesson_8',
    order: 8,
    title: 'Les lettres Sad, Dad',
    titleAr: 'ص ض',
    description: 'Les lettres emphatiques.',
    duration: '15 min',
    xp: 75,
    level: 'intermediaire',
    category: 'alphabet',
    prerequisites: ['lesson_7'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Sons emphatiques',
          text: 'Ces lettres se prononcent avec la langue plus en arriere dans la bouche.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'sad',
          explanation: 'SANS point - Son: S emphatique (plus grave)'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'dad',
          explanation: '1 point AU-DESSUS - Son: D emphatique. Lettre unique a l\'arabe!'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle lettre est unique a la langue arabe?',
          options: ['Sad', 'Dad', 'Sin', 'Dal'],
          correctAnswer: 'Dad',
          explanation: 'Dad (ض) est si unique qu\'on appelle l\'arabe "la langue du Dad".'
        }
      }
    ]
  },
  {
    id: 'lesson_9',
    order: 9,
    title: 'Revision: Alphabet partie 1',
    titleAr: 'مراجعة',
    description: 'Testez vos connaissances sur les 14 premieres lettres.',
    duration: '20 min',
    xp: 100,
    level: 'debutant',
    category: 'revision',
    prerequisites: ['lesson_8'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Quiz de revision',
          text: 'Vous avez appris beaucoup de lettres. Testons vos connaissances!'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle lettre ressemble a un bateau?',
          arabicDisplay: 'ب',
          options: ['Alif', 'Ba', 'Ta', 'Nun'],
          correctAnswer: 'Ba',
          explanation: 'Ba (ب) ressemble a un petit bateau avec un point en-dessous.'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Combien de points a la lettre Shin (ش)?',
          options: ['0', '1', '2', '3'],
          correctAnswer: '3',
          explanation: 'Shin a 3 points au-dessus comme Tha.'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle voyelle donne le son "i"?',
          options: ['Fatha', 'Kasra', 'Damma', 'Sukun'],
          correctAnswer: 'Kasra',
          explanation: 'Kasra est le petit trait en-dessous qui donne le son "i".'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle lettre est appelee "la langue du Dad"?',
          options: ['Dal', 'Dhal', 'Dad', 'Sad'],
          correctAnswer: 'Dad',
          explanation: 'L\'arabe est surnomme "la langue du Dad" car cette lettre n\'existe qu\'en arabe.'
        }
      },
      {
        type: 'summary',
        content: {
          title: 'Bravo!',
          points: [
            'Vous maitrisez les 14 premieres lettres',
            'Vous connaissez les 3 voyelles courtes',
            'Continuez vers la deuxieme partie de l\'alphabet!'
          ]
        }
      }
    ]
  },
  {
    id: 'lesson_10',
    order: 10,
    title: 'Les lettres Ayn, Ghayn',
    titleAr: 'ع غ',
    description: 'Deux sons typiquement arabes.',
    duration: '15 min',
    xp: 80,
    level: 'intermediaire',
    category: 'alphabet',
    prerequisites: ['lesson_9'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Sons gutturaux',
          text: 'Ces deux lettres viennent du fond de la gorge et n\'existent pas en francais.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'ayn',
          explanation: 'SANS point - Son guttural profond, comme si on etranglait'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'ghayn',
          explanation: '1 point AU-DESSUS - Son: comme le R parisien grasseye'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Ecoutez la difference:',
          items: [
            { arabic: 'عَرَب', transliteration: '\'arab (Arabes)' },
            { arabic: 'غَرْب', transliteration: 'gharb (ouest)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quel son ressemble au R parisien?',
          options: ['Ayn', 'Ghayn', 'Ra', 'Kha'],
          correctAnswer: 'Ghayn',
          explanation: 'Ghayn (غ) se rapproche du R parisien grasseye.'
        }
      }
    ]
  },
  {
    id: 'lesson_11',
    order: 11,
    title: 'Les lettres Taa, Dhaa',
    titleAr: 'ط ظ',
    description: 'Les emphatiques de Ta et Dhal.',
    duration: '15 min',
    xp: 75,
    level: 'intermediaire',
    category: 'alphabet',
    prerequisites: ['lesson_10'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Emphatiques (suite)',
          text: 'Taa et Dhaa sont les versions emphatiques de Ta et Dhal. La langue recule dans la bouche.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'taa',
          explanation: 'SANS point - Son: T emphatique (plus grave que Ta)'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'dhaa',
          explanation: '1 point AU-DESSUS - Son: DH emphatique'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Associez chaque lettre a son son:',
          items: [
            { arabic: 'ط', transliteration: 'Taa (T emphatique)' },
            { arabic: 'ت', transliteration: 'Ta (T normal)' },
            { arabic: 'ظ', transliteration: 'Dhaa (DH emphatique)' },
            { arabic: 'ذ', transliteration: 'Dhal (DH normal)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle est la version emphatique de Ta (ت)?',
          arabicDisplay: 'ط',
          options: ['Taa', 'Dad', 'Sad', 'Dhal'],
          correctAnswer: 'Taa',
          explanation: 'Taa (ط) est la version emphatique de Ta.'
        }
      }
    ]
  },
  {
    id: 'lesson_12',
    order: 12,
    title: 'Les lettres Fa, Qaf',
    titleAr: 'ف ق',
    description: 'Deux lettres a forme arrondie.',
    duration: '12 min',
    xp: 65,
    level: 'intermediaire',
    category: 'alphabet',
    prerequisites: ['lesson_11'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Forme arrondie',
          text: 'Fa et Qaf se ressemblent. Attention aux points!'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'fa',
          explanation: '1 point AU-DESSUS - Son: F francais'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'qaf',
          explanation: '2 points AU-DESSUS - Son: Q guttural profond (du fond de la gorge)'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Lisez ces mots:',
          items: [
            { arabic: 'فِيل', transliteration: 'fiil (elephant)' },
            { arabic: 'قَلْب', transliteration: 'qalb (coeur)' },
            { arabic: 'قُرْآن', transliteration: 'Qur\'an (Coran)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Combien de points a la lettre Qaf (ق)?',
          options: ['0', '1', '2', '3'],
          correctAnswer: '2',
          explanation: 'Qaf a 2 points au-dessus, Fa n\'en a qu\'un.'
        }
      }
    ]
  },
  {
    id: 'lesson_13',
    order: 13,
    title: 'Les lettres Kaf, Lam',
    titleAr: 'ك ل',
    description: 'Deux lettres tres courantes.',
    duration: '12 min',
    xp: 65,
    level: 'intermediaire',
    category: 'alphabet',
    prerequisites: ['lesson_12'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Lettres courantes',
          text: 'Kaf et Lam sont parmi les lettres les plus utilisees en arabe.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'kaf',
          explanation: 'Son: K francais. La forme change beaucoup selon la position.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'lam',
          explanation: 'Son: L francais. Presente dans "Al-" (l\'article defini).'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Lisez ces mots:',
          items: [
            { arabic: 'كِتَاب', transliteration: 'kitaab (livre)' },
            { arabic: 'لَيْل', transliteration: 'layl (nuit)' },
            { arabic: 'كَلْب', transliteration: 'kalb (chien)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Que signifie كِتَاب?',
          options: ['Nuit', 'Livre', 'Chien', 'Coeur'],
          correctAnswer: 'Livre',
          explanation: 'Kitaab (كِتَاب) signifie "livre".'
        }
      }
    ]
  },
  {
    id: 'lesson_14',
    order: 14,
    title: 'Les lettres Mim, Nun',
    titleAr: 'م ن',
    description: 'Deux lettres nasales tres frequentes.',
    duration: '12 min',
    xp: 65,
    level: 'intermediaire',
    category: 'alphabet',
    prerequisites: ['lesson_13'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Les nasales',
          text: 'Mim et Nun sont des consonnes nasales comme M et N en francais.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'mim',
          explanation: 'Son: M francais. Forme ronde caracteristique.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'nun',
          explanation: '1 point AU-DESSUS - Son: N francais. Ressemble a Ba mais le point est au-dessus.'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Lisez ces mots:',
          items: [
            { arabic: 'مَسْجِد', transliteration: 'masjid (mosquee)' },
            { arabic: 'نُور', transliteration: 'nuur (lumiere)' },
            { arabic: 'مُسْلِم', transliteration: 'muslim (musulman)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Que signifie نُور?',
          options: ['Mosquee', 'Lumiere', 'Musulman', 'Paix'],
          correctAnswer: 'Lumiere',
          explanation: 'Nuur (نُور) signifie "lumiere".'
        }
      }
    ]
  },
  {
    id: 'lesson_15',
    order: 15,
    title: 'La lettre Haa',
    titleAr: 'ه',
    description: 'Le H leger aspire.',
    duration: '10 min',
    xp: 55,
    level: 'intermediaire',
    category: 'alphabet',
    prerequisites: ['lesson_14'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'H leger vs H guttural',
          text: 'Haa est un H leger (comme hello). Ne confondez pas avec Ha (ح) qui est guttural!'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'haa',
          explanation: 'Son: H aspire leger (comme "hello" en anglais). Forme tres variable.'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Distinguez les deux H:',
          items: [
            { arabic: 'ه', transliteration: 'Haa - H leger (hello)' },
            { arabic: 'ح', transliteration: 'Ha - H guttural (gorge)' },
            { arabic: 'هُوَ', transliteration: 'huwa (il/lui)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle lettre se prononce comme le H de "hello"?',
          options: ['Ha (ح)', 'Haa (ه)', 'Kha (خ)', 'Ayn (ع)'],
          correctAnswer: 'Haa (ه)',
          explanation: 'Haa (ه) est le H leger. Ha (ح) est le H guttural.'
        }
      }
    ]
  },
  {
    id: 'lesson_16',
    order: 16,
    title: 'Les lettres Waw, Ya',
    titleAr: 'و ي',
    description: 'Les deux dernieres lettres de l\'alphabet.',
    duration: '15 min',
    xp: 80,
    level: 'intermediaire',
    category: 'alphabet',
    prerequisites: ['lesson_15'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Les semi-voyelles',
          text: 'Waw et Ya sont aussi des voyelles longues (OU et II). Waw ne se connecte pas a gauche.'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'waw',
          explanation: 'Son: W/OU. Ne se connecte pas a gauche (comme Alif, Dal, Ra).'
        }
      },
      {
        type: 'letter',
        content: {
          letterId: 'ya',
          explanation: '2 points EN-DESSOUS - Son: Y/II. Derniere lettre de l\'alphabet!'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Lisez ces mots:',
          items: [
            { arabic: 'يَوْم', transliteration: 'yawm (jour)' },
            { arabic: 'وَلَد', transliteration: 'walad (enfant)' },
            { arabic: 'يَد', transliteration: 'yad (main)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle lettre ne se connecte PAS a gauche?',
          options: ['Ya (ي)', 'Waw (و)', 'Mim (م)', 'Nun (ن)'],
          correctAnswer: 'Waw (و)',
          explanation: 'Waw ne se connecte pas a gauche, comme Alif, Dal, Dhal, Ra, Zay.'
        }
      },
      {
        type: 'summary',
        content: {
          title: 'Felicitations!',
          points: [
            'Vous connaissez maintenant les 28 lettres de l\'alphabet arabe!',
            'Waw et Ya sont aussi des voyelles longues',
            'Il reste a pratiquer la lecture de mots complets'
          ]
        }
      }
    ]
  },
  {
    id: 'lesson_17',
    order: 17,
    title: 'Revision: Alphabet partie 2',
    titleAr: 'مراجعة الجزء الثاني',
    description: 'Testez vos connaissances sur les 14 dernieres lettres.',
    duration: '20 min',
    xp: 100,
    level: 'intermediaire',
    category: 'revision',
    prerequisites: ['lesson_16'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'Grand quiz',
          text: 'Vous avez appris tout l\'alphabet! Voyons ce que vous avez retenu.'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle lettre se prononce comme le F francais?',
          arabicDisplay: 'ف',
          options: ['Qaf', 'Fa', 'Kaf', 'Ghayn'],
          correctAnswer: 'Fa',
          explanation: 'Fa (ف) se prononce comme le F francais.'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Que signifie le mot مَسْجِد?',
          options: ['Livre', 'Lumiere', 'Mosquee', 'Jour'],
          correctAnswer: 'Mosquee',
          explanation: 'Masjid (مَسْجِد) signifie "mosquee".'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Combien de lettres ne se connectent pas a gauche?',
          options: ['4', '5', '6', '7'],
          correctAnswer: '6',
          explanation: 'Alif, Dal, Dhal, Ra, Zay et Waw ne se connectent pas a gauche.'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quelle est la derniere lettre de l\'alphabet?',
          options: ['Waw', 'Haa', 'Ya', 'Nun'],
          correctAnswer: 'Ya',
          explanation: 'Ya (ي) est la 28eme et derniere lettre.'
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Quel mot signifie "coeur"?',
          arabicDisplay: 'قَلْب',
          options: ['kalb', 'qalb', 'layl', 'nuur'],
          correctAnswer: 'qalb',
          explanation: 'Qalb (قَلْب) signifie "coeur".'
        }
      },
      {
        type: 'summary',
        content: {
          title: 'Bravo!',
          points: [
            'Vous maitrisez les 28 lettres de l\'alphabet arabe!',
            'Vous savez distinguer les lettres emphatiques',
            'Vous connaissez plusieurs mots arabes',
            'Continuez a pratiquer pour renforcer vos acquis!'
          ]
        }
      }
    ]
  },
  {
    id: 'lesson_18',
    order: 18,
    title: 'Lire ses premiers mots',
    titleAr: 'قراءة الكلمات الأولى',
    description: 'Assemblez les lettres et voyelles pour lire des mots complets.',
    duration: '20 min',
    xp: 120,
    level: 'avance',
    category: 'lecture',
    prerequisites: ['lesson_17'],
    steps: [
      {
        type: 'intro',
        content: {
          title: 'De la lettre au mot',
          text: 'Vous connaissez toutes les lettres et les voyelles. Apprenons a lire des mots complets insha\'Allah!'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Lisez ces mots islamiques courants:',
          items: [
            { arabic: 'بِسْمِ اللَّه', transliteration: 'bismillah (au nom d\'Allah)' },
            { arabic: 'إِنْ شَاءَ اللَّه', transliteration: 'insha\'Allah (si Dieu le veut)' },
            { arabic: 'الْحَمْدُ لِلَّه', transliteration: 'al-hamdulillah (louange a Allah)' },
            { arabic: 'سُبْحَانَ اللَّه', transliteration: 'subhanAllah (gloire a Allah)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Comment se lit بِسْمِ اللَّه?',
          options: ['alhamdulillah', 'bismillah', 'subhanAllah', 'insha\'Allah'],
          correctAnswer: 'bismillah',
          explanation: 'Bismillah signifie "au nom d\'Allah".'
        }
      },
      {
        type: 'exercise',
        content: {
          instruction: 'Mots du quotidien:',
          items: [
            { arabic: 'مَاء', transliteration: 'maa\' (eau)' },
            { arabic: 'خُبْز', transliteration: 'khubz (pain)' },
            { arabic: 'بَيْت', transliteration: 'bayt (maison)' },
            { arabic: 'كَبِير', transliteration: 'kabiir (grand)' }
          ]
        }
      },
      {
        type: 'quiz',
        content: {
          question: 'Que signifie بَيْت?',
          options: ['Eau', 'Pain', 'Maison', 'Grand'],
          correctAnswer: 'Maison',
          explanation: 'Bayt (بَيْت) signifie "maison".'
        }
      },
      {
        type: 'summary',
        content: {
          title: 'MashaAllah!',
          points: [
            'Vous savez lire des mots arabes complets!',
            'Continuez a pratiquer avec le Coran dans l\'app',
            'Utilisez la section Alphabet pour reviser les lettres',
            'Qu\'Allah facilite votre apprentissage!'
          ]
        }
      }
    ]
  },
];

export interface Level {
  id: string;
  name: string;
  nameAr: string;
  requiredXP: number;
}

export const levels: Level[] = [
  { id: 'debutant', name: 'Debutant', nameAr: 'مبتدئ', requiredXP: 0 },
  { id: 'apprenti', name: 'Apprenti', nameAr: 'متعلم', requiredXP: 200 },
  { id: 'intermediaire', name: 'Intermediaire', nameAr: 'متوسط', requiredXP: 500 },
  { id: 'avance', name: 'Avance', nameAr: 'متقدم', requiredXP: 1000 },
  { id: 'expert', name: 'Expert', nameAr: 'خبير', requiredXP: 2000 },
];

export interface UserProgress {
  currentLevel: string;
  totalXP: number;
  lessonsCompleted: string[];
  lettersLearned: string[];
  streak: number;
  lastSessionDate?: string;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRESS_KEY = '@arabic_learning_progress';

const DEFAULT_PROGRESS: UserProgress = {
  currentLevel: 'debutant',
  totalXP: 0,
  lessonsCompleted: [],
  lettersLearned: [],
  streak: 0,
};

// Synchronous getter (returns default, use async version for real data)
export const getUserProgress = (): UserProgress => {
  return DEFAULT_PROGRESS;
};

// Async version to load from storage
export const loadUserProgress = async (): Promise<UserProgress> => {
  try {
    const saved = await AsyncStorage.getItem(PROGRESS_KEY);
    if (saved) {
      const progress = JSON.parse(saved) as UserProgress;
      // Update streak based on last session
      const today = new Date().toDateString();
      const lastSession = progress.lastSessionDate;
      if (lastSession) {
        const lastDate = new Date(lastSession);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastDate.toDateString() !== today && lastDate.toDateString() !== yesterday.toDateString()) {
          // Streak broken
          progress.streak = 0;
        }
      }
      return progress;
    }
  } catch (error) {
    console.log('[Lessons] Error loading progress:', error);
  }
  return DEFAULT_PROGRESS;
};

// Save progress to storage
export const saveUserProgress = async (progress: UserProgress): Promise<void> => {
  try {
    progress.lastSessionDate = new Date().toDateString();
    // Update level based on XP
    const newLevel = levels.find(l => l.requiredXP <= progress.totalXP);
    if (newLevel) {
      progress.currentLevel = newLevel.id;
    }
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    console.log('[Lessons] Error saving progress:', error);
  }
};

// Complete a lesson and update progress
export const completeLesson = async (lessonId: string, xpEarned: number, lettersLearned: string[] = []): Promise<UserProgress> => {
  const progress = await loadUserProgress();

  if (!progress.lessonsCompleted.includes(lessonId)) {
    progress.lessonsCompleted.push(lessonId);
    progress.totalXP += xpEarned;
  }

  // Add new letters learned
  lettersLearned.forEach(letter => {
    if (!progress.lettersLearned.includes(letter)) {
      progress.lettersLearned.push(letter);
    }
  });

  // Update streak
  const today = new Date().toDateString();
  if (progress.lastSessionDate !== today) {
    progress.streak += 1;
  }

  await saveUserProgress(progress);
  return progress;
};
