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
  ArrowRight
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Card, StatCard, Loading, ProgressBar } from '../components/common'
import {
  subscribeToMembres,
  subscribeToDons,
  subscribeToProjets,
  subscribeToEvenements,
  subscribeToJanazas,
  getPrayerTimes
} from '../services/firebase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const [stats, setStats] = useState({
    membres: 0,
    donsTotal: 0,
    donsMois: 0,
    evenements: 0
  })
  const [projets, setProjets] = useState([])
  const [recentDons, setRecentDons] = useState([])
  const [prochainEvenement, setProchainEvenement] = useState(null)
  const [prayerTimes, setPrayerTimes] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribes = []

    // Membres
    unsubscribes.push(
      subscribeToMembres((data) => {
        setStats(prev => ({ ...prev, membres: data.length }))
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

    // Prayer Times
    getPrayerTimes().then(data => {
      setPrayerTimes(data)
    })

    setLoading(false)

    return () => unsubscribes.forEach(unsub => unsub())
  }, [])

  // Mock data for charts
  const donationsData = [
    { name: 'Jan', montant: 2400 },
    { name: 'Fév', montant: 1398 },
    { name: 'Mar', montant: 9800 },
    { name: 'Avr', montant: 3908 },
    { name: 'Mai', montant: 4800 },
    { name: 'Juin', montant: 3800 }
  ]

  const membresData = [
    { name: 'Jan', nouveaux: 12 },
    { name: 'Fév', nouveaux: 19 },
    { name: 'Mar', nouveaux: 15 },
    { name: 'Avr', nouveaux: 22 },
    { name: 'Mai', nouveaux: 18 },
    { name: 'Juin', nouveaux: 25 }
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
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Adhérents"
          value={stats.membres}
          icon={Users}
          trend="+12%"
          trendUp
        />
        <StatCard
          title="Dons ce mois"
          value={`${stats.donsMois.toLocaleString()} €`}
          icon={Coins}
          trend="+8%"
          trendUp
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donations Chart */}
        <Card title="Évolution des dons" icon={TrendingUp}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={donationsData}>
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
        <Card title="Nouveaux adhérents" icon={Users}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={membresData}>
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
