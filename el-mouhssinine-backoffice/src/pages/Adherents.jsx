import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Users, Plus, Pencil, Trash2, Search, Download, Mail, Phone } from 'lucide-react'
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
  deleteDocument
} from '../services/firebase'
import { CotisationType, CotisationStatut } from '../types'
import { format, addMonths, addYears, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'

const defaultMembre = {
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  adresse: '',
  cotisation: {
    type: CotisationType.ANNUEL,
    montant: 100,
    dateDebut: '',
    dateFin: ''
  },
  actif: true
}

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
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, membre: null })
  const [editingMembre, setEditingMembre] = useState(null)
  const [formData, setFormData] = useState(defaultMembre)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToMembres((data) => {
      setMembres(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    let filtered = [...membres]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(m =>
        m.nom?.toLowerCase().includes(query) ||
        m.prenom?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query) ||
        m.telephone?.includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => getCotisationStatus(m) === statusFilter)
    }

    setFilteredMembres(filtered)
  }, [membres, searchQuery, statusFilter])

  const getCotisationStatus = (membre) => {
    if (!membre.cotisation?.dateFin) return CotisationStatut.AUCUN
    const dateFin = membre.cotisation.dateFin?.toDate?.() || new Date(membre.cotisation.dateFin)
    return isPast(dateFin) ? CotisationStatut.EXPIRE : CotisationStatut.ACTIF
  }

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

  const handleCotisationTypeChange = (type) => {
    const dateDebut = formData.cotisation.dateDebut ? new Date(formData.cotisation.dateDebut) : new Date()
    const dateFin = type === CotisationType.MENSUEL
      ? addMonths(dateDebut, 1)
      : addYears(dateDebut, 1)

    setFormData({
      ...formData,
      cotisation: {
        ...formData.cotisation,
        type,
        dateFin: format(dateFin, 'yyyy-MM-dd')
      }
    })
  }

  const handleDateDebutChange = (dateStr) => {
    if (!dateStr) return

    const dateDebut = new Date(dateStr)
    const dateFin = formData.cotisation.type === CotisationType.MENSUEL
      ? addMonths(dateDebut, 1)
      : addYears(dateDebut, 1)

    setFormData({
      ...formData,
      cotisation: {
        ...formData.cotisation,
        dateDebut: dateStr,
        dateFin: format(dateFin, 'yyyy-MM-dd')
      }
    })
  }

  const handleSave = async () => {
    if (!formData.nom.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (!formData.prenom.trim()) {
      toast.error('Le prénom est requis')
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
        toast.success('Adhérent mis à jour')
      } else {
        await addDocument('members', data)
        toast.success('Adhérent créé')
      }
      handleCloseModal()
    } catch (err) {
      console.error('Error saving membre:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.membre) return

    try {
      await deleteDocument('members', deleteModal.membre.id)
      toast.success('Adhérent supprimé')
      setDeleteModal({ open: false, membre: null })
    } catch (err) {
      console.error('Error deleting membre:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const exportCSV = () => {
    const headers = ['Nom', 'Prénom', 'Email', 'Téléphone', 'Type cotisation', 'Statut', 'Date fin']
    const rows = membres.map(m => [
      m.nom || '',
      m.prenom || '',
      m.email || '',
      m.telephone || '',
      m.cotisation?.type || '',
      getCotisationStatus(m),
      m.cotisation?.dateFin ? format(m.cotisation.dateFin?.toDate?.() || new Date(m.cotisation.dateFin), 'dd/MM/yyyy') : ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `adherents_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    toast.success('Export CSV téléchargé')
  }

  const columns = [
    {
      key: 'nom',
      label: 'Adhérent',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.prenom} {row.nom}</p>
          <div className="flex items-center gap-3 text-sm text-white/50">
            {row.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" /> {row.email}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'telephone',
      label: 'Téléphone',
      render: (row) => row.telephone ? (
        <span className="flex items-center gap-1 text-white/70">
          <Phone className="w-3 h-3" /> {row.telephone}
        </span>
      ) : (
        <span className="text-white/30">-</span>
      )
    },
    {
      key: 'cotisation',
      label: 'Cotisation',
      render: (row) => (
        <div>
          <p className="text-white capitalize">{row.cotisation?.type || 'N/A'}</p>
          <p className="text-sm text-white/50">{row.cotisation?.montant || 0} €</p>
        </div>
      )
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (row) => <StatusBadge status={getCotisationStatus(row)} />
    },
    {
      key: 'dateFin',
      label: 'Échéance',
      render: (row) => {
        if (!row.cotisation?.dateFin) return <span className="text-white/30">-</span>
        try {
          const date = row.cotisation.dateFin?.toDate?.() || new Date(row.cotisation.dateFin)
          if (isNaN(date.getTime())) return <span className="text-white/30">-</span>
          return (
            <span className={isPast(date) ? 'text-red-400' : 'text-white/70'}>
              {format(date, 'dd/MM/yyyy')}
            </span>
          )
        } catch (e) {
          return <span className="text-white/30">-</span>
        }
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
            onClick={() => setDeleteModal({ open: true, membre: row })}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Total adhérents</p>
            <p className="text-2xl font-bold text-white">{membres.length}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Cotisations actives</p>
            <p className="text-2xl font-bold text-green-400">
              {membres.filter(m => getCotisationStatus(m) === CotisationStatut.ACTIF).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Cotisations expirées</p>
            <p className="text-2xl font-bold text-red-400">
              {membres.filter(m => getCotisationStatus(m) === CotisationStatut.EXPIRE).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Sans cotisation</p>
            <p className="text-2xl font-bold text-white/50">
              {membres.filter(m => getCotisationStatus(m) === CotisationStatut.AUCUN).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Filters & Actions */}
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-secondary"
          >
            <option value="all">Tous les statuts</option>
            <option value={CotisationStatut.ACTIF}>Actif</option>
            <option value={CotisationStatut.EXPIRE}>Expiré</option>
            <option value={CotisationStatut.AUCUN}>Sans cotisation</option>
          </select>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </Button>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel adhérent
          </Button>
        </div>
      </div>

      {/* Table */}
      {filteredMembres.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery || statusFilter !== 'all' ? 'Aucun résultat' : 'Aucun adhérent'}
          description={searchQuery || statusFilter !== 'all'
            ? 'Modifiez vos critères de recherche.'
            : 'Ajoutez votre premier adhérent.'}
          action={!searchQuery && statusFilter === 'all' ? () => handleOpenModal() : undefined}
          actionLabel="Ajouter un adhérent"
        />
      ) : (
        <Card>
          <Table columns={columns} data={filteredMembres} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingMembre ? 'Modifier l\'adhérent' : 'Nouvel adhérent'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nom"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
            />
            <Input
              label="Prénom"
              value={formData.prenom}
              onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="Téléphone"
              value={formData.telephone}
              onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
            />
          </div>
          <Input
            label="Adresse"
            value={formData.adresse}
            onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
          />

          <div className="border-t border-white/10 pt-4">
            <h4 className="text-white font-medium mb-4">Cotisation</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Type de cotisation"
                value={formData.cotisation.type}
                onChange={(e) => handleCotisationTypeChange(e.target.value)}
                options={cotisationOptions}
              />
              <Input
                label="Montant (€)"
                type="number"
                value={formData.cotisation.montant}
                onChange={(e) => setFormData({
                  ...formData,
                  cotisation: { ...formData.cotisation, montant: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Input
                label="Date de début"
                type="date"
                value={formData.cotisation.dateDebut}
                onChange={(e) => handleDateDebutChange(e.target.value)}
              />
              <Input
                label="Date de fin"
                type="date"
                value={formData.cotisation.dateFin}
                onChange={(e) => setFormData({
                  ...formData,
                  cotisation: { ...formData.cotisation, dateFin: e.target.value }
                })}
              />
            </div>
          </div>

          <Toggle
            label="Adhérent actif"
            checked={formData.actif}
            onChange={(checked) => setFormData({ ...formData, actif: checked })}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleCloseModal}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editingMembre ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, membre: null })}
        onConfirm={handleDelete}
        title="Supprimer l'adhérent"
        message={`Êtes-vous sûr de vouloir supprimer ${deleteModal.membre?.prenom} ${deleteModal.membre?.nom} ?`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
