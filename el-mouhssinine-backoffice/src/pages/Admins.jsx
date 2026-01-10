import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Shield, Plus, Pencil, Trash2, Key } from 'lucide-react'
import {
  Card,
  Button,
  Table,
  Modal,
  ConfirmModal,
  Input,
  PasswordInput,
  Select,
  Toggle,
  Badge,
  Loading,
  EmptyState
} from '../components/common'
import {
  subscribeToAdmins,
  addDocument,
  updateDocument,
  deleteDocument
} from '../services/firebase'
import { AdminRole, rolePermissions } from '../types'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const defaultAdmin = {
  nom: '',
  email: '',
  role: AdminRole.MODERATOR,
  permissions: rolePermissions[AdminRole.MODERATOR],
  actif: true
}

const roleOptions = [
  { value: AdminRole.SUPER_ADMIN, label: 'Super Admin' },
  { value: AdminRole.ADMIN, label: 'Admin' },
  { value: AdminRole.MODERATOR, label: 'Modérateur' }
]

const permissionLabels = {
  horaires: 'Horaires de prière',
  annonces: 'Annonces',
  popups: 'Popups',
  evenements: 'Événements',
  janaza: 'Salat Janaza',
  dons: 'Dons & Projets',
  adherents: 'Adhérents',
  notifications: 'Notifications',
  admins: 'Gestion Admins',
  parametres: 'Paramètres'
}

export default function Admins() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, admin: null })
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [formData, setFormData] = useState(defaultAdmin)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToAdmins((data) => {
      setAdmins(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleOpenModal = (admin = null) => {
    if (admin) {
      setEditingAdmin(admin)
      setFormData({
        nom: admin.nom || '',
        email: admin.email || '',
        role: admin.role || AdminRole.MODERATOR,
        permissions: admin.permissions || rolePermissions[admin.role || AdminRole.MODERATOR],
        actif: admin.actif !== false
      })
    } else {
      setEditingAdmin(null)
      setFormData(defaultAdmin)
    }
    setPassword('')
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingAdmin(null)
    setFormData(defaultAdmin)
    setPassword('')
  }

  const handleRoleChange = (role) => {
    setFormData({
      ...formData,
      role,
      permissions: rolePermissions[role] || rolePermissions[AdminRole.MODERATOR]
    })
  }

  const handlePermissionChange = (permission, value) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [permission]: value
      }
    })
  }

  const handleSave = async () => {
    if (!formData.nom.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (!formData.email.trim()) {
      toast.error('L\'email est requis')
      return
    }
    if (!editingAdmin && !password) {
      toast.error('Le mot de passe est requis')
      return
    }
    if (!editingAdmin && password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setSaving(true)
    try {
      const data = {
        nom: formData.nom,
        email: formData.email,
        role: formData.role,
        permissions: formData.permissions,
        actif: formData.actif
      }

      if (editingAdmin) {
        await updateDocument('admins', editingAdmin.id, data)
        toast.success('Administrateur mis à jour')
      } else {
        // Note: In a real app, you'd create the Firebase Auth user first
        // and then save the admin document with the UID
        await addDocument('admins', data)
        toast.success('Administrateur créé')
      }
      handleCloseModal()
    } catch (err) {
      console.error('Error saving admin:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.admin) return

    if (deleteModal.admin.id === user?.uid) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte')
      return
    }

    try {
      await deleteDocument('admins', deleteModal.admin.id)
      toast.success('Administrateur supprimé')
      setDeleteModal({ open: false, admin: null })
    } catch (err) {
      console.error('Error deleting admin:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const getRoleVariant = (role) => {
    switch (role) {
      case AdminRole.SUPER_ADMIN: return 'gold'
      case AdminRole.ADMIN: return 'info'
      default: return 'default'
    }
  }

  const getRoleLabel = (role) => {
    return roleOptions.find(r => r.value === role)?.label || role
  }

  const columns = [
    {
      key: 'nom',
      label: 'Administrateur',
      render: (row) => (
        <div>
          <p className="font-medium text-white">
            {row.nom}
            {row.id === user?.uid && (
              <span className="text-xs text-secondary ml-2">(vous)</span>
            )}
          </p>
          <p className="text-sm text-white/50">{row.email}</p>
        </div>
      )
    },
    {
      key: 'role',
      label: 'Rôle',
      render: (row) => (
        <Badge variant={getRoleVariant(row.role)}>
          {getRoleLabel(row.role)}
        </Badge>
      )
    },
    {
      key: 'permissions',
      label: 'Permissions',
      render: (row) => {
        const activeCount = Object.values(row.permissions || {}).filter(Boolean).length
        const totalCount = Object.keys(permissionLabels).length
        return (
          <span className="text-white/70">
            {activeCount}/{totalCount} modules
          </span>
        )
      }
    },
    {
      key: 'actif',
      label: 'Statut',
      render: (row) => (
        <Badge variant={row.actif ? 'success' : 'danger'}>
          {row.actif ? 'Actif' : 'Désactivé'}
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
              {format(date, 'dd/MM/yyyy', { locale: fr })}
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
            onClick={() => handleOpenModal(row)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4 text-white/50" />
          </button>
          {row.id !== user?.uid && (
            <button
              onClick={() => setDeleteModal({ open: true, admin: row })}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Super Admins</p>
            <p className="text-2xl font-bold text-secondary">
              {admins.filter(a => a.role === AdminRole.SUPER_ADMIN).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Admins</p>
            <p className="text-2xl font-bold text-blue-400">
              {admins.filter(a => a.role === AdminRole.ADMIN).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-white/50 text-sm">Modérateurs</p>
            <p className="text-2xl font-bold text-white">
              {admins.filter(a => a.role === AdminRole.MODERATOR).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-white/50">
          {admins.length} administrateur{admins.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvel administrateur
        </Button>
      </div>

      {/* Table */}
      {admins.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Aucun administrateur"
          description="Ajoutez un administrateur pour gérer le backoffice."
          action={() => handleOpenModal()}
          actionLabel="Ajouter un administrateur"
        />
      ) : (
        <Card>
          <Table columns={columns} data={admins} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingAdmin ? 'Modifier l\'administrateur' : 'Nouvel administrateur'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nom complet"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            placeholder="Ex: Mohamed Ali"
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="admin@elmouhssinine.org"
            required
            disabled={!!editingAdmin}
          />
          {!editingAdmin && (
            <PasswordInput
              label="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
              required
            />
          )}
          <Select
            label="Rôle"
            value={formData.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            options={roleOptions}
          />

          {/* Permissions */}
          <div className="border-t border-white/10 pt-4">
            <h4 className="text-white font-medium mb-4 flex items-center gap-2">
              <Key className="w-4 h-4" />
              Permissions
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(permissionLabels).map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-white/70">{label}</span>
                  <Toggle
                    checked={formData.permissions[key] || false}
                    onChange={(checked) => handlePermissionChange(key, checked)}
                    disabled={formData.role === AdminRole.SUPER_ADMIN}
                  />
                </div>
              ))}
            </div>
            {formData.role === AdminRole.SUPER_ADMIN && (
              <p className="text-xs text-secondary mt-2">
                Les super admins ont accès à tous les modules.
              </p>
            )}
          </div>

          <Toggle
            label="Compte actif"
            checked={formData.actif}
            onChange={(checked) => setFormData({ ...formData, actif: checked })}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleCloseModal}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editingAdmin ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, admin: null })}
        onConfirm={handleDelete}
        title="Supprimer l'administrateur"
        message={`Êtes-vous sûr de vouloir supprimer ${deleteModal.admin?.nom} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
