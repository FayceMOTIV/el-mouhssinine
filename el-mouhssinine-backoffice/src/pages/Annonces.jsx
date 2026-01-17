import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-toastify'
import { Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, Copy, Send, Search } from 'lucide-react'
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
  subscribeToAnnonces,
  addDocument,
  updateDocument,
  deleteDocument,
  sendNotification
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
  const [notifModal, setNotifModal] = useState({ open: false, annonce: null })
  const [sendingNotif, setSendingNotif] = useState(false)
  const [editingAnnonce, setEditingAnnonce] = useState(null)
  const [formData, setFormData] = useState(defaultAnnonce)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filtrer les annonces par recherche
  const filteredAnnonces = useMemo(() => {
    if (!searchQuery) return annonces
    const query = searchQuery.toLowerCase()
    return annonces.filter(a =>
      a.titre?.toLowerCase().includes(query) ||
      a.contenu?.toLowerCase().includes(query)
    )
  }, [annonces, searchQuery])

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

  const handleDuplicate = (annonce) => {
    setEditingAnnonce(null)
    setFormData({
      titre: `${annonce.titre} (copie)`,
      contenu: annonce.contenu || '',
      actif: true
    })
    setModalOpen(true)
    toast.info('Annonce dupliquée - modifiez et créez')
  }

  // Générer le contenu de la notification pour prévisualisation
  const getNotificationContent = (annonce) => {
    if (!annonce) return { title: '', body: '' }

    // Titre avec emoji
    const title = `📢 ${annonce.titre || 'Nouvelle annonce'}`

    // Corps : contenu tronqué à 150 caractères
    const body = annonce.contenu?.length > 150
      ? annonce.contenu.substring(0, 150) + '...'
      : annonce.contenu || ''

    return { title, body }
  }

  // Ouvrir la modal de confirmation
  const handleOpenNotifModal = (annonce) => {
    setNotifModal({ open: true, annonce })
  }

  // Envoyer la notification après confirmation
  const handleConfirmSendNotification = async () => {
    const annonce = notifModal.annonce
    if (!annonce) return

    setSendingNotif(true)
    try {
      const { title, body } = getNotificationContent(annonce)

      await sendNotification(
        title,
        body,
        'announcements',
        { type: 'announcement', id: annonce.id }
      )
      await updateDocument('announcements', annonce.id, {
        notificationSent: true,
        notificationSentAt: new Date()
      })
      toast.success('Notification envoyée à tous les utilisateurs !')
      setNotifModal({ open: false, annonce: null })
    } catch (err) {
      console.error('Error sending notification:', err)
      toast.error('Erreur lors de l\'envoi de la notification')
    } finally {
      setSendingNotif(false)
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
            onClick={() => setDeleteModal({ open: true, annonce: row })}
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
            {filteredAnnonces.length} annonce{filteredAnnonces.length !== 1 ? 's' : ''}
            {searchQuery && ` sur ${annonces.length}`}
          </p>
        </div>
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
      ) : filteredAnnonces.length === 0 ? (
        <Card>
          <p className="text-center text-white/50 py-8">Aucun résultat pour "{searchQuery}"</p>
        </Card>
      ) : (
        <Card>
          <Table columns={columns} data={filteredAnnonces} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingAnnonce ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Titre</label>
              <AIWriteButton
                type="annonce"
                field="titre"
                existingContent={formData.titre}
                onGenerated={(content) => setFormData({ ...formData, titre: content })}
              />
            </div>
            <Input
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Ex: Fermeture exceptionnelle"
              required
            />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Contenu</label>
              <AIWriteButton
                type="annonce"
                field="contenu"
                existingTitle={formData.titre}
                existingContent={formData.contenu}
                onGenerated={(content) => setFormData({ ...formData, contenu: content })}
              />
            </div>
            <Textarea
              value={formData.contenu}
              onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
              placeholder="Détails de l'annonce..."
              rows={5}
              required
            />
          </div>
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

      {/* Notification Confirmation Modal */}
      <Modal
        isOpen={notifModal.open}
        onClose={() => setNotifModal({ open: false, annonce: null })}
        title="Envoyer une notification"
        size="md"
      >
        {notifModal.annonce && (
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
                  {getNotificationContent(notifModal.annonce).title}
                </p>
                <p className="text-white/70 text-sm whitespace-pre-line">
                  {getNotificationContent(notifModal.annonce).body}
                </p>
              </div>
            </div>

            {/* Détails */}
            <div className="text-sm text-white/50">
              <p>Contenu original : {notifModal.annonce.contenu?.length || 0} caractères</p>
              {notifModal.annonce.contenu?.length > 150 && (
                <p className="text-amber-400/70">Le contenu sera tronqué à 150 caractères</p>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setNotifModal({ open: false, annonce: null })}>
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
