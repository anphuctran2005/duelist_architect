import React, { useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Clock,
  Download,
  FileSpreadsheet,
  FolderOpen,
  History,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../i18n/translations';
import { DeckState } from '../types/ygo';
import { buildShareableDeckUrl, calculateCraftingPoints, downloadYdkFile } from '../utils/ydk';
import { exportDeckToExcel } from '../utils/excelExport';

export interface RecentDeckRecord {
  id: string;
  deck: DeckState;
  savedAt: string;
  promptUsed?: string;
  source: 'ai-generated' | 'ydk-imported' | 'manual-saved' | 'preset';
}

export const RECENT_DECKS_STORAGE_KEY = 'duelist_architect_recent_decks_v1';
export const MAX_RECENT_DECKS = 5;

export function loadRecentDecksFromStorage(fallbackDecks: DeckState[] = []): RecentDeckRecord[] {
  try {
    const raw = localStorage.getItem(RECENT_DECKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((item) => item && item.deck && Array.isArray(item.deck.entries))
          .slice(0, MAX_RECENT_DECKS);
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }

  return fallbackDecks.slice(0, 2).map((d, index) => ({
    id: d.id || `preset-${index}`,
    deck: d,
    savedAt: new Date(Date.now() - index * 3600_000).toISOString(),
    promptUsed: d.archetype,
    source: 'preset' as const,
  }));
}

export function saveRecentDecksToStorage(records: RecentDeckRecord[]): void {
  try {
    localStorage.setItem(
      RECENT_DECKS_STORAGE_KEY,
      JSON.stringify(records.slice(0, MAX_RECENT_DECKS))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function upsertRecentDeckRecord(
  currentRecords: RecentDeckRecord[],
  deck: DeckState,
  source: RecentDeckRecord['source'] = 'ai-generated',
  promptUsed?: string
): RecentDeckRecord[] {
  const signature = `${deck.name.trim().toLowerCase()}::${deck.entries
    .map((e) => `${e.card.id}:${e.quantity}`)
    .sort()
    .join(',')}`;

  const filtered = currentRecords.filter((item) => {
    const itemSig = `${item.deck.name.trim().toLowerCase()}::${item.deck.entries
      .map((e) => `${e.card.id}:${e.quantity}`)
      .sort()
      .join(',')}`;
    return item.deck.id !== deck.id && itemSig !== signature;
  });

  const nextRecord: RecentDeckRecord = {
    id: `${deck.id}-${Date.now()}`,
    deck,
    savedAt: new Date().toISOString(),
    promptUsed: promptUsed?.trim() || deck.archetype,
    source,
  };

  const updated = [nextRecord, ...filtered].slice(0, MAX_RECENT_DECKS);
  saveRecentDecksToStorage(updated);
  return updated;
}

interface RecentDecksSidebarProps {
  activeDeck: DeckState;
  recentDecks: RecentDeckRecord[];
  onSelectDeck: (deck: DeckState) => void;
  onSaveCurrentDeck: () => void;
  onDeleteRecentDeck: (recordId: string) => void;
  onClearRecentDecks: () => void;
  translatedEffects?: Record<number, string>;
}

export const RecentDecksSidebar: React.FC<RecentDecksSidebarProps> = ({
  activeDeck,
  recentDecks,
  onSelectDeck,
  onSaveCurrentDeck,
  onDeleteRecentDeck,
  onClearRecentDecks,
  translatedEffects = {},
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyDeckShareUrl = async (recordId: string, targetDeck: DeckState) => {
    const shareUrl = buildShareableDeckUrl(targetDeck);
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', shareUrl);
      }
      setCopiedId(recordId);
      setTimeout(() => setCopiedId((prev) => (prev === recordId ? null : prev)), 2500);
    } catch {
      // Ignore clipboard error
    }
  };

  const formatSavedTime = (iso: string) => {
    try {
      const date = new Date(iso);
      const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
      if (diffSec < 60) {
        return isVi ? 'Vừa xong' : 'Just now';
      }
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) {
        return isVi ? `${diffMin} phút trước` : `${diffMin}m ago`;
      }
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) {
        return isVi ? `${diffHr} giờ trước` : `${diffHr}h ago`;
      }
      return date.toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const getSourceLabel = (source: RecentDeckRecord['source']) => {
    switch (source) {
      case 'ai-generated':
        return isVi ? 'AI Tạo Mới' : 'AI Generated';
      case 'ydk-imported':
        return isVi ? 'Nạp .YDK' : '.YDK Import';
      case 'manual-saved':
        return isVi ? 'Bản Lưu Tay' : 'Saved Snapshot';
      default:
        return isVi ? 'Deck Mẫu' : 'Starter Preset';
    }
  };

  return (
    <aside
      aria-label={isVi ? 'Lịch sử 5 Deck gần đây' : 'Recent Decks Sidebar'}
      className="p-4 sm:p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-4"
    >
      {/* Header & Capacity Indicator */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/90">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400">
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isVi
                ? `DECK GẦN ĐÂY (${recentDecks.length}/${MAX_RECENT_DECKS})`
                : `RECENT DECKS (${recentDecks.length}/${MAX_RECENT_DECKS})`}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-100">
            {isVi
              ? 'Lịch Sử 5 Bản Thiết Kế Gần Nhất'
              : 'Last 5 Generated Deck Configurations'}
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isVi
              ? 'Tự động lưu 5 bộ bài vừa tạo trên trình duyệt để mở lại bất cứ lúc nào.'
              : 'Automatically stores your last 5 generated decks in local storage.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onSaveCurrentDeck}
          title={
            isVi
              ? 'Lưu cấu hình bộ bài đang chỉnh sửa vào danh sách 5 Deck gần đây'
              : 'Save current deck configuration into recent history'
          }
          className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/50 hover:bg-amber-400 hover:text-slate-950 text-amber-300 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          <span>{isVi ? 'Lưu Deck Này' : 'Save Current'}</span>
        </button>
      </div>

      {/* Stored Deck Cards List (Max 5) */}
      {recentDecks.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-950/80 border border-slate-800/80 text-center space-y-2">
          <Sparkles className="w-5 h-5 text-amber-400 mx-auto" />
          <div className="text-xs font-semibold text-slate-200">
            {isVi ? 'Chưa có lịch sử bộ bài nào' : 'No recent decks stored yet'}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isVi
              ? 'Hãy tạo bộ bài bằng AI hoặc nhấn "Lưu Deck Này" để lưu tối đa 5 cấu hình gần nhất.'
              : 'Generate a deck with AI or click "Save Current" to store up to 5 configurations.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-0.5">
          {recentDecks.map((record, index) => {
            const d = record.deck;
            const isCurrentActive = d.id === activeDeck.id && d.name === activeDeck.name;
            const mainCount = d.entries
              .filter((e) => e.section === 'main')
              .reduce((s, e) => s + e.quantity, 0);
            const extraCount = d.entries
              .filter((e) => e.section === 'extra')
              .reduce((s, e) => s + e.quantity, 0);
            const { neededCP } = calculateCraftingPoints(d.entries);

            // Pick a representative boss/starter card artwork thumbnail
            const featuredEntry =
              d.entries.find((e) => e.section === 'extra') ||
              d.entries.find((e) => e.role === 'Boss' || e.role === 'Starter') ||
              d.entries[0];
            const thumbUrl =
              featuredEntry?.card.card_images?.[0]?.image_url_cropped ||
              featuredEntry?.card.card_images?.[0]?.image_url_small;

            return (
              <div
                key={record.id}
                className={`group p-3 rounded-xl border transition-all space-y-2.5 ${
                  isCurrentActive
                    ? 'bg-amber-400/10 border-amber-400/70 shadow-sm'
                    : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Mini Card Thumbnail */}
                  <button
                    type="button"
                    onClick={() => onSelectDeck(d)}
                    className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={d.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-amber-300">
                        #{index + 1}
                      </div>
                    )}
                    <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-slate-950/90 text-[9px] font-mono font-bold text-amber-300">
                      #{index + 1}
                    </span>
                  </button>

                  {/* Deck Metadata */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          record.source === 'ai-generated'
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                            : record.source === 'manual-saved'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {getSourceLabel(record.source)}
                      </span>

                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {formatSavedTime(record.savedAt)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectDeck(d)}
                      className="block text-left w-full"
                    >
                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors truncate">
                        {d.name}
                      </h4>
                    </button>

                    <div className="text-[11px] font-mono tabular-nums text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>
                        {mainCount} Main · {extraCount} Extra
                      </span>
                      <span>·</span>
                      <span className="text-amber-300/90">
                        {neededCP.UR} UR / {neededCP.SR} SR
                      </span>
                    </div>

                    {record.promptUsed && (
                      <div className="text-[11px] text-slate-400 truncate italic">
                        "{record.promptUsed}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Strip */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectDeck(d)}
                    className={`flex-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      isCurrentActive
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-900 hover:bg-amber-400 hover:text-slate-950 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isCurrentActive
                        ? isVi
                          ? 'Đang Mở'
                          : 'Active Deck'
                        : isVi
                        ? 'Mở Lại Deck'
                        : 'Load Deck'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyDeckShareUrl(record.id, d)}
                    title={
                      isVi
                        ? 'Sao chép liên kết chia sẻ bộ bài (Base64 URL)'
                        : 'Copy shareable Base64 deck link'
                    }
                    className="min-h-[32px] px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 hover:border-sky-400 text-sky-300 text-xs font-mono flex items-center gap-1"
                  >
                    {copiedId === record.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>{isVi ? 'Đã chép' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3 h-3" />
                        <span>Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadYdkFile(d)}
                    title={isVi ? 'Tải file .YDK' : 'Download .YDK file'}
                    className="min-h-[32px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-amber-300 text-xs font-mono flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>.YDK</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportDeckToExcel(d, lang, translatedEffects)}
                    title={isVi ? 'Xuất sổ tay Excel (.xlsx)' : 'Export Excel (.xlsx)'}
                    className="min-h-[32px] px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 text-xs font-mono flex items-center gap-1"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>XLSX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteRecentDeck(record.id)}
                    title={isVi ? 'Xóa khỏi lịch sử' : 'Remove from history'}
                    className="min-h-[32px] min-w-[32px] rounded-lg bg-slate-900 border border-slate-800 hover:border-red-500/60 text-slate-400 hover:text-red-300 flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recentDecks.length > 1 && (
        <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {isVi
              ? 'Lưu cục bộ an toàn trên trình duyệt (LocalStorage)'
              : 'Stored locally in browser LocalStorage'}
          </span>
          <button
            type="button"
            onClick={onClearRecentDecks}
            className="text-slate-400 hover:text-red-300 underline"
          >
            {isVi ? 'Xóa lịch sử' : 'Clear all'}
          </button>
        </div>
      )}
    </aside>
  );
};
