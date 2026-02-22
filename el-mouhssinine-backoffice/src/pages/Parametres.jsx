import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import {
  Settings, Save, Building2, MapPin, Phone, Mail, Globe, Clock,
  Palette, Database, Landmark, Image, Upload, CreditCard, ScrollText, Trash2, Check, X, Stamp
} from 'lucide-react'
import { Card, Button, Input, Textarea, Toggle, Loading, ConfirmModal } from '../components/common'
import { getSettings, updateSettings, getMosqueeInfo, updateMosqueeInfo, storage, getCotisationPrices, updateCotisationPrices, getReglement, updateReglement, db } from '../services/firebase'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'

export default function Parametres() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('mosquee')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [pendingHeaderImage, setPendingHeaderImage] = useState(null) // URL pour preview
  const [pendingHeaderFile, setPendingHeaderFile] = useState(null) // Fichier original
  const [deleteImageModal, setDeleteImageModal] = useState(false)

  const [mosqueeInfo, setMosqueeInfo] = useState({
    nom: 'Mosquée El Mohsinine',
    adresse: '',
    codePostal: '',
    ville: 'Bourg-en-Bresse',
    telephone: '',
    email: '',
    siteWeb: '',
    description: '',
    // Coordonnées bancaires
    iban: '',
    bic: '',
    bankName: '',
    accountHolder: '',
    // Image d'en-tête
    headerImageUrl: ''
  })

  const [settings, setSettings] = useState({
    notifications: {
      prayerReminders: true,
      reminderMinutes: 15,
      prayers: {
        Fajr: true,
        Dhuhr: true,
        Asr: true,
        Maghrib: true,
        Isha: true
      },
      eventReminders: true,
      janazaAlerts: true,
      generalAnnouncements: true
    },
    display: {
      showIqama: true,
      showSunrise: true,
      darkMode: true
    },
    maintenance: {
      enabled: false,
      message: ''
    }
  })

  // Prix des cotisations
  const [cotisationPrices, setCotisationPrices] = useState({
    mensuel: 10,
    annuel: 100
  })

  // Règlement intérieur
  const [reglement, setReglement] = useState({
    contenu: '',
    updatedAt: null
  })

  // Association info
  const [associationInfo, setAssociationInfo] = useState({
    nom: '',
    adresse: '',
    codePostal: '',
    ville: '',
    siren: '',
    statut: 'Association cultuelle loi 1905',
    objet: 'Exercice du culte musulman',
    signataire: 'Le Président',
    nomSignataire: '',
    signatureUrl: '',
    cachetUrl: '',
  })
  const [signatureFile, setSignatureFile] = useState(null)
  const [cachetFile, setCachetFile] = useState(null)
  const [savingAssociation, setSavingAssociation] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [mosquee, general, cotisation, reglementData] = await Promise.all([
        getMosqueeInfo(),
        getSettings(),
        getCotisationPrices(),
        getReglement()
      ])

      if (mosquee) {
        setMosqueeInfo(prev => ({ ...prev, ...mosquee }))
      }
      if (general) {
        setSettings(prev => ({
          ...prev,
          notifications: { ...prev.notifications, ...general.notifications },
          display: { ...prev.display, ...general.display },
          maintenance: { ...prev.maintenance, ...general.maintenance }
        }))
      }
      if (cotisation) {
        setCotisationPrices(prev => ({ ...prev, ...cotisation }))
      }
      if (reglementData) {
        setReglement(prev => ({ ...prev, ...reglementData }))
      }

      // Load association info
      await loadAssociationInfo()
    } catch (err) {
      console.error('Error loading settings:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const loadAssociationInfo = async () => {
    try {
      // Try loading from settings/association first
      const associationDocRef = doc(db, 'settings', 'association')
      const associationDoc = await getDoc(associationDocRef)

      if (associationDoc.exists()) {
        setAssociationInfo(prev => ({ ...prev, ...associationDoc.data() }))
      } else {
        // Fallback: load from settings/recusFiscaux for backward compatibility
        const recusDocRef = doc(db, 'settings', 'recusFiscaux')
        const recusDoc = await getDoc(recusDocRef)

        if (recusDoc.exists()) {
          setAssociationInfo(prev => ({ ...prev, ...recusDoc.data() }))
        }
      }
    } catch (err) {
      console.error('Error loading association info:', err)
    }
  }

  const handleSaveMosquee = async () => {
    setSaving(true)
    try {
      await updateMosqueeInfo(mosqueeInfo)
      toast.success('Informations de la mosquée enregistrées')
    } catch (err) {
      console.error('Error saving mosquee info:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await updateSettings(settings)
      toast.success('Paramètres enregistrés')
    } catch (err) {
      console.error('Error saving settings:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCotisation = async () => {
    setSaving(true)
    try {
      await updateCotisationPrices(cotisationPrices)
      toast.success('Prix des cotisations enregistrés')
    } catch (err) {
      console.error('Error saving cotisation prices:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveReglement = async () => {
    setSaving(true)
    try {
      await updateReglement(reglement)
      toast.success('Règlement intérieur enregistré')
    } catch (err) {
      console.error('Error saving reglement:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAssociation = async () => {
    setSavingAssociation(true)
    try {
      let updatedInfo = { ...associationInfo }

      // Upload signature if provided
      if (signatureFile) {
        const signatureRef = ref(storage, 'settings/signature-president.png')
        await uploadBytes(signatureRef, signatureFile)
        const signatureUrl = await getDownloadURL(signatureRef)
        updatedInfo.signatureUrl = signatureUrl
        setSignatureFile(null)
      }

      // Upload cachet if provided
      if (cachetFile) {
        const cachetRef = ref(storage, 'settings/cachet-association.png')
        await uploadBytes(cachetRef, cachetFile)
        const cachetUrl = await getDownloadURL(cachetRef)
        updatedInfo.cachetUrl = cachetUrl
        setCachetFile(null)
      }

      // Save to settings/association
      const associationDocRef = doc(db, 'settings', 'association')
      await setDoc(associationDocRef, updatedInfo, { merge: true })

      // Also update settings/recusFiscaux for backward compatibility
      const recusDocRef = doc(db, 'settings', 'recusFiscaux')
      await setDoc(recusDocRef, updatedInfo, { merge: true })

      setAssociationInfo(updatedInfo)
      toast.success('Informations de l\'association enregistrées')
    } catch (err) {
      console.error('Error saving association info:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSavingAssociation(false)
    }
  }

  const handleHeaderImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image')
      return
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 5MB')
      return
    }

    // Créer une URL locale pour preview (pas d'upload encore)
    const previewUrl = URL.createObjectURL(file)
    setPendingHeaderImage(previewUrl)
    setPendingHeaderFile(file)
    toast.info('Image chargée. Cliquez sur "Enregistrer" pour valider.')
  }

  // Valider et enregistrer l'image en attente
  const handleSaveHeaderImage = async () => {
    if (!pendingHeaderFile) return

    setUploading(true)
    try {
      // Upload direct du fichier vers l'emplacement final
      const storageRef = ref(storage, 'settings/header-image.png')
      await uploadBytes(storageRef, pendingHeaderFile)
      const url = await getDownloadURL(storageRef)

      // Mettre à jour Firestore
      const newMosqueeInfo = { ...mosqueeInfo, headerImageUrl: url }
      await updateMosqueeInfo(newMosqueeInfo)
      setMosqueeInfo(newMosqueeInfo)

      // Nettoyer
      if (pendingHeaderImage) {
        URL.revokeObjectURL(pendingHeaderImage)
      }
      setPendingHeaderImage(null)
      setPendingHeaderFile(null)
      toast.success('Image d\'en-tête enregistrée avec succès !')
    } catch (error) {
      console.error('Erreur enregistrement:', error)
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setUploading(false)
    }
  }

  // Annuler l'image en attente
  const handleCancelHeaderImage = () => {
    if (pendingHeaderImage) {
      URL.revokeObjectURL(pendingHeaderImage)
    }
    setPendingHeaderImage(null)
    setPendingHeaderFile(null)
    toast.info('Modification annulée')
  }

  const handleDeleteHeaderImage = () => {
    if (!mosqueeInfo.headerImageUrl) return
    setDeleteImageModal(true)
  }

  const handleConfirmDeleteImage = async () => {
    setDeleteImageModal(false)
    setUploading(true)
    try {
      // Supprimer l'image de Firebase Storage
      const storageRef = ref(storage, 'settings/header-image.png')
      await deleteObject(storageRef)

      // Mettre à jour les infos mosquée sans l'URL
      const newMosqueeInfo = { ...mosqueeInfo, headerImageUrl: '' }
      await updateMosqueeInfo(newMosqueeInfo)
      setMosqueeInfo(newMosqueeInfo)

      toast.success('Image supprimée avec succès')
    } catch (error) {
      console.error('Erreur suppression:', error)
      // Si l'image n'existe pas dans Storage, on nettoie quand même l'URL
      if (error.code === 'storage/object-not-found') {
        const newMosqueeInfo = { ...mosqueeInfo, headerImageUrl: '' }
        await updateMosqueeInfo(newMosqueeInfo)
        setMosqueeInfo(newMosqueeInfo)
        toast.success('Référence image supprimée')
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } finally {
      setUploading(false)
    }
  }

  const tabs = [
    { id: 'mosquee', label: 'Mosquée', icon: Building2 },
    { id: 'association', label: 'Association (CERFA)', icon: Stamp },
    { id: 'header', label: 'Image d\'en-tête', icon: Image },
    { id: 'banque', label: 'Coordonnées bancaires', icon: Landmark },
    { id: 'cotisation', label: 'Cotisations', icon: CreditCard },
    { id: 'reglement', label: 'Règlement', icon: ScrollText },
    { id: 'display', label: 'Affichage', icon: Palette },
    { id: 'system', label: 'Système', icon: Database }
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
      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-secondary text-white'
                : 'text-white/70 hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mosquée Tab */}
      {activeTab === 'mosquee' && (
        <Card title="Informations de la mosquée" icon={Building2}>
          <div className="space-y-4">
            <Input
              label="Nom de la mosquée"
              value={mosqueeInfo.nom}
              onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, nom: e.target.value })}
              placeholder="Mosquée El Mohsinine"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Adresse"
                value={mosqueeInfo.adresse}
                onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, adresse: e.target.value })}
                placeholder="123 rue Example"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Code postal"
                  value={mosqueeInfo.codePostal}
                  onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, codePostal: e.target.value })}
                  placeholder="93500"
                />
                <Input
                  label="Ville"
                  value={mosqueeInfo.ville}
                  onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, ville: e.target.value })}
                  placeholder="Pantin"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Téléphone"
                value={mosqueeInfo.telephone}
                onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, telephone: e.target.value })}
                placeholder="01 23 45 67 89"
              />
              <Input
                label="Email"
                type="email"
                value={mosqueeInfo.email}
                onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, email: e.target.value })}
                placeholder="contact@elmouhssinine.org"
              />
            </div>
            <Input
              label="Site web"
              value={mosqueeInfo.siteWeb}
              onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, siteWeb: e.target.value })}
              placeholder="https://elmouhssinine.org"
            />
            <Textarea
              label="Description"
              value={mosqueeInfo.description}
              onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, description: e.target.value })}
              placeholder="Brève description de la mosquée..."
              rows={3}
            />
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveMosquee} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </Card>
      )}

      {/* Association Tab */}
      {activeTab === 'association' && (
        <Card title="Informations de l'association (CERFA)" icon={Stamp}>
          <p className="text-white/60 text-sm mb-6">
            Ces informations seront utilisées pour générer automatiquement les reçus fiscaux (CERFA).
            <br />
            <span className="text-accent">Remplissez tous les champs pour des reçus conformes.</span>
          </p>
          <div className="space-y-4">
            <Input
              label="Nom de l'association"
              value={associationInfo.nom}
              onChange={(e) => setAssociationInfo({ ...associationInfo, nom: e.target.value })}
              placeholder="Association El Mohsinine"
            />
            <Input
              label="Adresse"
              value={associationInfo.adresse}
              onChange={(e) => setAssociationInfo({ ...associationInfo, adresse: e.target.value })}
              placeholder="123 rue Example"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Code postal"
                value={associationInfo.codePostal}
                onChange={(e) => setAssociationInfo({ ...associationInfo, codePostal: e.target.value })}
                placeholder="01000"
              />
              <Input
                label="Ville"
                value={associationInfo.ville}
                onChange={(e) => setAssociationInfo({ ...associationInfo, ville: e.target.value })}
                placeholder="Bourg-en-Bresse"
              />
            </div>
            <Input
              label="N° SIREN ou RNA"
              value={associationInfo.siren}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 14)
                setAssociationInfo({ ...associationInfo, siren: value })
              }}
              placeholder="123456789 ou W012345678"
              maxLength={14}
            />
            <Input
              label="Statut juridique"
              value={associationInfo.statut}
              onChange={(e) => setAssociationInfo({ ...associationInfo, statut: e.target.value })}
              placeholder="Association cultuelle loi 1905"
            />
            <Textarea
              label="Objet de l'association"
              value={associationInfo.objet}
              onChange={(e) => setAssociationInfo({ ...associationInfo, objet: e.target.value })}
              placeholder="Exercice du culte musulman"
              rows={3}
            />
            <Input
              label="Qualité du signataire"
              value={associationInfo.signataire}
              onChange={(e) => setAssociationInfo({ ...associationInfo, signataire: e.target.value })}
              placeholder="Le Président"
            />
            <Input
              label="Nom du signataire"
              value={associationInfo.nomSignataire}
              onChange={(e) => setAssociationInfo({ ...associationInfo, nomSignataire: e.target.value })}
              placeholder="Mohamed BENALI"
            />

            {/* Signature upload */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-white">
                Signature du président
              </label>
              <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-accent transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSignatureFile(e.target.files[0])}
                  className="hidden"
                  id="signature-input"
                />
                <label
                  htmlFor="signature-input"
                  className="cursor-pointer"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-white/40" />
                  <p className="text-white font-medium mb-1">
                    {signatureFile ? signatureFile.name : 'Cliquez pour sélectionner une signature'}
                  </p>
                  <p className="text-white/50 text-sm">PNG, JPG jusqu'à 5MB</p>
                </label>
              </div>
              {associationInfo.signatureUrl && !signatureFile && (
                <div className="space-y-2">
                  <p className="text-white/70 text-sm">Signature actuelle :</p>
                  <img
                    src={associationInfo.signatureUrl}
                    alt="Signature"
                    className="max-h-24 object-contain border border-white/10 rounded-lg p-2 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Cachet upload */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-white">
                Cachet de l'association
              </label>
              <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-accent transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCachetFile(e.target.files[0])}
                  className="hidden"
                  id="cachet-input"
                />
                <label
                  htmlFor="cachet-input"
                  className="cursor-pointer"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-white/40" />
                  <p className="text-white font-medium mb-1">
                    {cachetFile ? cachetFile.name : 'Cliquez pour sélectionner un cachet'}
                  </p>
                  <p className="text-white/50 text-sm">PNG, JPG jusqu'à 5MB</p>
                </label>
              </div>
              {associationInfo.cachetUrl && !cachetFile && (
                <div className="space-y-2">
                  <p className="text-white/70 text-sm">Cachet actuel :</p>
                  <img
                    src={associationInfo.cachetUrl}
                    alt="Cachet"
                    className="max-h-24 object-contain border border-white/10 rounded-lg p-2 bg-white"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveAssociation} loading={savingAssociation}>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </Card>
      )}

      {/* Header Image Tab */}
      {activeTab === 'header' && (
        <Card title="Image d'en-tête de l'accueil" icon={Image}>
          <p className="text-white/60 text-sm mb-6">
            Cette image s'affichera en haut de l'écran d'accueil de l'application mobile.
            <br />
            <span className="text-accent">Dimensions recommandées : 1290 x 400 pixels</span>
          </p>

          <div className="space-y-6">
            {/* Zone d'upload */}
            {!pendingHeaderImage && (
              <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-accent transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHeaderImageUpload}
                  disabled={uploading}
                  className="hidden"
                  id="header-image-input"
                />
                <label
                  htmlFor="header-image-input"
                  className={`cursor-pointer ${uploading ? 'opacity-50' : ''}`}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-white/40" />
                  <p className="text-white font-medium mb-2">
                    {uploading ? 'Upload en cours...' : 'Cliquez pour sélectionner une image'}
                  </p>
                  <p className="text-white/50 text-sm">PNG, JPG jusqu'à 5MB</p>
                </label>
              </div>
            )}

            {/* Image en attente de validation */}
            {pendingHeaderImage && (
              <div className="space-y-4 p-4 bg-accent/10 border border-accent/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                  <p className="text-accent font-medium">Nouvelle image en attente de validation</p>
                </div>
                <img
                  src={pendingHeaderImage}
                  alt="Nouvelle image"
                  className="w-full max-h-48 object-cover rounded-xl border border-accent/30"
                />
                <div className="flex gap-3">
                  <Button
                    variant="success"
                    onClick={handleSaveHeaderImage}
                    disabled={uploading}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Enregistrer
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleCancelHeaderImage}
                    disabled={uploading}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {/* Aperçu image actuelle */}
            {mosqueeInfo.headerImageUrl && !pendingHeaderImage && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium">Image actuelle :</p>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteHeaderImage}
                    disabled={uploading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                </div>
                <img
                  src={mosqueeInfo.headerImageUrl}
                  alt="Header"
                  className="w-full max-h-48 object-cover rounded-xl border border-white/10"
                />
                <p className="text-white/50 text-xs">
                  ✓ Image active sur l'écran d'accueil de l'application
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Banque Tab */}
      {activeTab === 'banque' && (
        <Card title="Coordonnées bancaires" icon={Landmark}>
          <p className="text-white/60 text-sm mb-6">
            Ces informations seront affichées dans l'application mobile pour les dons par virement.
          </p>
          <div className="space-y-4">
            <Input
              label="Titulaire du compte"
              value={mosqueeInfo.accountHolder}
              onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, accountHolder: e.target.value })}
              placeholder="Association El Mohsinine"
            />
            <Input
              label="Nom de la banque"
              value={mosqueeInfo.bankName}
              onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, bankName: e.target.value })}
              placeholder="Crédit Agricole"
            />
            <Input
              label="IBAN"
              value={mosqueeInfo.iban}
              onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, iban: e.target.value })}
              placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            />
            <Input
              label="BIC / SWIFT"
              value={mosqueeInfo.bic}
              onChange={(e) => setMosqueeInfo({ ...mosqueeInfo, bic: e.target.value })}
              placeholder="AGRIFRPP"
            />
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveMosquee} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </Card>
      )}

      {/* Cotisations Tab */}
      {activeTab === 'cotisation' && (
        <Card title="Prix des cotisations" icon={CreditCard}>
          <p className="text-white/60 text-sm mb-6">
            Définissez les prix des cotisations pour les membres.
            Ces prix seront utilisés dans l'application mobile.
          </p>
          <div className="space-y-4">
            <Input
              label="Prix mensuel (€)"
              type="number"
              value={cotisationPrices.mensuel}
              onChange={(e) => setCotisationPrices({ ...cotisationPrices, mensuel: parseFloat(e.target.value) || 0 })}
              placeholder="10"
            />
            <Input
              label="Prix annuel (€)"
              type="number"
              value={cotisationPrices.annuel}
              onChange={(e) => setCotisationPrices({ ...cotisationPrices, annuel: parseFloat(e.target.value) || 0 })}
              placeholder="100"
            />
            <div className="bg-white/5 rounded-lg p-4 mt-4">
              <p className="text-white/70 text-sm">
                💡 <strong>Note :</strong> Le paiement mensuel est récurrent automatiquement via Stripe.
                Les membres peuvent annuler leur abonnement depuis leur espace dans l'application.
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveCotisation} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </Card>
      )}

      {/* Règlement Tab */}
      {activeTab === 'reglement' && (
        <Card title="Statuts et Règlement Intérieur" icon={ScrollText}>
          <p className="text-white/60 text-sm mb-6">
            Ce texte sera affiché aux membres lors de leur demande d'adhésion.
            <br />
            <span className="text-accent">Ils devront le lire en entier et l'accepter avant de pouvoir payer.</span>
          </p>
          <div className="space-y-4">
            <Textarea
              label="Contenu du règlement"
              value={reglement.contenu}
              onChange={(e) => setReglement({ ...reglement, contenu: e.target.value })}
              placeholder="Entrez ici les statuts et le règlement intérieur de l'association...

Exemple:
ARTICLE 1 - OBJET
L'association a pour objet...

ARTICLE 2 - CONDITIONS D'ADHÉSION
Pour devenir membre actif, il faut..."
              rows={20}
            />
            {reglement.updatedAt && (
              <p className="text-white/40 text-sm">
                Dernière modification : {
                  reglement.updatedAt?.toDate
                    ? reglement.updatedAt.toDate().toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : new Date(reglement.updatedAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                }
              </p>
            )}
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveReglement} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </Card>
      )}

      {/* Display Tab */}
      {activeTab === 'display' && (
        <Card title="Paramètres d'affichage" icon={Palette}>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/10">
              <div>
                <p className="text-white font-medium">Afficher l'Iqama</p>
                <p className="text-sm text-white/50">Montrer les heures d'Iqama sur l'app</p>
              </div>
              <Toggle
                checked={settings.display.showIqama}
                onChange={(checked) => setSettings({
                  ...settings,
                  display: { ...settings.display, showIqama: checked }
                })}
              />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/10">
              <div>
                <p className="text-white font-medium">Afficher le lever du soleil</p>
                <p className="text-sm text-white/50">Montrer l'heure du Shurûq</p>
              </div>
              <Toggle
                checked={settings.display.showSunrise}
                onChange={(checked) => setSettings({
                  ...settings,
                  display: { ...settings.display, showSunrise: checked }
                })}
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-white font-medium">Mode sombre par défaut</p>
                <p className="text-sm text-white/50">Thème sombre pour l'application mobile</p>
              </div>
              <Toggle
                checked={settings.display.darkMode}
                onChange={(checked) => setSettings({
                  ...settings,
                  display: { ...settings.display, darkMode: checked }
                })}
              />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveSettings} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </Card>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <Card title="Mode maintenance" icon={Database}>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-white/10">
                <div>
                  <p className="text-white font-medium">Activer le mode maintenance</p>
                  <p className="text-sm text-white/50">
                    L'application affichera un message de maintenance
                  </p>
                </div>
                <Toggle
                  checked={settings.maintenance.enabled}
                  onChange={(checked) => setSettings({
                    ...settings,
                    maintenance: { ...settings.maintenance, enabled: checked }
                  })}
                />
              </div>
              {settings.maintenance.enabled && (
                <Textarea
                  label="Message de maintenance"
                  value={settings.maintenance.message}
                  onChange={(e) => setSettings({
                    ...settings,
                    maintenance: { ...settings.maintenance, message: e.target.value }
                  })}
                  placeholder="L'application est en maintenance. Veuillez réessayer plus tard."
                  rows={3}
                />
              )}
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={handleSaveSettings} loading={saving}>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </Card>

          <Card title="Informations système">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-white/50">Version du backoffice</span>
                <span className="text-white">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-white/50">Environnement</span>
                <span className="text-white">Production</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-white/50">Projet Firebase</span>
                <span className="text-white">el-mouhssinine</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/50">Connecté en tant que</span>
                <span className="text-white">{user?.email || 'N/A'}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Image Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteImageModal}
        onClose={() => setDeleteImageModal(false)}
        onConfirm={handleConfirmDeleteImage}
        title="Supprimer l'image"
        message="Êtes-vous sûr de vouloir supprimer cette image ?"
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}
