/**
 * MedCore Cloud-to-Local Mirror Daemon (Firestore Snapshot Streaming)
 * Technical Brief Section 3.A & 4 Phase 3: Edge Syncing
 */

const fs = require('fs');
const path = require('path');
const { evaluateClinicalDelta } = require('./conflictResolver');

let dbInstance = null;
let isMirrorRunning = false;
let unsubscribeSnapshot = null;

function getRemoteCloudDB() {
  if (dbInstance) return dbInstance;

  try {
    let adminApp;
    let adminFirestore;

    try {
      const adminAppModule = require('firebase-admin/app');
      const adminFirestoreModule = require('firebase-admin/firestore');
      adminApp = adminAppModule;
      adminFirestore = adminFirestoreModule.getFirestore;
    } catch {
      const admin = require('firebase-admin');
      adminApp = {
        initializeApp: admin.initializeApp,
        getApps: () => (admin.apps || []),
        cert: (cred) => cred
      };
      adminFirestore = admin.firestore;
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, 'firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      const app = adminApp.getApps().length === 0
        ? adminApp.initializeApp({ credential: adminApp.cert(serviceAccount) })
        : adminApp.getApps()[0];
      dbInstance = adminFirestore(app);
      console.log('[CloudMirror] Successfully connected to Firebase Admin Firestore.');
      return dbInstance;
    } else {
      console.log(`[CloudMirror] Service account not found at ${serviceAccountPath}. Cloud mirror operating in STANDALONE simulation mode.`);
      return null;
    }
  } catch (err) {
    console.warn('[CloudMirror] Firebase Admin initialization notice:', err.message);
    return null;
  }
}

function runCloudToLocalMirror({ localStore, onRecordUpdated, onConflictDetected }) {
  if (isMirrorRunning) return;
  isMirrorRunning = true;

  const cloudDb = getRemoteCloudDB();

  if (!cloudDb) {
    console.log('[CloudMirror] Running in standalone local edge mode. Will retry cloud connection on demand.');
    return;
  }

  try {
    unsubscribeSnapshot = cloudDb.collection('patients').onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const docId = change.doc.id;
            const incomingData = { ...change.doc.data(), id: docId };

            const existingLocal = localStore.patients.find((p) => p.id === docId);

            // Deterministic Conflict Avoidance Evaluation
            const { mergedRecord, isConflict, conflictReport } = evaluateClinicalDelta({
              localRecord: existingLocal,
              incomingRecord: incomingData,
              baseRecord: existingLocal ? (existingLocal._baseSnapshot || {}) : {}
            });

            if (existingLocal) {
              const idx = localStore.patients.indexOf(existingLocal);
              localStore.patients[idx] = mergedRecord;
            } else {
              localStore.patients.push(mergedRecord);
            }

            if (isConflict && conflictReport) {
              console.warn(`[CloudMirror] Clinical conflict detected on patient ${docId}. Dispatched to verification queue.`);
              if (onConflictDetected) onConflictDetected(conflictReport);
            } else {
              if (onRecordUpdated) onRecordUpdated(mergedRecord);
            }
          }
        });
      },
      (error) => {
        console.warn('Cloud disconnected. Transitioned to internal standalone operations.', error.message);
      }
    );
  } catch (err) {
    console.warn('[CloudMirror] Could not attach Firestore snapshot listener:', err.message);
  }
}

function stopCloudMirror() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  isMirrorRunning = false;
}

module.exports = {
  getRemoteCloudDB,
  runCloudToLocalMirror,
  stopCloudMirror
};
