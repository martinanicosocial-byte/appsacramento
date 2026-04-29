// ============================================================
// useFirebase.ts
// Hook centralizzato per leggere/scrivere tutti i dati su Firebase.
// Sostituisce completamente localStorage.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from './firebase';

// ─── Tipi ────────────────────────────────────────────────────
export interface Category {
  id: string;
  nome: string;
  order: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  nome: string;
  desc: string;
  order: number;
}

// ─── Costanti Firestore ───────────────────────────────────────
// Tutto vive sotto un unico "tenant" (app ad utente singolo).
const TENANT = 'masseria';

const categoriesCol  = () => collection(db, TENANT, 'menu', 'categories');
const menuItemsCol   = () => collection(db, TENANT, 'menu', 'items');
const settingsDoc    = () => doc(db, TENANT, 'settings');

// ─── HOOK: Categorie ─────────────────────────────────────────
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    // Ascolto in real-time: aggiorna automaticamente se cambia da un altro device
    const unsub = onSnapshot(categoriesCol(), (snap) => {
      const data = snap.docs
        .map(d => d.data() as Category)
        .sort((a, b) => a.order - b.order);
      setCategories(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const addCategory = useCallback(async (nome: string) => {
    if (!nome.trim()) return;
    const id    = 'cat_' + Math.random().toString(36).slice(2, 9);
    const order = Date.now();
    await setDoc(doc(categoriesCol(), id), { id, nome, order });
  }, []);

  const updateCategory = useCallback(async (id: string, nome: string) => {
    await setDoc(doc(categoriesCol(), id), { nome }, { merge: true });
  }, []);

  const removeCategory = useCallback(async (id: string, menuItems: MenuItem[]) => {
    if (!window.confirm('Eliminare la categoria e tutti i piatti contenuti?')) return;
    // Batch delete: categoria + tutti i suoi piatti
    const batch = writeBatch(db);
    batch.delete(doc(categoriesCol(), id));
    menuItems
      .filter(item => item.categoryId === id)
      .forEach(item => batch.delete(doc(menuItemsCol(), item.id)));
    await batch.commit();
  }, []);

  return { categories, loading, addCategory, updateCategory, removeCategory };
}

// ─── HOOK: Piatti ────────────────────────────────────────────
export function useMenuItems() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(menuItemsCol(), (snap) => {
      const data = snap.docs
        .map(d => d.data() as MenuItem)
        .sort((a, b) => a.order - b.order);
      setMenuItems(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const addMenuItem = useCallback(async (categoryId: string, nome: string, desc: string) => {
    if (!nome.trim()) return;
    const id    = 'item_' + Math.random().toString(36).slice(2, 9);
    const order = Date.now();
    await setDoc(doc(menuItemsCol(), id), { id, categoryId, nome, desc, order });
  }, []);

  const updateMenuItem = useCallback(async (id: string, updates: Partial<MenuItem>) => {
    await setDoc(doc(menuItemsCol(), id), updates, { merge: true });
  }, []);

  const removeMenuItem = useCallback(async (id: string) => {
    await deleteDoc(doc(menuItemsCol(), id));
  }, []);

  // Inserimento dati iniziali (solo se Firestore è vuoto)
  const seedIfEmpty = useCallback(async (defaultCategories: Omit<Category,'order'>[], defaultItems: Omit<MenuItem,'order'>[]) => {
    const snap = await getDocs(categoriesCol());
    if (!snap.empty) return; // già popolato
    const batch = writeBatch(db);
    defaultCategories.forEach((cat, i) => {
      batch.set(doc(categoriesCol(), cat.id), { ...cat, order: i });
    });
    defaultItems.forEach((item, i) => {
      batch.set(doc(menuItemsCol(), item.id), { ...item, order: i });
    });
    await batch.commit();
  }, []);

  return { menuItems, loading, addMenuItem, updateMenuItem, removeMenuItem, seedIfEmpty };
}

// ─── HOOK: Logo ──────────────────────────────────────────────
// Il logo viene salvato su Firebase Storage come file base64,
// e l'URL pubblico viene memorizzato in Firestore/settings.
export function useLogo(defaultLogo: string) {
  const [logo, setLogo]           = useState<string>(defaultLogo);
  const [uploading, setUploading] = useState(false);

  // Carica l'URL del logo salvato all'avvio
  useEffect(() => {
    getDoc(settingsDoc()).then(snap => {
      const data = snap.data();
      if (data?.logoUrl) setLogo(data.logoUrl);
    });
  }, []);

  // Carica un logo da data-URL (es. dopo fetch da URL esterno)
  const uploadLogo = useCallback(async (dataUrl: string) => {
    setUploading(true);
    try {
      const logoRef = ref(storage, `${TENANT}/logo/logo`);
      // Carica come base64
      const format  = dataUrl.startsWith('data:image/svg') ? 'data_url' : 'data_url';
      await uploadString(logoRef, dataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(logoRef);
      // Salva l'URL in Firestore settings
      await setDoc(settingsDoc(), { logoUrl: downloadUrl }, { merge: true });
      setLogo(downloadUrl);
    } finally {
      setUploading(false);
    }
  }, []);

  const resetLogo = useCallback(async () => {
    if (!window.confirm('Ripristinare il logo predefinito?')) return;
    try {
      await deleteObject(ref(storage, `${TENANT}/logo/logo`));
    } catch (_) { /* ignorato se non esiste */ }
    await setDoc(settingsDoc(), { logoUrl: null }, { merge: true });
    setLogo(defaultLogo);
  }, [defaultLogo]);

  return { logo, uploading, uploadLogo, resetLogo };
}

// ─── HOOK: Preventivi ────────────────────────────────────────
// I preventivi vengono salvati in Firestore con tutti i campi,
// inclusa la lista dei piatti selezionati.
export interface SavedQuotation {
  id: string;
  cliente: string;
  evento: string;
  data: string;
  ospiti: number;
  prezzoPersona: number;
  note: string;
  inclusoBevande: boolean;
  inclusoTorta: boolean;
  inclusoProsecco: boolean;
  selezionati: string[];   // array invece di Set per Firestore
  createdAt: number;
}

const quotationsCol = () => collection(db, TENANT, 'preventivi', 'list');

export function useQuotations() {
  const [quotations, setQuotations] = useState<SavedQuotation[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(quotationsCol(), (snap) => {
      const data = snap.docs
        .map(d => d.data() as SavedQuotation)
        .sort((a, b) => b.createdAt - a.createdAt);
      setQuotations(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const saveQuotation = useCallback(async (q: Omit<SavedQuotation, 'id' | 'createdAt'>) => {
    const id = 'prev_' + Math.random().toString(36).slice(2, 9);
    await setDoc(doc(quotationsCol(), id), {
      ...q,
      id,
      createdAt: Date.now(),
    });
    return id;
  }, []);

  const deleteQuotation = useCallback(async (id: string) => {
    await deleteDoc(doc(quotationsCol(), id));
  }, []);

  return { quotations, loading, saveQuotation, deleteQuotation };
}
