import { AppLanguage, translateYgoEffectFallbackVi } from '../i18n/translations';
import {
  ChatPersonaId,
  DeckEntry,
  DeckState,
  GeminiModelTier,
  ImageSizeOption,
  SuggestedDeckChange,
  VisualAssetType,
  YgoCard,
} from '../types/ygo';
import { getMaxAllowedCopies, isExtraDeckCard } from './ydk';

/**
 * Safe JSON fetch wrapper that NEVER throws "Unexpected end of JSON input"
 * when deployed on static hosts like Netlify, Vercel, or GitHub Pages.
 */
export async function safeFetchJson<T = any>(
  url: string,
  init?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();
    if (!rawText || !rawText.trim()) return null;
    const trimmed = rawText.trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      return null;
    }
    if (!contentType.includes('application/json') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

const cardByNameCache = new Map<string, YgoCard>();
const cardByIdCache = new Map<number, YgoCard>();

function normalizeRarity(rawRarity?: string): 'N' | 'R' | 'SR' | 'UR' {
  if (!rawRarity) return 'SR';
  const lower = rawRarity.toLowerCase();
  if (lower.includes('ultra')) return 'UR';
  if (lower.includes('super')) return 'SR';
  if (lower.includes('rare') && !lower.includes('super') && !lower.includes('ultra')) return 'R';
  if (lower.includes('common') || lower.includes('normal')) return 'N';
  return 'SR';
}

function normalizeBanlist(banInfo: any): 'Unlimited' | 'Semi-Limited' | 'Limited' | 'Forbidden' {
  if (!banInfo) return 'Unlimited';
  const raw = banInfo.ban_master_duel || banInfo.ban_ocg || banInfo.ban_tcg;
  if (!raw) return 'Unlimited';
  const lower = String(raw).toLowerCase();
  if (lower.includes('forbidden') || lower.includes('banned')) return 'Forbidden';
  if (lower.includes('semi')) return 'Semi-Limited';
  if (lower.includes('limited')) return 'Limited';
  return 'Unlimited';
}

function normalizeFrameType(rawFrame?: string, rawType?: string): YgoCard['frameType'] {
  const f = (rawFrame || '').toLowerCase();
  if (f.includes('synchro')) return 'synchro';
  if (f.includes('xyz')) return 'xyz';
  if (f.includes('fusion')) return 'fusion';
  if (f.includes('link')) return 'link';
  if (f.includes('ritual')) return 'ritual';
  if (f.includes('pendulum')) return 'pendulum';
  if (f.includes('spell')) return 'spell';
  if (f.includes('trap')) return 'trap';
  if (f.includes('normal')) return 'normal';
  const t = (rawType || '').toLowerCase();
  if (t.includes('spell')) return 'spell';
  if (t.includes('trap')) return 'trap';
  return 'effect';
}

export function mapRawYgoCardClient(raw: any): YgoCard {
  const id = Number(raw.id);
  const misc = Array.isArray(raw.misc_info) && raw.misc_info[0] ? raw.misc_info[0] : {};
  const imgObj = Array.isArray(raw.card_images) && raw.card_images[0] ? raw.card_images[0] : null;
  const card: YgoCard = {
    id,
    name: String(raw.name),
    type: String(raw.type || 'Effect Monster'),
    frameType: normalizeFrameType(raw.frameType, raw.type),
    desc: String(raw.desc || ''),
    atk: typeof raw.atk === 'number' ? raw.atk : undefined,
    def: typeof raw.def === 'number' ? raw.def : undefined,
    level: typeof raw.level === 'number' ? raw.level : undefined,
    linkval: typeof raw.linkval === 'number' ? raw.linkval : undefined,
    race: String(raw.race || ''),
    attribute: raw.attribute ? String(raw.attribute) : undefined,
    archetype: raw.archetype ? String(raw.archetype) : undefined,
    imageUrl: imgObj?.image_url || `https://images.ygoprodeck.com/images/cards/${id}.jpg`,
    imageUrlSmall:
      imgObj?.image_url_small || `https://images.ygoprodeck.com/images/cards_small/${id}.jpg`,
    mdRarity: normalizeRarity(misc.md_rarity),
    banlistStatus: normalizeBanlist(raw.banlist_info),
    secretPack: raw.card_sets?.[0]?.set_name || 'Master Pack',
  };
  cardByNameCache.set(card.name.toLowerCase(), card);
  cardByIdCache.set(card.id, card);
  return card;
}

const ARCHETYPE_ALIASES: [string, string][] = [
  ['rồng trắng mắt xanh', 'Blue-Eyes'],
  ['rồng trắng', 'Blue-Eyes'],
  ['blue-eyes', 'Blue-Eyes'],
  ['blue eyes', 'Blue-Eyes'],
  ['blue eye', 'Blue-Eyes'],
  ['phù thủy áo đen', 'Dark Magician'],
  ['phù thủy bóng đêm', 'Dark Magician'],
  ['dark magician', 'Dark Magician'],
  ['nhãn xà hỏa vương', 'Snake-Eye Fire King'],
  ['hỏa vương', 'Fire King'],
  ['fire king', 'Fire King'],
  ['nhãn xà', 'Snake-Eye'],
  ['snake-eye', 'Snake-Eye'],
  ['snake eye', 'Snake-Eye'],
  ['thiên bôi', 'Tenpai Dragon'],
  ['tenpai dragon', 'Tenpai Dragon'],
  ['tenpai', 'Tenpai Dragon'],
  ['lạc ấn', 'Branded'],
  ['branded despia', 'Branded'],
  ['branded', 'Branded'],
  ['despia', 'Branded'],
  ['albaz', 'Branded'],
  ['mê cung bạc', 'Labrynth'],
  ['labrynth', 'Labrynth'],
  ['kiếm hồn', 'Swordsoul'],
  ['swordsoul', 'Swordsoul'],
  ['elemental hero', 'HERO'],
  ['destiny hero', 'HERO'],
  ['vision hero', 'HERO'],
  ['masked hero', 'HERO'],
  ['evil hero', 'HERO'],
  ['anh hùng', 'HERO'],
  ['hero', 'HERO'],
  ['rồng đen mắt đỏ', 'Red-Eyes'],
  ['red-eyes', 'Red-Eyes'],
  ['red eyes', 'Red-Eyes'],
  ['rồng điện tử', 'Cyber Dragon'],
  ['cyber dragon', 'Cyber Dragon'],
  ['thiểm đao', 'Sky Striker'],
  ['sky striker', 'Sky Striker'],
  ['lệ nhân ngư', 'Tearlaments'],
  ['tearlaments', 'Tearlaments'],
  ['kính thần', 'Yubel'],
  ['yubel', 'Yubel'],
  ['phantom knights', 'Phantom Knights'],
  ['phantom knight', 'Phantom Knights'],
  ['hiệp sĩ bóng ma', 'Phantom Knights'],
  ['raidraptor', 'Raidraptor'],
  ['utopia', 'Utopia'],
  ['gagaga', 'Utopia'],
  ['kashtira', 'Kashtira'],
  ['purrely', 'Purrely'],
  ['voiceless voice', 'Voiceless Voice'],
  ['centur-ion', 'Centur-Ion'],
  ['centurion', 'Centur-Ion'],
  ['rescue-ace', 'Rescue-ACE'],
  ['mathmech', 'Mathmech'],
  ['salamangreat', 'Salamangreat'],
  ['spright', 'Spright'],
  ['eldlich', 'Eldlich'],
  ['traptrix', 'Traptrix'],
  ['exosister', 'Exosister'],
  ['dinomorphia', 'Dinomorphia'],
  ['unchained', 'Unchained'],
  ['chimera', 'Chimera'],
  ['lightsworn', 'Lightsworn'],
  ['blackwing', 'Blackwing'],
  ['galaxy-eyes', 'Galaxy-Eyes'],
  ['galaxy eyes', 'Galaxy-Eyes'],
  ['floowandereeze', 'Floowandereeze'],
  ['mikanko', 'Mikanko'],
  ['vanquish soul', 'Vanquish Soul'],
  ['dragonmaid', 'Dragonmaid'],
  ['live twin', 'Live☆Twin'],
  ['evil twin', 'Live☆Twin'],
  ['orcust', 'Orcust'],
  ['thunder dragon', 'Thunder Dragon'],
  ['pendulum', 'Pendulum Magician'],
  ['endymion', 'Endymion'],
  ['stardust', 'Synchron'],
  ['synchron', 'Synchron'],
  ['junk', 'Synchron'],
  ['ancient gear', 'Ancient Gear'],
  ['gimmick puppet', 'Gimmick Puppet'],
  ['melodious', 'Melodious'],
  ['memento', 'Memento'],
  ['dragon link', 'Dragon Link'],
  ['rokket', 'Dragon Link'],
  ['borrel', 'Dragon Link'],
  ['exodia', 'Exodia'],
];

interface CuratedCardSpec {
  name: string;
  qty: number;
  role: DeckEntry['role'];
  reasonVi: string;
  reasonEn: string;
}

const CURATED_ARCHETYPE_CORES: Record<string, CuratedCardSpec[]> = {
  HERO: [
    {
      name: 'Elemental HERO Stratos',
      qty: 3,
      role: 'Starter',
      reasonVi: 'Starter Cấp 4 quan trọng nhất: tìm kiếm mọi quái thú HERO hoặc bắn Phép/Bẫy và làm nguyên liệu Xyz Rank 4 / Link.',
      reasonEn: 'Premier Level 4 starter: searches any HERO monster, pops backrow, and fuels Rank 4 Xyz / Link plays.',
    },
    {
      name: 'Elemental HERO Shadow Mist',
      qty: 2,
      role: 'Starter',
      reasonVi: 'Quái thú HERO Hệ DARK Cấp 4: tìm kiếm Mask Change khi được Triệu hồi Đặc biệt hoặc tìm 1 HERO khi xuống Mộ bài.',
      reasonEn: 'Level 4 DARK HERO: searches Mask Change on Special Summon or any HERO when sent to the GY.',
    },
    {
      name: 'Elemental HERO Solid Soldier',
      qty: 2,
      role: 'Extender',
      reasonVi: 'Khi Triệu hồi Thường giúp kéo thêm 1 HERO Cấp 4 từ tay ra sân — tạo ngay cặp đôi Cấp 4 để Xyz Summon (như Dark Rebellion Xyz Dragon) hoặc Link Summon.',
      reasonEn: 'Special Summons a Level 4 or lower HERO from hand on Normal Summon, immediately enabling Rank 4 Xyz or Link plays.',
    },
    {
      name: 'Elemental HERO Liquid Soldier',
      qty: 2,
      role: 'Extender',
      reasonVi: 'Kéo 1 HERO Cấp 4 từ Mộ bài lên sân khi Normal Summon (hỗ trợ đóng Xyz Rank 4 cực nhanh) và giúp rút 2 lá khi làm nguyên liệu Dung hợp.',
      reasonEn: 'Revives a Level 4 HERO from GY on Normal Summon for instant Rank 4 Xyz access and draws 2 cards when used for a Fusion Summon.',
    },
    {
      name: 'Vision HERO Faris',
      qty: 3,
      role: 'Starter',
      reasonVi: 'Nhánh mở rộng chủ lực của HERO: xả 1 HERO để tự Triệu hồi Đặc biệt và đặt Vision HERO Increase từ Bộ bài.',
      reasonEn: 'Core HERO engine starter: discards a HERO to Special Summon itself and place Vision HERO Increase in the Spell/Trap Zone.',
    },
    {
      name: 'Vision HERO Increase',
      qty: 2,
      role: 'Engine',
      reasonVi: 'Hiến tế 1 HERO trên sân để tự nhảy ra và gọi thẳng Vision HERO Vyon từ Bộ bài.',
      reasonEn: 'Tributes a HERO to Special Summon itself and summon Vision HERO Vyon directly from the Deck.',
    },
    {
      name: 'Vision HERO Vyon',
      qty: 2,
      role: 'Engine',
      reasonVi: 'Quái thú HERO Hệ DARK Cấp 4: chôn Shadow Mist hoặc Malicious xuống Mộ bài, trục xuất 1 HERO để lấy Polymerization, và làm nguyên liệu Xyz Rank 4 Hệ DARK.',
      reasonEn: 'Level 4 DARK Warrior: foolish-burials Shadow Mist or Malicious, searches Polymerization, and serves as a DARK Level 4 Xyz material.',
    },
    {
      name: 'Destiny HERO - Malicious',
      qty: 2,
      role: 'Extender',
      reasonVi: 'Trục xuất từ Mộ bài để gọi bản sao thứ hai từ Bộ bài, cung cấp nguyên liệu Link và Fusion miễn phí.',
      reasonEn: 'Banishes itself from GY to Special Summon another copy from Deck for free Link/Fusion material.',
    },
    {
      name: 'Destiny HERO - Denier',
      qty: 1,
      role: 'Extender',
      reasonVi: 'Tái chế Destiny HERO - Malicious đang bị trục xuất về lại đầu Bộ bài để dùng thêm một lần nữa.',
      reasonEn: 'Recycles a banished Destiny HERO - Malicious back to the top of the Deck for an extra summon.',
    },
    {
      name: 'Destiny HERO - Plasma',
      qty: 1,
      role: 'Boss',
      reasonVi: 'Trùm cuối khóa một chiều toàn bộ hiệu ứng quái thú trên sân đối phương và hút 1 quái thú đối thủ.',
      reasonEn: 'One-sided skill drain boss monster that negates all opponent face-up monster effects and equips an enemy monster.',
    },
    {
      name: 'Elemental HERO Honest Neos',
      qty: 1,
      role: 'Tech',
      reasonVi: 'Xả từ tay (Hiệu ứng Nhanh) để cộng thêm 2500 ATK cho bất kỳ quái thú HERO nào đang giao chiến.',
      reasonEn: 'Quick Effect hand trap that boosts any battling HERO monster by 2500 ATK.',
    },
    {
      name: 'A Hero Lives',
      qty: 3,
      role: 'Starter',
      reasonVi: 'Bài Phép mở màn mạnh nhất của HERO: trả nửa điểm gốc để gọi thẳng Stratos hoặc Shadow Mist từ Bộ bài mà không tốn Normal Summon.',
      reasonEn: 'Best 1-card starter: pays half LP to Special Summon Stratos or Shadow Mist from Deck without using your Normal Summon.',
    },
    {
      name: 'E - Emergency Call',
      qty: 2,
      role: 'Starter',
      reasonVi: 'Tìm kiếm ngay 1 quái thú Elemental HERO (Stratos, Solid Soldier, Liquid Soldier) từ Bộ bài lên tay.',
      reasonEn: 'Searches any Elemental HERO monster from your Deck to your hand.',
    },
    {
      name: 'Reinforcement of the Army',
      qty: 1,
      role: 'Starter',
      reasonVi: 'Bài Phép Giới hạn (Limited): tìm kiếm bất kỳ quái thú Chiến binh Cấp 4 nào trong Bộ bài.',
      reasonEn: 'Limited staple Spell that searches any Level 4 or lower Warrior monster.',
    },
    {
      name: 'Mask Change',
      qty: 3,
      role: 'Engine',
      reasonVi: 'Bài Phép Nhanh biến quái thú HERO Hệ DARK thành Masked HERO Dark Law hoặc giúp né hiệu ứng chỉ định mục tiêu.',
      reasonEn: 'Quick-Play Spell that transforms any DARK HERO into Masked HERO Dark Law and dodges targeted negation.',
    },
    {
      name: 'Fusion Destiny',
      qty: 2,
      role: 'Starter',
      reasonVi: 'Dung hợp trực tiếp bằng nguyên liệu từ Bộ bài để triệu hồi Destiny HERO - Destroyer Phoenix Enforcer.',
      reasonEn: 'Fuses materials directly from the Deck to summon Destiny HERO - Destroyer Phoenix Enforcer.',
    },
    {
      name: 'Polymerization',
      qty: 1,
      role: 'Engine',
      reasonVi: 'Lá bài Dung hợp chuẩn được tìm kiếm bởi Vyon và tái chế bởi Wonder Driver.',
      reasonEn: 'Standard Fusion Spell searched by Vyon and recycled by Xtra HERO Wonder Driver.',
    },
    {
      name: 'Miracle Fusion',
      qty: 1,
      role: 'Extender',
      reasonVi: 'Trục xuất nguyên liệu từ Mộ bài để gọi Elemental HERO Sunrise hoặc Absolute Zero.',
      reasonEn: 'Banishes materials from the GY to Fusion Summon Elemental HERO Sunrise or Absolute Zero.',
    },
    {
      name: 'Masked HERO Dark Law',
      qty: 2,
      role: 'Boss',
      reasonVi: 'Chủ lực kiểm soát của HERO: trục xuất toàn bộ bài bị gửi xuống Mộ của đối thủ và giật 1 lá trên tay khi đối thủ tìm bài.',
      reasonEn: 'One-sided Macro Cosmos floodgate that banishes all cards sent to the opponent GY and rips a card when they search.',
    },
    {
      name: 'Destiny HERO - Destroyer Phoenix Enforcer',
      qty: 1,
      role: 'Boss',
      reasonVi: 'Giảm ATK toàn sân đối phương, bắn phá 2 lá trên sân mỗi lượt (Hiệu ứng Nhanh) và tự hồi sinh từ Mộ bài mỗi Standby Phase.',
      reasonEn: 'Quick-Effect non-targeting pop every turn that endlessly revives itself each Standby Phase.',
    },
    {
      name: 'Elemental HERO Sunrise',
      qty: 1,
      role: 'Boss',
      reasonVi: 'Tự động tìm Miracle Fusion khi Triệu hồi Đặc biệt và bắn 1 lá trên sân mỗi khi quái thú HERO khác giao chiến.',
      reasonEn: 'Searches Miracle Fusion on Special Summon and destroys a card whenever another HERO battles.',
    },
    {
      name: 'Wake Up Your Elemental HERO',
      qty: 1,
      role: 'Boss',
      reasonVi: 'Quái thú Dung hợp dứt điểm OTK với khả năng tấn công nhiều lần và gọi Stratos/Shadow Mist từ Bộ bài khi bị tiêu diệt.',
      reasonEn: 'Multi-attacking OTK Fusion boss that summons a Warrior from Deck when destroyed.',
    },
    {
      name: 'Elemental HERO Absolute Zero',
      qty: 1,
      role: 'Board Breaker',
      reasonVi: 'Khi rời sân sẽ quét sạch toàn bộ quái thú đối phương điều khiển (Raigeki tốc độ nhanh khi kết hợp Mask Change).',
      reasonEn: 'Wipes all opponent monsters whenever it leaves the field.',
    },
    {
      name: 'Xtra HERO Cross Crusader',
      qty: 2,
      role: 'Engine',
      reasonVi: 'Link-2 trụ cột của HERO: hồi sinh 1 Destiny HERO từ Mộ bài và hiến tế để tìm bất kỳ quái thú HERO nào.',
      reasonEn: 'Essential HERO Link-2: revives a Destiny HERO and tributes it to search any HERO monster.',
    },
    {
      name: 'Xtra HERO Wonder Driver',
      qty: 1,
      role: 'Engine',
      reasonVi: 'Úp lại Polymerization, Mask Change hoặc Fusion Destiny từ Mộ bài mỗi khi có quái thú HERO được triệu hồi vào mũi tên chỉ hướng.',
      reasonEn: 'Re-sets Polymerization, Mask Change, or Fusion Destiny from GY when a HERO is summoned to its zone.',
    },
  ],
  'Phantom Knights': [
    {
      name: 'The Phantom Knights of Torn Scales',
      qty: 3,
      role: 'Starter',
      reasonVi: 'Starter Cấp 3/4 chủ lực của Hiệp Sĩ Bóng Ma, chôn bài xuống Mộ và tự hồi sinh.',
      reasonEn: 'Primary Phantom Knights starter that sends PK cards to GY and self-revives.',
    },
    {
      name: 'The Phantom Knights of Silent Boots',
      qty: 3,
      role: 'Extender',
      reasonVi: 'Tự Triệu hồi Đặc biệt khi có Phantom Knights trên sân và tìm kiếm Bài Phép/Bẫy Phantom Knights.',
      reasonEn: 'Free Special Summon extender that banishes from GY to search any Phantom Knights Spell/Trap.',
    },
    {
      name: 'The Phantom Knights of Ancient Cloak',
      qty: 2,
      role: 'Engine',
      reasonVi: 'Trục xuất từ Mộ bài để tìm kiếm bất kỳ lá bài The Phantom Knights nào.',
      reasonEn: 'Banishes from GY to search any The Phantom Knights monster or card.',
    },
    {
      name: "Raider's Knight",
      qty: 2,
      role: 'Engine',
      reasonVi: 'Xyz Rank 4 Hệ DARK giúp leo thẳng lên Arc Rebellion Xyz Dragon hoặc Dark Rebellion.',
      reasonEn: 'Rank 4 DARK Xyz that ranks up directly into Arc Rebellion Xyz Dragon.',
    },
    {
      name: 'Dark Rebellion Xyz Dragon',
      qty: 1,
      role: 'Boss',
      reasonVi: 'Xyz Rank 4 kinh điển hút một nửa ATK của quái thú đối phương.',
      reasonEn: 'Iconic Rank 4 Xyz Dragon that halves an opponent monster ATK and gains it.',
    },
    {
      name: 'Arc Rebellion Xyz Dragon',
      qty: 1,
      role: 'Boss',
      reasonVi: 'Trùm cuối Xyz Rank 5 cộng toàn bộ ATK trên sân và khóa hiệu ứng toàn bộ quái thú khác để OTK.',
      reasonEn: 'OTK Rank 5 Xyz Dragon that gains ATK of all monsters on field and negates all other face-up monsters.',
    },
    {
      name: 'The Phantom Knights of Break Sword',
      qty: 2,
      role: 'Board Breaker',
      reasonVi: 'Bắn phá bài trên sân và hồi sinh 2 Phantom Knights thành Cấp 4 để đóng Dark Rebellion Xyz Dragon.',
      reasonEn: 'Pops a card on each side and revives 2 PKs as Level 4 DARKs to Xyz Summon Dark Rebellion Xyz Dragon.',
    },
    {
      name: "Phantom Knights' Fog Blade",
      qty: 3,
      role: 'Tech',
      reasonVi: 'Cẩm nang Bẫy Vĩnh cửu khóa hiệu ứng quái thú đối phương và hồi sinh Phantom Knights từ Mộ.',
      reasonEn: 'Searchable Continuous Trap that negates a monster and revives a PK from GY.',
    },
  ],
  'Blue-Eyes': [
    {
      name: 'Blue-Eyes White Dragon',
      qty: 3,
      role: 'Boss',
      reasonVi: 'Linh hồn của bộ bài Rồng Trắng Mắt Xanh, nguyên liệu cho mọi đòn Dung hợp, Synchro và Xyz Rank 8.',
      reasonEn: 'Heart of the Blue-Eyes strategy, required for Jet Dragon, Alternative, and Fusion/Synchro bosses.',
    },
    {
      name: 'Blue-Eyes Alternative White Dragon',
      qty: 3,
      role: 'Extender',
      reasonVi: 'Lộ Blue-Eyes trên tay để tự Triệu hồi Đặc biệt, bắn phá 1 quái thú đối phương và đóng Xyz Rank 8 / Synchro 9.',
      reasonEn: 'Reveals Blue-Eyes in hand to Special Summon itself, destroy a monster, and enable Rank 8 / Level 9 Synchro plays.',
    },
    {
      name: 'Blue-Eyes Jet Dragon',
      qty: 2,
      role: 'Boss',
      reasonVi: 'Bảo vệ toàn bộ bài khác khỏi bị hủy bởi hiệu ứng, tự nhảy ra từ tay/Mộ và đẩy bài đối phương về tay.',
      reasonEn: 'Protects other cards you control from destruction, self-summons, and bounces an opponent card on battle.',
    },
    {
      name: 'Dictator of D.',
      qty: 3,
      role: 'Starter',
      reasonVi: 'Chôn Blue-Eyes White Dragon từ Bộ bài xuống Mộ để tự nhảy ra và hồi sinh Rồng Trắng.',
      reasonEn: 'Sends Blue-Eyes White Dragon from Deck to GY to Special Summon itself and revive a Blue-Eyes.',
    },
    {
      name: 'Sage with Eyes of Blue',
      qty: 3,
      role: 'Starter',
      reasonVi: 'Tuner Cấp 1 tìm kiếm White Stone of Ancients và gọi thẳng Rồng Trắng từ Bộ bài.',
      reasonEn: 'Level 1 Tuner that searches The White Stone of Ancients and summons Blue-Eyes from Deck.',
    },
    {
      name: 'The White Stone of Ancients',
      qty: 3,
      role: 'Engine',
      reasonVi: 'Khi xuống Mộ bài sẽ gọi thẳng Blue-Eyes Jet Dragon hoặc Blue-Eyes Abyss Dragon từ Bộ bài vào End Phase.',
      reasonEn: 'Summons a Blue-Eyes monster from Deck during the End Phase of the turn it was sent to the GY.',
    },
    {
      name: 'The Melody of Awakening Dragon',
      qty: 3,
      role: 'Starter',
      reasonVi: 'Xả 1 lá để lấy ngay bộ đôi Blue-Eyes White Dragon + Blue-Eyes Alternative White Dragon lên tay.',
      reasonEn: 'Discards 1 card to add both Blue-Eyes White Dragon and Blue-Eyes Alternative White Dragon to hand.',
    },
    {
      name: 'Return of the Dragon Lords',
      qty: 3,
      role: 'Extender',
      reasonVi: 'Hồi sinh Rồng Cấp 7/8 từ Mộ bài và trục xuất từ Mộ để bảo vệ Rồng khỏi bị tiêu diệt.',
      reasonEn: 'Revives a Level 7 or 8 Dragon and banishes from GY to protect Dragons from destruction.',
    },
    {
      name: 'True Light',
      qty: 2,
      role: 'Engine',
      reasonVi: 'Mỗi lượt hồi sinh Blue-Eyes hoặc đặt Bài Phép/Bẫy Rồng Trắng trực tiếp từ Bộ bài.',
      reasonEn: 'Recurs Blue-Eyes White Dragon every turn or sets Blue-Eyes Spells/Traps from Deck.',
    },
    {
      name: 'Blue-Eyes Spirit Dragon',
      qty: 2,
      role: 'Boss',
      reasonVi: 'Synchro Cấp 9 chặn triệu hồi nhiều quái thú cùng lúc, negate hiệu ứng dưới Mộ và biến hình sang Rồng Ánh Sáng.',
      reasonEn: 'Level 9 Synchro boss that negates GY activations and tags out into LIGHT Dragon Synchros.',
    },
    {
      name: 'Blue-Eyes Tyrant Dragon',
      qty: 1,
      role: 'Boss',
      reasonVi: 'Miễn nhiễm hiệu ứng Bẫy, tấn công toàn bộ quái thú đối phương và tái chế Bẫy từ Mộ bài.',
      reasonEn: 'Unaffected by Trap effects, attacks all opponent monsters, and resets a Trap from GY.',
    },
    {
      name: 'Number 38: Hope Harbinger Dragon Titanic Galaxy',
      qty: 1,
      role: 'Boss',
      reasonVi: 'Xyz Rank 8 vô hiệu hóa Bài Phép và hút làm nguyên liệu Xyz.',
      reasonEn: 'Rank 8 Xyz staple that negates Spell activations and attaches them as material.',
    },
  ],
  'Dark Magician': [
    {
      name: 'Dark Magician',
      qty: 3,
      role: 'Boss',
      reasonVi: 'Quái thú Phù Thủy chủ lực kích hoạt Dark Magical Circle và Eternal Soul.',
      reasonEn: 'Centerpiece Spellcaster that triggers Dark Magical Circle banishes and Eternal Soul recursion.',
    },
    {
      name: "Magicians' Souls",
      qty: 3,
      role: 'Starter',
      reasonVi: 'Chôn Dark Magician từ Bộ bài để gọi thẳng ra sân hoặc gửi Phép/Bẫy dư thừa để rút 2 lá.',
      reasonEn: 'Sends Dark Magician from Deck to GY to Special Summon it or draws up to 2 cards.',
    },
    {
      name: "Magician's Rod",
      qty: 3,
      role: 'Starter',
      reasonVi: 'Khi Triệu hồi Thường sẽ tìm kiếm Dark Magical Circle, Soul Servant hoặc Eternal Soul.',
      reasonEn: 'Searches any Dark Magician Spell/Trap on Normal Summon and recycles itself from GY.',
    },
    {
      name: 'Illusion of Chaos',
      qty: 3,
      role: 'Starter',
      reasonVi: 'Tìm kiếm Magicians’ Souls hoặc Magician’s Rod bất kỳ lúc nào.',
      reasonEn: 'Searches Magicians’ Souls or Magician’s Rod and returns itself to the top of the Deck.',
    },
    {
      name: 'Dark Magical Circle',
      qty: 3,
      role: 'Engine',
      reasonVi: 'Mở 3 lá đầu Bộ bài lấy bài Dark Magician và trục xuất (banish) 1 lá trên sân đối thủ mỗi khi Dark Magician được triệu hồi.',
      reasonEn: 'Excavates for Dark Magician cards and banishes 1 opponent card whenever Dark Magician is summoned.',
    },
    {
      name: 'Soul Servant',
      qty: 3,
      role: 'Starter',
      reasonVi: 'Đặt bất kỳ lá bài liên quan đến Dark Magician lên đầu Bộ bài và trục xuất từ Mộ để rút bài.',
      reasonEn: 'Stacks any Dark Magician card on top of the Deck and banishes from GY to draw cards.',
    },
    {
      name: 'Eternal Soul',
      qty: 2,
      role: 'Engine',
      reasonVi: 'Giúp Dark Magician miễn nhiễm mọi hiệu ứng đối phương và hồi sinh Dark Magician mỗi lượt để bắn bài.',
      reasonEn: 'Makes Dark Magician unaffected by opponent card effects and Special Summons Dark Magician every turn.',
    },
    {
      name: 'Secrets of Dark Magic',
      qty: 2,
      role: 'Engine',
      reasonVi: 'Bài Phép Nhanh Dung hợp hoặc Nghi thức ngay trong lượt đối thủ.',
      reasonEn: 'Quick-Play Fusion/Ritual Spell to summon The Dark Magicians or Dragon Knight during either turn.',
    },
    {
      name: 'The Dark Magicians',
      qty: 2,
      role: 'Boss',
      reasonVi: 'Rút 1 lá mỗi lượt khi Phép/Bẫy kích hoạt và đặt dùng ngay nếu là Phép Nhanh hoặc Bẫy.',
      reasonEn: 'Draws 1 card whenever a Spell/Trap is activated and lets you set and use it immediately.',
    },
    {
      name: 'Dark Magician the Dragon Knight',
      qty: 2,
      role: 'Boss',
      reasonVi: 'Bảo vệ hoàn toàn Eternal Soul và Dark Magical Circle khỏi bị chỉ định mục tiêu hoặc tiêu diệt.',
      reasonEn: 'Protects your backrow (Eternal Soul & Circle) from targeting and destruction.',
    },
  ],
};

function resolveVietnameseArchetypeAlias(input: string): string {
  const lower = input.toLowerCase();
  for (const [alias, canonical] of ARCHETYPE_ALIASES) {
    if (lower.includes(alias)) {
      return canonical === 'HERO' ? 'Elemental HERO' : canonical;
    }
  }
  return input;
}

export async function resolveCardByNameClient(name: string): Promise<YgoCard | null> {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length < 3) return null;
  const key = cleanName.toLowerCase();
  if (cardByNameCache.has(key)) {
    return cardByNameCache.get(key)!;
  }

  try {
    const exactUrl = `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(
      cleanName
    )}&misc=yes`;
    const exactJson = await safeFetchJson<any>(exactUrl);
    if (Array.isArray(exactJson?.data) && exactJson.data.length > 0) {
      return mapRawYgoCardClient(exactJson.data[0]);
    }

    const fuzzyUrl = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(
      cleanName
    )}&misc=yes&num=8&offset=0`;
    const fuzzyJson = await safeFetchJson<any>(fuzzyUrl);
    if (Array.isArray(fuzzyJson?.data) && fuzzyJson.data.length > 0) {
      const bestMatch =
        fuzzyJson.data.find((c: any) => String(c.name).toLowerCase() === key) ||
        fuzzyJson.data.find((c: any) => String(c.name).toLowerCase().startsWith(key)) ||
        fuzzyJson.data[0];
      return mapRawYgoCardClient(bestMatch);
    }
  } catch {
    // Ignore transient network errors
  }
  return null;
}

export async function searchYgoCardsClientFallback(
  q: string,
  attribute = 'ALL',
  limit = 36,
  archetype?: string
): Promise<YgoCard[]> {
  try {
    const params = new URLSearchParams({ misc: 'yes' });
    if (q && q.trim()) {
      params.set('fname', resolveVietnameseArchetypeAlias(q.trim()));
    }
    if (archetype && archetype.trim()) {
      params.set('archetype', archetype.trim());
    }
    if (attribute && attribute !== 'ALL') {
      params.set('attribute', attribute);
    }
    const data = await safeFetchJson<any>(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?${params.toString()}`
    );
    if (!Array.isArray(data?.data)) return [];
    return data.data.slice(0, limit).map(mapRawYgoCardClient);
  } catch {
    return [];
  }
}

export async function searchCardsUnified(
  q: string,
  attribute = 'ALL',
  limit = 36
): Promise<YgoCard[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (attribute !== 'ALL') params.set('attribute', attribute);
  params.set('limit', String(limit));

  const apiData = await safeFetchJson<{ cards?: YgoCard[] }>(
    `/api/cards/search?${params.toString()}`
  );
  if (Array.isArray(apiData?.cards) && apiData.cards.length > 0) {
    return apiData.cards;
  }
  return searchYgoCardsClientFallback(q, attribute, limit);
}

export async function hydratePasscodesClientFallback(
  ids: number[]
): Promise<Record<number, YgoCard>> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => id > 0)));
  if (uniqueIds.length === 0) return {};
  const map: Record<number, YgoCard> = {};
  try {
    for (let i = 0; i < uniqueIds.length; i += 45) {
      const chunk = uniqueIds.slice(i, i + 45);
      const json = await safeFetchJson<any>(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${chunk.join(',')}&misc=yes`
      );
      if (Array.isArray(json?.data)) {
        for (const raw of json.data) {
          const card = mapRawYgoCardClient(raw);
          map[card.id] = card;
        }
      }
    }
  } catch {
    // Ignore error
  }
  return map;
}

export async function hydratePasscodesUnified(
  ids: number[]
): Promise<Record<number, YgoCard>> {
  const apiData = await safeFetchJson<{ cards?: Record<number, YgoCard> }>('/api/cards/hydrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (apiData?.cards && Object.keys(apiData.cards).length > 0) {
    return apiData.cards;
  }
  return hydratePasscodesClientFallback(ids);
}

async function callFreeAiBrowserCompletion(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  preferredModel = 'gpt-oss-20b-free'
): Promise<{ text: string; providerLabel: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai-fast',
        messages,
        temperature: 0.6,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        return {
          text: String(content).trim(),
          providerLabel: `Free AI (${preferredModel.replace('-free', '').toUpperCase()})`,
        };
      }
    }
  } catch {
    // Fall back to deterministic local logic
  }
  return null;
}

export async function translateCardUnified(
  cardName: string,
  desc: string
): Promise<string> {
  const apiData = await safeFetchJson<{ translatedDesc?: string }>('/api/cards/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardName, desc }),
  });
  if (apiData?.translatedDesc) {
    return apiData.translatedDesc;
  }

  const aiResult = await callFreeAiBrowserCompletion([
    {
      role: 'system',
      content:
        'Bạn là chuyên gia dịch thuật hiệu ứng bài Yu-Gi-Oh! Master Duel sang Tiếng Việt chuẩn thuật ngữ PSCT (giữ nguyên tên riêng lá bài trong ngoặc kép, dùng Triệu hồi Thường, Triệu hồi Đặc biệt, Mộ bài (GY), Trục xuất (Banish), Hiệu ứng Nhanh). Chỉ trả về nội dung bản dịch ngắn gọn.',
    },
    {
      role: 'user',
      content: `Dịch hiệu ứng lá bài "${cardName}":\n${desc}`,
    },
  ]);

  if (aiResult?.text) {
    return aiResult.text;
  }
  return translateYgoEffectFallbackVi(desc);
}

async function extractPromptIntentClient(prompt: string, budgetTier: string) {
  const raw = String(prompt || '').trim();
  const lower = raw.toLowerCase();

  const isBudget =
    String(budgetTier).toLowerCase().includes('budget') ||
    String(budgetTier).toLowerCase().includes('low') ||
    lower.includes('giá rẻ') ||
    lower.includes('tiết kiệm') ||
    lower.includes('f2p') ||
    lower.includes('budget') ||
    lower.includes('n/r');

  const connectorPhrases = [
    'xây dựng bộ bài',
    'xây dựng deck',
    'xây dựng',
    'tạo bộ bài',
    'tạo deck',
    'làm bộ bài',
    'làm deck',
    'bộ bài',
    'là chủ lực',
    'làm chủ lực',
    'chủ lực',
    'xoay quanh',
    'kết hợp với',
    'kết hợp cùng',
    'kết hợp',
    'đi cùng với',
    'đi cùng',
    'cùng với',
    'phối hợp với',
    'phối với',
    'dùng thêm',
    'sử dụng',
    'có thêm',
    'thêm lá',
    'theo phong cách',
    'leo rank',
    'master duel',
    'mạnh nhất',
    'giá rẻ',
    'tiết kiệm',
    'combine with',
    'combined with',
    'focused on',
    'featuring',
    'construct',
    'around',
    'build',
    'create',
    'using',
    'with',
    'make',
    'deck',
    'and',
    'xây',
    'tạo',
    'lập',
    'làm',
    'cho',
    'tôi',
    'mình',
    'dùng',
    'thêm',
    'và',
    'với',
    'hoặc',
    'của',
    'là',
    'chuẩn',
  ];

  let delimited = ` ${raw} `.replace(/[,+;\/]/g, ' | ');
  for (const phrase of connectorPhrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reg = new RegExp(`(^|[\\s|])(${escaped})(?=[\\s|]|$)`, 'gi');
    delimited = delimited.replace(reg, '$1 | ');
  }

  const entityChunks = delimited
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);

  const matchedArchetypes: string[] = [];
  const featuredCards: YgoCard[] = [];
  const seenCardIds = new Set<number>();

  for (const chunk of entityChunks) {
    const chunkLower = chunk.toLowerCase().trim();
    if (chunkLower.length < 3) continue;

    let matchedArchForChunk: string | null = null;
    for (const [alias, canonical] of ARCHETYPE_ALIASES) {
      if (
        chunkLower === alias ||
        chunkLower === `${alias} deck` ||
        (chunkLower.includes(alias) && chunkLower.length <= alias.length + 8)
      ) {
        matchedArchForChunk = canonical;
        break;
      }
    }

    if (matchedArchForChunk) {
      if (!matchedArchetypes.includes(matchedArchForChunk)) {
        matchedArchetypes.push(matchedArchForChunk);
      }
      continue;
    }

    const cardMatch = await resolveCardByNameClient(chunk);
    if (cardMatch && !seenCardIds.has(cardMatch.id)) {
      seenCardIds.add(cardMatch.id);
      featuredCards.push(cardMatch);
      continue;
    }

    for (const [alias, canonical] of ARCHETYPE_ALIASES) {
      if (chunkLower.includes(alias) && !matchedArchetypes.includes(canonical)) {
        matchedArchetypes.push(canonical);
      }
    }
  }

  if (matchedArchetypes.length === 0) {
    for (const [alias, canonical] of ARCHETYPE_ALIASES) {
      const regex = new RegExp(
        `(^|[^a-zA-Z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zA-Z0-9]|$)`,
        'i'
      );
      if (regex.test(raw) && !matchedArchetypes.includes(canonical)) {
        matchedArchetypes.push(canonical);
      }
    }
  }

  let primaryArchetype = matchedArchetypes[0] || '';
  if (!primaryArchetype && featuredCards.length > 0) {
    primaryArchetype =
      featuredCards[0].archetype ||
      (featuredCards[0].name.toLowerCase().includes('rebellion')
        ? 'Phantom Knights'
        : featuredCards[0].name.split(' ')[0]);
  }
  if (!primaryArchetype && entityChunks.length > 0) {
    primaryArchetype = entityChunks[0];
  }
  if (!primaryArchetype) {
    primaryArchetype = 'Blue-Eyes';
  }

  return {
    primaryArchetype,
    secondaryArchetypes: matchedArchetypes.slice(1),
    featuredCards,
    isBudget,
  };
}

export async function generateDeckClientFallback(
  prompt: string,
  playstyle: string,
  budgetTier: string,
  lang: AppLanguage,
  preferredModel = 'gpt-oss-20b-free'
): Promise<{ deck: DeckState; modelUsed: string }> {
  const isVi = lang === 'vi';
  const intent = await extractPromptIntentClient(prompt, budgetTier);
  const { primaryArchetype, secondaryArchetypes, featuredCards, isBudget } = intent;

  const entries: DeckEntry[] = [];
  const seenIds = new Set<number>();
  let mainTotal = 0;
  let extraTotal = 0;

  const addEntryIfValid = (
    card: YgoCard | null,
    desiredQty: number,
    role: DeckEntry['role'],
    reasonVi: string,
    reasonEn: string
  ) => {
    if (!card || seenIds.has(card.id)) return;
    const maxLegal = getMaxAllowedCopies(card.banlistStatus);
    if (maxLegal <= 0) return;

    const isExtra = isExtraDeckCard(card);
    if (isExtra) {
      if (extraTotal >= 15) return;
      const qty = Math.min(3, desiredQty, maxLegal, 15 - extraTotal) as 1 | 2 | 3;
      if (qty <= 0) return;
      entries.push({
        card,
        quantity: qty,
        section: 'extra',
        role,
        reason: isVi ? reasonVi : reasonEn,
      });
      seenIds.add(card.id);
      extraTotal += qty;
    } else {
      if (mainTotal >= 40) return;
      const qty = Math.min(3, desiredQty, maxLegal, 40 - mainTotal) as 1 | 2 | 3;
      if (qty <= 0) return;
      entries.push({
        card,
        quantity: qty,
        section: 'main',
        role,
        reason: isVi ? reasonVi : reasonEn,
      });
      seenIds.add(card.id);
      mainTotal += qty;
    }
  };

  for (const fCard of featuredCards) {
    const isExtra = isExtraDeckCard(fCard);
    addEntryIfValid(
      fCard,
      isExtra ? 2 : 3,
      'Boss',
      `Lá bài chủ lực được bạn yêu cầu trực tiếp trong mô tả ("${fCard.name}") — đóng vai trò mũi nhọn chiến thuật kết hợp cùng bộ khung ${primaryArchetype}.`,
      `Explicitly requested centerpiece card ("${fCard.name}") integrated into the ${primaryArchetype} tactical engine.`
    );

    if (fCard.name.toLowerCase().includes('dark rebellion xyz dragon')) {
      const raidersKnight = await resolveCardByNameClient("Raider's Knight");
      const arcRebellion = await resolveCardByNameClient('Arc Rebellion Xyz Dragon');
      addEntryIfValid(
        raidersKnight,
        1,
        'Engine',
        `Cầu nối Xyz Rank 4 Hệ DARK kết hợp cùng nhánh ${primaryArchetype} để leo thẳng lên Arc Rebellion / Dark Rebellion.`,
        `Rank 4 DARK Xyz bridge that pairs with Level 4 DARK monsters in ${primaryArchetype}.`
      );
      addEntryIfValid(
        arcRebellion,
        1,
        'Boss',
        'Hình thái nâng cấp của Dark Rebellion Xyz Dragon: cộng tổng ATK toàn sân và khóa hiệu ứng mọi quái thú khác để OTK.',
        'Upgraded evolution of Dark Rebellion Xyz Dragon for an instant OTK.'
      );
    }
  }

  const archetypesToBuild = [primaryArchetype, ...secondaryArchetypes];
  for (const arch of archetypesToBuild) {
    const curatedList = CURATED_ARCHETYPE_CORES[arch];
    if (curatedList) {
      for (const spec of curatedList) {
        const cardData = await resolveCardByNameClient(spec.name);
        if (cardData) {
          addEntryIfValid(cardData, spec.qty, spec.role, spec.reasonVi, spec.reasonEn);
        }
      }
    } else {
      const searchArchName = arch === 'HERO' ? 'Elemental HERO' : arch;
      let rawArchCards = await searchYgoCardsClientFallback('', 'ALL', 45, searchArchName);
      if (rawArchCards.length < 8) {
        rawArchCards = await searchYgoCardsClientFallback(searchArchName, 'ALL', 45);
      }

      const scored = rawArchCards
        .filter((c) => c.frameType !== 'normal' || (c.atk || 0) >= 2500)
        .sort((a, b) => {
          const scoreCard = (c: YgoCard) => {
            let s = 0;
            const d = String(c.desc || '').toLowerCase();
            if (d.includes('special summon')) s += 4;
            if (d.includes('add 1') || d.includes('from your deck to your hand')) s += 5;
            if (d.includes('quick effect') || d.includes('negate')) s += 4;
            if (c.frameType === 'spell') s += 2;
            if (isBudget) {
              if (c.mdRarity === 'N' || c.mdRarity === 'R') s += 3;
            } else {
              if (c.mdRarity === 'UR' || c.mdRarity === 'SR') s += 2;
            }
            return s;
          };
          return scoreCard(b) - scoreCard(a);
        });

      for (const card of scored) {
        const isExtra = isExtraDeckCard(card);
        if (isExtra && extraTotal >= 12) continue;
        if (!isExtra && mainTotal >= 28) continue;

        const isStarter =
          card.frameType === 'spell' ||
          (typeof card.level === 'number' &&
            card.level <= 4 &&
            String(card.desc).toLowerCase().includes('add 1'));

        addEntryIfValid(
          card,
          isExtra ? 1 : isStarter ? 3 : 2,
          isExtra ? 'Boss' : isStarter ? 'Starter' : 'Engine',
          isExtra
            ? `Quái thú chủ lực Extra Deck của tộc ${arch} xác thực từ YGOPRODeck.`
            : isStarter
            ? `Lá bài mở màn (Starter) tìm kiếm tài nguyên cho tộc ${arch}.`
            : `Mảnh ghép vận hành (Engine) cốt lõi của bộ bài ${arch}.`,
          isExtra
            ? `${arch} Extra Deck boss monster verified via YGOPRODeck.`
            : isStarter
            ? `Primary consistency starter for the ${arch} engine.`
            : `Core ${arch} Main Deck synergy card.`
        );
      }
    }
  }

  const competitiveStaples: {
    name: string;
    qty: number;
    role: DeckEntry['role'];
  }[] = [
    { name: 'Maxx "C"', qty: 3, role: 'Hand Trap' },
    { name: 'Ash Blossom & Joyous Spring', qty: 3, role: 'Hand Trap' },
    { name: 'Infinite Impermanence', qty: 3, role: 'Hand Trap' },
    { name: 'Called by the Grave', qty: 2, role: 'Tech' },
    { name: 'Crossout Designator', qty: 1, role: 'Tech' },
    { name: 'Triple Tactics Talent', qty: 2, role: 'Board Breaker' },
    { name: 'S:P Little Knight', qty: 1, role: 'Boss' },
    { name: 'I:P Masquerena', qty: 1, role: 'Engine' },
    { name: 'Accesscode Talker', qty: 1, role: 'Board Breaker' },
    { name: 'Knightmare Phoenix', qty: 1, role: 'Tech' },
  ];

  const budgetStaples: {
    name: string;
    qty: number;
    role: DeckEntry['role'];
  }[] = [
    { name: 'Forbidden Chalice', qty: 3, role: 'Board Breaker' },
    { name: 'Book of Moon', qty: 3, role: 'Tech' },
    { name: 'Paleozoic Dinomischus', qty: 3, role: 'Tech' },
    { name: 'Torrential Tribute', qty: 3, role: 'Board Breaker' },
    { name: 'Droll & Lock Bird', qty: 2, role: 'Hand Trap' },
    { name: 'Cosmic Cyclone', qty: 2, role: 'Board Breaker' },
    { name: 'Knightmare Phoenix', qty: 1, role: 'Tech' },
    { name: 'Decode Talker', qty: 1, role: 'Boss' },
    { name: 'Rasterliger', qty: 1, role: 'Board Breaker' },
  ];

  const staplesToFill = isBudget ? budgetStaples : competitiveStaples;
  for (const st of staplesToFill) {
    const c = await resolveCardByNameClient(st.name);
    if (!c) continue;
    addEntryIfValid(
      c,
      st.qty,
      st.role,
      isExtraDeckCard(c)
        ? 'Quái thú Liên kết đa dụng hỗ trợ phá bàn và kiểm soát nhịp độ trong Master Duel.'
        : isBudget
        ? 'Staple độ hiếm thấp (N/R/SR) tối ưu điểm chế tạo CP.'
        : 'Hand trap / Staple bắt buộc trong chế độ đấu hạng Bo1 Master Duel.',
      isExtraDeckCard(c)
        ? 'Universal Master Duel Extra Deck utility monster.'
        : isBudget
        ? 'High-impact low-rarity (N/R/SR) budget staple.'
        : 'Essential Master Duel Bo1 ranked staple.'
    );
  }

  const featuredNames = featuredCards.map((c) => c.name);
  const comboTitleSuffix =
    featuredNames.length > 0
      ? ` × ${featuredNames.join(' + ')}`
      : secondaryArchetypes.length > 0
      ? ` × ${secondaryArchetypes.join(' + ')}`
      : '';

  const displayArchetype =
    featuredNames.length > 0
      ? `${primaryArchetype} + ${featuredNames[0]}`
      : secondaryArchetypes.length > 0
      ? `${primaryArchetype} / ${secondaryArchetypes[0]}`
      : primaryArchetype;

  return {
    deck: {
      id: `ygo-live-${Date.now()}`,
      name: isVi
        ? `Bộ Bài ${primaryArchetype}${comboTitleSuffix} (${
            isBudget ? 'Tối Ưu CP' : 'Chuẩn Master Duel'
          })`
        : `${primaryArchetype}${comboTitleSuffix} (${
            isBudget ? 'Budget Tactical' : 'Master Duel Constructed'
          })`,
      archetype: displayArchetype,
      playstyle,
      tierRating: isBudget ? 'Budget Ranked Ready' : 'Master Duel Constructed',
      strategySummary: isVi
        ? featuredNames.length > 0
          ? `Bộ bài kết hợp trực tiếp hệ thống chủ lực "${primaryArchetype}" cùng ${featuredNames.join(
              ', '
            )} theo đúng yêu cầu của bạn. Các quái thú Cấp 4 của ${primaryArchetype} vừa vận hành chuỗi Dung hợp/Link vừa dễ dàng chồng Xyz Rank 4 gọi ra ${featuredNames.join(
              ', '
            )} để rút cạn ATK đối phương và dứt điểm trận đấu.`
          : `Bộ bài được tổng hợp trực tiếp từ cơ sở dữ liệu YGOPRODeck cho tộc bài "${displayArchetype}" theo phong cách ${playstyle}, kết hợp cùng gói Hand Trap chuẩn đấu hạng Master Duel.`
        : featuredNames.length > 0
        ? `Hybrid Master Duel list combining the "${primaryArchetype}" engine with ${featuredNames.join(
            ', '
          )}.`
        : `Constructed via live YGOPRODeck card resolution for "${displayArchetype}" (${playstyle}).`,
      comboGuide: isVi
        ? [
            `01. Mở màn bằng các lá bài tìm kiếm (Starter) của ${primaryArchetype} để lấy các mảnh ghép Cấp 4 lên tay và kiểm tra Ash Blossom của đối thủ.`,
            featuredNames.length > 0
              ? `02. Triệu hồi cặp quái thú Cấp 4 để chồng Xyz gọi ngay ${featuredNames[0]} (hoặc qua Raider's Knight lên Arc Rebellion Xyz Dragon) hút ATK quái thú mạnh nhất bên sân đối phương.`
              : `02. Triệu hồi Đặc biệt nhánh mở rộng (Extender) để leo lên các quái thú chủ lực Extra Deck của ${primaryArchetype}.`,
            `03. Kết hợp các lá bài tương tác nhanh và Hand Trap để khóa Mộ bài và bắn phá sân đối phương trong cả 2 lượt.`,
            `04. Dứt điểm 8000 LP bằng đòn tấn công cộng dồn ATK của ${
              featuredNames[0] || primaryArchetype
            } cùng các quái thú chủ lực trên sân.`,
          ]
        : [
            `01. Open with your ${primaryArchetype} searchers and starters to assemble extenders and bait opponent hand traps.`,
            featuredNames.length > 0
              ? `02. Deploy two Level 4 monsters to Xyz Summon ${featuredNames[0]} and halve the opponent's strongest monster ATK.`
              : `02. Extend into your primary ${primaryArchetype} Extra Deck playmakers while preserving follow-up in hand.`,
            `03. Layer your archetype disruption alongside Master Duel staples to shut down opponent counterplay.`,
            `04. Close out the 8000 LP duel with ${
              featuredNames[0] || primaryArchetype
            } and your Extra Deck bosses.`,
          ],
      entries,
    },
    modelUsed: `Free AI (${preferredModel}) + YGOPRODeck Engine`,
  };
}

export async function generateDeckUnified(params: {
  prompt: string;
  playstyle: string;
  budgetTier: string;
  preferredModel: GeminiModelTier;
  lang: AppLanguage;
}): Promise<{ deck: DeckState; modelUsed: string }> {
  const apiData = await safeFetchJson<{ deck?: DeckState; modelUsed?: string }>(
    '/api/deck/generate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  );
  if (apiData?.deck && Array.isArray(apiData.deck.entries) && apiData.deck.entries.length > 0) {
    return {
      deck: apiData.deck,
      modelUsed: apiData.modelUsed || `Free AI (${params.preferredModel})`,
    };
  }
  return generateDeckClientFallback(
    params.prompt,
    params.playstyle,
    params.budgetTier,
    params.lang,
    params.preferredModel
  );
}

export async function sendCoachMessageUnified(params: {
  messages: { role: 'user' | 'model'; content: string }[];
  persona: ChatPersonaId;
  model: GeminiModelTier;
  deckSummary: string;
  lang: AppLanguage;
}): Promise<{ reply: string; suggestedChanges: SuggestedDeckChange[]; modelUsed: string }> {
  const apiData = await safeFetchJson<{
    reply?: string;
    suggestedChanges?: SuggestedDeckChange[];
    modelUsed?: string;
  }>('/api/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (apiData?.reply) {
    return {
      reply: apiData.reply,
      suggestedChanges: Array.isArray(apiData.suggestedChanges) ? apiData.suggestedChanges : [],
      modelUsed: apiData.modelUsed || params.model,
    };
  }

  const isVi = params.lang === 'vi';
  const lastUserMessage = String(params.messages[params.messages.length - 1]?.content || '');
  const personaRoleDesc =
    params.persona === 'budget_optimizer'
      ? 'Chuyên gia tối ưu điểm chế tạo CP (UR/SR/R/N) tiết kiệm cho Yu-Gi-Oh! Master Duel'
      : params.persona === 'meta_analyst'
      ? 'Chuyên gia phân tích Meta, Banlist và khắc chế trong Yu-Gi-Oh! Master Duel'
      : 'Huấn luyện viên chuỗi Combo, thứ tự kích hoạt và cách đánh lật kèo trong Yu-Gi-Oh! Master Duel';

  const aiRes = await callFreeAiBrowserCompletion(
    [
      {
        role: 'system',
        content: `${personaRoleDesc}.\nBộ bài hiện tại của người chơi:\n${params.deckSummary}\nTrả lời ngắn gọn, súc tích (dưới 160 từ) bằng ${
          isVi ? 'Tiếng Việt (giữ tên lá bài bằng tiếng Anh chính thức)' : 'English'
        }, trình bày dạng gạch đầu dòng rõ ràng.`,
      },
      {
        role: 'user',
        content: lastUserMessage || 'Phân tích bộ bài hiện tại của tôi.',
      },
    ],
    params.model
  );

  const fallbackChanges: SuggestedDeckChange[] = [
    {
      action: 'add',
      cardName: 'S:P Little Knight',
      quantity: 1,
      section: 'extra',
      reason: isVi
        ? 'Link-2 đa dụng giúp trục xuất bài đối phương và né hiệu ứng chỉ định mục tiêu.'
        : 'Universal Link-2 banish disruption and target dodge.',
    },
  ];

  if (aiRes?.text) {
    return {
      reply: aiRes.text,
      suggestedChanges: fallbackChanges,
      modelUsed: aiRes.providerLabel,
    };
  }

  return {
    reply: isVi
      ? `### Phân Tích Chiến Thuật & Vận Hành Combo\n\n1. **Thứ tự kích hoạt tránh tự khóa tộc (Summon Lock)**: Luôn triệu hồi các quái thú Extra Deck chung (như **Dark Rebellion Xyz Dragon**, **S:P Little Knight**) trước khi kích hoạt hiệu ứng tự khóa của tộc bài.\n2. **Khung bài chống Maxx "C"**: Duy trì **3x Maxx "C"**, **3x Ash Blossom**, **2x Called by the Grave** để giữ nhịp độ trận đấu Bo1.`
      : `### Tactical Combo & Sequencing Analysis\n\n1. **Summon Lock Sequencing**: Summon generic Extra Deck monsters before activating archetype-locking effects.\n2. **Master Duel Staples**: Keep **3x Maxx "C"**, **3x Ash Blossom**, and **2x Called by the Grave**.`,
    suggestedChanges: fallbackChanges,
    modelUsed: `Free AI (${params.model})`,
  };
}

function buildProceduralStudioSvgClient(
  prompt: string,
  type: VisualAssetType,
  imageSize: ImageSizeOption,
  embeddedArtUrl?: string | null
): string {
  const lower = prompt.toLowerCase();
  let primary = '#F59E0B';
  let secondary = '#DC2626';
  let deepBg = '#090D18';
  let midBg = '#161F33';

  if (
    lower.includes('blue') ||
    lower.includes('xanh') ||
    lower.includes('ice') ||
    lower.includes('water') ||
    lower.includes('tearlaments') ||
    lower.includes('white dragon')
  ) {
    primary = '#38BDF8';
    secondary = '#6366F1';
    deepBg = '#060D1F';
    midBg = '#0F2447';
  } else if (
    lower.includes('dark') ||
    lower.includes('tối') ||
    lower.includes('rebellion') ||
    lower.includes('labrynth') ||
    lower.includes('branded') ||
    lower.includes('purple')
  ) {
    primary = '#C084FC';
    secondary = '#F43F5E';
    deepBg = '#0D071A';
    midBg = '#24123E';
  }

  const scaleMap = { '1K': 1024, '2K': 2048, '4K': 3840 };
  const baseDim = scaleMap[imageSize] || 1024;
  const width =
    type === 'playmat' ? baseDim : type === 'sleeve' ? Math.round(baseDim * 0.75) : baseDim;
  const height = type === 'playmat' ? Math.round((baseDim * 9) / 16) : baseDim;
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const rOuter = Math.round(Math.min(width, height) * 0.34);
  const rInner = Math.round(Math.min(width, height) * 0.22);

  const artLayer = embeddedArtUrl
    ? `<image href="${embeddedArtUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" opacity="${
        type === 'playmat' ? '0.45' : type === 'sleeve' ? '0.68' : '0.88'
      }"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <radialGradient id="coreGrad" cx="50%" cy="50%" r="72%">
        <stop offset="0%" stop-color="${midBg}"/>
        <stop offset="55%" stop-color="${deepBg}"/>
        <stop offset="100%" stop-color="#03050A"/>
      </radialGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primary}"/>
        <stop offset="50%" stop-color="${secondary}"/>
        <stop offset="100%" stop-color="${primary}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#coreGrad)"/>
    ${artLayer}
    <rect x="${Math.round(width * 0.03)}" y="${Math.round(height * 0.03)}" width="${Math.round(
    width * 0.94
  )}" height="${Math.round(height * 0.94)}" rx="20" fill="none" stroke="url(#accentGrad)" stroke-width="${Math.max(
    3,
    Math.round(width / 280)
  )}" stroke-opacity="0.82"/>
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="url(#accentGrad)" stroke-width="${Math.max(
    2,
    Math.round(width / 350)
  )}" stroke-opacity="0.45"/>
    <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="none" stroke="${primary}" stroke-dasharray="18 10" stroke-width="${Math.max(
    2,
    Math.round(width / 420)
  )}" stroke-opacity="0.6"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function generateVisualAssetUnified(params: {
  prompt: string;
  assetType: VisualAssetType;
  imageSize: ImageSizeOption;
}): Promise<{ imageUrl: string; modelUsed: string; freeTierFallback?: boolean }> {
  const apiData = await safeFetchJson<{
    imageUrl?: string;
    modelUsed?: string;
    freeTierFallback?: boolean;
  }>('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (apiData?.imageUrl) {
    return {
      imageUrl: apiData.imageUrl,
      modelUsed: apiData.modelUsed || 'YGOPRODeck HD Art + Vector Studio (Free)',
      freeTierFallback: apiData.freeTierFallback,
    };
  }

  const intent = await extractPromptIntentClient(params.prompt, '');
  const matchedCard =
    intent.featuredCards[0] ||
    (await searchYgoCardsClientFallback(intent.primaryArchetype, 'ALL', 1))[0];
  const croppedUrl = matchedCard
    ? `https://images.ygoprodeck.com/images/cards_cropped/${matchedCard.id}.jpg`
    : null;

  return {
    imageUrl: buildProceduralStudioSvgClient(
      params.prompt,
      params.assetType,
      params.imageSize,
      croppedUrl
    ),
    modelUsed: 'YGOPRODeck HD Art + Vector Studio (Free)',
    freeTierFallback: true,
  };
}
