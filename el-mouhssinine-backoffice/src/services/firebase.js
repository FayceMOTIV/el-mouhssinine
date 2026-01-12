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

const firebaseConfig = {
  apiKey: "AIzaSyCJr6tGI9QpbWr3pf1GpYoEnvsGgkJj8j8",
  authDomain: "el-mouhssinine.firebaseapp.com",
  projectId: "el-mouhssinine",
  storageBucket: "el-mouhssinine.firebasestorage.app",
  messagingSenderId: "658931173250",
  appId: "1:658931173250:web:c5a7e8f2d3b4a192837465"
}

// Force demo mode for development (set to true to use mock data)
const FORCE_DEMO_MODE = false

// Demo mode flag
export let isDemoMode = FORCE_DEMO_MODE
let app = null
let db = null
let auth = null
let storage = null

if (!FORCE_DEMO_MODE) {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    auth = getAuth(app)
    storage = getStorage(app)
  } catch (err) {
    isDemoMode = true
  }
}

export { app, db, auth, storage }

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
export const getPrayerTimes = () => getDocument('settings', 'prayerTimes')
export const updatePrayerTimes = (data) => setDocument('settings', 'prayerTimes', data)

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
