const admin = require('firebase-admin');

const initializeFirebase = () => {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'demo-hcm-project',
      });
    }
  }
  return admin;
};

const firebaseAdmin = initializeFirebase();
const db = firebaseAdmin.firestore();
const auth = firebaseAdmin.auth();

module.exports = { firebaseAdmin, db, auth };
