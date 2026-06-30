import { useState, useEffect } from 'react'
import { ClipboardList, AlertCircle } from 'lucide-react'
import { Card, Loading, EmptyState } from '../components/common'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import { format } from 'date-fns'

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(
          collection(db, 'audit_logs'),
          orderBy('createdAt', 'desc'),
          limit(200)
        )
        const snap = await getDocs(q)
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Error fetching audit logs:', err)
        setError('Erreur de chargement des logs')
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-8 h-8 text-amber-400" />
        <h1 className="text-2xl font-bold text-white">Journal d'audit</h1>
      </div>

      <Card>
        {error ? (
          <div className="text-center py-12 text-red-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-60" />
            <p>{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Aucun log"
            description="Aucune action auditée pour le moment."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 text-white/60">Date</th>
                  <th className="text-left p-3 text-white/60">Action</th>
                  <th className="text-left p-3 text-white/60">Admin</th>
                  <th className="text-left p-3 text-white/60">Détails</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-white/80">
                      {log.createdAt?.toDate
                        ? format(log.createdAt.toDate(), 'dd/MM/yyyy HH:mm')
                        : log.timestamp || '-'}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-white/80">{log.adminEmail || '-'}</td>
                    <td className="p-3 text-white/60">
                      {log.rowCount !== undefined && `${log.rowCount} lignes`}
                      {log.memberId && `Membre: ${log.memberId}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
