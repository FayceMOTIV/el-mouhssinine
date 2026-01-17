import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp,
  CreditCard,
  Users,
  Coins,
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { Card, Button, Loading, Badge } from '../components/common'
import {
  subscribeToPayments,
  subscribeToDons,
  subscribeToMembres,
  PaymentType
} from '../services/firebase'
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, subDays, isWithinInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

const COLORS = ['#c9a227', '#7f4f24', '#22c55e', '#3b82f6']

export default function Revenus() {
  const [payments, setPayments] = useState([])
  const [dons, setDons] = useState([])
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtres
  const [typeFilter, setTypeFilter] = useState('all') // 'all', 'cotisation', 'don'
  const [periodFilter, setPeriodFilter] = useState('month') // 'today', 'week', 'month', 'year', 'custom'
  const [customDateStart, setCustomDateStart] = useState('')
  const [customDateEnd, setCustomDateEnd] = useState('')

  useEffect(() => {
    const unsubPayments = subscribeToPayments((data) => {
      setPayments(data)
      setLoading(false)
    })
    const unsubDons = subscribeToDons((data) => {
      setDons(data)
    })
    const unsubMembres = subscribeToMembres((data) => {
      setMembres(data)
    })
    return () => {
      unsubPayments()
      unsubDons()
      unsubMembres()
    }
  }, [])

  // Calcul de la période de filtrage
  const dateRange = useMemo(() => {
    const now = new Date()
    switch (periodFilter) {
      case 'today':
        return { start: startOfDay(now), end: now }
      case 'week':
        return { start: startOfWeek(now, { locale: fr }), end: now }
      case 'month':
        return { start: startOfMonth(now), end: now }
      case 'year':
        return { start: startOfYear(now), end: now }
      case 'custom':
        return {
          start: customDateStart ? new Date(customDateStart) : subDays(now, 30),
          end: customDateEnd ? new Date(customDateEnd + 'T23:59:59') : now
        }
      default:
        return { start: startOfMonth(now), end: now }
    }
  }, [periodFilter, customDateStart, customDateEnd])

  // Tous les revenus combinés (payments collection + dons existants + cotisations membres)
  const allRevenues = useMemo(() => {
    const revenues = []

    // 1. Paiements de la collection payments
    payments.forEach(p => {
      const date = p.date?.toDate?.() || new Date(p.date)
      revenues.push({
        id: `payment-${p.id}`,
        type: p.type || 'don',
        montant: p.montant || 0,
        date,
        source: 'app',
        modePaiement: p.modePaiement || 'cb',
        details: p.membreId ? `Membre #${p.membreId.slice(0, 8)}` : (p.projetTitre || 'Don'),
        raw: p
      })
    })

    // 2. Dons existants (collection donations)
    dons.forEach(d => {
      const date = d.date?.toDate?.() || new Date(d.date)
      // Éviter les doublons si déjà dans payments
      if (!revenues.find(r => r.raw?.donId === d.id)) {
        revenues.push({
          id: `don-${d.id}`,
          type: 'don',
          montant: d.montant || 0,
          date,
          source: d.modePaiement?.toLowerCase().includes('app') ? 'app' : 'manuel',
          modePaiement: d.modePaiement || 'autre',
          details: d.donateur || 'Anonyme',
          raw: d
        })
      }
    })

    // 3. Cotisations membres (qui ont un paiement enregistré)
    membres.forEach(m => {
      if (m.datePaiement && m.montant) {
        const date = m.datePaiement?.toDate?.() || new Date(m.datePaiement)
        // Éviter les doublons
        if (!revenues.find(r => r.raw?.membreId === m.id || r.raw?.paiementId === m.paiementId)) {
          revenues.push({
            id: `membre-${m.id}`,
            type: 'cotisation',
            montant: m.montant || m.cotisation?.montant || 0,
            date,
            source: m.modePaiement ? 'app' : 'manuel',
            modePaiement: m.modePaiement || 'autre',
            details: `${m.prenom || ''} ${m.nom || ''}`.trim() || 'Membre',
            raw: m
          })
        }
      }
    })

    return revenues.sort((a, b) => b.date - a.date)
  }, [payments, dons, membres])

  // Revenus filtrés par type et période
  const filteredRevenues = useMemo(() => {
    return allRevenues.filter(r => {
      // Filtre par type
      if (typeFilter !== 'all' && r.type !== typeFilter) return false

      // Filtre par période
      if (!isWithinInterval(r.date, { start: dateRange.start, end: dateRange.end })) return false

      return true
    })
  }, [allRevenues, typeFilter, dateRange])

  // Stats
  const stats = useMemo(() => {
    const cotisations = filteredRevenues.filter(r => r.type === 'cotisation')
    const donations = filteredRevenues.filter(r => r.type === 'don')
    const appPayments = filteredRevenues.filter(r => r.source === 'app')

    return {
      total: filteredRevenues.reduce((sum, r) => sum + r.montant, 0),
      count: filteredRevenues.length,
      cotisations: {
        total: cotisations.reduce((sum, r) => sum + r.montant, 0),
        count: cotisations.length
      },
      dons: {
        total: donations.reduce((sum, r) => sum + r.montant, 0),
        count: donations.length
      },
      app: {
        total: appPayments.reduce((sum, r) => sum + r.montant, 0),
        count: appPayments.length
      }
    }
  }, [filteredRevenues])

  // Données pour le graphique par jour
  const chartData = useMemo(() => {
    const days = {}
    filteredRevenues.forEach(r => {
      const day = format(r.date, 'dd/MM')
      if (!days[day]) {
        days[day] = { name: day, cotisations: 0, dons: 0 }
      }
      if (r.type === 'cotisation') {
        days[day].cotisations += r.montant
      } else {
        days[day].dons += r.montant
      }
    })
    return Object.values(days).reverse().slice(-14) // 14 derniers jours
  }, [filteredRevenues])

  // Données pour le camembert
  const pieData = useMemo(() => {
    return [
      { name: 'Cotisations', value: stats.cotisations.total },
      { name: 'Dons', value: stats.dons.total }
    ].filter(d => d.value > 0)
  }, [stats])

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Montant', 'Mode', 'Source', 'Détails']
    const rows = filteredRevenues.map(r => [
      format(r.date, 'dd/MM/yyyy HH:mm'),
      r.type === 'cotisation' ? 'Cotisation' : 'Don',
      r.montant,
      r.modePaiement,
      r.source === 'app' ? 'Application' : 'Manuel',
      r.details
    ])

    const BOM = '\uFEFF'
    const csv = BOM + [headers, ...rows].map(row => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `revenus_${format(dateRange.start, 'yyyy-MM-dd')}_${format(dateRange.end, 'yyyy-MM-dd')}.csv`
    a.click()
  }

  // Comparaison avec période précédente
  const comparison = useMemo(() => {
    const periodLength = dateRange.end - dateRange.start
    const prevStart = new Date(dateRange.start.getTime() - periodLength)
    const prevEnd = new Date(dateRange.start.getTime() - 1)

    const prevRevenues = allRevenues.filter(r =>
      isWithinInterval(r.date, { start: prevStart, end: prevEnd }) &&
      (typeFilter === 'all' || r.type === typeFilter)
    )
    const prevTotal = prevRevenues.reduce((sum, r) => sum + r.montant, 0)

    if (prevTotal === 0) return null
    const diff = ((stats.total - prevTotal) / prevTotal) * 100
    return { diff: diff.toFixed(1), isUp: diff >= 0 }
  }, [allRevenues, dateRange, typeFilter, stats.total])

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-secondary" />
            Gestion des revenus
          </h1>
          <p className="text-white/50 mt-1">Suivi comptable des cotisations et dons</p>
        </div>
        <Button onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Exporter CSV
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-white/50 text-sm mb-1 block">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-secondary"
            >
              <option value="all">Tous les revenus</option>
              <option value="cotisation">Cotisations uniquement</option>
              <option value="don">Dons uniquement</option>
            </select>
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1 block">Période</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-secondary"
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
              <option value="custom">Période personnalisée</option>
            </select>
          </div>
          {periodFilter === 'custom' && (
            <>
              <div>
                <label className="text-white/50 text-sm mb-1 block">Du</label>
                <input
                  type="date"
                  value={customDateStart}
                  onChange={(e) => setCustomDateStart(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-secondary"
                />
              </div>
              <div>
                <label className="text-white/50 text-sm mb-1 block">Au</label>
                <input
                  type="date"
                  value={customDateEnd}
                  onChange={(e) => setCustomDateEnd(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-secondary"
                />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Stats principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-secondary/20 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/50 text-sm">Total revenus</p>
              <p className="text-3xl font-bold text-secondary">{stats.total.toLocaleString()} €</p>
              <p className="text-white/40 text-sm">{stats.count} transaction{stats.count > 1 ? 's' : ''}</p>
            </div>
            {comparison && (
              <div className={`flex items-center gap-1 ${comparison.isUp ? 'text-green-400' : 'text-red-400'}`}>
                {comparison.isUp ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                <span className="text-sm font-medium">{comparison.diff}%</span>
              </div>
            )}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-white/50 text-sm">Cotisations</p>
              <p className="text-xl font-bold text-white">{stats.cotisations.total.toLocaleString()} €</p>
              <p className="text-white/40 text-xs">{stats.cotisations.count} paiement{stats.cotisations.count > 1 ? 's' : ''}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Coins className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-white/50 text-sm">Dons</p>
              <p className="text-xl font-bold text-white">{stats.dons.total.toLocaleString()} €</p>
              <p className="text-white/40 text-xs">{stats.dons.count} don{stats.dons.count > 1 ? 's' : ''}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-white/50 text-sm">Via App</p>
              <p className="text-xl font-bold text-white">{stats.app.total.toLocaleString()} €</p>
              <p className="text-white/40 text-xs">{stats.app.count} paiement{stats.app.count > 1 ? 's' : ''}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique évolution */}
        <Card title="Évolution des revenus" icon={BarChart3} className="lg:col-span-2">
          <div className="h-72">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/40">
                Aucune donnée pour cette période
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#ffffff50" />
                  <YAxis stroke="#ffffff50" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `${value.toLocaleString()} €`}
                  />
                  <Legend />
                  <Bar dataKey="cotisations" name="Cotisations" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="dons" name="Dons" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Camembert répartition */}
        <Card title="Répartition" icon={PieChart}>
          <div className="h-72">
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/40">
                Aucune donnée
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `${value.toLocaleString()} €`}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Tableau des transactions */}
      <Card title="Détail des transactions" icon={Filter}>
        {filteredRevenues.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            Aucune transaction pour cette période
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/50 font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-white/50 font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-white/50 font-medium">Montant</th>
                  <th className="text-left py-3 px-4 text-white/50 font-medium">Mode</th>
                  <th className="text-left py-3 px-4 text-white/50 font-medium">Source</th>
                  <th className="text-left py-3 px-4 text-white/50 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody>
                {filteredRevenues.slice(0, 50).map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white/70">
                      {format(r.date, 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={r.type === 'cotisation' ? 'info' : 'success'}>
                        {r.type === 'cotisation' ? 'Cotisation' : 'Don'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-semibold text-secondary">
                      {r.montant.toLocaleString()} €
                    </td>
                    <td className="py-3 px-4 text-white/70 capitalize">
                      {r.modePaiement?.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={r.source === 'app' ? 'default' : 'warning'}>
                        {r.source === 'app' ? 'App' : 'Manuel'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-white/60 max-w-[200px] truncate">
                      {r.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRevenues.length > 50 && (
              <p className="text-center text-white/40 py-4">
                Affichage limité à 50 transactions. Exportez le CSV pour voir tout.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
