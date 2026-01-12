/**
 * Service OpenAI pour l'assistant d'écriture IA
 * Utilise GPT-4o-mini pour générer du contenu
 */

import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config'
import { app } from './firebase'

let apiKey = null

// Récupérer la clé API depuis Firebase Remote Config
export const getOpenAIKey = async () => {
  if (apiKey) return apiKey

  try {
    const remoteConfig = getRemoteConfig(app)
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000 // 1 heure

    await fetchAndActivate(remoteConfig)
    apiKey = getValue(remoteConfig, 'openai_api_key').asString()

    if (!apiKey) {
      console.warn('Clé OpenAI non configurée dans Remote Config')
      return null
    }

    return apiKey
  } catch (error) {
    console.error('Erreur récupération clé OpenAI:', error)
    return null
  }
}

// Prompts contextuels pour chaque type de contenu
const PROMPTS = {
  notification: {
    system: `Tu es un assistant pour une mosquée. Tu rédiges des notifications push courtes et engageantes.
Règles:
- Maximum 100 caractères pour le titre
- Maximum 200 caractères pour le message
- Ton respectueux et bienveillant
- Utilise des emojis appropriés (🕌 🤲 📢 etc.)
- En français sauf si demandé en arabe`,
    examples: [
      { titre: "🕌 Jumu'a demain à 13h30", message: "N'oubliez pas la prière du vendredi. Arrivez en avance !" },
      { titre: "📢 Nouvelle annonce", message: "Un cours de Coran pour enfants commence ce samedi. Inscriptions ouvertes !" }
    ]
  },
  annonce: {
    system: `Tu es un assistant pour une mosquée. Tu rédiges des annonces claires et informatives.
Règles:
- Titre accrocheur mais sobre
- Contenu structuré et facile à lire
- Inclure les informations essentielles (date, lieu, horaire si pertinent)
- Ton professionnel et chaleureux
- En français`,
    examples: []
  },
  popup: {
    system: `Tu es un assistant pour une mosquée. Tu rédiges des messages popup importants.
Règles:
- Message court et impactant
- Appel à l'action clair si nécessaire
- Ton urgent mais pas alarmiste
- Utilise des emojis avec modération`,
    examples: []
  },
  evenement: {
    system: `Tu es un assistant pour une mosquée. Tu rédiges des descriptions d'événements.
Règles:
- Description engageante
- Mentionner le programme si fourni
- Inclure les informations pratiques
- Encourager la participation`,
    examples: []
  },
  rappel: {
    system: `Tu es un assistant pour une mosquée. Tu rédiges des rappels spirituels (hadiths, sagesses).
Règles:
- Texte inspirant et positif
- Mentionner la source si c'est un hadith
- Peut être en français ET en arabe
- Ton doux et encourageant`,
    examples: []
  },
  janaza: {
    system: `Tu es un assistant pour une mosquée. Tu rédiges des annonces de Salat Janaza.
Règles:
- Ton respectueux et solennel
- Inclure les informations essentielles (nom, date, heure, lieu)
- Formule de condoléances appropriée
- Rappeler l'importance de la prière pour le défunt`,
    examples: []
  },
  projet: {
    system: `Tu es un assistant pour une mosquée. Tu rédiges des descriptions de projets de collecte de dons.
Règles:
- Titre accrocheur et clair
- Description engageante qui inspire la générosité
- Expliquer l'impact concret du projet
- Ton professionnel et motivant
- Encourager les donateurs à participer`,
    examples: []
  },
  general: {
    system: `Tu es un assistant pour une mosquée. Tu aides à rédiger du contenu.
Règles:
- Ton respectueux et bienveillant
- Contenu approprié pour une communauté musulmane
- En français sauf si demandé autrement`,
    examples: []
  }
}

/**
 * Génère du contenu avec l'IA
 * @param {string} type - Type de contenu (notification, annonce, popup, etc.)
 * @param {string} userPrompt - Instructions de l'utilisateur
 * @param {object} context - Contexte additionnel (titre existant, etc.)
 * @returns {Promise<{titre?: string, contenu: string}>}
 */
export const generateContent = async (type, userPrompt, context = {}) => {
  const key = await getOpenAIKey()

  if (!key) {
    throw new Error('Clé API OpenAI non configurée. Allez dans Firebase Console > Remote Config et ajoutez "openai_api_key".')
  }

  const promptConfig = PROMPTS[type] || PROMPTS.general

  // Construire le message utilisateur
  let userMessage = userPrompt

  if (context.existingTitle) {
    userMessage += `\n\nTitre existant: "${context.existingTitle}"`
  }
  if (context.existingContent) {
    userMessage += `\n\nContenu existant à améliorer: "${context.existingContent}"`
  }
  if (context.field === 'titre') {
    userMessage += '\n\nGénère uniquement un TITRE court et accrocheur.'
  }
  if (context.field === 'message' || context.field === 'contenu') {
    userMessage += '\n\nGénère uniquement le CONTENU/MESSAGE (pas de titre).'
  }

  const messages = [
    { role: 'system', content: promptConfig.system },
  ]

  // Ajouter des exemples si disponibles
  if (promptConfig.examples.length > 0) {
    messages.push({
      role: 'system',
      content: 'Exemples de bons contenus:\n' + promptConfig.examples.map(e =>
        `- Titre: "${e.titre}" | Message: "${e.message}"`
      ).join('\n')
    })
  }

  messages.push({ role: 'user', content: userMessage })

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Erreur API OpenAI')
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content?.trim()

    if (!content) {
      throw new Error('Réponse vide de l\'IA')
    }

    return { content }
  } catch (error) {
    console.error('Erreur génération IA:', error)
    throw error
  }
}

/**
 * Suggestions rapides pour améliorer un texte
 */
// Options d'amélioration communes à tous les types
const IMPROVEMENT_OPTIONS = [
  "Améliore le style du texte",
  "Rends le texte plus formel",
  "Rends le texte plus court et concis",
  "Traduis en arabe"
]

export const QUICK_PROMPTS = {
  notification: [
    "Rédige une notification pour annoncer la prière du vendredi",
    "Rédige une notification pour un cours de Coran",
    ...IMPROVEMENT_OPTIONS
  ],
  annonce: [
    "Rédige une annonce pour un événement communautaire",
    "Rédige une annonce pour une collecte de dons",
    ...IMPROVEMENT_OPTIONS
  ],
  popup: [
    "Rédige un message de bienvenue pour les nouveaux utilisateurs",
    "Rédige un rappel pour le don mensuel",
    ...IMPROVEMENT_OPTIONS
  ],
  rappel: [
    "Propose un hadith sur la patience",
    "Propose un hadith sur la générosité",
    ...IMPROVEMENT_OPTIONS
  ],
  evenement: [
    "Rédige une description pour une conférence",
    "Rédige une description pour un iftar communautaire",
    ...IMPROVEMENT_OPTIONS
  ],
  janaza: [
    "Rédige une annonce de Salat Janaza respectueuse",
    ...IMPROVEMENT_OPTIONS
  ],
  projet: [
    "Rédige une description de projet de collecte",
    "Rédige un titre accrocheur pour ce projet",
    ...IMPROVEMENT_OPTIONS
  ],
  general: [
    ...IMPROVEMENT_OPTIONS,
    "Propose des idées de contenu"
  ]
}
