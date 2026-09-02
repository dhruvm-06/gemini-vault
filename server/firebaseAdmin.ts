import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const projectId = process.env.PROJECT_ID || 'gemini-vault-507219';

let adminApp: App;

if (!getApps().length) {
  try {
    adminApp = initializeApp({
      projectId,
    });
    console.log(`[Firebase Admin] Initialized for project: ${projectId}`);
  } catch (error) {
    console.error('[Firebase Admin] Initialization warning:', error);
    adminApp = getApp();
  }
} else {
  adminApp = getApp();
}

export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp, 'default');
export default adminApp;
