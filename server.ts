import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory cache for YGOPRODeck lookups to keep deck generation fast
const cardByNameCache = new Map<string, any>();
const cardByIdCache = new Map<number, any>();

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

function normalizeFrameType(rawFrame?: string, rawType?: string): string {
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

function mapYgoApiCard(raw: any) {
  const id = Number(raw.id);
  const misc = Array.isArray(raw.misc_info) && raw.misc_info[0] ? raw.misc_info[0] : {};
  const imgObj = Array.isArray(raw.card_images) && raw.card_images[0] ? raw.card_images[0] : null;
  const card = {
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

async function resolveCardByName(name: string): Promise<any | null> {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length < 3) return null;
  const key = cleanName.toLowerCase();
  if (cardByNameCache.has(key)) {
    return cardByNameCache.get(key);
  }

  try {
    const exactUrl = `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(
      cleanName
    )}&misc=yes`;
    const exactRes = await fetch(exactUrl);
    if (exactRes.ok) {
      const exactJson: any = await exactRes.json();
      if (Array.isArray(exactJson?.data) && exactJson.data.length > 0) {
        return mapYgoApiCard(exactJson.data[0]);
      }
    }

    const fuzzyUrl = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(
      cleanName
    )}&misc=yes&num=8&offset=0`;
    const fuzzyRes = await fetch(fuzzyUrl);
    if (fuzzyRes.ok) {
      const fuzzyJson: any = await fuzzyRes.json();
      if (Array.isArray(fuzzyJson?.data) && fuzzyJson.data.length > 0) {
        const bestMatch =
          fuzzyJson.data.find((c: any) => String(c.name).toLowerCase() === key) ||
          fuzzyJson.data.find((c: any) => String(c.name).toLowerCase().startsWith(key)) ||
          fuzzyJson.data[0];
        return mapYgoApiCard(bestMatch);
      }
    }
  } catch {
    // Ignore transient network errors
  }
  return null;
}

/**
 * Comprehensive Vietnamese & English Archetype Alias Map
 * Ordered from most specific phrases to broader archetype names.
 */
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
  role: 'Starter' | 'Extender' | 'Hand Trap' | 'Board Breaker' | 'Boss' | 'Engine' | 'Tech';
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

interface ExtractedPromptIntent {
  primaryArchetype: string;
  secondaryArchetypes: string[];
  featuredCards: any[];
  isBudget: boolean;
}

async function extractPromptIntent(
  prompt: string,
  budgetTier: string
): Promise<ExtractedPromptIntent> {
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
  const featuredCards: any[] = [];
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

    const cardMatch = await resolveCardByName(chunk);
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

function resolveVietnameseArchetypeAlias(input: string): string {
  const lower = input.toLowerCase();
  for (const [alias, canonical] of ARCHETYPE_ALIASES) {
    if (lower.includes(alias)) {
      return canonical === 'HERO' ? 'Elemental HERO' : canonical;
    }
  }
  return input;
}

function translatePsctToVietnameseServer(desc: string): string {
  if (!desc) return '';
  let out = desc;
  const rules: [RegExp, string][] = [
    [/\(Quick Effect\):/gi, '(Hiệu ứng Nhanh):'],
    [/You can only use each effect of "([^"]+)" once per turn\./gi, 'Bạn chỉ có thể sử dụng mỗi hiệu ứng của "$1" một lần mỗi lượt.'],
    [/You can only use this effect of "([^"]+)" once per turn\./gi, 'Bạn chỉ có thể sử dụng hiệu ứng này của "$1" một lần mỗi lượt.'],
    [/You can only activate 1 "([^"]+)" per turn\./gi, 'Bạn chỉ có thể kích hoạt 1 "$1" mỗi lượt.'],
    [/Once per turn:/gi, 'Một lần mỗi lượt:'],
    [/Cannot be Normal Summoned\/Set\./gi, 'Không thể Triệu hồi Thường/Úp.'],
    [/Cannot be destroyed by battle/gi, 'Không thể bị tiêu diệt trong chiến đấu'],
    [/Cannot be destroyed by card effects/gi, 'Không thể bị tiêu diệt bởi hiệu ứng bài'],
    [/If this card is Normal or Special Summoned:/gi, 'Nếu lá bài này được Triệu hồi Thường hoặc Triệu hồi Đặc biệt:'],
    [/When this card is Normal Summoned:/gi, 'Khi lá bài này được Triệu hồi Thường:'],
    [/If this card is Special Summoned:/gi, 'Nếu lá bài này được Triệu hồi Đặc biệt:'],
    [/If this card is sent to the GY:/gi, 'Nếu lá bài này được gửi xuống Mộ bài (GY):'],
    [/During the Main Phase/gi, 'Trong Main Phase'],
    [/During the Battle Phase/gi, 'Trong Battle Phase'],
    [/During the End Phase/gi, 'Trong End Phase'],
    [/During your turn/gi, 'Trong lượt của bạn'],
    [/During your opponent's turn/gi, 'Trong lượt của đối thủ'],
    [/Special Summon/gi, 'Triệu hồi Đặc biệt'],
    [/Normal Summon/gi, 'Triệu hồi Thường'],
    [/Synchro Summon/gi, 'Triệu hồi Đồng bộ (Synchro)'],
    [/Fusion Summon/gi, 'Triệu hồi Dung hợp (Fusion)'],
    [/Xyz Summon/gi, 'Triệu hồi Xyz'],
    [/Link Summon/gi, 'Triệu hồi Liên kết (Link)'],
    [/from your hand, Deck, or GY/gi, 'từ tay, Bộ bài (Deck), hoặc Mộ bài (GY) của bạn'],
    [/from your Deck to your hand/gi, 'từ Bộ bài (Deck) lên tay bạn'],
    [/from your Deck to the GY/gi, 'từ Bộ bài (Deck) xuống Mộ bài (GY)'],
    [/from your GY to your hand/gi, 'từ Mộ bài (GY) lên tay bạn'],
    [/from your hand or GY/gi, 'từ tay hoặc Mộ bài (GY) của bạn'],
    [/from your Deck/gi, 'từ Bộ bài (Deck) của bạn'],
    [/from your GY/gi, 'từ Mộ bài (GY) của bạn'],
    [/from your hand/gi, 'từ tay bạn'],
    [/Add 1 /gi, 'Thêm 1 '],
    [/add 1 /g, 'thêm 1 '],
    [/Target 1 /gi, 'Chọn mục tiêu 1 '],
    [/target 1 /g, 'chọn mục tiêu 1 '],
    [/detach (\d+) Xyz Materials? from this card/gi, 'tách $1 Nguyên liệu Xyz khỏi lá bài này'],
    [/detach 1 material from this card/gi, 'tách 1 nguyên liệu khỏi lá bài này'],
    [/negate the activation, and if you do, destroy that card/gi, 'vô hiệu hóa sự kích hoạt đó, và nếu làm vậy, tiêu diệt lá bài đó'],
    [/negate its effects/gi, 'vô hiệu hóa hiệu ứng của nó'],
    [/negate that effect/gi, 'vô hiệu hóa hiệu ứng đó'],
    [/destroy it/gi, 'tiêu diệt nó'],
    [/banish it/gi, 'trục xuất (banish) nó'],
    [/banish this card from your GY/gi, 'trục xuất lá bài này từ Mộ bài (GY) của bạn'],
    [/you can banish this card from your GY/gi, 'bạn có thể trục xuất lá bài này từ Mộ bài (GY)'],
    [/You can discard this card;/gi, 'Bạn có thể xả (discard) lá bài này;'],
    [/You can send this card from your hand or field to the GY;/gi, 'Bạn có thể gửi lá bài này từ tay hoặc sân xuống Mộ bài (GY);'],
    [/draw 1 card/gi, 'rút 1 lá bài'],
    [/Spell\/Trap/gi, 'Bài Phép/Bẫy'],
    [/monsters you control/gi, 'quái thú bạn điều khiển'],
    [/cards your opponent controls/gi, 'lá bài đối thủ điều khiển'],
    [/on the field/gi, 'trên sân'],
  ];

  for (const [pattern, replacement] of rules) {
    out = out.replace(pattern, replacement);
  }
  return `[Bản dịch thuật ngữ PSCT Tiếng Việt]\n${out}`;
}

async function searchYgoCards(params: {
  q?: string;
  archetype?: string;
  type?: string;
  attribute?: string;
  limit?: number;
}): Promise<any[]> {
  try {
    const query = new URLSearchParams();
    query.set('misc', 'yes');
    if (params.q && params.q.trim()) {
      const mappedQ = resolveVietnameseArchetypeAlias(params.q.trim());
      query.set('fname', mappedQ);
    }
    if (params.archetype && params.archetype.trim()) {
      query.set('archetype', params.archetype.trim());
    }
    if (params.type && params.type.trim() && params.type !== 'ALL') {
      query.set('type', params.type.trim());
    }
    if (params.attribute && params.attribute.trim() && params.attribute !== 'ALL') {
      query.set('attribute', params.attribute.trim());
    }

    const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?${query.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json: any = await res.json();
    if (!Array.isArray(json?.data)) return [];
    const limit = params.limit || 36;
    return json.data.slice(0, limit).map(mapYgoApiCard);
  } catch {
    return [];
  }
}

function isExtraFrame(frameType: string): boolean {
  return ['fusion', 'synchro', 'xyz', 'link'].includes(frameType);
}

function getMaxCopiesForBanlist(status: string): number {
  if (status === 'Forbidden') return 0;
  if (status === 'Limited') return 1;
  if (status === 'Semi-Limited') return 2;
  return 3;
}

function buildProceduralStudioSvg(
  prompt: string,
  type: 'sleeve' | 'playmat' | 'card_art',
  imageSize: '1K' | '2K' | '4K'
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
    lower.includes('labyrinth') ||
    lower.includes('labrynth') ||
    lower.includes('branded') ||
    lower.includes('abyss') ||
    lower.includes('purple')
  ) {
    primary = '#C084FC';
    secondary = '#F43F5E';
    deepBg = '#0D071A';
    midBg = '#24123E';
  } else if (
    lower.includes('emerald') ||
    lower.includes('wind') ||
    lower.includes('nature') ||
    lower.includes('green') ||
    lower.includes('swordsoul')
  ) {
    primary = '#34D399';
    secondary = '#FBBF24';
    deepBg = '#051614';
    midBg = '#0E332E';
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

  const zonesMarkup =
    type === 'playmat'
      ? `<g stroke="${primary}" stroke-opacity="0.32" stroke-width="${Math.max(
          2,
          Math.round(width / 600)
        )}" fill="none">
          <rect x="${Math.round(width * 0.22)}" y="${Math.round(height * 0.25)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
          <rect x="${Math.round(width * 0.34)}" y="${Math.round(height * 0.25)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
          <rect x="${Math.round(width * 0.46)}" y="${Math.round(height * 0.25)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
          <rect x="${Math.round(width * 0.58)}" y="${Math.round(height * 0.25)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
          <rect x="${Math.round(width * 0.7)}" y="${Math.round(height * 0.25)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
          <rect x="${Math.round(width * 0.22)}" y="${Math.round(height * 0.54)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
          <rect x="${Math.round(width * 0.34)}" y="${Math.round(height * 0.54)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
          <rect x="${Math.round(width * 0.46)}" y="${Math.round(height * 0.54)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
          <rect x="${Math.round(width * 0.58)}" y="${Math.round(height * 0.54)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
          <rect x="${Math.round(width * 0.7)}" y="${Math.round(height * 0.54)}" width="${Math.round(
          width * 0.08
        )}" height="${Math.round(height * 0.2)}" rx="8"/>
        </g>`
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
    <rect x="${Math.round(width * 0.03)}" y="${Math.round(height * 0.03)}" width="${Math.round(
    width * 0.94
  )}" height="${Math.round(height * 0.94)}" rx="20" fill="none" stroke="url(#accentGrad)" stroke-width="${Math.max(
    3,
    Math.round(width / 280)
  )}" stroke-opacity="0.75"/>
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="url(#accentGrad)" stroke-width="${Math.max(
    2,
    Math.round(width / 350)
  )}" stroke-opacity="0.5"/>
    <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="none" stroke="${primary}" stroke-dasharray="18 10" stroke-width="${Math.max(
    2,
    Math.round(width / 420)
  )}" stroke-opacity="0.65"/>
    <polygon points="${cx},${cy - rOuter} ${cx + Math.round(rOuter * 0.86)},${
    cy + Math.round(rOuter * 0.5)
  } ${cx - Math.round(rOuter * 0.86)},${
    cy + Math.round(rOuter * 0.5)
  }" fill="none" stroke="url(#accentGrad)" stroke-width="${Math.max(
    2,
    Math.round(width / 400)
  )}" stroke-opacity="0.4"/>
    <polygon points="${cx},${cy + rOuter} ${cx + Math.round(rOuter * 0.86)},${
    cy - Math.round(rOuter * 0.5)
  } ${cx - Math.round(rOuter * 0.86)},${
    cy - Math.round(rOuter * 0.5)
  }" fill="none" stroke="url(#accentGrad)" stroke-width="${Math.max(
    2,
    Math.round(width / 400)
  )}" stroke-opacity="0.4"/>
    ${zonesMarkup}
    <polygon points="${cx},${cy - rInner} ${cx + Math.round(rInner * 0.65)},${cy} ${cx},${
    cy + rInner
  } ${cx - Math.round(rInner * 0.65)},${cy}" fill="url(#accentGrad)" fill-opacity="0.28" stroke="${primary}" stroke-width="${Math.max(
    3,
    Math.round(width / 320)
  )}"/>
    <circle cx="${cx}" cy="${cy}" r="${Math.round(
    rInner * 0.28
  )}" fill="${primary}" fill-opacity="0.85"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // 1. Live YGOPRODeck Card Search Endpoint
  app.get('/api/cards/search', async (req, res) => {
    const q = String(req.query.q || '');
    const archetype = String(req.query.archetype || '');
    const type = String(req.query.type || '');
    const attribute = String(req.query.attribute || '');
    const limit = Number(req.query.limit || 36);

    const cards = await searchYgoCards({ q, archetype, type, attribute, limit });
    res.json({ cards });
  });

  // 2. Hydrate passcodes from .ydk import via live YGOPRODeck API
  app.post('/api/cards/hydrate', async (req, res) => {
    try {
      const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const uniqueIds = Array.from(new Set(ids.map((n) => Number(n)).filter((n) => n > 0)));
      if (uniqueIds.length === 0) {
        res.json({ cards: {} });
        return;
      }

      const missingIds = uniqueIds.filter((id) => !cardByIdCache.has(id));
      if (missingIds.length > 0) {
        for (let i = 0; i < missingIds.length; i += 45) {
          const chunk = missingIds.slice(i, i + 45);
          const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${chunk.join(',')}&misc=yes`;
          const apiRes = await fetch(url);
          if (apiRes.ok) {
            const json: any = await apiRes.json();
            if (Array.isArray(json?.data)) {
              json.data.forEach(mapYgoApiCard);
            }
          }
        }
      }

      const resultMap: Record<number, any> = {};
      for (const id of uniqueIds) {
        if (cardByIdCache.has(id)) {
          resultMap[id] = cardByIdCache.get(id);
        }
      }
      res.json({ cards: resultMap });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to hydrate card passcodes' });
    }
  });

  // 2b. Translate Card Effect to Vietnamese
  app.post('/api/cards/translate', async (req, res) => {
    const { desc = '' } = req.body || {};
    if (!desc) {
      res.json({ translatedDesc: '' });
      return;
    }

    res.json({
      translatedDesc: translatePsctToVietnameseServer(String(desc)),
      modelUsed: 'psct-vietnamese-engine',
    });
  });

  // 3. Hybrid Deck Construction + Live YGOPRODeck Passcode & Banlist Resolution
  app.post('/api/deck/generate', async (req, res) => {
    const {
      prompt = 'Build a competitive Master Duel deck',
      playstyle = 'Balanced Midrange',
      budgetTier = 'Competitive (No UR Limit)',
      lang = 'vi',
    } = req.body || {};

    const isVi = lang === 'vi';

    try {
      const intent = await extractPromptIntent(String(prompt), String(budgetTier));
      const { primaryArchetype, secondaryArchetypes, featuredCards, isBudget } = intent;

      const entries: any[] = [];
      const seenIds = new Set<number>();
      let mainTotal = 0;
      let extraTotal = 0;

      const addEntryIfValid = (
        card: any,
        desiredQty: number,
        role: 'Starter' | 'Extender' | 'Hand Trap' | 'Board Breaker' | 'Boss' | 'Engine' | 'Tech',
        reasonVi: string,
        reasonEn: string
      ) => {
        if (!card || seenIds.has(card.id)) return;
        const maxLegal = getMaxCopiesForBanlist(card.banlistStatus);
        if (maxLegal <= 0) return;

        const isExtra = isExtraFrame(card.frameType);
        if (isExtra) {
          if (extraTotal >= 15) return;
          const qty = Math.min(desiredQty, maxLegal, 15 - extraTotal);
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
          const qty = Math.min(desiredQty, maxLegal, 40 - mainTotal);
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

      // Step 1: Always add all explicitly requested Featured Cards FIRST so user requests are 100% honored!
      for (const fCard of featuredCards) {
        const isExtra = isExtraFrame(fCard.frameType);
        addEntryIfValid(
          fCard,
          isExtra ? 2 : 3,
          'Boss',
          `Lá bài chủ lực được bạn yêu cầu trực tiếp trong mô tả ("${fCard.name}") — đóng vai trò mũi nhọn chiến thuật kết hợp cùng bộ khung ${primaryArchetype}.`,
          `Explicitly requested centerpiece card ("${fCard.name}") integrated into the ${primaryArchetype} tactical engine.`
        );

        if (fCard.name.toLowerCase().includes('dark rebellion xyz dragon')) {
          const raidersKnight = await resolveCardByName("Raider's Knight");
          const arcRebellion = await resolveCardByName('Arc Rebellion Xyz Dragon');
          addEntryIfValid(
            raidersKnight,
            1,
            'Engine',
            `Cầu nối Xyz Rank 4 Hệ DARK kết hợp cùng nhánh ${primaryArchetype} (như Vyon + Shadow Mist) để leo thẳng lên Arc Rebellion / Dark Rebellion.`,
            `Rank 4 DARK Xyz bridge that pairs with Level 4 DARK monsters in ${primaryArchetype} to climb into Rebellion dragons.`
          );
          addEntryIfValid(
            arcRebellion,
            1,
            'Boss',
            'Hình thái nâng cấp của Dark Rebellion Xyz Dragon: cộng tổng ATK toàn sân và khóa hiệu ứng mọi quái thú khác để OTK 1 phát dứt điểm.',
            'Upgraded evolution of Dark Rebellion Xyz Dragon that absorbs total field ATK and negates all other monsters for an instant OTK.'
          );
        }

        if (fCard.frameType === 'ritual') {
          const ritualSpell = await resolveCardByName('Advanced Ritual Art');
          addEntryIfValid(
            ritualSpell,
            2,
            'Engine',
            `Bài Phép Nghi thức hỗ trợ triệu hồi nhanh ${fCard.name}.`,
            `Ritual Spell bridge to summon ${fCard.name}.`
          );
        }
      }

      // Step 2: Check if primaryArchetype (or any secondaryArchetype) has a Curated Competitive Core
      const archetypesToBuild = [primaryArchetype, ...secondaryArchetypes];
      for (const arch of archetypesToBuild) {
        const curatedList = CURATED_ARCHETYPE_CORES[arch];
        if (curatedList) {
          for (const spec of curatedList) {
            const cardData = await resolveCardByName(spec.name);
            if (cardData) {
              addEntryIfValid(cardData, spec.qty, spec.role, spec.reasonVi, spec.reasonEn);
            }
          }
        } else {
          const searchArchName = arch === 'HERO' ? 'Elemental HERO' : arch;
          let rawArchCards = await searchYgoCards({ archetype: searchArchName, limit: 45 });
          if (rawArchCards.length < 8) {
            rawArchCards = await searchYgoCards({ q: searchArchName, limit: 45 });
          }

          const scored = rawArchCards
            .filter((c) => c.frameType !== 'normal' || c.atk >= 2500)
            .sort((a, b) => {
              const scoreCard = (c: any) => {
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
            const isExtra = isExtraFrame(card.frameType);
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

      // Step 3: If the user requested a Rank 4 Xyz Monster and Main Deck still has room
      const hasRank4Featured = featuredCards.some(
        (c) => c.frameType === 'xyz' && c.level === 4
      );
      if (hasRank4Featured && mainTotal < 30) {
        const rank4Bridges: {
          name: string;
          qty: number;
          role: 'Extender';
          vi: string;
          en: string;
        }[] = [
          {
            name: 'Elemental HERO Solid Soldier',
            qty: 2,
            role: 'Extender',
            vi: 'Kéo thêm 1 quái thú Cấp 4 từ tay ra sân để lập tức Xyz Summon ra Dark Rebellion Xyz Dragon.',
            en: 'Special Summons a Level 4 monster from hand to immediately Xyz Summon Dark Rebellion Xyz Dragon.',
          },
          {
            name: 'Summoner Monk',
            qty: 2,
            role: 'Extender',
            vi: 'Xả 1 Bài Phép để gọi thẳng 1 quái thú Cấp 4 từ Bộ bài ra sân đóng Xyz Rank 4.',
            en: 'Discards a Spell to Special Summon any Level 4 monster from Deck for instant Rank 4 Xyz access.',
          },
        ];
        for (const br of rank4Bridges) {
          const c = await resolveCardByName(br.name);
          if (c) addEntryIfValid(c, br.qty, br.role, br.vi, br.en);
        }
      }

      // Step 4: Fill remaining Main Deck (up to 40) and Extra Deck (up to 15) with Master Duel Staples
      const competitiveStaples: {
        name: string;
        qty: number;
        role: 'Hand Trap' | 'Tech' | 'Board Breaker' | 'Boss' | 'Engine';
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
        role: 'Hand Trap' | 'Tech' | 'Board Breaker' | 'Boss' | 'Engine';
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
        const c = await resolveCardByName(st.name);
        if (!c) continue;
        addEntryIfValid(
          c,
          st.qty,
          st.role,
          isExtraFrame(c.frameType)
            ? 'Quái thú Liên kết đa dụng hỗ trợ phá bàn và kiểm soát nhịp độ trong Master Duel.'
            : isBudget
            ? 'Staple độ hiếm thấp (N/R/SR) tối ưu điểm chế tạo CP.'
            : 'Hand trap / Staple bắt buộc trong chế độ đấu hạng Bo1 Master Duel.',
          isExtraFrame(c.frameType)
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

      res.json({
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
                )} theo đúng yêu cầu của bạn. Các quái thú Cấp 4 của ${primaryArchetype} (như Solid Soldier, Stratos, Liquid Soldier, Vyon, Shadow Mist) vừa vận hành chuỗi Dung hợp/Link truyền thống vừa dễ dàng chồng Xyz Rank 4 gọi ra ${featuredNames.join(
                  ', '
                )} để rút cạn ATK đối phương và dứt điểm trận đấu.`
              : `Bộ bài được tổng hợp trực tiếp từ cơ sở dữ liệu YGOPRODeck cho tộc bài "${displayArchetype}" theo phong cách ${playstyle}, kết hợp cùng gói Hand Trap và chống Maxx "C" chuẩn đấu hạng Master Duel.`
            : featuredNames.length > 0
            ? `Hybrid Master Duel list combining the "${primaryArchetype}" engine with ${featuredNames.join(
                ', '
              )}. Level 4 ${primaryArchetype} deployers seamlessly bridge into both standard archetype boss monsters and ${featuredNames.join(
                ', '
              )} for lethal OTK pushes.`
            : `Constructed via live YGOPRODeck card resolution for "${displayArchetype}" (${playstyle}) paired with the standard Master Duel tournament staple package.`,
          comboGuide: isVi
            ? [
                `01. Mở màn bằng A Hero Lives / Stratos / Starter của ${primaryArchetype} để lấy các mảnh ghép Cấp 4 lên tay và kiểm tra Ash Blossom của đối thủ.`,
                featuredNames.length > 0
                  ? `02. Triệu hồi Solid Soldier / Liquid Soldier hoặc cặp quái thú Cấp 4 (Vyon + Shadow Mist) để chồng Xyz gọi ngay ${featuredNames[0]} (hoặc qua Raider's Knight lên Arc Rebellion Xyz Dragon) hút ATK quái thú mạnh nhất bên sân đối phương.`
                  : `02. Triệu hồi Đặc biệt nhánh mở rộng (Extender) để leo lên các quái thú chủ lực Extra Deck của ${primaryArchetype}.`,
                `03. Kết hợp Mask Change (gọi Masked HERO Dark Law) hoặc Fusion Destiny (gọi Destroyer Phoenix Enforcer) để khóa Mộ bài và bắn phá sân đối phương trong cả 2 lượt.`,
                `04. Dứt điểm 8000 LP bằng đòn tấn công cộng dồn ATK của ${
                  featuredNames[0] || primaryArchetype
                } cùng các quái thú Dung hợp/Link trên sân.`,
              ]
            : [
                `01. Open with your ${primaryArchetype} searchers and starters to assemble Level 4 extenders and bait opponent hand traps.`,
                featuredNames.length > 0
                  ? `02. Deploy two Level 4 monsters (such as Solid Soldier + Stratos or Vyon + Shadow Mist) to Xyz Summon ${featuredNames[0]} and halve the opponent's strongest monster ATK.`
                  : `02. Extend into your primary ${primaryArchetype} Extra Deck playmakers while preserving follow-up in hand.`,
                `03. Layer your archetype disruption alongside Master Duel staples to shut down opponent counterplay.`,
                `04. Close out the 8000 LP duel with ${
                  featuredNames[0] || primaryArchetype
                } and your recursive Extra Deck bosses.`,
              ],
          entries,
        },
        modelUsed: 'YGOPRODeck Hybrid Synthesis Engine',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Deck construction failed' });
    }
  });

  // 4. Multi-Turn Duelist Coach Chatbot
  app.post('/api/chat/message', async (req, res) => {
    const {
      messages = [],
      persona = 'combo_strategist',
      lang = 'vi',
    } = req.body || {};

    const isVi = lang === 'vi';
    const lastUserMessage = String(messages[messages.length - 1]?.content || '').toLowerCase();

    const isAskingBudget =
      persona === 'budget_optimizer' ||
      lastUserMessage.includes('ur') ||
      lastUserMessage.includes('cp') ||
      lastUserMessage.includes('rẻ') ||
      lastUserMessage.includes('tiết kiệm') ||
      lastUserMessage.includes('budget') ||
      lastUserMessage.includes('sr');
    const isAskingGoingSecond =
      lastUserMessage.includes('đi sau') ||
      lastUserMessage.includes('second') ||
      lastUserMessage.includes('otk') ||
      lastUserMessage.includes('lật kèo') ||
      lastUserMessage.includes('phá bàn');

    if (isAskingBudget) {
      res.json({
        reply: isVi
          ? `### Lộ Trình Tiết Kiệm Điểm Chế Tạo (CP UR) Cho Bộ Bài Hiện Tại\n\n1. **Giữ nguyên các UR khung chính (Core Engine)**: Chỉ ưu tiên chế tạo các lá UR thuộc tộc bài chính và gói cơ bản (**Ash Blossom & Joyous Spring**, **Maxx "C"**, **Called by the Grave**).\n2. **Thay thế UR đắt đỏ bằng bài N/R/SR hiệu quả cao**:\n   - Thay vì chế tạo đủ 3x *Forbidden Droplet (UR)* ngay lập tức, hãy dùng **Forbidden Chalice (R)** hoặc **Book of Moon (R)** để khóa hiệu ứng quái thú chủ lực đối phương.\n   - Dùng **Droll & Lock Bird (SR)** hoặc **Skull Meister (SR)** làm hand trap ngân sách thấp khắc chế mạnh các bộ bài tìm kiếm nhiều.\n   - Ở Extra Deck, **Knightmare Phoenix (SR)** và **Decode Talker (SR)** là lựa chọn thay thế tiết kiệm trước khi bạn có đủ điểm mở **S:P Little Knight (UR)**.`
          : `### Crafting Point (CP UR) Optimization Plan\n\n1. **Prioritize Core Engine URs First**: Spend your UR CP only on your archetype's primary 1-card starters and universal staples (**Maxx "C"**, **Ash Blossom**, **Called by the Grave**).\n2. **High-Synergy N/R/SR Replacements**:\n   - Swap expensive non-engine URs like *Forbidden Droplet* for **Forbidden Chalice (R)** or **Book of Moon (R)**.\n   - Run **Droll & Lock Bird (SR)** and **Evenly Matched (SR)** to punish combo boards without spending UR dust.\n   - Use **Knightmare Phoenix (SR)** in the Extra Deck until you craft **S:P Little Knight (UR)**.`,
        suggestedChanges: [
          {
            action: 'add',
            cardName: 'Forbidden Chalice',
            quantity: 2,
            section: 'main',
            reason: isVi
              ? 'Bài Phép Nhanh độ hiếm R giúp khóa hiệu ứng quái thú trên sân cực kỳ tiết kiệm CP.'
              : 'Rarity R Quick-Play monster negate that saves 60 UR CP.',
          },
          {
            action: 'add',
            cardName: 'Droll & Lock Bird',
            quantity: 2,
            section: 'main',
            reason: isVi
              ? 'Hand trap độ hiếm SR khóa hoàn toàn khả năng thêm bài từ Deck lên tay của đối thủ.'
              : 'SR hand trap that shuts down search-heavy combo decks.',
          },
        ],
        modelUsed: 'Duelist Coach Tactical Engine',
      });
      return;
    }

    if (isAskingGoingSecond) {
      res.json({
        reply: isVi
          ? `### Tối Ưu Hóa Khả Năng Đi Sau Lật Kèo (Going Second / Comeback)\n\n1. **Giải quyết bàn nhiều tầng Negate**: Hãy ưu tiên kích hoạt các lá bài diện rộng như **Lightning Storm**, **Evenly Matched**, hoặc **Triple Tactics Talent** để ép đối phương tung lượt negate đầu tiên trước khi bạn dùng Normal Summon chính.\n2. **Tận dụng Xyz Rank 4 / Boss Đột Biến**: Nếu bạn đang chơi nhánh Cấp 4 (như HERO + Dark Rebellion Xyz Dragon), hãy triệu hồi **Solid Soldier / Liquid Soldier** trước khi kích hoạt các lá bài tự khóa tộc (như Faris / Cross Crusader) để chồng Xyz ra **Dark Rebellion Xyz Dragon** hoặc **Arc Rebellion Xyz Dragon** hút ATK và đấm xuyên quái thú chủ lực đối phương.\n3. **Dứt điểm OTK 8000 LP**: Leo Link lên **Accesscode Talker** (5300 ATK + bắn phá sân không thể chuỗi lại) để dọn sạch hàng sau trước khi bước vào Battle Phase.`
          : `### Going-Second Board-Breaking & Comeback Strategy\n\n1. **Force Negates Before Committing Normal Summon**: Lead with **Lightning Storm**, **Evenly Matched**, or **Triple Tactics Talent** to bait omni-negates before revealing your starter.\n2. **Sequence Generic Xyz Before Archetype Locks**: Summon **Dark Rebellion Xyz Dragon** or **S:P Little Knight** using Level 4 extenders BEFORE activating archetype-locking effects.\n3. **Close Out 8000 LP**: Climb into **Accesscode Talker** at 5300 ATK to clear remaining cards with non-respondable destruction.`,
        suggestedChanges: [
          {
            action: 'add',
            cardName: 'Lightning Storm',
            quantity: 2,
            section: 'main',
            reason: isVi
              ? 'Quét sạch hàng quái thú công hoặc toàn bộ Bài Phép/Bẫy của đối thủ khi đi sau.'
              : 'Wipes opponent Attack Position monsters or backrow going second.',
          },
          {
            action: 'add',
            cardName: 'Evenly Matched',
            quantity: 2,
            section: 'main',
            reason: isVi
              ? 'Bài Bẫy độ hiếm SR ép đối thủ tự trục xuất úp gần như toàn bộ sân sau Battle Phase.'
              : 'SR board breaker that forces the opponent to banish their board face-down.',
          },
        ],
        modelUsed: 'Duelist Coach Tactical Engine',
      });
      return;
    }

    res.json({
      reply: isVi
        ? `### Phân Tích Chiến Thuật & Vận Hành Combo Cho Bộ Bài Hiện Tại\n\n1. **Cách đánh vượt Hand Trap (Ash Blossom / Impermanence / Nibiru)**:\n   - Luôn kích hoạt các lá bài tìm kiếm phụ (bait) trước để kiểm tra **Ash Blossom & Joyous Spring** của đối thủ trước khi dùng hiệu ứng chính.\n   - Trước lần triệu hồi thứ 5, hãy ưu tiên đưa **S:P Little Knight**, **I:P Masquerena** hoặc giữ sẵn **Mask Change** để né **Nibiru, the Primal Being**.\n2. **Lưu ý Thứ Tự Triệu Hồi (Tránh Tự Khóa Tộc)**:\n   - Nếu muốn gọi các quái thú Extra Deck chung như **Dark Rebellion Xyz Dragon**, **Arc Rebellion Xyz Dragon**, hoặc **S:P Little Knight**, hãy chồng Xyz/Link chúng **trước khi** kích hoạt hiệu ứng của *Vision HERO Faris*, *Increase*, *Cross Crusader* hay *Fusion Destiny*.\n3. **Gợi ý nâng cấp trực tiếp**: Bạn có thể nhấn nút **Áp Dụng Thay Đổi** bên dưới để thêm ngay **S:P Little Knight** và **Triple Tactics Talent** vào bộ bài.`
        : `### Tactical Combo & Hand-Trap Resilience Analysis\n\n1. **Playing Around Hand Traps (Ash / Impermanence / Nibiru)**:\n   - Sequence secondary search spells first to bait **Ash Blossom & Joyous Spring** before committing your choke-point effect.\n   - Establish **I:P Masquerena**, **S:P Little Knight**, or hold **Mask Change** by your 5th summon to insulate against **Nibiru, the Primal Being**.\n2. **Summon Lock Sequencing**:\n   - Always summon generic Extra Deck bosses (**Dark Rebellion Xyz Dragon**, **S:P Little Knight**) BEFORE activating archetype-locking effects.`,
      suggestedChanges: [
        {
          action: 'add',
          cardName: 'S:P Little Knight',
          quantity: 1,
          section: 'extra',
          reason: isVi
            ? 'Link-2 đa dụng giúp trục xuất bài đối phương và né hiệu ứng chỉ định mục tiêu.'
            : 'Universal Link-2 banish disruption and targeted effect dodge.',
        },
        {
          action: 'add',
          cardName: 'Triple Tactics Talent',
          quantity: 1,
          section: 'main',
          reason: isVi
            ? 'Rút 2 lá hoặc nhìn tay đối thủ khi đối phương dùng hand trap trong Main Phase.'
            : 'Draws 2 cards or rips a hand trap when the opponent activates a monster effect.',
        },
      ],
      modelUsed: 'Duelist Coach Tactical Engine',
    });
  });

  // 5. High-Resolution Studio (1K, 2K, 4K)
  app.post('/api/image/generate', async (req, res) => {
    const {
      prompt = 'Epic dark fantasy dragon boss monster wrapped in golden flames',
      assetType = 'card_art',
      imageSize = '1K',
    } = req.body || {};

    const validSize: '1K' | '2K' | '4K' = ['1K', '2K', '4K'].includes(imageSize) ? imageSize : '1K';
    const aspectRatio: '3:4' | '16:9' | '1:1' =
      assetType === 'sleeve' ? '3:4' : assetType === 'playmat' ? '16:9' : '1:1';

    const proceduralDataUrl = buildProceduralStudioSvg(prompt, assetType, validSize);
    res.json({
      imageUrl: proceduralDataUrl,
      modelUsed: 'Duelist Vector Studio Engine',
      imageSize: validSize,
      aspectRatio,
      freeTierFallback: false,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Duelist Architect server listening on http://localhost:${PORT}`);
  });
}

startServer();
