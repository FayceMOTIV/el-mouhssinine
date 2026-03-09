export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-emerald-700 text-white py-8">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
          <p className="mt-2 text-emerald-100">
            Mosquée El Mohsinine — Centre Culturel Islamique
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8 text-gray-700 leading-relaxed">
        <p className="text-sm text-gray-500">
          Dernière mise à jour : 9 mars 2026
        </p>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            1. Responsable du traitement
          </h2>
          <p>
            L'association Mosquée El Mohsinine (Centre Culturel Islamique),
            ci-après « l'Association », est responsable du traitement des
            données personnelles collectées via l'application mobile « El
            Mouhssinine » et le site web el-mouhssinine.web.app.
          </p>
          <p className="mt-2">
            Contact :{' '}
            <a
              href="mailto:centreculturelislamique@orange.fr"
              className="text-emerald-600 underline"
            >
              centreculturelislamique@orange.fr
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            2. Données collectées
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Identité :</strong> nom, prénom, email, téléphone, adresse
              (pour l'adhésion)
            </li>
            <li>
              <strong>Paiement :</strong> les données bancaires sont traitées
              exclusivement par Stripe (certifié PCI-DSS). Nous ne stockons
              aucun numéro de carte.
            </li>
            <li>
              <strong>Notifications :</strong> jeton FCM (Firebase Cloud
              Messaging) pour l'envoi de notifications push
            </li>
            <li>
              <strong>Géolocalisation :</strong> utilisée localement pour la
              Qibla, les horaires de prière et le rappel silencieux à la
              mosquée.{' '}
              <strong>
                Votre position n'est jamais enregistrée sur nos serveurs.
              </strong>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            3. Finalités du traitement
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Gestion des adhésions et cotisations</li>
            <li>Émission de reçus fiscaux (CERFA)</li>
            <li>Envoi de notifications (annonces, événements, janaza)</li>
            <li>Communication avec les membres (messagerie interne)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            4. Base légale
          </h2>
          <p>
            Le traitement des données repose sur le consentement de l'utilisateur
            (article 6.1.a du RGPD) lors de l'inscription, et sur l'exécution
            d'un contrat (article 6.1.b) pour la gestion des adhésions.
          </p>
          <p className="mt-2">
            Les données de nature religieuse (appartenance à une mosquée) sont
            traitées conformément à l'article 9.2.d du RGPD (traitement par une
            association à but religieux, dans le cadre de ses activités
            légitimes).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            5. Durée de conservation
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Données d'adhésion : durée de l'adhésion + 3 ans (prescription
              civile)
            </li>
            <li>
              Reçus fiscaux : 6 ans (obligation fiscale française)
            </li>
            <li>
              Données de paiement : conservées par Stripe selon leur politique
            </li>
            <li>
              Données supprimées : anonymisées immédiatement sur demande
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            6. Sous-traitants
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Firebase (Google) :</strong> hébergement, authentification,
              base de données — serveurs UE (europe-west1)
            </li>
            <li>
              <strong>Stripe :</strong> paiements — certifié PCI-DSS niveau 1
            </li>
            <li>
              <strong>Brevo (Sendinblue) :</strong> emails transactionnels —
              serveurs UE
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            7. Vos droits (RGPD)
          </h2>
          <p>
            Conformément au Règlement Général sur la Protection des Données,
            vous disposez des droits suivants :
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              <strong>Droit d'accès :</strong> obtenir une copie de vos données
              (via l'app : Plus → Exporter mes données)
            </li>
            <li>
              <strong>Droit de rectification :</strong> modifier vos
              informations (via l'app : Profil → Modifier)
            </li>
            <li>
              <strong>Droit de suppression :</strong> supprimer votre compte et
              toutes vos données (via l'app : Plus → Supprimer mon compte)
            </li>
            <li>
              <strong>Droit à la portabilité :</strong> exporter vos données au
              format JSON
            </li>
          </ul>
          <p className="mt-2">
            Pour exercer ces droits, contactez-nous à{' '}
            <a
              href="mailto:centreculturelislamique@orange.fr"
              className="text-emerald-600 underline"
            >
              centreculturelislamique@orange.fr
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            8. Sécurité
          </h2>
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles
            appropriées : chiffrement TLS, règles Firestore restrictives,
            validation côté serveur (Cloud Functions), authentification Firebase
            Auth, et audit régulier du code.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            9. Réclamation
          </h2>
          <p>
            En cas de litige, vous pouvez adresser une réclamation à la CNIL :{' '}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 underline"
            >
              www.cnil.fr
            </a>
          </p>
        </section>

        <footer className="border-t pt-6 text-sm text-gray-400 text-center">
          © {new Date().getFullYear()} Mosquée El Mohsinine — Tous droits
          réservés
        </footer>
      </main>
    </div>
  )
}
