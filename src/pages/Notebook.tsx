import { useEffect, useMemo, useRef, useState } from 'react';
import { useTrading } from '@/contexts/TradingContext';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, BookOpen, Edit, Check, TrendingUp, TrendingDown, Minus, FileText, ImageIcon, ArrowLeft, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadUserStorage, saveUserStorage } from '@/lib/userStorage';
import { AIInsightsPanel } from '@/components/shared/AIInsightsPanel';
import { adaptNotebook } from '@/lib/aiInsightAdapters';
import { RichJournalBlock, type RichJournalValue } from '@/components/shared/RichJournalBlock';
import { coerceRichJournal, emptyJournal, serializeJournal, journalPlainText } from '@/lib/journalData';
import { refreshSignedUrls } from '@/lib/journalUpload';
import { useAICoach } from '@/contexts/AICoachContext';
import { saveDraft as saveLocalDraft, loadDraft as loadLocalDraft, clearDraft as clearLocalDraft } from '@/lib/draftStorage';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface NotebookEntry {
  id: string;
  date: string;
  pair: string;
  category: string;
  bias: string;
  /** Legacy fields kept for back-compat with old saved entries. */
  keyLevels?: string;
  notes?: string;
  image?: string;
  /** New unified Notion-style journal value. */
  journal?: RichJournalValue;
  createdAt: string;
}

const STORAGE_KEY = 'ef_notebook_entries';
const BIAS_OPTIONS = ['Bullish', 'Bearish', 'Sideways', 'Neutral'] as const;

const todayISO = () => new Date().toISOString().split('T')[0];

const emptyForm = (): NotebookEntry => ({
  id: '',
  date: todayISO(),
  pair: '',
  category: '',
  bias: '',
  journal: emptyJournal(),
  createdAt: '',
});

export default function Notebook() {
  const { user } = useAuth();
  const { notebookCategories } = useTrading();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<NotebookEntry>(emptyForm());
  const [isEditing, setIsEditing] = useState(false);
  const { setNote: setAINote } = useAICoach();

  // Track which entry ids we've already broadcast so realtime echoes don't
  // trigger redundant renders while still catching writes from other clients.
  const localEchoRef = useRef<Set<string>>(new Set());

  const rowToEntry = (row: any): NotebookEntry => ({
    id: row.entry_id,
    date: row.date || '',
    pair: row.pair || '',
    category: row.category || '',
    bias: row.bias || '',
    journal: (row.journal && typeof row.journal === 'object')
      ? { text: row.journal.text || '', media: Array.isArray(row.journal.media) ? row.journal.media : [] }
      : emptyJournal(),
    notes: row.legacy_notes ?? undefined,
    keyLevels: row.legacy_key_levels ?? undefined,
    image: row.legacy_image ?? undefined,
    createdAt: row.created_at || new Date().toISOString(),
  });

  const upsertToDb = async (entry: NotebookEntry) => {
    if (!user) return;
    localEchoRef.current.add(entry.id);
    const payload: any = {
      user_id: user.id,
      entry_id: entry.id,
      date: entry.date,
      pair: entry.pair,
      category: entry.category,
      bias: entry.bias,
      journal: entry.journal || emptyJournal(),
      legacy_notes: entry.notes ?? null,
      legacy_key_levels: entry.keyLevels ?? null,
      legacy_image: entry.image ?? null,
    };
    const { error } = await supabase
      .from('notebook_entries')
      .upsert(payload, { onConflict: 'user_id,entry_id' });
    if (error) console.warn('[Notebook] upsert failed', error.message);
  };

  const deleteFromDb = async (entryId: string) => {
    if (!user) return;
    localEchoRef.current.add(entryId);
    await supabase.from('notebook_entries').delete().eq('user_id', user.id).eq('entry_id', entryId);
  };

  useEffect(() => {
    if (!user) { setEntries([]); return; }

    // Seed from local cache immediately so the UI has data before the network round-trip.
    const local = loadUserStorage<NotebookEntry[]>(STORAGE_KEY, user.id, []);
    setEntries(local);

    let cancelled = false;

    // Load canonical rows from DB and merge with local (DB wins per entry_id).
    (async () => {
      const { data: rows, error } = await supabase
        .from('notebook_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.warn('[Notebook] DB load failed, using local only', error.message);
      } else {
        const dbEntries = (rows || []).map(rowToEntry);
        const dbIds = new Set(dbEntries.map(e => e.id));
        // First-run migration: push local-only entries up to DB so both clients converge.
        const localOnly = local.filter(e => !dbIds.has(e.id));
        for (const e of localOnly) upsertToDb(e).catch(() => { /* best-effort */ });
        const merged = [...dbEntries, ...localOnly];
        setEntries(merged);
        saveUserStorage(STORAGE_KEY, user.id, merged);

        // Re-sign expired Supabase Storage URLs so historical thumbnails render.
        const refreshed = await Promise.all(merged.map(async (e) => {
          const j = coerceRichJournal(e.journal, e.notes, e.image);
          const needsRefresh = j.media.some(m => m.path || (m.url && /\/storage\/v1\/object\//.test(m.url)));
          if (!needsRefresh) return e;
          try {
            const media = await refreshSignedUrls(j.media);
            return { ...e, journal: { text: j.text, media } };
          } catch { return e; }
        }));
        if (!cancelled) {
          setEntries(refreshed);
          saveUserStorage(STORAGE_KEY, user.id, refreshed);
        }
      }
    })();

    // Live cross-device sync via the shared RealtimeSyncProvider event bus.
    const onRealtime = (ev: Event) => {
      const { table, event, new: newRow, old: oldRow } = (ev as CustomEvent).detail || {};
      if (table !== 'notebook_entries') return;
      const row = newRow || oldRow;
      if (!row) return;
      // Ignore our own echoes.
      if (row.entry_id && localEchoRef.current.has(row.entry_id)) {
        localEchoRef.current.delete(row.entry_id);
        return;
      }
      setEntries(prev => {
        let next: NotebookEntry[];
        if (event === 'DELETE') {
          next = prev.filter(e => e.id !== row.entry_id);
        } else {
          const mapped = rowToEntry(newRow);
          const idx = prev.findIndex(e => e.id === mapped.id);
          next = idx >= 0
            ? prev.map((e, i) => i === idx ? mapped : e)
            : [mapped, ...prev];
        }
        if (user) saveUserStorage(STORAGE_KEY, user.id, next);
        return next;
      });
    };
    window.addEventListener('mj:realtime', onRealtime);

    return () => {
      cancelled = true;
      window.removeEventListener('mj:realtime', onRealtime);
    };
  }, [user]);

  // Register the open notebook entry as AI Coach context
  useEffect(() => {
    if (editorOpen && (draft.pair || draft.category)) {
      const text = journalPlainText(coerceRichJournal(draft.journal, draft.notes, draft.image));
      const lbl = `Note • ${draft.pair || 'Untitled'} • ${draft.category || 'no category'} • ${draft.date}`;
      const detail = `Open notebook entry:
- Pair: ${draft.pair || 'n/a'}
- Category: ${draft.category || 'n/a'}
- Bias: ${draft.bias || 'n/a'}
- Date: ${draft.date}
- Research notes: ${text.slice(0, 1500)}`;
      setAINote({ label: lbl, detail });
    } else if (!editorOpen) {
      setAINote(null);
    }
    return () => { setAINote(null); };
  }, [editorOpen, draft, setAINote]);

  const persist = (updated: NotebookEntry[]) => {
    setEntries(updated);
    if (user) saveUserStorage(STORAGE_KEY, user.id, updated);
  };

  const DRAFT_SCOPE = 'notebook-new';

  const openNew = () => {
    let initial = emptyForm();
    if (user) {
      const saved = loadLocalDraft<NotebookEntry>(DRAFT_SCOPE, user.id);
      if (saved?.data && (saved.data.pair || saved.data.category || journalPlainText(saved.data.journal))) {
        initial = saved.data;
        toast({ title: 'Draft restored', description: 'We recovered your unsaved notebook draft.' });
      }
    }
    setDraft(initial);
    setIsEditing(false);
    setEditorOpen(true);
  };

  const openEdit = (entry: NotebookEntry) => {
    setDraft({
      ...entry,
      journal: coerceRichJournal(entry.journal, entry.notes, entry.image),
    });
    setIsEditing(true);
    setEditorOpen(true);
  };

  // Auto-persist new-entry drafts to localStorage so refresh/crash never loses work.
  useEffect(() => {
    if (!editorOpen || isEditing || !user) return;
    const hasContent = draft.pair || draft.category || draft.bias || journalPlainText(draft.journal);
    if (!hasContent) return;
    const t = setTimeout(() => saveLocalDraft(DRAFT_SCOPE, user.id, draft), 600);
    return () => clearTimeout(t);
  }, [draft, editorOpen, isEditing, user]);

  const saveDraft = () => {
    if (!draft.pair || !draft.category) return;
    const journal = serializeJournal(draft.journal || emptyJournal());
    let saved: NotebookEntry;
    if (isEditing) {
      saved = {
        ...(entries.find(e => e.id === draft.id) as NotebookEntry),
        date: draft.date,
        pair: draft.pair,
        category: draft.category,
        bias: draft.bias,
        journal,
        notes: undefined,
        keyLevels: undefined,
        image: undefined,
      };
      persist(entries.map(e => e.id === draft.id ? saved : e));
    } else {
      saved = {
        id: crypto.randomUUID(),
        date: draft.date,
        pair: draft.pair,
        category: draft.category,
        bias: draft.bias,
        journal,
        createdAt: new Date().toISOString(),
      };
      persist([saved, ...entries]);
    }
    upsertToDb(saved).catch(() => { /* keep local, will retry next save */ });
    if (user && !isEditing) clearLocalDraft(DRAFT_SCOPE, user.id);
    setEditorOpen(false);
  };

  const deleteEntry = (id: string) => {
    persist(entries.filter(e => e.id !== id));
    deleteFromDb(id).catch(() => { /* best-effort */ });
  };

  const filtered = openCategory ? entries.filter(e => e.category === openCategory) : entries;

  // Library data: group entries by category. Guarded so a single malformed
  // journal entry can never blank-screen the whole page.
  const library = useMemo(() => {
    try {
      const cats = Array.isArray(notebookCategories) ? notebookCategories : [];
      const byCat = new Map<string, NotebookEntry[]>();
      cats.forEach(c => byCat.set(c, []));
      entries.forEach(e => {
        const list = byCat.get(e.category) || [];
        list.push(e);
        byCat.set(e.category, list);
      });
      return [...byCat.entries()]
        .map(([category, list]) => {
          const sorted = [...list].sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
          const lastUpdated = sorted[0]?.createdAt || sorted[0]?.date || '';
          let cover: string | undefined;
          for (const e of sorted) {
            try { const p = previewOf(e); if (p.thumb) { cover = p.thumb; break; } } catch { /* skip broken entries */ }
          }
          return { category, count: list.length, lastUpdated, cover };
        })
        .sort((a, b) => (b.count - a.count) || a.category.localeCompare(b.category));
    } catch (err) {
      console.warn('[Notebook] library compute failed', err);
      return [] as { category: string; count: number; lastUpdated: string; cover?: string }[];
    }
  }, [entries, notebookCategories]);

  const stats = useMemo(() => {
    const catCount = new Map<string, number>();
    entries.forEach(e => catCount.set(e.category, (catCount.get(e.category) || 0) + 1));
    const mostCommon = catCount.size > 0 ? [...catCount.entries()].sort((a, b) => b[1] - a[1])[0] : null;
    const missed = entries.filter(e => e.category === 'Missed Trade' || e.category === 'Opportunity Not Taken').length;
    return { total: entries.length, mostCommon: mostCommon?.[0] || '-', missed };
  }, [entries]);

  const biasIcon = (bias: string) => {
    if (bias === 'Bullish') return <TrendingUp className="h-3 w-3 text-success" />;
    if (bias === 'Bearish') return <TrendingDown className="h-3 w-3 text-destructive" />;
    if (bias === 'Sideways') return <Minus className="h-3 w-3 text-warning" />;
    return null;
  };

  const categoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      'Pattern': 'bg-primary/15 text-primary border-primary/30',
      'Missed Trade': 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      'Opportunity Not Taken': 'bg-success/15 text-success border-success/30',
      'Observation': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
      'News Reaction': 'bg-destructive/15 text-destructive border-destructive/30',
      'Safe Entry': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
      'Re-Entry After Loss': 'bg-purple-500/15 text-purple-500 border-purple-500/30',
    };
    return colors[cat] || 'bg-muted text-muted-foreground border-border';
  };

  const previewOf = (e: NotebookEntry): { text: string; thumb?: string } => {
    const j = coerceRichJournal(e.journal, e.notes, e.image);
    const firstImg = j.media.find(m => m.type === 'image')?.url;
    const text = journalPlainText(j).slice(0, 220);
    return { text, thumb: firstImg };
  };

  return (
    <div className="p-4 lg:px-3 sm:px-4 py-3 w-full">
      <PageHeader title="Notebook" subtitle="A flexible research notebook for ideas, observations & patterns">
        <Button onClick={openNew} className="gap-1.5 rounded-xl h-9">
          <Plus className="h-4 w-4" /> New Notebook Entry
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Entries" value={stats.total} />
        <MetricCard label="Most Common" value={stats.mostCommon} />
        <MetricCard label="Missed Opportunities" value={stats.missed} trend={stats.missed > 0 ? 'down' : 'neutral'} />
        <MetricCard label="Categories" value={notebookCategories.length} />
      </div>

      {/* LEVEL 1 — Notebook Library (covers grid). LEVEL 2 — open a single notebook's notes. */}
      {!openCategory ? (
        library.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground">
            <Library className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm mb-4">No notebooks yet. Add a category in Control Center, then create your first entry.</p>
            <Button onClick={openNew} className="gap-1.5 rounded-xl"><Plus className="h-4 w-4" /> New Notebook Entry</Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 pt-2">
            {library.map(({ category, count, lastUpdated }) => {
              // Deterministic cover tone per category — varied leather/linen shades
              const palettes = [
                'from-[#1f2a37] via-[#111827] to-[#0b1220]',         // midnight leather
                'from-[#3b2a1f] via-[#2a1d14] to-[#1a120c]',         // burgundy leather
                'from-[#1e3a34] via-[#13261f] to-[#0b1814]',         // forest hardcover
                'from-[#2a1f3b] via-[#1a1428] to-[#100a1c]',         // plum leather
                'from-[#3a2f1a] via-[#241d10] to-[#15110a]',         // tobacco leather
                'from-[#1f3047] via-[#142236] to-[#0c1726]',         // navy hardcover
                'from-[#3a1f2e] via-[#251420] to-[#170c14]',         // oxblood leather
              ];
              let h = 0; for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0;
              const palette = palettes[h % palettes.length];
              const updated = lastUpdated
                ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'No entries yet';
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setOpenCategory(category)}
                  className="group relative text-left aspect-[3/4] rounded-[6px] overflow-visible transition-all duration-300 hover:-translate-y-1.5 hover:rotate-[-0.4deg] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold))]"
                  style={{ perspective: '900px' }}
                >
                  {/* Pages edge (right side of book block) */}
                  <span className="absolute -right-[3px] top-[6px] bottom-[6px] w-[3px] rounded-r-[2px] bg-gradient-to-r from-[#f5efe1] to-[#cbbf9d] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]" />
                  {/* Drop shadow under book */}
                  <span className="absolute -bottom-3 left-3 right-3 h-3 rounded-[50%] bg-black/40 blur-md opacity-60 group-hover:opacity-80 transition" />

                  {/* Hardcover */}
                  <div className={cn(
                    'relative h-full w-full rounded-[6px] bg-gradient-to-br shadow-[0_18px_40px_-18px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden ring-1 ring-black/40',
                    palette,
                  )}>
                    {/* Leather grain texture */}
                    <div
                      className="absolute inset-0 opacity-[0.18] mix-blend-overlay pointer-events-none"
                      style={{
                        backgroundImage:
                          'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1.2px), radial-gradient(rgba(0,0,0,0.4) 1px, transparent 1.4px)',
                        backgroundSize: '4px 4px, 7px 7px',
                        backgroundPosition: '0 0, 2px 3px',
                      }}
                    />
                    {/* Spine band */}
                    <span className="absolute left-0 top-0 bottom-0 w-[14px] bg-gradient-to-r from-black/55 via-black/15 to-transparent" />
                    <span className="absolute left-[14px] top-0 bottom-0 w-px bg-[hsl(var(--gold)/0.35)]" />

                    {/* Gold embossed frame */}
                    <span className="absolute inset-[14px] rounded-[3px] border border-[hsl(var(--gold)/0.55)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.4)] pointer-events-none" />
                    <span className="absolute inset-[18px] rounded-[2px] border border-[hsl(var(--gold)/0.18)] pointer-events-none" />

                    {/* Count badge — gold seal */}
                    <span className="absolute top-3 right-3 min-w-[34px] h-[22px] px-2 rounded-full bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))] text-[10px] font-extrabold tracking-wider flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_2px_4px_rgba(0,0,0,0.5)]">
                      {count}
                    </span>

                    {/* Title block (gold embossed) */}
                    <div className="absolute inset-x-[14px] top-1/2 -translate-y-1/2 text-center">
                      <div className="text-[7px] uppercase tracking-[0.3em] text-[hsl(var(--gold)/0.7)] mb-1">Journal</div>
                      <h3
                        className="font-heading font-extrabold leading-[1.1] tracking-tight text-[hsl(var(--gold))] text-[11px] sm:text-xs line-clamp-3"
                        style={{ textShadow: '0 1px 0 rgba(0,0,0,0.55), 0 0 8px hsl(var(--gold)/0.25)' }}
                      >
                        {category}
                      </h3>
                      <div className="mx-auto mt-1.5 h-px w-6 bg-[hsl(var(--gold)/0.55)]" />
                      <div className="text-[7px] uppercase tracking-[0.25em] text-[hsl(var(--gold)/0.55)] mt-1.5">
                        {updated}
                      </div>
                    </div>


                    {/* Bottom hint */}
                    <div className="absolute bottom-2 inset-x-0 text-center text-[7px] uppercase tracking-[0.25em] text-[hsl(var(--gold)/0.45)]">
                      Open →
                    </div>


                    {/* Sheen on hover */}
                    <span className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/0 group-hover:via-white/[0.04] transition" />
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <>
          {/* LEVEL 2 header */}
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setOpenCategory(null)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Library
              </Button>
              <div>
                <h2 className="font-heading text-lg font-bold tracking-tight flex items-center gap-2">
                  <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-bold border', categoryColor(openCategory))}>{openCategory}</span>
                </h2>
                <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'note' : 'notes'} in this notebook</p>
              </div>
            </div>
            <Button onClick={() => { setDraft({ ...emptyForm(), category: openCategory }); setIsEditing(false); setEditorOpen(true); }} className="gap-1.5 rounded-xl h-9" size="sm">
              <Plus className="h-4 w-4" /> Add to {openCategory}
            </Button>
          </div>

      {/* Entries grid (LEVEL 2 → click a note opens LEVEL 3 editor) */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm mb-4">No notes in this notebook yet.</p>
          <Button onClick={() => { setDraft({ ...emptyForm(), category: openCategory }); setIsEditing(false); setEditorOpen(true); }} className="gap-1.5 rounded-xl"><Plus className="h-4 w-4" /> New Note</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {filtered.map(entry => {
            const { text, thumb } = previewOf(entry);
            return (
              <article
                key={entry.id}
                onClick={() => openEdit(entry)}
                className="group cursor-pointer bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
              >
                {thumb ? (
                  <div className="aspect-[16/9] bg-muted overflow-hidden relative">
                    <img
                      src={thumb}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        // Try legacy fallback first, then hide and show placeholder.
                        if (entry.image && img.src !== entry.image) {
                          img.src = entry.image;
                          return;
                        }
                        // eslint-disable-next-line no-console
                        console.warn('[Notebook] image failed to load', { id: entry.id, src: thumb });
                        img.style.display = 'none';
                        const parent = img.parentElement;
                        if (parent && !parent.querySelector('[data-fallback]')) {
                          const fb = document.createElement('div');
                          fb.setAttribute('data-fallback', '');
                          fb.className = 'absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground bg-muted/40';
                          fb.textContent = 'Image unavailable';
                          parent.appendChild(fb);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-muted/30 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold tracking-tight">{entry.pair}</span>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', categoryColor(entry.category))}>
                      {entry.category}
                    </span>
                    {entry.bias && entry.bias !== 'Neutral' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                        {biasIcon(entry.bias)} {entry.bias}
                      </span>
                    )}
                  </div>
                  {text && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{text}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-primary" onClick={(e) => { e.stopPropagation(); openEdit(entry); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive" onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
        </>
      )}



      <AIInsightsPanel
        page="Notebook"
        payload={adaptNotebook(entries.map(e => ({
          category: e.category,
          pair: e.pair,
          date: e.date,
          title: `${e.pair} ${e.category}`,
          content: journalPlainText(coerceRichJournal(e.journal, e.notes, e.image)),
        })))}
      />

      {/* === Notebook Entry Editor — Notion-style === */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-[96vw] w-[96vw] sm:max-w-[96vw] max-h-[94vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50">
            <DialogTitle className="text-base font-bold uppercase tracking-wide flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {isEditing ? 'Edit Notebook Entry' : 'New Notebook Entry'}
            </DialogTitle>
          </DialogHeader>

          {/* Compact metadata header */}
          <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-border/50 bg-muted/10">
            <div>
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</Label>
              <Input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} className="h-9 text-xs mt-1.5 rounded-lg" />
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pair *</Label>
              <Input value={draft.pair} onChange={e => setDraft(d => ({ ...d, pair: e.target.value }))} placeholder="EURUSD" className="h-9 text-xs mt-1.5 rounded-lg" />
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Category *</Label>
              <Select value={draft.category} onValueChange={v => setDraft(d => ({ ...d, category: v }))}>
                <SelectTrigger className="h-9 text-xs mt-1.5 rounded-lg"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {notebookCategories.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bias <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></Label>
              <Select value={draft.bias || 'none'} onValueChange={v => setDraft(d => ({ ...d, bias: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-9 text-xs mt-1.5 rounded-lg"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {BIAS_OPTIONS.map(b => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Single flexible Notion-style writing surface */}
          <div className="px-6 py-5 bg-background">
            <RichJournalBlock
              title="Research Notes"
              scope={`notebook/${draft.id || 'new'}`}
              value={draft.journal || emptyJournal()}
              onChange={(v) => setDraft(d => ({ ...d, journal: v }))}
              placeholder="Start writing… paste screenshots, drop charts, attach video. Mix text and media freely."
              accept="both"
              className="border-0 shadow-none p-0 bg-transparent"
            />
            <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" /> Tip: paste screenshots, drag-drop images/video, or use Add media — everything saves into one journal page.
            </p>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/10 sm:justify-between">
            <Button variant="ghost" onClick={() => setEditorOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={saveDraft} disabled={!draft.pair || !draft.category} className="gap-1.5 rounded-xl">
              {isEditing ? <><Check className="h-4 w-4" /> Update Entry</> : <><Plus className="h-4 w-4" /> Save Entry</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
