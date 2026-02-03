import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { BookOpen, Plus, Edit, Trash2, Search, Check, X, Download, AlertTriangle } from 'lucide-react'
import { Card, Button, Input, Textarea, Toggle, Loading, EmptyState, Modal, Badge, AIWriteButton } from '../components/common'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../services/firebase'

// Hadiths par défaut à importer
const defaultHadiths = [
  { texteFr: 'Les actes ne valent que par leurs intentions, et chacun sera rétribué selon son intention.', texteAr: 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "Le meilleur d'entre vous est celui qui apprend le Coran et l'enseigne.", texteAr: 'خيركم من تعلم القرآن وعلمه', source: 'Hadith Bukhari', actif: true },
  { texteFr: "Souriez, c'est une aumône.", texteAr: 'تبسمك في وجه أخيك صدقة', source: 'Hadith Tirmidhi', actif: true },
  { texteFr: "Celui qui croit en Allah et au Jour Dernier, qu'il dise du bien ou qu'il se taise.", texteAr: 'من كان يؤمن بالله واليوم الآخر فليقل خيراً أو ليصمت', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: 'Le paradis se trouve sous les pieds des mères.', texteAr: 'الجنة تحت أقدام الأمهات', source: "Hadith Nasa'i", actif: true },
  { texteFr: "La propreté fait partie de la foi.", texteAr: 'الطهور شطر الإيمان', source: 'Hadith Muslim', actif: true },
  { texteFr: "Celui qui ne remercie pas les gens ne remercie pas Allah.", texteAr: 'لا يشكر الله من لا يشكر الناس', source: 'Hadith Abu Dawud', actif: true },
  { texteFr: "Le croyant est le miroir du croyant.", texteAr: 'المؤمن مرآة المؤمن', source: 'Hadith Abu Dawud', actif: true },
  { texteFr: "Facilite et ne complique pas, annonce la bonne nouvelle et ne fais pas fuir.", texteAr: 'يسروا ولا تعسروا وبشروا ولا تنفروا', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "Le musulman est celui dont les musulmans sont à l'abri de sa langue et de sa main.", texteAr: 'المسلم من سلم المسلمون من لسانه ويده', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "Aucun de vous ne sera véritablement croyant tant qu'il n'aimera pas pour son frère ce qu'il aime pour lui-même.", texteAr: 'لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "La meilleure des invocations est celle du jour de Arafat.", texteAr: 'خير الدعاء دعاء يوم عرفة', source: 'Hadith Tirmidhi', actif: true },
  { texteFr: "Celui qui emprunte un chemin pour acquérir une science, Allah lui facilite un chemin vers le Paradis.", texteAr: 'من سلك طريقاً يلتمس فيه علماً سهل الله له به طريقاً إلى الجنة', source: 'Hadith Muslim', actif: true },
  { texteFr: "Les plus aimés d'entre vous auprès d'Allah sont ceux qui ont le meilleur caractère.", texteAr: 'إن أحبكم إلي وأقربكم مني مجلساً يوم القيامة أحاسنكم أخلاقاً', source: 'Hadith Tirmidhi', actif: true },
  { texteFr: "La pudeur fait partie de la foi.", texteAr: 'الحياء من الإيمان', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "Le fort n'est pas celui qui terrasse les gens, mais celui qui se maîtrise lors de la colère.", texteAr: 'ليس الشديد بالصرعة إنما الشديد الذي يملك نفسه عند الغضب', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "Fais preuve de bon comportement envers les gens.", texteAr: 'وخالق الناس بخلق حسن', source: 'Hadith Tirmidhi', actif: true },
  { texteFr: "L'invocation est l'essence de l'adoration.", texteAr: 'الدعاء هو العبادة', source: 'Hadith Tirmidhi', actif: true },
  { texteFr: "Quiconque croit en Allah et au Jour Dernier, qu'il honore son voisin.", texteAr: 'من كان يؤمن بالله واليوم الآخر فليكرم جاره', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "Préserve Allah, Il te préservera.", texteAr: 'احفظ الله يحفظك', source: 'Hadith Tirmidhi', actif: true },
  { texteFr: "La patience est lumière.", texteAr: 'والصبر ضياء', source: 'Hadith Muslim', actif: true },
  { texteFr: "Certes, Allah est Beau et Il aime la beauté.", texteAr: 'إن الله جميل يحب الجمال', source: 'Hadith Muslim', actif: true },
  { texteFr: "Le meilleur d'entre vous est celui qui est le plus utile aux gens.", texteAr: 'خير الناس أنفعهم للناس', source: 'Hadith Tabarani', actif: true },
  { texteFr: "Celui qui n'est pas miséricordieux envers les gens, Allah ne sera pas miséricordieux envers lui.", texteAr: 'من لا يرحم الناس لا يرحمه الله', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "Délaisse ce qui te fait douter pour ce qui ne te fait pas douter.", texteAr: 'دع ما يريبك إلى ما لا يريبك', source: "Hadith Tirmidhi & Nasa'i", actif: true },
  { texteFr: "Le Coran intercédera pour ses compagnons le Jour de la Résurrection.", texteAr: 'اقرؤوا القرآن فإنه يأتي يوم القيامة شفيعاً لأصحابه', source: 'Hadith Muslim', actif: true },
  { texteFr: "La recherche du savoir est une obligation pour chaque musulman.", texteAr: 'طلب العلم فريضة على كل مسلم', source: 'Hadith Ibn Majah', actif: true },
  { texteFr: "Les meilleurs d'entre vous sont ceux qui ont le meilleur comportement envers leurs épouses.", texteAr: 'خياركم خياركم لنسائهم', source: 'Hadith Tirmidhi', actif: true },
  { texteFr: "Celui qui montre le chemin vers un bien a la même récompense que celui qui l'accomplit.", texteAr: 'الدال على الخير كفاعله', source: 'Hadith Muslim', actif: true },
  { texteFr: "Dis la vérité même si elle est amère.", texteAr: 'قل الحق ولو كان مراً', source: 'Hadith Ibn Hibban', actif: true },
  { texteFr: "Allah ne regarde pas vos corps ni vos apparences, mais Il regarde vos cœurs.", texteAr: 'إن الله لا ينظر إلى أجسادكم ولا إلى صوركم ولكن ينظر إلى قلوبكم', source: 'Hadith Muslim', actif: true },
  { texteFr: "Quiconque fait ses ablutions parfaitement, ses péchés sortent de son corps.", texteAr: 'من توضأ فأحسن الوضوء خرجت خطاياه من جسده', source: 'Hadith Muslim', actif: true },
  { texteFr: "La prière est la clé du Paradis.", texteAr: 'مفتاح الجنة الصلاة', source: 'Hadith Ahmad', actif: true },
  { texteFr: "Celui qui jeûne le mois de Ramadan avec foi et espérance verra ses péchés passés pardonnés.", texteAr: 'من صام رمضان إيماناً واحتساباً غفر له ما تقدم من ذنبه', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "Les liens de parenté sont suspendus au Trône, et ils disent : Celui qui nous maintient, Allah le maintiendra.", texteAr: 'الرحم معلقة بالعرش تقول من وصلني وصله الله', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "Évitez les sept péchés destructeurs.", texteAr: 'اجتنبوا السبع الموبقات', source: 'Hadith Bukhari & Muslim', actif: true },
  { texteFr: "La main supérieure est meilleure que la main inférieure.", texteAr: 'اليد العليا خير من اليد السفلى', source: 'Hadith Bukhari & Muslim', actif: true },
]

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
  const [importing, setImporting] = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false)

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
      if (import.meta.env.DEV) console.error('Error fetching rappels:', error)
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
      if (import.meta.env.DEV) console.error('Error saving rappel:', err)
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
      if (import.meta.env.DEV) console.error('Error toggling rappel:', err)
      toast.error('Erreur lors de la modification')
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'rappels', id))
      toast.success('Rappel supprimé')
      setDeleteConfirm(null)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error deleting rappel:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleImportDefaults = async () => {
    setImporting(true)
    try {
      // Vérifier les doublons existants
      const existingSnapshot = await getDocs(collection(db, 'rappels'))
      const existingTexts = new Set(
        existingSnapshot.docs.map(doc => doc.data().texteFr?.toLowerCase().trim())
      )

      // Filtrer les hadiths déjà existants
      const newHadiths = defaultHadiths.filter(
        hadith => !existingTexts.has(hadith.texteFr?.toLowerCase().trim())
      )

      if (newHadiths.length === 0) {
        toast.info('Tous les hadiths existent déjà dans la collection')
        setShowImportConfirm(false)
        setImporting(false)
        return
      }

      const batch = writeBatch(db)
      const rappelsRef = collection(db, 'rappels')

      // Ajouter uniquement les nouveaux hadiths
      for (const hadith of newHadiths) {
        const newDocRef = doc(rappelsRef)
        batch.set(newDocRef, {
          ...hadith,
          createdAt: new Date().toISOString()
        })
      }

      await batch.commit()

      const skipped = defaultHadiths.length - newHadiths.length
      if (skipped > 0) {
        toast.success(`${newHadiths.length} hadiths importés (${skipped} doublons ignorés)`)
      } else {
        toast.success(`${newHadiths.length} hadiths importés avec succès`)
      }
      setShowImportConfirm(false)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error importing hadiths:', err)
      toast.error('Erreur lors de l\'import')
    } finally {
      setImporting(false)
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
        <div className="flex gap-2">
          {rappels.length === 0 && (
            <Button variant="secondary" onClick={() => setShowImportConfirm(true)}>
              <Download className="w-4 h-4 mr-2" />
              Importer 37 hadiths
            </Button>
          )}
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau rappel
          </Button>
        </div>
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

      {/* Banner import si collection vide */}
      {rappels.length === 0 && !searchTerm && (
        <Card className="p-6 bg-gradient-to-r from-secondary/20 to-primary/20 border-secondary/30">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="p-3 bg-secondary/20 rounded-full">
              <Download className="w-8 h-8 text-secondary" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-semibold text-white">Collection vide</h3>
              <p className="text-white/70 text-sm mt-1">
                Importez les 37 hadiths par défaut pour démarrer rapidement. Vous pourrez les modifier ou en ajouter d'autres ensuite.
              </p>
            </div>
            <Button onClick={() => setShowImportConfirm(true)} loading={importing}>
              <Download className="w-4 h-4 mr-2" />
              Importer les hadiths
            </Button>
          </div>
        </Card>
      )}

      {/* Liste des rappels */}
      {filteredRappels.length === 0 && rappels.length > 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucun résultat"
          description="Aucun rappel ne correspond à votre recherche"
        />
      ) : filteredRappels.length === 0 && rappels.length === 0 && searchTerm ? (
        <EmptyState
          icon={BookOpen}
          title="Aucun rappel"
          description="Commencez par importer les hadiths par défaut ou ajoutez-en manuellement"
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowImportConfirm(true)}>
                <Download className="w-4 h-4 mr-2" />
                Importer
              </Button>
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </div>
          }
        />
      ) : filteredRappels.length > 0 ? (
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
      ) : null}

      {/* Modal Ajout/Modification */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingRappel ? 'Modifier le rappel' : 'Nouveau rappel'}
        size="xl"
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

      {/* Modal Confirmation Import */}
      <Modal
        isOpen={showImportConfirm}
        onClose={() => setShowImportConfirm(false)}
        title="Importer les hadiths par défaut"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium">Attention</p>
              <p className="text-white/70 text-sm mt-1">
                Cette action va ajouter {defaultHadiths.length} hadiths à votre collection.
                Si vous avez déjà des rappels, ils ne seront pas supprimés.
              </p>
            </div>
          </div>
          <p className="text-white/70">
            Les hadiths importés incluent des citations de Bukhari, Muslim, Tirmidhi et d'autres recueils authentiques.
            Vous pourrez les modifier ou les supprimer individuellement par la suite.
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowImportConfirm(false)}>
            Annuler
          </Button>
          <Button onClick={handleImportDefaults} loading={importing}>
            <Download className="w-4 h-4 mr-2" />
            Importer {defaultHadiths.length} hadiths
          </Button>
        </div>
      </Modal>
    </div>
  )
}
