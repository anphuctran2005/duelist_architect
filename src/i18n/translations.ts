import React, { createContext, useContext } from 'react';

export type AppLanguage = 'vi' | 'en';

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
}

export const LanguageContext = createContext<LanguageContextValue>({
  lang: 'vi',
  setLang: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

/**
 * Comprehensive Vietnamese Yu-Gi-Oh! PSCT (Problem-Solving Card Text) translator
 * so card effect translation works instantaneously for both single-card inspection and full-deck Excel export.
 */
export function translateYgoEffectFallbackVi(englishDesc: string): string {
  if (!englishDesc) return '';
  let text = englishDesc;
  const replacements: [RegExp, string][] = [
    [/You can only use each effect of "([^"]+)" once per turn\./gi, 'Bạn chỉ có thể sử dụng mỗi hiệu ứng của "$1" một lần mỗi lượt.'],
    [/You can only use this effect of "([^"]+)" once per turn\./gi, 'Bạn chỉ có thể sử dụng hiệu ứng này của "$1" một lần mỗi lượt.'],
    [/You can only use 1 "([^"]+)" effect per turn, and only once that turn\./gi, 'Bạn chỉ có thể sử dụng 1 hiệu ứng của "$1" mỗi lượt, và chỉ một lần trong lượt đó.'],
    [/You can only activate 1 "([^"]+)" per turn\./gi, 'Bạn chỉ có thể kích hoạt 1 "$1" mỗi lượt.'],
    [/\(Quick Effect\):/gi, '(Hiệu ứng Nhanh):'],
    [/\(Quick Effect\)/gi, '(Hiệu ứng Nhanh)'],
    [/Cannot be Normal Summoned\/Set\./gi, 'Không thể Triệu hồi Thường/Úp.'],
    [/Must be Special Summoned/gi, 'Phải được Triệu hồi Đặc biệt'],
    [/Must first be Special Summoned/gi, 'Trước tiên phải được Triệu hồi Đặc biệt'],
    [/Cannot be destroyed by battle/gi, 'Không thể bị tiêu diệt trong chiến đấu'],
    [/Cannot be destroyed by card effects/gi, 'Không thể bị tiêu diệt bởi hiệu ứng bài'],
    [/your opponent cannot target this card with card effects/gi, 'đối thủ không thể chọn lá bài này làm mục tiêu cho hiệu ứng bài'],
    [/unaffected by other cards' effects/gi, 'không bị ảnh hưởng bởi hiệu ứng của các lá bài khác'],
    [/If this card is Normal or Special Summoned:/gi, 'Nếu lá bài này được Triệu hồi Thường hoặc Triệu hồi Đặc biệt:'],
    [/When this card is Normal Summoned:/gi, 'Khi lá bài này được Triệu hồi Thường:'],
    [/If this card is Special Summoned:/gi, 'Nếu lá bài này được Triệu hồi Đặc biệt:'],
    [/If this card is Fusion Summoned:/gi, 'Nếu lá bài này được Triệu hồi Dung hợp (Fusion):'],
    [/If this card is Synchro Summoned:/gi, 'Nếu lá bài này được Triệu hồi Đồng bộ (Synchro):'],
    [/If this card is Xyz Summoned:/gi, 'Nếu lá bài này được Triệu hồi Xyz:'],
    [/If this card is Link Summoned:/gi, 'Nếu lá bài này được Triệu hồi Liên kết (Link):'],
    [/If this card is sent to the GY:/gi, 'Nếu lá bài này được gửi xuống Mộ bài (GY):'],
    [/During your Main Phase:/gi, 'Trong Main Phase của bạn:'],
    [/During the Main Phase/gi, 'Trong Main Phase'],
    [/During the Battle Phase/gi, 'Trong Battle Phase'],
    [/During the End Phase/gi, 'Trong End Phase'],
    [/During the Standby Phase/gi, 'Trong Standby Phase'],
    [/During either player's turn:/gi, 'Trong lượt của bất kỳ người chơi nào:'],
    [/During your opponent's turn/gi, 'Trong lượt của đối thủ'],
    [/Once per turn:/gi, 'Một lần mỗi lượt:'],
    [/You can detach (\d+) materials? from this card, then target /gi, 'Bạn có thể tách $1 nguyên liệu Xyz khỏi lá bài này, sau đó chọn mục tiêu '],
    [/You can detach (\d+) materials? from this card;/gi, 'Bạn có thể tách $1 nguyên liệu Xyz khỏi lá bài này;'],
    [/detach (\d+) Xyz Materials? from this card/gi, 'tách $1 Nguyên liệu Xyz khỏi lá bài này'],
    [/its ATK becomes half its current ATK, and if it does, this card gains that lost ATK/gi, 'ATK của nó giảm đi một nửa so với hiện tại, và nếu làm vậy, lá bài này được cộng thêm phần ATK vừa mất đó'],
    [/Special Summon/gi, 'Triệu hồi Đặc biệt'],
    [/Normal Summon/gi, 'Triệu hồi Thường'],
    [/Fusion Summon/gi, 'Triệu hồi Dung hợp'],
    [/Synchro Summon/gi, 'Triệu hồi Đồng bộ'],
    [/Xyz Summon/gi, 'Triệu hồi Xyz'],
    [/Link Summon/gi, 'Triệu hồi Liên kết'],
    [/from your hand, Deck, or GY/gi, 'từ tay, Bộ bài (Deck), hoặc Mộ bài (GY) của bạn'],
    [/from your Deck to your hand/gi, 'từ Bộ bài (Deck) lên tay bạn'],
    [/from your Deck to the GY/gi, 'từ Bộ bài (Deck) xuống Mộ bài (GY)'],
    [/from your GY to your hand/gi, 'từ Mộ bài (GY) lên tay bạn'],
    [/from your hand or Deck/gi, 'từ tay hoặc Bộ bài của bạn'],
    [/from your hand or GY/gi, 'từ tay hoặc Mộ bài (GY) của bạn'],
    [/from your Extra Deck/gi, 'từ Extra Deck của bạn'],
    [/from your Deck/gi, 'từ Bộ bài (Deck) của bạn'],
    [/from your GY/gi, 'từ Mộ bài (GY) của bạn'],
    [/from your hand/gi, 'từ tay bạn'],
    [/send this card from your hand to the GY/gi, 'gửi lá bài này từ tay xuống Mộ bài (GY)'],
    [/You can banish this card from your GY/gi, 'Bạn có thể trục xuất lá bài này từ Mộ bài (GY)'],
    [/discard this card/gi, 'xả (discard) lá bài này từ tay'],
    [/discard 1 card/gi, 'xả 1 lá bài trên tay'],
    [/Tribute this card/gi, 'Hiến tế lá bài này'],
    [/Tribute 1 monster/gi, 'Hiến tế 1 quái thú'],
    [/Target 1 /gi, 'Chọn mục tiêu 1 '],
    [/target 1 /g, 'chọn mục tiêu 1 '],
    [/Add 1 /gi, 'Thêm 1 '],
    [/add 1 /g, 'thêm 1 '],
    [/negate the activation, and if you do, destroy that card/gi, 'vô hiệu hóa sự kích hoạt đó, và nếu làm vậy, hủy diệt lá bài đó'],
    [/negate the activation/gi, 'vô hiệu hóa sự kích hoạt đó'],
    [/negate that effect/gi, 'vô hiệu hóa hiệu ứng đó'],
    [/negate its effects/gi, 'vô hiệu hóa hiệu ứng của nó'],
    [/destroy that card/gi, 'hủy diệt lá bài đó'],
    [/destroy it/gi, 'hủy diệt nó'],
    [/destroy 1 card on the field/gi, 'hủy diệt 1 lá bài trên sân'],
    [/banish it/gi, 'trục xuất (banish) nó'],
    [/draw (\d+) cards?/gi, 'rút $1 lá bài'],
    [/Spell\/Trap/gi, 'Bài Phép/Bẫy'],
    [/monsters you control/gi, 'quái thú bạn điều khiển'],
    [/your opponent controls/gi, 'đối thủ điều khiển'],
    [/on the field/gi, 'trên sân'],
  ];

  for (const [regex, viStr] of replacements) {
    text = text.replace(regex, viStr);
  }
  return text;
}

export const PROMPT_SUGGESTIONS_I18N: Record<
  AppLanguage,
  { label: string; prompt: string }[]
> = {
  vi: [
    {
      label: 'HERO × Dark Rebellion Xyz',
      prompt:
        'Xây dựng deck HERO là chủ lực kết hợp với Dark Rebellion XYZ Dragon',
    },
    {
      label: 'Snake-Eye Fire King Tier 1',
      prompt:
        'Xây dựng bộ bài Snake-Eye Fire King mạnh nhất leo rank Master Duel có đủ bài chống Maxx C và Extra Deck đa dụng.',
    },
    {
      label: 'Tenpai Dragon Đi Sau OTK',
      prompt:
        'Xây dựng bộ bài Tenpai Dragon chuyên đi sau OTK trong Battle Phase kèm nhiều hand trap và bài phá bàn.',
    },
    {
      label: 'Branded Despia Bystial',
      prompt:
        'Xây dựng bộ bài Branded Despia Bystial 40 lá xoay quanh Mirrorjade, Blazing Cartesia và Guardian Chimera.',
    },
    {
      label: 'Rồng Trắng Mắt Xanh Hiện Đại',
      prompt:
        'Xây dựng bộ bài Blue-Eyes White Dragon Synchro hiện đại cho Master Duel với Jet Dragon, Spirit Dragon và Crimson Dragon.',
    },
    {
      label: 'Swordsoul Tenyi Giá Rẻ (Ít UR)',
      prompt:
        'Xây dựng bộ bài Swordsoul Tenyi Synchro ổn định, tiết kiệm điểm CP UR cho người mới leo rank Master Duel.',
    },
  ],
  en: [
    {
      label: 'HERO × Dark Rebellion Xyz',
      prompt:
        'Build a HERO main engine deck combined with Dark Rebellion Xyz Dragon',
    },
    {
      label: 'Competitive Fire King Snake-Eye',
      prompt:
        'Construct a Tier 1 Snake-Eye Fire King midrange deck with Maxx C counters and strong Extra Deck toolbox.',
    },
    {
      label: 'Going-Second Tenpai Dragon OTK',
      prompt:
        'Build an explosive Going-Second Tenpai Dragon Synchro OTK deck packed with board breakers and hand traps.',
    },
    {
      label: 'Branded Despia Bystial Midrange',
      prompt:
        'Build a 40-card Branded Despia Bystial fusion deck focused on Mirrorjade, Cartesia, and Guardian Chimera.',
    },
    {
      label: 'Blue-Eyes White Dragon Modern Synchro',
      prompt:
        'Build a modernized Blue-Eyes White Dragon Synchro deck for Master Duel with Jet Dragon, Spirit Dragon, and Crimson Dragon.',
    },
    {
      label: 'Budget Swordsoul Tenyi Synchro',
      prompt:
        'Build a consistent Swordsoul Tenyi Synchro deck with low UR crafting cost for climbing Platinum to Master rank.',
    },
  ],
};
