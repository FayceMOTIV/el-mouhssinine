import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

export default function Input({
  label,
  error,
  icon: Icon,
  className = '',
  ...props
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-white/70 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        )}
        <input
          className={`
            w-full bg-white/5 border rounded-lg px-4 py-3 text-text-light
            placeholder-white/40 focus:outline-none transition-all duration-300
            ${Icon ? 'pl-11' : ''}
            ${error ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-secondary'}
          `}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}

export function PasswordInput({ label, error, className = '', ...props }) {
  const [show, setShow] = useState(false)

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-white/70 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`
            w-full bg-white/5 border rounded-lg px-4 py-3 pr-11 text-text-light
            placeholder-white/40 focus:outline-none transition-all duration-300
            ${error ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-secondary'}
          `}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className = '', rows = 4, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-white/70 mb-2">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={`
          w-full bg-white/5 border rounded-lg px-4 py-3 text-text-light
          placeholder-white/40 focus:outline-none transition-all duration-300 resize-none
          ${error ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-secondary'}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}

export function Select({ label, error, options = [], className = '', placeholder, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-white/70 mb-2">
          {label}
        </label>
      )}
      <select
        className={`
          w-full bg-white/5 border rounded-lg px-4 py-3 text-text-light
          focus:outline-none transition-all duration-300
          ${error ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-secondary'}
        `}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-bg-dark">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}

export function Toggle({ label, checked, onChange, className = '' }) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${className}`}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`
            w-11 h-6 rounded-full transition-colors duration-300
            ${checked ? 'bg-secondary' : 'bg-white/20'}
          `}
        />
        <div
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full
            transition-transform duration-300
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </div>
      {label && <span className="text-white/70">{label}</span>}
    </label>
  )
}
