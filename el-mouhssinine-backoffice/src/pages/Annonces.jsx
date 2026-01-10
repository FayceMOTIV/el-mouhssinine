import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Megaphone, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
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
  subscribeToAnnonces,
  addDocument,
  updateDocument,
  deleteDocument
} from '../services/firebase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const defaultAnnonce = {
  titre: '',
  contenu: '',
  actif: true
}

export default function Annonces() {
  const [annonces, setAnnonces] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, annonce: null })
  const [editingAnnonce, setEditingAnnonce] = useState(null)
  const [formData, setFormData] = useState(defaultAnnonce)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToAnnonces((data) => {
      setAnnonces(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleOpenModal = (annonce = null) => {
    if (annonce) {
      setEditingAnnonce(annonce)
      setFormData({
        titre: annonce.titre || '',
        contenu: annonce.contenu || '',
        actif: annonce.actif !== false
      })
    } else {
      setEditingAnnonce(null)
      setFormData(defaultAnnonce)
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingAnnonce(null)
    setFormData(defaultAnnonce)
  }

  const handleSave = async () => {
    if (!formData.titre.trim()) {
      toast.error('Le titre est requis')
      return
    }
    if (!formData.contenu.trim()) {
      toast.error('Le contenu est requis')
      return
    }

    setSaving(true)
    try {
      if (editingAnnonce) {
        await updateDocument('announcements', editingAnnonce.id, formData)
        toast.success('Annonce mise à jour')
      } else {
        await addDocument('announcements', formData)
        toast.success('Annonce créée')
      }
      handleCloseModal()
    } catch (err) {
      console.error('Error saving annonce:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (annonce) => {
    try {
      await updateDocument('announcements', annonce.id, { actif: !annonce.actif })
      toast.success(annonce.actif ? 'Annonce désactivée' : 'Annonce activée')
    } catch (err) {
      console.error('Error toggling annonce:', err)
      toast.error('Erreur lors de la modification')
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.annonce) return

    try {
      await deleteDocument('announcements', deleteModal.annonce.id)
      toast.success('Annonce supprimée')
      setDeleteModal({ open: false, annonce: null })
    } catch (err) {
      console.error('Error deleting annonce:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const columns = [
    {
      key: 'titre',
      label: 'Titre',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.titre}</p>
          <p className="text-sm text-white/50 line-clamp-1">{row.contenu}</p>
        </div>
      )
    },
    {
      key: 'actif',
      label: 'Statut',
      render: (row) => (
        <Badge variant={row.actif ? 'success' : 'default'}>
          {row.actif ? 'Actif' : 'Inactif'}
        </Badge>
      )
    },
    {
      key: 'createdAt',
      label: 'Créé le',
      render: (row) => {
        if (!row.createdAt) return <span className="text-white/50">-</span>
        try {
          const date = row.createdAt?.toDate?.() || new Date(row.createdAt)
          if (isNaN(date.getTime())) return <span className="text-white/50">-</span>
          return (
            <span className="text-white/70">
              {format(date, 'dd MMM yyyy', { locale: fr })}
            </span>
          )
        } catch (e) {
          return <span className="text-white/50">-</span>
        }
      }
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
            onClick={() => handleOpenModal(row)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4 text-white/50" />
          </button>
          <button
            onClick={() => setDeleteModal({ open: true, annonce: row })}
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
          {annonces.length} annonce{annonces.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle annonce
        </Button>
      </div>

      {/* Table */}
      {annonces.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Aucune annonce"
          description="Créez votre première annonce pour informer les fidèles."
          action={() => handleOpenModal()}
          actionLabel="Créer une annonce"
        />
      ) : (
        <Card>
          <Table columns={columns} data={annonces} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingAnnonce ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
      >
        <div className="space-y-4">
          <Input
            label="Titre"
            value={formData.titre}
            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
            placeholder="Ex: Fermeture exceptionnelle"
            required
          />
          <Textarea
            label="Contenu"
            value={formData.contenu}
            onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
            placeholder="Détails de l'annonce..."
            rows={5}
            required
          />
          <Toggle
            label="Annonce active"
            checked={formData.actif}
            onChange={(checked) => setFormData({ ...formData, actif: checked })}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleCloseModal}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editingAnnonce ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, annonce: null })}
        onConfirm={handleDelete}
        title="Supprimer l'annonce"
        message={`Êtes-vous sûr de vouloir supprimer l'annonce "${deleteModal.annonce?.titre}" ?`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
