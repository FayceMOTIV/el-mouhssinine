# Configuration du Service Email - El Mouhssinine

Ce guide explique comment configurer l'envoi d'emails automatiques pour le backoffice.

## Options disponibles

| Provider | Difficulte | Cout | Avantages | Inconvenients |
|----------|------------|------|-----------|---------------|
| **Firebase Extension** | Facile | ~$0.001/email | Integration native, pas de backend | Necessite Blaze plan |
| **Resend** | Moyen | 3000 emails/mois gratuits | API moderne, simple | Necessite Cloud Function |
| **SendGrid** | Moyen | 100 emails/jour gratuits | Tres complet, analytics | Plus complexe |

---

## Option 1 : Firebase Extension (Recommande)

### Etape 1 : Activer le plan Blaze
1. Aller sur [Firebase Console](https://console.firebase.google.com)
2. Projet `el-mouhssinine` > Upgrade > Blaze (Pay as you go)
3. Configurer un budget alert a 5€/mois

### Etape 2 : Installer l'extension
1. Extensions > Browse Extensions
2. Chercher **"Trigger Email from Firestore"**
3. Installer avec ces parametres :

```
SMTP_CONNECTION_URI: smtps://user:password@smtp.gmail.com:465
EMAIL_COLLECTION: mail
DEFAULT_FROM: noreply@el-mouhssinine.fr
```

### Etape 3 : Configurer SMTP Gmail
1. Creer un compte Gmail dedie (ex: `noreply.elmouhssinine@gmail.com`)
2. Activer la verification 2 facteurs
3. Generer un mot de passe d'application :
   - Compte Google > Securite > Mots de passe des applications
   - Creer un mot de passe pour "Autre (nom personnalise)"
4. Utiliser ce mot de passe dans `SMTP_CONNECTION_URI`

### Etape 4 : Activer dans le code
```javascript
// src/services/emailService.js
const EMAIL_PROVIDER = 'firebase-extension'
```

### Test
```javascript
import { sendDonationConfirmation } from './services/emailService'

// Test d'envoi
await sendDonationConfirmation(
  'test@example.com',
  50,
  new Date(),
  { projectName: 'Test' }
)
```

---

## Option 2 : Resend API

### Etape 1 : Creer un compte Resend
1. Aller sur [resend.com](https://resend.com)
2. S'inscrire (3000 emails/mois gratuits)
3. Copier la cle API

### Etape 2 : Verifier le domaine
1. Domains > Add Domain
2. Ajouter `el-mouhssinine.fr`
3. Configurer les enregistrements DNS :
   - DKIM
   - SPF
   - DMARC (optionnel mais recommande)

### Etape 3 : Creer une Cloud Function
```javascript
// functions/index.js
const functions = require('firebase-functions')
const { Resend } = require('resend')

const resend = new Resend(functions.config().resend.api_key)

exports.sendEmail = functions.firestore
  .document('mail/{docId}')
  .onCreate(async (snap) => {
    const { to, message } = snap.data()

    await resend.emails.send({
      from: 'Mosquee El Mouhssinine <noreply@el-mouhssinine.fr>',
      to,
      subject: message.subject,
      html: message.html,
      text: message.text
    })

    await snap.ref.update({ status: 'sent', sentAt: new Date() })
  })
```

### Etape 4 : Deployer
```bash
firebase functions:config:set resend.api_key="re_xxxxxxxx"
firebase deploy --only functions
```

---

## Option 3 : SendGrid

### Etape 1 : Creer un compte SendGrid
1. Aller sur [sendgrid.com](https://sendgrid.com)
2. S'inscrire (100 emails/jour gratuits)
3. Verifier l'email de l'expediteur

### Etape 2 : Generer une API Key
1. Settings > API Keys
2. Create API Key > Full Access
3. Copier la cle

### Etape 3 : Creer une Cloud Function
```javascript
// functions/index.js
const functions = require('firebase-functions')
const sgMail = require('@sendgrid/mail')

sgMail.setApiKey(functions.config().sendgrid.api_key)

exports.sendEmail = functions.firestore
  .document('mail/{docId}')
  .onCreate(async (snap) => {
    const { to, message } = snap.data()

    await sgMail.send({
      from: {
        email: 'noreply@el-mouhssinine.fr',
        name: 'Mosquee El Mouhssinine'
      },
      to,
      subject: message.subject,
      html: message.html,
      text: message.text
    })

    await snap.ref.update({ status: 'sent', sentAt: new Date() })
  })
```

---

## Structure Firestore

### Collection `mail` (pour Firebase Extension)
```javascript
{
  to: "donateur@email.com",
  message: {
    subject: "Confirmation de votre don",
    html: "<html>...</html>",
    text: "Version texte..."
  },
  createdAt: Timestamp,
  // Ajoute par l'extension apres envoi :
  delivery: {
    state: "SUCCESS",
    endTime: Timestamp,
    attempts: 1
  }
}
```

### Collection `email_logs` (suivi des envois)
```javascript
{
  type: "donation_confirmation",
  to: "donateur@email.com",
  success: true,
  messageId: "abc123",
  createdAt: Timestamp
}
```

---

## Recus Fiscaux (PDF)

Pour generer les recus fiscaux en PDF, plusieurs options :

### Option A : jsPDF (cote client)
```bash
npm install jspdf
```

```javascript
import { jsPDF } from 'jspdf'
import { generateFiscalReceiptData } from './services/emailService'

const generatePDF = (donorInfo, donations) => {
  const data = generateFiscalReceiptData(donorInfo, donations)
  const doc = new jsPDF()

  doc.setFontSize(20)
  doc.text(data.association.nom, 20, 20)
  // ... ajouter le contenu

  return doc.output('blob')
}
```

### Option B : Cloud Function avec Puppeteer
Plus propre pour les documents officiels, mais plus complexe a deployer.

### Option C : Service tiers (recommande)
- [DocRaptor](https://docraptor.com) - API HTML vers PDF
- [PDF.co](https://pdf.co) - Generation PDF
- [Anvil](https://www.useanvil.com) - Templates PDF

---

## Variables d'environnement

Ajouter au fichier `.env.local` :

```env
# Resend
VITE_RESEND_API_KEY=re_xxxxxxxx

# SendGrid
VITE_SENDGRID_API_KEY=SG.xxxxxxxx

# Email expediteur
VITE_EMAIL_FROM=noreply@el-mouhssinine.fr
```

**IMPORTANT** : Ne jamais commiter les cles API ! Utiliser les Cloud Functions pour les appels API securises.

---

## Checklist de mise en production

- [ ] Choisir un provider (Firebase Extension recommande)
- [ ] Configurer le SMTP ou l'API
- [ ] Verifier le domaine expediteur
- [ ] Tester l'envoi sur une adresse de test
- [ ] Activer dans `emailService.js` : `EMAIL_PROVIDER = 'firebase-extension'`
- [ ] Configurer les templates (personnaliser les textes)
- [ ] Mettre a jour les informations de la mosquee dans `CONFIG.mosquee`
- [ ] Tester les 3 types d'emails :
  - [ ] Confirmation de don
  - [ ] Confirmation d'adhesion
  - [ ] Recu fiscal

---

## Support

En cas de probleme :
1. Verifier les logs Firebase : Console > Functions > Logs
2. Verifier la collection `email_logs` dans Firestore
3. Tester avec un email personnel avant production
