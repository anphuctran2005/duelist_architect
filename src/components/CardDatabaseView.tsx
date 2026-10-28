import React, { useEffect, useState } from 'react';
import { Languages, Plus, Search, Sparkles, X } from 'lucide-react';
import { translateYgoEffectFallbackVi, useLanguage } from '../i18n/translations';
import { DeckState, YgoCard } from '../types/ygo';
import { getMaxAllowedCopies, isExtraDeckCard } from '../utils/ydk';
import { CardArtwork } from './CardArtwork';

interface CardDatabaseViewProps {
  deck: DeckState;
  onAddCardToDeck: (card: YgoCard) => void;
}

export const CardDatabaseView: React.FC<CardDatabaseViewProps> = ({ deck, onAddCardToDeck }) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  const [query, setQuery] = useState('Fire King');
  const [attribute, setAttribute] = useState('ALL');
  const [results, setResults] = useState<YgoCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<YgoCard | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [translatedEffects, setTranslatedEffects] = useState<Record<number, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  const performSearch = async (searchQuery: string, attrFilter: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (attrFilter !== 'ALL') params.set('attribute', attrFilter);
      params.set('limit', '36');

      const res = await fetch(`/api/cards/search?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data.cards)) {
        setResults(data.cards);
        if (data.cards.length > 0 && !selectedCard) {
          setSelectedCard(data.cards[0]);
        }
      }
    } catch {
      // Ignore error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    performSearch(query, attribute);
  }, []);

  const getDeckCopyCount = (cardId: number) => {
    return deck.entries
      .filter((e) => e.card.id === cardId)
      .reduce((acc, e) => acc + e.quantity, 0);
  };

  const handleTranslateEffect = async (card: YgoCard) => {
    if (translatedEffects[card.id] || isTranslating) return;
    setIsTranslating(true);
    try {
      const res = await fetch('/api/cards/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardName: card.name, desc: card.desc }),
      });
      const data = await res.json();
      const text = data.translatedDesc || translateYgoEffectFallbackVi(card.desc);
      setTranslatedEffects((prev) => ({ ...prev, [card.id]: text }));
    } catch {
      setTranslatedEffects((prev) => ({
        ...prev,
        [card.id]: translateYgoEffectFallbackVi(card.desc),
      }));
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-[11px] sm:text-xs font-mono text-amber-400 tracking-wide">
            {isVi
              ? 'CƠ SỞ DỮ LIỆU YGOPRODECK · HƠN 13.000 MÃ PASSCODE KONAMI'
              : 'LIVE YGOPRODECK API · 13,000+ KONAMI PASSCODES'}
          </div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-100 font-display">
            {isVi
              ? 'Thư Viện Tra Cứu Lá Bài & Mã Passcode'
              : 'Official Yu-Gi-Oh! Card & Passcode Database'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {isVi ? (
              <>
                Tìm theo tên tiếng Anh hoặc biệt danh tiếng Việt (VD:{' '}
                <em>Rồng Trắng Mắt Xanh, Hỏa Vương, Lạc Ấn, Mê Cung Bạc</em>) và chạm vào lá bài để
                xem hiệu ứng hoặc thêm vào <strong>{deck.name}</strong>.
              </>
            ) : (
              <>
                Search by card name or archetype and tap any card to inspect its passcode and add it
                to <strong>{deck.name}</strong>.
              </>
            )}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            performSearch(query, attribute);
          }}
          className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 shrink-0"
        >
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isVi
                  ? 'Tìm tên bài (VD: Blue-Eyes, Rồng Trắng)...'
                  : 'Search card name (e.g. Blue-Eyes)...'
              }
              className="w-full min-h-[44px] pl-9 pr-4 py-2 rounded-xl sm:rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <select
              value={attribute}
              onChange={(e) => {
                setAttribute(e.target.value);
                performSearch(query, e.target.value);
              }}
              aria-label="Filter by Attribute"
              className="min-h-[44px] px-3 py-2 rounded-xl sm:rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">{isVi ? 'Mọi Hệ (Attribute)' : 'All Attributes'}</option>
              <option value="DARK">DARK (Bóng Tối)</option>
              <option value="LIGHT">LIGHT (Ánh Sáng)</option>
              <option value="FIRE">FIRE (Lửa)</option>
              <option value="WATER">WATER (Nước)</option>
              <option value="EARTH">EARTH (Đất)</option>
              <option value="WIND">WIND (Gió)</option>
            </select>

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] px-4 py-2 rounded-xl sm:rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-semibold text-xs transition-all whitespace-nowrap shrink-0"
            >
              {isLoading ? (isVi ? 'Đang tìm...' : 'Searching...') : isVi ? 'Tìm Bài' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        <div className="lg:col-span-8">
          {isLoading ? (
            <div className="p-12 rounded-2xl bg-[#111827] border border-slate-800 flex items-center justify-center gap-2 text-sm text-slate-400">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
              <span>
                {isVi
                  ? 'Đang truy vấn cơ sở dữ liệu YGOPRODeck...'
                  : 'Querying live YGOPRODeck database...'}
              </span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#111827] border border-slate-800 text-center space-y-3">
              <div className="text-sm font-medium text-slate-200">
                {isVi
                  ? `Không tìm thấy lá bài nào khớp với "${query}"`
                  : `No cards matched "${query}"`}
              </div>
              <p className="text-xs text-slate-400">
                {isVi
                  ? 'Hãy thử tìm theo tên tộc bài như "Snake-Eye", "Branded", "Tenpai", "Rồng Trắng", hoặc "Sky Striker".'
                  : 'Try searching for an archetype like "Snake-Eye", "Branded", "Tenpai", or "Sky Striker".'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-3">
              {results.map((card) => {
                const countInDeck = getDeckCopyCount(card.id);
                return (
                  <CardArtwork
                    key={card.id}
                    card={card}
                    quantity={countInDeck > 0 ? countInDeck : undefined}
                    selected={selectedCard?.id === card.id}
                    onClick={() => {
                      setSelectedCard(card);
                      setMobileSheetOpen(true);
                    }}
                    onAdd={(e) => {
                      e.stopPropagation();
                      setSelectedCard(card);
                      onAddCardToDeck(card);
                    }}
                    compact
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Right 4 Columns Inspector */}
        <div className="hidden lg:block lg:col-span-4 p-6 rounded-xl bg-[#111827] border border-slate-800 space-y-5 sticky top-20">
          {selectedCard ? (
            <>
              <div className="flex gap-4">
                <div className="w-28 shrink-0">
                  <CardArtwork card={selectedCard} />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <h2 className="text-base font-bold text-slate-100 leading-snug">
                    {selectedCard.name}
                  </h2>
                  <div className="text-xs text-slate-400 font-mono tabular-nums leading-relaxed">
                    <span>{selectedCard.mdRarity}</span>
                    <span> · </span>
                    <span>{selectedCard.banlistStatus}</span>
                    <span> · </span>
                    <span>ID {selectedCard.id}</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    {selectedCard.attribute ? `${selectedCard.attribute} · ` : ''}
                    {selectedCard.race} · {selectedCard.type}
                  </div>
                  {typeof selectedCard.atk === 'number' && (
                    <div className="text-xs font-mono tabular-nums text-amber-300">
                      ATK {selectedCard.atk}
                      {typeof selectedCard.def === 'number'
                        ? ` / DEF ${selectedCard.def}`
                        : selectedCard.linkval
                        ? ` / LINK-${selectedCard.linkval}`
                        : ''}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  {isVi ? 'Hiệu Ứng Lá Bài' : 'Card Effect Text'}
                </span>
                <button
                  type="button"
                  onClick={() => handleTranslateEffect(selectedCard)}
                  disabled={isTranslating}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>
                    {translatedEffects[selectedCard.id]
                      ? isVi
                        ? 'Đã dịch sang Tiếng Việt'
                        : 'Translated to Vietnamese'
                      : isTranslating
                      ? isVi
                        ? 'Đang dịch...'
                        : 'Translating...'
                      : isVi
                      ? 'Dịch sang Tiếng Việt'
                      : 'Translate to Vietnamese'}
                  </span>
                </button>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/90 text-xs text-slate-300 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                {translatedEffects[selectedCard.id] || selectedCard.desc}
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <div className="text-xs font-mono tabular-nums text-slate-400">
                  {isVi ? 'Trong Deck' : 'In Deck'}: {getDeckCopyCount(selectedCard.id)} /{' '}
                  {getMaxAllowedCopies(selectedCard.banlistStatus)}
                </div>
                <button
                  type="button"
                  onClick={() => onAddCardToDeck(selectedCard)}
                  disabled={
                    getDeckCopyCount(selectedCard.id) >=
                    getMaxAllowedCopies(selectedCard.banlistStatus)
                  }
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {isVi
                      ? `Thêm vào ${isExtraDeckCard(selectedCard) ? 'Extra Deck' : 'Main Deck'}`
                      : `Add to ${isExtraDeckCard(selectedCard) ? 'Extra Deck' : 'Main Deck'}`}
                  </span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile Bottom Sheet Inspector when tapping a card on < 1024px */}
      {mobileSheetOpen && selectedCard && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/65 backdrop-blur-sm flex items-end"
          onClick={() => setMobileSheetOpen(false)}
        >
          <div
            className="w-full max-h-[82vh] rounded-t-3xl bg-[#111827] border-t border-slate-700 p-4 pb-8 space-y-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3.5 min-w-0">
                <div className="w-20 shrink-0">
                  <CardArtwork card={selectedCard} />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-100 leading-snug">
                    {selectedCard.name}
                  </h3>
                  <div className="text-xs font-mono tabular-nums text-slate-400">
                    {selectedCard.mdRarity} · {selectedCard.banlistStatus} · ID {selectedCard.id}
                  </div>
                  <div className="text-xs text-slate-300">
                    {selectedCard.attribute ? `${selectedCard.attribute} · ` : ''}
                    {selectedCard.race} · {selectedCard.type}
                  </div>
                  {typeof selectedCard.atk === 'number' && (
                    <div className="text-xs font-mono tabular-nums text-amber-300">
                      ATK {selectedCard.atk}
                      {typeof selectedCard.def === 'number'
                        ? ` / DEF ${selectedCard.def}`
                        : selectedCard.linkval
                        ? ` / LINK-${selectedCard.linkval}`
                        : ''}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Close card inspector"
                className="min-h-[44px] min-w-[44px] rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-slate-300">
                {isVi ? 'Hiệu Ứng Lá Bài' : 'Card Effect'}
              </span>
              <button
                type="button"
                onClick={() => handleTranslateEffect(selectedCard)}
                disabled={isTranslating}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-amber-400 flex items-center gap-1.5"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>
                  {translatedEffects[selectedCard.id]
                    ? isVi
                      ? 'Đã dịch Tiếng Việt'
                      : 'Translated'
                    : isVi
                    ? 'Dịch sang Tiếng Việt'
                    : 'Translate to VI'}
                </span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
              {translatedEffects[selectedCard.id] || selectedCard.desc}
            </div>

            <div className="pt-2 flex items-center gap-3">
              <div className="text-xs font-mono tabular-nums text-slate-300 shrink-0">
                {isVi ? 'Trong Deck' : 'In Deck'}: {getDeckCopyCount(selectedCard.id)} /{' '}
                {getMaxAllowedCopies(selectedCard.banlistStatus)}
              </div>
              <button
                type="button"
                onClick={() => onAddCardToDeck(selectedCard)}
                disabled={
                  getDeckCopyCount(selectedCard.id) >=
                  getMaxAllowedCopies(selectedCard.banlistStatus)
                }
                className="flex-1 min-h-[48px] rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] disabled:opacity-40 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isVi
                    ? `Thêm Vào ${isExtraDeckCard(selectedCard) ? 'Extra Deck' : 'Main Deck'}`
                    : `Add to ${isExtraDeckCard(selectedCard) ? 'Extra Deck' : 'Main Deck'}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
