import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-toastify'
import { Heart, Plus, Pencil, Trash2, Calendar, Send, Search } from 'lucide-react'
import {
  Card,
  Button,
  Table,
  Modal,
  ConfirmModal,
  Input,
  Textarea,
  Select,
  Toggle,
  Badge,
  Loading,
  EmptyState,
  AIWriteButton
} from '../components/common'
import {
  subscribeToJanazas,
  addDocument,
  updateDocument,
  deleteDocument,
  sendNotification
} from '../services/firebase'
import { JanazaGenre, SalatOptions, defaultJanazaPhrase } from '../types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const defaultJanaza = {
  nomDefunt: '',
  genre: JanazaGenre.HOMME,
  age: '',
  date: '',
  heurePriere: '',
  salatApres: SalatOptions.DHUHR,
  lieu: '',
  phraseAr: defaultJanazaPhrase.ar,
  phraseFr: defaultJanazaPhrase.fr,
  actif: true
}

const genreOptions = [
  { value: JanazaGenre.HOMME, label: 'Homme' },
  { value: JanazaGenre.FEMME, label: 'Femme' },
  { value: JanazaGenre.ENFANT, label: 'Enfant' }
]

const salatOptions = [
  { value: SalatOptions.FAJR, label: 'Après Fajr' },
  { value: SalatOptions.DHUHR, label: 'Après Dhuhr' },
  { value: SalatOptions.ASR, label: 'Après Asr' },
  { value: SalatOptions.MAGHRIB, label: 'Après Maghrib' },
  { value: SalatOptions.ISHA, label: 'Après Isha' },
  { value: SalatOptions.JUMUA, label: 'Après Jumu\'a' }
]

export default function Janaza() {
  const [janazas, setJanazas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, janaza: null })
  const [notifModal, setNotifModal] = useState({ open: false, janaza: null })
  const [sendingNotif, setSendingNotif] = useState(false)
  const [editingJanaza, setEditingJanaza] = useState(null)
  const [formData, setFormData] = useState(defaultJanaza)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filtrer les janazas par recherche
  const filteredJanazas = useMemo(() => {
    if (!searchQuery) return janazas
    const query = searchQuery.toLowerCase()
    return janazas.filter(j =>
      j.nomDefunt?.toLowerCase().includes(query) ||
      j.lieu?.toLowerCase().includes(query)
    )
  }, [janazas, searchQuery])

  useEffect(() => {
    const unsubscribe = subscribeToJanazas((data) => {
      setJanazas(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleOpenModal = (janaza = null) => {
    if (janaza) {
      setEditingJanaza(janaza)
      const date = janaza.date?.toDate?.() || new Date(janaza.date)
      setFormData({
        nomDefunt: janaza.nomDefunt || '',
        genre: janaza.genre || JanazaGenre.HOMME,
        age: janaza.age || '',
        date: format(date, 'yyyy-MM-dd'),
        heurePriere: janaza.heurePriere || '',
        salatApres: janaza.salatApres || SalatOptions.DHUHR,
        lieu: janaza.lieu || '',
        phraseAr: janaza.phraseAr || defaultJanazaPhrase.ar,
        phraseFr: janaza.phraseFr || defaultJanazaPhrase.fr,
        actif: janaza.actif !== false
      })
    } else {
      setEditingJanaza(null)
      setFormData(defaultJanaza)
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingJanaza(null)
    setFormData(defaultJanaza)
  }

  const handleSave = async () => {
    if (!formData.nomDefunt.trim()) {
      toast.error('Le nom du défunt est requis')
      return
    }
    if (!formData.date) {
      toast.error('La date est requise')
      return
    }

    setSaving(true)
    try {
      const data = {
        ...formData,
        date: new Date(formData.date),
        age: formData.age ? parseInt(formData.age) : null
      }

      if (editingJanaza) {
        await updateDocument('janaza', editingJanaza.id, data)
        toast.success('Janaza mise à jour')
      } else {
        await addDocument('janaza', data)
        toast.success('Janaza créée')
      }
      handleCloseModal()
    } catch (err) {
      console.error('Error saving janaza:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.janaza) return

    try {
      await deleteDocument('janaza', deleteModal.janaza.id)
      toast.success('Janaza supprimée')
      setDeleteModal({ open: false, janaza: null })
    } catch (err) {
      console.error('Error deleting janaza:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  // Générer le contenu de la notification pour prévisualisation
  const getNotificationContent = (janaza) => {
    if (!janaza) return { title: '', body: '' }

    const janazaDate = janaza.date?.toDate?.() || new Date(janaza.date)
    const dateStr = format(janazaDate, 'EEEE d MMMM yyyy', { locale: fr })

    // Titre avec emoji
    const title = `🕌 Salat Janaza - ${janaza.nomDefunt || 'Défunt(e)'}`

    // Corps : date + heure/salat + lieu + phrase
    let body = `📅 ${dateStr}`

    if (janaza.heurePriere) {
      body += ` à ${janaza.heurePriere}`
    } else if (janaza.salatApres) {
      const salatLabel = salatOptions.find(s => s.value === janaza.salatApres)?.label || janaza.salatApres
      body += `\n⏰ ${salatLabel}`
    }

    if (janaza.lieu) {
      body += `\n📍 ${janaza.lieu}`
    }

    // Ajouter la phrase de condoléances
    if (janaza.phraseFr) {
      body += `\n\n${janaza.phraseFr}`
    }

    return { title, body }
  }

  // Ouvrir la modal de confirmation
  const handleOpenNotifModal = (janaza) => {
    setNotifModal({ open: true, janaza })
  }

  // Envoyer la notification après confirmation
  const handleConfirmSendNotification = async () => {
    const janaza = notifModal.janaza
    if (!janaza) return

    setSendingNotif(true)
    try {
      const { title, body } = getNotificationContent(janaza)

      await sendNotification(
        title,
        body,
        'janaza',
        { type: 'janaza', id: janaza.id }
      )
      await updateDocument('janaza', janaza.id, {
        notificationSent: true,
        notificationSentAt: new Date()
      })
      toast.success('Notification envoyée à tous les utilisateurs !')
      setNotifModal({ open: false, janaza: null })
    } catch (err) {
      console.error('Error sending notification:', err)
      toast.error('Erreur lors de l\'envoi de la notification')
    } finally {
      setSendingNotif(false)
    }
  }

  const getGenreLabel = (genre) => {
    switch (genre) {
      case JanazaGenre.FEMME: return 'Femme'
      case JanazaGenre.ENFANT: return 'Enfant'
      default: return 'Homme'
    }
  }

  const columns = [
    {
      key: 'nomDefunt',
      label: 'Défunt(e)',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.nomDefunt}</p>
          <p className="text-sm text-white/50">
            {getGenreLabel(row.genre)}
            {row.age && ` - ${row.age} ans`}
          </p>
        </div>
      )
    },
    {
      key: 'date',
      label: 'Date & Heure',
      render: (row) => {
        if (!row.date) return <span className="text-white/50">-</span>
        try {
          const date = row.date?.toDate?.() || new Date(row.date)
          if (isNaN(date.getTime())) return <span className="text-white/50">-</span>
          return (
            <div>
              <p className="text-white flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(date, 'd MMMM yyyy', { locale: fr })}
              </p>
              <p className="text-sm text-white/50">
                {row.salatApres ? salatOptions.find(s => s.value === row.salatApres)?.label : ''}
                {row.heurePriere && ` à ${row.heurePriere}`}
              </p>
            </div>
          )
        } catch (e) {
          return <span className="text-white/50">-</span>
        }
      }
    },
    {
      key: 'lieu',
      label: 'Lieu',
      render: (row) => (
        <span className="text-white/70">{row.lieu || 'Mosquée'}</span>
      )
    },
    {
      key: 'actif',
      label: 'Statut',
      render: (row) => (
        <Badge variant={row.actif ? 'success' : 'default'}>
          {row.actif ? 'Affiché' : 'Masqué'}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal(row)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Modifier"
          >
            <Pencil className="w-4 h-4 text-white/50" />
          </button>
          <button
            onClick={() => handleOpenNotifModal(row)}
            className={`p-2 rounded-lg transition-colors ${row.notificationSent ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-500/10'}`}
            title={row.notificationSent ? 'Notification déjà envoyée' : 'Envoyer une notification'}
            disabled={row.notificationSent}
          >
            <Send className={`w-4 h-4 ${row.notificationSent ? 'text-white/30' : 'text-green-400'}`} />
          </button>
          <button
            onClick={() => setDeleteModal({ open: true, janaza: row })}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-secondary text-sm"
            />
          </div>
          <p className="text-white/50">
            {filteredJanazas.length} salat janaza
            {searchQuery && ` sur ${janazas.length}`}
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle janaza
        </Button>
      </div>

      {/* Condoleances Banner */}
      <Card className="bg-primary/20 border-primary/30">
        <div className="text-center">
          <p className="text-secondary text-xl mb-2" style={{ fontFamily: 'serif' }}>
            {defaultJanazaPhrase.ar}
          </p>
          <p className="text-white/70 italic">{defaultJanazaPhrase.fr}</p>
        </div>
      </Card>

      {/* Table */}
      {janazas.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Aucune salat janaza"
          description="Ajoutez une annonce de salat janaza."
          action={() => handleOpenModal()}
          actionLabel="Ajouter une janaza"
        />
      ) : filteredJanazas.length === 0 ? (
        <Card>
          <p className="text-center text-white/50 py-8">Aucun résultat pour "{searchQuery}"</p>
        </Card>
      ) : (
        <Card>
          <Table columns={columns} data={filteredJanazas} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingJanaza ? 'Modifier la janaza' : 'Nouvelle janaza'}
        size="xl"
      >
        <div className="space-y-4">
          <Input
            label="Nom du défunt"
            value={formData.nomDefunt}
            onChange={(e) => setFormData({ ...formData, nomDefunt: e.target.value })}
            placeholder="Ex: Mohamed Ben Ali"
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Genre"
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              options={genreOptions}
            />
            <Input
              label="Âge (optionnel)"
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              placeholder="Ex: 75"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Select
              label="Après quelle prière"
              value={formData.salatApres}
              onChange={(e) => setFormData({ ...formData, salatApres: e.target.value })}
              options={salatOptions}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Heure précise (optionnel)"
              type="time"
              value={formData.heurePriere}
              onChange={(e) => setFormData({ ...formData, heurePriere: e.target.value })}
            />
            <Input
              label="Lieu"
              value={formData.lieu}
              onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
              placeholder="Ex: Mosquée El Mouhssinine"
            />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Phrase en arabe</label>
              <AIWriteButton
                type="janaza"
                field="contenu"
                existingContent={formData.phraseAr}
                onGenerated={(content) => setFormData({ ...formData, phraseAr: content })}
              />
            </div>
            <Textarea
              value={formData.phraseAr}
              onChange={(e) => setFormData({ ...formData, phraseAr: e.target.value })}
              className="text-right"
              dir="rtl"
            />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Phrase en français</label>
              <AIWriteButton
                type="janaza"
                field="contenu"
                existingContent={formData.phraseFr}
                onGenerated={(content) => setFormData({ ...formData, phraseFr: content })}
              />
            </div>
            <Textarea
              value={formData.phraseFr}
              onChange={(e) => setFormData({ ...formData, phraseFr: e.target.value })}
            />
          </div>
          <Toggle
            label="Afficher sur l'application"
            checked={formData.actif}
            onChange={(checked) => setFormData({ ...formData, actif: checked })}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleCloseModal}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editingJanaza ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, janaza: null })}
        onConfirm={handleDelete}
        title="Supprimer la janaza"
        message={`Êtes-vous sûr de vouloir supprimer l'annonce pour "${deleteModal.janaza?.nomDefunt}" ?`}
        confirmLabel="Supprimer"
        danger
      />

      {/* Notification Confirmation Modal */}
      <Modal
        isOpen={notifModal.open}
        onClose={() => setNotifModal({ open: false, janaza: null })}
        title="Envoyer une notification"
        size="md"
      >
        {notifModal.janaza && (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-amber-400 text-sm flex items-center gap-2">
                <Send className="w-4 h-4" />
                Cette notification sera envoyée à <strong>tous les utilisateurs</strong> de l'application.
              </p>
            </div>

            {/* Prévisualisation */}
            <div>
              <p className="text-white/50 text-sm mb-2">Prévisualisation de la notification :</p>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-white font-semibold mb-2">
                  {getNotificationContent(notifModal.janaza).title}
                </p>
                <p className="text-white/70 text-sm whitespace-pre-line">
                  {getNotificationContent(notifModal.janaza).body}
                </p>
              </div>
            </div>

            {/* Détails inclus */}
            <div className="text-sm text-white/50">
              <p>Informations incluses :</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Nom du défunt : {notifModal.janaza.nomDefunt}</li>
                <li>Date complète (jour + date)</li>
                {notifModal.janaza.heurePriere && <li>Heure : {notifModal.janaza.heurePriere}</li>}
                {notifModal.janaza.salatApres && <li>Après : {salatOptions.find(s => s.value === notifModal.janaza.salatApres)?.label}</li>}
                {notifModal.janaza.lieu && <li>Lieu : {notifModal.janaza.lieu}</li>}
                <li>Phrase de condoléances</li>
              </ul>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setNotifModal({ open: false, janaza: null })}>
            Annuler
          </Button>
          <Button onClick={handleConfirmSendNotification} loading={sendingNotif}>
            <Send className="w-4 h-4 mr-2" />
            Envoyer la notification
          </Button>
        </div>
      </Modal>
    </div>
  )
}
