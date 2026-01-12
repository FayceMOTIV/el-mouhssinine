import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { generateContent } from '../../services/openai'
import { toast } from 'react-toastify'

/**
 * Bouton d'assistance IA - Améliore DIRECTEMENT le texte sans poser de questions
 * @param {string} type - Type de contenu (notification, annonce, popup, evenement, rappel, janaza, projet)
 * @param {string} field - Champ cible (titre, message, contenu, description)
 * @param {function} onGenerated - Callback avec le contenu généré
 * @param {string} existingContent - Contenu existant à améliorer
 * @param {string} className - Classes CSS additionnelles
 */
export default function AIWriteButton({
  type = 'general',
  field = 'contenu',
  onGenerated,
  existingContent = '',
  className = ''
}) {
  const [loading, setLoading] = useState(false)

  const handleDirectImprove = async () => {
    // Si pas de contenu existant, générer un exemple
    if (!existingContent || !existingContent.trim()) {
      toast.info('Écrivez d\'abord un texte à améliorer')
      return
    }

    setLoading(true)
    try {
      // Prompt direct pour améliorer le texte
      const prompt = `Améliore ce texte pour une communication de mosquée, rends-le plus professionnel et engageant. Garde le même sens et la même longueur approximative. Texte à améliorer: "${existingContent}"`

      const result = await generateContent(type, prompt, {
        field,
        existingContent
      })

      if (result.content) {
        onGenerated(result.content)
        toast.success('Texte amélioré !')
      }
    } catch (error) {
      console.error('Erreur IA:', error)
      toast.error(error.message || 'Erreur lors de l\'amélioration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDirectImprove}
      disabled={loading}
      className={`p-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 transition-all duration-200 group ${className}`}
      title="Améliorer avec l'IA"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4 text-purple-400 group-hover:text-purple-300" />
      )}
    </button>
  )
}
