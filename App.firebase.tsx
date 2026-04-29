// ============================================================
// App.tsx — versione con Firebase
// Sostituisce localStorage con Firestore + Storage
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Settings, ClipboardList, ImageIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';

import { useCategories, useMenuItems, useLogo, useQuotations } from './useFirebase';

// ─── Tipi locali ─────────────────────────────────────────────
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

// ─── Defaults (usati solo al primo avvio per popolare Firestore) ─
const DEFAULT_CATEGORIES = [
  { id: 'aperitivo',    nome: 'Aperitivo' },
  { id: 'coffe-break',  nome: 'Coffee Break' },
  { id: 'antipasti',    nome: 'Antipasti' },
  { id: 'primi',        nome: 'Primi' },
  { id: 'secondi',      nome: 'Secondi' },
  { id: 'contorni',     nome: 'Contorni' },
  { id: 'dolci',        nome: 'Dolci' },
  { id: 'bevande',      nome: 'Bevande' },
];

const DEFAULT_ITEMS = [
  { id: 'seed1', categoryId: 'antipasti', nome: 'Burrata pugliese con pomodorini', desc: '' },
  { id: 'seed2', categoryId: 'antipasti', nome: 'Tagliere di salumi locali',        desc: '' },
  { id: 'seed3', categoryId: 'primi',     nome: 'Orecchiette con cime di rapa',     desc: '' },
];

const DEFAULT_LOGO = 'data:image/svg+xml;base64,' + btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <circle cx="100" cy="100" r="92" fill="none" stroke="#011d13" stroke-width="2"/>
    <circle cx="100" cy="100" r="86" fill="none" stroke="#b3b18f" stroke-width="0.6"/>
    <text x="100" y="118" text-anchor="middle" font-family="Georgia,serif" font-size="68" font-style="italic" fill="#011d13">MS</text>
    <text x="100" y="148" text-anchor="middle" font-family="Georgia,serif" font-size="9" letter-spacing="3" fill="#b3b18f">MASSERIA</text>
  </svg>`
);

// ─── App ─────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<'quotation' | 'menu'>('quotation');

  // ── Firebase hooks ──
  const { categories, addCategory, updateCategory, removeCategory } = useCategories();
  const { menuItems, addMenuItem, updateMenuItem, removeMenuItem, seedIfEmpty } = useMenuItems();
  const { logo, uploading: logoUploading, uploadLogo, resetLogo } = useLogo(DEFAULT_LOGO);
  const { saveQuotation } = useQuotations();

  // Popola Firestore al primo avvio se vuoto
  useEffect(() => {
    seedIfEmpty(DEFAULT_CATEGORIES, DEFAULT_ITEMS);
  }, [seedIfEmpty]);

  // ── Logo da URL ──
  const [logoUrlInput, setLogoUrlInput] = useState('');

  const handleLoadLogo = async () => {
    const url = logoUrlInput.trim();
    if (!url) { alert('Inserisci un URL valido'); return; }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('http error');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        alert('Il link non punta a un\'immagine valida');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        await uploadLogo(dataUrl);   // → Firebase Storage
        setLogoUrlInput('');
      };
      reader.readAsDataURL(blob);
    } catch {
      alert('Impossibile caricare il logo da questo URL.');
    }
  };

  // ── Stato preventivo (locale, non salvato in tempo reale) ──
  const [quotation, setQuotation] = useState<QuotationData>({
    cliente: '', evento: '', data: '', ospiti: 0, prezzoPersona: 0,
    note: '', inclusoBevande: false, inclusoTorta: false, inclusoProsecco: false,
    selezionati: new Set(),
  });

  const toggleSelection = (id: string) => {
    const next = new Set(quotation.selezionati);
    next.has(id) ? next.delete(id) : next.add(id);
    setQuotation({ ...quotation, selezionati: next });
  };

  // ── PDF + salvataggio preventivo su Firestore ──
  const generatePDF = async () => {
    if (quotation.selezionati.size === 0) {
      if (!window.confirm('Nessun piatto selezionato. Generare comunque il PDF?')) return;
    }

    // Salva il preventivo su Firestore
    await saveQuotation({
      cliente:         quotation.cliente,
      evento:          quotation.evento,
      data:            quotation.data,
      ospiti:          quotation.ospiti,
      prezzoPersona:   quotation.prezzoPersona,
      note:            quotation.note,
      inclusoBevande:  quotation.inclusoBevande,
      inclusoTorta:    quotation.inclusoTorta,
      inclusoProsecco: quotation.inclusoProsecco,
      selezionati:     Array.from(quotation.selezionati),
    });

    // ── Generazione PDF (identica alla versione precedente) ──
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297, margin = 20, cx = pageW / 2;

    const C_DARK:  [number,number,number] = [1,  29,  19];
    const C_GOLD:  [number,number,number] = [179,177, 143];
    const C_PAPER: [number,number,number] = [253,251, 246];
    const C_INK:   [number,number,number] = [38,  42,  36];
    const C_MUTED: [number,number,number] = [120,120, 110];
    const C_CREAM: [number,number,number] = [250,247, 240];

    const drawOrnament = (x: number, y: number, color: [number,number,number]) => {
      doc.setFillColor(...color);
      doc.circle(x, y, 0.5, 'F');
      doc.circle(x - 3.2, y, 0.35, 'F');
      doc.circle(x + 3.2, y, 0.35, 'F');
    };

    doc.setFillColor(...C_PAPER);
    doc.rect(0, 0, pageW, pageH, 'F');

    const headerH = 34;
    doc.setFillColor(...C_DARK);
    doc.rect(0, 0, pageW, headerH, 'F');
    doc.setDrawColor(...C_GOLD); doc.setLineWidth(0.3);
    doc.rect(6, 6, pageW - 12, headerH - 12, 'S');

    try {
      const logoFmt = logo.startsWith('data:image/svg') ? 'SVG' : 'PNG';
      doc.addImage(logo, logoFmt, 16, 9, 16, 16);
    } catch { doc.setDrawColor(...C_GOLD); doc.circle(24, 17, 8, 'S'); }

    doc.setTextColor(...C_GOLD);
    doc.setFont('times', 'bold'); doc.setFontSize(22);
    doc.text('MASSERIA SACRAMENTO', pageW - 16, 18, { align: 'right', charSpace: 1.5 });
    doc.setFont('times', 'italic'); doc.setFontSize(9);
    doc.text('agriturismo', pageW - 16, 24, { align: 'right', charSpace: 1.2 });

    const inclArr = [];
    if (quotation.inclusoBevande)  inclArr.push('Bevande incluse');
    if (quotation.inclusoTorta)    inclArr.push('Torta inclusa');
    if (quotation.inclusoProsecco) inclArr.push('Prosecco incluso');

    let noteLines: string[] = [];
    if (quotation.note) { doc.setFontSize(9.5); noteLines = doc.splitTextToSize(quotation.note, pageW - 2 * margin - 10); }

    const investmentLineY = pageH - 48;
    let bottomBlockHeight = 0;
    if (noteLines.length > 0) bottomBlockHeight += 9 + noteLines.length * 4.5 + 8;
    if (inclArr.length > 0)   bottomBlockHeight += 18;
    if (bottomBlockHeight > 0) bottomBlockHeight += 4;
    const bottomContentStartY = investmentLineY - bottomBlockHeight - 4;

    let y = headerH + 12;
    doc.setFont('times', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...C_GOLD);
    doc.text('— proposta evento —', cx, y, { align: 'center', charSpace: 1.5 });
    y += 10;

    doc.setFont('times', 'bolditalic'); doc.setFontSize(22); doc.setTextColor(...C_INK);
    doc.text((quotation.cliente || 'Gentile Cliente') + (quotation.evento ? ` · ${quotation.evento}` : ''), cx, y, { align: 'center' });
    y += 8;
    drawOrnament(cx, y, C_GOLD); y += 12;

    const colW = (pageW - 2 * margin) / 3;
    doc.setDrawColor(...C_GOLD); doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    doc.line(margin, y + 16, pageW - margin, y + 16);

    const drawDetail = (x: number, label: string, val: string) => {
      doc.setFont('times','italic'); doc.setFontSize(7); doc.setTextColor(...C_GOLD);
      doc.text(label, x, y + 5, { align: 'center', charSpace: 1.2 });
      doc.setFont('times','normal'); doc.setFontSize(11); doc.setTextColor(...C_INK);
      doc.text(val, x, y + 11, { align: 'center' });
    };
    const dataValue = quotation.data
      ? new Date(quotation.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    drawDetail(margin + colW / 2, 'DATA', dataValue);
    drawDetail(cx, 'OSPITI', `${quotation.ospiti}`);
    drawDetail(pageW - margin - colW / 2, 'PREZZO P.P.', quotation.prezzoPersona.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
    y += 24;

    doc.setFont('times','italic'); doc.setFontSize(9); doc.setTextColor(...C_GOLD);
    doc.text('PROPOSTA GASTRONOMICA', cx, y, { align: 'center', charSpace: 2.2 });
    drawOrnament(cx, y + 3, C_GOLD); y += 10;

    const menuToRender: { type: 'cat'|'item'|'desc', text: string }[] = [];
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

    const menuAreaStart = y, menuAreaEnd = bottomContentStartY - 6;
    const menuAreaH = menuAreaEnd - menuAreaStart;
    if (menuToRender.length > 0) {
      const BASE_CAT = 14, BASE_ITEM = 6, BASE_DESC = 4;
      let naturalH = 0;
      menuToRender.forEach(el => { naturalH += el.type==='cat' ? BASE_CAT : el.type==='item' ? BASE_ITEM : BASE_DESC; });
      const spacingFactor = Math.max(0.75, Math.min(2.2, menuAreaH / naturalH));
      let my = menuAreaStart;
      menuToRender.forEach(el => {
        if (el.type === 'cat') {
          my += 4 * spacingFactor;
          doc.setFont('times','italic'); doc.setFontSize(14); doc.setTextColor(...C_INK);
          doc.text(el.text, cx, my, { align: 'center' });
          drawOrnament(cx, my + 2, C_GOLD);
          my += (BASE_CAT - 4) * spacingFactor;
        } else if (el.type === 'item') {
          doc.setFont('times','normal'); doc.setFontSize(10.5); doc.setTextColor(...C_INK);
          doc.text(el.text, cx, my, { align: 'center' });
          my += BASE_ITEM * spacingFactor;
        } else {
          doc.setFont('times','italic'); doc.setFontSize(8.5); doc.setTextColor(...C_MUTED);
          doc.text(el.text, cx, my - 1, { align: 'center' });
          my += BASE_DESC * spacingFactor;
        }
      });
    }

    let by = bottomContentStartY;
    if (inclArr.length > 0) {
      const bW = 52, bH = 10, bGap = 6;
      const totalBW = inclArr.length * bW + (inclArr.length - 1) * bGap;
      let bx = (pageW - totalBW) / 2;
      inclArr.forEach(text => {
        doc.setFillColor(...C_CREAM); doc.setDrawColor(...C_GOLD); doc.setLineWidth(0.2);
        doc.roundedRect(bx, by, bW, bH, 1, 1, 'FD');
        doc.setFontSize(8.5); doc.setFont('times','italic'); doc.setTextColor(...C_INK);
        doc.text(text, bx + bW / 2, by + 6.3, { align: 'center' });
        bx += bW + bGap;
      });
      by += 16;
    }
    if (noteLines.length > 0) {
      doc.setFont('times','italic'); doc.setFontSize(8); doc.setTextColor(...C_GOLD);
      doc.text('NOTE E DETTAGLI', cx, by, { align: 'center', charSpace: 1.5 });
      drawOrnament(cx, by + 3, C_GOLD); by += 9;
      doc.setFontSize(9.5); doc.setTextColor(...C_MUTED);
      doc.text(noteLines, cx, by, { align: 'center' });
    }

    let iy = investmentLineY;
    doc.setDrawColor(...C_GOLD); doc.setLineWidth(0.25);
    doc.line(margin, iy, pageW - margin, iy);
    doc.line(margin, iy + 1.2, pageW - margin, iy + 1.2); iy += 8;
    doc.setFont('times','italic'); doc.setFontSize(8.5); doc.setTextColor(...C_GOLD);
    doc.text('— il vostro investimento —', cx, iy, { align: 'center', charSpace: 1.2 }); iy += 5;
    doc.setFontSize(10); doc.setTextColor(...C_MUTED);
    doc.text(`${quotation.prezzoPersona.toLocaleString('it-IT',{style:'currency',currency:'EUR'})}  ×  ${quotation.ospiti} ospiti`, cx, iy, { align: 'center' }); iy += 12;
    doc.setFont('times','bold'); doc.setFontSize(32); doc.setTextColor(...C_DARK);
    doc.text((quotation.prezzoPersona * quotation.ospiti).toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}), cx, iy, { align: 'center' });

    const pCount = doc.getNumberOfPages();
    for (let i = 1; i <= pCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(...C_GOLD); doc.setLineWidth(0.15);
      doc.line(margin, pageH - 15, pageW - margin, pageH - 15);
      doc.setFontSize(8); doc.setFont('times','italic'); doc.setTextColor(...C_INK);
      doc.text('Masseria Sacramento · C.da Sacramento, Palagianello (TA) · Cel. 328 1433143', cx, pageH - 10, { align: 'center' });
      doc.setFontSize(6.5); doc.setTextColor(...C_MUTED);
      doc.text(`Emesso il ${new Date().toLocaleDateString('it-IT')}`, cx, pageH - 5, { align: 'center' });
      if (pCount > 1) doc.text(`${i} / ${pCount}`, pageW - margin, pageH - 5, { align: 'right' });
    }

    doc.save(`Preventivo_Masseria_Sacramento_${(quotation.cliente||'Cliente').replace(/\s+/g,'_').substring(0,20)}.pdf`);
  };

  // ─── UI ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg font-sans text-ink pb-12">
      <div className="max-w-[1100px] mx-auto px-6 pt-10">

        <header className="flex flex-col md:flex-row justify-between items-center md:items-end pb-8 border-b border-border mb-10 gap-6">
          <div className="brand text-center md:text-left flex flex-col items-center md:items-start">
            <div className="mb-4 w-32 h-32 flex items-center justify-center">
              <img src={logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="editorial-serif text-3xl font-normal tracking-tight -mb-1 text-ink uppercase">Masseria Sacramento</h1>
            <p className="text-[11px] uppercase tracking-[3px] opacity-60 mt-1 font-bold">Agriturismo • Boutique Events</p>

            <div className="mt-4 w-full max-w-md">
              <label className="text-[10px] uppercase tracking-widest font-bold opacity-50 flex items-center gap-1.5 mb-1.5">
                <ImageIcon className="w-3 h-3" /> Logo da URL
              </label>
              <div className="flex gap-2">
                <input type="url" value={logoUrlInput} onChange={e => setLogoUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleLoadLogo(); }}
                  placeholder="https://esempio.com/logo.png"
                  className="editorial-input !py-1.5 flex-1 text-xs" disabled={logoUploading} />
                <button onClick={handleLoadLogo} disabled={logoUploading || !logoUrlInput.trim()}
                  className="bg-accent text-white px-4 text-[10px] uppercase font-bold tracking-widest hover:bg-accent/90 disabled:opacity-40 whitespace-nowrap">
                  {logoUploading ? '...' : 'Carica'}
                </button>
                {logo !== DEFAULT_LOGO && (
                  <button onClick={resetLogo} className="border border-border bg-transparent px-3 text-[10px] uppercase font-bold tracking-widest hover:bg-black/5 whitespace-nowrap">Reset</button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex bg-white/50 p-1.5 border border-border mb-10 max-w-md mx-auto">
          {(['quotation','menu'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] uppercase tracking-wider font-bold transition-all ${activeTab===tab ? 'bg-accent text-white shadow-sm' : 'bg-transparent text-ink/60 hover:text-accent'}`}>
              {tab === 'quotation' ? <><ClipboardList className="w-3.5 h-3.5" />Nuovo Preventivo</> : <><Settings className="w-3.5 h-3.5" />Gestione Menu</>}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'quotation' ? (
            <motion.div key="quotation" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-10 items-start">

              {/* Col 01 */}
              <section>
                <span className="editorial-label">01. Dati Evento</span>
                <div className="space-y-4">
                  {[
                    { label: 'Nominativo Cliente', key: 'cliente', placeholder: 'es. Famiglia De Santis' },
                    { label: 'Tipologia Ricevimento', key: 'evento', placeholder: 'Matrimonio, Battesimo...' },
                  ].map(f => (
                    <div key={f.key} className="form-group">
                      <label className="text-xs opacity-80 block mb-1.5">{f.label}</label>
                      <input type="text" value={(quotation as any)[f.key]}
                        onChange={e => setQuotation({...quotation, [f.key]: e.target.value})}
                        className="editorial-input" placeholder={f.placeholder} />
                    </div>
                  ))}
                  <div className="form-group">
                    <label className="text-xs opacity-80 block mb-1.5">Data dell'Evento</label>
                    <input type="date" value={quotation.data}
                      onChange={e => setQuotation({...quotation, data: e.target.value})}
                      className="editorial-input" />
                  </div>
                  <div className="flex gap-4">
                    <div className="form-group flex-1">
                      <label className="text-xs opacity-80 block mb-1.5">Invitati</label>
                      <input type="number" value={quotation.ospiti||''}
                        onChange={e => setQuotation({...quotation, ospiti: parseInt(e.target.value)||0})}
                        className="editorial-input" />
                    </div>
                    <div className="form-group flex-1">
                      <label className="text-xs opacity-80 block mb-1.5">Prezzo p.p. (€)</label>
                      <input type="number" value={quotation.prezzoPersona||''}
                        onChange={e => setQuotation({...quotation, prezzoPersona: parseFloat(e.target.value)||0})}
                        className="editorial-input" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="text-xs opacity-80 block mb-1.5">Note Particolari</label>
                    <textarea value={quotation.note}
                      onChange={e => setQuotation({...quotation, note: e.target.value})}
                      className="editorial-input min-h-[100px] resize-none" />
                  </div>
                </div>
              </section>

              {/* Col 02 */}
              <section>
                <span className="editorial-label">02. Selezione Menù</span>
                <div className="max-h-[600px] overflow-y-auto pr-4">
                  {categories.map(cat => {
                    const items = menuItems.filter(i => i.categoryId === cat.id);
                    if (!items.length) return null;
                    return (
                      <div key={cat.id} className="mb-8">
                        <h3 className="editorial-serif text-xl border-b border-border pb-1.5 mb-4 text-accent">{cat.nome}</h3>
                        <div className="space-y-1">
                          {items.map(item => (
                            <div key={item.id} onClick={() => toggleSelection(item.id)}
                              className="flex items-center gap-4 py-2 border-b border-border/40 border-dashed cursor-pointer hover:bg-black/[0.02]">
                              <input type="checkbox" checked={quotation.selezionati.has(item.id)} onChange={() => {}}
                                className="w-4 h-4 accent-accent cursor-pointer" />
                              <div className="flex-1">
                                <div className="text-sm font-medium tracking-tight">{item.nome}</div>
                                {item.desc && <div className="text-[11px] opacity-60">{item.desc}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Col 03 */}
              <section>
                <span className="editorial-label">03. Riepilogo</span>
                <div className="bg-white border border-border p-6 shadow-sm">
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm opacity-80"><span>Ospiti</span><span>{quotation.ospiti}</span></div>
                    <div className="flex justify-between text-sm opacity-80"><span>Prezzo pp</span><span>{quotation.prezzoPersona.toLocaleString('it-IT',{style:'currency',currency:'EUR'})}</span></div>
                    <div className="mt-6">
                      <span className="text-[10px] uppercase opacity-40 font-bold block mb-3">Servizi Inclusi</span>
                      <div className="flex flex-wrap gap-2">
                        {[{key:'inclusoBevande',label:'Bevande incluse'},{key:'inclusoTorta',label:'Torta inclusa'},{key:'inclusoProsecco',label:'Prosecco incluso'}].map(inc => (
                          <button key={inc.key}
                            onClick={() => setQuotation({...quotation, [inc.key]: !(quotation as any)[inc.key]})}
                            className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1.5 border transition-all ${(quotation as any)[inc.key] ? 'bg-accent text-white border-accent' : 'bg-transparent border-border text-ink/40'}`}>
                            {inc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="pt-6 border-t-[2.5px] border-ink flex justify-between items-baseline mb-8">
                    <span className="editorial-serif text-lg">Totale Preventivo</span>
                    <span className="editorial-serif text-2xl font-bold">
                      {(quotation.ospiti * quotation.prezzoPersona).toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0})}
                    </span>
                  </div>
                  <button onClick={generatePDF}
                    className="w-full bg-accent text-white py-4 text-[11px] font-bold uppercase tracking-[2px] hover:bg-accent/90 shadow-md active:translate-y-px">
                    Genera Documento PDF
                  </button>
                  <p className="text-[10px] text-center mt-6 opacity-40 leading-relaxed font-medium uppercase tracking-tight">
                    Il presente preventivo ha validità 15 giorni dalla data di emissione. Prezzi IVA inclusa.
                  </p>
                </div>
              </section>
            </motion.div>

          ) : (
            <motion.div key="menu" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="max-w-4xl mx-auto space-y-10 pb-20">

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white border border-border p-8 shadow-sm">
                <div className="flex-1">
                  <h2 className="editorial-serif text-3xl text-ink mb-2">Configurazione Menù</h2>
                  <p className="text-sm opacity-60 italic">Gestisci le sezioni e i piatti del tuo agriturismo.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase font-bold opacity-40">Aggiungi nuova sezione</span>
                  <div className="flex gap-2">
                    <input id="new-cat-input" type="text" placeholder="Nome Sezione..."
                      className="editorial-input !py-1.5 h-10 min-w-[200px]"
                      onKeyDown={e => { if (e.key==='Enter') { addCategory((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value=''; }}} />
                    <button onClick={() => { const el=document.getElementById('new-cat-input') as HTMLInputElement; addCategory(el.value); el.value=''; }}
                      className="bg-accent text-white px-5 text-[10px] uppercase font-bold tracking-widest hover:bg-accent/90 h-10">Crea</button>
                  </div>
                </div>
              </div>

              <div className="space-y-12">
                {categories.map((cat, idx) => {
                  const inSection = menuItems.filter(i => i.categoryId === cat.id);
                  return (
                    <div key={cat.id} className="bg-white border border-border p-8 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-center border-b border-border pb-4 mb-8">
                        <div className="flex items-center gap-4 flex-1">
                          <input type="text" value={cat.nome}
                            onChange={e => updateCategory(cat.id, e.target.value)}
                            className="editorial-serif text-3xl text-ink bg-transparent border-none focus:ring-0 p-0 w-full" />
                          <span className="text-[10px] uppercase tracking-widest font-bold opacity-30 mt-2 shrink-0">{inSection.length} elementi</span>
                        </div>
                        <button onClick={() => removeCategory(cat.id, menuItems)}
                          className="text-[9px] uppercase font-bold text-red-800 bg-red-50/50 hover:bg-red-50 px-4 py-2 border border-red-100 flex items-center gap-2 ml-4">
                          <Trash2 className="w-3.5 h-3.5" /> Elimina
                        </button>
                      </div>

                      <div className="mb-8 bg-accent/[0.02] border border-accent/10 p-6">
                        <h4 className="text-[10px] uppercase font-black tracking-[2px] mb-4 text-accent/60">Aggiungi Piatto</h4>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_auto] gap-4 items-end">
                          <div><label className="text-[10px] font-bold opacity-50 uppercase mb-1.5 block">Nome</label>
                            <input id={`n-${cat.id}`} type="text" placeholder="es. Orecchiette..." className="editorial-input !py-2 bg-white" /></div>
                          <div><label className="text-[10px] font-bold opacity-50 uppercase mb-1.5 block">Descrizione</label>
                            <input id={`d-${cat.id}`} type="text" placeholder="es. Cime di rapa..." className="editorial-input !py-2 bg-white" /></div>
                          <button onClick={() => {
                            const n=document.getElementById(`n-${cat.id}`) as HTMLInputElement;
                            const d=document.getElementById(`d-${cat.id}`) as HTMLInputElement;
                            if (n.value.trim()) { addMenuItem(cat.id, n.value, d.value); n.value=''; d.value=''; }
                          }} className="bg-accent text-white px-8 h-10 text-[10px] uppercase font-bold hover:bg-accent/90">Aggiungi</button>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        {inSection.map(item => (
                          <div key={item.id} className="flex justify-between items-center py-4 border-b border-dashed border-border/10 hover:bg-black/[0.01] group gap-4 px-2 -mx-2">
                            <div className="flex flex-col flex-1">
                              <input type="text" value={item.nome} onChange={e => updateMenuItem(item.id,{nome:e.target.value})}
                                className="text-sm font-bold bg-transparent border-none focus:ring-0 p-1 -ml-1 w-full hover:bg-black/5" placeholder="Nome Piatto" />
                              <input type="text" value={item.desc} onChange={e => updateMenuItem(item.id,{desc:e.target.value})}
                                className="text-[11px] opacity-40 italic bg-transparent border-none focus:ring-0 p-1 -ml-1 w-full hover:bg-black/5" placeholder="Descrizione..." />
                            </div>
                            <button onClick={() => removeMenuItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-2 bg-red-50 text-red-900 border border-red-100 shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {!inSection.length && (
                          <div className="text-center py-10 border border-dashed border-border/60">
                            <p className="text-[11px] opacity-30 italic editorial-serif">Nessun elemento in questa sezione</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
