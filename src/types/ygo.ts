export type CardFrameType =
  | 'normal'
  | 'effect'
  | 'ritual'
  | 'fusion'
  | 'synchro'
  | 'xyz'
  | 'link'
  | 'pendulum'
  | 'spell'
  | 'trap';

export type MasterDuelRarity = 'N' | 'R' | 'SR' | 'UR';

export type BanlistStatus = 'Unlimited' | 'Semi-Limited' | 'Limited' | 'Forbidden';

export type TacticalRole =
  | 'Starter'
  | 'Extender'
  | 'Hand Trap'
  | 'Board Breaker'
  | 'Boss'
  | 'Engine'
  | 'Tech';

export type DeckSection = 'main' | 'extra' | 'side';

export interface YgoCard {
  id: number; // Official 8-digit Konami passcode used in .ydk files
  name: string;
  type: string;
  frameType: CardFrameType;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  linkval?: number;
  race: string; // e.g., Dragon, Spellcaster, Normal, Quick-Play, Counter
  attribute?: string; // DARK, LIGHT, FIRE, WATER, EARTH, WIND, DIVINE
  archetype?: string;
  imageUrl: string;
  imageUrlSmall: string;
  mdRarity: MasterDuelRarity;
  banlistStatus: BanlistStatus;
  secretPack?: string;
}

export interface DeckEntry {
  card: YgoCard;
  quantity: 1 | 2 | 3;
  section: DeckSection;
  role: TacticalRole;
  reason?: string;
}

export interface DeckState {
  id: string;
  name: string;
  archetype: string;
  playstyle: string;
  tierRating: string;
  strategySummary: string;
  comboGuide: string[];
  entries: DeckEntry[];
  customSleeveUrl?: string;
  customPlaymatUrl?: string;
}

export type GeminiModelTier =
  | 'gpt-oss-20b-free'
  | 'llama-3.3-70b-free'
  | 'qwen-2.5-72b-free'
  | 'gemini-4-argon'
  | 'gemini-3.8-flash'
  | 'gemini-3.1-flash-lite';

export type ChatPersonaId = 'combo_strategist' | 'meta_analyst' | 'budget_optimizer';

export interface SuggestedDeckChange {
  action: 'add' | 'remove';
  cardName: string;
  quantity: number;
  section: DeckSection;
  reason: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  modelUsed: string;
  persona: ChatPersonaId;
  suggestedChanges?: SuggestedDeckChange[];
}

export type ImageSizeOption = '1K' | '2K' | '4K';

export type VisualAssetType = 'sleeve' | 'playmat' | 'card_art';

export interface GeneratedVisualAsset {
  id: string;
  title: string;
  type: VisualAssetType;
  prompt: string;
  imageSize: ImageSizeOption;
  aspectRatio: '3:4' | '16:9' | '1:1';
  imageUrl: string;
  modelUsed: string;
  createdAt: string;
}

export type WorkspaceTab = 'builder' | 'import_guide' | 'visual_studio' | 'database';
