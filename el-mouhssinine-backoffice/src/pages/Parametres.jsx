import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import {
  Settings, Save, Building2, MapPin, Phone, Mail, Globe, Clock,
  Palette, Database, Landmark, Image, Upload, CreditCard
} from 'lucide-react'
import { Card, Button, Input, Textarea, Toggle, Loading } from '../components/common'
import { getSettings, updateSettings, getMosqueeInfo, updateMosqueeInfo, storage, getCotisationPrices, updateCotisationPrices } from '../services/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../context/AuthContext'

export default function Parametres() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('mosquee')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [uploading, setUploading] = useState(false)

  const [mosqueeInfo, setMosqueeInfo] = useState({
    nom: 'Mosquée El Mouhssinine',
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [mosquee, general, cotisation] = await Promise.all([
        getMosqueeInfo(),
        getSettings(),
        getCotisationPrices()
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
    } catch (err) {
      console.error('Error loading settings:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
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

    setUploading(true)
    try {
      const storageRef = ref(storage, 'settings/header-image.png')
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)

      // Mettre à jour les infos mosquée avec l'URL
      const newMosqueeInfo = { ...mosqueeInfo, headerImageUrl: url }
      await updateMosqueeInfo(newMosqueeInfo)
      setMosqueeInfo(newMosqueeInfo)

      toast.success('Image d\'en-tête uploadée avec succès !')
    } catch (error) {
      console.error('Erreur upload:', error)
      toast.error('Erreur lors de l\'upload de l\'image')
    } finally {
      setUploading(false)
    }
  }

  const tabs = [
    { id: 'mosquee', label: 'Mosquée', icon: Building2 },
    { id: 'header', label: 'Image d\'en-tête', icon: Image },
    { id: 'banque', label: 'Coordonnées bancaires', icon: Landmark },
    { id: 'cotisation', label: 'Cotisations', icon: CreditCard },
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
              placeholder="Mosquée El Mouhssinine"
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

            {/* Aperçu */}
            {mosqueeInfo.headerImageUrl && (
              <div className="space-y-3">
                <p className="text-white font-medium">Aperçu actuel :</p>
                <img
                  src={mosqueeInfo.headerImageUrl}
                  alt="Header"
                  className="w-full max-h-48 object-cover rounded-xl border border-white/10"
                />
                <p className="text-white/50 text-xs">
                  L'image sera affichée en pleine largeur sur l'écran d'accueil de l'app
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
              placeholder="Association El Mouhssinine"
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
                💡 <strong>Note :</strong> Le paiement mensuel n'est pas récurrent automatiquement.
                Les membres devront renouveler manuellement chaque mois.
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
    </div>
  )
}
