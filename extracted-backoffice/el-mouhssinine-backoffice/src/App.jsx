import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, Timestamp, where
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyAA_qoUYwWBTeuUqd0JToHQ8olnbS8OJno",
  authDomain: "el-mouhssinine.firebaseapp.com",
  projectId: "el-mouhssinine",
  storageBucket: "el-mouhssinine.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:ios:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ==================== STYLES ====================
const styles = {
  container: { minHeight: '100vh', background: '#f5f5f7', fontFamily: '-apple-system, sans-serif' },
  sidebar: { width: '260px', background: '#1a1a2e', color: '#fff', position: 'fixed', height: '100vh', padding: '20px 0' },
  sidebarLogo: { padding: '0 20px 30px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px' },
  sidebarLogoText: { fontSize: '20px', fontWeight: 'bold', color: '#c9a227' },
  sidebarNav: { padding: '0 10px' },
  navItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginBottom: '4px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '14px' },
  navItemActive: { background: 'rgba(201,162,39,0.2)', color: '#c9a227' },
  navIcon: { fontSize: '18px' },
  main: { marginLeft: '260px', padding: '30px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  headerTitle: { fontSize: '28px', fontWeight: 'bold', color: '#1a1a2e' },
  card: { background: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
  cardTitle: { fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#1a1a2e' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px', borderBottom: '2px solid #e8e8ed', color: '#8e8ea0', fontSize: '12px', textTransform: 'uppercase' },
  td: { padding: '16px 12px', borderBottom: '1px solid #f0f0f5', color: '#1a1a2e', fontSize: '14px' },
  badge: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  badgeSuccess: { background: 'rgba(39,174,96,0.15)', color: '#27ae60' },
  badgeWarning: { background: 'rgba(241,196,15,0.15)', color: '#f1c40f' },
  badgeDanger: { background: 'rgba(231,76,60,0.15)', color: '#e74c3c' },
  btn: { padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  btnPrimary: { background: '#c9a227', color: '#fff' },
  btnSecondary: { background: '#e8e8ed', color: '#1a1a2e' },
  btnDanger: { background: '#e74c3c', color: '#fff' },
  btnSmall: { padding: '6px 12px', fontSize: '12px' },
  input: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e8e8ed', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e8e8ed', fontSize: '14px', marginBottom: '16px', minHeight: '100px', resize: 'vertical', boxSizing: 'border-box' },
  label: { display: 'block', marginBottom: '8px', color: '#4a4a68', fontSize: '14px', fontWeight: '500' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' },
  statCard: { background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
  statValue: { fontSize: '32px', fontWeight: 'bold', color: '#c9a227' },
  statLabel: { fontSize: '14px', color: '#8e8ea0', marginTop: '4px' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '20px', padding: '30px', width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: '22px', fontWeight: '600', marginBottom: '24px', color: '#1a1a2e' },
  switch: { width: '50px', height: '28px', borderRadius: '14px', background: '#e8e8ed', position: 'relative', cursor: 'pointer' },
  switchActive: { background: '#c9a227' },
  switchKnob: { width: '24px', height: '24px', borderRadius: '12px', background: '#fff', position: 'absolute', top: '2px', left: '2px', transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' },
  switchKnobActive: { left: '24px' },
  loginContainer: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #7f4f24 100%)' },
  loginCard: { background: '#fff', borderRadius: '20px', padding: '40px', width: '400px', textAlign: 'center' },
  loginLogo: { fontSize: '48px', marginBottom: '16px' },
  loginTitle: { fontSize: '24px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '8px' },
  loginSubtitle: { fontSize: '14px', color: '#8e8ea0', marginBottom: '30px' },
};

// ==================== COMPOSANTS ====================
const Switch = ({ active, onToggle }) => (
  <div 
    style={{...styles.switch, ...(active ? styles.switchActive : {})}}
    onClick={onToggle}
  >
    <div style={{...styles.switchKnob, ...(active ? styles.switchKnobActive : {})}} />
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>{title}</h2>
        {children}
      </div>
    </div>
  );
};

// ==================== PAGES ====================

// Dashboard
const Dashboard = ({ stats }) => (
  <>
    <div style={styles.statsGrid}>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{stats.totalDonations.toLocaleString()}€</div>
        <div style={styles.statLabel}>Dons ce mois</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{stats.activeMembers}</div>
        <div style={styles.statLabel}>Adhérents actifs</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{stats.monthlySubscriptions}</div>
        <div style={styles.statLabel}>Abonnements mensuels</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{stats.pendingPayments}</div>
        <div style={styles.statLabel}>Paiements en attente</div>
      </div>
    </div>

    <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px'}}>
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>📊 Derniers dons</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Donateur</th>
              <th style={styles.th}>Montant</th>
              <th style={styles.th}>Projet</th>
              <th style={styles.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentDonations.map((don, i) => (
              <tr key={i}>
                <td style={styles.td}>{don.email || 'Anonyme'}</td>
                <td style={styles.td}><strong>{don.amount}€</strong></td>
                <td style={styles.td}>{don.projectName}</td>
                <td style={styles.td}>{don.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>⚡ Actions rapides</h3>
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          <button style={{...styles.btn, ...styles.btnPrimary, width: '100%'}}>
            📢 Nouvelle annonce
          </button>
          <button style={{...styles.btn, ...styles.btnSecondary, width: '100%'}}>
            📅 Ajouter événement
          </button>
          <button style={{...styles.btn, ...styles.btnSecondary, width: '100%'}}>
            🕯️ Prière mortuaire
          </button>
          <button style={{...styles.btn, ...styles.btnSecondary, width: '100%'}}>
            🔔 Envoyer notification
          </button>
        </div>
      </div>
    </div>
  </>
);

// Gestion des horaires
const HorairesPage = () => {
  const [horaires, setHoraires] = useState({
    fajr: '06:45', dhuhr: '13:15', asr: '15:45', maghrib: '18:02', isha: '19:30', jumua: '13:30'
  });
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    const today = new Date().toISOString().split('T')[0];
    await setDoc(doc(db, 'prayerTimes', today), {
      prayers: [
        { name: 'Fajr', time: horaires.fajr, icon: '🌅' },
        { name: 'Dhuhr', time: horaires.dhuhr, icon: '☀️' },
        { name: 'Asr', time: horaires.asr, icon: '🌤️' },
        { name: 'Maghrib', time: horaires.maghrib, icon: '🌅' },
        { name: 'Isha', time: horaires.isha, icon: '🌙' },
      ],
      jumua: horaires.jumua,
      updatedAt: Timestamp.now()
    });
    setIsEditing(false);
    alert('Horaires mis à jour !');
  };

  return (
    <div style={styles.card}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <h3 style={styles.cardTitle}>🕐 Horaires de prière</h3>
        {!isEditing ? (
          <button style={{...styles.btn, ...styles.btnPrimary}} onClick={() => setIsEditing(true)}>
            ✏️ Modifier
          </button>
        ) : (
          <div style={{display: 'flex', gap: '10px'}}>
            <button style={{...styles.btn, ...styles.btnSecondary}} onClick={() => setIsEditing(false)}>
              Annuler
            </button>
            <button style={{...styles.btn, ...styles.btnPrimary}} onClick={handleSave}>
              💾 Sauvegarder
            </button>
          </div>
        )}
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'}}>
        {[
          { key: 'fajr', label: '🌅 Fajr' },
          { key: 'dhuhr', label: '☀️ Dhuhr' },
          { key: 'asr', label: '🌤️ Asr' },
          { key: 'maghrib', label: '🌅 Maghrib' },
          { key: 'isha', label: '🌙 Isha' },
          { key: 'jumua', label: '🕌 Jumu\'a' },
        ].map(prayer => (
          <div key={prayer.key}>
            <label style={styles.label}>{prayer.label}</label>
            <input
              type="time"
              style={styles.input}
              value={horaires[prayer.key]}
              onChange={e => setHoraires({...horaires, [prayer.key]: e.target.value})}
              disabled={!isEditing}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Gestion des annonces
const AnnoncesPage = () => {
  const [annonces, setAnnonces] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnonce, setEditingAnnonce] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '', isActive: true });

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('publishedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setAnnonces(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const handleSave = async () => {
    if (editingAnnonce) {
      await updateDoc(doc(db, 'announcements', editingAnnonce.id), formData);
    } else {
      await setDoc(doc(collection(db, 'announcements')), {
        ...formData,
        publishedAt: Timestamp.now()
      });
    }
    setShowModal(false);
    setFormData({ title: '', content: '', isActive: true });
    setEditingAnnonce(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Supprimer cette annonce ?')) {
      await deleteDoc(doc(db, 'announcements', id));
    }
  };

  return (
    <>
      <div style={styles.card}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
          <h3 style={styles.cardTitle}>📢 Annonces</h3>
          <button style={{...styles.btn, ...styles.btnPrimary}} onClick={() => setShowModal(true)}>
            + Nouvelle annonce
          </button>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Titre</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Statut</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {annonces.map(annonce => (
              <tr key={annonce.id}>
                <td style={styles.td}><strong>{annonce.title}</strong></td>
                <td style={styles.td}>{annonce.publishedAt?.toDate?.()?.toLocaleDateString('fr-FR') || '-'}</td>
                <td style={styles.td}>
                  <span style={{...styles.badge, ...(annonce.isActive ? styles.badgeSuccess : styles.badgeDanger)}}>
                    {annonce.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={styles.td}>
                  <button 
                    style={{...styles.btn, ...styles.btnSecondary, ...styles.btnSmall, marginRight: '8px'}}
                    onClick={() => { setEditingAnnonce(annonce); setFormData(annonce); setShowModal(true); }}
                  >
                    ✏️
                  </button>
                  <button 
                    style={{...styles.btn, ...styles.btnDanger, ...styles.btnSmall}}
                    onClick={() => handleDelete(annonce.id)}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingAnnonce(null); }} title={editingAnnonce ? 'Modifier l\'annonce' : 'Nouvelle annonce'}>
        <label style={styles.label}>Titre</label>
        <input style={styles.input} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
        
        <label style={styles.label}>Contenu</label>
        <textarea style={styles.textarea} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
        
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
          <label style={{...styles.label, marginBottom: 0}}>Active</label>
          <Switch active={formData.isActive} onToggle={() => setFormData({...formData, isActive: !formData.isActive})} />
        </div>
        
        <button style={{...styles.btn, ...styles.btnPrimary, width: '100%'}} onClick={handleSave}>
          {editingAnnonce ? 'Mettre à jour' : 'Publier'}
        </button>
      </Modal>
    </>
  );
};

// Gestion des adhérents
const AdherentsPage = () => {
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const filteredMembers = members.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'active') return m.cotisationStatus === 'active';
    if (filter === 'expired') return m.cotisationStatus === 'expired';
    if (filter === 'mensuel') return m.cotisationType === 'mensuel';
    if (filter === 'annuel') return m.cotisationType === 'annuel';
    return true;
  });

  return (
    <div style={styles.card}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <h3 style={styles.cardTitle}>👥 Adhérents ({filteredMembers.length})</h3>
        <div style={{display: 'flex', gap: '10px'}}>
          {['all', 'active', 'expired', 'mensuel', 'annuel'].map(f => (
            <button 
              key={f}
              style={{...styles.btn, ...(filter === f ? styles.btnPrimary : styles.btnSecondary), ...styles.btnSmall}}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : f === 'expired' ? 'Expirés' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>N° Adhérent</th>
            <th style={styles.th}>Nom</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Statut</th>
            <th style={styles.th}>Prochain paiement</th>
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map(member => (
            <tr key={member.id}>
              <td style={styles.td}><code>{member.memberId}</code></td>
              <td style={styles.td}><strong>{member.name}</strong></td>
              <td style={styles.td}>{member.email}</td>
              <td style={styles.td}>
                <span style={{...styles.badge, ...(member.cotisationType === 'mensuel' ? styles.badgeWarning : styles.badgeSuccess)}}>
                  {member.cotisationType || '-'}
                </span>
              </td>
              <td style={styles.td}>
                <span style={{...styles.badge, ...(member.cotisationStatus === 'active' ? styles.badgeSuccess : styles.badgeDanger)}}>
                  {member.cotisationStatus === 'active' ? 'À jour' : 'Expiré'}
                </span>
              </td>
              <td style={styles.td}>{member.nextPaymentDate?.toDate?.()?.toLocaleDateString('fr-FR') || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Gestion des projets/dons
const ProjetsPage = () => {
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', description: '', goal: '', icon: '🕌', 
    isExternal: false, lieu: '', iban: '', isActive: true 
  });

  useEffect(() => {
    return onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const handleSave = async () => {
    await setDoc(doc(collection(db, 'projects')), {
      ...formData,
      goal: parseFloat(formData.goal) || 0,
      raised: 0,
      createdAt: Timestamp.now()
    });
    setShowModal(false);
    setFormData({ name: '', description: '', goal: '', icon: '🕌', isExternal: false, lieu: '', iban: '', isActive: true });
  };

  return (
    <>
      <div style={styles.card}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
          <h3 style={styles.cardTitle}>💝 Projets & Dons</h3>
          <button style={{...styles.btn, ...styles.btnPrimary}} onClick={() => setShowModal(true)}>
            + Nouveau projet
          </button>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Projet</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Progression</th>
              <th style={styles.th}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(project => (
              <tr key={project.id}>
                <td style={styles.td}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <span style={{fontSize: '24px'}}>{project.icon}</span>
                    <div>
                      <strong>{project.name}</strong>
                      {project.lieu && <div style={{fontSize: '12px', color: '#8e8ea0'}}>📍 {project.lieu}</div>}
                    </div>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={{...styles.badge, ...(project.isExternal ? styles.badgeWarning : styles.badgeSuccess)}}>
                    {project.isExternal ? 'Externe' : 'Interne'}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={{width: '150px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px'}}>
                      <span style={{color: '#c9a227', fontWeight: '600'}}>{(project.raised || 0).toLocaleString()}€</span>
                      <span style={{color: '#8e8ea0'}}>{(project.goal || 0).toLocaleString()}€</span>
                    </div>
                    <div style={{height: '6px', background: '#e8e8ed', borderRadius: '3px'}}>
                      <div style={{height: '100%', width: `${Math.min((project.raised / project.goal) * 100, 100)}%`, background: '#c9a227', borderRadius: '3px'}} />
                    </div>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={{...styles.badge, ...(project.isActive ? styles.badgeSuccess : styles.badgeDanger)}}>
                    {project.isActive ? 'Actif' : 'Terminé'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nouveau projet">
        <label style={styles.label}>Nom du projet</label>
        <input style={styles.input} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        
        <label style={styles.label}>Description</label>
        <textarea style={styles.textarea} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
          <div>
            <label style={styles.label}>Objectif (€)</label>
            <input style={styles.input} type="number" value={formData.goal} onChange={e => setFormData({...formData, goal: e.target.value})} />
          </div>
          <div>
            <label style={styles.label}>Icône</label>
            <input style={styles.input} value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} />
          </div>
        </div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
          <label style={{...styles.label, marginBottom: 0}}>Projet externe</label>
          <Switch active={formData.isExternal} onToggle={() => setFormData({...formData, isExternal: !formData.isExternal})} />
        </div>
        
        {formData.isExternal && (
          <>
            <label style={styles.label}>Lieu</label>
            <input style={styles.input} value={formData.lieu} onChange={e => setFormData({...formData, lieu: e.target.value})} placeholder="Ex: Gaza, Palestine" />
            
            <label style={styles.label}>IBAN destinataire</label>
            <input style={styles.input} value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} />
          </>
        )}
        
        <button style={{...styles.btn, ...styles.btnPrimary, width: '100%'}} onClick={handleSave}>
          Créer le projet
        </button>
      </Modal>
    </>
  );
};

// Gestion Janaza
const JanazaPage = () => {
  const [janazas, setJanazas] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    deceasedName: '', deceasedNameAr: '', prayerTime: '', 
    prayerDate: '', location: 'Salle principale', message: '', isActive: true 
  });

  useEffect(() => {
    return onSnapshot(query(collection(db, 'janaza'), orderBy('prayerDate', 'desc')), (snapshot) => {
      setJanazas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const handleSave = async () => {
    await setDoc(doc(collection(db, 'janaza')), {
      ...formData,
      prayerDate: Timestamp.fromDate(new Date(formData.prayerDate)),
      createdAt: Timestamp.now()
    });
    setShowModal(false);
    setFormData({ deceasedName: '', deceasedNameAr: '', prayerTime: '', prayerDate: '', location: 'Salle principale', message: '', isActive: true });
  };

  return (
    <>
      <div style={styles.card}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
          <h3 style={styles.cardTitle}>🕯️ Prières mortuaires</h3>
          <button style={{...styles.btn, ...styles.btnPrimary}} onClick={() => setShowModal(true)}>
            + Ajouter Janaza
          </button>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Défunt(e)</th>
              <th style={styles.th}>Date & Heure</th>
              <th style={styles.th}>Lieu</th>
              <th style={styles.th}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {janazas.map(j => (
              <tr key={j.id}>
                <td style={styles.td}>
                  <strong>{j.deceasedName}</strong>
                  {j.deceasedNameAr && <span style={{color: '#c9a227', marginLeft: '8px'}}>{j.deceasedNameAr}</span>}
                </td>
                <td style={styles.td}>
                  {j.prayerDate?.toDate?.()?.toLocaleDateString('fr-FR')} à {j.prayerTime}
                </td>
                <td style={styles.td}>{j.location}</td>
                <td style={styles.td}>
                  <Switch 
                    active={j.isActive} 
                    onToggle={async () => await updateDoc(doc(db, 'janaza', j.id), { isActive: !j.isActive })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nouvelle prière mortuaire">
        <label style={styles.label}>Nom du défunt(e)</label>
        <input style={styles.input} value={formData.deceasedName} onChange={e => setFormData({...formData, deceasedName: e.target.value})} />
        
        <label style={styles.label}>Nom en arabe (optionnel)</label>
        <input style={styles.input} value={formData.deceasedNameAr} onChange={e => setFormData({...formData, deceasedNameAr: e.target.value})} placeholder="Ex: رحمه الله" />
        
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
          <div>
            <label style={styles.label}>Date</label>
            <input style={styles.input} type="date" value={formData.prayerDate} onChange={e => setFormData({...formData, prayerDate: e.target.value})} />
          </div>
          <div>
            <label style={styles.label}>Heure</label>
            <input style={styles.input} type="time" value={formData.prayerTime} onChange={e => setFormData({...formData, prayerTime: e.target.value})} />
          </div>
        </div>
        
        <label style={styles.label}>Lieu</label>
        <input style={styles.input} value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
        
        <label style={styles.label}>Message (optionnel)</label>
        <textarea style={styles.textarea} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} placeholder="Que Allah lui accorde Sa miséricorde..." />
        
        <button style={{...styles.btn, ...styles.btnPrimary, width: '100%'}} onClick={handleSave}>
          Publier
        </button>
      </Modal>
    </>
  );
};

// Notifications
const NotificationsPage = () => {
  const [notif, setNotif] = useState({ title: '', body: '', type: 'all' });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'notifications'), orderBy('sentAt', 'desc')), (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const sendNotification = async () => {
    // TODO: Intégrer Firebase Cloud Messaging
    await setDoc(doc(collection(db, 'notifications')), {
      ...notif,
      sentAt: Timestamp.now(),
      status: 'sent'
    });
    alert('Notification envoyée !');
    setNotif({ title: '', body: '', type: 'all' });
  };

  return (
    <>
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🔔 Envoyer une notification</h3>
        
        <label style={styles.label}>Titre</label>
        <input style={styles.input} value={notif.title} onChange={e => setNotif({...notif, title: e.target.value})} placeholder="Ex: Rappel prière de Jumu'a" />
        
        <label style={styles.label}>Message</label>
        <textarea style={styles.textarea} value={notif.body} onChange={e => setNotif({...notif, body: e.target.value})} placeholder="Ex: N'oubliez pas la prière du vendredi à 13h30" />
        
        <label style={styles.label}>Destinataires</label>
        <select style={styles.input} value={notif.type} onChange={e => setNotif({...notif, type: e.target.value})}>
          <option value="all">Tous les utilisateurs</option>
          <option value="members">Adhérents uniquement</option>
          <option value="active">Adhérents à jour</option>
        </select>
        
        <button style={{...styles.btn, ...styles.btnPrimary}} onClick={sendNotification}>
          📤 Envoyer la notification
        </button>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>📜 Historique</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Titre</th>
              <th style={styles.th}>Message</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Destinataires</th>
            </tr>
          </thead>
          <tbody>
            {history.slice(0, 10).map(n => (
              <tr key={n.id}>
                <td style={styles.td}><strong>{n.title}</strong></td>
                <td style={styles.td}>{n.body}</td>
                <td style={styles.td}>{n.sentAt?.toDate?.()?.toLocaleString('fr-FR')}</td>
                <td style={styles.td}>
                  <span style={{...styles.badge, ...styles.badgeSuccess}}>
                    {n.type === 'all' ? 'Tous' : n.type === 'members' ? 'Adhérents' : 'Actifs'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// Paramètres
const SettingsPage = () => {
  const [info, setInfo] = useState({
    name: 'Mosquée El Mouhssinine',
    address: '123 Rue de la Mosquée',
    city: 'Bourg-en-Bresse',
    postalCode: '01000',
    phone: '04 74 XX XX XX',
    email: 'contact@elmouhssinine.fr',
    website: 'el-mouhssinine.web.app',
    iban: 'FR76 1234 5678 9012 3456 7890 123',
    bic: 'AGRIFRPP',
    bankName: 'Crédit Agricole',
    accountHolder: 'Association El Mouhssinine'
  });

  const handleSave = async () => {
    await setDoc(doc(db, 'settings', 'mosqueeInfo'), info);
    alert('Informations mises à jour !');
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>⚙️ Paramètres de la mosquée</h3>
      
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
        <div>
          <h4 style={{marginBottom: '16px', color: '#1a1a2e'}}>📍 Informations générales</h4>
          
          <label style={styles.label}>Nom</label>
          <input style={styles.input} value={info.name} onChange={e => setInfo({...info, name: e.target.value})} />
          
          <label style={styles.label}>Adresse</label>
          <input style={styles.input} value={info.address} onChange={e => setInfo({...info, address: e.target.value})} />
          
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
            <div>
              <label style={styles.label}>Code postal</label>
              <input style={styles.input} value={info.postalCode} onChange={e => setInfo({...info, postalCode: e.target.value})} />
            </div>
            <div>
              <label style={styles.label}>Ville</label>
              <input style={styles.input} value={info.city} onChange={e => setInfo({...info, city: e.target.value})} />
            </div>
          </div>
          
          <label style={styles.label}>Téléphone</label>
          <input style={styles.input} value={info.phone} onChange={e => setInfo({...info, phone: e.target.value})} />
          
          <label style={styles.label}>Email</label>
          <input style={styles.input} value={info.email} onChange={e => setInfo({...info, email: e.target.value})} />
          
          <label style={styles.label}>Site web</label>
          <input style={styles.input} value={info.website} onChange={e => setInfo({...info, website: e.target.value})} />
        </div>
        
        <div>
          <h4 style={{marginBottom: '16px', color: '#1a1a2e'}}>🏦 Coordonnées bancaires</h4>
          
          <label style={styles.label}>Titulaire du compte</label>
          <input style={styles.input} value={info.accountHolder} onChange={e => setInfo({...info, accountHolder: e.target.value})} />
          
          <label style={styles.label}>Banque</label>
          <input style={styles.input} value={info.bankName} onChange={e => setInfo({...info, bankName: e.target.value})} />
          
          <label style={styles.label}>IBAN</label>
          <input style={styles.input} value={info.iban} onChange={e => setInfo({...info, iban: e.target.value})} />
          
          <label style={styles.label}>BIC</label>
          <input style={styles.input} value={info.bic} onChange={e => setInfo({...info, bic: e.target.value})} />
        </div>
      </div>
      
      <button style={{...styles.btn, ...styles.btnPrimary, marginTop: '20px'}} onClick={handleSave}>
        💾 Sauvegarder les modifications
      </button>
    </div>
  );
};

// ==================== APP PRINCIPALE ====================
export default function BackofficeApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [stats, setStats] = useState({
    totalDonations: 12450,
    activeMembers: 87,
    monthlySubscriptions: 42,
    pendingPayments: 3,
    recentDonations: [
      { email: 'ahmed@email.com', amount: 50, projectName: 'Rénovation Salle', date: '09/01/2026' },
      { email: 'fatima@email.com', amount: 100, projectName: 'Aide Nécessiteux', date: '08/01/2026' },
      { email: null, amount: 25, projectName: 'École du Dimanche', date: '08/01/2026' },
    ]
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      alert('Erreur de connexion: ' + error.message);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return <div style={{...styles.loginContainer, color: '#fff'}}>Chargement...</div>;
  }

  if (!user) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.loginLogo}>🕌</div>
          <h1 style={styles.loginTitle}>El Mouhssinine</h1>
          <p style={styles.loginSubtitle}>Backoffice Administration</p>
          
          <form onSubmit={handleLogin}>
            <input 
              style={styles.input} 
              type="email" 
              placeholder="Email" 
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
            />
            <input 
              style={styles.input} 
              type="password" 
              placeholder="Mot de passe" 
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
            />
            <button type="submit" style={{...styles.btn, ...styles.btnPrimary, width: '100%'}}>
              Se connecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'horaires', icon: '🕐', label: 'Horaires' },
    { id: 'annonces', icon: '📢', label: 'Annonces' },
    { id: 'events', icon: '📅', label: 'Événements' },
    { id: 'janaza', icon: '🕯️', label: 'Janaza' },
    { id: 'projets', icon: '💝', label: 'Projets & Dons' },
    { id: 'adherents', icon: '👥', label: 'Adhérents' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'settings', icon: '⚙️', label: 'Paramètres' },
  ];

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <div style={styles.sidebarLogoText}>🕌 El Mouhssinine</div>
          <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px'}}>Administration</div>
        </div>
        
        <nav style={styles.sidebarNav}>
          {navItems.map(item => (
            <button
              key={item.id}
              style={{...styles.navItem, ...(currentPage === item.id ? styles.navItemActive : {})}}
              onClick={() => setCurrentPage(item.id)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          
          <button style={{...styles.navItem, marginTop: '20px', color: '#e74c3c'}} onClick={handleLogout}>
            <span style={styles.navIcon}>🚪</span>
            Déconnexion
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>
            {navItems.find(n => n.id === currentPage)?.icon} {navItems.find(n => n.id === currentPage)?.label}
          </h1>
          <div style={{color: '#8e8ea0', fontSize: '14px'}}>
            Connecté: {user.email}
          </div>
        </div>

        {currentPage === 'dashboard' && <Dashboard stats={stats} />}
        {currentPage === 'horaires' && <HorairesPage />}
        {currentPage === 'annonces' && <AnnoncesPage />}
        {currentPage === 'janaza' && <JanazaPage />}
        {currentPage === 'projets' && <ProjetsPage />}
        {currentPage === 'adherents' && <AdherentsPage />}
        {currentPage === 'notifications' && <NotificationsPage />}
        {currentPage === 'settings' && <SettingsPage />}
        {currentPage === 'events' && <AnnoncesPage />} {/* Réutilise la même structure */}
      </main>
    </div>
  );
}
