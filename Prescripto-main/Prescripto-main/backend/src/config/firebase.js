import admin from 'firebase-admin';

let initialized = false;

/**
 * Initialize Firebase Admin using either:
 * - GOOGLE_APPLICATION_CREDENTIALS path to service account JSON, or
 * - FIREBASE_PROJECT_ID (verifies tokens without full Admin SDK; frontend sends ID token).
 * We verify ID tokens from the frontend after Phone OTP sign-in.
 */
export function initFirebase() {
  if (initialized) return admin;
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Initialize without service account; we'll verify tokens using project ID
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    }
    initialized = true;
  } catch (e) {
    console.warn('Firebase Admin init skipped or failed:', e.message);
  }
  return admin;
}

/**
 * Verify Firebase ID token (from frontend after Phone OTP).
 * Returns decoded token with uid, phone_number, etc.
 */
export async function verifyIdToken(idToken) {
  initFirebase();
  if (!idToken) throw new Error('No token provided');
  return admin.auth().verifyIdToken(idToken);
}
