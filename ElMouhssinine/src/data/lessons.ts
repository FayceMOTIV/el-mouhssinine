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
