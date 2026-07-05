import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { Modal, Button } from './common'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Modal d'historique des paiements d'un membre, groupé année -> mois.
 * Source : collection payments (une entrée par prélèvement Stripe), matchée
 * sur membreId (BO) ou metadata.memberId (app).
 * Réutilisé sur la page Finances (onglet Abonnements) et Membres (modal cotisation).
 */
export default function MemberPaymentHistoryModal({ isOpen, onClose, member, payments = [] }) {
  const history = useMemo(() => {
    if (!member) return { years: [], total: 0, count: 0 }
    const uid = member.id
    const list = payments
      .filter(p => (p.membreId || p.metadata?.memberId) === uid)
      .map(p => {
        const rawDate = p.date || p.createdAt
        const date = rawDate?.toDate?.() || new Date(rawDate || Date.now())
        return {
          id: p.id,
          date,
          montant: p.montant || 0,
          type: p.type || 'cotisation',
          modePaiement: p.modePaiement || 'cb',
          status: p.status || 'succeeded',
        }
      })
      .sort((a, b) => b.date - a.date)

    const total = list.reduce((s, p) => s + p.montant, 0)
    const yearsMap = new Map()
    list.forEach(p => {
      const y = p.date.getFullYear()
      const mo = p.date.getMonth()
      if (!yearsMap.has(y)) yearsMap.set(y, { year: y, total: 0, count: 0, months: new Map() })
      const yEntry = yearsMap.get(y)
      yEntry.total += p.montant
      yEntry.count += 1
      if (!yEntry.months.has(mo)) yEntry.months.set(mo, { month: mo, total: 0, payments: [] })
      const mEntry = yEntry.months.get(mo)
      mEntry.total += p.montant
      mEntry.payments.push(p)
    })
    const years = [...yearsMap.values()]
      .sort((a, b) => b.year - a.year)
      .map(y => ({ ...y, months: [...y.months.values()].sort((a, b) => b.month - a.month) }))
    return { years, total, count: list.length }
  }, [member, payments])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Historique des paiements" size="lg">
      {member && (
        <div className="space-y-5">
          {/* En-tête membre */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-white/50 text-sm">Membre</p>
              <p className="text-white font-semibold">
                {`${member.prenom || ''} ${member.nom || ''}`.trim() || 'Membre'}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-sm">Email</p>
              <p className="text-white break-all">{member.email || '-'}</p>
            </div>
            <div>
              <p className="text-white/50 text-sm">Cotisation</p>
              <p className="text-secondary font-bold">
                {(member.montant || member.cotisation?.montant || 0).toLocaleString()} €
                {member.cotisation?.type ? ` / ${member.cotisation.type === 'mensuel' ? 'mois' : 'an'}` : ''}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-sm">Membre depuis</p>
              <p className="text-white">
                {member.cotisation?.dateDebut
                  ? format(member.cotisation.dateDebut?.toDate?.() || new Date(member.cotisation.dateDebut), 'dd/MM/yyyy', { locale: fr })
                  : '-'}
              </p>
            </div>
          </div>

          {/* Totaux */}
          <div className="flex gap-4">
            <div className="flex-1 bg-white/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-secondary">{history.total.toLocaleString()} €</p>
              <p className="text-white/50 text-sm mt-1">Total versé</p>
            </div>
            <div className="flex-1 bg-white/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">{history.count}</p>
              <p className="text-white/50 text-sm mt-1">Paiement{history.count > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Historique année -> mois */}
          {history.years.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              Aucun paiement enregistré pour ce membre
            </div>
          ) : (
            <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
              {history.years.map(y => (
                <div key={y.year} className="border border-white/10 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center bg-white/5 px-4 py-2">
                    <span className="text-white font-semibold">{y.year}</span>
                    <span className="text-secondary font-semibold">
                      {y.total.toLocaleString()} € · {y.count} paiement{y.count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {y.months.map(mo => (
                      <div key={mo.month} className="flex justify-between items-center px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-white/30" />
                          <span className="text-white/80 capitalize">
                            {format(new Date(y.year, mo.month, 1), 'MMMM', { locale: fr })}
                          </span>
                          {mo.payments.length > 1 && (
                            <span className="text-white/40 text-xs">({mo.payments.length})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-white/40 text-xs hidden sm:inline">
                            {mo.payments.map(p => format(p.date, 'dd/MM')).join(', ')}
                          </span>
                          <span className="text-secondary font-semibold">{mo.total.toLocaleString()} €</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
      </div>
    </Modal>
  )
}
