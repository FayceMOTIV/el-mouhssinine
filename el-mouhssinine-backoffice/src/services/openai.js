/**
 * Service OpenAI pour l'assistant d'écriture IA
 * Proxy via Cloud Function — la clé API reste côté serveur
 */

import { functions } from './firebase'
import { httpsCallable } from 'firebase/functions'

const generateAIContentFn = httpsCallable(functions, 'generateAIContent')

/**
 * Génère du contenu avec l'IA via Cloud Function proxy
 * @param {string} type - Type de contenu (notification, annonce, popup, etc.)
 * @param {string} userPrompt - Instructions de l'utilisateur
 * @param {object} context - Contexte additionnel (titre existant, etc.)
 * @returns {Promise<{content: string}>}
 */
export const generateContent = async (type, userPrompt, context = {}) => {
  try {
    const result = await generateAIContentFn({
      type,
      userPrompt,
      contentContext: {
        field: context.field || null,
        existingTitle: context.existingTitle || null,
        existingContent: context.existingContent || null,
      },
    })
    return { content: result.data.content }
  } catch (error) {
    console.error('Erreur génération IA:', error)
    // Re-throw avec un message lisible
    if (error.code === 'functions/failed-precondition') {
      throw new Error('Clé API OpenAI non configurée côté serveur.')
    }
    if (error.code === 'functions/permission-denied') {
      throw new Error('Accès réservé aux administrateurs.')
    }
    throw new Error(error.message || 'Erreur lors de la génération IA')
  }
}

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
