import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-toastify'
import { MessageCircle, Send, Check, Clock, CheckCircle, Eye, Archive, Phone, Trash2, Search } from 'lucide-react'
import {
  Card,
  Button,
  Table,
  Modal,
  ConfirmModal,
  Badge,
  Loading,
  EmptyState,
  Textarea,
  Select
} from '../components/common'
import AIWriteButton from '../components/common/AIWriteButton'
import {
  subscribeToMessages,
  updateMessageStatus,
  replyToMessage,
  deleteMessage,
  MessageStatus,
  MESSAGE_SUBJECTS
} from '../services/firebase'
import { format, isAfter, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

const statusOptions = [
  { value: MessageStatus.NON_LU, label: 'Non lu', color: 'bg-red-500/20 text-red-400' },
  { value: MessageStatus.EN_COURS, label: 'En cours', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: MessageStatus.RESOLU, label: 'Résolu', color: 'bg-green-500/20 text-green-400' }
]

// Options de sujets pour le filtre
const sujetOptions = [
  { value: 'all', label: 'Tous les sujets' },
  ...Object.entries(MESSAGE_SUBJECTS || {}).map(([key, value]) => ({
    value: value,
    label: value
  }))
]

// Options de période pour le filtre
const periodeOptions = [
  { value: 'all', label: 'Toutes les dates' },
  { value: '7', label: '7 derniers jours' },
  { value: '30', label: '30 derniers jours' },
  { value: 'archived', label: 'Archivés (+30 jours)' }
]

export default function Messages() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSujet, setFilterSujet] = useState('all')
  const [filterPeriode, setFilterPeriode] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteModal, setDeleteModal] = useState({ open: false, message: null })

  useEffect(() => {
    const unsubscribe = subscribeToMessages((data) => {
      setMessages(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Séparer messages actifs et archivés (+ de 30 jours)
  const { activeMessages, archivedMessages } = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30)
    const active = []
    const archived = []

    messages.forEach(msg => {
      const msgDate = msg.createdAt?.toDate?.() || new Date(msg.createdAt)
      if (isAfter(msgDate, thirtyDaysAgo)) {
        active.push(msg)
      } else {
        archived.push(msg)
      }
    })

    return { activeMessages: active, archivedMessages: archived }
  }, [messages])

  // Mettre à jour selectedMessage quand messages change (pour voir les nouvelles réponses)
  useEffect(() => {
    if (selectedMessage && messages.length > 0) {
      const updatedMessage = messages.find(m => m.id === selectedMessage.id)
      if (updatedMessage) {
        setSelectedMessage(updatedMessage)
      }
    }
  }, [messages])

  const handleOpenMessage = async (message) => {
    setSelectedMessage(message)
    setModalOpen(true)
    setReplyText('')

    // Marquer comme "en cours" si c'était "non lu"
    if (message.status === MessageStatus.NON_LU) {
      try {
        await updateMessageStatus(message.id, MessageStatus.EN_COURS)
      } catch (err) {
        console.error('Error updating status:', err)
      }
    }
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedMessage(null)
    setReplyText('')
  }

  const handleReply = async () => {
    if (!replyText.trim()) {
      toast.error('Veuillez saisir une réponse')
      return
    }

    setSending(true)
    try {
      await replyToMessage(selectedMessage.id, replyText.trim(), 'Admin')
      setReplyText('')
      toast.success('Réponse envoyée')
    } catch (err) {
      console.error('Error sending reply:', err)
      toast.error('Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (messageId, newStatus) => {
    try {
      await updateMessageStatus(messageId, newStatus)
      toast.success('Statut mis à jour')
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const handleDeleteMessage = async () => {
    if (!deleteModal.message) return
    try {
      await deleteMessage(deleteModal.message.id)
      toast.success('Message supprimé')
      setDeleteModal({ open: false, message: null })
      // Fermer la modal de détail si c'est le même message
      if (selectedMessage?.id === deleteModal.message.id) {
        handleCloseModal()
      }
    } catch (err) {
      console.error('Error deleting message:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return '-'
    try {
      const date = timestamp?.toDate?.() || new Date(timestamp)
      if (isNaN(date.getTime())) return '-'
      return format(date, 'd MMM yyyy HH:mm', { locale: fr })
    } catch (e) {
      return '-'
    }
  }

  const getStatusBadge = (status) => {
    const config = statusOptions.find(s => s.value === status) || statusOptions[0]
    return <Badge className={config.color}>{config.label}</Badge>
  }

  // Appliquer tous les filtres
  const filteredMessages = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30)
    const sevenDaysAgo = subDays(new Date(), 7)

    return messages.filter(m => {
      // Filtre par recherche textuelle
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          m.userName?.toLowerCase().includes(query) ||
          m.userEmail?.toLowerCase().includes(query) ||
          m.userPhone?.includes(query) ||
          m.sujet?.toLowerCase().includes(query) ||
          m.message?.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Filtre par statut
      if (filterStatus !== 'all' && m.status !== filterStatus) return false

      // Filtre par sujet
      if (filterSujet !== 'all' && m.sujet !== filterSujet) return false

      // Filtre par période
      if (filterPeriode !== 'all') {
        const msgDate = m.createdAt?.toDate?.() || new Date(m.createdAt)
        if (filterPeriode === '7' && !isAfter(msgDate, sevenDaysAgo)) return false
        if (filterPeriode === '30' && !isAfter(msgDate, thirtyDaysAgo)) return false
        if (filterPeriode === 'archived' && isAfter(msgDate, thirtyDaysAgo)) return false
      }

      return true
    })
  }, [messages, filterStatus, filterSujet, filterPeriode, searchQuery])

  const columns = [
    {
      key: 'user',
      label: 'Expéditeur',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.userName || 'Inconnu'}</p>
          <p className="text-sm text-white/50">{row.userEmail || '-'}</p>
        </div>
      )
    },
    {
      key: 'sujet',
      label: 'Sujet',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.sujet}</p>
          <p className="text-sm text-white/50 line-clamp-1">{row.message}</p>
        </div>
      )
    },
    {
      key: 'date',
      label: 'Date',
      render: (row) => (
        <span className="text-white/70">{formatDate(row.createdAt)}</span>
      )
    },
    {
      key: 'reponses',
      label: 'Réponses',
      render: (row) => (
        <span className="text-white/70">
          {row.reponses?.length || 0}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Statut',
      render: (row) => (
        <select
          value={row.status}
          onChange={(e) => handleStatusChange(row.id, e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white"
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenMessage(row)}
            className="p-2 hover:bg-secondary/20 rounded-lg transition-colors"
            title="Voir / Répondre"
          >
            <Eye className="w-4 h-4 text-secondary" />
          </button>
          <button
            onClick={() => setDeleteModal({ open: true, message: row })}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
          {row.status !== MessageStatus.RESOLU && (
            <button
              onClick={() => handleStatusChange(row.id, MessageStatus.RESOLU)}
              className="p-2 hover:bg-green-500/10 rounded-lg transition-colors"
              title="Marquer comme résolu"
            >
              <CheckCircle className="w-4 h-4 text-green-400" />
            </button>
          )}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Total</p>
            <p className="text-2xl font-bold text-white">{messages.length}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Non lus</p>
            <p className="text-2xl font-bold text-red-400">
              {messages.filter(m => m.status === MessageStatus.NON_LU).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">En cours</p>
            <p className="text-2xl font-bold text-yellow-400">
              {messages.filter(m => m.status === MessageStatus.EN_COURS).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Résolus</p>
            <p className="text-2xl font-bold text-green-400">
              {messages.filter(m => m.status === MessageStatus.RESOLU).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Filtre Statut */}
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">Statut:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">Tous</option>
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Filtre Sujet */}
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">Sujet:</span>
            <select
              value={filterSujet}
              onChange={(e) => setFilterSujet(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              {sujetOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Filtre Période */}
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">Période:</span>
            <select
              value={filterPeriode}
              onChange={(e) => setFilterPeriode(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              {periodeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {archivedMessages.length > 0 && filterPeriode !== 'archived' && (
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Archive className="w-3 h-3" />
              {archivedMessages.length} archivé{archivedMessages.length > 1 ? 's' : ''}
            </span>
          )}
          <p className="text-white/50">
            {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Table */}
      {messages.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Aucun message"
          description="Les messages des membres apparaîtront ici."
        />
      ) : filteredMessages.length === 0 ? (
        <Card>
          <p className="text-center text-white/50 py-8">
            Aucun message avec ce statut
          </p>
        </Card>
      ) : (
        <Card>
          <Table columns={columns} data={filteredMessages} />
        </Card>
      )}

      {/* Modal détail message */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title="Détail du message"
        size="lg"
      >
        {selectedMessage && (
          <div className="space-y-4">
            {/* En-tête */}
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium text-white">{selectedMessage.userName}</p>
                  <p className="text-sm text-white/50">{selectedMessage.userEmail}</p>
                  {selectedMessage.userPhone && (
                    <a
                      href={`tel:${selectedMessage.userPhone}`}
                      className="text-sm text-secondary hover:text-secondary/80 flex items-center gap-1 mt-1"
                    >
                      <Phone className="w-3 h-3" />
                      {selectedMessage.userPhone}
                    </a>
                  )}
                </div>
                {getStatusBadge(selectedMessage.status)}
              </div>
              <p className="text-sm text-white/50">{formatDate(selectedMessage.createdAt)}</p>
            </div>

            {/* Sujet */}
            <div>
              <p className="text-sm text-white/50 mb-1">Sujet</p>
              <p className="text-white font-medium">{selectedMessage.sujet}</p>
            </div>

            {/* Message original */}
            <div>
              <p className="text-sm text-white/50 mb-1">Message</p>
              <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-4">
                <p className="text-white whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>
            </div>

            {/* Historique des réponses */}
            {selectedMessage.reponses && selectedMessage.reponses.length > 0 && (
              <div>
                <p className="text-sm text-white/50 mb-2">Conversation</p>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedMessage.reponses.map((rep, index) => (
                    <div
                      key={rep.id || index}
                      className={`p-3 rounded-lg ${
                        rep.createdBy === 'mosquee'
                          ? 'bg-green-500/10 border border-green-500/30 ml-4'
                          : 'bg-white/5 border border-white/10 mr-4'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${
                          rep.createdBy === 'mosquee' ? 'text-green-400' : 'text-secondary'
                        }`}>
                          {rep.createdBy === 'mosquee' ? '🕌 Mosquée' : '👤 Utilisateur'}
                        </span>
                        <span className="text-xs text-white/40">
                          {formatDate(rep.createdAt)}
                        </span>
                      </div>
                      <p className="text-white text-sm whitespace-pre-wrap">{rep.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Zone de réponse (si pas résolu) */}
            {selectedMessage.status !== MessageStatus.RESOLU && (
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-white/50">Répondre</p>
                  <AIWriteButton
                    type="general"
                    field="message"
                    existingContent={replyText}
                    onGenerated={(text) => setReplyText(text)}
                  />
                </div>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Saisissez votre réponse..."
                  rows={3}
                />
                <div className="flex justify-end gap-3 mt-3">
                  <Button
                    variant="ghost"
                    onClick={() => handleStatusChange(selectedMessage.id, MessageStatus.RESOLU)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marquer résolu
                  </Button>
                  <Button onClick={handleReply} loading={sending}>
                    <Send className="w-4 h-4 mr-2" />
                    Envoyer
                  </Button>
                </div>
              </div>
            )}

            {/* Si résolu */}
            {selectedMessage.status === MessageStatus.RESOLU && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">Cette demande a été résolue</p>
                <button
                  onClick={() => handleStatusChange(selectedMessage.id, MessageStatus.EN_COURS)}
                  className="text-sm text-white/50 hover:text-white mt-2 underline"
                >
                  Réouvrir la conversation
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-between mt-6">
          <Button
            variant="ghost"
            className="text-red-400 hover:bg-red-500/10"
            onClick={() => {
              handleCloseModal()
              setDeleteModal({ open: true, message: selectedMessage })
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer
          </Button>
          <Button variant="ghost" onClick={handleCloseModal}>
            Fermer
          </Button>
        </div>
      </Modal>

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, message: null })}
        onConfirm={handleDeleteMessage}
        title="Supprimer ce message ?"
        message={`Êtes-vous sûr de vouloir supprimer le message de "${deleteModal.message?.userName || 'cet utilisateur'}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
