import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import {
  FileText, Save, Building2, MapPin, User, Send, Download,
  Calendar, Euro, Search, RefreshCw, CheckCircle, AlertCircle, Upload, FileSpreadsheet
} from 'lucide-react'
import { Card, Button, Input, Loading, ConfirmModal } from '../components/common'
import { db, getSettings, getMosqueeInfo, uploadRecuFiscalInfoDoc } from '../services/firebase'
import { doc, getDoc, setDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'

export default function RecusFiscaux() {
  const [activeTab, setActiveTab] = useState('parametres')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const [forceYear, setForceYear] = useState(Math.max(new Date().getFullYear() - 1, 2026))
  const [forceGenerating, setForceGenerating] = useState(false)
  const [forceGenerateModal, setForceGenerateModal] = useState({ open: false, year: null })

  // Paramètres de l'association
  const [associationInfo, setAssociationInfo] = useState({
    nom: '',
    adresse: '',
    codePostal: '',
    ville: '',
    siren: '',
    statut: 'Association cultuelle loi 1905',
    objet: 'Exercice du culte musulman',
    signataire: 'Le Président',
    nomSignataire: ''
  })

  // Liste des reçus envoyés
  const [recusEnvoyes, setRecusEnvoyes] = useState([])
  const [loadingRecus, setLoadingRecus] = useState(false)

  // Envoi manuel
  const [emailManuel, setEmailManuel] = useState('')
  const [anneeManuelle, setAnneeManuelle] = useState(Math.max(new Date().getFullYear() - 1, 2026))

  // Feature #10 — Document d'information reçu fiscal (PDF commun à tous)
  const [recuFiscalInfoUrl, setRecuFiscalInfoUrl] = useState('')
  const [recuFiscalInfoUpdatedAt, setRecuFiscalInfoUpdatedAt] = useState(null)
  const [uploadingInfoDoc, setUploadingInfoDoc] = useState(false)
  const infoDocInputRef = useRef(null)

  // Feature #9 — Récap annuel
  const [recapYear, setRecapYear] = useState(new Date().getFullYear() - 1)
  const [generatingRecap, setGeneratingRecap] = useState(false)

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

      // Charger l'URL du document d'information (settings/general)
      const general = await getSettings()
      if (general?.recuFiscalInfoUrl) {
        setRecuFiscalInfoUrl(general.recuFiscalInfoUrl)
        const updatedAt = general.recuFiscalInfoUpdatedAt
        setRecuFiscalInfoUpdatedAt(updatedAt?.toDate?.() || (updatedAt ? new Date(updatedAt) : null))
      }

      // Charger les reçus envoyés
      await loadRecusEnvoyes()
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erreur chargement:', err)
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
      if (import.meta.env.DEV) console.error('Erreur chargement reçus:', err)
    } finally {
      setLoadingRecus(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!associationInfo.nom?.trim() || !associationInfo.adresse?.trim() || !associationInfo.ville?.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'recusFiscaux'), associationInfo, { merge: true })
      toast.success('Paramètres enregistrés')
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erreur sauvegarde:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmForceGenerate = async () => {
    const year = forceGenerateModal.year
    setForceGenerateModal({ open: false, year: null })
    setForceGenerating(true)
    try {
      const fn = getFunctions(undefined, 'europe-west1')
      const forceGenerate = httpsCallable(fn, 'forceGenerateRecusFiscaux')
      const result = await forceGenerate({ year })
      const data = result.data
      toast.success(`Terminé ! ${data.successCount} reçu(s) envoyé(s)${data.errorCount > 0 ? `, ${data.errorCount} erreur(s)` : ''}`)
      await loadRecusEnvoyes()
    } catch (err) {
      console.error('Erreur génération forcée:', err)
      toast.error(err.message || 'Erreur lors de la génération')
    } finally {
      setForceGenerating(false)
    }
  }

  // Validation email
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSendRecu = async () => {
    if (!emailManuel) {
      toast.error('Veuillez saisir un email')
      return
    }

    // Validation format email
    if (!isValidEmail(emailManuel)) {
      toast.error('Format d\'email invalide')
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
      if (import.meta.env.DEV) console.error('Erreur envoi:', err)
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

  // ===== Feature #10 — Upload du document d'information reçu fiscal =====
  const handleSelectInfoDoc = () => {
    if (infoDocInputRef.current) infoDocInputRef.current.click()
  }

  const handleUploadInfoDoc = async (e) => {
    const file = e.target.files?.[0]
    // Reset input pour permettre de re-sélectionner le même fichier
    if (infoDocInputRef.current) infoDocInputRef.current.value = ''
    if (!file) return

    setUploadingInfoDoc(true)
    try {
      const url = await uploadRecuFiscalInfoDoc(file)
      setRecuFiscalInfoUrl(url)
      setRecuFiscalInfoUpdatedAt(new Date())
      toast.success('Document d\'information téléversé')
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erreur upload doc info:', err)
      toast.error(err.message || 'Erreur lors du téléversement')
    } finally {
      setUploadingInfoDoc(false)
    }
  }

  // ===== Feature #9 — Récap annuel des reçus fiscaux (CSV) =====
  const formatRecapDate = (value) => {
    const d = value?.toDate?.() || (value ? new Date(value) : null)
    if (!d || isNaN(d.getTime())) return ''
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const handleGenerateRecap = async () => {
    setGeneratingRecap(true)
    try {
      // Récupérer tous les reçus de l'année (pas de limite, pas de orderBy pour éviter index composite)
      const snapshot = await getDocs(
        query(collection(db, 'recus_fiscaux'), where('annee', '==', recapYear))
      )
      const recus = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.numeroRecu || '').localeCompare(String(b.numeroRecu || '')))

      if (recus.length === 0) {
        toast.info(`Aucun reçu pour l'année ${recapYear}`)
        return
      }

      // En-tête mosquée : settings/mosqueeInfo si dispo, sinon paramètres association, sinon défaut
      let mosqueeInfo = null
      try {
        mosqueeInfo = await getMosqueeInfo()
      } catch (e) {
        if (import.meta.env.DEV) console.warn('mosqueeInfo indisponible:', e)
      }
      const nomMosquee = mosqueeInfo?.nom || associationInfo.nom || 'Centre Culturel Islamique El Mouhssinine'
      const adresseMosquee = [
        mosqueeInfo?.adresse || associationInfo.adresse,
        [mosqueeInfo?.codePostal || associationInfo.codePostal, mosqueeInfo?.ville || associationInfo.ville]
          .filter(Boolean).join(' ')
      ].filter(Boolean).join(', ')
      const identifiant = mosqueeInfo?.siret || mosqueeInfo?.rna || mosqueeInfo?.siren || associationInfo.siren || ''

      // Construction CSV (séparateur ; pour Excel FR), encodage UTF-8 BOM
      const escapeCsv = (val) => {
        const s = (val ?? '').toString().replace(/"/g, '""')
        return `"${s}"`
      }

      const lignes = []
      // En-tête en lignes de commentaire
      lignes.push(`# Récapitulatif annuel des reçus fiscaux — Année ${recapYear}`)
      lignes.push(`# ${nomMosquee}`)
      if (adresseMosquee) lignes.push(`# ${adresseMosquee}`)
      if (identifiant) lignes.push(`# SIRET/RNA : ${identifiant}`)
      lignes.push(`# Document généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`)
      lignes.push('')

      // Colonnes
      lignes.push(['Nom', 'Adresse', 'Email', 'Montant (€)', 'Date d\'envoi', 'N° reçu'].map(escapeCsv).join(';'))

      let total = 0
      for (const recu of recus) {
        const d = recu.donateur || {}
        const nom = d.companyName || [d.prenom, d.nom].filter(Boolean).join(' ').trim() || '—'
        const adresse = [d.adresse, [d.codePostal, d.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
        const montant = Number(recu.montantTotal || 0)
        total += montant
        lignes.push([
          nom,
          adresse,
          recu.email || '',
          montant.toFixed(2).replace('.', ','),
          formatRecapDate(recu.createdAt),
          recu.numeroRecu || ''
        ].map(escapeCsv).join(';'))
      }

      // Ligne total
      lignes.push('')
      lignes.push([`TOTAL (${recus.length} reçu${recus.length > 1 ? 's' : ''})`, '', '', total.toFixed(2).replace('.', ','), '', '']
        .map(escapeCsv).join(';'))

      const csv = '﻿' + lignes.join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `recap-recus-fiscaux-${recapYear}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Récap ${recapYear} généré (${recus.length} reçu${recus.length > 1 ? 's' : ''})`)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erreur génération récap:', err)
      toast.error('Erreur lors de la génération du récap')
    } finally {
      setGeneratingRecap(false)
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
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <FileText className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reçus Fiscaux</h1>
            <p className="text-white/60">Génération et envoi des reçus fiscaux aux donateurs</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex gap-4 overflow-x-auto whitespace-nowrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-secondary text-secondary'
                  : 'border-transparent text-white/50 hover:text-white/70'
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
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <Building2 className="w-5 h-5 text-secondary" />
              Informations de l'association
            </div>
            <p className="text-sm text-white/60">
              Ces informations apparaîtront sur tous les reçus fiscaux générés.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nom de l'association *"
                value={associationInfo.nom}
                onChange={e => setAssociationInfo(prev => ({ ...prev, nom: e.target.value }))}
                placeholder="Association El Mohsinine"
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

            <Input
              label="Objet de l'association"
              value={associationInfo.objet}
              onChange={e => setAssociationInfo(prev => ({ ...prev, objet: e.target.value }))}
              placeholder="Exercice du culte musulman"
            />

            <hr className="border-white/10" />

            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <User className="w-5 h-5 text-secondary" />
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
                loading={saving}
                icon={Save}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Feature #10 — Document d'information reçu fiscal (commun à tous les utilisateurs) */}
      {activeTab === 'parametres' && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <FileText className="w-5 h-5 text-secondary" />
              Document d'information reçu fiscal
            </div>
            <p className="text-sm text-white/60">
              Téléversez un PDF d'information général sur les reçus fiscaux. Ce document, identique pour
              tous, sera mis à disposition des utilisateurs de l'application.
            </p>

            {recuFiscalInfoUrl ? (
              <div className="flex items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-amber-500/20 rounded-lg flex-shrink-0">
                    <FileText className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <a
                      href={recuFiscalInfoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-secondary hover:underline truncate block"
                    >
                      Voir le document actuel (PDF)
                    </a>
                    {recuFiscalInfoUpdatedAt && (
                      <p className="text-xs text-white/40 mt-0.5">
                        Mis à jour le {recuFiscalInfoUpdatedAt.toLocaleDateString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-dashed border-white/15 rounded-lg text-white/50">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">Aucun document d'information téléversé pour le moment.</p>
              </div>
            )}

            <input
              ref={infoDocInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleUploadInfoDoc}
              className="hidden"
            />

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSelectInfoDoc}
                disabled={uploadingInfoDoc}
                loading={uploadingInfoDoc}
                icon={Upload}
                variant="secondary"
              >
                {uploadingInfoDoc
                  ? 'Téléversement...'
                  : recuFiscalInfoUrl ? 'Remplacer le PDF d\'info' : 'Téléverser le PDF d\'info'}
              </Button>
            </div>
            <p className="text-xs text-white/40">PDF uniquement, taille maximale 10MB.</p>
          </div>
        </Card>
      )}

      {activeTab === 'envoyer' && (
        <Card>
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <Send className="w-5 h-5 text-secondary" />
              Envoyer un reçu fiscal
            </div>
            <p className="text-sm text-white/60">
              Le système calculera automatiquement le total des dons pour l'année sélectionnée.
            </p>

            {/* Avertissement si paramètres incomplets */}
            {(!associationInfo.nom || !associationInfo.siren) && (
              <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-400">
                    Paramètres incomplets
                  </p>
                  <p className="text-sm text-amber-400/80">
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
                  icon={Search}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Année fiscale
                </label>
                <select
                  value={anneeManuelle}
                  onChange={e => setAnneeManuelle(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-secondary focus:border-secondary"
                >
                  {Array.from({ length: Math.max(new Date().getFullYear(), 2026) - 2026 + 1 }, (_, i) => Math.max(new Date().getFullYear(), 2026) - i).map(year => (
                    <option key={year} value={year} className="bg-bg-dark text-white">{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button
                onClick={handleSendRecu}
                disabled={sending || !emailManuel || !associationInfo.nom}
                loading={sending}
                icon={Send}
              >
                {sending ? 'Envoi en cours...' : 'Générer et envoyer le reçu'}
              </Button>
            </div>

            {/* Info box */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h4 className="text-sm font-medium text-blue-400 mb-2">
                Comment ça fonctionne ?
              </h4>
              <ul className="text-sm text-blue-400/80 space-y-1">
                <li>• Le système recherche tous les dons de l'email pour l'année</li>
                <li>• Un PDF CERFA conforme est généré (particulier ou entreprise)</li>
                <li>• Le reçu est envoyé par email et archivé dans Firebase Storage</li>
                <li>• Particuliers : déduction 66% (art. 200 CGI) / Entreprises : 60% (art. 238 bis CGI)</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'historique' && (
        <>
        {/* Force generation section */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <RefreshCw className="w-5 h-5 text-amber-400" />
              Génération groupée
            </div>
            <p className="text-sm text-white/60">
              Forcer la génération de tous les reçus fiscaux pour une année. Le cron automatique s'exécute le 2 janvier à 6h.
            </p>
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Année</label>
                <select
                  value={forceYear}
                  onChange={e => setForceYear(Number(e.target.value))}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-secondary focus:border-secondary"
                >
                  {Array.from({ length: Math.max(new Date().getFullYear(), 2026) - 2026 + 1 }, (_, i) => Math.max(new Date().getFullYear(), 2026) - i).map(year => (
                    <option key={year} value={year} className="bg-bg-dark text-white">{year}</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={() => {
                  if (!associationInfo.nom || !associationInfo.siren) {
                    toast.error('Veuillez d\'abord configurer les paramètres de l\'association (nom et SIREN)')
                    setActiveTab('parametres')
                    return
                  }
                  setForceGenerateModal({ open: true, year: forceYear })
                }}
                disabled={forceGenerating}
                loading={forceGenerating}
                variant="primary"
              >
                {forceGenerating ? 'Génération en cours...' : `Générer tous les reçus ${forceYear}`}
              </Button>
            </div>
          </div>
        </Card>

        {/* Feature #9 — Récap annuel des reçus fiscaux */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <FileSpreadsheet className="w-5 h-5 text-amber-400" />
              Récapitulatif annuel
            </div>
            <p className="text-sm text-white/60">
              Générez un document récapitulant tous les reçus fiscaux envoyés sur une année (à transmettre
              à l'administration fiscale). En-tête de la mosquée, liste complète et total des montants.
            </p>
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Année</label>
                <select
                  value={recapYear}
                  onChange={e => setRecapYear(Number(e.target.value))}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-secondary focus:border-secondary"
                >
                  {Array.from({ length: Math.max(new Date().getFullYear(), 2026) - 2026 + 1 }, (_, i) => Math.max(new Date().getFullYear(), 2026) - i).map(year => (
                    <option key={year} value={year} className="bg-bg-dark text-white">{year}</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleGenerateRecap}
                disabled={generatingRecap}
                loading={generatingRecap}
                icon={Download}
                variant="secondary"
              >
                {generatingRecap ? 'Génération...' : 'Générer le récap annuel'}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-semibold text-white">
                <FileText className="w-5 h-5 text-secondary" />
                Reçus envoyés
              </div>
              <Button
                variant="secondary"
                onClick={loadRecusEnvoyes}
                disabled={loadingRecus}
                loading={loadingRecus}
                icon={RefreshCw}
              >
                Actualiser
              </Button>
            </div>

            {loadingRecus ? (
              <div className="flex justify-center py-8">
                <Loading />
              </div>
            ) : recusEnvoyes.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <FileText className="w-12 h-12 mx-auto mb-4 text-white/20" />
                <p>Aucun reçu envoyé pour le moment</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-sm font-medium text-white/60">N° Reçu</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Année</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-white/60">Montant</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Date d'envoi</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-white/60">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recusEnvoyes.map(recu => (
                      <tr key={recu.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm text-amber-400">{recu.numeroRecu}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-white">{recu.email}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            recu.donorType === 'entreprise'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-white/10 text-white/60'
                          }`}>
                            {recu.donorType === 'entreprise' ? '🏢' : '👤'} {recu.donorType || 'particulier'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-white/70">{recu.annee}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-white">
                          {recu.montantTotal?.toFixed(2)} €
                        </td>
                        <td className="py-3 px-4 text-sm text-white/70">
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
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-400 bg-green-500/20 rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Envoyé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-400 bg-red-500/20 rounded-full">
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
        </>
      )}

      {/* Force Generate Confirmation Modal */}
      <ConfirmModal
        isOpen={forceGenerateModal.open}
        onClose={() => setForceGenerateModal({ open: false, year: null })}
        onConfirm={handleConfirmForceGenerate}
        title="Générer les reçus fiscaux"
        message={`Générer tous les reçus fiscaux pour ${forceGenerateModal.year} ? Cette action enverra un email à chaque donateur.`}
        confirmText="Générer"
        danger
      />
    </div>
  )
}
