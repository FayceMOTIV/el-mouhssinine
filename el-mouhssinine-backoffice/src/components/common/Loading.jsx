export default function Loading({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3'
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`
          ${sizes[size]} border-secondary border-t-transparent
          rounded-full animate-spin
        `}
      />
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loading size="lg" />
        <p className="mt-4 text-white/50">Chargement...</p>
      </div>
    </div>
  )
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 bg-bg-dark flex items-center justify-center z-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-white/70 text-lg">Chargement...</p>
      </div>
    </div>
  )
}
