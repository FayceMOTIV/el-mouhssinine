import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Clock, Save, RotateCcw, Lock, Edit3, RefreshCw, Plus } from 'lucide-react'
import { Card, Button, Loading } from '../components/common'
import { getPrayerTimes, updatePrayerTimes } from '../services/firebase'

const PRAYERS = [
  { id: 'fajr', label: 'Fajr', labelAr: 'الفجر', hasIqama: true },
  { id: 'sunrise', label: 'Lever du soleil', labelAr: 'الشروق', hasIqama: false },
  { id: 'dhuhr', label: 'Dhuhr', labelAr: 'الظهر', hasIqama: true },
  { id: 'asr', label: 'Asr', labelAr: 'العصر', hasIqama: true },
  { id: 'maghrib', label: 'Maghrib', labelAr: 'المغرب', hasIqama: true },
  { id: 'isha', label: 'Isha', labelAr: 'العشاء', hasIqama: true }
]

// Helper function to add minutes to a time string (HH:MM)
const addMinutesToTime = (time, minutes) => {
  if (!time || !minutes) return '--:--'
  const [hours, mins] = time.split(':').map(Number)
  const totalMins = hours * 60 + mins + parseInt(minutes)
  const newHours = Math.floor(totalMins / 60) % 24
  const newMins = totalMins % 60
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`
}

const JUMUAH_SLOTS = [
  { id: 'jumua1', label: '1ère Jumu\'a' },
  { id: 'jumua2', label: '2ème Jumu\'a' },
  { id: 'jumua3', label: '3ème Jumu\'a' }
]

export default function Horaires() {
  const [adhanTimes, setAdhanTimes] = useState({})
  const [iqamaTimes, setIqamaTimes] = useState({})
  const [jumuaTimes, setJumuaTimes] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingApi, setLoadingApi] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch Adhan times from Aladhan API
  const fetchAdhanTimes = async () => {
    setLoadingApi(true)
    try {
      const response = await fetch(
        'https://api.aladhan.com/v1/timingsByCity?city=Bourg-en-Bresse&country=France&method=99&methodSettings=12,null,12'
      )
      const data = await response.json()

      if (data.code === 200 && data.data?.timings) {
        const timings = data.data.timings
        setAdhanTimes({
          fajr: timings.Fajr.substring(0, 5),
          sunrise: timings.Sunrise.substring(0, 5),
          dhuhr: timings.Dhuhr.substring(0, 5),
          asr: timings.Asr.substring(0, 5),
          maghrib: timings.Maghrib.substring(0, 5),
          isha: timings.Isha.substring(0, 5),
        })
      } else {
        throw new Error('Invalid API response')
      }
    } catch (error) {
      console.error('Erreur API Aladhan:', error)
      toast.error('Erreur lors de la récupération des horaires Adhan')
    } finally {
      setLoadingApi(false)
    }
  }

  // Load Iqama and Jumua times from Firebase
  const loadFirebaseTimes = async () => {
    try {
      const data = await getPrayerTimes()
      if (data) {
        setIqamaTimes(data.iqama || {})
        setJumuaTimes(data.jumua || {})
      }
    } catch (err) {
      console.error('Error loading prayer times:', err)
      toast.error('Erreur lors du chargement des horaires Iqama')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdhanTimes()
    loadFirebaseTimes()
  }, [])

  const handleIqamaChange = (prayer, value) => {
    setIqamaTimes(prev => ({ ...prev, [prayer]: value }))
  }

  const handleJumuaChange = (slot, value) => {
    setJumuaTimes(prev => ({ ...prev, [slot]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Only save Iqama and Jumua times (Adhan comes from API)
      await updatePrayerTimes({
        iqama: iqamaTimes,
        jumua: jumuaTimes,
        lastUpdated: new Date().toISOString()
      })
      toast.success('Horaires Iqama et Jumu\'a mis à jour avec succès')
    } catch (err) {
      console.error('Error saving prayer times:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    loadFirebaseTimes()
    toast.info('Modifications annulées')
  }

  const handleRefreshApi = () => {
    fetchAdhanTimes()
    toast.info('Horaires Adhan actualisés depuis l\'API')
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
      {/* Header Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Annuler
        </Button>
        <Button onClick={handleSave} loading={saving}>
          <Save className="w-4 h-4 mr-2" />
          Enregistrer
        </Button>
      </div>

      {/* Daily Prayers */}
      <Card title="Horaires quotidiens" icon={Clock}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/50 text-sm">
            Les horaires Adhan sont récupérés automatiquement depuis l'API Aladhan (Bourg-en-Bresse, France).
          </p>
          <Button variant="ghost" size="sm" onClick={handleRefreshApi} disabled={loadingApi}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingApi ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRAYERS.map(prayer => (
            <div key={prayer.id} className="bg-white/5 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="font-medium text-white">{prayer.label}</h4>
                  <p className="text-sm text-secondary">{prayer.labelAr}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Adhan - Read Only from API */}
                <div>
                  <label className="block text-xs text-white/50 mb-1">Adhan</label>
                  <div className="relative">
                    <input
                      type="time"
                      value={adhanTimes[prayer.id] || ''}
                      disabled
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Lock className="w-3 h-3 text-blue-400" />
                    <span className="text-xs text-blue-400">Auto (API)</span>
                  </div>
                </div>

                {/* Iqama - Delay in minutes (except for sunrise) */}
                {prayer.hasIqama && (
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Délai Iqama</label>
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-white/50" />
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={iqamaTimes[prayer.id] || ''}
                        onChange={(e) => handleIqamaChange(prayer.id, e.target.value)}
                        placeholder="10"
                        className="w-20 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-secondary"
                      />
                      <span className="text-white/50 text-sm">min</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Edit3 className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400">
                        Iqama: {addMinutesToTime(adhanTimes[prayer.id], iqamaTimes[prayer.id])}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Jumu'a Times */}
      <Card title="Horaires Jumu'a (Vendredi)" icon={Clock}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {JUMUAH_SLOTS.map(slot => (
            <div key={slot.id} className="bg-white/5 rounded-lg p-4">
              <h4 className="font-medium text-white mb-4">{slot.label}</h4>
              <input
                type="time"
                value={jumuaTimes[slot.id] || ''}
                onChange={(e) => handleJumuaChange(slot.id, e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-secondary"
              />
              <div className="flex items-center gap-1 mt-2">
                <Edit3 className="w-3 h-3 text-green-400" />
                <span className="text-xs text-green-400">Modifiable</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-white/50 text-sm mt-4">
          Note: Les horaires de Jumu'a sont affichés uniquement le vendredi sur l'application mobile.
        </p>
      </Card>

      {/* Info */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h4 className="font-medium text-white mb-1">Fonctionnement des horaires</h4>
            <div className="text-sm text-white/50 space-y-2">
              <p>
                <span className="text-blue-400 font-medium">Adhan :</span> Horaires récupérés automatiquement depuis l'API Aladhan.
                Ils sont calculés selon les coordonnées de Bourg-en-Bresse avec un angle de 12° pour Fajr et Isha.
              </p>
              <p>
                <span className="text-green-400 font-medium">Délai Iqama :</span> Nombre de minutes à ajouter à l'heure de l'Adhan.
                Exemple : Adhan Fajr à 05:12 + délai de 10 min = Iqama à 05:22.
              </p>
              <p>
                Les modifications seront visibles immédiatement par les utilisateurs de l'application mobile.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
