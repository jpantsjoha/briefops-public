// firebaseClient.js

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const db = admin.firestore();

module.exports = db;