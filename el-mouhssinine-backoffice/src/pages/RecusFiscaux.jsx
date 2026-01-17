import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import {
  FileText, Save, Building2, MapPin, User, Send, Download,
  Calendar, Euro, Search, RefreshCw, CheckCircle, AlertCircle
} from 'lucide-react'
import { Card, Button, Input, Loading } from '../components/common'
import { db } from '../services/firebase'
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'

export default function RecusFiscaux() {
  const [activeTab, setActiveTab] = useState('parametres')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Paramètres de l'association
  const [associationInfo, setAssociationInfo] = useState({
    nom: '',
    adresse: '',
    codePostal: '',
    ville: '',
    siren: '',
    statut: 'Association cultuelle loi 1905',
    signataire: 'Le Président',
    nomSignataire: ''
  })

  // Liste des reçus envoyés
  const [recusEnvoyes, setRecusEnvoyes] = useState([])
  const [loadingRecus, setLoadingRecus] = useState(false)

  // Envoi manuel
  const [emailManuel, setEmailManuel] = useState('')
  const [anneeManuelle, setAnneeManuelle] = useState(new Date().getFullYear() - 1)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Charger les paramètres
      const settingsDoc = await getDoc(doc(db, 'settings', 'recusFiscaux'))
      if (settingsDoc.exists()) {
        setAssociationInfo(prev => ({ ...prev, ...settingsDoc.data() }))
      }

      // Charger les reçus envoyés
      await loadRecusEnvoyes()
    } catch (err) {
      console.error('Erreur chargement:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const loadRecusEnvoyes = async () => {
    setLoadingRecus(true)
    try {
      const q = query(
        collection(db, 'recus_fiscaux'),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
      const snapshot = await getDocs(q)
      const recus = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()
      }))
      setRecusEnvoyes(recus)
    } catch (err) {
      console.error('Erreur chargement reçus:', err)
    } finally {
      setLoadingRecus(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'recusFiscaux'), associationInfo)
      toast.success('Paramètres enregistrés')
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSendRecu = async () => {
    if (!emailManuel) {
      toast.error('Veuillez saisir un email')
      return
    }

    // Vérifier que les paramètres sont configurés
    if (!associationInfo.nom || !associationInfo.siren) {
      toast.error('Veuillez d\'abord configurer les paramètres de l\'association')
      setActiveTab('parametres')
      return
    }

    setSending(true)
    try {
      const functions = getFunctions(undefined, 'europe-west1')
      const sendRecuFiscal = httpsCallable(functions, 'sendRecuFiscal')

      const result = await sendRecuFiscal({
        email: emailManuel,
        annee: anneeManuelle
      })

      toast.success(`Reçu envoyé ! Montant: ${result.data.montantTotal?.toFixed(2)}€`)
      setEmailManuel('')
      await loadRecusEnvoyes()
    } catch (err) {
      console.error('Erreur envoi:', err)
      const message = err.message || 'Erreur lors de l\'envoi'
      if (message.includes('not-found')) {
        toast.error(`Aucun don trouvé pour ${anneeManuelle}`)
      } else if (message.includes('failed-precondition')) {
        toast.error('Configuration incomplète (email Brevo ou paramètres)')
      } else {
        toast.error(message)
      }
    } finally {
      setSending(false)
    }
  }

  const tabs = [
    { id: 'parametres', label: 'Paramètres', icon: Building2 },
    { id: 'envoyer', label: 'Envoyer un reçu', icon: Send },
    { id: 'historique', label: 'Historique', icon: FileText }
  ]

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reçus Fiscaux</h1>
            <p className="text-gray-500">Génération et envoi des reçus fiscaux aux donateurs</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'parametres' && (
        <Card>
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Building2 className="w-5 h-5" />
              Informations de l'association
            </div>
            <p className="text-sm text-gray-500">
              Ces informations apparaîtront sur tous les reçus fiscaux générés.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nom de l'association *"
                value={associationInfo.nom}
                onChange={e => setAssociationInfo(prev => ({ ...prev, nom: e.target.value }))}
                placeholder="Association El Mouhssinine"
              />
              <Input
                label="N° SIREN ou RNA *"
                value={associationInfo.siren}
                onChange={e => setAssociationInfo(prev => ({ ...prev, siren: e.target.value }))}
                placeholder="W012345678 ou 123456789"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Adresse *"
                  value={associationInfo.adresse}
                  onChange={e => setAssociationInfo(prev => ({ ...prev, adresse: e.target.value }))}
                  placeholder="123 rue de la Mosquée"
                />
              </div>
              <Input
                label="Code postal *"
                value={associationInfo.codePostal}
                onChange={e => setAssociationInfo(prev => ({ ...prev, codePostal: e.target.value }))}
                placeholder="01000"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Ville *"
                value={associationInfo.ville}
                onChange={e => setAssociationInfo(prev => ({ ...prev, ville: e.target.value }))}
                placeholder="Bourg-en-Bresse"
              />
              <Input
                label="Statut juridique"
                value={associationInfo.statut}
                onChange={e => setAssociationInfo(prev => ({ ...prev, statut: e.target.value }))}
                placeholder="Association cultuelle loi 1905"
              />
            </div>

            <hr className="my-6" />

            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <User className="w-5 h-5" />
              Signataire
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Qualité du signataire"
                value={associationInfo.signataire}
                onChange={e => setAssociationInfo(prev => ({ ...prev, signataire: e.target.value }))}
                placeholder="Le Président"
              />
              <Input
                label="Nom du signataire *"
                value={associationInfo.nomSignataire}
                onChange={e => setAssociationInfo(prev => ({ ...prev, nomSignataire: e.target.value }))}
                placeholder="Mohamed Dupont"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'envoyer' && (
        <Card>
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Send className="w-5 h-5" />
              Envoyer un reçu fiscal
            </div>
            <p className="text-sm text-gray-500">
              Le système calculera automatiquement le total des dons pour l'année sélectionnée.
            </p>

            {/* Avertissement si paramètres incomplets */}
            {(!associationInfo.nom || !associationInfo.siren) && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Paramètres incomplets
                  </p>
                  <p className="text-sm text-amber-700">
                    Veuillez d'abord configurer les informations de l'association dans l'onglet "Paramètres".
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Email du donateur"
                  type="email"
                  value={emailManuel}
                  onChange={e => setEmailManuel(e.target.value)}
                  placeholder="donateur@email.com"
                  icon={<Search className="w-4 h-4" />}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Année fiscale
                </label>
                <select
                  value={anneeManuelle}
                  onChange={e => setAnneeManuelle(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - i
                    return (
                      <option key={year} value={year}>{year}</option>
                    )
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button
                onClick={handleSendRecu}
                disabled={sending || !emailManuel || !associationInfo.nom}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Envoi en cours...' : 'Générer et envoyer le reçu'}
              </Button>
            </div>

            {/* Info box */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Comment ça fonctionne ?
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Le système recherche tous les dons et cotisations de l'email pour l'année</li>
                <li>• Un PDF conforme est généré avec le montant total</li>
                <li>• Le reçu est envoyé par email et archivé dans Firebase Storage</li>
                <li>• Le donateur peut déduire 66% du montant de ses impôts</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'historique' && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <FileText className="w-5 h-5" />
                Reçus envoyés
              </div>
              <Button
                variant="secondary"
                onClick={loadRecusEnvoyes}
                disabled={loadingRecus}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRecus ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>

            {loadingRecus ? (
              <div className="flex justify-center py-8">
                <Loading />
              </div>
            ) : recusEnvoyes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Aucun reçu envoyé pour le moment</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">N° Reçu</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Année</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Montant</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date d'envoi</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recusEnvoyes.map(recu => (
                      <tr key={recu.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm text-amber-600">{recu.numeroRecu}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{recu.email}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{recu.annee}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                          {recu.montantTotal?.toFixed(2)} €
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {recu.createdAt?.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {recu.status === 'sent' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Envoyé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                              <AlertCircle className="w-3 h-3" />
                              Erreur
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
