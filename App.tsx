import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  Settings, 
  ClipboardList,
  ImageIcon
} from 'lucide-react';
import { jsPDF } from 'jspdf';

// --- Types ---
interface Category {
  id: string;
  nome: string;
}

interface MenuItem {
  id: string;
  categoryId: string;
  nome: string;
  desc: string;
}

interface QuotationData {
  cliente: string;
  evento: string;
  data: string;
  ospiti: number;
  prezzoPersona: number;
  note: string;
  inclusoBevande: boolean;
  inclusoTorta: boolean;
  inclusoProsecco: boolean;
  selezionati: Set<string>;
}

// --- Constants ---
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'aperitivo', nome: 'Aperitivo' },
  { id: 'coffe-break', nome: 'Coffee Break' },
  { id: 'antipasti', nome: 'Antipasti' },
  { id: 'primi', nome: 'Primi' },
  { id: 'secondi', nome: 'Secondi' },
  { id: 'contorni', nome: 'Contorni' },
  { id: 'dolci', nome: 'Dolci' },
  { id: 'bevande', nome: 'Bevande' }
];

// Default placeholder logo (elegant monogram MS) — replaced when user uploads
const DEFAULT_LOGO = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="none" stroke="#011d13" stroke-width="2"/><circle cx="100" cy="100" r="86" fill="none" stroke="#b3b18f" stroke-width="0.6"/><text x="100" y="118" text-anchor="middle" font-family="Georgia, serif" font-size="68" font-style="italic" fill="#011d13">MS</text><text x="100" y="148" text-anchor="middle" font-family="Georgia, serif" font-size="9" letter-spacing="3" fill="#b3b18f">MASSERIA</text></svg>`);

const LOGO_COLORS = {
  accent: '#011d13',
  highlight: '#b3b18f'
};

const STORAGE_KEY = 'masseria_data_v1';
const LOGO_STORAGE_KEY = 'masseria_logo_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'quotation' | 'menu'>('quotation');
  
  // Logo State
  const [logo, setLogo] = useState<string>(DEFAULT_LOGO);
  const [logoUrlInput, setLogoUrlInput] = useState<string>('');
  const [logoLoading, setLogoLoading] = useState<boolean>(false);
  
  // Menu State
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // Quotation State
  const [quotation, setQuotation] = useState<QuotationData>({
    cliente: '',
    evento: '',
    data: '',
    ospiti: 0,
    prezzoPersona: 0,
    note: '',
    inclusoBevande: false,
    inclusoTorta: false,
    inclusoProsecco: false,
    selezionati: new Set()
  });

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setCategories(parsed.categories || DEFAULT_CATEGORIES);
      setMenuItems(parsed.menuItems || []);
    } else {
      setCategories(DEFAULT_CATEGORIES);
      setMenuItems([
        { id: '1', categoryId: 'antipasti', nome: 'Burrata pugliese con pomodorini', desc: '' },
        { id: '2', categoryId: 'antipasti', nome: 'Tagliere di salumi locali', desc: '' },
        { id: '3', categoryId: 'primi', nome: 'Orecchiette con cime di rapa', desc: '' },
      ]);
    }
    
    const savedLogo = localStorage.getItem(LOGO_STORAGE_KEY);
    if (savedLogo) setLogo(savedLogo);
  }, []);

  useEffect(() => {
    if (categories.length > 0 || menuItems.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categories, menuItems }));
    }
  }, [categories, menuItems]);

  // --- Logo loading from URL ---
  const handleLoadLogo = async () => {
    const url = logoUrlInput.trim();
    if (!url) {
      alert('Inserisci un URL valido');
      return;
    }
    setLogoLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('http error');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        alert('Il link non punta a un\'immagine valida (deve essere .jpg, .png o .svg)');
        setLogoLoading(false);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setLogo(dataUrl);
        try { 
          localStorage.setItem(LOGO_STORAGE_KEY, dataUrl); 
        } catch(err) {
          alert('Logo caricato ma troppo grande per essere salvato. Si perderà al refresh.');
        }
        setLogoLoading(false);
      };
      reader.onerror = () => {
        alert('Errore durante la lettura dell\'immagine');
        setLogoLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      alert('Impossibile caricare il logo da questo URL. Possibili cause:\n\n• Il link non è diretto a un\'immagine\n• Il sito blocca l\'accesso da browser (CORS)\n• L\'URL non è raggiungibile\n\nProva con un link diretto a un\'immagine (es. immagine caricata su imgur, postimages, ecc.)');
      setLogoLoading(false);
    }
  };

  const resetLogo = () => {
    if (window.confirm('Ripristinare il logo predefinito?')) {
      setLogo(DEFAULT_LOGO);
      setLogoUrlInput('');
      localStorage.removeItem(LOGO_STORAGE_KEY);
    }
  };

  // --- Handlers ---
  const addCategory = (nome: string) => {
    if (!nome.trim()) return;
    const id = 'cat_' + Math.random().toString(36).slice(2, 9);
    setCategories([...categories, { id, nome }]);
  };

  const removeCategory = (id: string) => {
    if (window.confirm('Eliminare la categoria e tutti i piatti contenuti?')) {
      // Remove items belonging to this category from selection
      const itemIdsToRemove = menuItems.filter(item => item.categoryId === id).map(item => item.id);
      const newSelezionati = new Set(quotation.selezionati);
      itemIdsToRemove.forEach(itemId => newSelezionati.delete(itemId));
      setQuotation({ ...quotation, selezionati: newSelezionati });
      
      setCategories(categories.filter(c => c.id !== id));
      setMenuItems(menuItems.filter(item => item.categoryId !== id));
    }
  };

  const addMenuItem = (categoryId: string, nome: string, desc: string) => {
    if (!nome.trim()) return;
    const id = 'item_' + Math.random().toString(36).slice(2, 9);
    setMenuItems([...menuItems, { id, categoryId, nome, desc }]);
  };

  const removeMenuItem = (id: string) => {
    setMenuItems(menuItems.filter(item => item.id !== id));
    const newSelezionati = new Set(quotation.selezionati);
    newSelezionati.delete(id);
    setQuotation({ ...quotation, selezionati: newSelezionati });
  };

  const updateCategory = (id: string, newNome: string) => {
    setCategories(categories.map(c => c.id === id ? { ...c, nome: newNome } : c));
  };

  const updateMenuItem = (id: string, updates: Partial<MenuItem>) => {
    setMenuItems(menuItems.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const toggleSelection = (id: string) => {
    const newSelezionati = new Set(quotation.selezionati);
    if (newSelezionati.has(id)) {
      newSelezionati.delete(id);
    } else {
      newSelezionati.add(id);
    }
    setQuotation({ ...quotation, selezionati: newSelezionati });
  };

  // --- PDF Generation: compact, single-page where possible ---
  const generatePDF = () => {
    if (quotation.selezionati.size === 0) {
      if (!window.confirm('Nessun piatto selezionato. Generare comunque il PDF?')) return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const margin = 20;

    // Color palette (RGB)
    const C_DARK: [number, number, number] = [1, 29, 19];      // #011d13
    const C_GOLD: [number, number, number] = [179, 177, 143]; // #b3b18f
    const C_PAPER: [number, number, number] = [253, 251, 246]; // #fdfbf6
    const C_INK: [number, number, number] = [38, 42, 36];      // #262a24
    const C_MUTED: [number, number, number] = [120, 120, 110];
    const C_CREAM: [number, number, number] = [250, 247, 240];

    const drawOrnament = (cx: number, cy: number, w: number, color: [number, number, number]) => {
      doc.setFillColor(...color);
      // Triple diamond/dot ornament as seen in the sample
      doc.circle(cx, cy, 0.5, 'F');
      doc.circle(cx - 3.2, cy, 0.35, 'F');
      doc.circle(cx + 3.2, cy, 0.35, 'F');
    };

    // ============================================
    // PAGE BACKGROUND
    // ============================================
    doc.setFillColor(...C_PAPER);
    doc.rect(0, 0, pageW, pageH, 'F');

    // ============================================
    // INSTITUTIONAL HEADER (Dark Green Band)
    // ============================================
    const headerH = 34; // Reduced height to match the sleek sample look
    doc.setFillColor(...C_DARK);
    doc.rect(0, 0, pageW, headerH, 'F');
    
    // Internal gold frame
    doc.setDrawColor(...C_GOLD);
    doc.setLineWidth(0.3);
    doc.rect(6, 6, pageW - 12, headerH - 12, 'S');

    // Logo Monogram (Left-aligned in band)
    try {
      const logoFmt = logo.startsWith('data:image/svg') ? 'SVG' : 'PNG';
      doc.addImage(logo, logoFmt, 16, 9, 16, 16);
    } catch (e) {
      doc.setDrawColor(...C_GOLD);
      doc.circle(24, 17, 8, 'S');
    }

    // Brand Name (Right-aligned in band)
    doc.setTextColor(...C_GOLD);
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.text('MASSERIA SACRAMENTO', pageW - 16, 18, { align: 'right', charSpace: 1.5 });
    
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.text('agriturismo', pageW - 16, 24, { align: 'right', charSpace: 1.2 });

    // ============================================
    // CONTENT START
    // ============================================
    let y = headerH + 12;

    // Proposta Evento Title
    doc.setFont('times', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...C_GOLD);
    doc.text('— proposta evento —', pageW / 2, y, { align: 'center', charSpace: 1.5 });
    y += 10;

    // Cliente & Evento (Bold + Italic combined line)
    const clienteText = quotation.cliente || 'Gentile Cliente';
    const eventoText = quotation.evento ? ` · ${quotation.evento}` : '';
    
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(22);
    doc.setTextColor(...C_INK);
    
    // Rendering as a single centered block
    const fullHeader = clienteText + eventoText;
    doc.text(fullHeader, pageW / 2, y, { align: 'center' });
    y += 8;

    drawOrnament(pageW / 2, y, 50, C_GOLD);
    y += 12;

    // ============================================
    // DETAILS GRID (Data, Ospiti, Prezzo)
    // ============================================
    const colW = (pageW - 2 * margin) / 3;
    
    // Horizontal gold hairlines for the grid
    doc.setDrawColor(...C_GOLD);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    doc.line(margin, y + 16, pageW - margin, y + 16);

    const drawDetail = (x: number, label: string, val: string) => {
      doc.setFont('times', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...C_GOLD);
      doc.text(label, x, y + 5, { align: 'center', charSpace: 1.2 });
      doc.setFont('times', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C_INK);
      doc.text(val, x, y + 11, { align: 'center' });
    };

    const dataValue = quotation.data 
      ? new Date(quotation.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';
    
    drawDetail(margin + colW / 2, 'DATA', dataValue);
    drawDetail(pageW / 2, 'OSPITI', `${quotation.ospiti}`);
    drawDetail(pageW - margin - colW / 2, 'PREZZO P.P.', 
      quotation.prezzoPersona.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
    );

    y += 24;

    // ============================================
    // PROPOSTA GASTRONOMICA
    // ============================================
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C_GOLD);
    doc.text('PROPOSTA GASTRONOMICA', pageW / 2, y, { align: 'center', charSpace: 2.2 });
    drawOrnament(pageW / 2, y + 3, 55, C_GOLD);
    y += 10;

    // Menu Item Collection
    const menuToRender: { type: 'cat' | 'item' | 'desc', text: string }[] = [];
    categories.forEach(cat => {
      const items = menuItems.filter(i => i.categoryId === cat.id && quotation.selezionati.has(i.id));
      if (items.length > 0) {
        menuToRender.push({ type: 'cat', text: cat.nome });
        items.forEach(it => {
          menuToRender.push({ type: 'item', text: it.nome });
          if (it.desc) menuToRender.push({ type: 'desc', text: it.desc });
        });
      }
    });

    // Space calculation for menu centering/expansion
    const bottomBlockReserve = 90; // estimated pixels for inclusions + notes + total + footer
    const menuSpaceAvail = pageH - bottomBlockReserve - y;
    let spacingFactor = 1.0;
    const estMenuHeight = menuToRender.length * 6;
    if (estMenuHeight < menuSpaceAvail && menuToRender.length > 0) {
      spacingFactor = Math.min(menuSpaceAvail / estMenuHeight, 1.8);
    }

    menuToRender.forEach((el) => {
      if (y > pageH - 45) { // Basic overflow check
        doc.addPage();
        doc.setFillColor(...C_PAPER);
        doc.rect(0, 0, pageW, pageH, 'F');
        y = 30;
      }

      if (el.type === 'cat') {
        y += 4 * spacingFactor;
        doc.setFont('times', 'italic');
        doc.setFontSize(14);
        doc.setTextColor(...C_INK);
        doc.text(el.text, pageW / 2, y, { align: 'center' });
        drawOrnament(pageW / 2, y + 2, 30, C_GOLD);
        y += 8 * spacingFactor;
      } else if (el.type === 'item') {
        doc.setFont('times', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(...C_INK);
        doc.text(el.text, pageW / 2, y, { align: 'center' });
        y += 6 * spacingFactor;
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(...C_MUTED);
        doc.text(el.text, pageW / 2, y - 2 * spacingFactor, { align: 'center' });
        y += 2 * spacingFactor;
      }
    });

    // ============================================
    // BOTTOM BLOCKS (Anchored fixed positions)
    // ============================================
    y = pageH - 84;

    // Badges / Inclusions row
    const inclArr = [];
    if (quotation.inclusoBevande) inclArr.push('Bevande incluse');
    if (quotation.inclusoTorta) inclArr.push('Torta inclusa');
    if (quotation.inclusoProsecco) inclArr.push('Prosecco incluso');

    if (inclArr.length > 0) {
      const bW = 52;
      const bH = 10;
      const bGap = 6;
      const totalBW = inclArr.length * bW + (inclArr.length - 1) * bGap;
      let bx = (pageW - totalBW) / 2;
      
      inclArr.forEach(text => {
        doc.setFillColor(...C_CREAM);
        doc.setDrawColor(...C_GOLD);
        doc.setLineWidth(0.2);
        doc.roundedRect(bx, y, bW, bH, 1, 1, 'FD');
        doc.setFontSize(8.5);
        doc.setFont('times', 'italic');
        doc.setTextColor(...C_INK);
        doc.text(text, bx + bW / 2, y + 6.3, { align: 'center' });
        bx += bW + bGap;
      });
      y += 18;
    }

    // Notes Section
    if (quotation.note) {
      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...C_GOLD);
      doc.text('NOTE E DETTAGLI', pageW / 2, y, { align: 'center', charSpace: 1.5 });
      drawOrnament(pageW / 2, y + 3, 35, C_GOLD);
      
      y += 9;
      doc.setFontSize(9.5);
      doc.setTextColor(...C_MUTED);
      const noteLines = doc.splitTextToSize(quotation.note, pageW - 2 * margin - 10);
      doc.text(noteLines, pageW / 2, y, { align: 'center' });
    }

    // ============================================
    // FINAL INVESTMENT SUMMARY
    // ============================================
    y = pageH - 45;
    
    // Double Border
    doc.setDrawColor(...C_GOLD);
    doc.setLineWidth(0.25);
    doc.line(margin, y, pageW - margin, y);
    doc.line(margin, y + 1.2, pageW - margin, y + 1.2);
    
    y += 8;
    doc.setFont('times', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...C_GOLD);
    doc.text('— il vostro investimento —', pageW / 2, y, { align: 'center', charSpace: 1.2 });
    
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(...C_MUTED);
    const totalCalc = `${quotation.prezzoPersona.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}  ×  ${quotation.ospiti} ospiti`;
    doc.text(totalCalc, pageW / 2, y, { align: 'center' });
    
    y += 12;
    const totalVal = quotation.prezzoPersona * quotation.ospiti;
    doc.setFont('times', 'bold');
    doc.setFontSize(32);
    doc.setTextColor(...C_DARK);
    doc.text(totalVal.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), pageW / 2, y, { align: 'center' });

    // ============================================
    // SHARED FOOTER
    // ============================================
    const pCount = doc.getNumberOfPages();
    for (let i = 1; i <= pCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...C_GOLD);
        doc.setLineWidth(0.15);
        doc.line(margin, pageH - 15, pageW - margin, pageH - 15);
        
        doc.setFontSize(8);
        doc.setFont('times', 'italic');
        doc.setTextColor(...C_INK);
        doc.text('Masseria Sacramento · C.da Sacramento, Palagianello (TA) · Cel. 328 1433143', pageW / 2, pageH - 10, { align: 'center' });
        
        doc.setFontSize(6.5);
        doc.setTextColor(...C_MUTED);
        const emission = `Emesso il ${new Date().toLocaleDateString('it-IT')}`;
        doc.text(emission, pageW / 2, pageH - 5, { align: 'center' });
        
        if (pCount > 1) {
            doc.text(`${i} / ${pCount}`, pageW - margin, pageH - 5, { align: 'right' });
        }
    }

    const safeFilename = (quotation.cliente || 'Cliente').replace(/\s+/g, '_').substring(0, 20);
    doc.save(`Preventivo_Masseria_Sacramento_${safeFilename}.pdf`);
  };

  return (
    <div className="min-h-screen bg-bg font-sans text-ink pb-12">
      <div className="max-w-[1100px] mx-auto px-6 pt-10">
        
        {/* Editorial Header */}
        <header className="flex flex-col md:flex-row justify-between items-center md:items-end pb-8 border-b border-border mb-10 gap-6">
          <div className="brand text-center md:text-left flex flex-col items-center md:items-start">
            <div className="mb-4 w-32 h-32 flex items-center justify-center">
               <img src={logo} alt="Masseria Sacramento Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="editorial-serif text-3xl font-normal tracking-tight -mb-1 text-ink uppercase">
              Masseria Sacramento
            </h1>
            <p className="text-[11px] uppercase tracking-[3px] opacity-60 mt-1 font-bold">
               Agriturismo • Boutique Events
            </p>
            
            {/* URL logo loader */}
            <div className="mt-4 w-full max-w-md">
              <label className="text-[10px] uppercase tracking-widest font-bold opacity-50 flex items-center gap-1.5 mb-1.5">
                <ImageIcon className="w-3 h-3" /> Logo da URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={logoUrlInput}
                  onChange={e => setLogoUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleLoadLogo(); }}
                  placeholder="https://esempio.com/logo.png"
                  className="editorial-input !py-1.5 flex-1 text-xs"
                  disabled={logoLoading}
                />
                <button
                  type="button"
                  onClick={handleLoadLogo}
                  disabled={logoLoading || !logoUrlInput.trim()}
                  className="bg-accent text-white px-4 text-[10px] uppercase font-bold tracking-widest hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {logoLoading ? '...' : 'Carica'}
                </button>
                {logo !== DEFAULT_LOGO && (
                  <button
                    type="button"
                    onClick={resetLogo}
                    className="border border-border bg-transparent px-3 text-[10px] uppercase font-bold tracking-widest hover:bg-black/5 whitespace-nowrap"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[10px] opacity-50 block uppercase tracking-[2px] mb-1 font-black">ESTABLISHED QUALITY</span>
            <span className="text-sm font-medium opacity-80 italic editorial-serif">Locorotondo - Puglia</span>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex bg-white/50 p-1.5 rounded-none border border-border mb-10 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('quotation')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-none text-[11px] uppercase tracking-wider font-bold transition-all ${
              activeTab === 'quotation' 
                ? 'bg-accent text-white shadow-sm' 
                : 'bg-transparent text-ink/60 hover:text-accent'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Nuovo Preventivo
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-none text-[11px] uppercase tracking-wider font-bold transition-all ${
              activeTab === 'menu' 
                ? 'bg-accent text-white shadow-sm' 
                : 'bg-transparent text-ink/60 hover:text-accent'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Gestione Menu
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'quotation' ? (
            <motion.div
              key="quotation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-10 items-start"
            >
              {/* Column 01: Event Data */}
              <section className="space-y-6">
                <div>
                  <span className="editorial-label">01. Dati Evento</span>
                  <div className="space-y-4">
                    <div className="form-group">
                      <label className="text-xs opacity-80 block mb-1.5">Nominativo Cliente</label>
                      <input 
                        type="text" 
                        value={quotation.cliente}
                        onChange={e => setQuotation({...quotation, cliente: e.target.value})}
                        className="editorial-input"
                        placeholder="es. Famiglia De Santis"
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-xs opacity-80 block mb-1.5">Tipologia Ricevimento</label>
                      <input 
                        type="text" 
                        value={quotation.evento}
                        onChange={e => setQuotation({...quotation, evento: e.target.value})}
                        className="editorial-input"
                        placeholder="Matrimonio, Battesimo..."
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-xs opacity-80 block mb-1.5">Data dell'Evento</label>
                      <input 
                        type="date" 
                        value={quotation.data}
                        onChange={e => setQuotation({...quotation, data: e.target.value})}
                        className="editorial-input"
                      />
                    </div>
                    <div className="form-row flex gap-4">
                      <div className="form-group flex-1">
                        <label className="text-xs opacity-80 block mb-1.5">Invitati</label>
                        <input 
                          type="number" 
                          value={quotation.ospiti || ''}
                          onChange={e => setQuotation({...quotation, ospiti: parseInt(e.target.value) || 0})}
                          className="editorial-input"
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label className="text-xs opacity-80 block mb-1.5">Prezzo p.p. (€)</label>
                        <input 
                          type="number" 
                          value={quotation.prezzoPersona || ''}
                          onChange={e => setQuotation({...quotation, prezzoPersona: parseFloat(e.target.value) || 0})}
                          className="editorial-input"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="text-xs opacity-80 block mb-1.5">Note Particolari</label>
                      <textarea
                        value={quotation.note}
                        onChange={e => setQuotation({...quotation, note: e.target.value})}
                        className="editorial-input min-h-[100px] resize-none"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Column 02: Menu Selection */}
              <section>
                <span className="editorial-label">02. Selezione Menù</span>
                <div className="max-h-[600px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-border">
                  {categories.map(cat => {
                    const items = menuItems.filter(item => item.categoryId === cat.id);
                    if (items.length === 0) return null;
                    return (
                      <div key={cat.id} className="mb-8">
                        <h3 className="editorial-serif text-xl border-b border-border pb-1.5 mb-4 text-accent">
                          {cat.nome}
                        </h3>
                        <div className="space-y-1">
                          {items.map(item => (
                            <div 
                              key={item.id} 
                              onClick={() => toggleSelection(item.id)}
                              className="flex items-center gap-4 py-2 border-b border-border/40 border-dashed cursor-pointer hover:bg-black/[0.02] transition-colors"
                            >
                              <input 
                                type="checkbox" 
                                checked={quotation.selezionati.has(item.id)}
                                onChange={() => {}} // Controlled by div click
                                className="w-4 h-4 accent-accent cursor-pointer rounded-none border-border"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium tracking-tight">{item.nome}</div>
                                {item.desc && <div className="text-[11px] opacity-60 leading-tight">{item.desc}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {menuItems.length === 0 && (
                    <div className="text-center py-12 opacity-40 editorial-serif">
                      Nessun piatto configurato nel menù.
                    </div>
                  )}
                </div>
              </section>

              {/* Column 03: Summary */}
              <section>
                <span className="editorial-label">03. Riepilogo</span>
                <div className="bg-white border border-border p-6 shadow-sm">
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm opacity-80">
                      <span>Ospiti</span>
                      <span>{quotation.ospiti}</span>
                    </div>
                    <div className="flex justify-between text-sm opacity-80">
                      <span>Prezzo pp</span>
                      <span>{quotation.prezzoPersona.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                    </div>

                    <div className="mt-6">
                      <span className="text-[10px] uppercase opacity-40 font-bold block mb-3">Servizi Inclusi</span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'inclusoBevande', label: 'Bevande incluse' },
                          { key: 'inclusoTorta', label: 'Torta inclusa' },
                          { key: 'inclusoProsecco', label: 'Prosecco incluso' }
                        ].map(inc => (
                          <button
                            key={inc.key}
                            onClick={() => setQuotation({ ...quotation, [inc.key]: !quotation[inc.key as keyof QuotationData] })}
                            className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1.5 border transition-all ${
                              quotation[inc.key as keyof QuotationData]
                                ? 'bg-accent text-white border-accent'
                                : 'bg-transparent border-border text-ink/40'
                            }`}
                          >
                            {inc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t-[2.5px] border-ink flex justify-between items-baseline mb-8">
                    <span className="editorial-serif text-lg">Totale Preventivo</span>
                    <span className="editorial-serif text-2xl font-bold">
                      {(quotation.ospiti * quotation.prezzoPersona).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <button
                    onClick={generatePDF}
                    className="w-full bg-accent text-white py-4 text-[11px] font-bold uppercase tracking-[2px] transition-all hover:bg-accent/90 shadow-md active:translate-y-px"
                  >
                    Genera Documento PDF
                  </button>

                  <p className="text-[10px] text-center mt-6 opacity-40 leading-relaxed font-medium uppercase tracking-tight">
                    Il presente preventivo ha validità 15 giorni dalla data di emissione. Prezzi IVA inclusa.
                  </p>
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-10 pb-20"
            >
              {/* Menu Management Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white border border-border p-8 shadow-sm">
                <div className="flex-1">
                  <h2 className="editorial-serif text-3xl text-ink mb-2">Configurazione Menù</h2>
                  <p className="text-sm opacity-60 italic">
                    Gestisci le sezioni istituzionali e i piatti del tuo agriturismo.
                  </p>
                </div>
                <div className="w-full md:w-auto">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-bold opacity-40">Aggiungi nuova sezione</span>
                    <div className="flex gap-2">
                      <input
                        id="new-cat-input-top"
                        type="text"
                        placeholder="Nome Sezione..."
                        className="editorial-input !py-1.5 h-10 min-w-[200px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addCategory((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('new-cat-input-top') as HTMLInputElement;
                          addCategory(input.value);
                          input.value = '';
                        }}
                        className="bg-accent text-white px-5 text-[10px] uppercase font-bold tracking-widest hover:bg-accent/90 h-10 transition-colors"
                      >
                        Crea
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sections List */}
              <div className="space-y-12">
                {categories.map((cat, idx) => {
                  const itemsInSection = menuItems.filter(i => i.categoryId === cat.id);
                  return (
                    <div key={cat.id} className="relative">
                      {/* Section Counter */}
                      <div className="absolute -left-4 md:-left-8 top-0 text-[40px] font-bold opacity-[0.03] editorial-serif pointer-events-none">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      
                      <div className="bg-white border border-border p-8 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center border-b border-border pb-4 mb-8">
                          <div className="flex items-center gap-4 flex-1">
                            <input
                              type="text"
                              value={cat.nome}
                              onChange={(e) => updateCategory(cat.id, e.target.value)}
                              className="editorial-serif text-3xl text-ink bg-transparent border-none focus:ring-0 p-0 w-full hover:bg-black/5 focus:bg-white transition-colors cursor-text h-auto line-height-tight"
                              placeholder="Nome Sezione..."
                            />
                            <span className="text-[10px] uppercase tracking-widest font-bold opacity-30 mt-2 shrink-0">
                              {itemsInSection.length} elementi
                            </span>
                          </div>
                          <button
                            onClick={() => removeCategory(cat.id)}
                            className="text-[9px] uppercase font-bold tracking-widest text-red-800 bg-red-50/50 hover:bg-red-50 px-4 py-2 border border-red-100 transition-all flex items-center gap-2 group ml-4"
                          >
                            <Trash2 className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                            Elimina Sezione
                          </button>
                        </div>

                        {/* Add Item Form inside Section */}
                        <div className="mb-10 bg-accent/[0.02] border border-accent/10 p-6">
                          <h4 className="text-[10px] uppercase font-black tracking-[2px] mb-4 text-accent/60">Aggiungi Piatto a {cat.nome}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_auto] gap-4 items-end">
                            <div className="form-group">
                              <label className="text-[10px] font-bold opacity-50 uppercase mb-1.5 block">Nome Piatto</label>
                              <input
                                id={`item-name-${cat.id}`}
                                type="text"
                                placeholder="es. Orecchiette..."
                                className="editorial-input !py-2 bg-white"
                              />
                            </div>
                            <div className="form-group">
                              <label className="text-[10px] font-bold opacity-50 uppercase mb-1.5 block">Descrizione / Ingredienti</label>
                              <input
                                id={`item-desc-${cat.id}`}
                                type="text"
                                placeholder="es. Cime di rapa, acciughe..."
                                className="editorial-input !py-2 bg-white"
                              />
                            </div>
                            <button
                              onClick={() => {
                                const nameEl = document.getElementById(`item-name-${cat.id}`) as HTMLInputElement;
                                const descEl = document.getElementById(`item-desc-${cat.id}`) as HTMLInputElement;
                                if (nameEl.value.trim()) {
                                  addMenuItem(cat.id, nameEl.value, descEl.value);
                                  nameEl.value = '';
                                  descEl.value = '';
                                }
                              }}
                              className="bg-accent text-white px-8 h-10 text-[10px] uppercase font-bold tracking-widest hover:bg-accent/90 shadow-sm transition-all"
                            >
                              Aggiungi
                            </button>
                          </div>
                        </div>

                        {/* Items List */}
                        <div className="space-y-0.5">
                          {itemsInSection.map(item => (
                            <div key={item.id} className="flex justify-between items-center py-4 border-b border-border/10 border-dashed hover:bg-black/[0.01] px-2 -mx-2 transition-colors group gap-4">
                              <div className="flex flex-col flex-1">
                                <input
                                  type="text"
                                  value={item.nome}
                                  onChange={(e) => updateMenuItem(item.id, { nome: e.target.value })}
                                  className="text-sm font-bold text-ink/90 tracking-tight bg-transparent border-none focus:ring-0 p-1 -ml-1 w-full hover:bg-black/5 focus:bg-white transition-colors"
                                  placeholder="Nome Piatto"
                                />
                                <input
                                  type="text"
                                  value={item.desc}
                                  onChange={(e) => updateMenuItem(item.id, { desc: e.target.value })}
                                  className="text-[11px] opacity-40 italic mt-0.5 bg-transparent border-none focus:ring-0 p-1 -ml-1 w-full hover:bg-black/5 focus:bg-white transition-colors"
                                  placeholder="Aggiungi descrizione..."
                                />
                              </div>
                              <button
                                onClick={() => removeMenuItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 transition-all p-2 bg-red-50 text-red-900 rounded-none border border-red-100 shrink-0"
                                title="Elimina piatto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {itemsInSection.length === 0 && (
                            <div className="text-center py-10 border border-dashed border-border/60">
                              <p className="text-[11px] opacity-30 italic editorial-serif">Nessun elemento configurato in questa sezione</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {categories.length === 0 && (
                <div className="bg-white border border-border p-20 text-center">
                  <p className="editorial-serif text-xl opacity-40 mb-6">Nessuna sezione presente nel menù.</p>
                  <button 
                    onClick={() => setCategories(DEFAULT_CATEGORIES)}
                    className="text-[10px] uppercase font-bold tracking-[3px] text-accent border border-accent px-6 py-3 hover:bg-accent hover:text-white transition-all"
                  >
                    Ripristina Sezioni Predefinite
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
