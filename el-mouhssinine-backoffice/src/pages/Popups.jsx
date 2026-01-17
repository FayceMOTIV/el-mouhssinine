import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { MessageSquare, Plus, Pencil, Trash2, Eye, EyeOff, Copy } from 'lucide-react'
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
  subscribeToPopups,
  addDocument,
  updateDocument,
  deleteDocument
} from '../services/firebase'
import { PopupPriorite, PopupCible, PopupFrequence } from '../types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const defaultPopup = {
  titre: '',
  message: '',
  priorite: PopupPriorite.NORMALE,
  cible: PopupCible.TOUS,
  frequence: PopupFrequence.ALWAYS,
  lienBouton: '',
  texteBouton: '',
  actif: true,
  dateDebut: '',
  dateFin: ''
}

const prioriteOptions = [
  { value: PopupPriorite.BASSE, label: 'Basse' },
  { value: PopupPriorite.NORMALE, label: 'Normale' },
  { value: PopupPriorite.HAUTE, label: 'Haute' }
]

const cibleOptions = [
  { value: PopupCible.TOUS, label: 'Tous les utilisateurs' },
  { value: PopupCible.MEMBRES, label: 'Membres uniquement' },
  { value: PopupCible.NON_MEMBRES, label: 'Non-membres uniquement' }
]

const frequenceOptions = [
  { value: PopupFrequence.ALWAYS, label: 'À chaque ouverture' },
  { value: PopupFrequence.DAILY, label: 'Une fois par jour' },
  { value: PopupFrequence.ONCE, label: 'Une seule fois' },
  { value: PopupFrequence.WEEKLY, label: 'Une fois par semaine' }
]

export default function Popups() {
  const [popups, setPopups] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, popup: null })
  const [editingPopup, setEditingPopup] = useState(null)
  const [formData, setFormData] = useState(defaultPopup)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToPopups((data) => {
      setPopups(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleOpenModal = (popup = null) => {
    if (popup) {
      setEditingPopup(popup)
      setFormData({
        titre: popup.titre || '',
        message: popup.message || '',
        priorite: popup.priorite || PopupPriorite.NORMALE,
        cible: popup.cible || PopupCible.TOUS,
        frequence: popup.frequence || PopupFrequence.ALWAYS,
        lienBouton: popup.lienBouton || '',
        texteBouton: popup.texteBouton || '',
        actif: popup.actif !== false,
        dateDebut: popup.dateDebut || '',
        dateFin: popup.dateFin || ''
      })
    } else {
      setEditingPopup(null)
      setFormData(defaultPopup)
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingPopup(null)
    setFormData(defaultPopup)
  }

  const handleSave = async () => {
    if (!formData.titre.trim()) {
      toast.error('Le titre est requis')
      return
    }
    if (!formData.message.trim()) {
      toast.error('Le message est requis')
      return
    }

    setSaving(true)
    try {
      if (editingPopup) {
        await updateDocument('popups', editingPopup.id, formData)
        toast.success('Popup mise à jour')
      } else {
        await addDocument('popups', formData)
        toast.success('Popup créée')
      }
      handleCloseModal()
    } catch (err) {
      console.error('Error saving popup:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (popup) => {
    try {
      await updateDocument('popups', popup.id, { actif: !popup.actif })
      toast.success(popup.actif ? 'Popup désactivée' : 'Popup activée')
    } catch (err) {
      console.error('Error toggling popup:', err)
      toast.error('Erreur lors de la modification')
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.popup) return

    try {
      await deleteDocument('popups', deleteModal.popup.id)
      toast.success('Popup supprimée')
      setDeleteModal({ open: false, popup: null })
    } catch (err) {
      console.error('Error deleting popup:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleDuplicate = (popup) => {
    setEditingPopup(null)
    setFormData({
      titre: `${popup.titre} (copie)`,
      message: popup.message || '',
      priorite: popup.priorite || PopupPriorite.NORMALE,
      cible: popup.cible || PopupCible.TOUS,
      frequence: popup.frequence || PopupFrequence.ALWAYS,
      lienBouton: popup.lienBouton || '',
      texteBouton: popup.texteBouton || '',
      actif: true,
      dateDebut: '',
      dateFin: ''
    })
    setModalOpen(true)
    toast.info('Popup dupliquée - modifiez et créez')
  }

  const getPrioriteVariant = (priorite) => {
    switch (priorite) {
      case PopupPriorite.HAUTE: return 'danger'
      case PopupPriorite.NORMALE: return 'warning'
      case PopupPriorite.BASSE: return 'info'
      default: return 'default'
    }
  }

  const getFrequenceLabel = (frequence) => {
    switch (frequence) {
      case PopupFrequence.ALWAYS: return 'Chaque ouverture'
      case PopupFrequence.DAILY: return '1x/jour'
      case PopupFrequence.ONCE: return 'Une fois'
      case PopupFrequence.WEEKLY: return '1x/semaine'
      default: return 'Chaque ouverture'
    }
  }

  const columns = [
    {
      key: 'titre',
      label: 'Titre',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.titre}</p>
          <p className="text-sm text-white/50 line-clamp-1">{row.message}</p>
        </div>
      )
    },
    {
      key: 'priorite',
      label: 'Priorité',
      render: (row) => (
        <Badge variant={getPrioriteVariant(row.priorite)}>
          {row.priorite || 'normale'}
        </Badge>
      )
    },
    {
      key: 'cible',
      label: 'Cible',
      render: (row) => (
        <span className="text-white/70 capitalize">
          {row.cible === PopupCible.MEMBRES ? 'Membres' :
           row.cible === PopupCible.NON_MEMBRES ? 'Non-membres' : 'Tous'}
        </span>
      )
    },
    {
      key: 'frequence',
      label: 'Fréquence',
      render: (row) => (
        <span className="text-white/70 text-sm">
          {getFrequenceLabel(row.frequence)}
        </span>
      )
    },
    {
      key: 'actif',
      label: 'Statut',
      render: (row) => (
        <Badge variant={row.actif ? 'success' : 'default'}>
          {row.actif ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggleActive(row)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={row.actif ? 'Désactiver' : 'Activer'}
          >
            {row.actif ? (
              <EyeOff className="w-4 h-4 text-white/50" />
            ) : (
              <Eye className="w-4 h-4 text-white/50" />
            )}
          </button>
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
            onClick={() => setDeleteModal({ open: true, popup: row })}
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
      <div className="flex justify-between items-center">
        <p className="text-white/50">
          {popups.length} popup{popups.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle popup
        </Button>
      </div>

      {/* Table */}
      {popups.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Aucune popup"
          description="Créez une popup pour afficher des messages importants."
          action={() => handleOpenModal()}
          actionLabel="Créer une popup"
        />
      ) : (
        <Card>
          <Table columns={columns} data={popups} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingPopup ? 'Modifier la popup' : 'Nouvelle popup'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Titre</label>
              <AIWriteButton
                type="popup"
                field="titre"
                existingContent={formData.titre}
                onGenerated={(content) => setFormData({ ...formData, titre: content })}
              />
            </div>
            <Input
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Ex: Rappel important"
              required
            />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Message</label>
              <AIWriteButton
                type="popup"
                field="message"
                existingTitle={formData.titre}
                existingContent={formData.message}
                onGenerated={(content) => setFormData({ ...formData, message: content })}
              />
            </div>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Contenu de la popup..."
              rows={4}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Priorité"
              value={formData.priorite}
              onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
              options={prioriteOptions}
            />
            <Select
              label="Cible"
              value={formData.cible}
              onChange={(e) => setFormData({ ...formData, cible: e.target.value })}
              options={cibleOptions}
            />
            <Select
              label="Fréquence d'affichage"
              value={formData.frequence}
              onChange={(e) => setFormData({ ...formData, frequence: e.target.value })}
              options={frequenceOptions}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Texte du bouton (optionnel)"
              value={formData.texteBouton}
              onChange={(e) => setFormData({ ...formData, texteBouton: e.target.value })}
              placeholder="Ex: En savoir plus"
            />
            <Input
              label="Lien du bouton (optionnel)"
              value={formData.lienBouton}
              onChange={(e) => setFormData({ ...formData, lienBouton: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Date de début (optionnel)"
              type="datetime-local"
              value={formData.dateDebut}
              onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
            />
            <Input
              label="Date de fin (optionnel)"
              type="datetime-local"
              value={formData.dateFin}
              onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
            />
          </div>
          <Toggle
            label="Popup active"
            checked={formData.actif}
            onChange={(checked) => setFormData({ ...formData, actif: checked })}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleCloseModal}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editingPopup ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, popup: null })}
        onConfirm={handleDelete}
        title="Supprimer la popup"
        message={`Êtes-vous sûr de vouloir supprimer la popup "${deleteModal.popup?.titre}" ?`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
