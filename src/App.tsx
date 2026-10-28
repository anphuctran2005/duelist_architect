/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  Dices,
  FileCode2,
  FileSpreadsheet,
  Globe,
  History,
  Image as ImageIcon,
  Languages,
  Layers,
  LayoutGrid,
  MessageSquare,
  Moon,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { CardArtwork } from './components/CardArtwork';
import { CardDatabaseView } from './components/CardDatabaseView';
import { DeckPlaybookGuide } from './components/DeckPlaybookGuide';
import { DuelistCoachDrawer } from './components/DuelistCoachDrawer';
import { MasterDuelImportGuide } from './components/MasterDuelImportGuide';
import {
  RecentDecksSidebar,
  RecentDeckRecord,
  loadRecentDecksFromStorage,
  saveRecentDecksToStorage,
  upsertRecentDeckRecord,
} from './components/RecentDecksSidebar';
import { VisualStudioView } from './components/VisualStudioView';
import { INITIAL_VISUAL_ASSETS, STARTER_DECKS } from './data/starterDecks';
import {
  AppLanguage,
  LanguageContext,
  PROMPT_SUGGESTIONS_I18N,
  translateYgoEffectFallbackVi,
} from './i18n/translations';
import {
  DeckEntry,
  DeckState,
  GeminiModelTier,
  GeneratedVisualAsset,
  SuggestedDeckChange,
  WorkspaceTab,
  YgoCard,
} from './types/ygo';
import {
  buildShareableDeckUrl,
  calculateAtLeastOneProbability,
  calculateCraftingPoints,
  dealTestHand,
  decodeBase64DeckState,
  downloadYdkFile,
  getMaxAllowedCopies,
  isExtraDeckCard,
} from './utils/ydk';
import { exportDeckToExcel } from './utils/excelExport';
import {
  generateDeckUnified,
  hydratePasscodesUnified,
  searchCardsUnified,
  translateCardUnified,
} from './utils/clientApiFallback';

export default function App() {
  const [lang, setLang] = useState<AppLanguage>('vi');
  const isVi = lang === 'vi';

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('builder');
  const [recentDecks, setRecentDecks] = useState<RecentDeckRecord[]>(() =>
    loadRecentDecksFromStorage(STARTER_DECKS)
  );
  const [deck, setDeck] = useState<DeckState>(
    () => loadRecentDecksFromStorage(STARTER_DECKS)[0]?.deck || STARTER_DECKS[0]
  );
  const [selectedEntry, setSelectedEntry] = useState<DeckEntry | null>(
    () =>
      (loadRecentDecksFromStorage(STARTER_DECKS)[0]?.deck || STARTER_DECKS[0]).entries[0] || null
  );
  const [rightDockMode, setRightDockMode] = useState<'inspector' | 'coach' | 'recent'>('recent');

  // Mobile Bottom Sheets & Ergonomics State (< 1024px)
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [mobileCoachOpen, setMobileCoachOpen] = useState(false);
  const [mobileRecentOpen, setMobileRecentOpen] = useState(false);
  const [mobilePromptCollapsed, setMobilePromptCollapsed] = useState(false);
  const [mobileGridCols, setMobileGridCols] = useState<3 | 4>(3);

  // Light / Dark Theme Mode (Defaulting to Light Mode as requested)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('duelist_architect_theme_mode');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // Ignore storage error
    }
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem('duelist_architect_theme_mode', themeMode);
    } catch {
      // Ignore storage error
    }
    if (typeof document !== 'undefined') {
      document.body.style.backgroundColor = themeMode === 'light' ? '#F4F6FA' : '#0B0F17';
      document.body.style.color = themeMode === 'light' ? '#0F172A' : '#F1F5F9';
    }
  }, [themeMode]);

  const scrollToSection = (sectionId: string) => {
    setActiveTab('builder');
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  // AI Deck Constructor Form State
  const [promptInput, setPromptInput] = useState('');
  const [playstyle, setPlaystyle] = useState('Competitive Midrange');
  const [budgetTier, setBudgetTier] = useState('Competitive (No UR Limit)');
  const [builderModel, setBuilderModel] = useState<GeminiModelTier>('gpt-oss-20b-free');
  const [isConstructingDeck, setIsConstructingDeck] = useState(false);
  const [constructionStage, setConstructionStage] = useState('');
  const [builderBannerNote, setBuilderBannerNote] = useState<string | null>(null);

  // Workbench Interactive State
  const [showCustomSleeves, setShowCustomSleeves] = useState(false);
  const [testHand, setTestHand] = useState<YgoCard[] | null>(null);
  const [visualAssets, setVisualAssets] = useState<GeneratedVisualAsset[]>(INITIAL_VISUAL_ASSETS);
  const [isImportingYdk, setIsImportingYdk] = useState(false);

  // Shareable Base64 Deck URL State
  const [shareUrlPreview, setShareUrlPreview] = useState<string | null>(null);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);

  // Automatically hydrate a shared deck from `?deck=<base64>` URL parameter on load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const encodedDeck = params.get('deck');
    if (!encodedDeck) return;

    const decoded = decodeBase64DeckState(encodedDeck);
    if (!decoded) return;

    let cancelled = false;
    (async () => {
      setIsImportingYdk(true);
      try {
        // Pre-seed known cards from Starter Decks & Recent Decks for instant lookup
        const localCardPool: Record<number, YgoCard> = {};
        for (const preset of STARTER_DECKS) {
          for (const e of preset.entries) {
            localCardPool[e.card.id] = e.card;
          }
        }
        for (const rec of loadRecentDecksFromStorage(STARTER_DECKS)) {
          for (const e of rec.deck.entries) {
            localCardPool[e.card.id] = e.card;
          }
        }

        const allIds = decoded.e.map((tuple) => Number(tuple[0])).filter((id) => id > 0);
        const missingIds = allIds.filter((id) => !localCardPool[id]);
        const remoteMap =
          missingIds.length > 0 ? await hydratePasscodesUnified(missingIds) : {};
        const mergedMap: Record<number, YgoCard> = { ...localCardPool, ...remoteMap };

        if (cancelled) return;

        const hydratedEntries: DeckEntry[] = [];
        for (const [cardId, qty, secCode, role] of decoded.e) {
          const card = mergedMap[Number(cardId)];
          if (!card) continue;
          const section: DeckEntry['section'] =
            secCode === 'e' ? 'extra' : secCode === 's' ? 'side' : 'main';
          const clampedQty = Math.max(1, Math.min(3, Number(qty) || 1)) as 1 | 2 | 3;
          hydratedEntries.push({
            card,
            quantity: clampedQty,
            section,
            role: role || (section === 'extra' ? 'Boss' : 'Engine'),
            reason:
              lang === 'vi'
                ? 'Được tải từ liên kết chia sẻ bộ bài (Base64 Share Link).'
                : 'Loaded from a shared Base64 deck URL.',
          });
        }

        if (hydratedEntries.length > 0) {
          const sharedDeck: DeckState = {
            id: `shared-${Date.now()}`,
            name: decoded.n || 'Shared Master Duel Deck',
            archetype: decoded.a || hydratedEntries[0].card.archetype || 'Shared Archetype',
            playstyle: decoded.p || 'Competitive Midrange',
            tierRating: decoded.t || 'Shared Build',
            strategySummary:
              decoded.s ||
              (lang === 'vi'
                ? 'Bộ bài được nạp trực tiếp từ liên kết chia sẻ Base64 URL.'
                : 'Deck configuration restored from a Base64 share URL.'),
            comboGuide: decoded.cg,
            entries: hydratedEntries,
          };
          setDeck(sharedDeck);
          setSelectedEntry(hydratedEntries[0]);
          setRecentDecks((prev) =>
            upsertRecentDeckRecord(prev, sharedDeck, 'manual-saved', sharedDeck.name)
          );
          setBuilderBannerNote(
            lang === 'vi'
              ? `🔗 Đã mở thành công bộ bài được chia sẻ: "${sharedDeck.name}" (${hydratedEntries.reduce(
                  (s, e) => s + e.quantity,
                  0
                )} lá).`
              : `🔗 Loaded shared deck build: "${sharedDeck.name}" (${hydratedEntries.reduce(
                  (s, e) => s + e.quantity,
                  0
                )} cards).`
          );
        }
      } finally {
        if (!cancelled) {
          setIsImportingYdk(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleShareCurrentDeck = async () => {
    const shareUrl = buildShareableDeckUrl(deck);
    setShareUrlPreview(shareUrl);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', shareUrl);
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareUrl(true);
      setTimeout(() => setCopiedShareUrl(false), 3000);
    } catch {
      // Ignore clipboard error
    }
  };

  // On-demand Vietnamese card effect translations in the Card Inspector
  const [translatedEffects, setTranslatedEffects] = useState<Record<number, string>>({});
  const [isTranslatingCard, setIsTranslatingCard] = useState(false);

  // Deck Metrics
  const mainEntries = useMemo(
    () => deck.entries.filter((e) => e.section === 'main'),
    [deck.entries]
  );
  const extraEntries = useMemo(
    () => deck.entries.filter((e) => e.section === 'extra'),
    [deck.entries]
  );

  const mainCount = useMemo(
    () => mainEntries.reduce((sum, e) => sum + e.quantity, 0),
    [mainEntries]
  );
  const extraCount = useMemo(
    () => extraEntries.reduce((sum, e) => sum + e.quantity, 0),
    [extraEntries]
  );

  const starterCount = useMemo(
    () =>
      mainEntries
        .filter((e) => e.role === 'Starter')
        .reduce((sum, e) => sum + e.quantity, 0),
    [mainEntries]
  );

  const handTrapCount = useMemo(
    () =>
      mainEntries
        .filter((e) => e.role === 'Hand Trap')
        .reduce((sum, e) => sum + e.quantity, 0),
    [mainEntries]
  );

  const starterProbability = useMemo(
    () => calculateAtLeastOneProbability(mainCount, starterCount, 5),
    [mainCount, starterCount]
  );

  const { neededCP } = useMemo(() => calculateCraftingPoints(deck.entries), [deck.entries]);

  // Master Duel Banlist Visual Summary & Violation Detection
  const banlistStats = useMemo(() => {
    let forbiddenCards = 0;
    let limitedCards = 0;
    let semiLimitedCards = 0;
    const violations: { card: YgoCard; quantity: number; maxAllowed: number }[] = [];

    for (const entry of deck.entries) {
      const status = entry.card.banlistStatus;
      const maxAllowed = getMaxAllowedCopies(status);
      if (status === 'Forbidden') {
        forbiddenCards += entry.quantity;
      } else if (status === 'Limited') {
        limitedCards += entry.quantity;
      } else if (status === 'Semi-Limited') {
        semiLimitedCards += entry.quantity;
      }
      if (entry.quantity > maxAllowed) {
        violations.push({
          card: entry.card,
          quantity: entry.quantity,
          maxAllowed,
        });
      }
    }

    return {
      forbiddenCards,
      limitedCards,
      semiLimitedCards,
      violations,
    };
  }, [deck.entries]);

  const handleAutoFixBanlist = () => {
    setDeck((prev) => {
      const fixedEntries: DeckEntry[] = [];
      for (const entry of prev.entries) {
        const maxAllowed = getMaxAllowedCopies(entry.card.banlistStatus);
        if (maxAllowed <= 0) continue;
        fixedEntries.push({
          ...entry,
          quantity: Math.min(entry.quantity, maxAllowed) as 1 | 2 | 3,
        });
      }
      return { ...prev, entries: fixedEntries };
    });
  };

  const handleAdjustQuantity = (cardId: number, delta: number) => {
    setDeck((prev) => {
      const nextEntries: DeckEntry[] = [];
      for (const entry of prev.entries) {
        if (entry.card.id !== cardId) {
          nextEntries.push(entry);
          continue;
        }
        const maxAllowed = getMaxAllowedCopies(entry.card.banlistStatus);
        const nextQty = entry.quantity + delta;
        if (nextQty <= 0) {
          if (selectedEntry?.card.id === cardId) {
            setMobileInspectorOpen(false);
          }
          continue;
        }
        const cap = maxAllowed > 0 ? Math.min(3, maxAllowed) : 1;
        const clamped = Math.min(cap, nextQty) as 1 | 2 | 3;
        const updated = { ...entry, quantity: clamped };
        nextEntries.push(updated);
        if (selectedEntry?.card.id === cardId) {
          setSelectedEntry(updated);
        }
      }
      return { ...prev, entries: nextEntries };
    });
  };

  const handleAddCardToDeck = (card: YgoCard) => {
    const maxAllowed = getMaxAllowedCopies(card.banlistStatus);
    const cap = maxAllowed > 0 ? Math.min(3, maxAllowed) : 1;

    const section = isExtraDeckCard(card) ? 'extra' : 'main';
    setDeck((prev) => {
      const existing = prev.entries.find((e) => e.card.id === card.id);
      if (existing) {
        const nextQty = Math.min(cap, existing.quantity + 1) as 1 | 2 | 3;
        return {
          ...prev,
          entries: prev.entries.map((e) =>
            e.card.id === card.id ? { ...e, quantity: nextQty } : e
          ),
        };
      }
      const newEntry: DeckEntry = {
        card,
        quantity: 1,
        section,
        role: section === 'extra' ? 'Boss' : 'Engine',
        reason:
          card.banlistStatus === 'Forbidden'
            ? isVi
              ? 'Lá bài BỊ CẤM (Forbidden) trong Master Duel Ranked — chỉ dùng cho phòng đấu tự do (Unlimited Room).'
              : 'FORBIDDEN in Master Duel Standard Ranked — only usable in Unlimited Rooms.'
            : isVi
            ? 'Được thêm thủ công từ cơ sở dữ liệu YGOPRODeck.'
            : 'Added manually from the YGOPRODeck database.',
      };
      setSelectedEntry(newEntry);
      return {
        ...prev,
        entries: [...prev.entries, newEntry],
      };
    });
  };

  const handleTranslateSelectedCard = async (card: YgoCard) => {
    if (translatedEffects[card.id] || isTranslatingCard) return;
    setIsTranslatingCard(true);
    try {
      const text = await translateCardUnified(card.name, card.desc);
      setTranslatedEffects((prev) => ({ ...prev, [card.id]: text }));
    } catch {
      setTranslatedEffects((prev) => ({
        ...prev,
        [card.id]: translateYgoEffectFallbackVi(card.desc),
      }));
    } finally {
      setIsTranslatingCard(false);
    }
  };

  const handleConstructDeck = async (customPrompt?: string) => {
    const targetPrompt = (customPrompt ?? promptInput).trim();
    if (!targetPrompt || isConstructingDeck) return;

    setIsConstructingDeck(true);
    setBuilderBannerNote(null);
    setConstructionStage(
      isVi
        ? '01. Đang phân tích chiến thuật & xây dựng khung bài bằng Free AI Engine...'
        : '01. Architecting archetype ratios & engine lines with Free AI Engine...'
    );

    const stageTimer = setTimeout(() => {
      setConstructionStage(
        isVi
          ? '02. Đang xác thực mã Passcode 8 số & Banlist Master Duel từ YGOPRODeck...'
          : '02. Resolving 8-digit Konami passcodes & Master Duel banlist via YGOPRODeck API...'
      );
    }, 1800);

    try {
      const data = await generateDeckUnified({
        prompt: targetPrompt,
        playstyle,
        budgetTier,
        preferredModel: builderModel,
        lang,
      });
      if (data.deck && Array.isArray(data.deck.entries) && data.deck.entries.length > 0) {
        const nextDeck: DeckState = {
          ...data.deck,
          customPlaymatUrl: deck.customPlaymatUrl,
          customSleeveUrl: deck.customSleeveUrl,
        };
        setDeck(nextDeck);
        setSelectedEntry(nextDeck.entries[0] || null);
        setTestHand(null);
        setRecentDecks((prev) =>
          upsertRecentDeckRecord(prev, nextDeck, 'ai-generated', targetPrompt)
        );
        const totalCards = nextDeck.entries.reduce((s, e) => s + e.quantity, 0);
        setBuilderBannerNote(
          isVi
            ? `Đã hoàn tất và lưu bộ bài "${nextDeck.name}" vào lịch sử 5 Deck gần đây (${totalCards} lá · Engine: ${data.modelUsed}).`
            : `Constructed and saved "${nextDeck.name}" to Recent Decks (${totalCards} cards · Engine: ${data.modelUsed}).`
        );
      }
    } catch (err: any) {
      setBuilderBannerNote(err?.message || 'Deck construction encountered an error.');
    } finally {
      clearTimeout(stageTimer);
      setIsConstructingDeck(false);
      setConstructionStage('');
    }
  };

  const handleSelectRecentDeck = (selectedDeck: DeckState) => {
    setDeck(selectedDeck);
    setSelectedEntry(selectedDeck.entries[0] || null);
    setTestHand(null);
    setActiveTab('builder');
    setMobileRecentOpen(false);
    setBuilderBannerNote(
      isVi
        ? `Đã mở lại cấu hình bộ bài "${selectedDeck.name}" từ Lịch sử 5 Deck gần đây.`
        : `Restored deck configuration "${selectedDeck.name}" from Recent Decks.`
    );
  };

  const handleSaveCurrentDeckToRecent = () => {
    setRecentDecks((prev) =>
      upsertRecentDeckRecord(prev, deck, 'manual-saved', promptInput || deck.archetype)
    );
    setBuilderBannerNote(
      isVi
        ? `Đã lưu bản thiết kế "${deck.name}" vào Lịch sử 5 Deck gần đây.`
        : `Saved "${deck.name}" snapshot into Recent Decks.`
    );
  };

  const handleDeleteRecentDeck = (recordId: string) => {
    setRecentDecks((prev) => {
      const next = prev.filter((r) => r.id !== recordId);
      saveRecentDecksToStorage(next);
      return next;
    });
  };

  const handleClearRecentDecks = () => {
    setRecentDecks([]);
    saveRecentDecksToStorage([]);
  };

  const handleApplyCoachChanges = async (changes: SuggestedDeckChange[]) => {
    for (const chg of changes) {
      if (chg.action === 'remove') {
        setDeck((prev) => ({
          ...prev,
          entries: prev.entries.filter(
            (e) => e.card.name.toLowerCase() !== chg.cardName.toLowerCase()
          ),
        }));
      } else if (chg.action === 'add') {
        try {
          const cards = await searchCardsUnified(chg.cardName, 'ALL', 3);
          const card: YgoCard | undefined = cards[0];
          if (card) {
            const maxAllowed = getMaxAllowedCopies(card.banlistStatus);
            const qty = Math.max(1, Math.min(3, maxAllowed, chg.quantity || 1)) as 1 | 2 | 3;
            const section = isExtraDeckCard(card) ? 'extra' : 'main';
            setDeck((prev) => {
              const exists = prev.entries.find((e) => e.card.id === card.id);
              if (exists) {
                return {
                  ...prev,
                  entries: prev.entries.map((e) =>
                    e.card.id === card.id
                      ? {
                          ...e,
                          quantity: Math.min(3, maxAllowed, e.quantity + qty) as 1 | 2 | 3,
                        }
                      : e
                  ),
                };
              }
              return {
                ...prev,
                entries: [
                  ...prev.entries,
                  {
                    card,
                    quantity: qty,
                    section,
                    role: 'Tech',
                    reason: chg.reason,
                  },
                ],
              };
            });
          }
        } catch {
          // Ignore single card lookup error
        }
      }
    }
  };

  const handleImportYdkPasscodes = async (
    parsed: { mainIds: number[]; extraIds: number[]; sideIds: number[] },
    fileName = 'Imported YDK Deck'
  ) => {
    const allIds = [...parsed.mainIds, ...parsed.extraIds, ...parsed.sideIds];
    if (allIds.length === 0) return;

    setIsImportingYdk(true);
    try {
      const cardMap: Record<number, YgoCard> = await hydratePasscodesUnified(allIds);

      const countMap = new Map<
        string,
        { id: number; section: 'main' | 'extra' | 'side'; qty: number }
      >();
      const accumulate = (ids: number[], section: 'main' | 'extra' | 'side') => {
        for (const id of ids) {
          const key = `${section}-${id}`;
          const prev = countMap.get(key);
          if (prev) prev.qty = Math.min(3, prev.qty + 1);
          else countMap.set(key, { id, section, qty: 1 });
        }
      };

      accumulate(parsed.mainIds, 'main');
      accumulate(parsed.extraIds, 'extra');
      accumulate(parsed.sideIds, 'side');

      const hydratedEntries: DeckEntry[] = [];
      for (const item of countMap.values()) {
        const card = cardMap[item.id];
        if (!card) continue;
        hydratedEntries.push({
          card,
          quantity: item.qty as 1 | 2 | 3,
          section: item.section,
          role: item.section === 'extra' ? 'Boss' : 'Engine',
          reason: isVi ? 'Được nạp từ file mã .ydk.' : 'Imported from .ydk passcode file.',
        });
      }

      if (hydratedEntries.length > 0) {
        const importedDeck: DeckState = {
          id: `imported-${Date.now()}`,
          name: fileName,
          archetype: hydratedEntries[0]?.card.archetype || 'Custom Imported List',
          playstyle: 'Master Duel Constructed',
          tierRating: 'Verified .YDK Import',
          strategySummary: isVi
            ? 'Được nạp trực tiếp từ mã Passcode .ydk và xác thực qua cơ sở dữ liệu YGOPRODeck Master Duel.'
            : 'Imported directly from .ydk passcodes and validated against the live YGOPRODeck Master Duel database.',
          comboGuide: deck.comboGuide,
          entries: hydratedEntries,
          customPlaymatUrl: deck.customPlaymatUrl,
          customSleeveUrl: deck.customSleeveUrl,
        };
        setDeck(importedDeck);
        setSelectedEntry(hydratedEntries[0]);
        setRecentDecks((prev) =>
          upsertRecentDeckRecord(prev, importedDeck, 'ydk-imported', fileName)
        );
        setActiveTab('builder');
      }
    } finally {
      setIsImportingYdk(false);
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      <div
        className={`min-h-screen flex flex-col bg-[#0B0F17] text-[#F1F5F9] transition-colors ${
          themeMode === 'light' ? 'theme-light' : 'theme-dark'
        }`}
      >
        {/* Strict 3-Zone Top Bar Contract (Compact 48px on Mobile, Full 3-Zone on Desktop) */}
        <header className="sticky top-0 z-30 h-12 sm:h-14 flex items-center justify-between gap-3 sm:gap-8 px-3.5 sm:px-6 bg-[#0B0F17]/95 backdrop-blur border-b border-slate-800/90">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('builder');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-100 font-display whitespace-nowrap shrink-0 hover:text-amber-300 transition-colors"
          >
            Duelist Architect
          </a>

          {/* Zone 2: 4 Concise Single-Line Navigation Links (Desktop md:flex; Mobile uses Fixed Bottom Tab Bar) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'builder'
                  ? 'border-amber-400 text-amber-300 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              {isVi ? 'Xây Dựng Deck' : 'Deck Builder'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import_guide')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'import_guide'
                  ? 'border-amber-400 text-amber-300 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              {isVi ? 'Hướng Dẫn Nhập' : 'Import Guide'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('visual_studio')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'visual_studio'
                  ? 'border-amber-400 text-amber-300 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              {isVi ? 'Xưởng Hình Ảnh' : 'Visual Studio'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'database'
                  ? 'border-amber-400 text-amber-300 font-semibold'
                  : 'border-transparent hover:text-white'
              }`}
            >
              {isVi ? 'Thư Viện Bài' : 'Card Database'}
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => downloadYdkFile(deck)}
              className="min-h-[36px] sm:min-h-[38px] px-3 sm:px-4 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isVi ? 'Xuất File .YDK' : 'Export .YDK Deck'}</span>
            </button>
          </div>
        </header>

        {/* Sub-Header Workspace Toolbar with Light/Dark Theme Switcher, Recent Decks, Excel & Language (Horizontally Scrollable on Mobile) */}
        <div className="bg-[#0E1422] border-b border-slate-800/70 px-3.5 sm:px-6 py-2">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2.5 text-xs overflow-x-auto no-scrollbar">
            <div className="hidden lg:block text-slate-400 font-mono tabular-nums truncate">
              {`${deck.name} · ${mainCount} Main / ${extraCount} Extra`}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
              {/* Light / Dark Theme Mode Toggle */}
              <button
                type="button"
                onClick={() => setThemeMode((m) => (m === 'light' ? 'dark' : 'light'))}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {themeMode === 'light' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isVi ? 'Nền Sáng' : 'Light Mode'}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isVi ? 'Nền Tối' : 'Dark Mode'}</span>
                  </>
                )}
              </button>

              {/* Quick Jump to How-To-Play Playbook */}
              <button
                type="button"
                onClick={() => scrollToSection('deck-playbook-section')}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/40 hover:border-amber-400 text-amber-300 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>{isVi ? 'Cách Chơi Deck' : 'How to Play'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('builder');
                  setRightDockMode('recent');
                  setMobileRecentOpen(true);
                }}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isVi
                    ? `Gần Đây (${recentDecks.length}/5)`
                    : `Recent (${recentDecks.length}/5)`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleShareCurrentDeck}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 hover:border-sky-400 text-sky-300 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {copiedShareUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isVi ? 'Đã Chép Link!' : 'Link Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isVi ? 'Chia Sẻ Link' : 'Share Link'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => exportDeckToExcel(deck, lang, translatedEffects)}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isVi ? 'Xuất Excel' : 'Excel (.xlsx)'}</span>
              </button>

              <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setLang('vi')}
                  className={`min-h-[30px] px-2 py-0.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    lang === 'vi'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  VI
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`min-h-[30px] px-2 py-0.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    lang === 'en'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Workspace Container (pb-24 on mobile for Fixed Bottom Tab Bar) */}
        <main className="flex-1 pb-24 md:pb-8">
          {activeTab === 'import_guide' && (
            <MasterDuelImportGuide
              deck={deck}
              onImportYdkPasscodes={handleImportYdkPasscodes}
              isImportingYdk={isImportingYdk}
            />
          )}

          {activeTab === 'visual_studio' && (
            <VisualStudioView
              deck={deck}
              assets={visualAssets}
              onAddAsset={(newAsset) => setVisualAssets((prev) => [newAsset, ...prev])}
              onApplySleeve={(url) => setDeck((prev) => ({ ...prev, customSleeveUrl: url }))}
              onApplyPlaymat={(url) => setDeck((prev) => ({ ...prev, customPlaymatUrl: url }))}
            />
          )}

          {activeTab === 'database' && (
            <CardDatabaseView deck={deck} onAddCardToDeck={handleAddCardToDeck} />
          )}

          {activeTab === 'builder' && (
            <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3.5 sm:py-6 space-y-4 sm:space-y-6">
              {/* Mobile Quick-Jump Pill Bar (< 640px) for Thumb-Zone Ergonomics */}
              <div className="sm:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => scrollToSection('main-deck-section')}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0"
                >
                  {isVi ? `🃏 Main (${mainCount})` : `🃏 Main (${mainCount})`}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('extra-deck-section')}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0"
                >
                  {isVi ? `✨ Extra (${extraCount})` : `✨ Extra (${extraCount})`}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('deck-playbook-section')}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Hướng Dẫn Cách Chơi' : 'How to Play'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileRecentOpen(true)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0"
                >
                  {isVi ? `🕒 5 Deck Gần Đây` : `🕒 Recent (${recentDecks.length})`}
                </button>
              </div>

              {/* Top AI Natural Language Deck Constructor Panel (Collapsible on Mobile) */}
              <section className="p-3.5 sm:p-6 rounded-2xl sm:rounded-xl bg-[#111827] border border-slate-800 space-y-3.5 sm:space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-[11px] sm:text-xs font-mono text-amber-400 tracking-wide">
                        {isVi
                          ? 'KIẾN TRÚC SƯ DECK MASTER DUEL AI · PASSCODE YGOPRODECK'
                          : 'AI MASTER DUEL DECK ARCHITECT · LIVE YGOPRODECK VALIDATION'}
                      </div>
                      <h1 className="text-lg sm:text-2xl font-bold text-slate-100 font-display">
                        {isVi
                          ? 'Mô Tả Chiến Thuật, Tộc Bài Hoặc Ngân Sách CP'
                          : 'Describe Your Strategy, Archetype, or Budget Goal'}
                      </h1>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMobilePromptCollapsed((v) => !v)}
                      aria-label="Toggle AI Constructor Form"
                      className="sm:hidden min-h-[40px] min-w-[40px] rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 shrink-0"
                    >
                      {mobilePromptCollapsed ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Preset Meta Deck Quick-Load Switcher (Horizontal Touch Carousel on Mobile) */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                    <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                      {isVi ? 'Deck Mẫu:' : 'Presets:'}
                    </span>
                    {STARTER_DECKS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setDeck(preset);
                          setSelectedEntry(preset.entries[0] || null);
                          setTestHand(null);
                          setBuilderBannerNote(null);
                        }}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl sm:rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                          deck.id === preset.id
                            ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {preset.archetype}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={mobilePromptCollapsed ? 'hidden sm:block space-y-4' : 'space-y-4'}>
                  {/* Natural Language Input Row */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleConstructDeck();
                    }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3"
                  >
                    <div className="lg:col-span-6 relative">
                      <input
                        type="text"
                        value={promptInput}
                        onChange={(e) => setPromptInput(e.target.value)}
                        placeholder={
                          isVi
                            ? 'VD: Xây dựng bộ bài Rồng Trắng Mắt Xanh Synchro, Tenpai Dragon đi sau OTK...'
                            : 'e.g., Construct a going-second Tenpai Dragon Synchro OTK deck...'
                        }
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-xl sm:rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 lg:col-span-4 gap-2.5">
                      <select
                        value={playstyle}
                        onChange={(e) => setPlaystyle(e.target.value)}
                        aria-label="Playstyle Focus"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl sm:rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      >
                        <option value="Competitive Midrange">
                          {isVi ? 'Công Thủ (Midrange)' : 'Midrange'}
                        </option>
                        <option value="Going-First Combo">
                          {isVi ? 'Đi Trước (Combo)' : 'Going-First Combo'}
                        </option>
                        <option value="Going-Second OTK">
                          {isVi ? 'Đi Sau (OTK)' : 'Going-Second OTK'}
                        </option>
                        <option value="Control & Trap">
                          {isVi ? 'Kiểm Soát (Control)' : 'Control & Trap'}
                        </option>
                      </select>

                      <select
                        value={budgetTier}
                        onChange={(e) => setBudgetTier(e.target.value)}
                        aria-label="Crafting Point Budget"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl sm:rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      >
                        <option value="Competitive (No UR Limit)">
                          {isVi ? 'Tối Đa Sức Mạnh' : 'No UR Limit'}
                        </option>
                        <option value="Mid-Budget (Moderate UR)">
                          {isVi ? 'Ngân Sách Vừa' : 'Balanced UR/SR'}
                        </option>
                        <option value="Low UR Budget (F2P Friendly)">
                          {isVi ? 'Tiết Kiệm UR (F2P)' : 'Low UR Cost'}
                        </option>
                      </select>
                    </div>

                    <div className="lg:col-span-2">
                      <button
                        type="submit"
                        disabled={isConstructingDeck || !promptInput.trim()}
                        className="w-full min-h-[46px] h-full py-2.5 px-4 rounded-xl sm:rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-semibold text-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <Wand2 className="w-4 h-4" />
                        <span>
                          {isConstructingDeck
                            ? isVi
                              ? 'Đang tạo...'
                              : 'Building...'
                            : isVi
                            ? 'Tạo Bộ Bài AI'
                            : 'Construct Deck'}
                        </span>
                      </button>
                    </div>
                  </form>

                  {/* Quick Archetype Prompt Starters (Horizontal Touch Scroll on Mobile) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 mr-1">
                        {isVi ? 'Gợi ý:' : 'Prompts:'}
                      </span>
                      {PROMPT_SUGGESTIONS_I18N[lang].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setPromptInput(item.prompt);
                            handleConstructDeck(item.prompt);
                          }}
                          disabled={isConstructingDeck}
                          className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/60 text-xs text-slate-300 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono shrink-0">
                      <span>Free AI:</span>
                      <select
                        value={builderModel}
                        onChange={(e) => setBuilderModel(e.target.value as GeminiModelTier)}
                        aria-label="Architect Free AI Model"
                        className="min-h-[34px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-300 text-xs focus:outline-none"
                      >
                        <option value="gpt-oss-20b-free">GPT-OSS 20B (Free 0đ)</option>
                        <option value="llama-3.3-70b-free">Llama 3.3 70B (Free 0đ)</option>
                        <option value="qwen-2.5-72b-free">Qwen 2.5 72B (Free 0đ)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {isConstructingDeck && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-400/40 flex items-center gap-3 text-xs font-mono text-amber-300">
                    <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                    <span>{constructionStage}</span>
                  </div>
                )}

                {builderBannerNote && !isConstructingDeck && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
                    <span>{builderBannerNote}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('import_guide')}
                      className="text-amber-300 font-semibold hover:underline text-left sm:text-right whitespace-nowrap shrink-0"
                    >
                      {isVi
                        ? 'Xem Hướng Dẫn Nhập Vào Master Duel →'
                        : 'Open Master Duel Import Guide →'}
                    </button>
                  </div>
                )}
              </section>

              {/* 12-Column Tactical Workbench Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-5 sm:space-y-6">
                  {/* Active Deck Summary Bar */}
                  <div className="p-4 sm:p-5 rounded-2xl sm:rounded-xl bg-[#111827] border border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-800/80">
                      <div>
                        <div className="text-xs font-mono text-slate-400 tabular-nums">
                          {deck.archetype} · {deck.playstyle} · {deck.tierRating}
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-100 font-display mt-0.5">
                          {deck.name}
                        </h2>
                      </div>

                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setTestHand(dealTestHand(deck.entries, 5))}
                          className="min-h-[42px] px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-xl sm:rounded-lg hover:border-amber-400 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <Dices className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isVi ? 'Rút Thử 5 Lá' : 'Test 5-Card Hand'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowCustomSleeves((v) => !v)}
                          className="min-h-[42px] px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-xl sm:rounded-lg hover:border-amber-400 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <Layers className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            {showCustomSleeves
                              ? isVi
                                ? 'Hiện Mặt Trước'
                                : 'Card Faces'
                              : isVi
                              ? 'Xem Bọc Bài'
                              : 'Preview Sleeves'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => scrollToSection('deck-playbook-section')}
                          className="min-h-[42px] px-3.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-400/15 border border-amber-400/50 hover:bg-amber-400 hover:text-slate-950 active:scale-[0.98] rounded-xl sm:rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{isVi ? 'Hướng Dẫn Cách Chơi' : 'How to Play Guide'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleShareCurrentDeck}
                          className="min-h-[42px] px-3.5 py-1.5 text-xs font-semibold text-sky-300 bg-sky-500/15 border border-sky-500/40 hover:bg-sky-500/25 hover:border-sky-400 active:scale-[0.98] rounded-xl sm:rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          {copiedShareUrl ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{isVi ? 'Đã Sao Chép Link!' : 'Copied Share URL!'}</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5 text-sky-400" />
                              <span>{isVi ? 'Chia Sẻ Link Deck' : 'Share Deck Link'}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => exportDeckToExcel(deck, lang, translatedEffects)}
                          className="min-h-[42px] px-3.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 hover:border-emerald-400 active:scale-[0.98] rounded-xl sm:rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            {isVi ? 'Xuất File Excel (.xlsx)' : 'Export Excel (.xlsx)'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('import_guide')}
                          className="min-h-[42px] px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] rounded-xl sm:rounded-lg transition-all whitespace-nowrap"
                        >
                          {isVi ? 'Cách Nhập Game' : 'How to Import'}
                        </button>
                      </div>
                    </div>

                    {/* Interactive Base64 Share URL Panel */}
                    {shareUrlPreview && (
                      <div className="p-3 rounded-xl bg-slate-950 border border-sky-500/50 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                            <Share2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {isVi
                                ? 'Liên Kết Chia Sẻ Cấu Hình Bộ Bài (Mã Hóa Base64 URL):'
                                : 'Shareable Deck Configuration URL (Base64-Encoded State):'}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShareUrlPreview(null)}
                            className="text-slate-400 hover:text-slate-200 text-xs"
                          >
                            {isVi ? 'Đóng' : 'Close'}
                          </button>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={shareUrlPreview}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handleShareCurrentDeck}
                              className="flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              {copiedShareUrl ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{isVi ? 'Đã Sao Chép!' : 'Copied!'}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>{isVi ? 'Sao Chép Link' : 'Copy Link'}</span>
                                </>
                              )}
                            </button>

                            {typeof navigator !== 'undefined' && 'share' in navigator && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator
                                    .share({
                                      title: deck.name,
                                      text: `${deck.name} (${deck.archetype}) — Yu-Gi-Oh! Master Duel Deck`,
                                      url: shareUrlPreview,
                                    })
                                    .catch(() => {});
                                }}
                                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold whitespace-nowrap"
                              >
                                {isVi ? 'Gửi Nhanh...' : 'Share...'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-slate-300 leading-relaxed">{deck.strategySummary}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2 border-t border-slate-800/80 text-xs font-mono tabular-nums">
                      <div>
                        <span className="text-slate-400 block">
                          {isVi ? 'Tổng Bài Main / Extra' : 'Main / Extra Deck'}
                        </span>
                        <span className="text-sm font-semibold text-slate-100">
                          {mainCount} / 60 · {extraCount} / 15
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">
                          {isVi ? 'Tỉ Lệ Lên Starter' : 'Starter Consistency'}
                        </span>
                        <span className="text-sm font-semibold text-emerald-400">
                          {starterProbability}% (5-Card)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">
                          {isVi ? 'Số Lượng Hand Trap' : 'Non-Engine Hand Traps'}
                        </span>
                        <span className="text-sm font-semibold text-sky-300">
                          {handTrapCount} {isVi ? 'Lá' : 'Cards'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">
                          {isVi ? 'Chi Phí Điểm UR / SR' : 'Total UR / SR Cost'}
                        </span>
                        <span className="text-sm font-semibold text-amber-300">
                          {neededCP.UR} UR · {neededCP.SR} SR
                        </span>
                      </div>
                    </div>

                    {/* Master Duel Banlist Visual Status & Legend Strip */}
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {isVi ? 'Banlist Master Duel:' : 'Master Duel Banlist:'}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono font-bold text-[11px] border ${
                            banlistStats.forbiddenCards > 0
                              ? 'bg-red-600/25 border-red-500 text-red-200 animate-pulse'
                              : 'bg-slate-900/90 border-slate-800 text-slate-400'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>
                            {isVi
                              ? `CẤM (0): ${banlistStats.forbiddenCards} lá`
                              : `FORBIDDEN (0): ${banlistStats.forbiddenCards}`}
                          </span>
                        </span>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-950/60 border border-red-500/50 text-red-200 font-mono font-bold text-[11px]">
                          <span className="w-4 h-4 rounded-full bg-red-600 border border-amber-300 text-white flex items-center justify-center text-[10px] leading-none">
                            1
                          </span>
                          <span>
                            {isVi
                              ? `GIỚI HẠN 1 (LIM): ${banlistStats.limitedCards} lá`
                              : `LIMITED (1): ${banlistStats.limitedCards}`}
                          </span>
                        </span>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-500/50 text-amber-200 font-mono font-bold text-[11px]">
                          <span className="w-4 h-4 rounded-full bg-amber-500 border border-yellow-200 text-slate-950 flex items-center justify-center text-[10px] font-black leading-none">
                            2
                          </span>
                          <span>
                            {isVi
                              ? `BÁN GIỚI HẠN 2 (SEMI): ${banlistStats.semiLimitedCards} lá`
                              : `SEMI-LIMITED (2): ${banlistStats.semiLimitedCards}`}
                          </span>
                        </span>
                      </div>

                      {banlistStats.violations.length > 0 && (
                        <button
                          type="button"
                          onClick={handleAutoFixBanlist}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {isVi
                              ? `Tự Động Gỡ ${banlistStats.violations.length} Lá Vi Phạm Banlist`
                              : `Auto-Fix ${banlistStats.violations.length} Banlist Violations`}
                          </span>
                        </button>
                      )}
                    </div>

                    {banlistStats.violations.length > 0 && (
                      <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-red-200">
                        <div className="flex items-start sm:items-center gap-2">
                          <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5 sm:mt-0" />
                          <span>
                            {isVi ? (
                              <>
                                <strong>Cảnh báo Banlist Master Duel:</strong> Bộ bài đang chứa lá
                                bài bị cấm hoặc vượt quá số lượng cho phép:{' '}
                                {banlistStats.violations
                                  .map(
                                    (v) =>
                                      `${v.card.name} (${v.quantity}/${v.maxAllowed} · ${v.card.banlistStatus})`
                                  )
                                  .join(', ')}
                                .
                              </>
                            ) : (
                              <>
                                <strong>Master Duel Banlist Alert:</strong> Deck contains restricted
                                cards exceeding legal limits:{' '}
                                {banlistStats.violations
                                  .map(
                                    (v) =>
                                      `${v.card.name} (${v.quantity}/${v.maxAllowed} · ${v.card.banlistStatus})`
                                  )
                                  .join(', ')}
                                .
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Interactive 5-Card Opening Hand Simulator */}
                  {testHand && (
                    <div className="p-4 sm:p-5 rounded-2xl sm:rounded-xl bg-[#111827] border border-amber-400/50 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-100">
                            {isVi
                              ? `Mô Phỏng Bài Mở Màn (${testHand.length} Lá Trên Tay)`
                              : `Simulated Opening Hand (${testHand.length} Cards)`}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {isVi
                              ? 'Chạm vào lá bài để xem chi tiết hoặc rút thêm lá thứ 6 khi Đi Sau.'
                              : 'Tap any card to inspect its starter line or draw a 6th card.'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setTestHand(dealTestHand(deck.entries, 6))}
                            className="min-h-[40px] px-3 py-1.5 text-xs font-medium bg-slate-900 border border-slate-700 rounded-lg hover:border-amber-400 text-slate-200 whitespace-nowrap"
                          >
                            {isVi ? 'Rút Lá Thứ 6 (Đi Sau)' : 'Draw 6th Card'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTestHand(dealTestHand(deck.entries, 5))}
                            className="min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 flex items-center gap-1 whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{isVi ? 'Rút Lại' : 'Redraw'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTestHand(null)}
                            className="min-h-[40px] px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                          >
                            {isVi ? 'Đóng' : 'Close'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3">
                        {testHand.map((c, idx) => (
                          <CardArtwork
                            key={`${c.id}-${idx}`}
                            card={c}
                            onClick={() => {
                              const found = deck.entries.find((e) => e.card.id === c.id);
                              if (found) {
                                setSelectedEntry(found);
                                setRightDockMode('inspector');
                                setMobileInspectorOpen(true);
                              }
                            }}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main Deck Visual Card Table */}
                  <div
                    id="main-deck-section"
                    className="relative rounded-2xl sm:rounded-xl overflow-hidden border border-slate-800 bg-[#0D1322] p-3.5 sm:p-5 space-y-3.5 sm:space-y-4"
                  >
                    {deck.customPlaymatUrl && (
                      <img
                        src={deck.customPlaymatUrl}
                        alt="Equipped Duel Field Playmat"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                      />
                    )}

                    <div className="relative z-10 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs sm:text-sm font-semibold text-slate-100 font-mono tabular-nums">
                          {isVi
                            ? `01. Main Deck (${mainCount} Lá · Chuẩn: 40–60)`
                            : `01. Main Deck (${mainCount} Cards · Legal: 40–60)`}
                        </h3>
                        <p className="text-[11px] text-slate-400 sm:hidden">
                          {isVi
                            ? 'Chạm vào lá bài để xem Tiếng Việt & chỉnh số lượng'
                            : 'Tap any card to inspect & adjust quantity'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Mobile Grid Size Switcher (3-Col Large vs 4-Col Compact) */}
                        <button
                          type="button"
                          onClick={() => setMobileGridCols((c) => (c === 3 ? 4 : 3))}
                          className="sm:hidden min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 flex items-center gap-1 whitespace-nowrap"
                        >
                          <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
                          <span>{mobileGridCols === 3 ? '3 Cột' : '4 Cột'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('database')}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-xs text-amber-400 hover:border-amber-400 flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isVi ? 'Thêm Bài' : 'Add Cards'}</span>
                        </button>
                      </div>
                    </div>

                    <div
                      className={`relative z-10 grid ${
                        mobileGridCols === 4 ? 'grid-cols-4' : 'grid-cols-3'
                      } sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-3`}
                    >
                      {mainEntries.map((entry) => (
                        <CardArtwork
                          key={`main-${entry.card.id}`}
                          card={entry.card}
                          quantity={entry.quantity}
                          selected={selectedEntry?.card.id === entry.card.id}
                          showSleeveBack={showCustomSleeves}
                          sleeveUrl={deck.customSleeveUrl}
                          onClick={() => {
                            setSelectedEntry(entry);
                            setRightDockMode('inspector');
                            setMobileInspectorOpen(true);
                          }}
                          onAdd={(e) => {
                            e.stopPropagation();
                            handleAdjustQuantity(entry.card.id, 1);
                          }}
                          onRemove={(e) => {
                            e.stopPropagation();
                            handleAdjustQuantity(entry.card.id, -1);
                          }}
                          compact
                        />
                      ))}
                    </div>
                  </div>

                  {/* Extra Deck Visual Card Table */}
                  <div
                    id="extra-deck-section"
                    className="rounded-2xl sm:rounded-xl border border-slate-800 bg-[#0D1322] p-3.5 sm:p-5 space-y-3.5 sm:space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-semibold text-slate-100 font-mono tabular-nums">
                        {isVi
                          ? `02. Extra Deck (${extraCount} / 15 Lá · Fusion, Synchro, Xyz & Link)`
                          : `02. Extra Deck (${extraCount} / 15 Cards)`}
                      </h3>
                    </div>

                    <div
                      className={`grid ${
                        mobileGridCols === 4 ? 'grid-cols-4' : 'grid-cols-3'
                      } sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-3`}
                    >
                      {extraEntries.map((entry) => (
                        <CardArtwork
                          key={`extra-${entry.card.id}`}
                          card={entry.card}
                          quantity={entry.quantity}
                          selected={selectedEntry?.card.id === entry.card.id}
                          showSleeveBack={showCustomSleeves}
                          sleeveUrl={deck.customSleeveUrl}
                          onClick={() => {
                            setSelectedEntry(entry);
                            setRightDockMode('inspector');
                            setMobileInspectorOpen(true);
                          }}
                          onAdd={(e) => {
                            e.stopPropagation();
                            handleAdjustQuantity(entry.card.id, 1);
                          }}
                          onRemove={(e) => {
                            e.stopPropagation();
                            handleAdjustQuantity(entry.card.id, -1);
                          }}
                          compact
                        />
                      ))}
                    </div>
                  </div>

                  {/* 03. Interactive How-To-Play Playbook & Tactical Guide for the Newly Created Deck */}
                  <DeckPlaybookGuide
                    deck={deck}
                    onSelectEntry={(entry) => {
                      setSelectedEntry(entry);
                      setRightDockMode('inspector');
                      setMobileInspectorOpen(true);
                    }}
                  />
                </div>

                {/* Desktop Right 4 Columns: Recent Decks Sidebar, Card Passcode Inspector & Free AI Duelist Coach */}
                <div className="hidden lg:block lg:col-span-4 space-y-4 sticky top-20">
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setRightDockMode('recent')}
                      className={`py-2 px-2.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                        rightDockMode === 'recent'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>
                        {isVi
                          ? `Gần Đây (${recentDecks.length}/5)`
                          : `Recent (${recentDecks.length}/5)`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightDockMode('coach')}
                      className={`py-2 px-2.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                        rightDockMode === 'coach'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Cố Vấn AI' : 'AI Coach'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightDockMode('inspector')}
                      className={`py-2 px-2.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                        rightDockMode === 'inspector'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Chi Tiết Bài' : 'Inspector'}</span>
                    </button>
                  </div>

                  {rightDockMode === 'recent' ? (
                    <RecentDecksSidebar
                      activeDeck={deck}
                      recentDecks={recentDecks}
                      onSelectDeck={handleSelectRecentDeck}
                      onSaveCurrentDeck={handleSaveCurrentDeckToRecent}
                      onDeleteRecentDeck={handleDeleteRecentDeck}
                      onClearRecentDecks={handleClearRecentDecks}
                      translatedEffects={translatedEffects}
                    />
                  ) : rightDockMode === 'coach' ? (
                    <DuelistCoachDrawer
                      deck={deck}
                      onApplySuggestedChanges={handleApplyCoachChanges}
                    />
                  ) : selectedEntry ? (
                    <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-4">
                      <div className="flex gap-4">
                        <div className="w-28 shrink-0">
                          <CardArtwork
                            card={selectedEntry.card}
                            quantity={selectedEntry.quantity}
                          />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <div className="text-[11px] font-mono text-amber-400">
                            {selectedEntry.role} ·{' '}
                            {selectedEntry.section === 'extra' ? 'Extra Deck' : 'Main Deck'}
                          </div>
                          <h3 className="text-base font-bold text-slate-100 leading-snug">
                            {selectedEntry.card.name}
                          </h3>
                          <div className="text-xs font-mono tabular-nums text-slate-400">
                            {selectedEntry.card.mdRarity} · ID {selectedEntry.card.id}
                          </div>
                          {selectedEntry.card.banlistStatus !== 'Unlimited' && (
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border ${
                                selectedEntry.card.banlistStatus === 'Forbidden'
                                  ? 'bg-red-600/25 border-red-500 text-red-200'
                                  : selectedEntry.card.banlistStatus === 'Limited'
                                  ? 'bg-red-950/80 border-red-500/70 text-red-200'
                                  : 'bg-amber-950/80 border-amber-500/70 text-amber-200'
                              }`}
                            >
                              {selectedEntry.card.banlistStatus === 'Forbidden' ? (
                                <>
                                  <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                  <span>
                                    {isVi
                                      ? 'BỊ CẤM (FORBIDDEN · TỐI ĐA 0 LÁ)'
                                      : 'FORBIDDEN (MAX 0 COPIES)'}
                                  </span>
                                </>
                              ) : selectedEntry.card.banlistStatus === 'Limited' ? (
                                <>
                                  <span className="w-4 h-4 rounded-full bg-red-600 border border-amber-300 text-white flex items-center justify-center text-[10px]">
                                    1
                                  </span>
                                  <span>
                                    {isVi
                                      ? 'GIỚI HẠN 1 LÁ (LIMITED · MAX 1)'
                                      : 'LIMITED TO 1 COPY (MAX 1)'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="w-4 h-4 rounded-full bg-amber-500 border border-yellow-200 text-slate-950 flex items-center justify-center text-[10px] font-black">
                                    2
                                  </span>
                                  <span>
                                    {isVi
                                      ? 'BÁN GIỚI HẠN 2 LÁ (SEMI-LIMITED · MAX 2)'
                                      : 'SEMI-LIMITED TO 2 COPIES (MAX 2)'}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-slate-300">
                            {selectedEntry.card.attribute
                              ? `${selectedEntry.card.attribute} · `
                              : ''}
                            {selectedEntry.card.race} · {selectedEntry.card.type}
                          </div>
                          {typeof selectedEntry.card.atk === 'number' && (
                            <div className="text-xs font-mono tabular-nums text-amber-300">
                              ATK {selectedEntry.card.atk}
                              {typeof selectedEntry.card.def === 'number'
                                ? ` / DEF ${selectedEntry.card.def}`
                                : selectedEntry.card.linkval
                                ? ` / LINK-${selectedEntry.card.linkval}`
                                : ''}
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedEntry.reason && (
                        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-amber-200/90">
                          <strong className="font-semibold text-amber-300">
                            {isVi ? 'Vai trò chiến thuật:' : 'Tactical Role:'}
                          </strong>{' '}
                          {selectedEntry.reason}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">
                          {isVi ? 'Hiệu Ứng Lá Bài' : 'Card Effect Text'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTranslateSelectedCard(selectedEntry.card)}
                          disabled={isTranslatingCard}
                          className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <Languages className="w-3.5 h-3.5" />
                          <span>
                            {translatedEffects[selectedEntry.card.id]
                              ? isVi
                                ? 'Đang hiển thị bản dịch Tiếng Việt'
                                : 'Showing Vietnamese Translation'
                              : isTranslatingCard
                              ? isVi
                                ? 'Đang dịch hiệu ứng...'
                                : 'Translating...'
                              : isVi
                              ? 'Dịch Hiệu Ứng Sang Tiếng Việt'
                              : 'Translate Effect to Vietnamese'}
                          </span>
                        </button>
                      </div>

                      <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                        {translatedEffects[selectedEntry.card.id] || selectedEntry.card.desc}
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        <div className="text-xs font-mono tabular-nums text-slate-400">
                          {isVi ? 'Số lượng' : 'Copies'}: {selectedEntry.quantity} /{' '}
                          {getMaxAllowedCopies(selectedEntry.card.banlistStatus)}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAdjustQuantity(selectedEntry.card.id, -1)}
                            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs font-mono text-slate-200"
                          >
                            {isVi ? '-1 Lá' : '-1 Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustQuantity(selectedEntry.card.id, 1)}
                            disabled={
                              selectedEntry.quantity >=
                              getMaxAllowedCopies(selectedEntry.card.banlistStatus)
                            }
                            className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-xs font-mono font-semibold text-slate-950"
                          >
                            {isVi ? '+1 Lá' : '+1 Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleAdjustQuantity(
                                selectedEntry.card.id,
                                -selectedEntry.quantity
                              );
                              setSelectedEntry(deck.entries[0] || null);
                            }}
                            title={isVi ? 'Xóa lá bài khỏi Deck' : 'Remove card from deck'}
                            className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-red-400 text-slate-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Mobile Bottom Sheet 1: Card Inspector & Quantity Adjuster (< 1024px) */}
        {mobileInspectorOpen && selectedEntry && (
          <div
            className="fixed inset-0 z-50 lg:hidden bg-black/65 backdrop-blur-sm flex items-end"
            onClick={() => setMobileInspectorOpen(false)}
          >
            <div
              className="w-full max-h-[84vh] rounded-t-3xl bg-[#111827] border-t border-slate-700 p-4 pb-8 space-y-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3.5 min-w-0">
                  <div className="w-20 shrink-0">
                    <CardArtwork card={selectedEntry.card} quantity={selectedEntry.quantity} />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="text-[11px] font-mono text-amber-400">
                      {selectedEntry.role} ·{' '}
                      {selectedEntry.section === 'extra' ? 'Extra Deck' : 'Main Deck'}
                    </div>
                    <h3 className="text-base font-bold text-slate-100 leading-snug">
                      {selectedEntry.card.name}
                    </h3>
                    <div className="text-xs font-mono tabular-nums text-slate-400">
                      {selectedEntry.card.mdRarity} · ID {selectedEntry.card.id}
                    </div>
                    {selectedEntry.card.banlistStatus !== 'Unlimited' && (
                      <div
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          selectedEntry.card.banlistStatus === 'Forbidden'
                            ? 'bg-red-600/25 border-red-500 text-red-200'
                            : selectedEntry.card.banlistStatus === 'Limited'
                            ? 'bg-red-950/80 border-red-500/70 text-red-200'
                            : 'bg-amber-950/80 border-amber-500/70 text-amber-200'
                        }`}
                      >
                        {selectedEntry.card.banlistStatus === 'Forbidden'
                          ? isVi
                            ? '⛔ CẤM (FORBIDDEN · MAX 0)'
                            : '⛔ FORBIDDEN (MAX 0)'
                          : selectedEntry.card.banlistStatus === 'Limited'
                          ? isVi
                            ? '🔴 GIỚI HẠN 1 LÁ (LIMITED)'
                            : '🔴 LIMITED (MAX 1)'
                          : isVi
                          ? '🟠 BÁN GIỚI HẠN 2 LÁ (SEMI)'
                          : '🟠 SEMI-LIMITED (MAX 2)'}
                      </div>
                    )}
                    {typeof selectedEntry.card.atk === 'number' && (
                      <div className="text-xs font-mono tabular-nums text-amber-300">
                        ATK {selectedEntry.card.atk}
                        {typeof selectedEntry.card.def === 'number'
                          ? ` / DEF ${selectedEntry.card.def}`
                          : selectedEntry.card.linkval
                          ? ` / LINK-${selectedEntry.card.linkval}`
                          : ''}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileInspectorOpen(false)}
                  aria-label="Close card inspector"
                  className="min-h-[44px] min-w-[44px] rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedEntry.reason && (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-amber-200/90">
                  <strong className="font-semibold text-amber-300">
                    {isVi ? 'Vai trò:' : 'Role:'}
                  </strong>{' '}
                  {selectedEntry.reason}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  {isVi ? 'Hiệu Ứng Lá Bài' : 'Card Effect'}
                </span>
                <button
                  type="button"
                  onClick={() => handleTranslateSelectedCard(selectedEntry.card)}
                  disabled={isTranslatingCard}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-amber-400 flex items-center gap-1.5"
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>
                    {translatedEffects[selectedEntry.card.id]
                      ? isVi
                        ? 'Đã dịch Tiếng Việt'
                        : 'Translated'
                      : isVi
                      ? 'Dịch sang Tiếng Việt'
                      : 'Translate to VI'}
                  </span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-44 overflow-y-auto whitespace-pre-wrap">
                {translatedEffects[selectedEntry.card.id] || selectedEntry.card.desc}
              </div>

              {/* Thumb-Zone 48px Quantity & Removal Action Bar */}
              <div className="pt-2 border-t border-slate-800 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleAdjustQuantity(selectedEntry.card.id, -1)}
                  className="flex-1 min-h-[48px] rounded-xl bg-slate-900 border border-slate-700 active:scale-[0.98] text-sm font-mono font-semibold text-slate-200"
                >
                  {isVi ? '-1 Bản Sao' : '-1 Copy'}
                </button>
                <div className="px-3 text-center font-mono tabular-nums text-xs text-slate-300">
                  <div className="text-amber-300 font-bold text-sm">
                    {selectedEntry.quantity} /{' '}
                    {getMaxAllowedCopies(selectedEntry.card.banlistStatus)}
                  </div>
                  <div className="text-[10px] text-slate-400">{isVi ? 'Trong Deck' : 'Copies'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdjustQuantity(selectedEntry.card.id, 1)}
                  disabled={
                    selectedEntry.quantity >=
                    getMaxAllowedCopies(selectedEntry.card.banlistStatus)
                  }
                  className="flex-1 min-h-[48px] rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] disabled:opacity-40 text-sm font-mono font-bold text-slate-950"
                >
                  {isVi ? '+1 Bản Sao' : '+1 Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAdjustQuantity(selectedEntry.card.id, -selectedEntry.quantity);
                    setMobileInspectorOpen(false);
                  }}
                  aria-label="Remove card from deck"
                  className="min-h-[48px] min-w-[48px] rounded-xl bg-slate-900 border border-slate-700 text-red-400 flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Sheet 2: Multi-Turn Gemini Duelist Coach Drawer (< 1024px) */}
        {mobileCoachOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden bg-black/65 backdrop-blur-sm flex items-end"
            onClick={() => setMobileCoachOpen(false)}
          >
            <div
              className="w-full max-h-[88vh] rounded-t-3xl bg-[#111827] border-t border-slate-700 p-3 pb-6 space-y-2 overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-2 pt-1">
                <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto" />
                <button
                  type="button"
                  onClick={() => setMobileCoachOpen(false)}
                  aria-label="Close AI Coach"
                  className="min-h-[36px] min-w-[36px] rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <DuelistCoachDrawer
                deck={deck}
                onApplySuggestedChanges={handleApplyCoachChanges}
              />
            </div>
          </div>
        )}

        {/* Mobile Bottom Sheet 3: Recent Decks Sidebar Drawer (< 1024px) */}
        {mobileRecentOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden bg-black/65 backdrop-blur-sm flex items-end"
            onClick={() => setMobileRecentOpen(false)}
          >
            <div
              className="w-full max-h-[86vh] rounded-t-3xl bg-[#111827] border-t border-slate-700 p-3 pb-8 space-y-2 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-2 pt-1">
                <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto" />
                <button
                  type="button"
                  onClick={() => setMobileRecentOpen(false)}
                  aria-label="Close Recent Decks"
                  className="min-h-[36px] min-w-[36px] rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <RecentDecksSidebar
                activeDeck={deck}
                recentDecks={recentDecks}
                onSelectDeck={handleSelectRecentDeck}
                onSaveCurrentDeck={handleSaveCurrentDeckToRecent}
                onDeleteRecentDeck={handleDeleteRecentDeck}
                onClearRecentDecks={handleClearRecentDecks}
                translatedEffects={translatedEffects}
              />
            </div>
          </div>
        )}

        {/* Fixed Mobile Bottom Tab Bar (Thumb-Zone Navigation Anchor, md:hidden) */}
        <nav
          aria-label="Mobile Navigation"
          className="fixed bottom-0 left-0 right-0 z-40 md:hidden h-14 bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-5 items-center pb-safe"
        >
          <button
            type="button"
            onClick={() => {
              setMobileCoachOpen(false);
              setActiveTab('builder');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'builder' && !mobileCoachOpen ? 'text-amber-400' : 'text-slate-400'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              {isVi ? 'Xây Deck' : 'Builder'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileCoachOpen((v) => !v)}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              mobileCoachOpen ? 'text-amber-400' : 'text-slate-400'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              {isVi ? 'Cố Vấn AI' : 'AI Coach'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileCoachOpen(false);
              setActiveTab('import_guide');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'import_guide' && !mobileCoachOpen
                ? 'text-amber-400'
                : 'text-slate-400'
            }`}
          >
            <FileCode2 className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              {isVi ? 'Nhập Game' : 'Import'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileCoachOpen(false);
              setActiveTab('visual_studio');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'visual_studio' && !mobileCoachOpen
                ? 'text-amber-400'
                : 'text-slate-400'
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              {isVi ? 'Hình Ảnh' : 'Studio'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileCoachOpen(false);
              setActiveTab('database');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'database' && !mobileCoachOpen ? 'text-amber-400' : 'text-slate-400'
            }`}
          >
            <Database className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              {isVi ? 'Thư Viện' : 'Cards'}
            </span>
          </button>
        </nav>
      </div>
    </LanguageContext.Provider>
  );
}
