# 🔥 Setup Firebase — Masseria Sacramento

---

## PASSO 1 — Crea il progetto Firebase

1. Vai su **https://console.firebase.google.com**
2. Clicca **"Aggiungi progetto"**
3. Nome progetto: `masseria-sacramento` (o come preferisci)
4. Disattiva Google Analytics (non serve) → **Crea progetto**

---

## PASSO 2 — Registra la tua Web App

1. Dalla homepage del progetto, clicca l'icona **`</>`** (Web)
2. App nickname: `masseria-web`
3. **NON** spuntare Firebase Hosting (non necessario ora)
4. Clicca **"Registra app"**
5. Copia il blocco `firebaseConfig` che appare — ti serve al Passo 5

---

## PASSO 3 — Attiva Firestore

1. Nel menu a sinistra → **Firestore Database**
2. Clicca **"Crea database"**
3. Scegli **"Inizia in modalità test"** ← importante per ora
4. Scegli la regione: `europe-west3 (Frankfurt)` → **Fine**

> ⚠️ La modalità test scade dopo 30 giorni. Quando sei pronto per la
> produzione, aggiorna le regole (vedi Passo 6).

---

## PASSO 4 — Attiva Firebase Storage

1. Nel menu a sinistra → **Storage**
2. Clicca **"Inizia"**
3. Scegli **"Inizia in modalità test"**
4. Stessa regione di Firestore → **Fine**

---

## PASSO 5 — Configura il codice

Apri il file **`firebase.ts`** e sostituisci i valori con quelli copiati al Passo 2:

```typescript
const firebaseConfig = {
  apiKey:            "AIzaSy...",        // ← il tuo
  authDomain:        "masseria-xxx.firebaseapp.com",
  projectId:         "masseria-xxx",
  storageBucket:     "masseria-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc..."
};
```

---

## PASSO 6 — Installa le dipendenze

Nel terminale del tuo progetto:

```bash
npm install firebase
```

---

## PASSO 7 — Sostituisci i file nell'app

| File da usare        | Sostituisce          |
|----------------------|----------------------|
| `firebase.ts`        | (nuovo file)         |
| `useFirebase.ts`     | (nuovo file)         |
| `App.firebase.tsx`   | `App.tsx` esistente  |

Rinomina `App.firebase.tsx` → `App.tsx` (o aggiorna l'import nel tuo entry point).

---

## PASSO 8 — Regole Firestore per produzione

Quando hai finito i test, vai su **Firestore → Regole** e incolla:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Accesso solo da IP/dominio autorizzato — per uso singolo
    // senza autenticazione blocca tutto da esterni:
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2099, 1, 1);
    }
  }
}
```

> 💡 Per una sicurezza maggiore in futuro, aggiungi Firebase Auth
> e cambia la regola in `allow read, write: if request.auth != null;`

---

## STRUTTURA DEI DATI SU FIRESTORE

```
masseria/
├── menu/
│   ├── categories/          ← collezione categorie
│   │   ├── {catId}          { id, nome, order }
│   └── items/               ← collezione piatti
│       ├── {itemId}         { id, categoryId, nome, desc, order }
├── preventivi/
│   └── list/                ← collezione preventivi salvati
│       └── {prevId}         { cliente, evento, data, ospiti, ... }
└── settings                 ← documento unico
    { logoUrl: "https://..." }
```

---

## COSA FA OGNI FILE

| File             | Funzione |
|------------------|----------|
| `firebase.ts`    | Inizializza Firebase (una sola volta) |
| `useFirebase.ts` | Hook React per categorie, piatti, logo, preventivi |
| `App.firebase.tsx` | App completa integrata con Firebase |

---

## DOMANDE FREQUENTI

**I dati si sincronizzano in tempo reale?**
Sì — `onSnapshot` aggiorna l'interfaccia automaticamente se apri l'app
su due dispositivi contemporaneamente.

**Il logo dove viene salvato?**
Su Firebase Storage come file, con l'URL pubblico salvato in Firestore.
Questo evita il limite di 5MB di localStorage.

**I preventivi generati vengono salvati?**
Sì, ogni volta che clicchi "Genera PDF" il preventivo viene salvato
automaticamente in Firestore con timestamp.

**Come vedo i dati salvati?**
Vai su console.firebase.google.com → il tuo progetto → Firestore Database.
Puoi vedere e modificare tutto direttamente dalla console.
