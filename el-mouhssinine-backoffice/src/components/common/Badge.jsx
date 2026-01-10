const variants = {
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  danger: 'bg-red-500/20 text-red-400 border-red-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  default: 'bg-white/10 text-white/70 border-white/20',
  gold: 'bg-secondary/20 text-secondary border-secondary/30'
}

export default function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
        border ${variants[variant]} ${className}
      `}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const statusConfig = {
    actif: { label: 'Actif', variant: 'success' },
    active: { label: 'Actif', variant: 'success' },
    expire: { label: 'Expiré', variant: 'danger' },
    expired: { label: 'Expiré', variant: 'danger' },
    aucun: { label: 'Aucun', variant: 'default' },
    none: { label: 'Aucun', variant: 'default' },
    programmee: { label: 'Programmée', variant: 'info' },
    envoyee: { label: 'Envoyée', variant: 'success' },
    echouee: { label: 'Échouée', variant: 'danger' },
    annulee: { label: 'Annulée', variant: 'warning' },
    pending: { label: 'En attente', variant: 'warning' },
    completed: { label: 'Terminé', variant: 'success' },
    failed: { label: 'Échoué', variant: 'danger' }
  }

  const config = statusConfig[status] || { label: status, variant: 'default' }

  return <Badge variant={config.variant}>{config.label}</Badge>
}
