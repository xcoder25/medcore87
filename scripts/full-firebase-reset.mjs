/**
 * Full reset via Admin SDK — Auth users + all root Firestore collections.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function loadAdmin() {
  try {
    return require('firebase-admin');
  } catch {
    try {
      return require('../apps/os/node_modules/firebase-admin');
    } catch {
      throw new Error('Install firebase-admin: npm install firebase-admin');
    }
  }
}

const admin = loadAdmin();
const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
if (!raw && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS');
  process.exit(1);
}

if (!admin.apps.length) {
  if (raw) {
    const sa = JSON.parse(raw);
    if (sa.private_key) sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT,
    });
  }
}

const auth = admin.auth();
const db = admin.firestore();

async function deleteAllAuthUsers() {
  let deleted = 0;
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const uids = page.users.map((u) => u.uid);
    pageToken = page.pageToken;
    if (!uids.length) break;
    const result = await auth.deleteUsers(uids);
    deleted += result.successCount;
    console.log('Auth deleted', result.successCount);
  } while (pageToken);
  return deleted;
}

async function deleteCollectionRecursive(colRef, batchSize = 200) {
  let total = 0;
  while (true) {
    const snap = await colRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      const subcols = await doc.ref.listCollections();
      for (const sub of subcols) {
        total += await deleteCollectionRecursive(sub, batchSize);
      }
      batch.delete(doc.ref);
      total++;
    }
    await batch.commit();
  }
  return total;
}

console.log('=== FULL FIREBASE RESET ===');
console.log('Auth deleted:', await deleteAllAuthUsers());
const cols = await db.listCollections();
let n = 0;
for (const col of cols) {
  console.log('Wiping', col.id);
  n += await deleteCollectionRecursive(col);
}
console.log('Firestore docs deleted:', n);
console.log('=== DONE ===');
