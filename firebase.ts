// ============================================================
// firebase.ts
// Inizializzazione Firebase — sostituisci i valori con le
// credenziali del tuo progetto (vedi SETUP.md)
// ============================================================

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            "INSERISCI_QUI",
  authDomain:        "INSERISCI_QUI",
  projectId:         "INSERISCI_QUI",
  storageBucket:     "INSERISCI_QUI",
  messagingSenderId: "INSERISCI_QUI",
  appId:             "INSERISCI_QUI",
};

const app     = initializeApp(firebaseConfig);
export const db      = getFirestore(app);   // Firestore → menu, preventivi
export const storage = getStorage(app);     // Storage  → logo
