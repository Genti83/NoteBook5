import { initializeApp, getApps, getApp, onLog } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, disableNetwork, enableNetwork, type Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function createFirestoreDb(): Firestore {
  try {
    const settings =
      typeof window !== 'undefined'
        ? { experimentalForceLongPolling: true, ignoreUndefinedProperties: true }
        : { ignoreUndefinedProperties: true };
    return initializeFirestore(
      app,
      settings,
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreDb();

export const FIRESTORE_QUOTA_COOLDOWN_KEY = 'grid_notepad_firestore_quota_until';
const FIRESTORE_QUOTA_COOLDOWN_MS = 4 * 60 * 60 * 1000;

// Clean up any legacy IndexedDB Firestore mutation queues left over from previous builds
// so stuck offline writes cannot replay and trigger resource-exhausted backoff loops on boot.
try {
  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined' && !localStorage.getItem('grid_notepad_cleared_fs_idb_v2')) {
    localStorage.setItem('grid_notepad_cleared_fs_idb_v2', '1');
    if (typeof indexedDB.databases === 'function') {
      indexedDB.databases()
        .then((dbs) => {
          dbs.forEach((d) => {
            if (d.name && d.name.startsWith('firestore/')) {
              try {
                indexedDB.deleteDatabase(d.name);
              } catch {}
            }
          });
        })
        .catch(() => {});
    }
  }
} catch {}

let networkPaused = false;
let networkTransitionPromise: Promise<void> = Promise.resolve();
const quotaListeners = new Set<() => void>();

export function subscribeFirestoreQuotaTrip(listener: () => void): () => void {
  quotaListeners.add(listener);
  return () => {
    quotaListeners.delete(listener);
  };
}

export function pauseFirestoreNetwork(): Promise<void> {
  if (networkPaused) return networkTransitionPromise;
  networkPaused = true;
  networkTransitionPromise = networkTransitionPromise
    .then(() => disableNetwork(db))
    .catch(() => {});
  return networkTransitionPromise;
}

export function resumeFirestoreNetwork(): Promise<void> {
  if (!networkPaused) return networkTransitionPromise;
  networkPaused = false;
  networkTransitionPromise = networkTransitionPromise
    .then(() => enableNetwork(db))
    .catch(() => {});
  return networkTransitionPromise;
}

// Detect Firestore SDK stream-level resource-exhausted logs immediately because
// PersistentWriteStream treats RESOURCE_EXHAUSTED as transient and never rejects setDoc().
try {
  onLog(
    (logData) => {
      const msg = String(logData?.message || '').toLowerCase();
      if (
        msg.includes('resource-exhausted') ||
        msg.includes('quota limit exceeded') ||
        msg.includes('quota exceeded') ||
        msg.includes('daily write units')
      ) {
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              FIRESTORE_QUOTA_COOLDOWN_KEY,
              String(Date.now() + FIRESTORE_QUOTA_COOLDOWN_MS)
            );
          }
        } catch {}
        pauseFirestoreNetwork();
        quotaListeners.forEach((fn) => {
          try {
            fn();
          } catch {}
        });
      }
    },
    { level: 'warn' }
  );
} catch {}

export const auth = getAuth(app);



