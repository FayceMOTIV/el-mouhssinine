import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { 
  Project, 
  Announcement, 
  Event, 
  Janaza, 
  Member, 
  Donation, 
  MosqueeInfo,
  Sourate,
  Dua
} from '../types';

// Configuration Firebase - À remplacer par vos vraies valeurs
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "el-mouhssinine.firebaseapp.com",
  projectId: "el-mouhssinine",
  storageBucket: "el-mouhssinine.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ==================== HORAIRES DE PRIÈRE ====================
export const getPrayerTimes = async (date: Date = new Date()) => {
  const dateStr = date.toISOString().split('T')[0];
  const docRef = doc(db, 'prayerTimes', dateStr);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data();
  }
  
  // Fallback - calculer avec une API
  return null;
};

export const subscribeToPrayerTimes = (callback: (times: any) => void) => {
  const today = new Date().toISOString().split('T')[0];
  return onSnapshot(doc(db, 'prayerTimes', today), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
};

// ==================== ANNONCES ====================
export const getAnnouncements = async (): Promise<Announcement[]> => {
  const q = query(
    collection(db, 'announcements'),
    where('isActive', '==', true),
    orderBy('publishedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    publishedAt: doc.data().publishedAt?.toDate()
  })) as Announcement[];
};

export const subscribeToAnnouncements = (callback: (announcements: Announcement[]) => void) => {
  const q = query(
    collection(db, 'announcements'),
    where('isActive', '==', true),
    orderBy('publishedAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const announcements = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      publishedAt: doc.data().publishedAt?.toDate()
    })) as Announcement[];
    callback(announcements);
  });
};

// ==================== ÉVÉNEMENTS ====================
export const getEvents = async (): Promise<Event[]> => {
  const q = query(
    collection(db, 'events'),
    where('date', '>=', Timestamp.now()),
    orderBy('date', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date?.toDate()
  })) as Event[];
};

export const subscribeToEvents = (callback: (events: Event[]) => void) => {
  const q = query(
    collection(db, 'events'),
    orderBy('date', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate()
    })) as Event[];
    callback(events.filter(e => e.date >= new Date()));
  });
};

// ==================== JANAZA ====================
export const getActiveJanaza = async (): Promise<Janaza | null> => {
  const q = query(
    collection(db, 'janaza'),
    where('isActive', '==', true),
    orderBy('prayerDate', 'asc')
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
    prayerDate: doc.data().prayerDate?.toDate()
  } as Janaza;
};

export const subscribeToJanaza = (callback: (janaza: Janaza | null) => void) => {
  const q = query(
    collection(db, 'janaza'),
    where('isActive', '==', true)
  );
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
    } else {
      const doc = snapshot.docs[0];
      callback({
        id: doc.id,
        ...doc.data(),
        prayerDate: doc.data().prayerDate?.toDate()
      } as Janaza);
    }
  });
};

// ==================== PROJETS / DONS ====================
export const getProjects = async (isExternal: boolean = false): Promise<Project[]> => {
  const q = query(
    collection(db, 'projects'),
    where('isActive', '==', true),
    where('isExternal', '==', isExternal)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Project[];
};

export const subscribeToProjects = (callback: (projects: Project[]) => void) => {
  const q = query(
    collection(db, 'projects'),
    where('isActive', '==', true)
  );
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Project[];
    callback(projects);
  });
};

export const createDonation = async (donation: Omit<Donation, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = doc(collection(db, 'donations'));
  await setDoc(docRef, {
    ...donation,
    createdAt: Timestamp.now()
  });
  return docRef.id;
};

// ==================== MEMBRES / ADHÉRENTS ====================
export const getMember = async (memberId: string): Promise<Member | null> => {
  const docRef = doc(db, 'members', memberId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate(),
    nextPaymentDate: docSnap.data().nextPaymentDate?.toDate()
  } as Member;
};

export const updateMember = async (memberId: string, data: Partial<Member>) => {
  const docRef = doc(db, 'members', memberId);
  await updateDoc(docRef, data);
};

export const createMember = async (member: Omit<Member, 'id' | 'createdAt' | 'memberId'>): Promise<string> => {
  const docRef = doc(collection(db, 'members'));
  const memberId = `ELM-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  
  await setDoc(docRef, {
    ...member,
    memberId,
    createdAt: Timestamp.now()
  });
  
  return docRef.id;
};

// ==================== INFO MOSQUÉE ====================
export const getMosqueeInfo = async (): Promise<MosqueeInfo | null> => {
  const docRef = doc(db, 'settings', 'mosqueeInfo');
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return docSnap.data() as MosqueeInfo;
};

export const subscribeToMosqueeInfo = (callback: (info: MosqueeInfo) => void) => {
  return onSnapshot(doc(db, 'settings', 'mosqueeInfo'), (doc) => {
    if (doc.exists()) {
      callback(doc.data() as MosqueeInfo);
    }
  });
};

// ==================== CORAN & DUAS ====================
export const getSourates = async (): Promise<Sourate[]> => {
  const snapshot = await getDocs(collection(db, 'sourates'));
  return snapshot.docs.map(doc => ({
    id: parseInt(doc.id),
    ...doc.data()
  })) as Sourate[];
};

export const getDuas = async (): Promise<Dua[]> => {
  const snapshot = await getDocs(collection(db, 'duas'));
  return snapshot.docs.map(doc => ({
    id: parseInt(doc.id),
    ...doc.data()
  })) as Dua[];
};

// ==================== CALENDRIER HÉGIRIEN ====================
export const getIslamicDates = async () => {
  const docRef = doc(db, 'settings', 'islamicCalendar');
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return docSnap.data();
};
