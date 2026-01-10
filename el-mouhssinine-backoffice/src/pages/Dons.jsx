import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import {
  Coins, Plus, Pencil, Trash2, FileText, Upload, X, Download, File, Image as ImageIcon
} from 'lucide-react'
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
  fichiers: []
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
        fichiers: projet.fichiers || []
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

    setSaving(true)
    try {
      const data = {
        titre: formData.titre,
        description: formData.description,
        objectif: parseFloat(formData.objectif),
        montantActuel: parseFloat(formData.montantActuel) || 0,
        categorie: formData.categorie,
        actif: formData.actif
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
        <Badge variant={row.actif ? 'success' : 'default'}>
          {row.actif ? 'Actif' : 'Terminé'}
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
      render: (row) => (
        <span className="text-white">{row.donateur || 'Anonyme'}</span>
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
        if (!row.date) return <span className="text-white/50">-</span>
        try {
          const date = row.date?.toDate?.() || new Date(row.date)
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
                const date = d.date?.toDate?.() || new Date(d.date)
                const now = new Date()
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
              }).reduce((sum, d) => sum + (d.montant || 0), 0).toLocaleString()} €
            </p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
        <Button
          variant={activeTab === 'projets' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('projets')}
        >
          Projets ({projets.length})
        </Button>
        <Button
          variant={activeTab === 'dons' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('dons')}
        >
          Dons ({dons.length})
        </Button>
      </div>

      {/* Projets Tab */}
      {activeTab === 'projets' && (
        <>
          <div className="flex justify-end">
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
          ) : (
            <Card>
              <Table columns={projetColumns} data={projets} />
            </Card>
          )}
        </>
      )}

      {/* Dons Tab */}
      {activeTab === 'dons' && (
        <>
          {dons.length === 0 ? (
            <EmptyState
              icon={Coins}
              title="Aucun don"
              description="Les dons apparaîtront ici."
            />
          ) : (
            <Card>
              <Table columns={donColumns} data={dons} />
            </Card>
          )}
        </>
      )}

      {/* Create/Edit Projet Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingProjet ? 'Modifier le projet' : 'Nouveau projet'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Titre du projet"
            value={formData.titre}
            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
            placeholder="Ex: Rénovation de la salle de prière"
            required
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Détails du projet..."
            rows={3}
          />
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

          <Toggle
            label="Projet actif"
            checked={formData.actif}
            onChange={(checked) => setFormData({ ...formData, actif: checked })}
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
    </div>
  )
}
