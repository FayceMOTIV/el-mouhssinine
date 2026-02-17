import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Mail, Save, RotateCcw, Eye, Code, Clock, Zap, Search } from 'lucide-react'
import { Card, Button, Loading, EmptyState } from '../components/common'
import { collection, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

export default function EmailTemplates() {
  const { admin } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const snapshot = await getDocs(collection(db, 'email_templates'))
      const loaded = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
      // Trier par ordre prédéfini
      const order = [
        'welcome_member',
        'membership_confirmation',
        'donation_confirmation_individual',
        'donation_confirmation_company',
        'membership_manual_validation',
        'message_reply',
        'annual_cerfa',
        'payment_failed',
        'cotisation_cancelled',
        'cotisation_expiring_30',
        'cotisation_expiring_7',
        'cotisation_expired'
      ]
      loaded.sort((a, b) => {
        const ia = order.indexOf(a.id)
        const ib = order.indexOf(b.id)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      })
      setTemplates(loaded)
    } catch (error) {
      console.error('Erreur chargement templates:', error)
      toast.error('Erreur lors du chargement des templates')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (template) => {
    setSelectedTemplate(template)
    setEditedSubject(template.subject || '')
    setEditedBody(template.body || '')
    setShowPreview(false)
  }

  const handleSave = async () => {
    if (!selectedTemplate) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'email_templates', selectedTemplate.id), {
        subject: editedSubject,
        body: editedBody,
        updatedAt: serverTimestamp(),
        updatedBy: admin?.email || 'admin'
      })
      // MAJ locale
      setTemplates(prev =>
        prev.map(t =>
          t.id === selectedTemplate.id
            ? { ...t, subject: editedSubject, body: editedBody, updatedBy: admin?.email }
            : t
        )
      )
      setSelectedTemplate(prev => prev ? { ...prev, subject: editedSubject, body: editedBody } : null)
      toast.success('Email sauvegardé avec succès')
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (!selectedTemplate) return
    setEditedSubject(selectedTemplate.subject || '')
    setEditedBody(selectedTemplate.body || '')
  }

  const insertVariable = (varName) => {
    const textarea = document.getElementById('email-body-textarea')
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = editedBody
      const before = text.substring(0, start)
      const after = text.substring(end)
      const newText = before + `{${varName}}` + after
      setEditedBody(newText)
      // Remettre le focus
      setTimeout(() => {
        textarea.focus()
        const newPos = start + varName.length + 2
        textarea.setSelectionRange(newPos, newPos)
      }, 0)
    } else {
      setEditedBody(prev => prev + `{${varName}}`)
    }
  }

  const hasChanges = selectedTemplate &&
    (editedSubject !== selectedTemplate.subject || editedBody !== selectedTemplate.body)

  const filteredTemplates = templates.filter(t =>
    !searchQuery ||
    t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.trigger?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Aperçu avec variables remplacées par des exemples
  const getPreviewText = (text) => {
    if (!text) return ''
    return text
      .replace(/\{prenom\}/g, 'Mohamed')
      .replace(/\{nom\}/g, 'Benali')
      .replace(/\{email\}/g, 'mohamed@email.com')
      .replace(/\{montant\}/g, '50,00 €')
      .replace(/\{date\}/g, '13/02/2026')
      .replace(/\{projet\}/g, 'Construction mosquée')
      .replace(/\{reference\}/g, 'DON-2026-001')
      .replace(/\{montant_deductible\}/g, '33,00 €')
      .replace(/\{annee_suivante\}/g, '2027')
      .replace(/\{annee\}/g, '2025')
      .replace(/\{montant_total\}/g, '250,00 €')
      .replace(/\{type_cotisation\}/g, 'Annuel')
      .replace(/\{periode\}/g, 'an')
      .replace(/\{date_debut\}/g, '01/01/2026')
      .replace(/\{date_prochaine_echeance\}/g, '01/01/2027')
      .replace(/\{raison_sociale\}/g, 'Entreprise SAS')
      .replace(/\{siret\}/g, '123 456 789 00012')
      .replace(/\{statut\}/g, 'approuvée')
      .replace(/\{message_admin\}/g, 'Bienvenue parmi nous !')
      .replace(/\{message_original\}/g, 'Question sur les horaires...')
      .replace(/\{reponse\}/g, 'Les horaires sont disponibles dans l\'app.')
      .replace(/\{tentative\}/g, '2')
      .replace(/\{date_expiration\}/g, '15/03/2026')
      .replace(/\{jours_restants\}/g, '30')
      .replace(/\{date_annulation\}/g, '16/02/2026')
      .replace(/\{nom_association\}/g, 'Mosquée El Mohsinine')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Mail}
          title="Aucun template email"
          description="Les templates n'ont pas encore été initialisés. Exécutez le script d'initialisation."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Mail className="w-7 h-7 text-secondary" />
          Emails automatiques
        </h1>
        <p className="text-white/60 mt-1">
          Personnalisez le contenu des emails envoyés automatiquement par l'application
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Liste des templates */}
        <div className="lg:col-span-4">
          <Card>
            <div className="p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white mb-3">Emails configurables</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-secondary"
                />
              </div>
            </div>
            <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
              {filteredTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                    selectedTemplate?.id === template.id
                      ? 'bg-secondary/20 border border-secondary/50'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className={`font-medium text-sm ${
                    selectedTemplate?.id === template.id ? 'text-secondary' : 'text-white'
                  }`}>
                    {template.title}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-white/50">
                    <Zap className="w-3 h-3" />
                    {template.trigger}
                  </div>
                  {template.updatedBy && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-white/30">
                      <Clock className="w-3 h-3" />
                      Modifié par {template.updatedBy}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Editeur */}
        <div className="lg:col-span-8">
          {selectedTemplate ? (
            <Card>
              <div className="p-6 space-y-6">
                {/* Header éditeur */}
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-xl font-bold text-white">{selectedTemplate.title}</h2>
                  <p className="text-white/60 text-sm mt-1">{selectedTemplate.description}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <Code className="w-3 h-3" />
                      Fonction : <code className="bg-white/10 px-2 py-0.5 rounded text-secondary">{selectedTemplate.cloudFunction}</code>
                    </span>
                  </div>
                </div>

                {/* Objet */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Objet de l'email</label>
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-secondary transition-colors"
                    placeholder="Objet de l'email"
                  />
                </div>

                {/* Corps */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Contenu de l'email</label>
                  <textarea
                    id="email-body-textarea"
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm leading-relaxed focus:outline-none focus:border-secondary transition-colors resize-y"
                    rows={14}
                    placeholder="Contenu de l'email..."
                  />
                </div>

                {/* Variables */}
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-1">Variables disponibles</h3>
                  <p className="text-xs text-white/40 mb-3">Cliquez sur une variable pour l'insérer dans le texte</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedTemplate.variables || []).map(v => (
                      <button
                        key={v.name}
                        onClick={() => insertVariable(v.name)}
                        className="group flex items-center gap-2 bg-white/5 hover:bg-secondary/20 border border-white/10 hover:border-secondary/50 rounded-lg px-3 py-2 transition-all"
                        title={v.description}
                      >
                        <code className="text-secondary text-xs font-bold">{`{${v.name}}`}</code>
                        <span className="text-xs text-white/50 group-hover:text-white/70">{v.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle aperçu */}
                <div>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-2 text-sm text-white/60 hover:text-secondary transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    {showPreview ? 'Masquer l\'aperçu' : 'Afficher l\'aperçu'}
                  </button>

                  {showPreview && (
                    <div className="mt-3 bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="border-b border-white/10 pb-3 mb-3">
                        <span className="text-xs text-white/40">Objet :</span>
                        <p className="text-white font-medium">{getPreviewText(editedSubject)}</p>
                      </div>
                      <div className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                        {getPreviewText(editedBody)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div>
                    {hasChanges && (
                      <span className="text-xs text-amber-400">Modifications non sauvegardées</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleReset}
                      disabled={saving || !hasChanges}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Annuler
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !hasChanges}
                      className="flex items-center gap-2 px-6 py-2 bg-secondary hover:bg-secondary/80 text-white font-semibold rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex flex-col items-center justify-center h-96 text-white/40">
                <Mail className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-lg">Sélectionnez un email à modifier</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
