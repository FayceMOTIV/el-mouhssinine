import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { BookOpen, Plus, Edit, Trash2, Search, Check, X } from 'lucide-react'
import { Card, Button, Input, Textarea, Toggle, Loading, EmptyState, Modal, Badge, AIWriteButton } from '../components/common'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase'

export default function Rappels() {
  const [rappels, setRappels] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingRappel, setEditingRappel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const [formData, setFormData] = useState({
    texteFr: '',
    texteAr: '',
    source: '',
    actif: true
  })

  useEffect(() => {
    const q = query(collection(db, 'rappels'), orderBy('source', 'asc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setRappels(data)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching rappels:', error)
      toast.error('Erreur lors du chargement des rappels')
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const filteredRappels = rappels.filter(rappel =>
    rappel.texteFr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rappel.texteAr?.includes(searchTerm) ||
    rappel.source?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleOpenModal = (rappel = null) => {
    if (rappel) {
      setEditingRappel(rappel)
      setFormData({
        texteFr: rappel.texteFr || '',
        texteAr: rappel.texteAr || '',
        source: rappel.source || '',
        actif: rappel.actif !== false
      })
    } else {
      setEditingRappel(null)
      setFormData({
        texteFr: '',
        texteAr: '',
        source: '',
        actif: true
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingRappel(null)
    setFormData({
      texteFr: '',
      texteAr: '',
      source: '',
      actif: true
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.texteFr.trim()) {
      toast.error('Le texte en français est requis')
      return
    }

    setSaving(true)
    try {
      if (editingRappel) {
        await updateDoc(doc(db, 'rappels', editingRappel.id), formData)
        toast.success('Rappel mis à jour')
      } else {
        await addDoc(collection(db, 'rappels'), {
          ...formData,
          createdAt: new Date().toISOString()
        })
        toast.success('Rappel ajouté')
      }
      handleCloseModal()
    } catch (err) {
      console.error('Error saving rappel:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActif = async (rappel) => {
    try {
      await updateDoc(doc(db, 'rappels', rappel.id), {
        actif: !rappel.actif
      })
      toast.success(rappel.actif ? 'Rappel désactivé' : 'Rappel activé')
    } catch (err) {
      console.error('Error toggling rappel:', err)
      toast.error('Erreur lors de la modification')
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'rappels', id))
      toast.success('Rappel supprimé')
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Error deleting rappel:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-secondary" />
            Rappels du jour
          </h1>
          <p className="text-white/60 mt-1">
            Gérez les hadiths et rappels affichés dans l'application
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau rappel
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
        <input
          type="text"
          placeholder="Rechercher un rappel..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-secondary"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-secondary">{rappels.length}</p>
            <p className="text-white/60 text-sm">Total rappels</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-400">
              {rappels.filter(r => r.actif !== false).length}
            </p>
            <p className="text-white/60 text-sm">Actifs</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-red-400">
              {rappels.filter(r => r.actif === false).length}
            </p>
            <p className="text-white/60 text-sm">Inactifs</p>
          </div>
        </Card>
      </div>

      {/* Liste des rappels */}
      {filteredRappels.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucun rappel"
          description={searchTerm ? "Aucun rappel ne correspond à votre recherche" : "Ajoutez votre premier rappel pour commencer"}
          action={!searchTerm && (
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un rappel
            </Button>
          )}
        />
      ) : (
        <div className="space-y-4">
          {filteredRappels.map(rappel => (
            <Card key={rappel.id} className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1 space-y-2">
                  {/* Texte français */}
                  <p className="text-white">"{rappel.texteFr}"</p>

                  {/* Texte arabe */}
                  {rappel.texteAr && (
                    <p className="text-white/70 text-right font-arabic text-lg" dir="rtl">
                      "{rappel.texteAr}"
                    </p>
                  )}

                  {/* Source */}
                  <p className="text-secondary text-sm">— {rappel.source || 'Source inconnue'}</p>
                </div>

                <div className="flex items-center gap-2 lg:flex-col lg:items-end">
                  <Badge variant={rappel.actif !== false ? 'success' : 'error'}>
                    {rappel.actif !== false ? 'Actif' : 'Inactif'}
                  </Badge>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActif(rappel)}
                      className={`p-2 rounded-lg transition-colors ${
                        rappel.actif !== false
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                      title={rappel.actif !== false ? 'Désactiver' : 'Activer'}
                    >
                      {rappel.actif !== false ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleOpenModal(rappel)}
                      className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-white"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(rappel.id)}
                      className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors text-red-400"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Ajout/Modification */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingRappel ? 'Modifier le rappel' : 'Nouveau rappel'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Texte en français *</label>
              <AIWriteButton
                type="rappel"
                field="contenu"
                existingContent={formData.texteFr}
                onGenerated={(content) => setFormData({ ...formData, texteFr: content })}
              />
            </div>
            <Textarea
              value={formData.texteFr}
              onChange={(e) => setFormData({ ...formData, texteFr: e.target.value })}
              placeholder="Les actes ne valent que par leurs intentions..."
              rows={3}
              required
            />
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white">Texte en arabe</label>
              <AIWriteButton
                type="rappel"
                field="contenu"
                existingContent={formData.texteAr}
                onGenerated={(content) => setFormData({ ...formData, texteAr: content })}
              />
            </div>
            <Textarea
              value={formData.texteAr}
              onChange={(e) => setFormData({ ...formData, texteAr: e.target.value })}
              placeholder="إنما الأعمال بالنيات..."
              rows={3}
              className="text-right"
              dir="rtl"
            />
          </div>

          <Input
            label="Source"
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            placeholder="Hadith Bukhari & Muslim"
          />

          <div className="flex items-center justify-between py-2">
            <span className="text-white">Actif</span>
            <Toggle
              checked={formData.actif}
              onChange={(checked) => setFormData({ ...formData, actif: checked })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button type="submit" loading={saving}>
              {editingRappel ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmation Suppression */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmer la suppression"
      >
        <p className="text-white/70 mb-6">
          Êtes-vous sûr de vouloir supprimer ce rappel ? Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={() => handleDelete(deleteConfirm)}>
            Supprimer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
