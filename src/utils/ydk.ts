import { BanlistStatus, DeckEntry, DeckState, MasterDuelRarity, YgoCard } from '../types/ygo';

/**
 * Maximum legal copies allowed in Yu-Gi-Oh! Master Duel based on banlist status.
 */
export function getMaxAllowedCopies(status: BanlistStatus): number {
  switch (status) {
    case 'Forbidden':
      return 0;
    case 'Limited':
      return 1;
    case 'Semi-Limited':
      return 2;
    case 'Unlimited':
    default:
      return 3;
  }
}

/**
 * Determines whether a card belongs in the Extra Deck (Fusion, Synchro, Xyz, Link)
 * or Main Deck (Normal, Effect, Ritual, Pendulum, Spell, Trap).
 */
export function isExtraDeckCard(card: Pick<YgoCard, 'frameType' | 'type'>): boolean {
  const ft = card.frameType.toLowerCase();
  const t = card.type.toLowerCase();
  return (
    ft === 'fusion' ||
    ft === 'synchro' ||
    ft === 'xyz' ||
    ft === 'link' ||
    t.includes('fusion') ||
    t.includes('synchro') ||
    t.includes('xyz') ||
    t.includes('link')
  );
}

/**
 * Generates standard .ydk content compatible with Yu-Gi-Oh! Neuron importers,
 * Master Duel transfer tools, EDOPro, YGO Omega, and DuelingBook.
 */
export function serializeToYdk(deck: DeckState): string {
  const lines: string[] = ['#created by Duelist Architect (Master Duel Compatible)'];

  lines.push('#main');
  const mainEntries = deck.entries.filter((e) => e.section === 'main');
  for (const entry of mainEntries) {
    for (let i = 0; i < entry.quantity; i++) {
      lines.push(String(entry.card.id));
    }
  }

  lines.push('#extra');
  const extraEntries = deck.entries.filter((e) => e.section === 'extra');
  for (const entry of extraEntries) {
    for (let i = 0; i < entry.quantity; i++) {
      lines.push(String(entry.card.id));
    }
  }

  lines.push('!side');
  const sideEntries = deck.entries.filter((e) => e.section === 'side');
  for (const entry of sideEntries) {
    for (let i = 0; i < entry.quantity; i++) {
      lines.push(String(entry.card.id));
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Parses a .ydk text string into arrays of passcode IDs for main, extra, and side decks.
 */
export function parseYdkContent(ydkText: string): {
  mainIds: number[];
  extraIds: number[];
  sideIds: number[];
} {
  const mainIds: number[] = [];
  const extraIds: number[] = [];
  const sideIds: number[] = [];

  let currentSection: 'main' | 'extra' | 'side' = 'main';
  const lines = ydkText.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith('#main')) {
      currentSection = 'main';
      continue;
    }
    if (line.toLowerCase().startsWith('#extra')) {
      currentSection = 'extra';
      continue;
    }
    if (line.toLowerCase().startsWith('!side')) {
      currentSection = 'side';
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }

    const passcode = parseInt(line, 10);
    if (!isNaN(passcode) && passcode > 0) {
      if (currentSection === 'main') mainIds.push(passcode);
      else if (currentSection === 'extra') extraIds.push(passcode);
      else sideIds.push(passcode);
    }
  }

  return { mainIds, extraIds, sideIds };
}

/**
 * Encodes an array of 32-bit unsigned card passcodes into a base64 string
 * per the universal YDKe specification (`ydke://<main>!<extra>!<side>!`).
 */
function passcodesToBase64(passcodes: number[]): string {
  const buffer = new ArrayBuffer(passcodes.length * 4);
  const view = new DataView(buffer);
  passcodes.forEach((id, idx) => {
    view.setUint32(idx * 4, id >>> 0, true); // little-endian uint32
  });
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generates a `ydke://` URL from the active deck.
 */
export function serializeToYdkeUrl(deck: DeckState): string {
  const expandSection = (section: 'main' | 'extra' | 'side'): number[] => {
    const ids: number[] = [];
    for (const entry of deck.entries.filter((e) => e.section === section)) {
      for (let i = 0; i < entry.quantity; i++) {
        ids.push(entry.card.id);
      }
    }
    return ids;
  };

  const mainB64 = passcodesToBase64(expandSection('main'));
  const extraB64 = passcodesToBase64(expandSection('extra'));
  const sideB64 = passcodesToBase64(expandSection('side'));

  return `ydke://${mainB64}!${extraB64}!${sideB64}!`;
}

/**
 * Formats a human-readable tournament & Neuron decklist with passcodes and rarities.
 */
export function formatPlainTextDecklist(deck: DeckState): string {
  const main = deck.entries.filter((e) => e.section === 'main');
  const extra = deck.entries.filter((e) => e.section === 'extra');
  const side = deck.entries.filter((e) => e.section === 'side');

  const sumQty = (arr: DeckEntry[]) => arr.reduce((acc, e) => acc + e.quantity, 0);

  const lines: string[] = [
    `Deck: ${deck.name} (${deck.archetype})`,
    `Format: Yu-Gi-Oh! Master Duel`,
    ``,
    `Main Deck (${sumQty(main)} Cards):`,
    ...main.map(
      (e) => `${e.quantity}x ${e.card.name} [${e.card.mdRarity}] (ID: ${e.card.id})`
    ),
    ``,
    `Extra Deck (${sumQty(extra)} Cards):`,
    ...extra.map(
      (e) => `${e.quantity}x ${e.card.name} [${e.card.mdRarity}] (ID: ${e.card.id})`
    ),
  ];

  if (side.length > 0) {
    lines.push(
      ``,
      `Side / Tech Pool (${sumQty(side)} Cards):`,
      ...side.map(
        (e) => `${e.quantity}x ${e.card.name} [${e.card.mdRarity}] (ID: ${e.card.id})`
      )
    );
  }

  return lines.join('\n');
}

/**
 * Triggers a client-side file download of the .ydk file.
 */
export function downloadYdkFile(deck: DeckState): void {
  const ydkContent = serializeToYdk(deck);
  const slug =
    deck.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'master-duel-deck';
  const blob = new Blob([ydkContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.ydk`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Calculates Master Duel Crafting Point (CP) requirements (30 CP per card of N/R/SR/UR).
 */
export function calculateCraftingPoints(
  entries: DeckEntry[],
  ownedCardMap: Record<number, boolean> = {}
): {
  totalCounts: Record<MasterDuelRarity, number>;
  neededCP: Record<MasterDuelRarity, number>;
} {
  const totalCounts: Record<MasterDuelRarity, number> = { N: 0, R: 0, SR: 0, UR: 0 };
  const neededCP: Record<MasterDuelRarity, number> = { N: 0, R: 0, SR: 0, UR: 0 };

  for (const entry of entries) {
    if (entry.section === 'side') continue;
    const rarity = entry.card.mdRarity || 'SR';
    totalCounts[rarity] += entry.quantity;
    if (!ownedCardMap[entry.card.id]) {
      neededCP[rarity] += entry.quantity * 30;
    }
  }

  return { totalCounts, neededCP };
}

/**
 * Deals a shuffled opening hand of `handSize` (default 5) from the Main Deck.
 */
export function dealTestHand(entries: DeckEntry[], handSize = 5): YgoCard[] {
  const pool: YgoCard[] = [];
  for (const entry of entries) {
    if (entry.section === 'main') {
      for (let i = 0; i < entry.quantity; i++) {
        pool.push(entry.card);
      }
    }
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }

  return pool.slice(0, handSize);
}

/**
 * Hypergeometric probability of drawing at least 1 copy of a card group (e.g. Starters)
 * in a 5-card opening hand.
 */
export function calculateAtLeastOneProbability(
  deckSize: number,
  successCopiesInDeck: number,
  handSize = 5
): number {
  if (deckSize <= 0 || successCopiesInDeck <= 0) return 0;
  if (successCopiesInDeck > deckSize) return 100;
  const nonSuccess = deckSize - successCopiesInDeck;
  if (nonSuccess < handSize) return 100;

  let probZero = 1;
  for (let i = 0; i < handSize; i++) {
    probZero *= (nonSuccess - i) / (deckSize - i);
  }
  return Math.round((1 - probZero) * 1000) / 10;
}

export interface CompactSharedDeckPayload {
  v: 1;
  n: string;
  a: string;
  p: string;
  t: string;
  s: string;
  cg?: string[];
  e: [number, 1 | 2 | 3, 'm' | 'e' | 's', NonNullable<DeckEntry['role']>][];
}

/**
 * Encodes a DeckState into a compact UTF-8 URL-safe Base64 string (`?deck=...`).
 */
export function encodeDeckToBase64State(deck: DeckState): string {
  const payload: CompactSharedDeckPayload = {
    v: 1,
    n: deck.name,
    a: deck.archetype,
    p: deck.playstyle,
    t: deck.tierRating,
    s: deck.strategySummary,
    cg: deck.comboGuide,
    e: deck.entries.map((entry) => [
      entry.card.id,
      entry.quantity,
      entry.section === 'extra' ? 'e' : entry.section === 'side' ? 's' : 'm',
      entry.role || (entry.section === 'extra' ? 'Boss' : 'Engine'),
    ]),
  };

  const jsonStr = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates a complete shareable URL with the Base64-encoded deck configuration in `?deck=`.
 */
export function buildShareableDeckUrl(deck: DeckState): string {
  const encoded = encodeDeckToBase64State(deck);
  if (typeof window === 'undefined') {
    return `?deck=${encoded}`;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('deck', encoded);
  return url.toString();
}

/**
 * Decodes a Base64-encoded `?deck=` URL parameter back into its deck metadata and passcode tuples.
 */
export function decodeBase64DeckState(encoded: string): CompactSharedDeckPayload | null {
  try {
    const clean = encoded.trim().replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (clean.length % 4)) % 4;
    const padded = clean + '='.repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !Array.isArray(parsed.e) || parsed.e.length === 0) {
      return null;
    }
    return parsed as CompactSharedDeckPayload;
  } catch {
    return null;
  }
}

