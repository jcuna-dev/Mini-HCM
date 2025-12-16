const admin = require('firebase-admin');

const initializeFirebase = () => {
  if (!admin.apps.length) {
    // In Cloud Functions, credentials are automatically provided
    admin.initializeApp();
  }
  return admin;
};

const firebaseAdmin = initializeFirebase();
const db = firebaseAdmin.firestore();
const auth = firebaseAdmin.auth();

module.exports = { firebaseAdmin, db, auth };
