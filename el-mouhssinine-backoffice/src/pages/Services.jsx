import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Briefcase, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Search } from 'lucide-react'
import {
  Card,
  Button,
  Modal,
  ConfirmModal,
  Input,
  Toggle,
  Loading,
  EmptyState,
  Badge
} from '../components/common'
import { db } from '../services/firebase'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'

const EMOJI_LIBRARY = {
  'Mosquée & Prière': ['🕌', '🤲', '📿', '🧎', '☪️', '🌙', '⭐', '🕋', '🪔', '📖'],
  'Accessibilité': ['♿', '🦽', '🦯', '🚻', '🚼', '👶', '🧓', '🤰'],
  'Éducation': ['📚', '📖', '🎓', '✏️', '📝', '🏫', '👩‍🏫', '👨‍🏫', '📕', '🧑‍🎓'],
  'Infrastructures': ['🅿️', '🚗', '💧', '🚿', '🏠', '🚪', '🔑', '🛗', '🧹', '💡'],
  'Communauté': ['👩', '👨', '👫', '👨‍👩‍👧‍👦', '🤝', '💬', '📢', '🎤', '👥', '🫂'],
  'Activités': ['🎉', '🍽️', '☕', '🏃', '⚽', '🎨', '🎵', '📺', '🧩', '🎲'],
  'Santé & Social': ['❤️', '🩺', '💊', '🏥', '🤲', '🫶', '🆘', '🧘', '🌿', '🕊️'],
  'Commerce': ['🛒', '📦', '🥩', '🍞', '👕', '📋', '💰', '🏪', '🎁', '🧾'],
}

const AR_SUGGESTIONS = {
  'parking': 'موقف سيارات',
  'accès handicapés': 'دخول ذوي الاحتياجات الخاصة',
  'salle d\'ablution': 'قاعة الوضوء',
  'ablution': 'قاعة الوضوء',
  'espace femmes': 'قسم النساء',
  'cours adultes': 'دروس الكبار',
  'cours enfants': 'دروس الأطفال',
  'bibliothèque': 'مكتبة',
  'salle de prière': 'قاعة الصلاة',
  'cuisine': 'مطبخ',
  'jardin': 'حديقة',
  'aire de jeux': 'ملعب أطفال',
  'wifi': 'واي فاي',
  'climatisation': 'تكييف',
  'chauffage': 'تدفئة',
  'toilettes': 'دورات مياه',
  'vestiaire': 'غرفة تبديل الملابس',
  'ascenseur': 'مصعد',
  'rampe d\'accès': 'منحدر الوصول',
  'coffre-fort': 'خزنة',
  'casiers': 'خزائن',
  'boutique': 'متجر',
  'librairie': 'مكتبة',
  'coran': 'القرآن الكريم',
  'garderie': 'حضانة',
  'soutien scolaire': 'دعم مدرسي',
  'cours arabe': 'دروس اللغة العربية',
  'cours coran': 'دروس القرآن',
  'iftar': 'إفطار',
  'salle polyvalente': 'قاعة متعددة الاستخدامات',
  'bureau imam': 'مكتب الإمام',
  'accueil': 'استقبال',
  'funéraire': 'خدمات جنائزية',
  'mariage': 'خدمات الزواج',
  'conseil': 'استشارة',
  'don': 'تبرع',
  'zakat': 'الزكاة',
  'sadaqa': 'صدقة',
}

const defaultService = {
  icon: '',
  label: '',
  labelAr: '',
  available: true
}

export default function Services() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, service: null })
  const [editingService, setEditingService] = useState(null)
  const [formData, setFormData] = useState(defaultService)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [reordering, setReordering] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiFilter, setEmojiFilter] = useState('')
  const [arSuggestions, setArSuggestions] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('order', 'asc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
      setServices(data)
      setLoading(false)
    }, (error) => {
      if (import.meta.env.DEV) console.error('Error fetching services:', error)
      toast.error('Erreur lors du chargement des services')
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const filteredServices = services.filter(s =>
    s.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.labelAr?.includes(searchTerm) ||
    s.icon?.includes(searchTerm)
  )

  const findArSuggestions = (text) => {
    if (!text || text.length < 2) { setArSuggestions([]); return }
    const lower = text.toLowerCase().trim()
    const matches = Object.entries(AR_SUGGESTIONS)
      .filter(([key]) => key.includes(lower) || lower.includes(key))
      .map(([key, val]) => ({ key, val }))
    setArSuggestions(matches)
  }

  const handleLabelChange = (value) => {
    setFormData(prev => ({ ...prev, label: value }))
    findArSuggestions(value)
  }

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingService(service)
      setFormData({
        icon: service.icon || '',
        label: service.label || '',
        labelAr: service.labelAr || '',
        available: service.available !== false
      })
    } else {
      setEditingService(null)
      setFormData(defaultService)
    }
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingService(null)
    setFormData(defaultService)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.label.trim()) {
      toast.error('Le nom en français est requis')
      return
    }

    if (!formData.icon.trim()) {
      toast.error("L'icône (emoji) est requise")
      return
    }

    setSaving(true)
    try {
      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), {
          icon: formData.icon.trim(),
          label: formData.label.trim(),
          labelAr: formData.labelAr.trim(),
          available: formData.available,
          updatedAt: serverTimestamp()
        })
        toast.success('Service mis à jour')
      } else {
        const nextOrder = services.length > 0
          ? Math.max(...services.map(s => s.order ?? 0)) + 1
          : 0
        await addDoc(collection(db, 'services'), {
          icon: formData.icon.trim(),
          label: formData.label.trim(),
          labelAr: formData.labelAr.trim(),
          available: formData.available,
          order: nextOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        toast.success('Service ajouté')
      }
      handleCloseModal()
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error saving service:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAvailable = async (service) => {
    try {
      await updateDoc(doc(db, 'services', service.id), {
        available: !service.available,
        updatedAt: serverTimestamp()
      })
      toast.success(service.available ? 'Service désactivé' : 'Service activé')
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error toggling service:', err)
      toast.error('Erreur lors de la modification')
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.service) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'services', deleteModal.service.id))
      toast.success('Service supprimé')
      setDeleteModal({ open: false, service: null })
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error deleting service:', err)
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  const handleMoveUp = async (index) => {
    if (index === 0 || reordering) return
    setReordering(true)
    try {
      const batch = writeBatch(db)
      const current = services[index]
      const previous = services[index - 1]

      batch.update(doc(db, 'services', current.id), {
        order: previous.order ?? index - 1,
        updatedAt: serverTimestamp()
      })
      batch.update(doc(db, 'services', previous.id), {
        order: current.order ?? index,
        updatedAt: serverTimestamp()
      })

      await batch.commit()
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error reordering services:', err)
      toast.error("Erreur lors du réordonnancement")
    } finally {
      setReordering(false)
    }
  }

  const handleMoveDown = async (index) => {
    if (index === services.length - 1 || reordering) return
    setReordering(true)
    try {
      const batch = writeBatch(db)
      const current = services[index]
      const next = services[index + 1]

      batch.update(doc(db, 'services', current.id), {
        order: next.order ?? index + 1,
        updatedAt: serverTimestamp()
      })
      batch.update(doc(db, 'services', next.id), {
        order: current.order ?? index,
        updatedAt: serverTimestamp()
      })

      await batch.commit()
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error reordering services:', err)
      toast.error("Erreur lors du réordonnancement")
    } finally {
      setReordering(false)
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
            <Briefcase className="w-6 h-6 text-secondary" />
            Services de la mosquée
          </h1>
          <p className="text-white/60 mt-1">
            Gérez les services affichés dans l'application
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un service
        </Button>
      </div>

      {/* Search */}
      {services.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            type="text"
            placeholder="Rechercher un service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-secondary"
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-secondary">{services.length}</p>
            <p className="text-white/60 text-sm">Total services</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-400">
              {services.filter(s => s.available !== false).length}
            </p>
            <p className="text-white/60 text-sm">Disponibles</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-red-400">
              {services.filter(s => s.available === false).length}
            </p>
            <p className="text-white/60 text-sm">Indisponibles</p>
          </div>
        </Card>
      </div>

      {/* Table */}
      {services.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Aucun service"
          description="Commencez par ajouter les services proposés par la mosquée"
          action={
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un service
            </Button>
          }
        />
      ) : filteredServices.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Aucun résultat"
          description="Aucun service ne correspond à votre recherche"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/60 text-xs font-medium uppercase tracking-wider px-4 py-3 w-20">
                    Ordre
                  </th>
                  <th className="text-left text-white/60 text-xs font-medium uppercase tracking-wider px-4 py-3 w-16">
                    Icône
                  </th>
                  <th className="text-left text-white/60 text-xs font-medium uppercase tracking-wider px-4 py-3">
                    Nom (FR)
                  </th>
                  <th className="text-left text-white/60 text-xs font-medium uppercase tracking-wider px-4 py-3">
                    Nom (AR)
                  </th>
                  <th className="text-center text-white/60 text-xs font-medium uppercase tracking-wider px-4 py-3 w-32">
                    Disponible
                  </th>
                  <th className="text-right text-white/60 text-xs font-medium uppercase tracking-wider px-4 py-3 w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service, idx) => {
                  // Find the real index in the unfiltered array for reorder
                  const realIndex = services.findIndex(s => s.id === service.id)
                  return (
                    <tr
                      key={service.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      {/* Reorder arrows */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveUp(realIndex)}
                            disabled={realIndex === 0 || reordering || !!searchTerm}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Monter"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(realIndex)}
                            disabled={realIndex === services.length - 1 || reordering || !!searchTerm}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Descendre"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                      {/* Icon */}
                      <td className="px-4 py-3">
                        <span className="text-2xl">{service.icon}</span>
                      </td>

                      {/* Label FR */}
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{service.label}</span>
                      </td>

                      {/* Label AR */}
                      <td className="px-4 py-3">
                        <span className="text-white/70 font-arabic" dir="rtl">
                          {service.labelAr || '—'}
                        </span>
                      </td>

                      {/* Available toggle */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Toggle
                            checked={service.available !== false}
                            onChange={() => handleToggleAvailable(service)}
                          />
                          <Badge variant={service.available !== false ? 'success' : 'error'}>
                            {service.available !== false ? 'Oui' : 'Non'}
                          </Badge>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(service)}
                            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-white"
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ open: true, service })}
                            className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors text-red-400"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingService ? 'Modifier le service' : 'Nouveau service'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Emoji selector */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Icône (emoji) *
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-14 h-14 flex items-center justify-center bg-white/5 border-2 border-dashed border-white/20 rounded-xl hover:border-secondary transition-colors text-3xl"
              >
                {formData.icon || '➕'}
              </button>
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="Collez un emoji ou choisissez ci-dessous"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-secondary"
                />
              </div>
            </div>

            {showEmojiPicker && (
              <div className="mt-3 p-4 bg-white/5 border border-white/10 rounded-xl max-h-64 overflow-y-auto">
                <input
                  type="text"
                  value={emojiFilter}
                  onChange={(e) => setEmojiFilter(e.target.value)}
                  placeholder="Filtrer par catégorie..."
                  className="w-full px-3 py-2 mb-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-secondary"
                />
                {Object.entries(EMOJI_LIBRARY)
                  .filter(([cat]) => !emojiFilter || cat.toLowerCase().includes(emojiFilter.toLowerCase()))
                  .map(([category, emojis]) => (
                  <div key={category} className="mb-3">
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">{category}</p>
                    <div className="flex flex-wrap gap-1">
                      {emojis.map((emoji, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, icon: emoji }))
                            setShowEmojiPicker(false)
                            setEmojiFilter('')
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl hover:bg-white/10 transition-colors ${formData.icon === emoji ? 'bg-secondary/20 ring-2 ring-secondary' : ''}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* French name */}
          <Input
            label="Nom en français *"
            value={formData.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Ex: Parking, Bibliothèque, Cours..."
          />

          {/* Arabic name with suggestions */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Nom en arabe
            </label>
            <input
              type="text"
              value={formData.labelAr}
              onChange={(e) => setFormData({ ...formData, labelAr: e.target.value })}
              placeholder="مثال: موقف سيارات، مكتبة..."
              dir="rtl"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-secondary text-right"
              style={{ fontFamily: "'Noto Sans Arabic', 'Arial', sans-serif" }}
            />
            {arSuggestions.length > 0 && !formData.labelAr && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs text-white/40">Suggestions :</span>
                {arSuggestions.map(({ key, val }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, labelAr: val }))
                      setArSuggestions([])
                    }}
                    className="px-3 py-1 bg-secondary/20 text-secondary rounded-full text-sm hover:bg-secondary/30 transition-colors"
                    dir="rtl"
                    style={{ fontFamily: "'Noto Sans Arabic', 'Arial', sans-serif" }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Available toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-white">Disponible</span>
            <Toggle
              checked={formData.available}
              onChange={(checked) => setFormData({ ...formData, available: checked })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button type="submit" loading={saving}>
              {editingService ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, service: null })}
        onConfirm={handleDelete}
        title="Supprimer le service"
        message={`Êtes-vous sûr de vouloir supprimer le service "${deleteModal.service?.label}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        danger
        loading={deleting}
      />
    </div>
  )
}
