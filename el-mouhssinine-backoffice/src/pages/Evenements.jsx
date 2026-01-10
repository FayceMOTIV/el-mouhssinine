import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Calendar, Plus, Pencil, Trash2, MapPin, Clock } from 'lucide-react'
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
  EmptyState
} from '../components/common'
import {
  subscribeToEvenements,
  addDocument,
  updateDocument,
  deleteDocument
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
  const [editingEvenement, setEditingEvenement] = useState(null)
  const [formData, setFormData] = useState(defaultEvenement)
  const [saving, setSaving] = useState(false)

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
            onClick={() => handleOpenModal(row)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4 text-white/50" />
          </button>
          <button
            onClick={() => setDeleteModal({ open: true, evenement: row })}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
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
      <div className="flex justify-between items-center">
        <p className="text-white/50">
          {evenements.length} événement{evenements.length !== 1 ? 's' : ''}
        </p>
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
      ) : (
        <Card>
          <Table columns={columns} data={evenements} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingEvenement ? 'Modifier l\'événement' : 'Nouvel événement'}
      >
        <div className="space-y-4">
          <Input
            label="Titre"
            value={formData.titre}
            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
            placeholder="Ex: Conférence sur le Ramadan"
            required
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Détails de l'événement..."
            rows={3}
          />
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
    </div>
  )
}
