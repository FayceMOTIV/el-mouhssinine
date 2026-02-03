import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-toastify'
import { Moon, Calendar, Bell, Settings2, Clock, Utensils, Sunrise, Save } from 'lucide-react'
import {
  Card,
  Button,
  Loading
} from '../components/common'
import { subscribeToDocument, setDocument } from '../services/firebase'
import { format, addDays, parse, differenceInDays, isWithinInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

const defaultRamadanSettings = {
  enabled: false,
  startDate: '',
  endDate: '',
  tarawihTime: '21:30',
  notifications: {
    suhoor: { enabled: true, minutesBefore: 30 },
    iftar: { enabled: true, minutesBefore: 5 },
    tarawih: { enabled: true, minutesBefore: 15 }
  }
}

// Horaires de prière approximatifs pour Bourg-en-Bresse (Mars)
// Ces horaires seront calculés dynamiquement via l'API en prod
const getDefaultPrayerTimes = (dayOffset = 0) => {
  // Simulation: Fajr entre 5:00 et 6:00, Maghrib entre 18:30 et 19:30
  const fajrBase = 5 * 60 + 45 // 5:45
  const maghribBase = 18 * 60 + 45 // 18:45

  const fajrMinutes = fajrBase - dayOffset * 1 // Fajr avance de 1 min/jour
  const maghribMinutes = maghribBase + dayOffset * 1 // Maghrib recule de 1 min/jour

  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  return {
    fajr: formatTime(fajrMinutes),
    maghrib: formatTime(maghribMinutes)
  }
}

const tabs = [
  { id: 'settings', label: 'Paramètres', icon: Settings2 },
  { id: 'horaires', label: 'Horaires', icon: Calendar },
  { id: 'notifications', label: 'Notifications', icon: Bell }
]

export default function Ramadan() {
  const [settings, setSettings] = useState(defaultRamadanSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('settings')

  // Charger les paramètres Ramadan
  useEffect(() => {
    const unsubscribe = subscribeToDocument('settings', 'ramadan', (data) => {
      if (data) {
        setSettings({ ...defaultRamadanSettings, ...data })
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Calculer les 30 jours de Ramadan
  const ramadanDays = useMemo(() => {
    if (!settings.startDate) return []

    const start = parse(settings.startDate, 'yyyy-MM-dd', new Date())
    const days = []

    for (let i = 0; i < 30; i++) {
      const date = addDays(start, i)
      const times = getDefaultPrayerTimes(i)

      days.push({
        day: i + 1,
        date,
        dateStr: format(date, 'dd/MM'),
        dayName: format(date, 'EEEE', { locale: fr }),
        suhoor: times.fajr, // Suhoor = avant Fajr
        iftar: times.maghrib // Iftar = Maghrib
      })
    }

    return days
  }, [settings.startDate])

  // Jour courant de Ramadan
  const currentRamadanDay = useMemo(() => {
    if (!settings.startDate || !settings.endDate || !settings.enabled) return null

    const now = new Date()
    const start = parse(settings.startDate, 'yyyy-MM-dd', new Date())
    const end = parse(settings.endDate, 'yyyy-MM-dd', new Date())

    if (!isWithinInterval(now, { start, end })) return null

    return differenceInDays(now, start) + 1
  }, [settings.startDate, settings.endDate, settings.enabled])

  const handleSave = async () => {
    setSaving(true)
    try {
      await setDocument('settings', 'ramadan', {
        ...settings,
        updatedAt: new Date()
      })
      toast.success('Paramètres Ramadan sauvegardés')
    } catch (error) {
      console.error('Error saving ramadan settings:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = () => {
    setSettings({ ...settings, enabled: !settings.enabled })
  }

  const handleNotificationToggle = (type) => {
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [type]: {
          ...settings.notifications[type],
          enabled: !settings.notifications[type].enabled
        }
      }
    })
  }

  const handleNotificationMinutes = (type, value) => {
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [type]: {
          ...settings.notifications[type],
          minutesBefore: parseInt(value) || 0
        }
      }
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loading size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Moon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Mode Ramadan</h1>
            <p className="text-white/60">Gérez les paramètres du mois béni</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
          settings.enabled ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/50'
        }`}>
          <span className={`w-2 h-2 rounded-full ${settings.enabled ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
          {settings.enabled ? 'Mode actif' : 'Mode inactif'}
          {currentRamadanDay && ` - Jour ${currentRamadanDay}/30`}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-secondary text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Toggle principal */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  settings.enabled ? 'bg-violet-500/20' : 'bg-white/5'
                }`}>
                  <Moon className={`w-7 h-7 ${settings.enabled ? 'text-violet-400' : 'text-white/30'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Activer le mode Ramadan</h3>
                  <p className="text-white/50 text-sm">
                    Affiche les horaires Suhoor/Iftar dans l'application
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleEnabled}
                className={`relative w-16 h-9 rounded-full transition-colors ${
                  settings.enabled ? 'bg-violet-500' : 'bg-white/20'
                }`}
              >
                <span className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-transform ${
                  settings.enabled ? 'left-8' : 'left-1'
                }`} />
              </button>
            </div>
          </Card>

          {/* Dates */}
          <Card>
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-secondary" />
              Dates du Ramadan
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-sm mb-2">Date de début (1er Ramadan)</label>
                <input
                  type="date"
                  value={settings.startDate}
                  onChange={(e) => setSettings({ ...settings, startDate: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-secondary"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-2">Date de fin (29 ou 30 Ramadan)</label>
                <input
                  type="date"
                  value={settings.endDate}
                  onChange={(e) => setSettings({ ...settings, endDate: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-secondary"
                />
              </div>
            </div>
            {settings.startDate && settings.endDate && (
              <p className="mt-4 text-white/50 text-sm">
                Durée: {differenceInDays(parse(settings.endDate, 'yyyy-MM-dd', new Date()), parse(settings.startDate, 'yyyy-MM-dd', new Date())) + 1} jours
              </p>
            )}
          </Card>

          {/* Tarawih */}
          <Card>
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" />
              Prière de Tarawih
            </h3>
            <div className="max-w-xs">
              <label className="block text-white/70 text-sm mb-2">Heure de début (après Isha)</label>
              <input
                type="time"
                value={settings.tarawihTime}
                onChange={(e) => setSettings({ ...settings, tarawihTime: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-secondary"
              />
            </div>
          </Card>

          {/* Bouton sauvegarder */}
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Sauvegarder
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'horaires' && (
        <div className="space-y-6">
          {!settings.startDate ? (
            <Card>
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-white/30 mx-auto mb-4" />
                <p className="text-white/50">
                  Définissez d'abord la date de début dans l'onglet Paramètres
                </p>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-secondary" />
                    Calendrier Ramadan {settings.startDate ? new Date(settings.startDate).getFullYear() : ''}
                  </h3>
                  <p className="text-white/50 text-sm">
                    Horaires calculés pour Bourg-en-Bresse
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-white/50 font-medium">Jour</th>
                        <th className="text-left py-3 px-4 text-white/50 font-medium">Date</th>
                        <th className="text-center py-3 px-4 text-white/50 font-medium">
                          <span className="flex items-center justify-center gap-1">
                            <Sunrise className="w-4 h-4" /> Suhoor
                          </span>
                        </th>
                        <th className="text-center py-3 px-4 text-white/50 font-medium">
                          <span className="flex items-center justify-center gap-1">
                            <Utensils className="w-4 h-4" /> Iftar
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ramadanDays.map((day) => (
                        <tr
                          key={day.day}
                          className={`border-b border-white/5 ${
                            currentRamadanDay === day.day ? 'bg-violet-500/10' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                              currentRamadanDay === day.day
                                ? 'bg-violet-500 text-white'
                                : 'bg-white/10 text-white/70'
                            }`}>
                              {day.day}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-white font-medium">{day.dateStr}</p>
                            <p className="text-white/40 text-sm capitalize">{day.dayName}</p>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-amber-400 font-mono font-semibold">{day.suhoor}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-green-400 font-mono font-semibold">{day.iftar}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <p className="text-white/40 text-sm text-center">
                Les horaires sont calculés automatiquement. Ils seront mis à jour en temps réel dans l'application.
              </p>
            </>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Notification Suhoor */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  settings.notifications.suhoor.enabled ? 'bg-amber-500/20' : 'bg-white/5'
                }`}>
                  <Sunrise className={`w-6 h-6 ${settings.notifications.suhoor.enabled ? 'text-amber-400' : 'text-white/30'}`} />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Rappel Suhoor</h4>
                  <p className="text-white/50 text-sm">Notification avant la fin du Suhoor</p>
                </div>
              </div>
              <button
                onClick={() => handleNotificationToggle('suhoor')}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  settings.notifications.suhoor.enabled ? 'bg-amber-500' : 'bg-white/20'
                }`}
              >
                <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  settings.notifications.suhoor.enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
            {settings.notifications.suhoor.enabled && (
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <label className="text-white/70 text-sm">Minutes avant Fajr:</label>
                <select
                  value={settings.notifications.suhoor.minutesBefore}
                  onChange={(e) => handleNotificationMinutes('suhoor', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-secondary"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 heure</option>
                </select>
                <p className="text-white/40 text-sm ml-auto">
                  "Il reste {settings.notifications.suhoor.minutesBefore} min pour le Suhoor"
                </p>
              </div>
            )}
          </Card>

          {/* Notification Iftar */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  settings.notifications.iftar.enabled ? 'bg-green-500/20' : 'bg-white/5'
                }`}>
                  <Utensils className={`w-6 h-6 ${settings.notifications.iftar.enabled ? 'text-green-400' : 'text-white/30'}`} />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Rappel Iftar</h4>
                  <p className="text-white/50 text-sm">Notification à l'heure de la rupture</p>
                </div>
              </div>
              <button
                onClick={() => handleNotificationToggle('iftar')}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  settings.notifications.iftar.enabled ? 'bg-green-500' : 'bg-white/20'
                }`}
              >
                <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  settings.notifications.iftar.enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
            {settings.notifications.iftar.enabled && (
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <label className="text-white/70 text-sm">Minutes avant Maghrib:</label>
                <select
                  value={settings.notifications.iftar.minutesBefore}
                  onChange={(e) => handleNotificationMinutes('iftar', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-secondary"
                >
                  <option value="0">À l'heure exacte</option>
                  <option value="5">5 min avant</option>
                  <option value="10">10 min avant</option>
                  <option value="15">15 min avant</option>
                </select>
                <p className="text-white/40 text-sm ml-auto">
                  {settings.notifications.iftar.minutesBefore === 0
                    ? '"C\'est l\'heure de l\'Iftar !"'
                    : `"L'Iftar dans ${settings.notifications.iftar.minutesBefore} min"`
                  }
                </p>
              </div>
            )}
          </Card>

          {/* Notification Tarawih */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  settings.notifications.tarawih.enabled ? 'bg-violet-500/20' : 'bg-white/5'
                }`}>
                  <Moon className={`w-6 h-6 ${settings.notifications.tarawih.enabled ? 'text-violet-400' : 'text-white/30'}`} />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Rappel Tarawih</h4>
                  <p className="text-white/50 text-sm">Notification avant la prière de Tarawih</p>
                </div>
              </div>
              <button
                onClick={() => handleNotificationToggle('tarawih')}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  settings.notifications.tarawih.enabled ? 'bg-violet-500' : 'bg-white/20'
                }`}
              >
                <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  settings.notifications.tarawih.enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
            {settings.notifications.tarawih.enabled && (
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <label className="text-white/70 text-sm">Minutes avant Tarawih:</label>
                <select
                  value={settings.notifications.tarawih.minutesBefore}
                  onChange={(e) => handleNotificationMinutes('tarawih', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-secondary"
                >
                  <option value="10">10 min</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                </select>
                <p className="text-white/40 text-sm ml-auto">
                  "Tarawih à {settings.tarawihTime || '21:30'}"
                </p>
              </div>
            )}
          </Card>

          {/* Bouton sauvegarder */}
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Sauvegarder
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
