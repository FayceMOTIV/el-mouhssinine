import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export default function Table({
  columns,
  data,
  loading = false,
  emptyMessage = 'Aucune donnée',
  onRowClick,
  pagination = null,
  sortable = true
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  const handleSort = (key) => {
    if (!sortable) return
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0
    const aVal = a[sortConfig.key]
    const bVal = b[sortConfig.key]
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  if (loading) {
    return (
      <div className="bg-white/5 border border-border-gold rounded-xl p-8">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white/5 border border-border-gold rounded-xl p-8">
        <p className="text-center text-white/50">{emptyMessage}</p>
      </div>
    )
  }

  // Détecte la colonne "actions" (rendue pleine largeur en bas de la carte mobile)
  const isActionCol = (col) =>
    !col.label || /action/i.test(col.key || '') || /action/i.test(col.label || '')

  return (
    <div className="bg-white/5 border border-border-gold rounded-xl overflow-hidden">
      {/* ===== Vue MOBILE : cartes empilées (md:hidden) ===== */}
      <div className="md:hidden divide-y divide-white/5">
        {sortedData.map((row, idx) => {
          const main = columns[0]
          const middle = columns.slice(1).filter((c) => !isActionCol(c))
          const actions = columns.filter(isActionCol)
          return (
            <div
              key={row.id || idx}
              className={`p-4 ${onRowClick ? 'active:bg-white/5' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {/* Identité principale (1ère colonne) */}
              <div className="mb-3">{main.render ? main.render(row) : row[main.key]}</div>
              {/* Détails (label: valeur) */}
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {middle.map((col) => {
                  const val = col.render ? col.render(row) : row[col.key]
                  return (
                    <div key={col.key} className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-white/30">{col.label}</p>
                      <div className="text-sm text-white/80">{val ?? '-'}</div>
                    </div>
                  )
                })}
              </div>
              {/* Actions pleine largeur */}
              {actions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {actions.map((col) => (
                    <div key={col.key}>{col.render ? col.render(row) : row[col.key]}</div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ===== Vue DESKTOP : tableau (hidden md:block) ===== */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-6 py-4 text-left text-sm font-medium text-white/70
                    ${sortable && col.sortable !== false ? 'cursor-pointer hover:text-white' : ''}
                  `}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {sortable && col.sortable !== false && sortConfig.key === col.key && (
                      sortConfig.direction === 'asc'
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <tr
                key={row.id || idx}
                className={`
                  border-b border-white/5 last:border-0
                  ${onRowClick ? 'cursor-pointer hover:bg-white/5' : ''}
                  transition-colors
                `}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 text-sm text-white/80">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <p className="text-sm text-white/50">
            {pagination.from}-{pagination.to} sur {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={pagination.onPrev}
              disabled={!pagination.hasPrev}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={pagination.onNext}
              disabled={!pagination.hasNext}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
