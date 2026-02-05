import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage'
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator
} from 'firebase/functions'

// Configuration Firebase - préfère les variables d'environnement si disponibles
// Note: Les credentials Firebase web sont publiques par design (protection via Firestore Rules)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCJr6tGI9QpbWr3pf1GpYoEnvsGgkJj8j8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "el-mouhssinine.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "el-mouhssinine",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "el-mouhssinine.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "658931173250",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:658931173250:web:c5a7e8f2d3b4a192837465"
}

// Avertissement en dev si variables d'environnement non configurées
if (import.meta.env.DEV && !import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn('[Firebase] Variables d\'environnement non configurées - utilisation des valeurs par défaut')
}

// Force demo mode for development (set to true to use mock data)
const FORCE_DEMO_MODE = false

// Demo mode flag
export let isDemoMode = FORCE_DEMO_MODE
let app = null
let db = null
let auth = null
let storage = null
let functions = null

if (!FORCE_DEMO_MODE) {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    auth = getAuth(app)
    storage = getStorage(app)
    functions = getFunctions(app, 'europe-west1')
  } catch (err) {
    console.error('[Firebase] Échec initialisation:', err)
    // En production, afficher une erreur fatale au lieu de passer en mode démo silencieusement
    if (import.meta.env.PROD) {
      // Afficher une alerte à l'utilisateur
      alert('⚠️ Impossible de se connecter à Firebase. Vérifiez votre connexion et rechargez la page.')
      throw new Error('Impossible de se connecter à Firebase. Contactez le support.')
    }
    // En dev, accepter le mode démo
    isDemoMode = true
    console.warn('[Firebase] Mode démo activé (erreur Firebase en dev)')
  }
}

export { app, db, auth, storage, functions }

// ==================== MOCK DATA FOR DEMO MODE ====================
const mockData = {
  announcements: [
    { id: '1', titre: 'Bienvenue', contenu: 'Bienvenue sur le backoffice El Mouhssinine', actif: true, createdAt: new Date() },
    { id: '2', titre: 'Horaires Ramadan', contenu: 'Les horaires de Ramadan sont disponibles', actif: true, createdAt: new Date() }
  ],
  popups: [
    { id: '1', titre: 'Collecte Zakat', message: 'N\'oubliez pas la Zakat al-Fitr', priorite: 'haute', cible: 'tous', actif: true, createdAt: new Date() }
  ],
  events: [
    { id: '1', titre: 'Conférence Ramadan', description: 'Conférence sur les bienfaits du jeûne', date: new Date(Date.now() + 7*24*60*60*1000), heure: '20:00', lieu: 'Salle principale', actif: true }
  ],
  janaza: [
    {
      id: '1',
      nomDefunt: 'Ahmed BENALI',
      genre: 'homme',
      age: 75,
      date: new Date(Date.now() + 2*24*60*60*1000),
      heurePriere: '',
      salatApres: 'apres_dhuhr',
      lieu: 'Mosquée El Mouhssinine',
      phraseAr: 'إنا لله وإنا إليه راجعون',
      phraseFr: 'Nous appartenons à Allah et c\'est vers Lui que nous retournerons',
      actif: true,
      createdAt: new Date()
    },
    {
      id: '2',
      nomDefunt: 'Fatima SAID',
      genre: 'femme',
      age: 68,
      date: new Date(Date.now() + 3*24*60*60*1000),
      heurePriere: '14:30',
      salatApres: 'apres_asr',
      lieu: 'Mosquée El Mouhssinine',
      phraseAr: 'إنا لله وإنا إليه راجعون',
      phraseFr: 'Nous appartenons à Allah et c\'est vers Lui que nous retournerons',
      actif: true,
      createdAt: new Date()
    }
  ],
  projects: [
    { id: '1', titre: 'Rénovation mosquée', description: 'Travaux de rénovation', objectif: 50000, montantActuel: 35000, categorie: 'interne', actif: true, fichiers: [], createdAt: new Date() }
  ],
  donations: [
    { id: '1', donateur: 'Anonyme', montant: 100, projetId: '1', modePaiement: 'carte', date: new Date() },
    { id: '2', donateur: 'Mohamed', montant: 250, projetId: '1', modePaiement: 'virement', date: new Date() }
  ],
  members: [
    { id: '1', nom: 'Ben Ali', prenom: 'Mohamed', email: 'mohamed@test.com', telephone: '0612345678', cotisation: { type: 'annuel', montant: 100, dateDebut: new Date(), dateFin: new Date(Date.now() + 365*24*60*60*1000) }, actif: true, createdAt: new Date() }
  ],
  admins: [
    { id: 'demo-admin', nom: 'Admin Demo', email: 'admin@demo.local', role: 'super_admin', permissions: {}, actif: true, createdAt: new Date() }
  ],
  notifications: [
    { id: '1', titre: 'Test notification', message: 'Ceci est une notification test', topic: 'tous', statut: 'envoyee', dateProgrammee: new Date(), createdAt: new Date() }
  ],
  settings: {
    prayerTimes: { times: { fajr: '05:30', dhuhr: '13:15', asr: '16:45', maghrib: '20:30', isha: '22:00' }, iqama: { fajr: '05:45', dhuhr: '13:30', asr: '17:00', maghrib: '20:35', isha: '22:15' }, jumua: { jumua1: '13:00', jumua2: '14:00' } },
    general: { notifications: { prayerReminders: true, eventReminders: true }, display: { showIqama: true, darkMode: true } },
    mosqueeInfo: { nom: 'Mosquée El Mouhssinine', ville: 'Pantin', telephone: '01 23 45 67 89' }
  }
}

// ==================== AUTH ====================
export const loginUser = async (email, password) => {
  if (isDemoMode) {
    return { user: { uid: 'demo-user', email } }
  }
  return signInWithEmailAndPassword(auth, email, password)
}

export const logoutUser = async () => {
  if (isDemoMode) return
  return signOut(auth)
}

export const onAuthChange = (callback) => {
  if (isDemoMode) {
    // In demo mode, immediately call callback with null (not logged in)
    setTimeout(() => callback(null), 100)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}

// ==================== GENERIC CRUD ====================
export const getCollection = async (collectionName, constraints = []) => {
  if (isDemoMode) {
    return mockData[collectionName] || []
  }
  const q = query(collection(db, collectionName), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getDocument = async (collectionName, docId) => {
  if (isDemoMode) {
    if (collectionName === 'settings') {
      return mockData.settings[docId] || null
    }
    const items = mockData[collectionName] || []
    return items.find(item => item.id === docId) || null
  }
  const docRef = doc(db, collectionName, docId)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
}

export const addDocument = async (collectionName, data) => {
  if (isDemoMode) {
    const newId = `demo-${Date.now()}`
    const newItem = { id: newId, ...data, createdAt: new Date() }
    if (!mockData[collectionName]) mockData[collectionName] = []
    mockData[collectionName].unshift(newItem)
    return newId
  }
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp()
  })
  return docRef.id
}

export const updateDocument = async (collectionName, docId, data) => {
  if (isDemoMode) {
    const items = mockData[collectionName] || []
    const index = items.findIndex(item => item.id === docId)
    if (index !== -1) {
      mockData[collectionName][index] = { ...items[index], ...data, updatedAt: new Date() }
    }
    return
  }
  const docRef = doc(db, collectionName, docId)
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export const deleteDocument = async (collectionName, docId) => {
  if (isDemoMode) {
    const items = mockData[collectionName] || []
    mockData[collectionName] = items.filter(item => item.id !== docId)
    return
  }
  const docRef = doc(db, collectionName, docId)
  await deleteDoc(docRef)
}

export const setDocument = async (collectionName, docId, data) => {
  if (isDemoMode) {
    if (collectionName === 'settings') {
      mockData.settings[docId] = { ...mockData.settings[docId], ...data, updatedAt: new Date() }
    }
    return
  }
  const docRef = doc(db, collectionName, docId)
  await setDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true })
}

// ==================== SUBSCRIPTIONS ====================
export const subscribeToCollection = (collectionName, callback, constraints = []) => {
  if (isDemoMode) {
    // In demo mode, call callback immediately with mock data
    setTimeout(() => callback(mockData[collectionName] || []), 100)
    return () => {}
  }
  const q = query(collection(db, collectionName), ...constraints)
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    callback(data)
  })
}

export const subscribeToDocument = (collectionName, docId, callback) => {
  if (isDemoMode) {
    setTimeout(() => {
      if (collectionName === 'settings') {
        callback(mockData.settings[docId] || null)
      } else {
        const items = mockData[collectionName] || []
        callback(items.find(item => item.id === docId) || null)
      }
    }, 100)
    return () => {}
  }
  const docRef = doc(db, collectionName, docId)
  return onSnapshot(docRef, (doc) => {
    callback(doc.exists() ? { id: doc.id, ...doc.data() } : null)
  })
}

// ==================== SPECIFIC QUERIES ====================

// Horaires
// Fetch prayer times from Aladhan API for Bourg-en-Bresse
// Méthode 12 + tune pour correspondre aux horaires Mawaqit El Mouhssinine
// tune: Fajr -20min, Dhuhr +2min, Asr +4min, Maghrib +8min, Isha +27min
export const getPrayerTimes = async () => {
  try {
    const response = await fetch(
      'https://api.aladhan.com/v1/timingsByCity?city=Bourg-en-Bresse&country=France&method=12&tune=0,-20,0,2,4,8,0,27,0'
    )

    if (!response.ok) throw new Error('Erreur API Aladhan')

    const data = await response.json()
    const timings = data.data.timings

    return {
      times: {
        fajr: timings.Fajr,
        sunrise: timings.Sunrise,
        dhuhr: timings.Dhuhr,
        asr: timings.Asr,
        maghrib: timings.Maghrib,
        isha: timings.Isha
      },
      date: data.data.date.readable,
      hijri: data.data.date.hijri.date
    }
  } catch (error) {
    console.error('Erreur récupération horaires:', error)
    // Fallback: essayer de récupérer depuis Firestore
    return getDocument('settings', 'prayerTimes')
  }
}
export const updatePrayerTimes = (data) => setDocument('settings', 'prayerTimes', data)

// Récupérer les horaires Iqama et Jumua depuis Firebase
export const getIqamaAndJumuaTimes = () => getDocument('settings', 'prayerTimes')

// Annonces
export const getAnnonces = () => getCollection('announcements', [orderBy('createdAt', 'desc')])
export const subscribeToAnnonces = (cb) => subscribeToCollection('announcements', cb, [orderBy('createdAt', 'desc')])

// Popups
export const getPopups = () => getCollection('popups', [orderBy('createdAt', 'desc')])
export const subscribeToPopups = (cb) => subscribeToCollection('popups', cb, [orderBy('createdAt', 'desc')])

// Evenements
export const getEvenements = () => getCollection('events', [orderBy('date', 'asc')])
export const subscribeToEvenements = (cb) => subscribeToCollection('events', cb, [orderBy('date', 'asc')])

// Janaza
export const getJanazas = () => getCollection('janaza', [orderBy('date', 'desc')])
export const subscribeToJanazas = (cb) => subscribeToCollection('janaza', cb, [orderBy('date', 'desc')])

// Projets
export const getProjets = () => getCollection('projects', [orderBy('createdAt', 'desc')])
export const subscribeToProjets = (cb) => subscribeToCollection('projects', cb, [orderBy('createdAt', 'desc')])

// Dons
export const getDons = () => getCollection('donations', [orderBy('date', 'desc')])
export const subscribeToDons = (cb) => subscribeToCollection('donations', cb, [orderBy('date', 'desc')])

// Membres
export const getMembres = () => getCollection('members', [orderBy('createdAt', 'desc')])
export const subscribeToMembres = (cb) => subscribeToCollection('members', cb, [orderBy('createdAt', 'desc')])

// ==================== PAYMENTS (Historique des paiements) ====================
// Types: 'cotisation' (membres) ou 'don' (dons/projets)

export const PaymentType = {
  COTISATION: 'cotisation',
  DON: 'don'
}

// S'abonner à tous les paiements
export const subscribeToPayments = (cb) => subscribeToCollection('payments', cb, [orderBy('createdAt', 'desc')])

// S'abonner aux paiements d'un membre spécifique
export const subscribeToMemberPayments = (membreId, cb) => {
  if (isDemoMode) {
    setTimeout(() => cb([]), 100)
    return () => {}
  }
  const q = query(
    collection(db, 'payments'),
    where('membreId', '==', membreId),
    orderBy('date', 'desc')
  )
  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    cb(payments)
  })
}

// Ajouter un paiement
export const addPayment = async (paymentData) => {
  if (isDemoMode) {
    console.log('[DEMO] Add payment:', paymentData)
    return { id: 'demo-' + Date.now() }
  }
  const docRef = await addDoc(collection(db, 'payments'), {
    ...paymentData,
    createdAt: serverTimestamp()
  })
  return { id: docRef.id }
}

// Obtenir les paiements par type (cotisation ou don)
export const getPaymentsByType = async (type) => {
  if (isDemoMode) return []
  const q = query(
    collection(db, 'payments'),
    where('type', '==', type),
    orderBy('date', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Obtenir les stats de paiements par période
export const getPaymentStats = (payments, type = null) => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  // Filtrer par type si spécifié
  let filtered = payments
  if (type) {
    filtered = payments.filter(p => p.type === type)
  }

  // Helper pour obtenir la date (supporte 'date' et 'createdAt')
  const getDate = (p) => {
    const dateField = p.date || p.createdAt
    if (!dateField) return new Date(0)
    return dateField?.toDate?.() || new Date(dateField)
  }

  // Helper pour obtenir le montant (supporte 'montant' et 'amount')
  const getAmount = (p) => p.montant || p.amount || 0

  const getTotal = (startDate) => {
    return filtered.reduce((sum, p) => {
      const pDate = getDate(p)
      if (pDate >= startDate) {
        return sum + getAmount(p)
      }
      return sum
    }, 0)
  }

  const getCount = (startDate) => {
    return filtered.filter(p => {
      const pDate = getDate(p)
      return pDate >= startDate
    }).length
  }

  return {
    today: { total: getTotal(todayStart), count: getCount(todayStart) },
    month: { total: getTotal(monthStart), count: getCount(monthStart) },
    year: { total: getTotal(yearStart), count: getCount(yearStart) },
    all: { total: filtered.reduce((sum, p) => sum + getAmount(p), 0), count: filtered.length }
  }
}

// Admins
export const getAdmins = () => getCollection('admins', [orderBy('createdAt', 'desc')])
export const subscribeToAdmins = (cb) => subscribeToCollection('admins', cb, [orderBy('createdAt', 'desc')])

// Cherche un admin par UID - d'abord par Document ID, puis par champ uid
export const getAdminByUid = async (uid) => {
  if (isDemoMode) {
    const admins = mockData.admins || []
    return admins.find(a => a.id === uid || a.uid === uid) || null
  }

  // 1. Essayer par Document ID
  const docRef = doc(db, 'admins', uid)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() }
  }

  // 2. Sinon chercher par champ uid
  const q = query(collection(db, 'admins'), where('uid', '==', uid))
  const snapshot = await getDocs(q)
  if (!snapshot.empty) {
    const adminDoc = snapshot.docs[0]
    return { id: adminDoc.id, ...adminDoc.data() }
  }

  return null
}

// Notifications
export const getNotifications = () => getCollection('notifications', [orderBy('createdAt', 'desc')])
export const subscribeToNotifications = (cb) => subscribeToCollection('notifications', cb, [orderBy('createdAt', 'desc')])

// Parametres
export const getSettings = () => getDocument('settings', 'general')
export const updateSettings = (data) => setDocument('settings', 'general', data)
export const getMosqueeInfo = () => getDocument('settings', 'mosqueeInfo')
export const updateMosqueeInfo = (data) => setDocument('settings', 'mosqueeInfo', data)

// Cotisations
export const getCotisationPrices = () => getDocument('settings', 'cotisation')
export const updateCotisationPrices = (data) => setDocument('settings', 'cotisation', data)

// Règlement intérieur
export const getReglement = () => getDocument('settings', 'reglement')
export const updateReglement = (data) => setDocument('settings', 'reglement', data)

// Rappels
export const getRappels = () => getCollection('rappels', [orderBy('createdAt', 'desc')])
export const subscribeToRappels = (cb) => subscribeToCollection('rappels', cb, [orderBy('createdAt', 'desc')])

// ==================== FILE STORAGE ====================
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

export const uploadProjetFile = async (projetId, file, uploadedBy) => {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Le fichier dépasse la taille maximale de 10MB')
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Type de fichier non autorisé. Types acceptés: PDF, PNG, JPG, DOC, DOCX')
  }

  // Generate unique filename
  const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const extension = file.name.split('.').pop()
  const storagePath = `projets/${projetId}/fichiers/${fileId}.${extension}`

  // Determine file type category
  let type = 'document'
  if (file.type === 'application/pdf') type = 'pdf'
  else if (file.type.startsWith('image/')) type = 'image'

  // Create file metadata
  const fichier = {
    id: fileId,
    nom: file.name,
    type,
    url: isDemoMode ? `https://demo.local/files/${fileId}.${extension}` : '',
    taille: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    storagePath
  }

  if (isDemoMode) {
    // In demo mode, just update the mock data
    const projet = mockData.projects.find(p => p.id === projetId)
    if (projet) {
      if (!projet.fichiers) projet.fichiers = []
      projet.fichiers.push(fichier)
    }
    return fichier
  }

  // Upload to Storage
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, file)
  fichier.url = await getDownloadURL(storageRef)

  // Add to projet's fichiers array
  const projetRef = doc(db, 'projects', projetId)
  await updateDoc(projetRef, {
    fichiers: arrayUnion(fichier),
    updatedAt: serverTimestamp()
  })

  return fichier
}

export const deleteProjetFile = async (projetId, fichier) => {
  if (isDemoMode) {
    const projet = mockData.projects.find(p => p.id === projetId)
    if (projet && projet.fichiers) {
      projet.fichiers = projet.fichiers.filter(f => f.id !== fichier.id)
    }
    return
  }

  // Delete from Storage
  const storageRef = ref(storage, fichier.storagePath)
  try {
    await deleteObject(storageRef)
  } catch (e) {
    console.warn('File not found in storage:', e)
  }

  // Remove from projet's fichiers array
  const projetRef = doc(db, 'projects', projetId)
  await updateDoc(projetRef, {
    fichiers: arrayRemove(fichier),
    updatedAt: serverTimestamp()
  })
}

export const uploadImage = async (path, file) => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Le fichier dépasse la taille maximale de 10MB')
  }

  if (isDemoMode) {
    return `https://demo.local/images/${Date.now()}.jpg`
  }

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

// Export Firestore utilities for custom queries
export { collection, doc, query, where, orderBy, serverTimestamp, arrayUnion, arrayRemove }

// ==================== MESSAGES (Système de messagerie) ====================

/**
 * Status possibles pour un message
 */
export const MessageStatus = {
  NON_LU: 'non_lu',
  EN_COURS: 'en_cours',
  RESOLU: 'resolu'
}

/**
 * Sujets de messages disponibles
 */
export const MESSAGE_SUBJECTS = [
  'Question générale',
  'Demande de certificat',
  'Problème technique',
  'Suggestion',
  'Autre'
]

/**
 * S'abonner à tous les messages (temps réel)
 */
export const subscribeToMessages = (callback) => {
  if (isDemoMode) {
    setTimeout(() => callback([]), 100)
    return () => {}
  }
  const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      // Filtrer les messages supprimés par l'admin
      .filter(doc => !doc.data().deletedByAdmin)
      .map(doc => ({ id: doc.id, ...doc.data() }))
    callback(messages)
  })
}

/**
 * Mettre à jour le status d'un message
 */
export const updateMessageStatus = async (messageId, status) => {
  if (isDemoMode) {
    console.log('[DEMO] Update message status:', messageId, status)
    return
  }
  const messageRef = doc(db, 'messages', messageId)
  await updateDoc(messageRef, {
    status,
    updatedAt: serverTimestamp()
  })
}

/**
 * Répondre à un message
 */
export const replyToMessage = async (messageId, replyText, adminName = 'Admin') => {
  if (isDemoMode) {
    console.log('[DEMO] Reply to message:', messageId, replyText)
    return
  }
  const messageRef = doc(db, 'messages', messageId)
  const reponse = {
    id: `reply-${Date.now()}`,
    message: replyText,
    createdBy: 'mosquee',
    createdAt: new Date().toISOString()
  }
  await updateDoc(messageRef, {
    reponses: arrayUnion(reponse),
    status: MessageStatus.EN_COURS,
    updatedAt: serverTimestamp()
  })
}

/**
 * Supprimer un message (soft delete - reste visible pour l'utilisateur)
 */
export const deleteMessage = async (messageId) => {
  if (isDemoMode) {
    console.log('[DEMO] Delete message:', messageId)
    return
  }
  const messageRef = doc(db, 'messages', messageId)
  // Soft delete: marquer comme supprimé par l'admin
  await updateDoc(messageRef, {
    deletedByAdmin: true,
    deletedByAdminAt: serverTimestamp()
  })
}

/**
 * Obtenir le nombre de messages non lus (pour le badge)
 */
export const getUnreadMessagesCount = async () => {
  if (isDemoMode) {
    return 0
  }
  const q = query(collection(db, 'messages'), where('status', '==', MessageStatus.NON_LU))
  const snapshot = await getDocs(q)
  return snapshot.size
}

/**
 * S'abonner au nombre de messages non lus (temps réel)
 */
export const subscribeToUnreadMessagesCount = (callback) => {
  if (isDemoMode) {
    setTimeout(() => callback(0), 100)
    return () => {}
  }
  const q = query(collection(db, 'messages'), where('status', '==', MessageStatus.NON_LU))
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.size)
  })
}

// ==================== NOTIFICATIONS ====================

/**
 * Envoie une notification push via Cloud Functions
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @param {string} topic - Topic FCM (announcements, events, janaza, all)
 * @param {object} customData - Données supplémentaires
 */
export const sendNotification = async (title, body, topic = 'all', customData = {}) => {
  if (isDemoMode || !functions) {
    console.log('[DEMO] Notification simulée:', { title, body, topic })
    return { success: true, demo: true }
  }

  try {
    const sendManualNotification = httpsCallable(functions, 'sendManualNotification')
    const result = await sendManualNotification({
      title,
      body,
      topic,
      data: customData
    })
    return result.data
  } catch (error) {
    console.error('Erreur envoi notification:', error)
    throw error
  }
}
