// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// TODO: Replace with your actual Firebase config from Firebase Console
// Go to: https://console.firebase.google.com -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: "AIzaSyBFjNm6XkxPugDXw-JK-YNaAN-ZKW9xUO4",
  authDomain: "studyagentbd.firebaseapp.com",
  projectId: "studyagentbd",
  storageBucket: "studyagentbd.firebasestorage.app",
  messagingSenderId: "418778438880",
  appId: "1:418778438880:web:768df9752a83e95c01c485"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;