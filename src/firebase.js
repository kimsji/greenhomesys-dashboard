import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDIs0-RQxjbxWYGxLsyepaZ9ks2wDxxqJU",
  authDomain: "greenhomesys-dashboard.firebaseapp.com",
  projectId: "greenhomesys-dashboard",
  storageBucket: "greenhomesys-dashboard.firebasestorage.app",
  messagingSenderId: "697976870027",
  appId: "1:697976870027:web:57f08f0e84a4159ba7708e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);