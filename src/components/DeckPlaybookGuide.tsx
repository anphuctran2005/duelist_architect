import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Compass,
  Flame,
  Layers,
  Play,
  ShieldAlert,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../i18n/translations';
import { DeckEntry, DeckState } from '../types/ygo';

interface DeckPlaybookGuideProps {
  deck: DeckState;
  onSelectEntry: (entry: DeckEntry) => void;
}

type PlaybookTab = 'combo' | 'turn_plan' | 'comeback' | 'roles';

export const DeckPlaybookGuide: React.FC<DeckPlaybookGuideProps> = ({ deck, onSelectEntry }) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';
  const [activeSubTab, setActiveSubTab] = useState<PlaybookTab>('combo');

  const starters = useMemo(
    () => deck.entries.filter((e) => e.role === 'Starter'),
    [deck.entries]
  );
  const extendersAndEngine = useMemo(
    () => deck.entries.filter((e) => e.role === 'Extender' || e.role === 'Engine'),
    [deck.entries]
  );
  const bosses = useMemo(
    () => deck.entries.filter((e) => e.role === 'Boss' || e.section === 'extra'),
    [deck.entries]
  );
  const handTrapsAndTech = useMemo(
    () =>
      deck.entries.filter(
        (e) => e.role === 'Hand Trap' || e.role === 'Board Breaker' || e.role === 'Tech'
      ),
    [deck.entries]
  );

  const hasXyzBoss = useMemo(
    () => deck.entries.some((e) => e.card.frameType === 'xyz'),
    [deck.entries]
  );
  const hasFusionBoss = useMemo(
    () => deck.entries.some((e) => e.card.frameType === 'fusion'),
    [deck.entries]
  );
  const hasSynchroBoss = useMemo(
    () => deck.entries.some((e) => e.card.frameType === 'synchro'),
    [deck.entries]
  );

  const renderMiniCardChip = (entry: DeckEntry) => {
    const thumb = entry.card.imageUrlSmall || entry.card.imageUrl;
    return (
      <button
        key={`${entry.section}-${entry.card.id}`}
        type="button"
        onClick={() => onSelectEntry(entry)}
        className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-400 active:scale-[0.98] transition-all text-left group"
      >
        <img
          src={thumb}
          alt={entry.card.name}
          referrerPolicy="no-referrer"
          className="w-9 h-12 rounded object-cover shrink-0 border border-slate-700"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono font-bold text-[10px]">
              {entry.quantity}x
            </span>
            <span className="text-[10px] font-mono text-slate-400">{entry.card.mdRarity}</span>
          </div>
          <div className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 truncate mt-0.5">
            {entry.card.name}
          </div>
          {entry.reason && (
            <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{entry.reason}</div>
          )}
        </div>
      </button>
    );
  };

  return (
    <section
      id="deck-playbook-section"
      aria-label={isVi ? 'Hướng dẫn cách chơi bộ bài vừa tạo' : 'How to play this deck'}
      className="p-4 sm:p-6 rounded-2xl sm:rounded-xl bg-[#111827] border-2 border-amber-400/40 space-y-4 sm:space-y-5 shadow-lg"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isVi
                ? 'CẨM NANG CHIẾN THUẬT & HƯỚNG DẪN VẬN HÀNH TỪ DECK VỪA TẠO'
                : 'TACTICAL PLAYBOOK FOR YOUR ACTIVE DECK'}
            </span>
          </div>
          <h3 className="text-base sm:text-xl font-bold text-slate-100 font-display">
            {isVi
              ? `Hướng Dẫn Cách Chơi: ${deck.name}`
              : `How to Play: ${deck.name}`}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {deck.strategySummary}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-mono font-semibold">
            {deck.playstyle}
          </span>
        </div>
      </div>

      {/* Mobile-Friendly Horizontal Scrollable Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('combo')}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
            activeSubTab === 'combo'
              ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-400/50'
          }`}
        >
          <Play className="w-3.5 h-3.5 shrink-0" />
          <span>{isVi ? '1. Mở Màn & Chuỗi Combo' : '1. Starters & Combo'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('turn_plan')}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
            activeSubTab === 'turn_plan'
              ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-400/50'
          }`}
        >
          <Swords className="w-3.5 h-3.5 shrink-0" />
          <span>{isVi ? '2. Đi Trước vs Đi Sau (OTK)' : '2. Going 1st vs 2nd'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('comeback')}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
            activeSubTab === 'comeback'
              ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-400/50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{isVi ? '3. Cách Lật Kèo & Lưu Ý' : '3. Comeback & Counters'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('roles')}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
            activeSubTab === 'roles'
              ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-400/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>{isVi ? '4. Sơ Đồ Phân Vai Lá Bài' : '4. Card Roles'}</span>
        </button>
      </div>

      {/* Tab 1: Starters & Step-by-Step Combo */}
      {activeSubTab === 'combo' && (
        <div className="space-y-4">
          {/* Priority Starters */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                  {isVi
                    ? `Các Lá Bài Mở Màn Ưu Tiên Kích Hoạt Trước (${starters.length} đầu bài Starter)`
                    : `Priority Opening Starters (${starters.length} Cards)`}
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {isVi ? 'Chạm vào lá bài để xem chi tiết hiệu ứng' : 'Tap any card to inspect'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isVi
                ? 'Khi bắt đầu lượt 1, hãy ưu tiên kích hoạt các Bài Phép tìm kiếm trước để dò bẫy Ash Blossom của đối thủ, sau đó mới dùng lượt Triệu hồi Thường (Normal Summon) cho Starter chính:'
                : 'On Turn 1, activate search Spells first to bait opponent Ash Blossom before committing your Normal Summon:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {(starters.length > 0 ? starters : deck.entries.slice(0, 6))
                .slice(0, 6)
                .map(renderMiniCardChip)}
            </div>
          </div>

          {/* Step-by-Step Combo Sequence */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400 shrink-0" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                {isVi
                  ? 'Trình Tự Đánh Chuỗi Combo Từng Bước (Step-by-Step)'
                  : 'Step-by-Step Combo Execution'}
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {(deck.comboGuide && deck.comboGuide.length > 0
                ? deck.comboGuide
                : [
                    isVi
                      ? '01. Kích hoạt lá bài Starter để tìm kiếm mảnh ghép mở rộng (Extender) từ Bộ bài lên tay.'
                      : '01. Activate your Starter to search your primary Extender from Deck to hand.',
                    isVi
                      ? '02. Triệu hồi Đặc biệt các nhánh mở rộng lên sân để chuẩn bị nguyên liệu triệu hồi Extra Deck.'
                      : '02. Special Summon extenders to assemble Extra Deck materials.',
                  ]
              ).map((step, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3"
                >
                  <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono font-bold text-xs shrink-0">
                    {isVi ? `BƯỚC ${idx + 1}` : `STEP ${idx + 1}`}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Going First vs Going Second Plan */}
      {activeSubTab === 'turn_plan' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Going First Plan */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                {isVi
                  ? 'KHI ĐI TRƯỚC (TURN 1 — DỰNG BÀN KIỂM SOÁT)'
                  : 'GOING FIRST (TURN 1 BOARD SETUP)'}
              </span>
            </div>

            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
              <li>
                {isVi ? (
                  <>
                    <strong>Mục tiêu bàn cuối (End-Board):</strong> Dựng tối thiểu 2 lớp tương tác
                    ngắt nhịp đối phương (vô hiệu hóa hiệu ứng, bắn phá nhanh hoặc khóa Mộ bài) từ
                    các quái thú Boss bên dưới.
                  </>
                ) : (
                  <>
                    <strong>End-Board Goal:</strong> Establish at least 2 layered disruptions from
                    your Extra Deck and Main Deck bosses below.
                  </>
                )}
              </li>
              <li>
                {isVi ? (
                  <>
                    <strong>Giữ tài nguyên dự phòng (Follow-up):</strong> Không xả cạn toàn bộ tay
                    nếu đã đủ bàn kiểm soát; luôn giữ lại 1 Starter hoặc Hand Trap cho lượt 3.
                  </>
                ) : (
                  <>
                    <strong>Preserve Follow-up:</strong> Never over-commit into Nibiru once your
                    core disruptions are live; keep 1 starter for Turn 3.
                  </>
                )}
              </li>
            </ul>

            <div className="pt-1 space-y-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase">
                {isVi ? 'Các Trùm Cuối (Boss) Trong Deck Của Bạn:' : 'Your Active Boss Monsters:'}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {bosses.slice(0, 4).map(renderMiniCardChip)}
              </div>
            </div>
          </div>

          {/* Going Second OTK Plan */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
              <Flame className="w-4 h-4 shrink-0" />
              <span>
                {isVi
                  ? 'KHI ĐI SAU (TURN 2 — PHÁ BÀN & DỨT ĐIỂM OTK 8000 LP)'
                  : 'GOING SECOND (TURN 2 BOARD BREAK & OTK)'}
              </span>
            </div>

            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
              <li>
                {isVi ? (
                  <>
                    <strong>Bước 1 (Ném Hand Trap đúng chỗ):</strong> Dùng <em>Ash Blossom</em>,{' '}
                    <em>Infinite Impermanence</em> hoặc <em>Maxx "C"</em> chặn ngay nút cổ chai tìm
                    bài của đối thủ ở lượt 1.
                  </>
                ) : (
                  <>
                    <strong>Step 1 (Hand Trap Choke Points):</strong> Fire Ash Blossom and
                    Impermanence at the opponent’s primary searcher on Turn 1.
                  </>
                )}
              </li>
              <li>
                {isVi ? (
                  <>
                    <strong>Bước 2 (Dùng bài mồi phá negate):</strong> Kích hoạt các lá Extender
                    hoặc Phép/Bẫy phụ trước để ép đối thủ dùng hết quyền vô hiệu hóa (Negate).
                  </>
                ) : (
                  <>
                    <strong>Step 2 (Bait Negations):</strong> Force out opponent monster/spell
                    negates with secondary extenders before committing your main line.
                  </>
                )}
              </li>
              <li>
                {isVi ? (
                  <>
                    <strong>Bước 3 (Dứt điểm 8000 LP):</strong>{' '}
                    {hasXyzBoss
                      ? 'Chồng Xyz các quái thú Cấp 4 để gọi chủ lực Xyz hút/nhân đôi ATK và tấn công dứt điểm trong 1 lượt.'
                      : hasFusionBoss
                      ? 'Dung hợp liên hoàn trong Main Phase và Battle Phase để quét sạch quái thú đối phương và OTK.'
                      : hasSynchroBoss
                      ? 'Đồng bộ (Synchro) lên các chủ lực ATK cao để phá sạch bàn và dứt điểm 8000 LP.'
                      : 'Leo Link lên Accesscode Talker / S:P Little Knight để dọn sạch sân đối phương và kết thúc trận đấu.'}
                  </>
                ) : (
                  <>
                    <strong>Step 3 (Lethal Push):</strong> Climb into your high-ATK Extra Deck
                    finishers to clear the board and deal 8000+ battle damage.
                  </>
                )}
              </li>
            </ul>

            <div className="pt-1 space-y-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase">
                {isVi
                  ? 'Các Lá Mở Rộng & Phá Bàn Trong Deck:'
                  : 'Your Extenders & Board Breakers:'}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {extendersAndEngine.slice(0, 4).map(renderMiniCardChip)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Comeback & Critical Notes */}
      {activeSubTab === 'comeback' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {isVi
                  ? 'LƯU Ý SỐNG CÒN KHI VẬN HÀNH (TRÁNH TỰ BÓP COMBO)'
                  : 'CRITICAL SEQUENCING & SUMMON LOCK RULES'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <strong className="text-amber-300 block mb-0.5">
                  {isVi
                    ? '1. Quy tắc Tự Khóa Tộc (Archetype / Attribute Lock):'
                    : '1. Archetype & Attribute Summon Locks:'}
                </strong>
                {isVi
                  ? 'Nhiều lá bài mở rộng (như Faris, Cross Crusader, Fusion Destiny, Branded Fusion...) sẽ khóa bạn chỉ được triệu hồi quái thú cùng Tộc/Hệ sau khi kích hoạt. Nếu muốn gọi các quái thú Extra Deck chung (như Dark Rebellion Xyz Dragon, S:P Little Knight, Accesscode Talker), hãy luôn triệu hồi chúng TRƯỚC KHI bật hiệu ứng tự khóa!'
                  : 'Many archetype extenders lock your Special Summons for the rest of the turn. Always summon generic Extra Deck monsters (like Dark Rebellion Xyz Dragon or S:P Little Knight) BEFORE activating locking effects.'}
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <strong className="text-amber-300 block mb-0.5">
                  {isVi
                    ? '2. Sắp xếp chuỗi Chain (Chain Link Dodging):'
                    : '2. Chain Link Ordering & Target Dodging:'}
                </strong>
                {isVi
                  ? 'Sử dụng các Bài Phép Nhanh (như Mask Change, Called by the Grave, Forbidden Chalice) ở Chain Link 2 khi quái thú của bạn bị đối phương nhắm mục tiêu bởi Infinite Impermanence hoặc Effect Veiler để vừa né vô hiệu hóa vừa tiếp tục combo.'
                  : 'Chain Quick-Play Spells (like Mask Change or Called by the Grave) as Chain Link 2 to dodge targeted negation like Infinite Impermanence or Effect Veiler.'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                {isVi
                  ? 'CÁCH LẬT KÈO KHI BỊ DÍNH MAXX "C" / NIBIRU'
                  : 'HOW TO PIVOT & COME BACK UNDER MAXX "C"'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <strong className="text-emerald-300 block mb-0.5">
                  {isVi
                    ? 'Phương án A — Chặn đứng bằng gói Anti-Handtrap:'
                    : 'Plan A — Counter with Anti-Handtrap Package:'}
                </strong>
                {isVi
                  ? 'Luôn giữ lại Ash Blossom, Called by the Grave hoặc Crossout Designator trên tay khi mở màn để vô hiệu hóa ngay Maxx "C" của đối phương.'
                  : 'Hold Ash Blossom, Called by the Grave, or Crossout Designator during your opening play specifically to negate opponent Maxx "C".'}
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <strong className="text-emerald-300 block mb-0.5">
                  {isVi
                    ? 'Phương án B — Dừng ở Bàn Ngắn (Low-Investment Pivot):'
                    : 'Plan B — Low-Commitment Pivot Line:'}
                </strong>
                {isVi
                  ? 'Nếu Maxx "C" thông qua, tuyệt đối không múa dài! Chỉ triệu hồi 1–2 lần để dựng 1 chốt chặn chất lượng (như Masked HERO Dark Law, S:P Little Knight hoặc DPE), úp Infinite Impermanence / Called by the Grave và nhường lượt.'
                  : 'If Maxx "C" resolves, stop immediately after 1–2 Special Summons on a compact disruption (such as Dark Law, S:P Little Knight, or DPE) backed by hand traps.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Full Role Breakdown */}
      {activeSubTab === 'roles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="text-xs font-bold text-amber-400 font-mono">
              {isVi
                ? `NHÓM 1: MỞ MÀN & VẬN HÀNH (${starters.length + extendersAndEngine.length} ĐẦU BÀI)`
                : `GROUP 1: STARTERS & ENGINE (${starters.length + extendersAndEngine.length})`}
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
              {[...starters, ...extendersAndEngine].map(renderMiniCardChip)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="text-xs font-bold text-emerald-400 font-mono">
              {isVi
                ? `NHÓM 2: CHỦ LỰC EXTRA DECK & HAND TRAP (${
                    bosses.length + handTrapsAndTech.length
                  } ĐẦU BÀI)`
                : `GROUP 2: BOSSES & STAPLES (${bosses.length + handTrapsAndTech.length})`}
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
              {[...bosses, ...handTrapsAndTech].map(renderMiniCardChip)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
