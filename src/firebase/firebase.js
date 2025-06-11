import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCirmhAPbMtkIIeNkyMz4QY-bJ96GO4T3c",
  authDomain: "chattery-db42f.firebaseapp.com",
  databaseURL: "https://chattery-db42f-default-rtdb.firebaseio.com",
  projectId: "chattery-db42f",
  storageBucket: "chattery-db42f.firebasestorage.app",
  messagingSenderId: "407923394255",
  appId: "1:407923394255:web:630022d2a2d68a0df419ba"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const auth = getAuth(app);
const realtimeDB = getDatabase(app);

export { firestore, auth, realtimeDB };
