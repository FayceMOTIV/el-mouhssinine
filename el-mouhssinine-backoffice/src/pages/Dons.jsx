import { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from 'react-toastify'
import {
  Coins, Plus, Pencil, Trash2, FileText, Upload, X, Download, File, Image as ImageIcon, Search, RefreshCw
} from 'lucide-react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import AIWriteButton from '../components/common/AIWriteButton'
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
  ProgressBar
} from '../components/common'
import {
  subscribeToProjets,
  subscribeToDons,
  addDocument,
  updateDocument,
  deleteDocument,
  uploadProjetFile,
  deleteProjetFile
} from '../services/firebase'
import { CategorieProjet, ModePaiement, ALLOWED_FILE_TYPES, MAX_FILE_SIZE_MB } from '../types'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const defaultProjet = {
  titre: '',
  description: '',
  objectif: '',
  montantActuel: 0,
  categorie: CategorieProjet.INTERNE,
  actif: true,
  fichiers: [],
  iban: '',
  lieu: ''
}

// Validation basique du format IBAN
// FR76 1234 5678 9012 3456 7890 123 (27 chars pour France)
// Supporte les IBAN internationaux de 15 à 34 caractères
const validateIBAN = (iban) => {
  if (!iban) return { valid: false, error: 'IBAN requis' }

  // Nettoyer l'IBAN (retirer espaces et mettre en majuscules)
  const cleanIban = iban.replace(/\s/g, '').toUpperCase()

  // Vérifier la longueur (15 à 34 caractères selon le pays)
  if (cleanIban.length < 15 || cleanIban.length > 34) {
    return { valid: false, error: 'Format IBAN invalide (15-34 caractères)' }
  }

  // Vérifier que ça commence par 2 lettres (code pays)
  if (!/^[A-Z]{2}/.test(cleanIban)) {
    return { valid: false, error: 'L\'IBAN doit commencer par un code pays (ex: FR, DE, ES)' }
  }

  // Vérifier que les 2 caractères suivants sont des chiffres (clé de contrôle)
  if (!/^[A-Z]{2}[0-9]{2}/.test(cleanIban)) {
    return { valid: false, error: 'Clé de contrôle IBAN invalide (2 chiffres après le code pays)' }
  }

  // Vérifier que le reste ne contient que des caractères alphanumériques
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleanIban)) {
    return { valid: false, error: 'L\'IBAN ne doit contenir que des lettres et chiffres' }
  }

  return { valid: true, error: null }
}

const categorieOptions = [
  { value: CategorieProjet.INTERNE, label: 'Projet interne' },
  { value: CategorieProjet.EXTERNE, label: 'Projet externe' }
]

export default function Dons() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('projets')
  const [projets, setProjets] = useState([])
  const [dons, setDons] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, item: null, type: null })
  const [editingProjet, setEditingProjet] = useState(null)
  const [formData, setFormData] = useState(defaultProjet)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const DONS_PER_PAGE = 20
  const [refundingDon, setRefundingDon] = useState(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDonationModal, setRefundDonationModal] = useState({ open: false, donationId: null, amount: null, totalAmount: 0 })

  // Filtrer les projets par recherche
  const filteredProjets = useMemo(() => {
    if (!searchQuery) return projets
    const query = searchQuery.toLowerCase()
    return projets.filter(p =>
      p.titre?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.lieu?.toLowerCase().includes(query)
    )
  }, [projets, searchQuery])

  // Filtrer les dons par recherche
  const filteredDons = useMemo(() => {
    if (!searchQuery) return dons
    const query = searchQuery.toLowerCase()
    return dons.filter(d => {
      const projet = projets.find(p => p.id === d.projetId)
      return (
        d.donateur?.toLowerCase().includes(query) ||
        projet?.titre?.toLowerCase().includes(query) ||
        d.modePaiement?.toLowerCase().includes(query)
      )
    })
  }, [dons, projets, searchQuery])

  // Réinitialiser la page quand le filtre change
  useEffect(() => { setCurrentPage(1) }, [searchQuery])

  // Pagination des dons
  const totalPages = Math.ceil(filteredDons.length / DONS_PER_PAGE)
  const paginatedDons = useMemo(() => {
    const start = (currentPage - 1) * DONS_PER_PAGE
    return filteredDons.slice(start, start + DONS_PER_PAGE)
  }, [filteredDons, currentPage, DONS_PER_PAGE])

  useEffect(() => {
    const unsubProjets = subscribeToProjets((data) => {
      setProjets(data)
      setLoading(false)
    })
    const unsubDons = subscribeToDons((data) => {
      setDons(data)
    })
    return () => {
      unsubProjets()
      unsubDons()
    }
  }, [])

  const handleOpenModal = (projet = null) => {
    if (projet) {
      setEditingProjet(projet)
      setFormData({
        titre: projet.titre || '',
        description: projet.description || '',
        objectif: projet.objectif?.toString() || '',
        montantActuel: projet.montantActuel || 0,
        categorie: projet.categorie || CategorieProjet.INTERNE,
        actif: projet.actif !== false,
        statut: projet.statut || undefined,
        fichiers: projet.fichiers || [],
        iban: projet.iban || '',
        lieu: projet.lieu || ''
      })
    } else {
      setEditingProjet(null)
      setFormData(defaultProjet)
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingProjet(null)
    setFormData(defaultProjet)
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length || !editingProjet) return

    setUploading(true)
    try {
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          toast.error(`${file.name} dépasse ${MAX_FILE_SIZE_MB}MB`)
          continue
        }

        const fichier = await uploadProjetFile(editingProjet.id, file, user?.nom || 'Admin')
        setFormData(prev => ({
          ...prev,
          fichiers: [...(prev.fichiers || []), fichier]
        }))
        toast.success(`${file.name} uploadé`)
      }
    } catch (err) {
      console.error('Error uploading file:', err)
      toast.error(err.message || 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteFile = async (fichier) => {
    if (!editingProjet) return

    try {
      await deleteProjetFile(editingProjet.id, fichier)
      setFormData(prev => ({
        ...prev,
        fichiers: prev.fichiers.filter(f => f.id !== fichier.id)
      }))
      toast.success('Fichier supprimé')
    } catch (err) {
      console.error('Error deleting file:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleSave = async () => {
    if (!formData.titre.trim()) {
      toast.error('Le titre est requis')
      return
    }
    if (!formData.objectif || parseFloat(formData.objectif) <= 0) {
      toast.error('L\'objectif doit être supérieur à 0')
      return
    }
    // IBAN obligatoire et validé pour les projets externes
    if (formData.categorie === CategorieProjet.EXTERNE) {
      const ibanValidation = validateIBAN(formData.iban)
      if (!ibanValidation.valid) {
        toast.error(ibanValidation.error)
        return
      }
    }

    setSaving(true)
    try {
      const data = {
        titre: formData.titre,
        description: formData.description,
        objectif: parseFloat(formData.objectif),
        montantActuel: parseFloat(formData.montantActuel) || 0,
        categorie: formData.categorie,
        actif: formData.actif,
        statut: formData.statut || null,
        iban: formData.iban || '',
        lieu: formData.lieu || ''
      }

      if (editingProjet) {
        await updateDocument('projects', editingProjet.id, data)
        toast.success('Projet mis à jour')
      } else {
        await addDocument('projects', { ...data, fichiers: [] })
        toast.success('Projet créé')
      }
      handleCloseModal()
    } catch (err) {
      console.error('Error saving projet:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.item) return

    try {
      const collection = deleteModal.type === 'projet' ? 'projects' : 'donations'
      await deleteDocument(collection, deleteModal.item.id)
      toast.success(`${deleteModal.type === 'projet' ? 'Projet' : 'Don'} supprimé`)
      setDeleteModal({ open: false, item: null, type: null })
    } catch (err) {
      console.error('Error deleting:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleRefundDonation = async (donationId, amount, totalAmount) => {
    const refundAmountValue = parseFloat(amount) || totalAmount
    setRefundDonationModal({
      open: true,
      donationId,
      amount,
      totalAmount,
      message: `Confirmer le remboursement de ${refundAmountValue.toFixed(2)}€ sur un total de ${totalAmount.toFixed(2)}€ ?`
    })
  }

  const handleConfirmRefundDonation = async () => {
    const { donationId, amount } = refundDonationModal
    setRefundDonationModal({ open: false, donationId: null, amount: null, totalAmount: 0 })

    try {
      const functions = getFunctions(undefined, 'europe-west1')
      const refundDonationFn = httpsCallable(functions, 'refundDonation')

      await refundDonationFn({
        donationId,
        amount: parseFloat(amount) || undefined
      })

      toast.success('Remboursement effectué avec succès')
      setRefundingDon(null)
      setRefundAmount('')

      // Refresh donations list (the subscription will update automatically)
    } catch (err) {
      console.error('Error refunding donation:', err)
      toast.error(err.message || 'Erreur lors du remboursement')
    }
  }

  const exportDonsCSV = () => {
    if (filteredDons.length === 0) {
      toast.error('Aucun don à exporter')
      return
    }
    const headers = ['Date', 'Donateur', 'Montant (€)', 'Projet', 'Mode de paiement', 'Type', 'Email']
    const rows = filteredDons.map(d => {
      const projet = projets.find(p => p.id === d.projetId)
      const date = d.createdAt?.toDate
        ? format(d.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: fr })
        : d.date || ''
      return [
        date,
        d.donateur || 'Anonyme',
        (d.montant || d.amount || 0).toFixed(2),
        projet?.titre || d.projetNom || 'Don libre',
        d.modePaiement || d.metadata?.paymentMethod || '',
        d.donorType || 'particulier',
        d.donateurEmail || d.metadata?.donorEmail || ''
      ]
    })
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dons_export_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filteredDons.length} don(s) exporté(s)`)
  }

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf': return <FileText className="w-4 h-4 text-red-400" />
      case 'image': return <ImageIcon className="w-4 h-4 text-blue-400" />
      default: return <File className="w-4 h-4 text-white/50" />
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const projetColumns = [
    {
      key: 'titre',
      label: 'Projet',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.titre}</p>
          <p className="text-sm text-white/50 line-clamp-1">{row.description}</p>
        </div>
      )
    },
    {
      key: 'progression',
      label: 'Progression',
      render: (row) => (
        <div className="w-48">
          <ProgressBar
            value={row.montantActuel || 0}
            max={row.objectif || 1}
            size="sm"
          />
        </div>
      )
    },
    {
      key: 'fichiers',
      label: 'Fichiers',
      render: (row) => (
        <Badge variant={row.fichiers?.length > 0 ? 'info' : 'default'}>
          {row.fichiers?.length || 0} fichier{(row.fichiers?.length || 0) !== 1 ? 's' : ''}
        </Badge>
      )
    },
    {
      key: 'actif',
      label: 'Statut',
      render: (row) => (
        <Badge variant={row.statut === 'en_pause' ? 'warning' : row.actif ? 'success' : 'default'}>
          {row.statut === 'en_pause' ? 'En pause' : row.actif ? 'Actif' : 'Terminé'}
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
          >
            <Pencil className="w-4 h-4 text-white/50" />
          </button>
          <button
            onClick={() => setDeleteModal({ open: true, item: row, type: 'projet' })}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )
    }
  ]

  // Colonnes pour les projets externes (avec IBAN et lieu)
  const projetColumnsExterne = [
    {
      key: 'titre',
      label: 'Projet',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.titre}</p>
          <p className="text-sm text-white/50 line-clamp-1">{row.description}</p>
          {row.lieu && (
            <p className="text-xs text-orange-300 mt-1">📍 {row.lieu}</p>
          )}
        </div>
      )
    },
    {
      key: 'progression',
      label: 'Progression',
      render: (row) => (
        <div className="w-40">
          <ProgressBar
            value={row.montantActuel || 0}
            max={row.objectif || 1}
            size="sm"
          />
        </div>
      )
    },
    {
      key: 'iban',
      label: 'RIB / IBAN',
      render: (row) => (
        <div className="max-w-[200px]">
          {row.iban ? (
            <p className="text-xs text-white/70 font-mono truncate" title={row.iban}>
              {row.iban}
            </p>
          ) : (
            <span className="text-xs text-red-400">⚠️ Non renseigné</span>
          )}
        </div>
      )
    },
    {
      key: 'actif',
      label: 'Statut',
      render: (row) => (
        <Badge variant={row.statut === 'en_pause' ? 'warning' : row.actif ? 'success' : 'default'}>
          {row.statut === 'en_pause' ? 'En pause' : row.actif ? 'Actif' : 'Terminé'}
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
          >
            <Pencil className="w-4 h-4 text-white/50" />
          </button>
          <button
            onClick={() => setDeleteModal({ open: true, item: row, type: 'projet' })}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )
    }
  ]

  const donColumns = [
    {
      key: 'donateur',
      label: 'Donateur',
      render: (row) => {
        const donorInfo = row.donorInfo
        const donorType = row.donorType
        let label = row.donateur || 'Anonyme'
        if (donorInfo) {
          if (donorType === 'entreprise') {
            label = donorInfo.companyName || label
          } else {
            const fullName = `${donorInfo.firstName || ''} ${donorInfo.lastName || ''}`.trim()
            if (fullName) label = fullName
          }
        }
        return (
          <div>
            <span className="text-white">{label}</span>
            {donorInfo?.email && (
              <p className="text-xs text-white/40">{donorInfo.email}</p>
            )}
          </div>
        )
      }
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          row.donorType === 'entreprise'
            ? 'bg-blue-500/20 text-blue-300'
            : 'bg-white/10 text-white/60'
        }`}>
          {row.donorType === 'entreprise' ? '🏢 Entreprise' : '👤 Particulier'}
        </span>
      )
    },
    {
      key: 'montant',
      label: 'Montant',
      render: (row) => (
        <span className="font-medium text-secondary">{row.montant?.toLocaleString()} €</span>
      )
    },
    {
      key: 'projet',
      label: 'Projet',
      render: (row) => {
        const projet = projets.find(p => p.id === row.projetId)
        return <span className="text-white/70">{projet?.titre || 'Don général'}</span>
      }
    },
    {
      key: 'date',
      label: 'Date',
      render: (row) => {
        const rawDate = row.date || row.createdAt || row.webhookProcessedAt
        if (!rawDate) return <span className="text-white/50">-</span>
        try {
          const date = rawDate?.toDate?.() || new Date(rawDate)
          if (isNaN(date.getTime())) return <span className="text-white/50">-</span>
          return <span className="text-white/70">{format(date, 'dd/MM/yyyy', { locale: fr })}</span>
        } catch (e) {
          return <span className="text-white/50">-</span>
        }
      }
    },
    {
      key: 'mode',
      label: 'Mode',
      render: (row) => (
        <Badge variant="default">{row.modePaiement || 'N/A'}</Badge>
      )
    },
    {
      key: 'recu',
      label: 'Reçu',
      render: (row) => (
        row.recuFiscalGenerated
          ? <span className="text-xs text-green-400">✓ {row.recuFiscalYear || ''}</span>
          : <span className="text-xs text-white/30">-</span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const isRefundable = row.status === 'succeeded' || row.status === 'completed'
        const isRefunded = row.refunded === true || row.status === 'refunded'

        if (isRefunded) {
          return <span className="text-xs text-white/30">Remboursé</span>
        }

        if (!isRefundable) {
          return <span className="text-xs text-white/30">-</span>
        }

        if (refundingDon === row.id) {
          return (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={row.montant?.toFixed(2) || '0'}
                className="w-20 px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white"
                step="0.01"
                min="0"
                max={row.montant}
              />
              <button
                onClick={() => handleRefundDonation(row.id, refundAmount, row.montant)}
                className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                OK
              </button>
              <button
                onClick={() => {
                  setRefundingDon(null)
                  setRefundAmount('')
                }}
                className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )
        }

        return (
          <button
            onClick={() => {
              setRefundingDon(row.id)
              setRefundAmount(row.montant?.toFixed(2) || '')
            }}
            className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Rembourser
          </button>
        )
      }
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
            <p className="text-white/50 text-sm">Total des dons</p>
            <p className="text-2xl font-bold text-secondary">
              {dons.reduce((sum, d) => sum + (d.montant || 0), 0).toLocaleString()} €
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Projets actifs</p>
            <p className="text-2xl font-bold text-white">
              {projets.filter(p => p.actif).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Dons ce mois</p>
            <p className="text-2xl font-bold text-green-400">
              {dons.filter(d => {
                const rawDate = d.date || d.createdAt || d.webhookProcessedAt
                if (!rawDate) return false
                try {
                  const date = rawDate?.toDate?.() || new Date(rawDate)
                  const now = new Date()
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
                } catch { return false }
              }).reduce((sum, d) => sum + (d.montant || d.amount || 0), 0).toLocaleString()} €
            </p>
          </div>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-white/10 pb-4">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={activeTab === 'projets' ? 'primary' : 'ghost'}
            onClick={() => { setActiveTab('projets'); setSearchQuery(''); }}
          >
            Projets ({projets.length})
          </Button>
          <Button
            variant={activeTab === 'dons' ? 'primary' : 'ghost'}
            onClick={() => { setActiveTab('dons'); setSearchQuery(''); }}
          >
            Dons ({dons.length})
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder={activeTab === 'projets' ? 'Rechercher un projet...' : 'Rechercher un don...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-secondary text-sm"
          />
        </div>
      </div>

      {/* Projets Tab */}
      {activeTab === 'projets' && (
        <>
          <div className="flex justify-between items-center">
            <p className="text-white/50 text-sm">
              {filteredProjets.length} projet{filteredProjets.length !== 1 ? 's' : ''}
              {searchQuery && ` sur ${projets.length}`}
            </p>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau projet
            </Button>
          </div>

          {projets.length === 0 ? (
            <EmptyState
              icon={Coins}
              title="Aucun projet"
              description="Créez un projet de collecte de dons."
              action={() => handleOpenModal()}
              actionLabel="Créer un projet"
            />
          ) : filteredProjets.length === 0 ? (
            <Card>
              <p className="text-center text-white/50 py-8">Aucun résultat pour "{searchQuery}"</p>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* Section Projets Mosquée (internes) */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  🕌 Projets Mosquée
                  <span className="text-sm font-normal text-white/50">
                    ({filteredProjets.filter(p => p.categorie !== CategorieProjet.EXTERNE).length})
                  </span>
                </h3>
                {filteredProjets.filter(p => p.categorie !== CategorieProjet.EXTERNE).length === 0 ? (
                  <Card>
                    <p className="text-center text-white/50 py-6">Aucun projet interne</p>
                  </Card>
                ) : (
                  <Card>
                    <Table
                      columns={projetColumns}
                      data={filteredProjets.filter(p => p.categorie !== CategorieProjet.EXTERNE)}
                    />
                  </Card>
                )}
              </div>

              {/* Section Autres Causes (externes) */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  🌍 Autres Causes
                  <span className="text-sm font-normal text-white/50">
                    ({filteredProjets.filter(p => p.categorie === CategorieProjet.EXTERNE).length})
                  </span>
                  <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
                    Virement uniquement
                  </span>
                </h3>
                {filteredProjets.filter(p => p.categorie === CategorieProjet.EXTERNE).length === 0 ? (
                  <Card>
                    <p className="text-center text-white/50 py-6">Aucun projet externe</p>
                  </Card>
                ) : (
                  <Card>
                    <Table
                      columns={projetColumnsExterne}
                      data={filteredProjets.filter(p => p.categorie === CategorieProjet.EXTERNE)}
                    />
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Dons Tab */}
      {activeTab === 'dons' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-white/50 text-sm">
              {filteredDons.length} don{filteredDons.length !== 1 ? 's' : ''}
              {searchQuery && ` sur ${dons.length}`}
            </p>
            {filteredDons.length > 0 && (
              <button
                onClick={exportDonsCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
          {dons.length === 0 ? (
            <EmptyState
              icon={Coins}
              title="Aucun don"
              description="Les dons apparaîtront ici."
            />
          ) : filteredDons.length === 0 ? (
            <Card>
              <p className="text-center text-white/50 py-8">Aucun résultat pour "{searchQuery}"</p>
            </Card>
          ) : (
            <Card>
              <Table columns={donColumns} data={paginatedDons} />
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
                  <span className="text-sm text-white/50">
                    {filteredDons.length} don(s) — Page {currentPage}/{totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                    >
                      ← Précédent
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page
                      if (totalPages <= 5) {
                        page = i + 1
                      } else if (currentPage <= 3) {
                        page = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i
                      } else {
                        page = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 rounded text-sm ${
                            currentPage === page
                              ? 'bg-secondary text-white'
                              : 'bg-white/10 hover:bg-white/20 text-white/70'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                    >
                      Suivant →
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Create/Edit Projet Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingProjet ? 'Modifier le projet' : 'Nouveau projet'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <Input
              label="Titre du projet"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Ex: Rénovation de la salle de prière"
              required
            />
            <AIWriteButton
              type="projet"
              field="titre"
              existingContent={formData.titre}
              onGenerated={(text) => setFormData({ ...formData, titre: text })}
              className="absolute right-2 top-8"
            />
          </div>
          <div className="relative">
            <Textarea
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Détails du projet..."
              rows={3}
            />
            <AIWriteButton
              type="projet"
              field="description"
              existingContent={formData.description}
              onGenerated={(text) => setFormData({ ...formData, description: text })}
              className="absolute right-2 top-8"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Objectif (€)"
              type="number"
              value={formData.objectif}
              onChange={(e) => setFormData({ ...formData, objectif: e.target.value })}
              placeholder="Ex: 5000"
              required
            />
            <Input
              label="Montant actuel (€)"
              type="number"
              value={formData.montantActuel}
              onChange={(e) => setFormData({ ...formData, montantActuel: e.target.value })}
              placeholder="0"
            />
          </div>
          <Select
            label="Catégorie"
            value={formData.categorie}
            onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
            options={categorieOptions}
          />

          {/* Champs spécifiques aux projets externes */}
          {formData.categorie === CategorieProjet.EXTERNE && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 space-y-4">
              <p className="text-sm text-orange-300 font-medium">
                ⚠️ Projet externe : les dons seront versés directement au bénéficiaire
              </p>
              <Input
                label="IBAN du bénéficiaire *"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                required
              />
              <Input
                label="Lieu / Pays"
                value={formData.lieu}
                onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
                placeholder="Ex: Palestine, Maroc, Syrie..."
              />
            </div>
          )}

          {/* File Upload Section - Only for existing projects */}
          {editingProjet && (
            <div className="border-t border-white/10 pt-4 mt-4">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm text-white/70">Fichiers du projet</label>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ALLOWED_FILE_TYPES.join(',')}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </div>

              {formData.fichiers?.length > 0 ? (
                <div className="space-y-2">
                  {formData.fichiers.map((fichier) => (
                    <div
                      key={fichier.id}
                      className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(fichier.type)}
                        <div>
                          <p className="text-sm text-white">{fichier.nom}</p>
                          <p className="text-xs text-white/50">{formatFileSize(fichier.taille)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={fichier.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        >
                          <Download className="w-4 h-4 text-white/50" />
                        </a>
                        <button
                          onClick={() => handleDeleteFile(fichier)}
                          className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/30 text-center py-4">
                  Aucun fichier. PDF, images et documents acceptés (max {MAX_FILE_SIZE_MB}MB)
                </p>
              )}
            </div>
          )}

          <Select
            label="Statut du projet"
            value={formData.statut || (formData.actif ? 'actif' : 'termine')}
            onChange={(e) => {
              const val = e.target.value
              setFormData({
                ...formData,
                statut: val === 'en_pause' ? 'en_pause' : undefined,
                actif: val === 'actif'
              })
            }}
            options={[
              { value: 'actif', label: 'Actif — Visible et ouvert aux dons' },
              { value: 'en_pause', label: 'En pause — Visible mais dons suspendus' },
              { value: 'termine', label: 'Terminé — Masqué dans l\'app' }
            ]}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleCloseModal}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editingProjet ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, item: null, type: null })}
        onConfirm={handleDelete}
        title={`Supprimer le ${deleteModal.type}`}
        message={`Êtes-vous sûr de vouloir supprimer "${deleteModal.item?.titre || deleteModal.item?.donateur}" ?`}
        confirmLabel="Supprimer"
        danger
      />

      {/* Refund Donation Confirmation */}
      <ConfirmModal
        isOpen={refundDonationModal.open}
        onClose={() => setRefundDonationModal({ open: false, donationId: null, amount: null, totalAmount: 0 })}
        onConfirm={handleConfirmRefundDonation}
        title="Confirmer le remboursement"
        message={refundDonationModal.message || 'Êtes-vous sûr de vouloir rembourser ce don ?'}
        confirmLabel="Rembourser"
        danger
      />
    </div>
  )
}
