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
  Hourglass
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Card, StatCard, Loading, ProgressBar } from '../components/common'
import {
  subscribeToMembres,
  subscribeToDons,
  subscribeToProjets,
  subscribeToEvenements,
  subscribeToPayments,
  getPaymentStats,
  PaymentType,
  getPrayerTimes,
  subscribeToUnreadMessagesCount
} from '../services/firebase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const [stats, setStats] = useState({
    membres: 0,
    membresActifs: 0,
    membresEnAttente: 0,
    membresEnAttentePaiement: 0,
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
  const [donationsChartData, setDonationsChartData] = useState([])
  const [membresChartData, setMembresChartData] = useState([])
  const [payments, setPayments] = useState([])
  const [paymentStats, setPaymentStats] = useState({
    cotisations: { today: { total: 0, count: 0 }, month: { total: 0, count: 0 }, year: { total: 0, count: 0 } },
    dons: { today: { total: 0, count: 0 }, month: { total: 0, count: 0 }, year: { total: 0, count: 0 } }
  })

  useEffect(() => {
    const unsubscribes = []

    // Membres
    unsubscribes.push(
      subscribeToMembres((data) => {
        // Calculer les stats par statut
        const actifs = data.filter(m => m.status === 'actif' || (!m.status && m.cotisation?.dateFin && new Date(m.cotisation.dateFin.toDate?.() || m.cotisation.dateFin) >= new Date()))
        const enAttente = data.filter(m => m.status === 'en_attente_signature')
        const enAttentePaiement = data.filter(m => m.status === 'en_attente_paiement')

        setStats(prev => ({
          ...prev,
          membres: data.length,
          membresActifs: actifs.length,
          membresEnAttente: enAttente.length,
          membresEnAttentePaiement: enAttentePaiement.length
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
      })
    )

    // Messages non lus
    unsubscribes.push(
      subscribeToUnreadMessagesCount((count) => {
        setStats(prev => ({ ...prev, messagesNonLus: count }))
      })
    )

    // Dons
    unsubscribes.push(
      subscribeToDons((data) => {
        const total = data.reduce((sum, d) => sum + (d.montant || 0), 0)
        const now = new Date()
        const thisMonth = data.filter(d => {
          const date = d.date?.toDate?.() || new Date(d.date)
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
        })
        const donsMois = thisMonth.reduce((sum, d) => sum + (d.montant || 0), 0)

        setStats(prev => ({ ...prev, donsTotal: total, donsMois }))
        setRecentDons(data.slice(0, 5))

        // Generer les donnees du graphique par mois (6 derniers mois)
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        const chartData = []
        for (let i = 5; i >= 0; i--) {
          const monthDate = new Date()
          monthDate.setMonth(monthDate.getMonth() - i)
          const monthNum = monthDate.getMonth()
          const yearNum = monthDate.getFullYear()

          const monthDons = data.filter(d => {
            const date = d.date?.toDate?.() || new Date(d.date)
            return date.getMonth() === monthNum && date.getFullYear() === yearNum
          })
          const monthTotal = monthDons.reduce((sum, d) => sum + (d.montant || 0), 0)

          chartData.push({
            name: monthNames[monthNum],
            montant: monthTotal
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

    // Payments (cotisations + dons via app)
    unsubscribes.push(
      subscribeToPayments((data) => {
        setPayments(data)
        // Calculer les stats pour cotisations et dons
        const cotisationStats = getPaymentStats(data, PaymentType.COTISATION)
        const donStats = getPaymentStats(data, PaymentType.DON)
        setPaymentStats({
          cotisations: cotisationStats,
          dons: donStats
        })
      })
    )

    // Prayer Times
    getPrayerTimes().then(data => {
      setPrayerTimes(data)
    }).catch(err => {
      if (import.meta.env.DEV) console.error('Erreur chargement horaires:', err)
      // Continuer sans horaires si erreur
    })

    setLoading(false)

    return () => unsubscribes.forEach(unsub => unsub())
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid - Ligne 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Membres"
          value={stats.membres}
          icon={Users}
        />
        <StatCard
          title="Dons ce mois"
          value={`${stats.donsMois.toLocaleString()} €`}
          icon={Coins}
        />
        <StatCard
          title="Total Dons"
          value={`${stats.donsTotal.toLocaleString()} €`}
          icon={TrendingUp}
        />
        <StatCard
          title="Événements à venir"
          value={stats.evenements}
          icon={Calendar}
        />
      </div>

      {/* Stats Grid - Ligne 2 : Membres & Messages */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Membres actifs"
          value={stats.membresActifs}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title="En attente signature"
          value={stats.membresEnAttente}
          icon={Hourglass}
          variant="warning"
        />
        <StatCard
          title="En attente paiement"
          value={stats.membresEnAttentePaiement}
          icon={CreditCard}
          variant="info"
        />
        <Link to="/messages" className="block">
          <StatCard
            title="Messages non lus"
            value={stats.messagesNonLus}
            icon={MessageCircle}
            variant={stats.messagesNonLus > 0 ? 'danger' : 'default'}
          />
        </Link>
      </div>

      {/* Recettes App (Paiements CB/Apple Pay) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cotisations Stats */}
        <Card title="Cotisations (App)" icon={CreditCard}>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Aujourd'hui</p>
              <p className="text-xl font-bold text-green-400">{paymentStats.cotisations.today.total.toLocaleString()} €</p>
              <p className="text-xs text-white/40">{paymentStats.cotisations.today.count} paiement{paymentStats.cotisations.today.count > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Ce mois</p>
              <p className="text-xl font-bold text-blue-400">{paymentStats.cotisations.month.total.toLocaleString()} €</p>
              <p className="text-xs text-white/40">{paymentStats.cotisations.month.count} paiement{paymentStats.cotisations.month.count > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Cette année</p>
              <p className="text-xl font-bold text-secondary">{paymentStats.cotisations.year.total.toLocaleString()} €</p>
              <p className="text-xs text-white/40">{paymentStats.cotisations.year.count} paiement{paymentStats.cotisations.year.count > 1 ? 's' : ''}</p>
            </div>
          </div>
        </Card>

        {/* Dons App Stats */}
        <Card title="Dons (App)" icon={Coins}>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Aujourd'hui</p>
              <p className="text-xl font-bold text-green-400">{paymentStats.dons.today.total.toLocaleString()} €</p>
              <p className="text-xs text-white/40">{paymentStats.dons.today.count} don{paymentStats.dons.today.count > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Ce mois</p>
              <p className="text-xl font-bold text-blue-400">{paymentStats.dons.month.total.toLocaleString()} €</p>
              <p className="text-xs text-white/40">{paymentStats.dons.month.count} don{paymentStats.dons.month.count > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Cette année</p>
              <p className="text-xl font-bold text-secondary">{paymentStats.dons.year.total.toLocaleString()} €</p>
              <p className="text-xs text-white/40">{paymentStats.dons.year.count} don{paymentStats.dons.year.count > 1 ? 's' : ''}</p>
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
        <div className="space-y-6">
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
