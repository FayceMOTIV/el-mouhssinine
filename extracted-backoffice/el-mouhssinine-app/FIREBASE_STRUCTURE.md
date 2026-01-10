# Structure Firebase pour El Mouhssinine

## Collections Firestore

### 1. `prayerTimes`
Document ID: date (YYYY-MM-DD)
```javascript
{
  prayers: [
    { name: "Fajr", time: "06:45", icon: "🌅" },
    { name: "Dhuhr", time: "13:15", icon: "☀️" },
    { name: "Asr", time: "15:45", icon: "🌤️" },
    { name: "Maghrib", time: "18:02", icon: "🌅" },
    { name: "Isha", time: "19:30", icon: "🌙" }
  ],
  jumua: "13:30",
  updatedAt: Timestamp
}
```

### 2. `announcements`
```javascript
{
  title: "Titre de l'annonce",
  content: "Contenu de l'annonce...",
  publishedAt: Timestamp,
  isActive: true
}
```

### 3. `events`
```javascript
{
  title: "Conférence Islam",
  description: "Description...",
  date: Timestamp,
  time: "15:00",
  location: "Salle principale",
  requiresRegistration: false,
  createdAt: Timestamp
}
```

### 4. `janaza`
```javascript
{
  deceasedName: "Nom du défunt",
  deceasedNameAr: "رحمه الله",
  prayerTime: "13:30",
  prayerDate: Timestamp,
  location: "Salle principale",
  message: "Que Allah lui accorde Sa miséricorde...",
  isActive: true,
  createdAt: Timestamp
}
```

### 5. `projects`
```javascript
{
  name: "Rénovation Salle de Prière",
  description: "Travaux de rénovation...",
  goal: 15000,
  raised: 8500,
  icon: "🕌",
  isExternal: false,
  lieu: null,  // Pour projets externes: "Gaza, Palestine"
  iban: null,  // Pour projets externes
  isActive: true,
  createdAt: Timestamp
}
```

### 6. `donations`
```javascript
{
  memberId: "user_id" | null,
  memberEmail: "email@example.com",
  amount: 50,
  projectId: "project_id",
  projectName: "Rénovation Salle",
  paymentMethod: "card" | "apple_pay" | "sepa" | "virement",
  status: "pending" | "completed" | "failed",
  stripePaymentId: "pi_xxx",
  createdAt: Timestamp
}
```

### 7. `members`
```javascript
{
  name: "Faïcal Kriouar",
  email: "faical@example.com",
  phone: "06 XX XX XX XX",
  memberId: "ELM-2024-0042",
  cotisationType: "mensuel" | "annuel" | null,
  cotisationStatus: "active" | "expired" | "none",
  nextPaymentDate: Timestamp | null,
  stripeCustomerId: "cus_xxx",
  stripeSubscriptionId: "sub_xxx",
  createdAt: Timestamp
}
```

### 8. `notifications`
```javascript
{
  title: "Rappel Jumu'a",
  body: "N'oubliez pas la prière du vendredi",
  type: "all" | "members" | "active",
  sentAt: Timestamp,
  status: "sent" | "failed"
}
```

### 9. `settings/mosqueeInfo`
```javascript
{
  name: "Mosquée El Mouhssinine",
  address: "123 Rue de la Mosquée",
  city: "Bourg-en-Bresse",
  postalCode: "01000",
  phone: "04 74 XX XX XX",
  email: "contact@elmouhssinine.fr",
  website: "el-mouhssinine.web.app",
  iban: "FR76 1234 5678 9012 3456 7890 123",
  bic: "AGRIFRPP",
  bankName: "Crédit Agricole",
  accountHolder: "Association El Mouhssinine"
}
```

### 10. `settings/islamicCalendar`
```javascript
{
  todayHijri: {
    day: "9",
    month: "Rajab",
    year: "1447"
  },
  upcomingEvents: [
    { name: "Ramadan", date: "1er Ramadan 1447", gregorian: "28 Février 2026", daysLeft: 50, icon: "🌙" },
    { name: "Aïd al-Fitr", date: "1er Chawwal 1447", gregorian: "30 Mars 2026", daysLeft: 80, icon: "🎉" }
  ]
}
```

### 11. `sourates`
Document ID: numéro (1-114)
```javascript
{
  name: "Al-Fatiha",
  nameAr: "الفاتحة",
  verses: 7,
  type: "Mecquoise",
  audio: "url_to_audio"
}
```

### 12. `duas`
```javascript
{
  name: "Adhkar du matin",
  nameAr: "أذكار الصباح",
  icon: "🌅",
  count: 12,
  invocations: [
    {
      arabic: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ",
      translation: "Nous voilà au matin et le royaume appartient à Allah",
      repetitions: 1
    }
  ]
}
```

---

## Règles de sécurité Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Horaires de prière - lecture publique
    match /prayerTimes/{date} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Annonces - lecture publique
    match /announcements/{id} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Événements - lecture publique
    match /events/{id} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Janaza - lecture publique
    match /janaza/{id} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Projets - lecture publique
    match /projects/{id} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Dons - créer pour tous, lecture/modif pour admin
    match /donations/{id} {
      allow create: if true;
      allow read, update, delete: if request.auth != null && isAdmin();
    }
    
    // Membres - lecture/écriture pour le membre ou admin
    match /members/{memberId} {
      allow read: if request.auth != null && (request.auth.uid == memberId || isAdmin());
      allow write: if request.auth != null && (request.auth.uid == memberId || isAdmin());
    }
    
    // Notifications - admin seulement
    match /notifications/{id} {
      allow read, write: if request.auth != null && isAdmin();
    }
    
    // Paramètres - lecture publique, écriture admin
    match /settings/{doc} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Sourates & Duas - lecture publique
    match /sourates/{id} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    match /duas/{id} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Fonction helper pour vérifier admin
    function isAdmin() {
      return get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

---

## Index Firestore requis

```
Collection: announcements
  - isActive ASC, publishedAt DESC

Collection: events
  - date ASC

Collection: janaza
  - isActive ASC, prayerDate ASC

Collection: projects
  - isActive ASC, isExternal ASC

Collection: donations
  - createdAt DESC

Collection: members
  - createdAt DESC
  - cotisationStatus ASC

Collection: notifications
  - sentAt DESC
```

---

## Cloud Functions recommandées

### 1. Mise à jour automatique horaires de prière
```javascript
// Calcul quotidien des horaires via API Aladhan
exports.updatePrayerTimes = functions.pubsub.schedule('0 0 * * *').onRun(async () => {
  const response = await fetch('http://api.aladhan.com/v1/timingsByCity?city=Bourg-en-Bresse&country=France&method=2');
  const data = await response.json();
  // Sauvegarder dans Firestore
});
```

### 2. Webhook Stripe
```javascript
// Traitement des paiements
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Mettre à jour le don
      break;
    case 'invoice.paid':
      // Mettre à jour l'adhérent
      break;
    case 'customer.subscription.deleted':
      // Marquer adhérent comme expiré
      break;
  }
});
```

### 3. Envoi notifications push
```javascript
// Envoyer notification à tous
exports.sendNotification = functions.firestore
  .document('notifications/{id}')
  .onCreate(async (snap, context) => {
    const notif = snap.data();
    const message = {
      notification: { title: notif.title, body: notif.body },
      topic: notif.type // 'all', 'members', 'active'
    };
    await admin.messaging().send(message);
  });
```

### 4. Rappel prière automatique
```javascript
// Notification avant chaque prière
exports.prayerReminder = functions.pubsub.schedule('*/5 * * * *').onRun(async () => {
  // Vérifier si une prière approche dans les 10 minutes
  // Envoyer notification aux utilisateurs ayant activé les rappels
});
```
