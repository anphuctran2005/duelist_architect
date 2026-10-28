import { AppLanguage } from '../i18n/translations';
import { DeckEntry, DeckState, SuggestedDeckChange, YgoCard } from '../types/ygo';
import { getMaxAllowedCopies, isExtraDeckCard } from './ydk';

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
  return {
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
}

export async function searchYgoCardsClientFallback(
  q: string,
  attribute = 'ALL',
  limit = 36
): Promise<YgoCard[]> {
  try {
    const params = new URLSearchParams({ misc: 'yes' });
    if (q.trim()) params.set('fname', q.trim());
    if (attribute && attribute !== 'ALL') params.set('attribute', attribute);
    const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.data)) return [];
    return data.data.slice(0, limit).map(mapRawYgoCardClient);
  } catch {
    return [];
  }
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
      const res = await fetch(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${chunk.join(',')}&misc=yes`
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data)) {
          for (const raw of json.data) {
            const card = mapRawYgoCardClient(raw);
            map[card.id] = card;
          }
        }
      }
    }
  } catch {
    // Ignore error
  }
  return map;
}

export async function generateDeckClientFallback(
  prompt: string,
  playstyle: string,
  budgetTier: string,
  lang: AppLanguage
): Promise<{ deck: DeckState; modelUsed: string }> {
  const isVi = lang === 'vi';
  const cards = await searchYgoCardsClientFallback(prompt.split(/\s+/)[0] || 'Blue-Eyes', 'ALL', 30);
  const entries: DeckEntry[] = [];
  let mainCount = 0;
  let extraCount = 0;

  for (const c of cards) {
    const maxAllowed = getMaxAllowedCopies(c.banlistStatus);
    if (maxAllowed <= 0) continue;
    const isExtra = isExtraDeckCard(c);
    if (isExtra && extraCount < 15) {
      const qty = Math.min(2, maxAllowed, 15 - extraCount) as 1 | 2 | 3;
      entries.push({
        card: c,
        quantity: qty,
        section: 'extra',
        role: 'Boss',
        reason: isVi ? 'Chủ lực Extra Deck xác thực qua YGOPRODeck.' : 'Extra Deck boss.',
      });
      extraCount += qty;
    } else if (!isExtra && mainCount < 40) {
      const qty = Math.min(3, maxAllowed, 40 - mainCount) as 1 | 2 | 3;
      entries.push({
        card: c,
        quantity: qty,
        section: 'main',
        role: 'Engine',
        reason: isVi ? 'Mảnh ghép vận hành chính từ YGOPRODeck.' : 'Main Deck core card.',
      });
      mainCount += qty;
    }
  }

  return {
    deck: {
      id: `client-deck-${Date.now()}`,
      name: isVi ? `Bộ Bài ${prompt.slice(0, 28)}` : `${prompt.slice(0, 28)} Deck`,
      archetype: cards[0]?.archetype || 'Master Duel Constructed',
      playstyle,
      tierRating: budgetTier,
      strategySummary: isVi
        ? 'Bộ bài được tổng hợp trực tiếp từ cơ sở dữ liệu YGOPRODeck.'
        : 'Constructed directly via live YGOPRODeck API.',
      comboGuide: [
        isVi
          ? '01. Mở màn bằng các lá bài tìm kiếm (Starter) để thiết lập tài nguyên.'
          : '01. Open with your primary searchers to establish field presence.',
        isVi
          ? '02. Triệu hồi các nhánh mở rộng lên Extra Deck.'
          : '02. Extend into your Extra Deck boss monsters.',
      ],
      entries,
    },
    modelUsed: 'YGOPRODeck Client Engine',
  };
}

export function getCoachReplyClientFallback(
  lang: AppLanguage
): { reply: string; suggestedChanges: SuggestedDeckChange[]; modelUsed: string } {
  const isVi = lang === 'vi';
  return {
    reply: isVi
      ? `### Phân Tích Chiến Thuật & Vận Hành Combo\n\n1. **Thứ tự kích hoạt tránh tự khóa tộc (Summon Lock)**: Luôn triệu hồi các quái thú Extra Deck chung (như **Dark Rebellion Xyz Dragon**, **S:P Little Knight**) trước khi kích hoạt hiệu ứng tự khóa của tộc bài.\n2. **Khung bài chống Maxx "C"**: Duy trì **3x Maxx "C"**, **3x Ash Blossom**, **2x Called by the Grave** để giữ nhịp độ trận đấu Bo1.`
      : `### Tactical Combo & Sequencing Analysis\n\n1. **Summon Lock Sequencing**: Summon generic Extra Deck monsters before activating archetype-locking effects.\n2. **Master Duel Staples**: Keep **3x Maxx "C"**, **3x Ash Blossom**, and **2x Called by the Grave**.`,
    suggestedChanges: [
      {
        action: 'add',
        cardName: 'S:P Little Knight',
        quantity: 1,
        section: 'extra',
        reason: isVi
          ? 'Link-2 đa dụng giúp trục xuất bài đối phương và né hiệu ứng.'
          : 'Universal Link-2 banish disruption.',
      },
    ],
    modelUsed: 'Duelist Coach Client Engine',
  };
}
