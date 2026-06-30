import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { resetPassword } from '../services/firebase'
import { Button, Input } from '../components/common'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState(null) // { type: 'success' | 'error' | 'info', text }
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email ou mot de passe incorrect')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Trop de tentatives. Veuillez réessayer plus tard.')
      } else {
        setError('Une erreur est survenue. Réessayez.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    const targetEmail = (resetEmail || email).trim()
    if (!targetEmail) {
      setResetMsg({ type: 'error', text: 'Entrez votre adresse email.' })
      return
    }
    setResetLoading(true)
    setResetMsg(null)
    try {
      await resetPassword(targetEmail)
      setResetMsg({ type: 'success', text: 'Email envoyé ! Vérifiez votre boîte de réception (et les spams).' })
    } catch (err) {
      const code = err?.code || ''
      if (code.includes('resource-exhausted')) {
        setResetMsg({ type: 'info', text: 'Patientez 2 minutes avant de redemander un lien.' })
      } else if (code.includes('invalid-argument')) {
        setResetMsg({ type: 'error', text: 'Adresse email invalide.' })
      } else {
        setResetMsg({ type: 'success', text: 'Si un compte existe, un email a été envoyé (pensez à vérifier les spams).' })
      }
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-3xl">EM</span>
          </div>
          <h1 className="text-2xl font-bold text-white">El Mouhssinine</h1>
          <p className="text-white/50 mt-1">Backoffice Administration</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Connexion</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@elmouhssinine.org"
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-secondary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-secondary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-6"
              loading={loading}
              disabled={loading}
            >
              Se connecter
            </Button>
          </form>

          {/* Mot de passe oublié */}
          <div className="mt-5 pt-5 border-t border-white/10">
            {!showReset ? (
              <button
                type="button"
                onClick={() => { setShowReset(true); setResetEmail(email); setResetMsg(null) }}
                className="w-full text-center text-sm text-secondary hover:underline"
              >
                Mot de passe oublié ?
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-white/70">
                  Entrez votre email, vous recevrez un lien de réinitialisation.
                </p>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="votre@email.fr"
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-secondary"
                  />
                </div>
                {resetMsg && (
                  <p className={`text-sm ${resetMsg.type === 'success' ? 'text-green-400' : resetMsg.type === 'info' ? 'text-amber-400' : 'text-red-400'}`}>
                    {resetMsg.text}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="button" onClick={handleReset} loading={resetLoading} className="flex-1">
                    {resetMsg?.type === 'success' ? 'Renvoyer le lien' : 'Envoyer le lien'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setShowReset(false); setResetMsg(null) }}
                    className="px-4 py-2 text-sm text-white/50 hover:text-white/80"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-white/30 text-sm mt-6">
          Mosquée El Mouhssinine — Bourg-en-Bresse © 2026
        </p>
      </div>
    </div>
  )
}
