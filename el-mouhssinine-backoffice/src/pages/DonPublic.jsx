const STRIPE_PAYMENT_LINK_DON = 'https://buy.stripe.com/cNi7sEfc9fkceku8973oA00'

export default function DonPublic() {
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
        {/* Message principal */}
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center space-y-6">
          <p className="text-lg text-gray-700 leading-relaxed">
            Soutenez les activités de la mosquée El Mohsinine. Votre don est
            déductible des impôts à hauteur de 66% dans la limite de 20% du
            revenu imposable. Un reçu fiscal (CERFA) vous sera envoyé
            automatiquement par email.
          </p>

          <a
            href={STRIPE_PAYMENT_LINK_DON}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-10 rounded-xl text-lg transition-colors shadow-md"
          >
            💳 Faire un don sécurisé
          </a>

          <p className="text-sm text-gray-400">
            Paiement sécurisé par Stripe (certifié PCI-DSS)
          </p>
        </div>

        {/* Virement bancaire */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border p-8 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            🏦 Don par virement bancaire
          </h2>
          <p className="text-gray-600">
            Vous pouvez également effectuer un don par virement bancaire aux
            coordonnées suivantes :
          </p>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm space-y-1 text-gray-700">
            <p>
              <span className="text-gray-400">Titulaire :</span> MOSQUEE EL
              MOHSININE
            </p>
            <p>
              <span className="text-gray-400">IBAN :</span> Disponible sur
              demande
            </p>
            <p>
              <span className="text-gray-400">Objet :</span> DON + votre nom
            </p>
          </div>
          <p className="text-sm text-gray-500">
            Pour obtenir l'IBAN ou pour tout renseignement, contactez-nous à{' '}
            <a
              href="mailto:centreculturelislamique@orange.fr"
              className="text-emerald-600 underline"
            >
              centreculturelislamique@orange.fr
            </a>
          </p>
        </div>

        {/* Reçu fiscal */}
        <div className="mt-8 bg-emerald-50 rounded-2xl border border-emerald-200 p-6 text-center">
          <p className="text-emerald-800 font-medium">
            📄 Un reçu fiscal (CERFA) est automatiquement généré pour chaque don
            et envoyé par email.
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center text-sm text-gray-400 space-y-2">
          <p>
            <a href="/privacy" className="text-emerald-600 underline">
              Politique de confidentialité
            </a>
          </p>
          <p>
            © {new Date().getFullYear()} Mosquée El Mohsinine — Tous droits
            réservés
          </p>
        </footer>
      </main>
    </div>
  )
}
