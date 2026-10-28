import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileUp,
  Layers,
  Smartphone,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useLanguage } from '../i18n/translations';
import { DeckEntry, DeckState, MasterDuelRarity } from '../types/ygo';
import { exportDeckToExcel } from '../utils/excelExport';
import {
  calculateCraftingPoints,
  downloadYdkFile,
  formatPlainTextDecklist,
  parseYdkContent,
  serializeToYdk,
  serializeToYdkeUrl,
} from '../utils/ydk';

interface MasterDuelImportGuideProps {
  deck: DeckState;
  onImportYdkPasscodes: (
    parsed: { mainIds: number[]; extraIds: number[]; sideIds: number[] },
    fileName?: string
  ) => Promise<void>;
  isImportingYdk: boolean;
}

export const MasterDuelImportGuide: React.FC<MasterDuelImportGuideProps> = ({
  deck,
  onImportYdkPasscodes,
  isImportingYdk,
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  const [activeMethod, setActiveMethod] = useState<'neuron' | 'ydk_extension' | 'craft_checklist'>(
    'neuron'
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [ownedCards, setOwnedCards] = useState<Record<number, boolean>>({});
  const [rarityFilter, setRarityFilter] = useState<'ALL' | MasterDuelRarity>('ALL');
  const [pasteYdkModalOpen, setPasteYdkModalOpen] = useState(false);
  const [pastedYdkText, setPastedYdkText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ydkText = useMemo(() => serializeToYdk(deck), [deck]);
  const ydkeUrl = useMemo(() => serializeToYdkeUrl(deck), [deck]);
  const plainTextList = useMemo(() => formatPlainTextDecklist(deck), [deck]);

  const { totalCounts, neededCP } = useMemo(
    () => calculateCraftingPoints(deck.entries, ownedCards),
    [deck.entries, ownedCards]
  );

  const mainCount = useMemo(
    () => deck.entries.filter((e) => e.section === 'main').reduce((s, e) => s + e.quantity, 0),
    [deck.entries]
  );
  const extraCount = useMemo(
    () => deck.entries.filter((e) => e.section === 'extra').reduce((s, e) => s + e.quantity, 0),
    [deck.entries]
  );

  const filteredChecklistEntries = useMemo(() => {
    return deck.entries.filter((entry) => {
      if (entry.section === 'side') return false;
      if (rarityFilter !== 'ALL' && entry.card.mdRarity !== rarityFilter) return false;
      return true;
    });
  }, [deck.entries, rarityFilter]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback copy
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseYdkContent(text);
    await onImportYdkPasscodes(parsed, file.name.replace(/\.ydk$/i, ''));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasteYdkSubmit = async () => {
    if (!pastedYdkText.trim()) return;
    const parsed = parseYdkContent(pastedYdkText);
    await onImportYdkPasscodes(parsed, isVi ? 'Bộ Bài YDK Đã Nhập' : 'Imported YDK Deck');
    setPasteYdkModalOpen(false);
    setPastedYdkText('');
  };

  const toggleOwned = (cardId: number) => {
    setOwnedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header & Direct Export Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 pb-5 sm:pb-6 border-b border-slate-800">
        <div className="space-y-1.5 sm:space-y-2 max-w-2xl">
          <div className="text-[11px] sm:text-xs font-mono text-amber-400 tracking-wide">
            {isVi
              ? 'TƯƠNG THÍCH YU-GI-OH! MASTER DUEL · XUẤT FILE .YDK, EXCEL & NEURON'
              : 'MASTER DUEL COMPATIBILITY & EXPORT SUITE'}
          </div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-100 font-display">
            {isVi
              ? `Nhập "${deck.name}" Vào Master Duel`
              : `Import "${deck.name}" into Yu-Gi-Oh! Master Duel`}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {isVi ? (
              <>
                Toàn bộ lá bài đã được xác thực mã Passcode 8 chữ số chính thức từ Konami. Tải về
                file <code className="font-mono text-slate-200">.ydk</code>, xuất{' '}
                <strong>Sổ Tay Chiến Thuật Excel (.xlsx)</strong> (gồm hiệu ứng toàn bộ bài, combo,
                lật kèo & lưu ý), hoặc đồng bộ qua <strong>Yu-Gi-Oh! Neuron</strong>.
              </>
            ) : (
              <>
                Every card in your deck has been verified against official 8-digit Konami passcodes.
                Download the standard <code className="font-mono text-slate-200">.ydk</code>{' '}
                passcode file, export the 5-sheet <strong>Excel Handbook (.xlsx)</strong>, or sync
                via Konami&apos;s official <strong>Yu-Gi-Oh! Neuron</strong> bridge.
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ydk,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => exportDeckToExcel(deck, lang)}
            className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 hover:border-emerald-400 active:scale-[0.98] rounded-xl sm:rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isVi ? 'Xuất Sổ Tay Excel (.xlsx)' : 'Export Excel Handbook (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={() => downloadYdkFile(deck)}
            className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] rounded-xl sm:rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{isVi ? 'Tải Xuống File .YDK' : 'Download .YDK Deck File'}</span>
          </button>

          <div className="grid grid-cols-2 sm:flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleCopy(ydkeUrl, 'ydke')}
              className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-xl sm:rounded-lg hover:border-slate-500 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copiedKey === 'ydke' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>
                {copiedKey === 'ydke'
                  ? isVi
                    ? 'Đã chép YDKe!'
                    : 'Copied YDKe'
                  : isVi
                  ? 'Chép Mã YDKe://'
                  : 'Copy YDKe://'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImportingYdk}
              className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-xl sm:rounded-lg hover:border-slate-500 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileUp className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isImportingYdk
                  ? isVi
                    ? 'Đang nạp...'
                    : 'Loading...'
                  : isVi
                  ? 'Tải Lên File .YDK'
                  : 'Import .YDK'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Telemetry Strip (2-col on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 p-4 sm:p-5 rounded-2xl sm:rounded-xl bg-[#111827] border border-slate-800/90">
        <div>
          <div className="text-[11px] sm:text-xs text-slate-400">
            {isVi ? 'Số Lượng Bài' : 'Main & Extra Deck'}
          </div>
          <div className="mt-1 text-base sm:text-xl font-semibold font-mono tabular-nums text-slate-100">
            {mainCount} Main · {extraCount} Extra
          </div>
          <div className="mt-0.5 text-[11px] text-emerald-400">
            {mainCount >= 40 && mainCount <= 60 && extraCount <= 15
              ? isVi
                ? 'Hợp lệ (40–60)'
                : 'Legal Ratio'
              : isVi
              ? 'Cần 40–60 lá'
              : 'Adjust to 40–60'}
          </div>
        </div>

        <div>
          <div className="text-[11px] sm:text-xs text-slate-400">
            {isVi ? 'Điểm Ultra Rare (UR)' : 'Ultra Rare (UR) Cost'}
          </div>
          <div className="mt-1 text-base sm:text-xl font-semibold font-mono tabular-nums text-amber-300">
            {neededCP.UR} UR CP
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400 font-mono tabular-nums">
            {totalCounts.UR} UR (30 CP)
          </div>
        </div>

        <div>
          <div className="text-[11px] sm:text-xs text-slate-400">
            {isVi ? 'Điểm Super Rare (SR)' : 'Super Rare (SR) Cost'}
          </div>
          <div className="mt-1 text-base sm:text-xl font-semibold font-mono tabular-nums text-purple-300">
            {neededCP.SR} SR CP
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400 font-mono tabular-nums">
            {totalCounts.SR} SR (30 CP)
          </div>
        </div>

        <div>
          <div className="text-[11px] sm:text-xs text-slate-400">
            {isVi ? 'Độ Hiếm Thấp (N / R)' : 'Low Rarity (N / R)'}
          </div>
          <div className="mt-1 text-base sm:text-xl font-semibold font-mono tabular-nums text-sky-300">
            {neededCP.R} R · {neededCP.N} N
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400 font-mono tabular-nums">
            {totalCounts.R} R · {totalCounts.N} N
          </div>
        </div>
      </div>

      {/* Main Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
          {/* Horizontal Touch Scrollable Workflow Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setActiveMethod('neuron')}
              className={`min-h-[42px] px-3.5 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeMethod === 'neuron'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>
                {isVi ? '01. Đồng Bộ Yu-Gi-Oh! Neuron' : '01. Yu-Gi-Oh! Neuron Sync'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMethod('craft_checklist')}
              className={`min-h-[42px] px-3.5 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeMethod === 'craft_checklist'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isVi ? '02. Bảng Tìm & Chế Tạo Bài' : '02. Search & Craft Checklist'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMethod('ydk_extension')}
              className={`min-h-[42px] px-3.5 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeMethod === 'ydk_extension'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{isVi ? '03. Mã YDK / YDKe' : '03. YDK / YDKe Transfer'}</span>
            </button>
          </div>

          {activeMethod === 'neuron' && (
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-xl bg-[#111827] border border-slate-800 space-y-5">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-100">
                  {isVi
                    ? 'Quy Trình Đồng Bộ Konami ID & Yu-Gi-Oh! Neuron Vào Master Duel'
                    : 'Official Konami ID & Yu-Gi-Oh! Neuron Import Workflow'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  {isVi ? (
                    <>
                      <strong>Yu-Gi-Oh! Master Duel</strong> hỗ trợ tính năng nhập trực tiếp các bộ
                      bài đã lưu trong tài khoản <strong>Yu-Gi-Oh! Neuron</strong> liên kết cùng
                      Konami ID trên điện thoại, PC và Console.
                    </>
                  ) : (
                    <>
                      Yu-Gi-Oh! Master Duel natively imports decks saved to your linked{' '}
                      <strong>Konami Card Database / Yu-Gi-Oh! Neuron</strong> account across mobile,
                      PC, and consoles.
                    </>
                  )}
                </p>
              </div>

              <div className="space-y-4">
                <div className="pb-4 border-b border-slate-800/80">
                  <div className="text-sm font-semibold text-slate-100">
                    {isVi
                      ? '01. Liên kết cùng một Konami ID trên cả Master Duel & Yu-Gi-Oh! Neuron'
                      : '01. Link Your Konami ID in Both Master Duel & Yu-Gi-Oh! Neuron'}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {isVi ? (
                      <>
                        Trong <strong>Yu-Gi-Oh! Master Duel</strong>, mở mục{' '}
                        <span className="text-slate-200">Submenu → Data Transfer</span> để liên kết
                        Konami ID. Sau đó đăng nhập cùng Konami ID đó trên ứng dụng điện thoại{' '}
                        <strong>Yu-Gi-Oh! Neuron</strong>.
                      </>
                    ) : (
                      <>
                        In <strong>Yu-Gi-Oh! Master Duel</strong>, open{' '}
                        <span className="text-slate-200">Submenu → Data Transfer</span> and link
                        your Konami ID. Log in with that exact same Konami ID in the{' '}
                        <strong>Yu-Gi-Oh! Neuron</strong> mobile app.
                      </>
                    )}
                  </p>
                </div>

                <div className="pb-4 border-b border-slate-800/80">
                  <div className="text-sm font-semibold text-slate-100">
                    {isVi
                      ? '02. Nạp File .YDK Hoặc Danh Sách Vào Yu-Gi-Oh! Neuron'
                      : '02. Import Your .YDK File into the Konami Card Database'}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {isVi ? (
                      <>
                        Tải file <code className="font-mono text-amber-300">.ydk</code> ở trên hoặc
                        sao chép danh sách bài vào mục <em>My Deck</em> trên trang{' '}
                        <code className="font-mono text-slate-300">db.yugioh-card.com</code> / ứng
                        dụng Neuron.
                      </>
                    ) : (
                      <>
                        Download the <code className="font-mono text-amber-300">.ydk</code> file
                        above and upload it to your Konami My Deck slot on{' '}
                        <code className="font-mono text-slate-300">db.yugioh-card.com</code> or via
                        Neuron.
                      </>
                    )}
                  </p>
                </div>

                <div className="pb-4 border-b border-slate-800/80">
                  <div className="text-sm font-semibold text-slate-100">
                    {isVi
                      ? '03. Chọn "Link with Yu-Gi-Oh! Neuron Decks → Copy Deck" Trong Master Duel'
                      : '03. Click "Copy from Yu-Gi-Oh! Neuron" Inside Master Duel'}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {isVi ? (
                      <>
                        Mở <strong>Master Duel → Deck → Add New Deck</strong>, chọn{' '}
                        <span className="text-amber-300 font-medium">
                          Link with Yu-Gi-Oh! Neuron Decks → Copy Deck
                        </span>{' '}
                        để sao chép toàn bộ {mainCount} lá Main Deck và {extraCount} lá Extra Deck.
                      </>
                    ) : (
                      <>
                        Open <strong>Master Duel → Deck → Add New Deck</strong> and select{' '}
                        <span className="text-amber-300 font-medium">
                          Link with Yu-Gi-Oh! Neuron Decks → Copy Deck
                        </span>
                        .
                      </>
                    )}
                  </p>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {isVi
                      ? '04. Chế Tạo Hàng Loạt (Batch Generate) Các Lá Bài Còn Thiếu'
                      : '04. Batch Craft Missing UR & SR Cards'}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {isVi ? (
                      <>
                        Mở bộ bài vừa nhập trong Master Duel, bấm menu góc trên bên phải và chọn{' '}
                        <span className="text-amber-300 font-medium">
                          Batch Generate Unowned Cards
                        </span>{' '}
                        để chế tạo một lần tất cả lá bài chưa có.
                      </>
                    ) : (
                      <>
                        Open the imported deck in Master Duel&apos;s Deck Editor and tap{' '}
                        <span className="text-amber-300 font-medium">
                          Batch Generate Unowned Cards
                        </span>{' '}
                        in the top-right menu.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeMethod === 'craft_checklist' && (
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-xl bg-[#111827] border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-100">
                    {isVi
                      ? 'Bảng Kiểm Tra Tìm Kiếm & Chế Tạo Bài'
                      : 'Interactive Master Duel Search & Craft Checklist'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isVi
                      ? 'Chạm vào hàng để đánh dấu bài đã có hoặc sao chép tên lá bài dán vào Master Duel.'
                      : 'Tap to mark cards as owned or copy exact card names for Master Duel search.'}
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg shrink-0 w-fit">
                  {(['ALL', 'UR', 'SR', 'R', 'N'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRarityFilter(r)}
                      className={`min-h-[36px] px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                        rarityFilter === r
                          ? 'bg-slate-800 text-amber-300 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
                {filteredChecklistEntries.map((entry: DeckEntry) => {
                  const isOwned = !!ownedCards[entry.card.id];
                  return (
                    <div
                      key={`${entry.section}-${entry.card.id}`}
                      onClick={() => toggleOwned(entry.card.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') toggleOwned(entry.card.id);
                      }}
                      className={`min-h-[58px] py-2.5 px-2 flex items-center justify-between gap-3 transition-colors rounded cursor-pointer ${
                        isOwned ? 'opacity-55 bg-slate-900/30' : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isOwned}
                          onChange={() => {}}
                          aria-label={`Mark ${entry.card.name} as owned`}
                          className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 pointer-events-none shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold tabular-nums text-amber-300">
                              {entry.quantity}x
                            </span>
                            <span
                              className={`text-xs sm:text-sm font-medium truncate ${
                                isOwned ? 'line-through text-slate-400' : 'text-slate-100'
                              }`}
                            >
                              {entry.card.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                            {entry.card.mdRarity} · {entry.quantity * 30} CP ·{' '}
                            {entry.section === 'extra' ? 'Extra' : 'Main'} · ID {entry.card.id}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(entry.card.name, `card-${entry.card.id}`);
                        }}
                        className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 rounded-lg hover:border-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        {copiedKey === `card-${entry.card.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{isVi ? 'Đã chép' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{isVi ? 'Chép Tên' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeMethod === 'ydk_extension' && (
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-xl bg-[#111827] border border-slate-800 space-y-5">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-100">
                  {isVi
                    ? 'Định Dạng .YDK & Mã YDKe:// Cho Giả Lập'
                    : 'Direct .YDK & YDKe:// Simulator Format'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  {isVi
                    ? 'Sao chép chuỗi ydke:// hoặc danh sách văn bản bên dưới để dùng với YGO Omega, EDOPro, MDPro3 hoặc tiện ích trình duyệt.'
                    : 'Use the ydke:// URI or plain text list below with Master Duel extensions, YGO Omega, or EDOPro.'}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span>YDKe:// Base64 Passcode URI</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(ydkeUrl, 'ydke-box')}
                      className="text-amber-400 hover:underline font-medium py-1"
                    >
                      {copiedKey === 'ydke-box'
                        ? isVi
                          ? 'Đã sao chép!'
                          : 'Copied!'
                        : isVi
                        ? 'Sao Chép Mã YDKe'
                        : 'Copy YDKe URI'}
                    </button>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 break-all select-all">
                    {ydkeUrl}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span>
                      {isVi ? 'Danh Sách Bộ Bài Dạng Văn Bản' : 'Tournament & Neuron Text List'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(plainTextList, 'plain-list')}
                      className="text-amber-400 hover:underline font-medium py-1"
                    >
                      {copiedKey === 'plain-list'
                        ? isVi
                          ? 'Đã sao chép!'
                          : 'Copied!'
                        : isVi
                        ? 'Sao Chép Danh Sách'
                        : 'Copy Text List'}
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {plainTextList}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Live .YDK Passcode Output & Paste Importer */}
        <div className="lg:col-span-5 p-4 sm:p-6 rounded-2xl sm:rounded-xl bg-[#111827] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>{isVi ? 'Nội Dung File .YDK' : 'Raw .YDK Passcode Output'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isVi
                  ? 'Mã Passcode Konami 8 chữ số (#main, #extra, !side).'
                  : '8-digit Konami passcodes (#main, #extra, !side).'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPasteYdkModalOpen((v) => !v)}
                className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 rounded-lg hover:border-slate-500 transition-colors whitespace-nowrap"
              >
                {pasteYdkModalOpen ? (isVi ? 'Đóng' : 'Close') : isVi ? 'Dán .YDK' : 'Paste .YDK'}
              </button>
              <button
                type="button"
                onClick={() => handleCopy(ydkText, 'raw-ydk')}
                className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-amber-300 bg-slate-900 border border-amber-500/40 rounded-lg hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedKey === 'raw-ydk' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isVi ? 'Đã chép' : 'Copied'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Chép .YDK' : 'Copy .YDK'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {pasteYdkModalOpen && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3">
              <div className="text-xs font-medium text-slate-200">
                {isVi
                  ? 'Dán nội dung file .ydk vào bên dưới để nạp vào Xưởng Xây Bài:'
                  : 'Paste `.ydk` passcode list below to load into the Deck Workbench:'}
              </div>
              <textarea
                value={pastedYdkText}
                onChange={(e) => setPastedYdkText(e.target.value)}
                rows={5}
                placeholder={'#created by ...\n#main\n89631139\n89631139\n#extra\n...'}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasteYdkModalOpen(false)}
                  className="min-h-[40px] px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handlePasteYdkSubmit}
                  disabled={isImportingYdk || !pastedYdkText.trim()}
                  className="min-h-[40px] px-4 py-1.5 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 disabled:opacity-50"
                >
                  {isImportingYdk
                    ? isVi
                      ? 'Đang nạp...'
                      : 'Loading...'
                    : isVi
                    ? 'Nạp Vào Xưởng Bài'
                    : 'Load .YDK'}
                </button>
              </div>
            </div>
          )}

          <pre className="p-3.5 sm:p-4 rounded-xl bg-[#090D16] border border-slate-800/90 font-mono text-xs tabular-nums text-slate-300 max-h-[360px] overflow-y-auto select-all leading-relaxed">
            {ydkText}
          </pre>
        </div>
      </div>
    </div>
  );
};
