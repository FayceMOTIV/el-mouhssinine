export default function ProgressBar({
  value,
  max,
  showLabel = true,
  size = 'md',
  className = ''
}) {
  const percentage = Math.min(Math.round((value / max) * 100), 100)

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4'
  }

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/70">{value.toLocaleString()} €</span>
          <span className="text-white/50">{max.toLocaleString()} €</span>
        </div>
      )}
      <div className={`w-full bg-white/10 rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className="h-full bg-gradient-to-r from-secondary to-secondary/70 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-right text-xs text-white/50 mt-1">{percentage}%</p>
      )}
    </div>
  )
}
