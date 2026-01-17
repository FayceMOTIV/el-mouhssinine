import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-toastify'
import { Calendar, Plus, Pencil, Trash2, MapPin, Clock, Copy, Send, Search } from 'lucide-react'
import {
  Card,
  Button,
  Table,
  Modal,
  ConfirmModal,
  Input,
  Textarea,
  Toggle,
  Badge,
  Loading,
  EmptyState,
  AIWriteButton
} from '../components/common'
import {
  subscribeToEvenements,
  addDocument,
  updateDocument,
  deleteDocument,
  sendNotification
} from '../services/firebase'
import { format, isPast, isFuture } from 'date-fns'
import { fr } from 'date-fns/locale'

const defaultEvenement = {
  titre: '',
  description: '',
  date: '',
  heure: '',
  lieu: '',
  actif: true
}

export default function Evenements() {
  const [evenements, setEvenements] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, evenement: null })
  const [notifModal, setNotifModal] = useState({ open: false, evenement: null })
  const [sendingNotif, setSendingNotif] = useState(false)
  const [editingEvenement, setEditingEvenement] = useState(null)
  const [formData, setFormData] = useState(defaultEvenement)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filtrer les événements par recherche
  const filteredEvenements = useMemo(() => {
    if (!searchQuery) return evenements
    const query = searchQuery.toLowerCase()
    return evenements.filter(e =>
      e.titre?.toLowerCase().includes(query) ||
      e.description?.toLowerCase().includes(query) ||
      e.lieu?.toLowerCase().includes(query)
    )
  }, [evenements, searchQuery])

  useEffect(() => {
    const unsubscribe = subscribeToEvenements((data) => {
      setEvenements(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleOpenModal = (evenement = null) => {
    if (evenement) {
      setEditingEvenement(evenement)
      const date = evenement.date?.toDate?.() || new Date(evenement.date)
      setFormData({
        titre: evenement.titre || '',
        description: evenement.description || '',
        date: format(date, 'yyyy-MM-dd'),
        heure: evenement.heure || '',
        lieu: evenement.lieu || '',
        actif: evenement.actif !== false
      })
    } else {
      setEditingEvenement(null)
      setFormData(defaultEvenement)
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingEvenement(null)
    setFormData(defaultEvenement)
  }

  const handleSave = async () => {
    if (!formData.titre.trim()) {
      toast.error('Le titre est requis')
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
        date: new Date(formData.date)
      }

      if (editingEvenement) {
        await updateDocument('events', editingEvenement.id, data)
        toast.success('Événement mis à jour')
      } else {
        await addDocument('events', data)
        toast.success('Événement créé')
      }
      handleCloseModal()
    } catch (err) {
      console.error('Error saving evenement:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.evenement) return

    try {
      await deleteDocument('events', deleteModal.evenement.id)
      toast.success('Événement supprimé')
      setDeleteModal({ open: false, evenement: null })
    } catch (err) {
      console.error('Error deleting evenement:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleDuplicate = (evenement) => {
    setEditingEvenement(null)
    setFormData({
      titre: `${evenement.titre} (copie)`,
      description: evenement.description || '',
      date: '',
      heure: evenement.heure || '',
      lieu: evenement.lieu || '',
      actif: true
    })
    setModalOpen(true)
    toast.info('Événement dupliqué - modifiez la date et créez')
  }

  // Générer le contenu de la notification pour prévisualisation
  const getNotificationContent = (evenement) => {
    if (!evenement) return { title: '', body: '' }

    const eventDate = evenement.date?.toDate?.() || new Date(evenement.date)
    const dateStr = format(eventDate, 'EEEE d MMMM yyyy', { locale: fr })

    // Titre : nom de l'événement
    const title = evenement.titre || 'Nouvel événement'

    // Corps : date + heure + lieu + description (tronquée)
    let body = `📅 ${dateStr}`
    if (evenement.heure) {
      body += ` à ${evenement.heure}`
    }
    if (evenement.lieu) {
      body += `\n📍 ${evenement.lieu}`
    }
    if (evenement.description) {
      // Tronquer la description à 100 caractères
      const desc = evenement.description.length > 100
        ? evenement.description.substring(0, 100) + '...'
        : evenement.description
      body += `\n${desc}`
    }

    return { title, body }
  }

  // Ouvrir la modal de confirmation
  const handleOpenNotifModal = (evenement) => {
    setNotifModal({ open: true, evenement })
  }

  // Envoyer la notification après confirmation
  const handleConfirmSendNotification = async () => {
    const evenement = notifModal.evenement
    if (!evenement) return

    setSendingNotif(true)
    try {
      const { title, body } = getNotificationContent(evenement)

      await sendNotification(
        title,
        body,
        'events',
        { type: 'event', id: evenement.id }
      )
      await updateDocument('events', evenement.id, {
        notificationSent: true,
        notificationSentAt: new Date()
      })
      toast.success('Notification envoyée à tous les utilisateurs !')
      setNotifModal({ open: false, evenement: null })
    } catch (err) {
      console.error('Error sending notification:', err)
      toast.error('Erreur lors de l\'envoi de la notification')
    } finally {
      setSendingNotif(false)
    }
  }

  const getEventStatus = (event) => {
    const date = event.date?.toDate?.() || new Date(event.date)
    if (isPast(date)) return { label: 'Passé', variant: 'default' }
    if (isFuture(date)) return { label: 'À venir', variant: 'success' }
    return { label: 'Aujourd\'hui', variant: 'warning' }
  }

  const columns = [
    {
      key: 'titre',
      label: 'Événement',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.titre}</p>
          {row.description && (
            <p className="text-sm text-white/50 line-clamp-1">{row.description}</p>
          )}
        </div>
      )
    },
    {
      key: 'date',
      label: 'Date',
      render: (row) => {
        if (!row.date) return <span className="text-white/50">-</span>
        try {
          const date = row.date?.toDate?.() || new Date(row.date)
          if (isNaN(date.getTime())) return <span className="text-white/50">-</span>
          return (
            <div>
              <p className="text-white">{format(date, 'EEEE d MMMM yyyy', { locale: fr })}</p>
              {row.heure && (
                <p className="text-sm text-white/50 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {row.heure}
                </p>
              )}
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
      render: (row) => row.lieu ? (
        <span className="text-white/70 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {row.lieu}
        </span>
      ) : (
        <span className="text-white/30">-</span>
      )
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (row) => {
        const status = getEventStatus(row)
        return <Badge variant={status.variant}>{status.label}</Badge>
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDuplicate(row)}
            className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors"
            title="Dupliquer"
          >
            <Copy className="w-4 h-4 text-blue-400" />
          </button>
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
            onClick={() => setDeleteModal({ open: true, evenement: row })}
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
            {filteredEvenements.length} événement{filteredEvenements.length !== 1 ? 's' : ''}
            {searchQuery && ` sur ${evenements.length}`}
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvel événement
        </Button>
      </div>

      {/* Table */}
      {evenements.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Aucun événement"
          description="Créez votre premier événement pour la mosquée."
          action={() => handleOpenModal()}
          actionLabel="Créer un événement"
        />
      ) : filteredEvenements.length === 0 ? (
        <Card>
          <p className="text-center text-white/50 py-8">Aucun résultat pour "{searchQuery}"</p>
        </Card>
      ) : (
        <Card>
          <Table columns={columns} data={filteredEvenements} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingEvenement ? 'Modifier l\'événement' : 'Nouvel événement'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Titre</label>
              <AIWriteButton
                type="evenement"
                field="titre"
                existingContent={formData.titre}
                onGenerated={(content) => setFormData({ ...formData, titre: content })}
              />
            </div>
            <Input
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Ex: Conférence sur le Ramadan"
              required
            />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Description</label>
              <AIWriteButton
                type="evenement"
                field="contenu"
                existingTitle={formData.titre}
                existingContent={formData.description}
                onGenerated={(content) => setFormData({ ...formData, description: content })}
              />
            </div>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Détails de l'événement..."
              rows={3}
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
            <Input
              label="Heure"
              type="time"
              value={formData.heure}
              onChange={(e) => setFormData({ ...formData, heure: e.target.value })}
            />
          </div>
          <Input
            label="Lieu"
            value={formData.lieu}
            onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
            placeholder="Ex: Salle principale de la mosquée"
          />
          <Toggle
            label="Événement actif"
            checked={formData.actif}
            onChange={(checked) => setFormData({ ...formData, actif: checked })}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleCloseModal}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editingEvenement ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, evenement: null })}
        onConfirm={handleDelete}
        title="Supprimer l'événement"
        message={`Êtes-vous sûr de vouloir supprimer l'événement "${deleteModal.evenement?.titre}" ?`}
        confirmLabel="Supprimer"
        danger
      />

      {/* Notification Confirmation Modal */}
      <Modal
        isOpen={notifModal.open}
        onClose={() => setNotifModal({ open: false, evenement: null })}
        title="Envoyer une notification"
        size="md"
      >
        {notifModal.evenement && (
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
                  {getNotificationContent(notifModal.evenement).title}
                </p>
                <p className="text-white/70 text-sm whitespace-pre-line">
                  {getNotificationContent(notifModal.evenement).body}
                </p>
              </div>
            </div>

            {/* Détails de l'événement */}
            <div className="text-sm text-white/50">
              <p>Informations incluses dans la notification :</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Titre de l'événement</li>
                <li>Date complète (jour + date)</li>
                {notifModal.evenement.heure && <li>Heure : {notifModal.evenement.heure}</li>}
                {notifModal.evenement.lieu && <li>Lieu : {notifModal.evenement.lieu}</li>}
                {notifModal.evenement.description && <li>Description (100 premiers caractères)</li>}
              </ul>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setNotifModal({ open: false, evenement: null })}>
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
