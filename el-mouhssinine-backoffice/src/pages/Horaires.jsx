import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Clock, Save, RotateCcw } from 'lucide-react'
import { Card, Button, Input, Loading } from '../components/common'
import { getPrayerTimes, updatePrayerTimes } from '../services/firebase'

const PRAYERS = [
  { id: 'fajr', label: 'Fajr', labelAr: 'الفجر' },
  { id: 'sunrise', label: 'Lever du soleil', labelAr: 'الشروق' },
  { id: 'dhuhr', label: 'Dhuhr', labelAr: 'الظهر' },
  { id: 'asr', label: 'Asr', labelAr: 'العصر' },
  { id: 'maghrib', label: 'Maghrib', labelAr: 'المغرب' },
  { id: 'isha', label: 'Isha', labelAr: 'العشاء' }
]

const JUMUAH_SLOTS = [
  { id: 'jumua1', label: '1ère Jumu\'a' },
  { id: 'jumua2', label: '2ème Jumu\'a' },
  { id: 'jumua3', label: '3ème Jumu\'a' }
]

export default function Horaires() {
  const [times, setTimes] = useState({})
  const [iqamaTimes, setIqamaTimes] = useState({})
  const [jumuaTimes, setJumuaTimes] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTimes()
  }, [])

  const loadTimes = async () => {
    try {
      const data = await getPrayerTimes()
      if (data) {
        setTimes(data.times || {})
        setIqamaTimes(data.iqama || {})
        setJumuaTimes(data.jumua || {})
      }
    } catch (err) {
      console.error('Error loading prayer times:', err)
      toast.error('Erreur lors du chargement des horaires')
    } finally {
      setLoading(false)
    }
  }

  const handleTimeChange = (prayer, value) => {
    setTimes(prev => ({ ...prev, [prayer]: value }))
  }

  const handleIqamaChange = (prayer, value) => {
    setIqamaTimes(prev => ({ ...prev, [prayer]: value }))
  }

  const handleJumuaChange = (slot, value) => {
    setJumuaTimes(prev => ({ ...prev, [slot]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updatePrayerTimes({
        times,
        iqama: iqamaTimes,
        jumua: jumuaTimes,
        lastUpdated: new Date().toISOString()
      })
      toast.success('Horaires mis à jour avec succès')
    } catch (err) {
      console.error('Error saving prayer times:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    loadTimes()
    toast.info('Modifications annulées')
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
                <div>
                  <label className="block text-xs text-white/50 mb-1">Adhan</label>
                  <input
                    type="time"
                    value={times[prayer.id] || ''}
                    onChange={(e) => handleTimeChange(prayer.id, e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-secondary"
                  />
                </div>
                {prayer.id !== 'sunrise' && (
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Iqama</label>
                    <input
                      type="time"
                      value={iqamaTimes[prayer.id] || ''}
                      onChange={(e) => handleIqamaChange(prayer.id, e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-secondary"
                    />
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
            <h4 className="font-medium text-white mb-1">Synchronisation automatique</h4>
            <p className="text-sm text-white/50">
              Les horaires sont synchronisés en temps réel avec l'application mobile.
              Les modifications seront visibles immédiatement par les utilisateurs.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
