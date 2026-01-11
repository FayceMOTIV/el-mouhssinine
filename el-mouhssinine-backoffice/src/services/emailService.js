/**
 * Service d'envoi d'emails - El Mouhssinine
 *
 * Ce fichier prépare la structure pour l'envoi d'emails automatiques.
 * L'implémentation réelle nécessite la configuration d'un des providers suivants :
 * - Firebase Extension "Trigger Email from Firestore"
 * - Resend API
 * - SendGrid
 *
 * Voir EMAIL_SETUP.md pour les instructions de configuration.
 */

import { db, isDemoMode } from './firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

// ==================== CONFIGURATION ====================

/**
 * Provider d'email actif
 * Options: 'firebase-extension' | 'resend' | 'sendgrid' | 'none'
 */
const EMAIL_PROVIDER = 'none'

/**
 * Configuration des providers (à remplir selon le provider choisi)
 */
const CONFIG = {
  // Pour Resend API
  resend: {
    apiKey: process.env.VITE_RESEND_API_KEY || '',
    fromEmail: 'noreply@el-mouhssinine.fr',
    fromName: 'Mosquée El Mouhssinine'
  },
  // Pour SendGrid
  sendgrid: {
    apiKey: process.env.VITE_SENDGRID_API_KEY || '',
    fromEmail: 'noreply@el-mouhssinine.fr',
    fromName: 'Mosquée El Mouhssinine'
  },
  // Pour Firebase Extension
  firebase: {
    mailCollection: 'mail', // Collection Firestore pour les emails
    templatesCollection: 'email_templates'
  },
  // Infos mosquée pour les emails
  mosquee: {
    nom: 'Mosquée El Mouhssinine',
    adresse: '123 Rue de la Mosquée, 01000 Bourg-en-Bresse',
    telephone: '04 74 XX XX XX',
    email: 'contact@el-mouhssinine.fr',
    siteWeb: 'https://el-mouhssinine.fr',
    siret: 'XXX XXX XXX XXXXX' // Pour les reçus fiscaux
  }
}

// ==================== TYPES DE DONNÉES ====================

/**
 * @typedef {Object} DonorInfo
 * @property {string} nom
 * @property {string} prenom
 * @property {string} email
 * @property {string} [adresse]
 * @property {string} [codePostal]
 * @property {string} [ville]
 */

/**
 * @typedef {Object} Donation
 * @property {string} id
 * @property {number} montant
 * @property {Date} date
 * @property {string} modePaiement
 * @property {string} [projetNom]
 */

/**
 * @typedef {Object} MemberData
 * @property {string} nom
 * @property {string} prenom
 * @property {string} email
 * @property {string} telephone
 * @property {Object} cotisation
 * @property {string} cotisation.type - 'mensuel' | 'trimestriel' | 'annuel'
 * @property {number} cotisation.montant
 * @property {Date} cotisation.dateDebut
 * @property {Date} cotisation.dateFin
 */

// ==================== TEMPLATES EMAIL ====================

const emailTemplates = {
  /**
   * Template pour confirmation de don
   */
  donationConfirmation: (data) => ({
    subject: `Confirmation de votre don - ${CONFIG.mosquee.nom}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a2744 0%, #2d3a52 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .header .arabic { font-size: 20px; margin-top: 10px; color: #c9a227; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
          .amount { font-size: 32px; color: #c9a227; font-weight: bold; text-align: center; margin: 20px 0; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .details table { width: 100%; border-collapse: collapse; }
          .details td { padding: 10px 0; border-bottom: 1px solid #eee; }
          .details td:first-child { color: #666; }
          .details td:last-child { text-align: right; font-weight: 500; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .hadith { background: #f0e6c8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; font-style: italic; }
          .hadith .arabic { font-size: 18px; color: #1a2744; margin-bottom: 10px; }
          .btn { display: inline-block; background: #c9a227; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${CONFIG.mosquee.nom}</h1>
            <div class="arabic">بارك الله فيك</div>
          </div>
          <div class="content">
            <h2>Merci pour votre générosité !</h2>
            <p>Assalamu alaykum,</p>
            <p>Nous avons bien reçu votre don et nous vous en remercions sincèrement.</p>

            <div class="amount">${data.amount.toFixed(2)} €</div>

            <div class="details">
              <table>
                <tr>
                  <td>Date du don</td>
                  <td>${new Date(data.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                <tr>
                  <td>Mode de paiement</td>
                  <td>${data.paymentMethod || 'Carte bancaire'}</td>
                </tr>
                ${data.projectName ? `
                <tr>
                  <td>Projet soutenu</td>
                  <td>${data.projectName}</td>
                </tr>
                ` : ''}
                <tr>
                  <td>Référence</td>
                  <td>#${data.reference || 'DON-' + Date.now()}</td>
                </tr>
              </table>
            </div>

            <div class="hadith">
              <div class="arabic">مَثَلُ الَّذِينَ يُنْفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ كَمَثَلِ حَبَّةٍ أَنْبَتَتْ سَبْعَ سَنَابِلَ</div>
              <p>"Ceux qui dépensent leurs biens dans le sentier d'Allah ressemblent à un grain qui produit sept épis..."</p>
              <small>Sourate Al-Baqara, verset 261</small>
            </div>

            <p>Un reçu fiscal vous sera envoyé en début d'année prochaine.</p>
            <p>Qu'Allah accepte votre sadaqa et vous récompense au centuple.</p>
          </div>
          <div class="footer">
            <p>${CONFIG.mosquee.nom}</p>
            <p>${CONFIG.mosquee.adresse}</p>
            <p>${CONFIG.mosquee.telephone} | ${CONFIG.mosquee.email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${CONFIG.mosquee.nom}

      Merci pour votre générosité !

      Assalamu alaykum,

      Nous avons bien reçu votre don de ${data.amount.toFixed(2)} €.

      Date: ${new Date(data.date).toLocaleDateString('fr-FR')}
      Référence: #${data.reference || 'DON-' + Date.now()}

      Un reçu fiscal vous sera envoyé en début d'année prochaine.

      Qu'Allah accepte votre sadaqa et vous récompense au centuple.

      ${CONFIG.mosquee.nom}
      ${CONFIG.mosquee.adresse}
      ${CONFIG.mosquee.telephone}
    `
  }),

  /**
   * Template pour confirmation d'adhésion
   */
  membershipConfirmation: (data) => ({
    subject: `Bienvenue parmi nous - ${CONFIG.mosquee.nom}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a2744 0%, #2d3a52 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .header .arabic { font-size: 20px; margin-top: 10px; color: #c9a227; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
          .welcome-badge { background: #27ae60; color: white; padding: 15px 25px; border-radius: 50px; display: inline-block; font-weight: bold; margin: 20px 0; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .details table { width: 100%; border-collapse: collapse; }
          .details td { padding: 10px 0; border-bottom: 1px solid #eee; }
          .details td:first-child { color: #666; }
          .details td:last-child { text-align: right; font-weight: 500; }
          .benefits { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .benefits ul { margin: 0; padding-left: 20px; }
          .benefits li { margin: 8px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${CONFIG.mosquee.nom}</h1>
            <div class="arabic">مرحبا بك في مسجدنا</div>
          </div>
          <div class="content">
            <h2>Bienvenue ${data.prenom} !</h2>
            <p>Assalamu alaykum,</p>

            <p style="text-align: center;">
              <span class="welcome-badge">Adhésion confirmée</span>
            </p>

            <p>Nous sommes heureux de vous compter parmi les membres de notre communauté.</p>

            <div class="details">
              <table>
                <tr>
                  <td>Membre</td>
                  <td>${data.prenom} ${data.nom}</td>
                </tr>
                <tr>
                  <td>Type de cotisation</td>
                  <td>${data.cotisation.type.charAt(0).toUpperCase() + data.cotisation.type.slice(1)}</td>
                </tr>
                <tr>
                  <td>Montant</td>
                  <td>${data.cotisation.montant} €</td>
                </tr>
                <tr>
                  <td>Période de validité</td>
                  <td>${new Date(data.cotisation.dateDebut).toLocaleDateString('fr-FR')} - ${new Date(data.cotisation.dateFin).toLocaleDateString('fr-FR')}</td>
                </tr>
              </table>
            </div>

            <div class="benefits">
              <h3>Vos avantages membre :</h3>
              <ul>
                <li>Accès prioritaire aux événements de la mosquée</li>
                <li>Réductions sur les cours et formations</li>
                <li>Newsletter exclusive avec les actualités</li>
                <li>Participation aux assemblées générales</li>
                <li>Reçu fiscal pour votre cotisation</li>
              </ul>
            </div>

            <p>N'hésitez pas à nous contacter pour toute question.</p>
            <p>Qu'Allah bénisse votre engagement envers notre communauté.</p>
          </div>
          <div class="footer">
            <p>${CONFIG.mosquee.nom}</p>
            <p>${CONFIG.mosquee.adresse}</p>
            <p>${CONFIG.mosquee.telephone} | ${CONFIG.mosquee.email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ${CONFIG.mosquee.nom}

      Bienvenue ${data.prenom} !

      Assalamu alaykum,

      Nous sommes heureux de vous compter parmi les membres de notre communauté.

      Votre adhésion:
      - Type: ${data.cotisation.type}
      - Montant: ${data.cotisation.montant} €
      - Validité: ${new Date(data.cotisation.dateDebut).toLocaleDateString('fr-FR')} - ${new Date(data.cotisation.dateFin).toLocaleDateString('fr-FR')}

      Vos avantages:
      - Accès prioritaire aux événements
      - Réductions sur les cours
      - Newsletter exclusive
      - Participation aux AG
      - Reçu fiscal

      ${CONFIG.mosquee.nom}
      ${CONFIG.mosquee.telephone}
    `
  }),

  /**
   * Template pour le reçu fiscal annuel
   */
  fiscalReceipt: (data) => ({
    subject: `Votre reçu fiscal ${data.year} - ${CONFIG.mosquee.nom}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a2744; color: white; padding: 30px; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
          .important { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .total { font-size: 28px; color: #c9a227; font-weight: bold; text-align: center; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #c9a227; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reçu Fiscal ${data.year}</h1>
          </div>
          <div class="content">
            <p>Assalamu alaykum ${data.donor.prenom},</p>

            <p>Veuillez trouver ci-joint votre reçu fiscal pour l'année ${data.year}.</p>

            <div class="total">
              Total des dons: ${data.totalAmount.toFixed(2)} €
            </div>

            <p><strong>Nombre de dons:</strong> ${data.donations.length}</p>

            <div class="important">
              <strong>Information importante:</strong><br>
              Ce reçu vous permet de bénéficier d'une réduction d'impôt de 66% du montant versé,
              dans la limite de 20% de votre revenu imposable.
            </div>

            <p style="text-align: center;">
              <a href="${data.pdfUrl || '#'}" class="btn">Télécharger le reçu PDF</a>
            </p>

            <p>Merci pour votre générosité tout au long de l'année.</p>
            <p>Qu'Allah vous récompense.</p>
          </div>
          <div class="footer">
            <p>${CONFIG.mosquee.nom} - SIRET: ${CONFIG.mosquee.siret}</p>
            <p>${CONFIG.mosquee.adresse}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Reçu Fiscal ${data.year}

      Assalamu alaykum ${data.donor.prenom},

      Votre reçu fiscal pour l'année ${data.year} est disponible.

      Total des dons: ${data.totalAmount.toFixed(2)} €
      Nombre de dons: ${data.donations.length}

      Ce reçu vous permet de bénéficier d'une réduction d'impôt de 66%.

      ${CONFIG.mosquee.nom}
      SIRET: ${CONFIG.mosquee.siret}
    `
  })
}

// ==================== FONCTIONS D'ENVOI ====================

/**
 * Envoie un email via le provider configuré
 * @param {string} to - Adresse email du destinataire
 * @param {Object} emailData - Données de l'email (subject, html, text)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendEmail = async (to, emailData) => {
  if (isDemoMode) {
    console.log('📧 [DEMO] Email envoyé à:', to)
    console.log('📧 [DEMO] Sujet:', emailData.subject)
    return { success: true, messageId: 'demo-' + Date.now() }
  }

  if (EMAIL_PROVIDER === 'none') {
    console.warn('⚠️ Aucun provider email configuré. Voir EMAIL_SETUP.md')
    // Log l'email qui aurait été envoyé pour debug
    console.log('📧 Email non envoyé (provider=none):', { to, subject: emailData.subject })
    return { success: false, error: 'Email provider not configured' }
  }

  try {
    switch (EMAIL_PROVIDER) {
      case 'firebase-extension':
        return await sendViaFirebaseExtension(to, emailData)

      case 'resend':
        return await sendViaResend(to, emailData)

      case 'sendgrid':
        return await sendViaSendGrid(to, emailData)

      default:
        throw new Error(`Provider inconnu: ${EMAIL_PROVIDER}`)
    }
  } catch (error) {
    console.error('❌ Erreur envoi email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Envoi via Firebase Extension "Trigger Email from Firestore"
 * Ajoute un document dans la collection 'mail' qui déclenche l'envoi
 */
const sendViaFirebaseExtension = async (to, emailData) => {
  const mailRef = collection(db, CONFIG.firebase.mailCollection)
  const docRef = await addDoc(mailRef, {
    to,
    message: {
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    },
    createdAt: serverTimestamp()
  })
  return { success: true, messageId: docRef.id }
}

/**
 * Envoi via Resend API
 * Documentation: https://resend.com/docs
 */
const sendViaResend = async (to, emailData) => {
  // TODO: Implémenter l'appel API Resend
  // Note: Nécessite une Cloud Function ou un backend pour ne pas exposer l'API key

  /*
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.resend.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${CONFIG.resend.fromName} <${CONFIG.resend.fromEmail}>`,
      to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    })
  })
  const data = await response.json()
  return { success: true, messageId: data.id }
  */

  console.warn('⚠️ Resend API non implémenté - voir EMAIL_SETUP.md')
  return { success: false, error: 'Resend not implemented' }
}

/**
 * Envoi via SendGrid API
 * Documentation: https://docs.sendgrid.com/
 */
const sendViaSendGrid = async (to, emailData) => {
  // TODO: Implémenter l'appel API SendGrid
  // Note: Nécessite une Cloud Function ou un backend pour ne pas exposer l'API key

  console.warn('⚠️ SendGrid API non implémenté - voir EMAIL_SETUP.md')
  return { success: false, error: 'SendGrid not implemented' }
}

// ==================== API PUBLIQUE ====================

/**
 * Envoie une confirmation de don
 * @param {string} email - Email du donateur
 * @param {number} amount - Montant du don
 * @param {Date} date - Date du don
 * @param {Object} options - Options supplémentaires
 * @param {string} [options.projectName] - Nom du projet soutenu
 * @param {string} [options.paymentMethod] - Mode de paiement
 * @param {string} [options.reference] - Référence du don
 */
export const sendDonationConfirmation = async (email, amount, date, options = {}) => {
  const templateData = {
    amount,
    date,
    projectName: options.projectName,
    paymentMethod: options.paymentMethod,
    reference: options.reference
  }

  const emailContent = emailTemplates.donationConfirmation(templateData)
  const result = await sendEmail(email, emailContent)

  // Log dans Firestore pour suivi
  if (!isDemoMode && db) {
    try {
      await addDoc(collection(db, 'email_logs'), {
        type: 'donation_confirmation',
        to: email,
        amount,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        createdAt: serverTimestamp()
      })
    } catch (e) {
      console.warn('Impossible de logger l\'email:', e)
    }
  }

  return result
}

/**
 * Envoie une confirmation d'adhésion
 * @param {string} email - Email du membre
 * @param {MemberData} memberData - Données du membre
 */
export const sendMembershipConfirmation = async (email, memberData) => {
  const emailContent = emailTemplates.membershipConfirmation(memberData)
  const result = await sendEmail(email, emailContent)

  // Log dans Firestore pour suivi
  if (!isDemoMode && db) {
    try {
      await addDoc(collection(db, 'email_logs'), {
        type: 'membership_confirmation',
        to: email,
        memberName: `${memberData.prenom} ${memberData.nom}`,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        createdAt: serverTimestamp()
      })
    } catch (e) {
      console.warn('Impossible de logger l\'email:', e)
    }
  }

  return result
}

/**
 * Génère les données pour un reçu fiscal (PDF à générer côté serveur)
 * @param {DonorInfo} donorInfo - Informations du donateur
 * @param {Donation[]} donations - Liste des dons de l'année
 * @returns {Object} Données formatées pour génération PDF
 */
export const generateFiscalReceiptData = (donorInfo, donations) => {
  const year = new Date().getFullYear() - 1 // Année précédente
  const totalAmount = donations.reduce((sum, d) => sum + d.montant, 0)

  return {
    // Informations association
    association: {
      nom: CONFIG.mosquee.nom,
      adresse: CONFIG.mosquee.adresse,
      siret: CONFIG.mosquee.siret,
      objetAssociation: 'Gestion d\'un lieu de culte musulman et activités culturelles'
    },

    // Informations donateur
    donateur: {
      nom: donorInfo.nom,
      prenom: donorInfo.prenom,
      adresse: donorInfo.adresse || '',
      codePostal: donorInfo.codePostal || '',
      ville: donorInfo.ville || ''
    },

    // Récapitulatif des dons
    annee: year,
    totalDons: totalAmount,
    nombreDons: donations.length,

    // Détail des dons
    dons: donations.map(d => ({
      date: new Date(d.date).toLocaleDateString('fr-FR'),
      montant: d.montant,
      modePaiement: d.modePaiement,
      projet: d.projetNom || 'Don général'
    })),

    // Mentions légales
    mentionsLegales: {
      articleCGI: 'Article 200 du Code Général des Impôts',
      tauxReduction: '66%',
      plafond: '20% du revenu imposable',
      dateEmission: new Date().toLocaleDateString('fr-FR'),
      numeroOrdre: `RF-${year}-${Date.now().toString(36).toUpperCase()}`
    },

    // Pour l'email
    email: donorInfo.email
  }
}

/**
 * Envoie le reçu fiscal par email
 * @param {DonorInfo} donorInfo - Informations du donateur
 * @param {Donation[]} donations - Liste des dons
 * @param {string} [pdfUrl] - URL du PDF généré (optionnel)
 */
export const sendFiscalReceipt = async (donorInfo, donations, pdfUrl = null) => {
  const receiptData = generateFiscalReceiptData(donorInfo, donations)

  const emailContent = emailTemplates.fiscalReceipt({
    year: receiptData.annee,
    donor: donorInfo,
    totalAmount: receiptData.totalDons,
    donations: donations,
    pdfUrl
  })

  const result = await sendEmail(donorInfo.email, emailContent)

  // Log dans Firestore
  if (!isDemoMode && db) {
    try {
      await addDoc(collection(db, 'email_logs'), {
        type: 'fiscal_receipt',
        to: donorInfo.email,
        year: receiptData.annee,
        totalAmount: receiptData.totalDons,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        createdAt: serverTimestamp()
      })
    } catch (e) {
      console.warn('Impossible de logger l\'email:', e)
    }
  }

  return result
}

// ==================== UTILITAIRES ====================

/**
 * Vérifie si le service email est correctement configuré
 */
export const isEmailServiceConfigured = () => {
  return EMAIL_PROVIDER !== 'none'
}

/**
 * Retourne la configuration actuelle (sans les clés API)
 */
export const getEmailServiceStatus = () => ({
  provider: EMAIL_PROVIDER,
  configured: EMAIL_PROVIDER !== 'none',
  demoMode: isDemoMode,
  fromEmail: CONFIG[EMAIL_PROVIDER]?.fromEmail || CONFIG.mosquee.email
})

export default {
  sendDonationConfirmation,
  sendMembershipConfirmation,
  generateFiscalReceiptData,
  sendFiscalReceipt,
  isEmailServiceConfigured,
  getEmailServiceStatus
}
