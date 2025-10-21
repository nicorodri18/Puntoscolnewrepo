import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "fake-api-key",
  authDomain: "chat-gpt-e2de9.firebaseapp.com",
  projectId: "chat-gpt-e2de9",
  storageBucket: "chat-gpt-e2de9.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Conexión a emuladores locales (solo en desarrollo)
if (process.env.EXPO_PUBLIC_USE_EMULATORS === 'true' || __DEV__) {
  console.log('⚡ Conectando a emuladores locales...');
  connectAuthEmulator(auth, 'http://127.0.0.1:9100');
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  connectStorageEmulator(storage, '127.0.0.1', 9200);
}

export { app, auth, db, storage };