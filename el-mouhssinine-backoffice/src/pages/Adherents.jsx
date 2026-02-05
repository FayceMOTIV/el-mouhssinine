import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-toastify'
import { Users, Plus, Pencil, Trash2, Search, Download, Mail, Phone, Eye, Calendar, MapPin, CreditCard, Settings2, CheckCircle2, XCircle, Clock, Banknote, Smartphone, Building2, FileText, AlertCircle, TrendingUp, UserCheck, UserX, PieChart, BarChart3, MessageCircle, ShieldCheck, Link2, Heart } from 'lucide-react'
import {
  Card,
  Button,
  Table,
  Modal,
  ConfirmModal,
  Input,
  Select,
  Toggle,
  Badge,
  StatusBadge,
  Loading,
  EmptyState
} from '../components/common'
import {
  subscribeToMembres,
  addDocument,
  updateDocument,
  deleteDocument,
  subscribeToPayments,
  getPaymentStats,
  PaymentType,
  subscribeToMessages
} from '../services/firebase'
import { CotisationType, CotisationStatut } from '../types'
import { format, addMonths, addYears, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'

// Helper: Détermine le statut de cotisation d'un membre (déplacé hors composant pour éviter re-renders)
const getCotisationStatus = (membre) => {
  if (membre.status === 'sympathisant') return CotisationStatut.SYMPATHISANT
  if (membre.status === 'en_attente_validation') return CotisationStatut.EN_ATTENTE_VALIDATION
  if (membre.status === 'en_attente_signature') return CotisationStatut.EN_ATTENTE_SIGNATURE
  if (membre.status === 'en_attente_paiement') return CotisationStatut.EN_ATTENTE_PAIEMENT
  if (membre.status === 'actif') return CotisationStatut.ACTIF
  if (!membre.cotisation?.dateFin) return CotisationStatut.AUCUN
  const dateFin = membre.cotisation.dateFin?.toDate?.() || new Date(membre.cotisation.dateFin)
  return isPast(dateFin) ? CotisationStatut.EXPIRE : CotisationStatut.ACTIF
}

// Helper: Obtient le nom du payeur
const getPayeurName = (membre) => {
  if (!membre.inscritPar) return 'Lui-même'
  if (typeof membre.inscritPar === 'object') {
    return `${membre.inscritPar.prenom || ''} ${membre.inscritPar.nom || ''}`.trim() || 'Tiers'
  }
  return 'Payé par tiers'
}

// Modes de paiement disponibles
const PAYMENT_MODES = {
  VIREMENT: { id: 'virement', label: 'Virement bancaire', icon: Building2, color: 'blue' },
  ESPECES: { id: 'especes', label: 'Espèces', icon: Banknote, color: 'green' },
  CHEQUE: { id: 'cheque', label: 'Chèque', icon: FileText, color: 'purple' },
  CB: { id: 'cb', label: 'Carte bancaire', icon: CreditCard, color: 'orange' },
  APPLE_PAY: { id: 'apple_pay', label: 'Apple Pay', icon: Smartphone, color: 'gray' },
  GOOGLE_PAY: { id: 'google_pay', label: 'Google Pay', icon: Smartphone, color: 'gray' },
}

// Paiements effectués depuis l'app (non modifiables)
const APP_PAYMENT_MODES = ['cb', 'apple_pay', 'google_pay', 'stripe']

const defaultMembre = {
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  adresse: '',
  genre: '', // obligatoire: 'homme' ou 'femme'
  cotisation: {
    type: CotisationType.ANNUEL,
    montant: 100,
    dateDebut: '',
    dateFin: ''
  },
  actif: true
}

const genreOptions = [
  { value: 'homme', label: 'Homme' },
  { value: 'femme', label: 'Femme' }
]

const cotisationOptions = [
  { value: CotisationType.MENSUEL, label: 'Mensuelle' },
  { value: CotisationType.ANNUEL, label: 'Annuelle' }
]

export default function Adherents() {
  const [membres, setMembres] = useState([])
  const [filteredMembres, setFilteredMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [payeurFilter, setPayeurFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, membre: null })
  const [cotisationModal, setCotisationModal] = useState({ open: false, membre: null })
  const [messageModal, setMessageModal] = useState({ open: false, membre: null, message: '' })
  const [editingMembre, setEditingMembre] = useState(null)
  const [formData, setFormData] = useState(defaultMembre)
  const [saving, setSaving] = useState(false)
  const [cotisationStats, setCotisationStats] = useState({
    today: { total: 0, count: 0 },
    month: { total: 0, count: 0 },
    year: { total: 0, count: 0 }
  })
  // Tracking des membres contactés par la mosquée
  const [membresContactes, setMembresContactes] = useState(new Set())

  useEffect(() => {
    const unsubscribe = subscribeToMembres((data) => {
      setMembres(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Récupérer les membres qui ont reçu un message de la mosquée
  useEffect(() => {
    const unsubscribe = subscribeToMessages((messages) => {
      const contactedIds = new Set()
      messages.forEach(msg => {
        // Messages créés par la mosquée = membre a été contacté
        if (msg.createdBy === 'mosquee' && msg.odUserId) {
          contactedIds.add(msg.odUserId)
        }
      })
      console.log('[Adherents] Messages mosquée trouvés:', contactedIds.size, 'membres contactés:', [...contactedIds])
      setMembresContactes(contactedIds)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToPayments((payments) => {
      const stats = getPaymentStats(payments, PaymentType.COTISATION)
      setCotisationStats(stats)
    })
    return () => unsubscribe()
  }, [])

  // Note: getCotisationStatus est défini au niveau module pour éviter les re-renders

  // Calcul des statistiques détaillées
  const stats = useMemo(() => {
    const total = membres.length
    if (total === 0) return null

    // Genre
    const hommes = membres.filter(m => m.genre === 'homme').length
    const femmes = membres.filter(m => m.genre === 'femme').length
    const genreNonRenseigne = total - hommes - femmes

    // Paiement
    const payes = membres.filter(m => m.aPaye || m.datePaiement).length
    const nonPayes = total - payes

    // Statut cotisation
    const sympathisants = membres.filter(m => getCotisationStatus(m) === CotisationStatut.SYMPATHISANT).length
    const actifs = membres.filter(m => getCotisationStatus(m) === CotisationStatut.ACTIF).length
    const attenteValidation = membres.filter(m => getCotisationStatus(m) === CotisationStatut.EN_ATTENTE_VALIDATION).length
    const attenteSignature = membres.filter(m => getCotisationStatus(m) === CotisationStatut.EN_ATTENTE_SIGNATURE).length
    const attentePaiement = membres.filter(m => getCotisationStatus(m) === CotisationStatut.EN_ATTENTE_PAIEMENT).length
    const expires = membres.filter(m => getCotisationStatus(m) === CotisationStatut.EXPIRE).length

    // Type de cotisation
    const mensuels = membres.filter(m => (m.cotisation?.type || m.formule) === 'mensuel').length
    const annuels = membres.filter(m => (m.cotisation?.type || m.formule) === 'annuel' || (!m.cotisation?.type && !m.formule)).length

    // Inscriptions récentes (ce mois)
    const now = new Date()
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1)
    const inscriptionsCeMois = membres.filter(m => {
      const createdAt = m.createdAt?.toDate?.() || (m.createdAt ? new Date(m.createdAt) : null)
      return createdAt && createdAt >= debutMois
    }).length

    // Total des cotisations collectées (membres actifs)
    const totalCollecte = membres
      .filter(m => getCotisationStatus(m) === CotisationStatut.ACTIF)
      .reduce((sum, m) => sum + (m.cotisation?.montant || 0), 0)

    return {
      total,
      hommes,
      femmes,
      genreNonRenseigne,
      hommesPercent: total > 0 ? Math.round((hommes / total) * 100) : 0,
      femmesPercent: total > 0 ? Math.round((femmes / total) * 100) : 0,
      payes,
      nonPayes,
      payesPercent: total > 0 ? Math.round((payes / total) * 100) : 0,
      sympathisants,
      actifs,
      attenteValidation,
      attenteSignature,
      attentePaiement,
      expires,
      mensuels,
      annuels,
      inscriptionsCeMois,
      totalCollecte
    }
  }, [membres])

  // Mettre à jour cotisationModal.membre quand membres change (temps réel)
  useEffect(() => {
    if (cotisationModal.open && cotisationModal.membre) {
      const updated = membres.find(m => m.id === cotisationModal.membre.id)
      if (updated) {
        setCotisationModal(prev => ({ ...prev, membre: updated }))
      }
    }
  }, [membres, cotisationModal.open, cotisationModal.membre?.id])

  // Note: getPayeurName est défini au niveau module pour éviter les re-renders

  useEffect(() => {
    let filtered = [...membres]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(m => {
        const payeurName = getPayeurName(m).toLowerCase()
        return (
          m.nom?.toLowerCase().includes(query) ||
          m.prenom?.toLowerCase().includes(query) ||
          m.email?.toLowerCase().includes(query) ||
          m.telephone?.includes(query) ||
          payeurName.includes(query)
        )
      })
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => getCotisationStatus(m) === statusFilter)
    }

    if (payeurFilter === 'lui-meme') {
      filtered = filtered.filter(m => !m.inscritPar)
    } else if (payeurFilter === 'tiers') {
      filtered = filtered.filter(m => !!m.inscritPar)
    }

    setFilteredMembres(filtered)
  }, [membres, searchQuery, statusFilter, payeurFilter]) // getCotisationStatus est maintenant module-scoped

  // ========== GESTION COTISATION (MODAL UNIQUE) ==========
  const handleCotisationUpdate = async (updates) => {
    if (!cotisationModal.membre) return

    setSaving(true)
    try {
      await updateDocument('members', cotisationModal.membre.id, updates)
      toast.success('Cotisation mise à jour')
    } catch (err) {
      console.error('Error updating cotisation:', err)
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const handleSetPaid = async (isPaid, paymentMode = null) => {
    const membre = cotisationModal.membre
    if (!membre) return

    const updates = {
      aPaye: isPaid,
    }

    if (isPaid) {
      const now = new Date()
      const type = membre.cotisation?.type || membre.formule || 'annuel'
      const dateFin = type === 'mensuel' ? addMonths(now, 1) : addYears(now, 1)

      updates.datePaiement = now
      updates.modePaiement = paymentMode || membre.modePaiement || 'especes'
      updates.cotisation = {
        ...membre.cotisation,
        dateDebut: now,
        dateFin: dateFin
      }

      // Mettre à jour le statut
      if (membre.aSigne) {
        updates.status = 'actif'
      } else {
        updates.status = 'en_attente_signature'
      }
    } else {
      updates.datePaiement = null
      updates.status = 'en_attente_paiement'
    }

    await handleCotisationUpdate(updates)
  }

  const handleSetSigned = async (isSigned) => {
    const membre = cotisationModal.membre
    if (!membre) return

    const updates = {
      aSigne: isSigned,
    }

    // Mettre à jour le statut
    const isPaid = membre.aPaye || membre.datePaiement
    if (isPaid && isSigned) {
      updates.status = 'actif'
    } else if (isPaid && !isSigned) {
      updates.status = 'en_attente_signature'
    } else {
      updates.status = 'en_attente_paiement'
    }

    await handleCotisationUpdate(updates)
  }

  const handlePaymentModeChange = async (mode) => {
    await handleCotisationUpdate({ modePaiement: mode })
  }

  // ========== VALIDATION BUREAU ==========
  const handleValidateAdhesion = async () => {
    const membre = cotisationModal.membre
    if (!membre) return

    setSaving(true)
    try {
      await updateDocument('members', membre.id, {
        status: 'actif',
        validatedAt: new Date(),
        validatedBy: 'bureau'
      })
      toast.success(`Adhésion de ${membre.prenom} ${membre.nom} validée !`)
    } catch (err) {
      console.error('Error validating adhesion:', err)
      toast.error('Erreur lors de la validation')
    } finally {
      setSaving(false)
    }
  }

  const handleRejectAdhesion = async () => {
    const membre = cotisationModal.membre
    if (!membre) return

    // Confirmation avant refus
    if (!window.confirm(`Êtes-vous sûr de vouloir refuser l'adhésion de ${membre.prenom} ${membre.nom} ?\n\nSon paiement de ${membre.cotisation?.montant || 0}€ sera converti en don.`)) {
      return
    }

    setSaving(true)
    try {
      // 1. Créer un don à partir du paiement
      const montant = membre.cotisation?.montant || 0
      if (montant > 0) {
        await addDocument('donations', {
          donateur: `${membre.prenom} ${membre.nom}`,
          email: membre.email || '',
          telephone: membre.telephone || '',
          montant: montant,
          projetId: null, // Don libre
          projetNom: 'Don libre',
          modePaiement: membre.modePaiement || 'autre',
          origine: 'conversion_adhesion_refusee',
          membreId: membre.id,
          eligibleRecuFiscal: true,
          date: new Date()
        })
      }

      // 2. Mettre à jour le membre en sympathisant
      await updateDocument('members', membre.id, {
        status: 'sympathisant',
        adhesionRefuseeAt: new Date(),
        adhesionRefuseeRaison: 'Décision du bureau',
        // Réinitialiser les infos de cotisation
        cotisation: {
          ...membre.cotisation,
          dateDebut: null,
          dateFin: null
        },
        aPaye: false,
        datePaiement: null
      })

      toast.success(`Adhésion refusée. Le paiement de ${montant}€ a été converti en don.`)
      setCotisationModal({ open: false, membre: null })
    } catch (err) {
      console.error('Error rejecting adhesion:', err)
      toast.error('Erreur lors du refus')
    } finally {
      setSaving(false)
    }
  }

  // Récupérer les membres liés (même paiementId)
  const getLinkedMembers = (membre) => {
    if (!membre?.paiementId) return []
    return membres.filter(m =>
      m.paiementId === membre.paiementId && m.id !== membre.id
    )
  }

  // ========== MESSAGE MEMBRE ==========
  const handleOpenMessageModal = (membre) => {
    const defaultMessage = `Bonjour ${membre.prenom},\n\nNous vous invitons à venir au bureau de la mosquée pour finaliser votre adhésion.\n\nCordialement,\nLe Bureau`
    setMessageModal({ open: true, membre, message: defaultMessage })
  }

  const handleSendMessage = async () => {
    if (!messageModal.membre || !messageModal.message.trim()) return

    setSaving(true)
    try {
      // Créer un message dans la collection messages
      await addDocument('messages', {
        sujet: 'Votre adhésion',
        message: messageModal.message,
        odUserId: messageModal.membre.uid || messageModal.membre.id,
        nomComplet: `${messageModal.membre.prenom} ${messageModal.membre.nom}`,
        email: messageModal.membre.email || '',
        telephone: messageModal.membre.telephone || '',
        status: 'non_lu',
        createdBy: 'mosquee',
        reponses: []
      })
      toast.success('Message envoyé avec succès')
      setMessageModal({ open: false, membre: null, message: '' })
    } catch (err) {
      console.error('Error sending message:', err)
      toast.error('Erreur lors de l\'envoi du message')
    } finally {
      setSaving(false)
    }
  }

  // ========== MODAL MEMBRE (INFOS PERSO) ==========
  const handleOpenModal = (membre = null) => {
    if (membre) {
      setEditingMembre(membre)
      const dateDebut = membre.cotisation?.dateDebut?.toDate?.() ||
                        (membre.cotisation?.dateDebut ? new Date(membre.cotisation.dateDebut) : null)
      const dateFin = membre.cotisation?.dateFin?.toDate?.() ||
                      (membre.cotisation?.dateFin ? new Date(membre.cotisation.dateFin) : null)

      setFormData({
        nom: membre.nom || '',
        prenom: membre.prenom || '',
        email: membre.email || '',
        telephone: membre.telephone || '',
        adresse: membre.adresse || '',
        genre: membre.genre || '',
        cotisation: {
          type: membre.cotisation?.type || CotisationType.ANNUEL,
          montant: membre.cotisation?.montant || 100,
          dateDebut: dateDebut ? format(dateDebut, 'yyyy-MM-dd') : '',
          dateFin: dateFin ? format(dateFin, 'yyyy-MM-dd') : ''
        },
        actif: membre.actif !== false
      })
    } else {
      setEditingMembre(null)
      setFormData(defaultMembre)
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingMembre(null)
    setFormData(defaultMembre)
  }

  const handleSave = async () => {
    if (!formData.nom.trim() || !formData.prenom.trim()) {
      toast.error('Le nom et prénom sont requis')
      return
    }
    if (!formData.genre) {
      toast.error('Le sexe est obligatoire')
      return
    }

    setSaving(true)
    try {
      const data = {
        ...formData,
        cotisation: {
          ...formData.cotisation,
          dateDebut: formData.cotisation.dateDebut ? new Date(formData.cotisation.dateDebut) : null,
          dateFin: formData.cotisation.dateFin ? new Date(formData.cotisation.dateFin) : null
        }
      }

      if (editingMembre) {
        await updateDocument('members', editingMembre.id, data)
        toast.success('Membre mis à jour')
      } else {
        await addDocument('members', data)
        toast.success('Membre créé')
      }
      handleCloseModal()
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.membre) return
    try {
      await deleteDocument('members', deleteModal.membre.id)
      toast.success('Membre supprimé')
      setDeleteModal({ open: false, membre: null })
    } catch (err) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case CotisationStatut.SYMPATHISANT: return 'Sympathisant'
      case CotisationStatut.ACTIF: return 'Actif'
      case CotisationStatut.EN_ATTENTE_VALIDATION: return 'Attente validation'
      case CotisationStatut.EN_ATTENTE_SIGNATURE: return 'Attente signature'
      case CotisationStatut.EN_ATTENTE_PAIEMENT: return 'Attente paiement'
      case CotisationStatut.EXPIRE: return 'Expiré'
      default: return 'Aucun'
    }
  }

  const exportCSV = () => {
    const headers = ['Nom', 'Prénom', 'Email', 'Téléphone', 'Statut', 'Type cotisation', 'Montant', 'Date fin']
    const rows = membres.map(m => [
      m.nom, m.prenom, m.email, m.telephone,
      getStatusLabel(getCotisationStatus(m)),
      m.cotisation?.type || '', m.cotisation?.montant || '',
      m.cotisation?.dateFin ? format(m.cotisation.dateFin?.toDate?.() || new Date(m.cotisation.dateFin), 'dd/MM/yyyy') : ''
    ])
    const BOM = '\uFEFF'
    const csv = BOM + [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `adherents_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    toast.success('Export téléchargé')
  }

  // ========== COLONNES TABLEAU SIMPLIFIÉ ==========
  const columns = [
    {
      key: 'nom',
      label: 'Membre',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.prenom} {row.nom}</p>
          <p className="text-sm text-white/50">{row.email || row.telephone || '-'}</p>
        </div>
      )
    },
    {
      key: 'cotisation',
      label: 'Cotisation',
      render: (row) => (
        <div>
          <p className="text-white capitalize">{row.cotisation?.type || 'Annuel'}</p>
          <p className="text-sm text-white/50">{row.cotisation?.montant || 100} €</p>
        </div>
      )
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (row) => {
        const status = getCotisationStatus(row)
        const config = {
          [CotisationStatut.SYMPATHISANT]: { bg: 'bg-pink-500/20', text: 'text-pink-400', icon: Heart },
          [CotisationStatut.ACTIF]: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle2 },
          [CotisationStatut.EN_ATTENTE_VALIDATION]: { bg: 'bg-violet-500/20', text: 'text-violet-400', icon: ShieldCheck },
          [CotisationStatut.EN_ATTENTE_SIGNATURE]: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Clock },
          [CotisationStatut.EN_ATTENTE_PAIEMENT]: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: CreditCard },
          [CotisationStatut.EXPIRE]: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
          [CotisationStatut.AUCUN]: { bg: 'bg-white/10', text: 'text-white/50', icon: AlertCircle },
        }
        const c = config[status] || config[CotisationStatut.AUCUN]
        const Icon = c.icon
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
            <Icon className="w-3.5 h-3.5" />
            {getStatusLabel(status)}
          </span>
        )
      }
    },
    {
      key: 'dateFin',
      label: 'Échéance',
      render: (row) => {
        if (!row.cotisation?.dateFin) return <span className="text-white/30">-</span>
        try {
          const date = row.cotisation.dateFin?.toDate?.() || new Date(row.cotisation.dateFin)
          return (
            <span className={isPast(date) ? 'text-red-400' : 'text-white/70'}>
              {format(date, 'dd/MM/yyyy')}
            </span>
          )
        } catch { return <span className="text-white/30">-</span> }
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          {/* Indicateur message envoyé */}
          {membresContactes.has(row.uid || row.id) && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 rounded-lg text-blue-400 text-xs" title="Message envoyé">
              <MessageCircle className="w-3 h-3" />
              Contacté
            </span>
          )}
          <button
            onClick={() => setCotisationModal({ open: true, membre: row })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 rounded-lg transition-colors text-secondary text-sm font-medium"
            title="Gérer la cotisation"
          >
            <Settings2 className="w-4 h-4" />
            Gérer
          </button>
          <button
            onClick={() => handleOpenModal(row)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Modifier les infos"
          >
            <Pencil className="w-4 h-4 text-white/50" />
          </button>
          <button
            onClick={() => setDeleteModal({ open: true, membre: row })}
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
    return <div className="flex items-center justify-center h-64"><Loading size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Stats principales */}
      {stats && (
        <>
          {/* Ligne 1 : Stats générales */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <Card>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-secondary" />
                </div>
                <p className="text-white/50 text-sm">Total membres</p>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-pink-400" />
                </div>
                <p className="text-white/50 text-sm">Sympathisants</p>
                <p className="text-3xl font-bold text-pink-400">{stats.sympathisants}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-white/50 text-sm">Actifs</p>
                <p className="text-3xl font-bold text-green-400">{stats.actifs}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-violet-400" />
                </div>
                <p className="text-white/50 text-sm">Att. validation</p>
                <p className="text-3xl font-bold text-violet-400">{stats.attenteValidation}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-white/50 text-sm">Att. signature</p>
                <p className="text-3xl font-bold text-amber-400">{stats.attenteSignature}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-white/50 text-sm">Att. paiement</p>
                <p className="text-3xl font-bold text-blue-400">{stats.attentePaiement}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <UserX className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-white/50 text-sm">Expirés</p>
                <p className="text-3xl font-bold text-red-400">{stats.expires}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-white/50 text-sm">Ce mois</p>
                <p className="text-3xl font-bold text-purple-400">+{stats.inscriptionsCeMois}</p>
              </div>
            </Card>
          </div>

          {/* Ligne 2 : Répartitions visuelles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Répartition Homme/Femme */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-secondary" />
                <h3 className="text-white font-semibold">Répartition par sexe</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blue-400">Hommes</span>
                    <span className="text-white">{stats.hommes} ({stats.hommesPercent}%)</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                      style={{ width: `${stats.hommesPercent}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-pink-400">Femmes</span>
                    <span className="text-white">{stats.femmes} ({stats.femmesPercent}%)</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-pink-400 rounded-full transition-all duration-500"
                      style={{ width: `${stats.femmesPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Répartition Payé/Non payé */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-secondary" />
                <h3 className="text-white font-semibold">État des paiements</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="url(#greenGradient)"
                      strokeWidth="3"
                      strokeDasharray={`${stats.payesPercent}, 100`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#4ade80" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-white">{stats.payesPercent}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-white/70 text-sm">Payés</span>
                    </div>
                    <span className="text-green-400 font-semibold">{stats.payes}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-white/70 text-sm">Non payés</span>
                    </div>
                    <span className="text-red-400 font-semibold">{stats.nonPayes}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Type de cotisation + Revenus */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Banknote className="w-5 h-5 text-secondary" />
                <h3 className="text-white font-semibold">Cotisations</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span className="text-white/70">Mensuelles</span>
                  </div>
                  <span className="text-amber-400 font-semibold">{stats.mensuels}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="text-white/70">Annuelles</span>
                  </div>
                  <span className="text-blue-400 font-semibold">{stats.annuels}</span>
                </div>
                <div className="pt-3 border-t border-white/10">
                  <p className="text-white/50 text-xs uppercase mb-1">Total collecté (actifs)</p>
                  <p className="text-2xl font-bold text-green-400">{stats.totalCollecte.toLocaleString('fr-FR')} €</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-secondary"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-secondary">
            <option value="all">Tous les statuts</option>
            <option value={CotisationStatut.SYMPATHISANT}>Sympathisant</option>
            <option value={CotisationStatut.ACTIF}>Actif</option>
            <option value={CotisationStatut.EN_ATTENTE_VALIDATION}>Attente validation</option>
            <option value={CotisationStatut.EN_ATTENTE_SIGNATURE}>Attente signature</option>
            <option value={CotisationStatut.EN_ATTENTE_PAIEMENT}>Attente paiement</option>
            <option value={CotisationStatut.EXPIRE}>Expiré</option>
          </select>
          <select value={payeurFilter} onChange={(e) => setPayeurFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-secondary">
            <option value="all">Tous les payeurs</option>
            <option value="lui-meme">Payé par lui-même</option>
            <option value="tiers">Payé par tiers</option>
          </select>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={exportCSV}><Download className="w-4 h-4 mr-2" />Export</Button>
          <Button onClick={() => handleOpenModal()}><Plus className="w-4 h-4 mr-2" />Nouveau</Button>
        </div>
      </div>

      {/* Table */}
      {filteredMembres.length === 0 ? (
        <EmptyState icon={Users} title="Aucun membre" description="Ajoutez votre premier membre." action={() => handleOpenModal()} actionLabel="Ajouter" />
      ) : (
        <Card><Table columns={columns} data={filteredMembres} /></Card>
      )}

      {/* ========== MODAL GESTION COTISATION ========== */}
      <Modal
        isOpen={cotisationModal.open}
        onClose={() => setCotisationModal({ open: false, membre: null })}
        title="Gestion de la cotisation"
        size="lg"
      >
        {cotisationModal.membre && (() => {
          const m = cotisationModal.membre
          const isPaidFromApp = m.modePaiement && APP_PAYMENT_MODES.includes(m.modePaiement.toLowerCase())
          const isPaid = m.aPaye || m.datePaiement
          const isSigned = m.aSigne
          const status = getCotisationStatus(m)
          const linkedMembers = getLinkedMembers(m)
          const isAwaitingValidation = status === CotisationStatut.EN_ATTENTE_VALIDATION

          return (
            <div className="space-y-6">
              {/* En-tête membre */}
              <div className="flex items-center gap-4 pb-4 border-b border-white/10">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                  <span className="text-white text-xl font-bold">
                    {m.prenom?.[0]}{m.nom?.[0]}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-white">{m.prenom} {m.nom}</h3>
                    {membresContactes.has(m.uid || m.id) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded text-blue-400 text-xs">
                        <MessageCircle className="w-3 h-3" />
                        Déjà contacté
                      </span>
                    )}
                  </div>
                  <p className="text-white/50">{m.email || m.telephone}</p>
                  {m.telephone && m.email && (
                    <p className="text-white/40 text-sm">{m.telephone}</p>
                  )}
                </div>
                <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                  status === CotisationStatut.SYMPATHISANT ? 'bg-pink-500/20 text-pink-400' :
                  status === CotisationStatut.ACTIF ? 'bg-green-500/20 text-green-400' :
                  status === CotisationStatut.EN_ATTENTE_VALIDATION ? 'bg-violet-500/20 text-violet-400' :
                  status === CotisationStatut.EN_ATTENTE_SIGNATURE ? 'bg-amber-500/20 text-amber-400' :
                  status === CotisationStatut.EN_ATTENTE_PAIEMENT ? 'bg-blue-500/20 text-blue-400' :
                  status === CotisationStatut.EXPIRE ? 'bg-red-500/20 text-red-400' :
                  'bg-white/10 text-white/50'
                }`}>
                  {getStatusLabel(status)}
                </div>
              </div>

              {/* ===== ALERTE VALIDATION BUREAU ===== */}
              {isAwaitingValidation && (
                <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <ShieldCheck className="w-6 h-6 text-violet-400" />
                    <div>
                      <p className="text-violet-400 font-semibold">En attente de validation</p>
                      <p className="text-white/60 text-sm">Ce membre a payé sa cotisation. Validez son adhésion, refusez-la (conversion en don), ou demandez-lui de passer au bureau.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleValidateAdhesion}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Valider
                    </button>
                    <button
                      onClick={handleRejectAdhesion}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5" />
                      Refuser
                    </button>
                    <button
                      onClick={() => handleOpenMessageModal(m)}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Message
                    </button>
                  </div>
                  <p className="text-white/40 text-xs mt-3">
                    En cas de refus, le paiement de {m.cotisation?.montant || 0}€ sera converti en don (éligible au reçu fiscal).
                  </p>
                </div>
              )}

              {/* Infos cotisation */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 rounded-xl">
                <div className="text-center">
                  <p className="text-white/40 text-xs uppercase mb-1">Type</p>
                  <p className="text-white font-medium capitalize">{m.cotisation?.type || 'Annuel'}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/40 text-xs uppercase mb-1">Montant</p>
                  <p className="text-white font-medium">{m.cotisation?.montant || 100} €</p>
                </div>
                <div className="text-center">
                  <p className="text-white/40 text-xs uppercase mb-1">Échéance</p>
                  <p className={`font-medium ${m.cotisation?.dateFin && isPast(m.cotisation.dateFin?.toDate?.() || new Date(m.cotisation.dateFin)) ? 'text-red-400' : 'text-white'}`}>
                    {m.cotisation?.dateFin ? format(m.cotisation.dateFin?.toDate?.() || new Date(m.cotisation.dateFin), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
              </div>

              {/* ===== SECTION PAIEMENT ===== */}
              <div className="space-y-4">
                <h4 className="text-white font-medium flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-secondary" />
                  Paiement
                </h4>

                {/* Alerte si payé depuis l'app */}
                {isPaidFromApp && (
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <Smartphone className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="text-green-400 font-medium">Payé depuis l'application</p>
                      <p className="text-white/60 text-sm">
                        Mode: {m.modePaiement} • {m.datePaiement ? format(m.datePaiement?.toDate?.() || new Date(m.datePaiement), 'dd/MM/yyyy') : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Toggle Payé / Non payé */}
                {!isPaidFromApp && (
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      {isPaid ? (
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-red-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-white font-medium">{isPaid ? 'Payé' : 'Non payé'}</p>
                        {isPaid && m.datePaiement && (
                          <p className="text-white/50 text-sm">
                            Le {format(m.datePaiement?.toDate?.() || new Date(m.datePaiement), 'dd/MM/yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSetPaid(!isPaid, isPaid ? null : 'especes')}
                      disabled={saving}
                      className={`relative w-14 h-8 rounded-full transition-colors ${isPaid ? 'bg-green-500' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${isPaid ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                )}

                {/* Mode de paiement */}
                {isPaid && !isPaidFromApp && (
                  <div className="space-y-3">
                    <p className="text-white/60 text-sm">Mode de paiement</p>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.values(PAYMENT_MODES).filter(p => !APP_PAYMENT_MODES.includes(p.id)).map(mode => {
                        const Icon = mode.icon
                        const isSelected = m.modePaiement === mode.id
                        return (
                          <button
                            key={mode.id}
                            onClick={() => handlePaymentModeChange(mode.id)}
                            disabled={saving}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                              isSelected
                                ? 'border-secondary bg-secondary/10'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${isSelected ? 'text-secondary' : 'text-white/50'}`} />
                            <span className={`text-xs font-medium ${isSelected ? 'text-secondary' : 'text-white/70'}`}>
                              {mode.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Référence virement */}
                {m.referenceVirement && (
                  <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg">
                    <Building2 className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-white/50 text-xs">Référence virement</p>
                      <p className="text-blue-400 font-mono font-medium">{m.referenceVirement}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== SECTION SIGNATURE ===== */}
              <div className="space-y-4">
                <h4 className="text-white font-medium flex items-center gap-2">
                  <FileText className="w-5 h-5 text-secondary" />
                  Règlement intérieur
                </h4>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    {isSigned ? (
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{isSigned ? 'Règlement signé' : 'En attente de signature'}</p>
                      {!isSigned && m.inscritPar && (
                        <p className="text-white/50 text-sm">Doit passer au bureau</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSetSigned(!isSigned)}
                    disabled={saving}
                    className={`relative w-14 h-8 rounded-full transition-colors ${isSigned ? 'bg-green-500' : 'bg-white/20'}`}
                  >
                    <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${isSigned ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              {/* ===== MEMBRES LIÉS (même paiementId) ===== */}
              {linkedMembers.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-secondary" />
                    Membres liés ({linkedMembers.length})
                  </h4>
                  <div className="space-y-2">
                    {linkedMembers.map(linked => {
                      const linkedStatus = getCotisationStatus(linked)
                      return (
                        <div
                          key={linked.id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                          onClick={() => setCotisationModal({ open: true, membre: linked })}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                              <span className="text-white text-sm font-medium">
                                {linked.prenom?.[0]}{linked.nom?.[0]}
                              </span>
                            </div>
                            <div>
                              <p className="text-white font-medium">{linked.prenom} {linked.nom}</p>
                              <p className="text-white/50 text-sm">{linked.telephone || linked.email}</p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            linkedStatus === CotisationStatut.SYMPATHISANT ? 'bg-pink-500/20 text-pink-400' :
                            linkedStatus === CotisationStatut.ACTIF ? 'bg-green-500/20 text-green-400' :
                            linkedStatus === CotisationStatut.EN_ATTENTE_VALIDATION ? 'bg-violet-500/20 text-violet-400' :
                            linkedStatus === CotisationStatut.EN_ATTENTE_SIGNATURE ? 'bg-amber-500/20 text-amber-400' :
                            linkedStatus === CotisationStatut.EN_ATTENTE_PAIEMENT ? 'bg-blue-500/20 text-blue-400' :
                            'bg-white/10 text-white/50'
                          }`}>
                            {getStatusLabel(linkedStatus)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-white/40 text-xs">Ces membres ont été inscrits avec le même paiement</p>
                </div>
              )}

              {/* Récapitulatif du statut */}
              {!isAwaitingValidation && (
                <div className="p-4 bg-gradient-to-r from-secondary/10 to-primary/10 rounded-xl border border-secondary/20">
                  <p className="text-white/60 text-sm mb-2">Le statut est calculé automatiquement :</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`flex items-center gap-1 ${isPaid ? 'text-green-400' : 'text-white/40'}`}>
                      {isPaid ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      Payé
                    </span>
                    <span className="text-white/20">+</span>
                    <span className={`flex items-center gap-1 ${isSigned ? 'text-green-400' : 'text-white/40'}`}>
                      {isSigned ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      Signé
                    </span>
                    <span className="text-white/20">=</span>
                    <span className={`font-semibold ${
                      isPaid && isSigned ? 'text-green-400' :
                      isPaid && !isSigned ? 'text-amber-400' :
                      'text-blue-400'
                    }`}>
                      {isPaid && isSigned ? '✅ Actif' :
                       isPaid && !isSigned ? '⏳ Attente signature' :
                       '💳 Attente paiement'}
                    </span>
                  </div>
                </div>
              )}

              {/* Boutons action + fermer */}
              <div className="flex justify-between pt-4 border-t border-white/10">
                {!isAwaitingValidation && (
                  <button
                    onClick={() => handleOpenMessageModal(m)}
                    className="flex items-center gap-2 px-4 py-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Envoyer un message
                  </button>
                )}
                <div className={!isAwaitingValidation ? '' : 'ml-auto'}>
                  <Button variant="ghost" onClick={() => setCotisationModal({ open: false, membre: null })}>
                    Fermer
                  </Button>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ========== MODAL MESSAGE ========== */}
      <Modal
        isOpen={messageModal.open}
        onClose={() => setMessageModal({ open: false, membre: null, message: '' })}
        title="Envoyer un message"
        size="md"
      >
        {messageModal.membre && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {messageModal.membre.prenom?.[0]}{messageModal.membre.nom?.[0]}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{messageModal.membre.prenom} {messageModal.membre.nom}</p>
                <p className="text-white/50 text-sm">{messageModal.membre.email || messageModal.membre.telephone}</p>
              </div>
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Message</label>
              <textarea
                value={messageModal.message}
                onChange={(e) => setMessageModal({ ...messageModal, message: e.target.value })}
                rows={6}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/30 focus:outline-none focus:border-secondary resize-none"
                placeholder="Votre message..."
              />
            </div>

            <p className="text-white/40 text-xs">
              Ce message sera visible dans l'application du membre, dans la section Messages.
            </p>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setMessageModal({ open: false, membre: null, message: '' })}>
                Annuler
              </Button>
              <Button onClick={handleSendMessage} loading={saving} disabled={!messageModal.message.trim()}>
                <Mail className="w-4 h-4 mr-2" />
                Envoyer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal infos perso */}
      <Modal isOpen={modalOpen} onClose={handleCloseModal} title={editingMembre ? 'Modifier le membre' : 'Nouveau membre'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required />
            <Input label="Prénom" value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <Input label="Téléphone" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Adresse" value={formData.adresse} onChange={(e) => setFormData({ ...formData, adresse: e.target.value })} />
            <Select label="Sexe *" value={formData.genre} onChange={(e) => setFormData({ ...formData, genre: e.target.value })} options={genreOptions} placeholder="Sélectionner" />
          </div>

          <div className="border-t border-white/10 pt-4">
            <h4 className="text-white font-medium mb-4">Cotisation</h4>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Type" value={formData.cotisation.type} onChange={(e) => setFormData({ ...formData, cotisation: { ...formData.cotisation, type: e.target.value }})} options={cotisationOptions} />
              <Input label="Montant (€)" type="number" value={formData.cotisation.montant} onChange={(e) => setFormData({ ...formData, cotisation: { ...formData.cotisation, montant: parseFloat(e.target.value) || 0 }})} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleCloseModal}>Annuler</Button>
          <Button onClick={handleSave} loading={saving}>{editingMembre ? 'Mettre à jour' : 'Créer'}</Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, membre: null })}
        onConfirm={handleDelete}
        title="Supprimer le membre"
        message={`Êtes-vous sûr de vouloir supprimer ${deleteModal.membre?.prenom} ${deleteModal.membre?.nom} ?`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
