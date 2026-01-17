export default function Card({ children, className = '', title, icon: Icon, action, ...props }) {
  return (
    <div
      className={`
        bg-white/5 border border-border-gold rounded-xl p-6
        transition-all duration-300 hover:border-secondary/50
        ${className}
      `}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-secondary" />}
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatCard({ icon: Icon, label, title, value, subvalue, trend, trendUp, variant = 'default', className = '' }) {
  // Support both 'label' and 'title' props
  const displayLabel = label || title

  // Parse trend - can be string like "+12%" or number
  const trendValue = typeof trend === 'string' ? parseFloat(trend) : trend
  const isPositive = trendUp !== undefined ? trendUp : (trendValue > 0)

  // Variant styles for icon background and color
  const variantStyles = {
    default: { bg: 'bg-secondary/20', text: 'text-secondary' },
    success: { bg: 'bg-green-500/20', text: 'text-green-400' },
    warning: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    danger: { bg: 'bg-red-500/20', text: 'text-red-400' },
    info: { bg: 'bg-blue-500/20', text: 'text-blue-400' }
  }
  const style = variantStyles[variant] || variantStyles.default

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/60 text-sm mb-1">{displayLabel}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subvalue && <p className="text-white/50 text-sm mt-1">{subvalue}</p>}
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${style.text}`} />
          </div>
        )}
      </div>
      {trend && (
        <div className={`mt-3 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {typeof trend === 'string' ? trend : `${trend > 0 ? '+' : ''}${trend}%`} vs mois dernier
        </div>
      )}
    </Card>
  )
}
