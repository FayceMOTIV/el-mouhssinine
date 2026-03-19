import { useState, useEffect } from 'react'

const CF_URL = 'https://europe-west1-el-mouhssinine.cloudfunctions.net/createPublicCheckoutSession'
const PRESET_AMOUNTS = [10, 20, 50, 100, 200]

export default function DonPublic() {
  const [amount, setAmount] = useState('')
  const [customAmount, setCustomAmount] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') {
      setSuccess(true)
      const appRedirect = params.get('app_redirect')
      window.history.replaceState({}, '', '/don')
      if (appRedirect) {
        // Rediriger vers l'app après affichage bref du message de succès
        setTimeout(() => {
          window.location.href = appRedirect
        }, 2000)
      }
    }
  }, [])

  const finalAmount = customAmount || amount

  const handleDon = async () => {
    setError('')
    const parsed = parseFloat(finalAmount)
    if (!parsed || parsed < 1 || parsed > 5000) {
      setError('Veuillez choisir un montant entre 1 € et 5 000 €.')
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Veuillez saisir une adresse email valide.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(CF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsed, email: email.trim().toLowerCase(), name: name.trim() }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Une erreur est survenue. Réessayez.')
      }
    } catch (err) {
      setError('Impossible de contacter le serveur. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-emerald-700 text-white py-8">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-3xl font-bold">🕌 Faire un don</h1>
          <p className="mt-2 text-emerald-100">
            Mosquée El Mohsinine — Centre Culturel Islamique
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">

        {/* Page de remerciement après paiement réussi */}
        {success ? (
          <div className="bg-white rounded-2xl shadow-sm border p-10 text-center space-y-6">
            <div className="text-6xl">✅</div>
            <h2 className="text-2xl font-bold text-gray-900">Votre don a bien été enregistré !</h2>
            <p className="text-lg text-emerald-700 font-semibold">جزاك الله خيرا — Jazak Allah Khayran</p>
            <p className="text-gray-600 leading-relaxed">
              Merci pour votre générosité envers la mosquée El Mouhssinine.<br />
              Votre paiement a été confirmé avec succès.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
              <p className="font-medium mb-1">📄 Reçu fiscal</p>
              <p>Un reçu fiscal (CERFA) vous sera envoyé automatiquement par email en début d'année prochaine.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">💡 Le saviez-vous ?</p>
              <p>Votre don est déductible des impôts à hauteur de 66 % dans la limite de 20 % du revenu imposable.</p>
            </div>
            <button
              onClick={() => setSuccess(false)}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
            >
              Faire un autre don
            </button>
          </div>
        ) : (
        <>
        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6">
          <p className="text-gray-700 leading-relaxed text-center">
            Votre don est déductible des impôts à hauteur de <strong>66 %</strong> dans la limite de 20 % du revenu imposable. Un reçu fiscal (CERFA) vous sera envoyé automatiquement.
          </p>

          {/* Montants présets */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Choisissez un montant</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map(a => (
                <button
                  key={a}
                  onClick={() => { setAmount(String(a)); setCustomAmount('') }}
                  className={`px-4 py-2 rounded-lg border font-semibold text-sm transition-colors ${
                    amount === String(a) && !customAmount
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-500'
                  }`}
                >
                  {a} €
                </button>
              ))}
            </div>
          </div>

          {/* Montant libre */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Ou saisir un montant libre (€)
            </label>
            <input
              type="number"
              min="1"
              max="5000"
              placeholder="Ex : 75"
              value={customAmount}
              onChange={e => { setCustomAmount(e.target.value); setAmount('') }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Adresse email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              placeholder="votre@email.fr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Le reçu fiscal sera envoyé à cette adresse.
            </p>
          </div>

          {/* Nom (optionnel) */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Nom complet <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              placeholder="Prénom Nom"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Erreur */}
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          {/* Montant sélectionné */}
          {finalAmount && parseFloat(finalAmount) >= 1 && (
            <div className="bg-emerald-50 rounded-lg px-4 py-3 text-emerald-800 text-sm text-center font-medium">
              Montant du don : <strong>{parseFloat(finalAmount).toLocaleString('fr-FR')} €</strong>
            </div>
          )}

          {/* Bouton */}
          <button
            onClick={handleDon}
            disabled={loading || !finalAmount}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg transition-colors shadow-md"
          >
            {loading ? '⏳ Redirection...' : `💳 Faire un don sécurisé${finalAmount && parseFloat(finalAmount) >= 1 ? ` — ${parseFloat(finalAmount).toLocaleString('fr-FR')} €` : ''}`}
          </button>

          <p className="text-sm text-gray-400 text-center">
            Paiement sécurisé par Stripe (certifié PCI-DSS)
          </p>
        </div>

        {/* Virement bancaire */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border p-8 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">🏦 Don par virement bancaire</h2>
          <p className="text-gray-600">
            Vous pouvez également effectuer un don par virement bancaire aux coordonnées suivantes :
          </p>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm space-y-1 text-gray-700">
            <p><span className="text-gray-400">Titulaire :</span> MOSQUEE EL MOHSININE</p>
            <p><span className="text-gray-400">IBAN :</span> Disponible sur l'application El Mouhssinine</p>
            <p><span className="text-gray-400">Objet :</span> DON + votre nom</p>
          </div>
          <p className="text-sm text-gray-500">
            Téléchargez l'application El Mouhssinine pour accéder au RIB complet, ou contactez-nous à{' '}
            <a href="mailto:centreculturelislamique@orange.fr" className="text-emerald-600 underline">
              centreculturelislamique@orange.fr
            </a>
          </p>
        </div>

        {/* Reçu fiscal */}
        <div className="mt-8 bg-emerald-50 rounded-2xl border border-emerald-200 p-6 text-center">
          <p className="text-emerald-800 font-medium">
            📄 Un reçu fiscal (CERFA) est automatiquement généré pour chaque don et envoyé par email.
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center text-sm text-gray-400 space-y-2">
          <p>
            <a href="/privacy" className="text-emerald-600 underline">Politique de confidentialité</a>
          </p>
          <p>© {new Date().getFullYear()} Mosquée El Mohsinine — Tous droits réservés</p>
        </footer>
        </>
        )}
      </main>
    </div>
  )
}
