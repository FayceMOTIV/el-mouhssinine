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
}

export const getUserProgress = (): UserProgress => {
  // In a real app, this would come from storage
  return {
    currentLevel: 'debutant',
    totalXP: 0,
    lessonsCompleted: [],
    lettersLearned: [],
    streak: 0,
  };
};
