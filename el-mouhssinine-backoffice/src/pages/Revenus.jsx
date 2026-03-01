import { useState, useEffect, useMemo } from 'react'
import {
  Wallet,
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
  ArrowDown,
  Search,
  X,
  DollarSign,
  Gift,
  UserCheck,
  CreditCardIcon
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
import { Card, Button, Loading, Badge, Modal } from '../components/common'
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
  const [activeTab, setActiveTab] = useState('overview')
  const [payments, setPayments] = useState([])
  const [dons, setDons] = useState([])
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtres
  const [periodFilter, setPeriodFilter] = useState('month') // 'today', 'week', 'month', 'year', 'custom'
  const [customDateStart, setCustomDateStart] = useState('')
  const [customDateEnd, setCustomDateEnd] = useState('')

  // Filtres spécifiques aux onglets
  const [donSearchQuery, setDonSearchQuery] = useState('')
  const [donTypeFilter, setDonTypeFilter] = useState('all') // 'all', 'particulier', 'entreprise'
  const [donProjetFilter, setDonProjetFilter] = useState('all')
  const [cotisationSearchQuery, setCotisationSearchQuery] = useState('')
  const [cotisationPeriodFilter, setCotisationPeriodFilter] = useState('all') // 'all', 'mensuel', 'annuel'

  // Modal pour détails don
  const [selectedDon, setSelectedDon] = useState(null)
  const [donModalOpen, setDonModalOpen] = useState(false)

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
      const rawDate = d.date || d.createdAt || d.webhookProcessedAt
      const date = rawDate?.toDate?.() || new Date(rawDate || Date.now())
      // Éviter les doublons si déjà dans payments (via stripePaymentIntentId)
      const alreadyInPayments = revenues.find(r =>
        r.raw?.stripePaymentIntentId && d.stripePaymentIntentId &&
        r.raw.stripePaymentIntentId === d.stripePaymentIntentId
      )
      if (!alreadyInPayments) {
        revenues.push({
          id: `don-${d.id}`,
          type: 'don',
          montant: d.montant || d.amount || 0,
          date,
          source: d.modePaiement?.toLowerCase().includes('app') ? 'app' : 'manuel',
          modePaiement: d.modePaiement || 'autre',
          details: d.donateur || 'Anonyme',
          raw: d
        })
      }
    })

    // 3. Cotisations membres (qui ont un paiement enregistré)
    // Dedup renforcé : vérifier membreId, paiementId ET montant+date pour éviter le double comptage
    membres.forEach(m => {
      if (m.datePaiement && m.montant) {
        const date = m.datePaiement?.toDate?.() || new Date(m.datePaiement)
        const montant = m.montant || m.cotisation?.montant || 0
        // Éviter les doublons - vérifier par stripePaymentId ou metadata.memberId
        const isDuplicate = revenues.find(r => {
          // Match exact par stripePaymentId
          if (m.stripePaymentId && r.raw?.stripePaymentIntentId === m.stripePaymentId) return true
          // Match par metadata.memberId dans payments
          if (r.raw?.metadata?.memberId === m.id) return true
          return false
        })
        if (!isDuplicate) {
          revenues.push({
            id: `membre-${m.id}`,
            type: 'cotisation',
            montant,
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

  // Revenus filtrés par période
  const filteredRevenues = useMemo(() => {
    return allRevenues.filter(r => {
      if (!isWithinInterval(r.date, { start: dateRange.start, end: dateRange.end })) return false
      return true
    })
  }, [allRevenues, dateRange])

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

  // Comparaison avec période précédente
  const comparison = useMemo(() => {
    const periodLength = dateRange.end - dateRange.start
    const prevStart = new Date(dateRange.start.getTime() - periodLength)
    const prevEnd = new Date(dateRange.start.getTime() - 1)

    const prevRevenues = allRevenues.filter(r =>
      isWithinInterval(r.date, { start: prevStart, end: prevEnd })
    )
    const prevTotal = prevRevenues.reduce((sum, r) => sum + r.montant, 0)

    if (prevTotal === 0) return null
    const diff = ((stats.total - prevTotal) / prevTotal) * 100
    return { diff: diff.toFixed(1), isUp: diff >= 0 }
  }, [allRevenues, dateRange, stats.total])

  // Filtrer les dons pour l'onglet Dons
  const filteredDons = useMemo(() => {
    return dons.filter(d => {
      // Filtrer par période (fallback sur createdAt si date absent — dons webhook)
      const rawDate = d.date || d.createdAt || d.webhookProcessedAt
      if (!rawDate) return false
      const date = rawDate?.toDate?.() || new Date(rawDate)
      if (isNaN(date.getTime()) || !isWithinInterval(date, { start: dateRange.start, end: dateRange.end })) return false

      // Filtrer par recherche
      if (donSearchQuery) {
        const query = donSearchQuery.toLowerCase()
        const donateur = d.donateur?.toLowerCase() || ''
        const email = d.donorInfo?.email?.toLowerCase() || ''
        if (!donateur.includes(query) && !email.includes(query)) return false
      }

      // Filtrer par type
      if (donTypeFilter !== 'all' && d.donorType !== donTypeFilter) return false

      // Filtrer par projet
      if (donProjetFilter !== 'all' && d.projetId !== donProjetFilter) return false

      return true
    })
  }, [dons, dateRange, donSearchQuery, donTypeFilter, donProjetFilter])

  // Filtrer les cotisations pour l'onglet Cotisations
  const filteredCotisations = useMemo(() => {
    return payments.filter(p => {
      if (p.type !== 'cotisation') return false

      // Filtrer par période
      const date = p.date?.toDate?.() || new Date(p.date)
      if (!isWithinInterval(date, { start: dateRange.start, end: dateRange.end })) return false

      // Filtrer par recherche
      if (cotisationSearchQuery) {
        const query = cotisationSearchQuery.toLowerCase()
        const membre = membres.find(m => m.id === p.membreId)
        if (membre) {
          const nom = `${membre.prenom || ''} ${membre.nom || ''}`.toLowerCase()
          const email = membre.email?.toLowerCase() || ''
          if (!nom.includes(query) && !email.includes(query)) return false
        }
      }

      // Filtrer par période (mensuel/annuel)
      if (cotisationPeriodFilter !== 'all') {
        const membre = membres.find(m => m.id === p.membreId)
        if (!membre || membre.cotisation?.type !== cotisationPeriodFilter) return false
      }

      return true
    })
  }, [payments, dateRange, cotisationSearchQuery, cotisationPeriodFilter, membres])

  // Abonnements actifs (membres avec cotisation mensuelle)
  const activeSubscriptions = useMemo(() => {
    return membres.filter(m =>
      m.cotisation?.type === 'mensuel' &&
      m.status === 'actif'
    )
  }, [membres])

  // Export CSV
  const exportCSV = (data, filename, headers, rowMapper) => {
    const rows = data.map(rowMapper)
    const BOM = '\uFEFF'
    const csv = BOM + [headers, ...rows].map(row => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  const exportOverviewCSV = () => {
    const headers = ['Date', 'Type', 'Montant', 'Mode', 'Source', 'Détails']
    exportCSV(
      filteredRevenues,
      `revenus_${format(dateRange.start, 'yyyy-MM-dd')}_${format(dateRange.end, 'yyyy-MM-dd')}.csv`,
      headers,
      r => [
        format(r.date, 'dd/MM/yyyy HH:mm'),
        r.type === 'cotisation' ? 'Cotisation' : 'Don',
        r.montant,
        r.modePaiement,
        r.source === 'app' ? 'Application' : 'Manuel',
        r.details
      ]
    )
  }

  const exportDonsCSV = () => {
    const headers = ['Date', 'Donateur', 'Email', 'Montant', 'Type', 'Projet', 'Mode Paiement', 'Email Confirmation']
    exportCSV(
      filteredDons,
      `dons_${format(dateRange.start, 'yyyy-MM-dd')}_${format(dateRange.end, 'yyyy-MM-dd')}.csv`,
      headers,
      d => {
        const rawDate = d.date || d.createdAt || d.webhookProcessedAt
        const dateStr = rawDate ? format(rawDate?.toDate?.() || new Date(rawDate), 'dd/MM/yyyy HH:mm') : '-'
        return [
          dateStr,
          d.donateur || 'Anonyme',
          d.donorInfo?.email || '-',
          d.montant || 0,
          d.donorType === 'entreprise' ? 'Entreprise' : 'Particulier',
          d.projetTitre || 'Don général',
          d.modePaiement || '-',
          d.emailConfirmationSent ? 'Oui' : 'Non'
        ]
      }
    )
  }

  const exportCotisationsCSV = () => {
    const headers = ['Date', 'Membre', 'Email', 'Montant', 'Période', 'Statut', 'Stripe ID']
    exportCSV(
      filteredCotisations,
      `cotisations_${format(dateRange.start, 'yyyy-MM-dd')}_${format(dateRange.end, 'yyyy-MM-dd')}.csv`,
      headers,
      c => {
        const membre = membres.find(m => m.id === c.membreId)
        const dateStr = c.date ? format(c.date?.toDate?.() || new Date(c.date), 'dd/MM/yyyy HH:mm') : '-'
        return [
          dateStr,
          membre ? `${membre.prenom || ''} ${membre.nom || ''}`.trim() : '-',
          membre?.email || '-',
          c.montant || 0,
          membre?.cotisation?.type === 'mensuel' ? 'Mensuel' : 'Annuel',
          c.status || 'succeeded',
          c.stripePaymentIntentId || '-'
        ]
      }
    )
  }

  const exportAbonnementsCSV = () => {
    const headers = ['Membre', 'Email', 'Montant Mensuel', 'Date Début', 'Prochaine Échéance', 'Statut']
    exportCSV(
      activeSubscriptions,
      `abonnements_${format(new Date(), 'yyyy-MM-dd')}.csv`,
      headers,
      m => {
        const dateDebutStr = m.cotisation?.dateDebut ? format(m.cotisation.dateDebut?.toDate?.() || new Date(m.cotisation.dateDebut), 'dd/MM/yyyy') : '-'
        const dateFinStr = m.cotisation?.dateFin ? format(m.cotisation.dateFin?.toDate?.() || new Date(m.cotisation.dateFin), 'dd/MM/yyyy') : '-'
        return [
          `${m.prenom || ''} ${m.nom || ''}`.trim(),
          m.email || '-',
          m.montant || m.cotisation?.montant || 0,
          dateDebutStr,
          dateFinStr,
          m.status || 'actif'
        ]
      }
    )
  }

  const openDonModal = (don) => {
    setSelectedDon(don)
    setDonModalOpen(true)
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Wallet className="w-7 h-7 text-secondary" />
            Gestion financière
          </h1>
          <p className="text-white/50 mt-1">Vue d'ensemble des dons, cotisations et abonnements</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        <Button
          variant={activeTab === 'overview' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Vue d'ensemble
        </Button>
        <Button
          variant={activeTab === 'dons' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('dons')}
        >
          <Gift className="w-4 h-4 mr-2" />
          Dons ({dons.length})
        </Button>
        <Button
          variant={activeTab === 'cotisations' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('cotisations')}
        >
          <UserCheck className="w-4 h-4 mr-2" />
          Cotisations ({payments.filter(p => p.type === 'cotisation').length})
        </Button>
        <Button
          variant={activeTab === 'abonnements' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('abonnements')}
        >
          <CreditCardIcon className="w-4 h-4 mr-2" />
          Abonnements ({activeSubscriptions.length})
        </Button>
      </div>

      {/* Filtres période (commun à tous les onglets) */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
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

      {/* TAB 1: VUE D'ENSEMBLE */}
      {activeTab === 'overview' && (
        <>
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
          <Card
            title="Détail des transactions"
            icon={Filter}
            action={
              <Button onClick={exportOverviewCSV} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            }
          >
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
        </>
      )}

      {/* TAB 2: DONS */}
      {activeTab === 'dons' && (
        <>
          {/* Filtres spécifiques */}
          <Card>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou email..."
                    value={donSearchQuery}
                    onChange={(e) => setDonSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>
              <select
                value={donTypeFilter}
                onChange={(e) => setDonTypeFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-secondary"
              >
                <option value="all">Tous les types</option>
                <option value="particulier">Particulier</option>
                <option value="entreprise">Entreprise</option>
              </select>
              <Button onClick={exportDonsCSV} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            </div>
          </Card>

          {/* Liste des dons */}
          <Card>
            {filteredDons.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                Aucun don pour cette période
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Donateur</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Montant</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Projet</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Type</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Statut</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDons.map(d => (
                      <tr key={d.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 text-white/70">
                          {(() => {
                            const rawDate = d.date || d.createdAt || d.webhookProcessedAt
                            if (!rawDate) return '-'
                            try { return format(rawDate?.toDate?.() || new Date(rawDate), 'dd/MM/yyyy', { locale: fr }) } catch { return '-' }
                          })()}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {d.donateur || 'Anonyme'}
                        </td>
                        <td className="py-3 px-4 text-white/60 text-sm">
                          {d.donorInfo?.email || '-'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-secondary">
                          {(d.montant || 0).toLocaleString()} €
                        </td>
                        <td className="py-3 px-4 text-white/70">
                          {d.projetTitre || 'Don général'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={d.donorType === 'entreprise' ? 'info' : 'default'}>
                            {d.donorType === 'entreprise' ? 'Entreprise' : 'Particulier'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="success">
                            {d.status || 'succeeded'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {d.emailConfirmationSent ? (
                            <span className="text-green-400 text-xs">✓ Envoyé</span>
                          ) : (
                            <span className="text-white/30 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDonModal(d)}
                          >
                            Détails
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* TAB 3: COTISATIONS */}
      {activeTab === 'cotisations' && (
        <>
          {/* Filtres spécifiques */}
          <Card>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou email..."
                    value={cotisationSearchQuery}
                    onChange={(e) => setCotisationSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>
              <select
                value={cotisationPeriodFilter}
                onChange={(e) => setCotisationPeriodFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-secondary"
              >
                <option value="all">Toutes les périodes</option>
                <option value="mensuel">Mensuel</option>
                <option value="annuel">Annuel</option>
              </select>
              <Button onClick={exportCotisationsCSV} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            </div>
          </Card>

          {/* Liste des cotisations */}
          <Card>
            {filteredCotisations.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                Aucune cotisation pour cette période
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Membre</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Montant</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Période</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Statut</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Stripe ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCotisations.map(c => {
                      const membre = membres.find(m => m.id === c.membreId)
                      return (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4 text-white/70">
                            {c.date ? format(c.date?.toDate?.() || new Date(c.date), 'dd/MM/yyyy', { locale: fr }) : '-'}
                          </td>
                          <td className="py-3 px-4 text-white">
                            {membre ? `${membre.prenom || ''} ${membre.nom || ''}`.trim() : '-'}
                          </td>
                          <td className="py-3 px-4 text-white/60 text-sm">
                            {membre?.email || '-'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-secondary">
                            {(c.montant || 0).toLocaleString()} €
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={membre?.cotisation?.type === 'mensuel' ? 'info' : 'default'}>
                              {membre?.cotisation?.type === 'mensuel' ? 'Mensuel' : 'Annuel'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="success">
                              {c.status || 'succeeded'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-white/50 text-xs font-mono">
                            {c.stripePaymentIntentId?.slice(0, 20) || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* TAB 4: ABONNEMENTS */}
      {activeTab === 'abonnements' && (
        <>
          <Card>
            <div className="flex justify-between items-center mb-4">
              <p className="text-white/70">
                {activeSubscriptions.length} abonnement{activeSubscriptions.length > 1 ? 's' : ''} actif{activeSubscriptions.length > 1 ? 's' : ''}
              </p>
              <Button onClick={exportAbonnementsCSV} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            </div>
            {activeSubscriptions.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                Aucun abonnement actif
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Membre</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Montant mensuel</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Date début</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Fin du cycle</th>
                      <th className="text-left py-3 px-4 text-white/50 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSubscriptions.map(m => (
                      <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 text-white">
                          {`${m.prenom || ''} ${m.nom || ''}`.trim()}
                        </td>
                        <td className="py-3 px-4 text-white/60 text-sm">
                          {m.email || '-'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-secondary">
                          {(m.montant || m.cotisation?.montant || 0).toLocaleString()} €
                        </td>
                        <td className="py-3 px-4 text-white/70">
                          {m.cotisation?.dateDebut ? format(m.cotisation.dateDebut?.toDate?.() || new Date(m.cotisation.dateDebut), 'dd/MM/yyyy', { locale: fr }) : '-'}
                        </td>
                        <td className="py-3 px-4 text-white/70">
                          {m.cotisation?.dateFin ? format(m.cotisation.dateFin?.toDate?.() || new Date(m.cotisation.dateFin), 'dd/MM/yyyy', { locale: fr }) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="success">
                            {m.status || 'actif'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modal détails don */}
      <Modal
        isOpen={donModalOpen}
        onClose={() => {
          setDonModalOpen(false)
          setSelectedDon(null)
        }}
        title="Détails du don"
        size="lg"
      >
        {selectedDon && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/50 text-sm">Donateur</p>
                <p className="text-white font-medium">{selectedDon.donateur || 'Anonyme'}</p>
              </div>
              <div>
                <p className="text-white/50 text-sm">Type</p>
                <Badge variant={selectedDon.donorType === 'entreprise' ? 'info' : 'default'}>
                  {selectedDon.donorType === 'entreprise' ? 'Entreprise' : 'Particulier'}
                </Badge>
              </div>
              <div>
                <p className="text-white/50 text-sm">Montant</p>
                <p className="text-secondary font-bold text-xl">{(selectedDon.montant || 0).toLocaleString()} €</p>
              </div>
              <div>
                <p className="text-white/50 text-sm">Date</p>
                <p className="text-white">{(() => {
                  const rawDate = selectedDon.date || selectedDon.createdAt || selectedDon.webhookProcessedAt
                  if (!rawDate) return '-'
                  try { return format(rawDate?.toDate?.() || new Date(rawDate), 'dd/MM/yyyy HH:mm', { locale: fr }) } catch { return '-' }
                })()}</p>
              </div>
              {selectedDon.donorInfo?.email && (
                <div>
                  <p className="text-white/50 text-sm">Email</p>
                  <p className="text-white">{selectedDon.donorInfo.email}</p>
                </div>
              )}
              {selectedDon.donorInfo?.phone && (
                <div>
                  <p className="text-white/50 text-sm">Téléphone</p>
                  <p className="text-white">{selectedDon.donorInfo.phone}</p>
                </div>
              )}
              <div>
                <p className="text-white/50 text-sm">Projet</p>
                <p className="text-white">{selectedDon.projetTitre || 'Don général'}</p>
              </div>
              <div>
                <p className="text-white/50 text-sm">Mode de paiement</p>
                <p className="text-white">{selectedDon.modePaiement || '-'}</p>
              </div>
              <div>
                <p className="text-white/50 text-sm">Email de confirmation</p>
                {selectedDon.emailConfirmationSent ? (
                  <Badge variant="success">Envoyé</Badge>
                ) : (
                  <Badge variant="warning">Non envoyé</Badge>
                )}
              </div>
              {selectedDon.stripePaymentIntentId && (
                <div className="col-span-2">
                  <p className="text-white/50 text-sm">Stripe Payment Intent ID</p>
                  <p className="text-white/60 font-mono text-xs">{selectedDon.stripePaymentIntentId}</p>
                </div>
              )}
            </div>
            {selectedDon.donorInfo?.address && (
              <div>
                <p className="text-white/50 text-sm">Adresse</p>
                <p className="text-white">
                  {selectedDon.donorInfo.address}<br />
                  {selectedDon.donorInfo.postalCode} {selectedDon.donorInfo.city}
                </p>
              </div>
            )}
            {selectedDon.donorType === 'entreprise' && selectedDon.donorInfo?.companyName && (
              <div>
                <p className="text-white/50 text-sm">Entreprise</p>
                <p className="text-white font-medium">{selectedDon.donorInfo.companyName}</p>
                {selectedDon.donorInfo.siret && (
                  <p className="text-white/60 text-sm">SIRET: {selectedDon.donorInfo.siret}</p>
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={() => {
              setDonModalOpen(false)
              setSelectedDon(null)
            }}
          >
            Fermer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
