import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Bell, Plus, Pencil, Trash2, Send, Clock } from 'lucide-react'
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
  StatusBadge,
  Loading,
  EmptyState,
  AIWriteButton
} from '../components/common'
import {
  subscribeToNotifications,
  addDocument,
  updateDocument,
  deleteDocument
} from '../services/firebase'
import { NotificationStatut, NotificationTopic } from '../types'
import { format, isFuture } from 'date-fns'
import { fr } from 'date-fns/locale'

const defaultNotification = {
  titre: '',
  message: '',
  topic: NotificationTopic.TOUS,
  statut: NotificationStatut.PROGRAMMEE,
  dateProgrammee: '',
  heureProgrammee: ''
}

const topicOptions = [
  { value: NotificationTopic.TOUS, label: 'Tous les utilisateurs' },
  { value: NotificationTopic.ANNOUNCEMENTS, label: 'Annonces' },
  { value: NotificationTopic.PRAYER_REMINDERS, label: 'Rappels de prière' },
  { value: NotificationTopic.JANAZA, label: 'Salat Janaza' },
  { value: NotificationTopic.EVENTS, label: 'Événements' },
  { value: NotificationTopic.MEMBRES, label: 'Membres uniquement' }
]

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, notification: null })
  const [editingNotification, setEditingNotification] = useState(null)
  const [formData, setFormData] = useState(defaultNotification)
  const [saving, setSaving] = useState(false)
  const [sendNow, setSendNow] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((data) => {
      setNotifications(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleOpenModal = (notification = null) => {
    if (notification) {
      setEditingNotification(notification)
      const date = notification.dateProgrammee?.toDate?.() ||
                   (notification.dateProgrammee ? new Date(notification.dateProgrammee) : null)

      setFormData({
        titre: notification.titre || '',
        message: notification.message || '',
        topic: notification.topic || NotificationTopic.TOUS,
        statut: notification.statut || NotificationStatut.PROGRAMMEE,
        dateProgrammee: date ? format(date, 'yyyy-MM-dd') : '',
        heureProgrammee: date ? format(date, 'HH:mm') : ''
      })
      setSendNow(false)
    } else {
      setEditingNotification(null)
      setFormData(defaultNotification)
      setSendNow(true)
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingNotification(null)
    setFormData(defaultNotification)
    setSendNow(true)
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
    if (!sendNow && (!formData.dateProgrammee || !formData.heureProgrammee)) {
      toast.error('La date et l\'heure sont requises pour une notification programmée')
      return
    }

    setSaving(true)
    try {
      let dateProgrammee = null
      let statut = NotificationStatut.PROGRAMMEE

      if (sendNow) {
        dateProgrammee = new Date()
        statut = NotificationStatut.ENVOYEE
      } else {
        dateProgrammee = new Date(`${formData.dateProgrammee}T${formData.heureProgrammee}`)
        if (!isFuture(dateProgrammee)) {
          toast.error('La date programmée doit être dans le futur')
          setSaving(false)
          return
        }
      }

      const data = {
        titre: formData.titre,
        message: formData.message,
        topic: formData.topic,
        statut,
        dateProgrammee
      }

      if (editingNotification) {
        await updateDocument('notifications', editingNotification.id, data)
        toast.success('Notification mise à jour')
      } else {
        await addDocument('notifications', data)
        toast.success(sendNow ? 'Notification envoyée' : 'Notification programmée')
      }
      handleCloseModal()
    } catch (err) {
      console.error('Error saving notification:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.notification) return

    try {
      await deleteDocument('notifications', deleteModal.notification.id)
      toast.success('Notification supprimée')
      setDeleteModal({ open: false, notification: null })
    } catch (err) {
      console.error('Error deleting notification:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleSendNow = async (notification) => {
    try {
      await updateDocument('notifications', notification.id, {
        statut: NotificationStatut.ENVOYEE,
        dateProgrammee: new Date()
      })
      toast.success('Notification envoyée')
    } catch (err) {
      console.error('Error sending notification:', err)
      toast.error('Erreur lors de l\'envoi')
    }
  }

  const getTopicLabel = (topic) => {
    return topicOptions.find(t => t.value === topic)?.label || topic
  }

  const columns = [
    {
      key: 'titre',
      label: 'Notification',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.titre}</p>
          <p className="text-sm text-white/50 line-clamp-1">{row.message}</p>
        </div>
      )
    },
    {
      key: 'topic',
      label: 'Cible',
      render: (row) => (
        <Badge variant="info">{getTopicLabel(row.topic)}</Badge>
      )
    },
    {
      key: 'dateProgrammee',
      label: 'Date',
      render: (row) => {
        if (!row.dateProgrammee) {
          return <span className="text-white/50">-</span>
        }
        try {
          const date = row.dateProgrammee?.toDate?.() || new Date(row.dateProgrammee)
          if (isNaN(date.getTime())) {
            return <span className="text-white/50">-</span>
          }
          return (
            <div>
              <p className="text-white">{format(date, 'd MMM yyyy', { locale: fr })}</p>
              <p className="text-sm text-white/50">{format(date, 'HH:mm')}</p>
            </div>
          )
        } catch (e) {
          return <span className="text-white/50">-</span>
        }
      }
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (row) => <StatusBadge status={row.statut} />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.statut === NotificationStatut.PROGRAMMEE && (
            <button
              onClick={() => handleSendNow(row)}
              className="p-2 hover:bg-green-500/10 rounded-lg transition-colors"
              title="Envoyer maintenant"
            >
              <Send className="w-4 h-4 text-green-400" />
            </button>
          )}
          <button
            onClick={() => handleOpenModal(row)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4 text-white/50" />
          </button>
          <button
            onClick={() => setDeleteModal({ open: true, notification: row })}
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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Total envoyées</p>
            <p className="text-2xl font-bold text-green-400">
              {notifications.filter(n => n.statut === NotificationStatut.ENVOYEE).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Programmées</p>
            <p className="text-2xl font-bold text-blue-400">
              {notifications.filter(n => n.statut === NotificationStatut.PROGRAMMEE).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Échouées</p>
            <p className="text-2xl font-bold text-red-400">
              {notifications.filter(n => n.statut === NotificationStatut.ECHOUEE).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-white/50">
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle notification
        </Button>
      </div>

      {/* Table */}
      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Aucune notification"
          description="Envoyez une notification push aux utilisateurs."
          action={() => handleOpenModal()}
          actionLabel="Envoyer une notification"
        />
      ) : (
        <Card>
          <Table columns={columns} data={notifications} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingNotification ? 'Modifier la notification' : 'Nouvelle notification'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Titre</label>
              <AIWriteButton
                type="notification"
                field="titre"
                existingContent={formData.titre}
                onGenerated={(content) => setFormData({ ...formData, titre: content })}
              />
            </div>
            <Input
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Ex: Rappel de prière"
              required
            />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Message</label>
              <AIWriteButton
                type="notification"
                field="message"
                existingTitle={formData.titre}
                existingContent={formData.message}
                onGenerated={(content) => setFormData({ ...formData, message: content })}
              />
            </div>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Contenu de la notification..."
              rows={3}
              required
            />
          </div>
          <Select
            label="Destinataires"
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            options={topicOptions}
          />

          {!editingNotification && (
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setSendNow(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    sendNow ? 'bg-secondary text-white' : 'bg-white/5 text-white/70'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  Envoyer maintenant
                </button>
                <button
                  onClick={() => setSendNow(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    !sendNow ? 'bg-secondary text-white' : 'bg-white/5 text-white/70'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Programmer
                </button>
              </div>

              {!sendNow && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Date"
                    type="date"
                    value={formData.dateProgrammee}
                    onChange={(e) => setFormData({ ...formData, dateProgrammee: e.target.value })}
                    required
                  />
                  <Input
                    label="Heure"
                    type="time"
                    value={formData.heureProgrammee}
                    onChange={(e) => setFormData({ ...formData, heureProgrammee: e.target.value })}
                    required
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleCloseModal}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editingNotification
              ? 'Mettre à jour'
              : sendNow
                ? 'Envoyer'
                : 'Programmer'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, notification: null })}
        onConfirm={handleDelete}
        title="Supprimer la notification"
        message={`Êtes-vous sûr de vouloir supprimer la notification "${deleteModal.notification?.titre}" ?`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
