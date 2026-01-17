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

// Prompt SPECIAL pour la generation de TITRES uniquement
const TITLE_PROMPT = `Tu generes des TITRES pour une application mobile de mosquee.
REGLES STRICTES:
- Maximum 40 caracteres (5-6 mots)
- Pas de ponctuation finale (pas de point, pas de !)
- Commence par un emoji pertinent
- Ton direct et informatif
- Pas de formules ("Chers freres", "Rappel important", etc.)
- Pas de ":" dans le titre

EXEMPLES DE BONS TITRES:
- 🕌 Priere de l'Aid demain 8h
- 📚 Nouveaux cours d'arabe
- 🌙 Debut Ramadan confirme
- 🤲 Collecte vetements ce samedi
- ⚠️ Mosquee fermee lundi
- 🎉 Fete de fin d'annee
- 📖 Cours Coran enfants samedi

EXEMPLES DE MAUVAIS TITRES (a eviter):
- "Rappel important concernant la priere" ❌ (trop long)
- "Chers freres et soeurs, venez nombreux" ❌ (formule inutile)
- "Information : nouvelle activite" ❌ (pas informatif)
- "N'oubliez pas !" ❌ (pas de contenu)

Genere UN SEUL titre court et percutant, sans guillemets.`

// Prompts contextuels pour chaque type de contenu
// IMPORTANT: Tous les prompts limitent les reponses a 2-3 phrases pour l'app mobile
const PROMPTS = {
  notification: {
    system: `Tu es un assistant pour une mosquee. Tu rediges des notifications push TRES COURTES.
REGLES STRICTES:
- Titre: MAX 50 caracteres
- Message: MAX 2 phrases (100 caracteres)
- Style DIRECT, pas de formules de politesse longues
- Un emoji max au debut
- Exemple: "La priere de l'Aid aura lieu demain a 8h. Venez nombreux!"
NE JAMAIS depasser ces limites.`,
    examples: [
      { titre: "🕌 Jumu'a 13h30", message: "Priere du vendredi. Arrivez en avance !" },
      { titre: "📢 Cours Coran", message: "Nouveau cours pour enfants ce samedi. Inscriptions ouvertes." }
    ]
  },
  annonce: {
    system: `Tu es un assistant pour une mosquee. Tu rediges des annonces CONCISES.
REGLES STRICTES:
- Titre: MAX 60 caracteres
- Contenu: MAX 3 phrases courtes
- Va droit au but, pas de blabla
- Infos essentielles: quoi, quand, ou
- Style direct et clair`,
    examples: []
  },
  popup: {
    system: `Tu es un assistant pour une mosquee. Tu rediges des popups ULTRA COURTS.
REGLES STRICTES:
- Titre: MAX 40 caracteres
- Message: MAX 2 phrases (80 caracteres)
- Style DIRECT et impactant
- Un seul emoji si necessaire
- Exemple: "Rappel: la priere de l'Aid aura lieu demain a 8h."
NE JAMAIS faire de longs textes.`,
    examples: []
  },
  evenement: {
    system: `Tu es un assistant pour une mosquee. Tu rediges des descriptions d'evenements.
REGLES STRICTES:
- Titre: MAX 60 caracteres
- Description: MAX 4 phrases courtes
- Inclure: date, heure, lieu
- Style engageant mais concis`,
    examples: []
  },
  rappel: {
    system: `Tu es un assistant pour une mosquee. Tu rediges des rappels spirituels.
REGLES STRICTES:
- MAX 3 phrases
- Hadith + source courte si applicable
- Peut etre en francais ET arabe
- Ton inspirant mais bref`,
    examples: []
  },
  janaza: {
    system: `Tu es un assistant pour une mosquee. Tu rediges des annonces de Salat Janaza.
REGLES STRICTES:
- Titre: Nom + "Salat Janaza"
- Message: MAX 3 phrases
- Inclure: nom, date, heure, lieu
- Formule de condoleances courte`,
    examples: []
  },
  projet: {
    system: `Tu es un assistant pour une mosquee. Tu rediges des descriptions de projets.
REGLES STRICTES:
- Titre: MAX 50 caracteres, accrocheur
- Description: MAX 3 phrases
- Expliquer l'impact concretement
- Appel a l'action clair`,
    examples: []
  },
  general: {
    system: `Tu es un assistant pour une mosquee. Tu aides a rediger du contenu.
REGLES STRICTES:
- MAX 3 phrases par reponse
- Style direct et concis
- Pas de formules de politesse longues
- Va droit au but`,
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

  // Determiner si on genere un TITRE ou du contenu
  const isGeneratingTitle = context.field === 'titre'

  if (context.existingTitle && !isGeneratingTitle) {
    userMessage += `\n\nTitre existant: "${context.existingTitle}"`
  }
  if (context.existingContent) {
    userMessage += `\n\nContenu existant à améliorer: "${context.existingContent}"`
  }
  if (context.field === 'message' || context.field === 'contenu') {
    userMessage += '\n\nGénère uniquement le CONTENU/MESSAGE (pas de titre).'
  }

  // Utiliser le prompt TITRE special si on genere un titre
  const systemPrompt = isGeneratingTitle ? TITLE_PROMPT : promptConfig.system

  const messages = [
    { role: 'system', content: systemPrompt },
  ]

  // Ajouter des exemples si disponibles (seulement pour le contenu, pas les titres)
  if (!isGeneratingTitle && promptConfig.examples.length > 0) {
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
