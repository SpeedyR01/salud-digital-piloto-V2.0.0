// src/config/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAuf1Embw1YJkskaOW8bo32CmbCv1wbQsk",
  authDomain: "salud-digital-piloto.firebaseapp.com",
  projectId: "salud-digital-piloto",
  storageBucket: "salud-digital-piloto.firebasestorage.app",
  messagingSenderId: "299384504842",
  appId: "1:299384504842:android:afe186..."
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar la base de datos para usarla en tus pantallas
export const db = getFirestore(app);