import * as XLSX from 'xlsx';
import { AppLanguage, translateYgoEffectFallbackVi } from '../i18n/translations';
import { DeckEntry, DeckState } from '../types/ygo';
import { calculateCraftingPoints, serializeToYdk, serializeToYdkeUrl } from './ydk';

const ROLE_LABELS_VI: Record<string, string> = {
  Starter: 'Mở Combo (Starter)',
  Extender: 'Nối Nhánh / Mở Rộng (Extender)',
  Boss: 'Chủ Lực / Trùm Cuối (Boss)',
  'Hand Trap': 'Bẫy Tay Ngắt Nhịp (Hand Trap)',
  'Board Breaker': 'Phá Bàn Đi Sau (Board Breaker)',
  Engine: 'Trụ Cột Vận Hành (Engine)',
  Tech: 'Đột Biến Chiến Thuật (Tech)',
};

function formatCardStats(entry: DeckEntry): string {
  const c = entry.card;
  const parts: string[] = [];
  if (c.attribute) parts.push(c.attribute);
  if (c.race) parts.push(c.race);
  if (c.type) parts.push(c.type);
  if (typeof c.linkval === 'number') {
    parts.push(`LINK-${c.linkval}`);
  } else if (typeof c.level === 'number') {
    parts.push(c.frameType === 'xyz' ? `Rank ${c.level}` : `Level ${c.level}`);
  }
  if (typeof c.atk === 'number') {
    parts.push(
      `ATK ${c.atk}${typeof c.def === 'number' ? ` / DEF ${c.def}` : ''}`
    );
  }
  return parts.join(' · ');
}

function generateCardTimingAndRulingNote(entry: DeckEntry, isVi: boolean): string {
  const desc = entry.card.desc || '';
  const lower = desc.toLowerCase();
  const notes: string[] = [];

  if (lower.includes('(quick effect)') || lower.includes('during either player')) {
    notes.push(
      isVi
        ? 'Hiệu ứng Nhanh (Spell Speed 2): Có thể kích hoạt ngay trong lượt đối phương để ngắt nhịp hoặc né hiệu ứng.'
        : 'Quick Effect (Spell Speed 2): Can be chained during either player turn.'
    );
  }
  if (lower.includes('only use each effect') || lower.includes('only use this effect')) {
    notes.push(
      isVi
        ? 'Giới hạn cứng 1 lần/lượt (Hard Once Per Turn): Dù có nhiều bản sao trên sân cũng chỉ kích hoạt được 1 lần mỗi lượt.'
        : 'Hard Once Per Turn (HOPT): Shared across all copies of this card name.'
    );
  }
  if (lower.includes('cannot special summon') || lower.includes('except "')) {
    notes.push(
      isVi
        ? 'CẢNH BÁO TỰ KHÓA TRIỆU HỒI (Summon Lock): Hãy triệu hồi các quái thú chung (như Dark Rebellion Xyz Dragon, S:P Little Knight, Accesscode) TRƯỚC KHI kích hoạt hiệu ứng tự khóa này.'
        : 'SUMMON LOCK WARNING: Sequence generic Extra Deck monsters BEFORE activating this restriction.'
    );
  }
  if (lower.includes('if this card is sent to the gy') || lower.includes('banish this card from your gy')) {
    notes.push(
      isVi
        ? 'Tài nguyên Mộ bài (GY Effect): Vẫn sinh lời ngay cả khi bị gửi xuống Mộ làm nguyên liệu Dung hợp/Link/Xyz — cẩn thận bị Called by the Grave trục xuất.'
        : 'Graveyard Value: Generates follow-up in the GY; watch out for Called by the Grave.'
    );
  }
  if (lower.includes('target ')) {
    notes.push(
      isVi
        ? 'Hiệu ứng có Chọn mục tiêu (Targets): Có thể bị né nếu mục tiêu rời sân trước khi chuỗi hiệu ứng giải quyết.'
        : 'Targeting Effect: Can be dodged if the target leaves the field before resolution.'
    );
  } else if (lower.includes('destroy') || lower.includes('banish') || lower.includes('halve')) {
    notes.push(
      isVi
        ? 'Tác động diện rộng / Không chọn mục tiêu: Rất mạnh để xuyên qua các quái thú kháng chọn mục tiêu (Untargetable).'
        : 'High-impact removal/stat modification for breaking established boards.'
    );
  }

  if (notes.length === 0) {
    notes.push(
      isVi
        ? 'Kích hoạt trong Main Phase của bạn để duy trì nhịp vận hành ổn định.'
        : 'Standard activation window during your Main Phase.'
    );
  }

  return notes.join(' | ');
}

/**
 * Exports a comprehensive 5-Sheet Excel (.xlsx) Tactical Handbook for the active Master Duel deck:
 * Sheet 1: Main Deck & Extra Deck Overview
 * Sheet 2: Effect All Cards (Vietnamese PSCT + Original English + Ruling Notes)
 * Sheet 3: Step-by-Step Combo Guide & Engine Breakdown
 * Sheet 4: Comeback Guide ("Làm sao lật kèo") & Critical Tactical Notes ("Lưu ý sống còn")
 * Sheet 5: Crafting Point (CP) Priority & .YDK Import Data
 */
export function exportDeckToExcel(
  deck: DeckState,
  lang: AppLanguage = 'vi',
  cachedTranslations: Record<number, string> = {}
): void {
  const isVi = lang === 'vi';
  const mainEntries = deck.entries.filter((e) => e.section === 'main');
  const extraEntries = deck.entries.filter((e) => e.section === 'extra');
  const mainCount = mainEntries.reduce((sum, e) => sum + e.quantity, 0);
  const extraCount = extraEntries.reduce((sum, e) => sum + e.quantity, 0);
  const { neededCP } = calculateCraftingPoints(deck.entries);

  const wb = XLSX.utils.book_new();

  // ============================================================================
  // SHEET 1: TỔNG QUAN, MAIN DECK & EXTRA DECK
  // ============================================================================
  const sheet1Rows: (string | number)[][] = [
    [
      isVi
        ? `SỔ TAY CHIẾN THUẬT & DANH SÁCH BỘ BÀI YU-GI-OH! MASTER DUEL — ${deck.name.toUpperCase()}`
        : `YU-GI-OH! MASTER DUEL TACTICAL HANDBOOK — ${deck.name.toUpperCase()}`,
    ],
    [
      isVi ? 'Tên Bộ Bài' : 'Deck Name',
      deck.name,
      isVi ? 'Tộc Bài Chủ Lực' : 'Primary Archetype',
      deck.archetype,
      isVi ? 'Phong Cách Đánh' : 'Playstyle',
      deck.playstyle,
    ],
    [
      isVi ? 'Đánh Giá Sức Mạnh' : 'Tier Rating',
      deck.tierRating,
      isVi ? 'Số Lượng Bài' : 'Card Count',
      `Main Deck: ${mainCount} lá | Extra Deck: ${extraCount} lá`,
      isVi ? 'Tổng Chi Phí Chế Tạo (CP)' : 'Total Crafting Cost (CP)',
      `${neededCP.UR} UR · ${neededCP.SR} SR · ${neededCP.R} R · ${neededCP.N} N`,
    ],
    [isVi ? 'Tóm Tắt Chiến Thuật' : 'Strategy Summary', deck.strategySummary],
    [],
    [
      isVi ? 'STT' : '#',
      isVi ? 'Phân Khu (Deck)' : 'Section',
      isVi ? 'Số Lượng' : 'Qty',
      isVi ? 'Tên Lá Bài (Official Card Name)' : 'Card Name',
      isVi ? 'Mã Passcode 8 Số' : '8-Digit Passcode',
      isVi ? 'Vai Trò Chiến Thuật' : 'Tactical Role',
      isVi ? 'Độ Hiếm MD' : 'MD Rarity',
      isVi ? 'Chi Phí CP' : 'CP Cost',
      isVi ? 'Banlist Master Duel' : 'Banlist Status',
      isVi ? 'Thông Số (Hệ / Tộc / Cấp / ATK / DEF)' : 'Card Stats',
      isVi ? 'Gói Bài (Secret Pack)' : 'Secret Pack',
      isVi ? 'Lý Do Đưa Vào Deck & Cách Phối Hợp' : 'Synergy & Role Explanation',
    ],
  ];

  let rowIndex = 1;
  for (const entry of [...mainEntries, ...extraEntries]) {
    sheet1Rows.push([
      rowIndex++,
      entry.section === 'extra' ? 'Extra Deck' : 'Main Deck',
      `${entry.quantity}x`,
      entry.card.name,
      String(entry.card.id).padStart(8, '0'),
      isVi ? ROLE_LABELS_VI[entry.role] || entry.role : entry.role,
      entry.card.mdRarity,
      `${entry.quantity * 30} ${entry.card.mdRarity}`,
      entry.card.banlistStatus,
      formatCardStats(entry),
      entry.card.secretPack || 'Master Pack',
      entry.reason || '',
    ]);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  ws1['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 10 },
    { wch: 36 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 44 },
    { wch: 26 },
    { wch: 68 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, isVi ? '1_Main_Va_Extra_Deck' : '1_Main_Extra_Deck');

  // ============================================================================
  // SHEET 2: HIỆU ỨNG TOÀN BỘ LÁ BÀI (EFFECT ALL CARDS - TIẾNG VIỆT & TIẾNG ANH)
  // ============================================================================
  const sheet2Rows: (string | number)[][] = [
    [
      isVi
        ? `TRA CỨU HIỆU ỨNG TOÀN BỘ LÁ BÀI TRONG DECK (${deck.entries.length} ĐẦU BÀI)`
        : `COMPLETE CARD EFFECT ENCYCLOPEDIA (${deck.entries.length} UNIQUE CARDS)`,
    ],
    [
      isVi
        ? 'Mẹo sử dụng: Cột "Hiệu Ứng Tiếng Việt" dịch chuẩn thuật ngữ PSCT giúp bạn nắm nhanh cơ chế; cột "Lưu Ý Kích Hoạt & Rulings" chỉ rõ điểm cần chú ý khi đấu hạng.'
        : 'Includes translated Vietnamese PSCT effect text, official English text, and activation window notes.',
    ],
    [],
    [
      isVi ? 'STT' : '#',
      isVi ? 'Phân Khu' : 'Section',
      isVi ? 'Số Lượng' : 'Qty',
      isVi ? 'Tên Lá Bài' : 'Card Name',
      isVi ? 'Vai Trò' : 'Role',
      isVi ? 'Thông Số Kỹ Thuật' : 'Card Specs',
      isVi ? 'Hiệu Ứng Tiếng Việt (Chuẩn Thuật Ngữ PSCT)' : 'Vietnamese Effect Translation',
      isVi ? 'Hiệu Ứng Gốc Tiếng Anh (Official English Text)' : 'Official English Effect',
      isVi ? 'Lưu Ý Kích Hoạt, Chuỗi Chain & Rulings' : 'Activation & Ruling Notes',
    ],
  ];

  let effectIdx = 1;
  for (const entry of [...mainEntries, ...extraEntries]) {
    const viEffect =
      cachedTranslations[entry.card.id] || translateYgoEffectFallbackVi(entry.card.desc);
    sheet2Rows.push([
      effectIdx++,
      entry.section === 'extra' ? 'Extra Deck' : 'Main Deck',
      `${entry.quantity}x`,
      entry.card.name,
      isVi ? ROLE_LABELS_VI[entry.role] || entry.role : entry.role,
      formatCardStats(entry),
      viEffect,
      entry.card.desc,
      generateCardTimingAndRulingNote(entry, isVi),
    ]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  ws2['!cols'] = [
    { wch: 6 },
    { wch: 13 },
    { wch: 9 },
    { wch: 35 },
    { wch: 25 },
    { wch: 40 },
    { wch: 75 },
    { wch: 75 },
    { wch: 60 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, isVi ? '2_Effect_Toan_Bo_Bai' : '2_All_Card_Effects');

  // ============================================================================
  // SHEET 3: HƯỚNG DẪN COMBO CHI TIẾT & PHÂN NHÁNH (COMBO PLAYBOOK)
  // ============================================================================
  const starters = mainEntries.filter((e) => e.role === 'Starter');
  const extenders = mainEntries.filter((e) => e.role === 'Extender' || e.role === 'Engine');
  const bosses = [...extraEntries, ...mainEntries].filter((e) => e.role === 'Boss');

  const sheet3Rows: (string | number)[][] = [
    [
      isVi
        ? `CẨM NANG VẬN HÀNH COMBO & PHÂN NHÁNH — ${deck.name.toUpperCase()}`
        : `STEP-BY-STEP COMBO PLAYBOOK — ${deck.name.toUpperCase()}`,
    ],
    [],
    [
      isVi ? 'PHẦN I: CHUỖI COMBO TIÊU CHUẨN (4 BƯỚC MỞ BÀN & DỨT ĐIỂM)' : 'PART I: CORE COMBO SEQUENCE',
      isVi ? 'Hướng Dẫn Thực Hiện Chi Tiết' : 'Detailed Execution Step',
    ],
  ];

  deck.comboGuide.forEach((step, idx) => {
    sheet3Rows.push([`Bước 0${idx + 1}`, step]);
  });

  sheet3Rows.push(
    [],
    [
      isVi
        ? 'PHẦN II: DANH SÁCH LÁ MỞ COMBO (STARTERS — ƯU TIÊN DÙNG ĐẦU LƯỢT)'
        : 'PART II: PRIMARY STARTERS (OPENING PLAYMAKERS)',
      isVi ? 'Số Lượng' : 'Copies',
      isVi ? 'Nhiệm Vụ Khi Mở Màn & Cách Nhử Hand Trap' : 'Opening Sequence & Bait Role',
    ]
  );

  for (const st of starters) {
    sheet3Rows.push([
      st.card.name,
      `${st.quantity}x`,
      `${st.reason} — ${translateYgoEffectFallbackVi(st.card.desc)}`,
    ]);
  }

  sheet3Rows.push(
    [],
    [
      isVi
        ? 'PHẦN III: NHÁNH NỐI COMBO & MỞ RỘNG SÂN (EXTENDERS & ENGINE)'
        : 'PART III: EXTENDERS & SECONDARY ENGINE LINES',
      isVi ? 'Số Lượng' : 'Copies',
      isVi ? 'Cách Nối Nhánh Khi Bị Ngắt Nhịp & Chồng Xyz / Link / Fusion' : 'Extension Line',
    ]
  );

  for (const ex of extenders) {
    sheet3Rows.push([
      ex.card.name,
      `${ex.quantity}x`,
      `${ex.reason} (${formatCardStats(ex)})`,
    ]);
  }

  sheet3Rows.push(
    [],
    [
      isVi
        ? 'PHẦN IV: ĐỘI HÌNH CHỦ LỰC KẾT THÚC LƯỢT & SÁT THƯƠNG OTK (BOSS MONSTERS)'
        : 'PART IV: ENDBOARD BOSSES & OTK FINISHERS',
      isVi ? 'Phân Khu' : 'Zone',
      isVi ? 'Vai Trò Khống Chế Sân / Dứt Điểm 8000 LP' : 'Disruption / OTK Function',
    ]
  );

  for (const b of bosses) {
    sheet3Rows.push([
      `${b.quantity}x ${b.card.name}`,
      b.section === 'extra' ? 'Extra Deck' : 'Main Deck',
      `${b.reason} — ${formatCardStats(b)}`,
    ]);
  }

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
  ws3['!cols'] = [{ wch: 44 }, { wch: 20 }, { wch: 95 }];
  XLSX.utils.book_append_sheet(wb, ws3, isVi ? '3_Huong_Dan_Combo' : '3_Combo_Playbook');

  // ============================================================================
  // SHEET 4: LÀM SAO LẬT KÈO & LƯU Ý SỐNG CÒN (COMEBACK GUIDE & TACTICAL NOTES)
  // ============================================================================
  const handTraps = mainEntries.filter((e) => e.role === 'Hand Trap');
  const boardBreakers = [...mainEntries, ...extraEntries].filter(
    (e) => e.role === 'Board Breaker' || e.role === 'Tech'
  );
  const bossNames = bosses.map((b) => b.card.name).join(', ');
  const handTrapNames =
    handTraps.map((h) => `${h.quantity}x ${h.card.name}`).join(', ') ||
    'Ash Blossom, Infinite Impermanence, Maxx "C"';
  const breakerNames =
    boardBreakers.map((b) => `${b.quantity}x ${b.card.name}`).join(', ') ||
    'Called by the Grave, S:P Little Knight, Accesscode Talker';

  const sheet4Rows: (string | number)[][] = [
    [
      isVi
        ? `CẨM NANG LẬT KÈO (GOING SECOND / COMEBACK) & LƯU Ý QUAN TRỌNG — ${deck.name.toUpperCase()}`
        : `COMEBACK & GOING-SECOND STRATEGY + CRITICAL NOTES — ${deck.name.toUpperCase()}`,
    ],
    [],
    [
      isVi ? 'CHỦ ĐỀ CHIẾN THUẬT' : 'TACTICAL CATEGORY',
      isVi ? 'TÌNH HUỐNG TRONG TRẬN ĐẤU' : 'DUEL SCENARIO',
      isVi ? 'PHƯƠNG ÁN XỬ LÝ & CÁCH LẬT KÈO CHI TIẾT' : 'DETAILED ACTION PLAN & EXECUTION',
    ],
    [
      '01. LÀM SAO LẬT KÈO KHI ĐI SAU (BỊ ĐỐI THỦ DÀN BÀN NEGATE)',
      'Đối phương đi trước và dựng 2–4 lượt vô hiệu hóa (Omni-Negate / Quái thú kháng hiệu ứng)',
      `• Bước 1 (Ném đá dò đường / Bait Negate): Tuyệt đối KHÔNG tung lá mở combo quan trọng nhất ngay đầu tiên. Hãy kích hoạt các lá tìm kiếm phụ (như E - Emergency Call, A Hero Lives, hoặc các lá Phép mồi) và công cụ phá bàn (${breakerNames}) để ép đối phương phải dùng lượt Negate đầu tiên.\n• Bước 2 (Chuỗi Hóa Nhanh / Chain Blocking): Tận dụng các lá bài Phép Nhanh (như Mask Change, Forbidden Chalice, Infinite Impermanence, Called by the Grave) để chuỗi đè lên hiệu ứng quái thú đối phương hoặc giúp quái thú của bạn "nhảy" tránh hiệu ứng chỉ định mục tiêu.\n• Bước 3 (Đột kích bằng Extra Deck): Chỉ với 2 quái thú bất kỳ vượt qua được vòng vây, hãy triệu hồi ngay các chủ lực xoay chuyển cục diện trong Extra Deck (${bossNames}) để trục xuất, hút một nửa ATK hoặc quét sạch bàn đối phương.`,
    ],
    [
      '02. LÀM SAO LẬT KÈO KHI BỊ QUÁI THÚ ATK QUÁ TO ĐÈ SÂN',
      'Đối phương có quái thú 3500–5000 ATK hoặc kháng hủy diệt bởi hiệu ứng bài',
      `• Phương án 1 (Hút ATK & Đấm Xuyên bằng Xyz / Boss): Nếu bộ bài có Dark Rebellion Xyz Dragon / Arc Rebellion Xyz Dragon hoặc Elemental HERO Honest Neos, hãy chồng 2 quái thú Cấp 4 để gọi Dark Rebellion (hút một nửa ATK đối phương cộng thẳng vào mình) hoặc dùng Honest Neos cộng thêm 2500 ATK ngay trong bước Tính Sát Thương (Damage Step) nơi đối phương hầu như không thể phản ứng.\n• Phương án 2 (Xử lý không hủy diệt / Non-Destruction): Dùng S:P Little Knight (trục xuất tạm thời), Destiny HERO - Plasma (hút thẳng quái thú đối phương làm trang bị), hoặc Elemental HERO Absolute Zero + Mask Change để dọn sân ở tốc độ Spell Speed 2.`,
    ],
    [
      '03. LÀM SAO LẬT KÈO KHI BỊ PHÁ SÂN Ở LƯỢT 1 (TÁI THIẾT LƯỢT 3)',
      'Bàn đầu của bạn bị Raigeki / Nibiru / Evenly Matched quét sạch',
      `• Luôn giữ lại 1 nguồn tài nguyên dự phòng (Follow-up) trên tay hoặc dưới Mộ bài (ví dụ: Destiny HERO - Malicious / Denier dưới Mộ, Destroyer Phoenix Enforcer tự hồi sinh mỗi Standby Phase, hoặc Miracle Fusion / Soul Servant / Return of the Dragon Lords).\n• Không bao giờ dốc sạch 100% bài trên tay vào Lượt 1 nếu không cần thiết: giữ lại ít nhất 1 Starter hoặc Hand Trap (${handTrapNames}) trên tay sẽ giúp bạn sống sót qua Lượt 2 và phản công OTK ở Lượt 3.`,
    ],
    [
      '04. CÁCH CHẶN ĐỨNG ĐỐI THỦ BẰNG HAND TRAP ĐÚNG ĐIỂM NGHẼN',
      'Đối phương đang combo dài khi bạn phải đi sau',
      `• Hệ thống Hand Trap hiện có trong deck của bạn (${handTrapNames}):\n  - Maxx "C": Kích hoạt ngay khi đối phương bắt đầu chuỗi Triệu hồi Đặc biệt đã khóa vào hiệu ứng để đảm bảo rút ít nhất 1–2 lá.\n  - Ash Blossom & Joyous Spring: Nhắm thẳng vào các lá bài Triệu hồi từ Bộ bài (như Branded Fusion, Original Sinful Spoils, A Hero Lives, Welcome Labrynth) thay vì ném vội vào lá tìm kiếm phụ.\n  - Infinite Impermanence: Giữ trên tay để bắn vào quái thú đầu tàu của đối thủ, hoặc giữ làm lá bài thứ 6 trong lượt của bạn để khóa trực tiếp 1 cột Negate trên sân địch.`,
    ],
    [],
    [
      '05. LƯU Ý SỐNG CÒN VỀ THỨ TỰ KÍCH HOẠT & TỰ KHÓA (SUMMON LOCKS)',
      'Tránh tự khóa chính mình khi kết hợp nhiều nhánh bài (Hybrid Deck)',
      `• CỰC KỲ QUAN TRỌNG: Nhiều lá bài tộc chuyên biệt (ví dụ: Vision HERO Faris, Vision HERO Increase, Xtra HERO Cross Crusader, Fusion Destiny, Branded Fusion...) có câu điều kiện khóa bạn chỉ được Triệu hồi Đặc biệt quái thú thuộc tộc/hệ đó trong phần còn lại của lượt.\n• QUY TẮC VÀNG: Nếu bạn muốn triệu hồi các quái thú Extra Deck ngoài tộc (như Dark Rebellion Xyz Dragon, Arc Rebellion Xyz Dragon, S:P Little Knight, I:P Masquerena, Accesscode Talker), hãy dùng cặp quái thú Cấp 4 (như Solid Soldier + Stratos/Liquid Soldier) để Triệu hồi Xyz/Link chúng TRƯỚC, sau đó mới kích hoạt Faris / Cross Crusader / Fusion Destiny ở nửa sau của combo!`,
    ],
    [
      '06. LƯU Ý PHÒNG CHỐNG NIBIRU & MAXX "C" TRONG MASTER DUEL BO1',
      'Khi đối phương thả Maxx "C" hoặc cầm Nibiru ở lần triệu hồi thứ 5',
      `• Đối phó Maxx "C": Nếu không có Ash Blossom / Called by the Grave / Crossout Designator, đừng cố múa 15 bước cho đối thủ rút 10 lá. Hãy chuyển ngay sang phương án "Bàn Ngắn (Low-to-the-Ground)" chỉ tốn 1–2 lần Triệu hồi Đặc biệt (ví dụ: lên thẳng Masked HERO Dark Law bằng Mask Change, hoặc gọi Destroyer Phoenix Enforcer, hoặc đóng 1 Xyz Rank 4 + úp bài hậu tuyến) rồi kết thúc lượt.\n• Đối phó Nibiru: Nếu nghi ngờ đối phương có Nibiru (biểu tượng chuỗi sáng lên ở lần triệu hồi thứ 5), hãy giữ sẵn Mask Change hoặc đưa S:P Little Knight lên sân để chạy thoát cho quái thú chủ lực.`,
    ],
    [
      '07. LƯU Ý VỊ TRÍ ĐẶT BÀI TRÊN SÂN (ZONE PLACEMENT)',
      'Tối ưu hóa mũi tên Liên kết (Link Arrows) và né cột Infinite Impermanence',
      `• Luôn đặt Bài Phép quan trọng ở các cột ngoài cùng hoặc khác cột với các lá bài đang úp của đối thủ để tránh bị vô hiệu hóa bởi cột dọc của Infinite Impermanence.\n• Khi dùng các quái thú Link (như Xtra HERO Wonder Driver, Cross Crusader, I:P Masquerena), hãy chú ý triệu hồi quái thú mới vào đúng ô có mũi tên chỉ tới để kích hoạt hiệu ứng tái chế Phép từ Mộ bài.`,
    ],
  ];

  const ws4 = XLSX.utils.aoa_to_sheet(sheet4Rows);
  ws4['!cols'] = [{ wch: 38 }, { wch: 42 }, { wch: 105 }];
  XLSX.utils.book_append_sheet(wb, ws4, isVi ? '4_Lat_Keo_Va_Luu_Y' : '4_Comeback_And_Notes');

  // ============================================================================
  // SHEET 5: CHI PHÍ CHẾ TẠO (CP) & MÃ PASSCODE .YDK ĐỂ NHẬP VÀO GAME
  // ============================================================================
  const ydkRaw = serializeToYdk(deck);
  const ydkeLink = serializeToYdkeUrl(deck);

  const sheet5Rows: (string | number)[][] = [
    [
      isVi
        ? 'BẢNG KIỂM TRA NGUYÊN LIỆU CHẾ TẠO (CP) & MÃ NHẬP GAME MASTER DUEL'
        : 'CRAFTING POINT (CP) PRIORITY & MASTER DUEL .YDK EXPORT DATA',
    ],
    [
      isVi ? 'Đường dẫn YDKe:// nhanh' : 'YDKe:// Quick URI',
      ydkeLink,
    ],
    [],
    [
      isVi ? 'Ưu Tiên Chế Tạo' : 'Craft Priority',
      isVi ? 'Tên Lá Bài' : 'Card Name',
      isVi ? 'Số Lượng' : 'Qty',
      isVi ? 'Độ Hiếm' : 'Rarity',
      isVi ? 'Điểm CP Cần' : 'CP Required',
      isVi ? 'Gói Secret Pack Mở Bài' : 'Secret Pack Source',
      isVi ? 'Khuyến Nghị Chế Tạo (Craft hay Mở Pack?)' : 'Crafting Recommendation',
    ],
  ];

  const rarityPriorityOrder: Record<string, number> = { UR: 0, SR: 1, R: 2, N: 3 };
  const sortedForCraft = [...deck.entries].sort(
    (a, b) =>
      (rarityPriorityOrder[a.card.mdRarity] ?? 2) - (rarityPriorityOrder[b.card.mdRarity] ?? 2)
  );

  for (const entry of sortedForCraft) {
    const r = entry.card.mdRarity;
    const rec =
      r === 'UR' && entry.role === 'Hand Trap'
        ? isVi
          ? 'Ưu tiên số 1: Chế tạo trực tiếp bằng điểm UR (Dùng được cho mọi bộ bài trong game)'
          : 'Priority #1: Craft directly with UR CP (Universal staple across all decks)'
        : r === 'UR'
        ? isVi
          ? `Mở từ gói "${entry.card.secretPack}" trước, sau đó chế tạo các bản còn thiếu`
          : `Pull from "${entry.card.secretPack}" Secret Pack first, then craft remaining copies`
        : r === 'SR'
        ? isVi
          ? 'Chế tạo 1 lá SR để mở khóa gói Secret Pack tương ứng và nhận 1 lượt mở miễn phí'
          : 'Craft 1 SR copy to unlock its Secret Pack and claim 1 free pull'
        : isVi
        ? 'Độ hiếm N/R: Chế tạo ngay lập tức vì điểm N/R rất dồi dào'
        : 'N/R Rarity: Craft immediately using abundant N/R points';

    sheet5Rows.push([
      r === 'UR' ? 'Cao (UR)' : r === 'SR' ? 'Trung bình (SR)' : 'Cơ bản (N/R)',
      entry.card.name,
      `${entry.quantity}x`,
      r,
      `${entry.quantity * 30} ${r}`,
      entry.card.secretPack || 'Master Pack',
      rec,
    ]);
  }

  sheet5Rows.push(
    [],
    [
      isVi
        ? 'MÃ PASSCODE .YDK NGUYÊN BẢN (SAO CHÉP CỘT NÀY LƯU THÀNH FILE .YDK ĐỂ NHẬP VÀO NEURON / MASTER DUEL)'
        : 'RAW .YDK PASSCODE CONTENT',
    ]
  );

  for (const line of ydkRaw.split('\n')) {
    sheet5Rows.push([line]);
  }

  const ws5 = XLSX.utils.aoa_to_sheet(sheet5Rows);
  ws5['!cols'] = [
    { wch: 22 },
    { wch: 36 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 28 },
    { wch: 70 },
  ];
  XLSX.utils.book_append_sheet(wb, ws5, isVi ? '5_Che_Tao_CP_Va_YDK' : '5_Crafting_And_YDK');

  const safeSlug =
    deck.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'master-duel-deck';

  XLSX.writeFile(wb, `${safeSlug}-master-duel-handbook.xlsx`);
}
