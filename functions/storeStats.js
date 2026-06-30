/**
 * Statistiques de téléchargement (App Store + Google Play) pour le backoffice.
 * - iOS  : App Store Connect Sales Reports API (clé .p8, vendor number)
 * - Android : Google Play (service account) — Reporting API / bucket stats
 *
 * Secrets lus depuis process.env (functions/.env, gitignored) :
 *   ASC_KEY_ID, ASC_ISSUER, ASC_VENDOR, ASC_KEY_P8_B64
 *   GPLAY_SA_JSON_B64, GPLAY_PACKAGE
 *
 * Écrit le résultat dans Firestore settings/storeStats (lu par le dashboard backoffice).
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const zlib = require('zlib');
const https = require('https');

const REGION = 'europe-west1';

// --- petit helper HTTP (GET) qui retourne le buffer brut + statut ---
function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}
function httpPostForm(url, form) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(form).toString();
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
    req.write(data);
    req.end();
  });
}

// ==================== iOS — App Store Connect ====================
function ascToken() {
  const keyId = process.env.ASC_KEY_ID;
  const issuer = process.env.ASC_ISSUER;
  const p8 = Buffer.from(process.env.ASC_KEY_P8_B64 || '', 'base64').toString('utf8');
  if (!keyId || !issuer || !p8) throw new Error('ASC credentials manquantes');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: issuer, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
    p8,
    { algorithm: 'ES256', header: { kid: keyId, typ: 'JWT' } },
  );
}

// Types "premier téléchargement" Apple (Product Type Identifier)
const IOS_INSTALL_TYPES = new Set(['1', '1F', '1T', '1E', 'F1', '1EP', '1EU', 'IA1']);

async function fetchIosDayDownloads(token, vendor, dateStr) {
  const params = new URLSearchParams({
    'filter[frequency]': 'DAILY',
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[vendorNumber]': vendor,
    'filter[reportDate]': dateStr,
    'filter[version]': '1_1',
  });
  const url = `https://api.appstoreconnect.apple.com/v1/salesReports?${params}`;
  const { status, body } = await httpGet(url, { Authorization: `Bearer ${token}`, Accept: 'application/a-gzip' });
  if (status === 404) return 0; // pas de rapport ce jour (0 vente)
  if (status !== 200) throw new Error(`iOS report ${dateStr} HTTP ${status}`);
  const tsv = zlib.gunzipSync(body).toString('utf8');
  const lines = tsv.split('\n').filter(Boolean);
  if (lines.length < 2) return 0;
  const hdr = lines[0].split('\t');
  const iType = hdr.indexOf('Product Type Identifier');
  const iUnits = hdr.indexOf('Units');
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (IOS_INSTALL_TYPES.has((cols[iType] || '').trim())) {
      total += parseInt(cols[iUnits] || '0', 10) || 0;
    }
  }
  return total;
}

async function fetchIosStats() {
  const vendor = process.env.ASC_VENDOR;
  if (!vendor) return { available: false, reason: 'config manquante' };
  const token = ascToken();
  const today = new Date();
  let last30 = 0;
  let yesterday = 0;
  // Les rapports App Store ont ~1-2 jours de délai : on lit J-2 à J-32
  for (let d = 2; d <= 32; d++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - d);
    const ds = day.toISOString().slice(0, 10);
    let n = 0;
    try { n = await fetchIosDayDownloads(token, vendor, ds); } catch (e) { n = 0; }
    last30 += n;
    if (d === 2) yesterday = n;
  }
  return { available: true, last30, yesterday };
}

// ==================== Android — Google Play ====================
async function gplayToken(scope) {
  const sa = JSON.parse(Buffer.from(process.env.GPLAY_SA_JSON_B64 || '', 'base64').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: sa.client_email, scope, aud: sa.token_uri, iat: now, exp: now + 3600 },
    sa.private_key,
    { algorithm: 'RS256' },
  );
  const { status, body } = await httpPostForm(sa.token_uri, {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  if (status !== 200) throw new Error(`gplay token HTTP ${status}`);
  return JSON.parse(body).access_token;
}

async function fetchAndroidStats() {
  const pkg = process.env.GPLAY_PACKAGE;
  if (!pkg || !process.env.GPLAY_SA_JSON_B64) return { available: false, reason: 'config manquante' };
  try {
    const token = await gplayToken('https://www.googleapis.com/auth/playdeveloperreporting');
    // Reporting API : nombre d'appareils actifs (proxy d'installs actives)
    const url = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${pkg}`;
    const { status } = await httpGet(url, { Authorization: `Bearer ${token}` });
    if (status === 403 || status === 404) {
      return { available: false, reason: 'permission en cours d\'activation (délai ~24h Google)' };
    }
    if (status !== 200) return { available: false, reason: `HTTP ${status}` };
    // L'app est accessible : on récupère le métric set "installs"
    // (active device installs sur les 28 derniers jours via metricSet errorCountMetricSet n'est pas install ;
    //  on utilise le set "installs" si dispo, sinon on renvoie available avec note)
    return await fetchAndroidInstallsMetric(token, pkg);
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

async function fetchAndroidInstallsMetric(token, pkg) {
  // Play Developer Reporting : queryInstallsMetricSet (installs / uninstalls par jour)
  const url = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${pkg}/installsMetricSet:query`;
  const now = new Date();
  const start = new Date(now); start.setUTCDate(start.getUTCDate() - 32);
  const reqBody = JSON.stringify({
    timelineSpec: { aggregationPeriod: 'DAILY',
      startTime: { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1, day: start.getUTCDate() },
      endTime: { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() } },
    metrics: ['installsCount'],
  });
  const res = await new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reqBody) } }, (r) => {
      const ch = []; r.on('data', (c) => ch.push(c)); r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(ch).toString() }));
    });
    req.on('error', reject); req.setTimeout(30000, () => req.destroy(new Error('timeout'))); req.write(reqBody); req.end();
  });
  if (res.status !== 200) return { available: false, reason: `installs HTTP ${res.status}` };
  const data = JSON.parse(res.body);
  let last30 = 0;
  (data.rows || []).forEach((row) => {
    const m = (row.metrics || []).find((x) => x.metric === 'installsCount');
    const v = m && m.decimalValue ? parseFloat(m.decimalValue.value) : 0;
    last30 += v || 0;
  });
  return { available: true, last30: Math.round(last30) };
}

// ==================== Agrégation + écriture Firestore ====================
async function computeAndStore() {
  const [ios, android] = await Promise.all([
    fetchIosStats().catch((e) => ({ available: false, reason: e.message })),
    fetchAndroidStats().catch((e) => ({ available: false, reason: e.message })),
  ]);
  const payload = {
    ios,
    android,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await admin.firestore().collection('settings').doc('storeStats').set(payload, { merge: true });
  return payload;
}

// Scheduled : tous les jours à 7h Europe/Paris
exports.updateStoreStats = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('0 7 * * *')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    try { await computeAndStore(); } catch (e) { console.error('updateStoreStats:', e.message); }
    return null;
  });

// Callable admin : rafraîchissement manuel depuis le backoffice
exports.refreshStoreStats = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Connexion requise');
    }
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    const isAdmin = adminDoc.exists && adminDoc.data().actif !== false;
    if (!isAdmin) {
      // fallback : doc admin avec champ uid
      const q = await admin.firestore().collection('admins').where('uid', '==', context.auth.uid).limit(1).get();
      if (q.empty) throw new functions.https.HttpsError('permission-denied', 'Réservé aux administrateurs');
    }
    try {
      const payload = await computeAndStore();
      return { success: true, ios: payload.ios, android: payload.android };
    } catch (e) {
      throw new functions.https.HttpsError('internal', 'Impossible de récupérer les statistiques');
    }
  });
