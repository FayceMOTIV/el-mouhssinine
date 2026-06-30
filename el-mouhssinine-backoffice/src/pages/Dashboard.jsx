import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Coins,
  Calendar,
  Bell,
  TrendingUp,
  Clock,
  Megaphone,
  Heart,
  ArrowRight,
  CreditCard,
  CalendarDays,
  CalendarRange,
  MessageCircle,
  UserCheck,
  UserX,
  Hourglass,
  Smartphone,
  RefreshCw
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Card, StatCard, Loading, ProgressBar } from '../components/common'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  subscribeToMembres,
  subscribeToDons,
  subscribeToProjets,
  subscribeToEvenements,
  subscribeToPayments,
  getPaymentStats,
  PaymentType,
  getPrayerTimes,
  subscribeToUnreadMessagesCount,
  subscribeToAnnonces,
  subscribeToDocument
} from '../services/firebase'
import { toast } from 'react-toastify'
import { refreshPushSubscription } from '../utils/pushNotifications'
import { CotisationStatut } from '../types'
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'

// Helper: Détermine le statut de cotisation d'un membre (même logique que Adherents.jsx)
const getCotisationStatus = (membre) => {
  if (membre.status === 'sympathisant') return CotisationStatut.SYMPATHISANT
  if (membre.status === 'en_attente_validation') return CotisationStatut.EN_ATTENTE_VALIDATION
  if (membre.status === 'en_attente_signature') return CotisationStatut.EN_ATTENTE_SIGNATURE
  if (membre.status === 'en_attente_paiement') return CotisationStatut.EN_ATTENTE_PAIEMENT
  if (membre.status === 'annule') return CotisationStatut.ANNULE
  if (membre.status === 'actif') {
    if (!membre.cotisation?.dateFin) return CotisationStatut.ACTIF
    const dateFin = membre.cotisation.dateFin?.toDate?.() || new Date(membre.cotisation.dateFin)
    return isPast(dateFin) ? CotisationStatut.EXPIRE : CotisationStatut.ACTIF
  }
  if (!membre.cotisation?.dateFin) return CotisationStatut.AUCUN
  const dateFin = membre.cotisation.dateFin?.toDate?.() || new Date(membre.cotisation.dateFin)
  return isPast(dateFin) ? CotisationStatut.EXPIRE : CotisationStatut.ACTIF
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    membres: 0,
    membresActifs: 0,
    membresSympathisants: 0,
    membresExpires: 0,
    membresAucun: 0,
    membresEnAttenteValidation: 0,
    membresEnAttente: 0,
    membresEnAttentePaiement: 0,
    membresAnnules: 0,
    annoncesActives: 0,
    donsTotal: 0,
    donsMois: 0,
    evenements: 0,
    messagesNonLus: 0
  })
  const [projets, setProjets] = useState([])
  const [recentDons, setRecentDons] = useState([])
  const [prochainEvenement, setProchainEvenement] = useState(null)
  const [prayerTimes, setPrayerTimes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [storeStats, setStoreStats] = useState(null)
  const [refreshingStats, setRefreshingStats] = useState(false)
  const [donationsChartData, setDonationsChartData] = useState([])
  const [membresChartData, setMembresChartData] = useState([])
  const [payments, setPayments] = useState([])
  const [paymentStats, setPaymentStats] = useState({
    cotisations: { today: { total: 0, count: 0 }, month: { total: 0, count: 0 }, year: { total: 0, count: 0 }, all: { total: 0, count: 0 } },
    dons: { today: { total: 0, count: 0 }, month: { total: 0, count: 0 }, year: { total: 0, count: 0 }, all: { total: 0, count: 0 } }
  })

  // Re-abonnement push silencieux (iOS révoque les tokens après inactivité)
  useEffect(() => { refreshPushSubscription() }, [])

  // Stats téléchargements (settings/storeStats, alimenté par la Cloud Function)
  useEffect(() => {
    const unsub = subscribeToDocument('settings', 'storeStats', (data) => setStoreStats(data))
    return () => unsub && unsub()
  }, [])

  const handleRefreshStats = async () => {
    setRefreshingStats(true)
    try {
      const fn = httpsCallable(getFunctions(undefined, 'europe-west1'), 'refreshStoreStats')
      await fn()
      toast.success('Statistiques mises à jour')
    } catch (e) {
      toast.error('Impossible de rafraîchir (réessayez dans un instant)')
    } finally {
      setRefreshingStats(false)
    }
  }

  useEffect(() => {
    const unsubscribes = []

    // Membres
    unsubscribes.push(
      subscribeToMembres((data) => {
        // Calculer les stats par statut via getCotisationStatus (cohérent avec Adherents.jsx)
        const counts = {
          [CotisationStatut.ACTIF]: 0,
          [CotisationStatut.SYMPATHISANT]: 0,
          [CotisationStatut.EXPIRE]: 0,
          [CotisationStatut.AUCUN]: 0,
          [CotisationStatut.EN_ATTENTE_VALIDATION]: 0,
          [CotisationStatut.EN_ATTENTE_SIGNATURE]: 0,
          [CotisationStatut.EN_ATTENTE_PAIEMENT]: 0,
          [CotisationStatut.ANNULE]: 0
        }
        data.forEach(m => {
          const s = getCotisationStatus(m)
          if (counts[s] !== undefined) counts[s]++
        })

        setStats(prev => ({
          ...prev,
          membres: data.length,
          membresActifs: counts[CotisationStatut.ACTIF],
          membresSympathisants: counts[CotisationStatut.SYMPATHISANT],
          membresExpires: counts[CotisationStatut.EXPIRE],
          membresAucun: counts[CotisationStatut.AUCUN],
          membresEnAttenteValidation: counts[CotisationStatut.EN_ATTENTE_VALIDATION],
          membresEnAttente: counts[CotisationStatut.EN_ATTENTE_SIGNATURE],
          membresEnAttentePaiement: counts[CotisationStatut.EN_ATTENTE_PAIEMENT],
          membresAnnules: counts[CotisationStatut.ANNULE]
        }))

        // Generer les donnees du graphique des nouveaux membres (6 derniers mois)
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        const chartData = []
        for (let i = 5; i >= 0; i--) {
          const monthDate = new Date()
          monthDate.setMonth(monthDate.getMonth() - i)
          const monthNum = monthDate.getMonth()
          const yearNum = monthDate.getFullYear()

          const newMembers = data.filter(m => {
            if (!m.createdAt) return false
            const date = m.createdAt?.toDate?.() || new Date(m.createdAt)
            return date.getMonth() === monthNum && date.getFullYear() === yearNum
          })

          chartData.push({
            name: monthNames[monthNum],
            nouveaux: newMembers.length
          })
        }
        setMembresChartData(chartData)
        setLoading(false)
      })
    )

    // Messages non lus
    unsubscribes.push(
      subscribeToUnreadMessagesCount((count) => {
        setStats(prev => ({ ...prev, messagesNonLus: count }))
      })
    )

    // Annonces actives (D2)
    unsubscribes.push(
      subscribeToAnnonces((data) => {
        const actives = data.filter(a => a.actif !== false)
        setStats(prev => ({ ...prev, annoncesActives: actives.length }))
      })
    )

    // Dons
    unsubscribes.push(
      subscribeToDons((data) => {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const yearStart = new Date(now.getFullYear(), 0, 1)

        const getDate = (d) => {
          const raw = d.date || d.createdAt || d.webhookProcessedAt
          if (!raw) return new Date(0)
          return raw?.toDate?.() || new Date(raw)
        }
        const getAmount = (d) => d.montant || d.amount || 0

        const todayDons = data.filter(d => getDate(d) >= todayStart)
        const monthDons = data.filter(d => getDate(d) >= monthStart)
        const yearDons = data.filter(d => getDate(d) >= yearStart)

        const donsMois = monthDons.reduce((sum, d) => sum + getAmount(d), 0)
        const total = data.reduce((sum, d) => sum + getAmount(d), 0)

        setStats(prev => ({ ...prev, donsTotal: total, donsMois }))
        setRecentDons(data.slice(0, 5))

        setPaymentStats(prev => ({
          ...prev,
          dons: {
            today: { total: todayDons.reduce((sum, d) => sum + getAmount(d), 0), count: todayDons.length },
            month: { total: donsMois, count: monthDons.length },
            year: { total: yearDons.reduce((sum, d) => sum + getAmount(d), 0), count: yearDons.length },
            all: { total, count: data.length }
          }
        }))

        // Generer les donnees du graphique par mois (6 derniers mois)
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        const chartData = []
        for (let i = 5; i >= 0; i--) {
          const monthDate = new Date()
          monthDate.setMonth(monthDate.getMonth() - i)
          const monthNum = monthDate.getMonth()
          const yearNum = monthDate.getFullYear()

          const mDons = data.filter(d => {
            const date = getDate(d)
            return date.getMonth() === monthNum && date.getFullYear() === yearNum
          })
          chartData.push({
            name: monthNames[monthNum],
            montant: mDons.reduce((sum, d) => sum + getAmount(d), 0)
          })
        }
        setDonationsChartData(chartData)
      })
    )

    // Projets
    unsubscribes.push(
      subscribeToProjets((data) => {
        setProjets(data.filter(p => p.actif))
      })
    )

    // Evenements
    unsubscribes.push(
      subscribeToEvenements((data) => {
        const now = new Date()
        const upcoming = data.filter(e => {
          const date = e.date?.toDate?.() || new Date(e.date)
          return date >= now
        })
        setStats(prev => ({ ...prev, evenements: upcoming.length }))
        setProchainEvenement(upcoming[0] || null)
      })
    )

    // Payments (cotisations uniquement — les dons sont dans la collection 'donations')
    unsubscribes.push(
      subscribeToPayments((data) => {
        setPayments(data)
        const cotisationStats = getPaymentStats(data, PaymentType.COTISATION)
        setPaymentStats(prev => ({
          ...prev,
          cotisations: cotisationStats
        }))
      })
    )

    // Prayer Times
    getPrayerTimes().then(data => {
      setPrayerTimes(data)
    }).catch(err => {
      if (import.meta.env.DEV) console.error('Erreur chargement horaires:', err)
      // Continuer sans horaires si erreur
    })



    return () => unsubscribes.forEach(unsub => unsub())
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" />
      </div>
    )
  }

  const iosDl = storeStats?.ios?.available ? (storeStats.ios.last30 ?? 0) : null
  const androidDl = storeStats?.android?.available ? (storeStats.android.last30 ?? 0) : null
  const totalDl = (iosDl ?? 0) + (androidDl ?? 0)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Carte Téléchargements (App Store + Google Play) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-semibold">Téléchargements de l'application</h3>
            <span className="text-xs text-white/30">(30 derniers jours)</span>
          </div>
          <button
            onClick={handleRefreshStats}
            disabled={refreshingStats}
            className="text-white/50 hover:text-white transition-colors disabled:opacity-40"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingStats ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-2xl sm:text-3xl font-bold text-amber-400">{totalDl}</p>
            <p className="text-xs text-white/50 mt-1">Total (iOS + Android)</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/5">
            <p className="text-2xl font-bold text-white">{iosDl !== null ? iosDl : '—'}</p>
            <p className="text-xs text-white/50 mt-1"> App Store (iOS)</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/5">
            <p className="text-2xl font-bold text-white">
              {androidDl !== null ? androidDl : '—'}
            </p>
            <p className="text-xs text-white/50 mt-1">
              Google Play
              {storeStats?.android && !storeStats.android.available && (
                <span className="block text-amber-400/70 text-[10px] mt-0.5">en cours d'activation (~24h)</span>
              )}
            </p>
          </div>
        </div>
        {storeStats?.updatedAt && (
          <p className="text-[10px] text-white/30 text-right mt-2">
            Mis à jour {(() => { try { return format(storeStats.updatedAt?.toDate?.() || new Date(storeStats.updatedAt), 'dd/MM/yyyy HH:mm') } catch { return '' } })()}
            {' · '}les stores publient avec 1-3 jours de décalage
          </p>
        )}
      </Card>

      {/* Stats Grid - Ligne 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Membres"
          value={stats?.membres ?? 0}
          icon={Users}
        />
        <StatCard
          title="Cotisations ce mois"
          value={`${(paymentStats?.cotisations?.month?.total ?? 0).toLocaleString()} €`}
          icon={CreditCard}
        />
        <StatCard
          title="Dons ce mois"
          value={`${(stats?.donsMois ?? 0).toLocaleString()} €`}
          icon={Coins}
        />
        <StatCard
          title="Événements à venir"
          value={stats?.evenements ?? 0}
          icon={Calendar}
        />
      </div>

      {/* Stats Grid - Ligne 2 : Détail Membres */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Membres actifs"
          value={stats?.membresActifs ?? 0}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title="Sympathisants"
          value={stats?.membresSympathisants ?? 0}
          icon={Heart}
          variant="info"
        />
        <StatCard
          title="Expirés"
          value={stats?.membresExpires ?? 0}
          icon={UserX}
          variant="danger"
        />
        <StatCard
          title="En attente signature"
          value={stats?.membresEnAttente ?? 0}
          icon={Hourglass}
          variant="warning"
        />
        <StatCard
          title="En attente paiement"
          value={stats?.membresEnAttentePaiement ?? 0}
          icon={CreditCard}
          variant="warning"
        />
      </div>

      {/* Stats Grid - Ligne 3 : Messages & Annonces */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/messages" className="block">
          <StatCard
            title="Messages non lus"
            value={stats?.messagesNonLus ?? 0}
            icon={MessageCircle}
            variant={(stats?.messagesNonLus ?? 0) > 0 ? 'danger' : 'default'}
          />
        </Link>
        <StatCard
          title="Annonces actives"
          value={stats?.annoncesActives ?? 0}
          icon={Megaphone}
        />
      </div>

      {/* Recettes détaillées : Cotisations vs Dons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cotisations Stats */}
        <Card title="Cotisations" icon={CreditCard}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-white/50 mb-1">Aujourd'hui</p>
              <p className="text-lg sm:text-xl font-bold text-green-400">{(paymentStats?.cotisations?.today?.total ?? 0).toLocaleString()} €</p>
              <p className="text-[10px] sm:text-xs text-white/40">{paymentStats?.cotisations?.today?.count ?? 0} paiement{(paymentStats?.cotisations?.today?.count ?? 0) > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-white/50 mb-1">Ce mois</p>
              <p className="text-lg sm:text-xl font-bold text-blue-400">{(paymentStats?.cotisations?.month?.total ?? 0).toLocaleString()} €</p>
              <p className="text-[10px] sm:text-xs text-white/40">{paymentStats?.cotisations?.month?.count ?? 0} paiement{(paymentStats?.cotisations?.month?.count ?? 0) > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-white/50 mb-1">Cette année</p>
              <p className="text-lg sm:text-xl font-bold text-secondary">{(paymentStats?.cotisations?.year?.total ?? 0).toLocaleString()} €</p>
              <p className="text-[10px] sm:text-xs text-white/40">{paymentStats?.cotisations?.year?.count ?? 0} paiement{(paymentStats?.cotisations?.year?.count ?? 0) > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 sm:p-4 text-center border border-white/10">
              <p className="text-[10px] sm:text-xs text-white/50 mb-1">Total</p>
              <p className="text-lg sm:text-xl font-bold text-white">{(paymentStats?.cotisations?.all?.total ?? 0).toLocaleString()} €</p>
              <p className="text-[10px] sm:text-xs text-white/40">{paymentStats?.cotisations?.all?.count ?? 0} paiement{(paymentStats?.cotisations?.all?.count ?? 0) > 1 ? 's' : ''}</p>
            </div>
          </div>
        </Card>

        {/* Dons Stats (depuis la collection donations) */}
        <Card title="Dons" icon={Coins}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-white/50 mb-1">Aujourd'hui</p>
              <p className="text-lg sm:text-xl font-bold text-green-400">{(paymentStats?.dons?.today?.total ?? 0).toLocaleString()} €</p>
              <p className="text-[10px] sm:text-xs text-white/40">{paymentStats?.dons?.today?.count ?? 0} don{(paymentStats?.dons?.today?.count ?? 0) > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-white/50 mb-1">Ce mois</p>
              <p className="text-lg sm:text-xl font-bold text-blue-400">{(paymentStats?.dons?.month?.total ?? 0).toLocaleString()} €</p>
              <p className="text-[10px] sm:text-xs text-white/40">{paymentStats?.dons?.month?.count ?? 0} don{(paymentStats?.dons?.month?.count ?? 0) > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-white/50 mb-1">Cette année</p>
              <p className="text-lg sm:text-xl font-bold text-secondary">{(paymentStats?.dons?.year?.total ?? 0).toLocaleString()} €</p>
              <p className="text-[10px] sm:text-xs text-white/40">{paymentStats?.dons?.year?.count ?? 0} don{(paymentStats?.dons?.year?.count ?? 0) > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 sm:p-4 text-center border border-white/10">
              <p className="text-[10px] sm:text-xs text-white/50 mb-1">Total</p>
              <p className="text-lg sm:text-xl font-bold text-white">{(paymentStats?.dons?.all?.total ?? 0).toLocaleString()} €</p>
              <p className="text-[10px] sm:text-xs text-white/40">{paymentStats?.dons?.all?.count ?? 0} don{(paymentStats?.dons?.all?.count ?? 0) > 1 ? 's' : ''}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donations Chart */}
        <Card title="Évolution des dons" icon={TrendingUp}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={donationsChartData}>
                <defs>
                  <linearGradient id="colorMontant" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c9a227" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#ffffff50" />
                <YAxis stroke="#ffffff50" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Area
                  type="monotone"
                  dataKey="montant"
                  stroke="#c9a227"
                  fillOpacity={1}
                  fill="url(#colorMontant)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Members Chart */}
        <Card title="Nouveaux membres" icon={Users}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={membresChartData}>
                <XAxis dataKey="name" stroke="#ffffff50" />
                <YAxis stroke="#ffffff50" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="nouveaux" fill="#7f4f24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <Card title="Projets en cours" icon={Heart} className="lg:col-span-2">
          {projets.length === 0 ? (
            <p className="text-white/50 text-center py-8">Aucun projet actif</p>
          ) : (
            <div className="space-y-4">
              {projets.slice(0, 3).map(projet => (
                <div key={projet.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-white">{projet.titre}</h4>
                    <span className="text-xs text-secondary bg-secondary/20 px-2 py-1 rounded">
                      {projet.categorie}
                    </span>
                  </div>
                  <ProgressBar
                    value={projet.montantActuel || 0}
                    max={projet.objectif || 1}
                    size="sm"
                  />
                </div>
              ))}
              <Link
                to="/dons"
                className="flex items-center justify-center gap-2 text-secondary hover:text-secondary/80 text-sm py-2"
              >
                Voir tous les projets
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </Card>

        {/* Quick Actions & Info */}
        <div className="space-y-4 sm:space-y-6">
          {/* Prayer Times */}
          <Card title="Horaires du jour" icon={Clock}>
            {prayerTimes ? (
              <div className="space-y-2">
                {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map(salat => (
                  <div key={salat} className="flex justify-between text-sm">
                    <span className="text-white/70 capitalize">{salat}</span>
                    <span className="text-white font-medium">
                      {prayerTimes.times?.[salat] || prayerTimes[salat] || '--:--'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/50 text-sm">Chargement...</p>
            )}
            <Link
              to="/horaires"
              className="flex items-center justify-center gap-2 text-secondary hover:text-secondary/80 text-sm py-2 mt-4 border-t border-white/10"
            >
              Gérer les horaires
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Card>

          {/* Next Event */}
          <Card title="Prochain événement" icon={Calendar}>
            {prochainEvenement ? (
              <div>
                <h4 className="font-medium text-white mb-1">
                  {prochainEvenement.titre}
                </h4>
                <p className="text-sm text-white/50">
                  {(() => {
                    try {
                      const date = prochainEvenement.date?.toDate?.() || new Date(prochainEvenement.date)
                      if (isNaN(date.getTime())) return '-'
                      return format(date, 'EEEE d MMMM yyyy', { locale: fr })
                    } catch (e) {
                      return '-'
                    }
                  })()}
                </p>
              </div>
            ) : (
              <p className="text-white/50 text-sm">Aucun événement prévu</p>
            )}
            <Link
              to="/evenements"
              className="flex items-center justify-center gap-2 text-secondary hover:text-secondary/80 text-sm py-2 mt-4 border-t border-white/10"
            >
              Voir les événements
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
