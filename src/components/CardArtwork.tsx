import React, { useState } from 'react';
import { CardFrameType, YgoCard } from '../types/ygo';

const FRAME_COLORS: Record<CardFrameType, { border: string; bg: string; label: string }> = {
  normal: { border: 'border-amber-300/60', bg: 'from-amber-950/90 to-slate-950', label: 'Normal' },
  effect: { border: 'border-orange-500/60', bg: 'from-orange-950/90 to-slate-950', label: 'Effect' },
  ritual: { border: 'border-sky-400/60', bg: 'from-sky-950/90 to-slate-950', label: 'Ritual' },
  fusion: { border: 'border-purple-400/70', bg: 'from-purple-950/90 to-slate-950', label: 'Fusion' },
  synchro: { border: 'border-slate-200/80', bg: 'from-slate-800/90 to-slate-950', label: 'Synchro' },
  xyz: { border: 'border-amber-400/70', bg: 'from-neutral-900 to-black', label: 'Xyz' },
  link: { border: 'border-blue-400/80', bg: 'from-blue-950/90 to-slate-950', label: 'Link' },
  pendulum: { border: 'border-emerald-400/70', bg: 'from-emerald-950/90 to-orange-950/90', label: 'Pendulum' },
  spell: { border: 'border-teal-400/70', bg: 'from-teal-950/90 to-slate-950', label: 'Spell' },
  trap: { border: 'border-pink-500/70', bg: 'from-pink-950/90 to-slate-950', label: 'Trap' },
};

interface CardArtworkProps {
  card: YgoCard;
  quantity?: number;
  selected?: boolean;
  showSleeveBack?: boolean;
  sleeveUrl?: string;
  compact?: boolean;
  onClick?: () => void;
  onAdd?: (e: React.MouseEvent) => void;
  onRemove?: (e: React.MouseEvent) => void;
}

export const CardArtwork: React.FC<CardArtworkProps> = ({
  card,
  quantity,
  selected = false,
  showSleeveBack = false,
  sleeveUrl,
  compact = false,
  onClick,
  onAdd,
  onRemove,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const frameStyle = FRAME_COLORS[card.frameType] || FRAME_COLORS.effect;

  const rarityColor =
    card.mdRarity === 'UR'
      ? 'text-amber-300'
      : card.mdRarity === 'SR'
      ? 'text-purple-300'
      : card.mdRarity === 'R'
      ? 'text-sky-300'
      : 'text-slate-400';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group relative aspect-[59/86] w-full rounded-lg sm:rounded-md overflow-hidden border transition-transform duration-150 cursor-pointer select-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/40 -translate-y-0.5'
          : `${frameStyle.border} sm:hover:-translate-y-0.5 sm:hover:border-amber-300/90`
      } bg-[#0F172A]`}
    >
      {showSleeveBack && sleeveUrl ? (
        <img
          src={sleeveUrl}
          alt={`${card.name} custom sleeve back`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : !imgFailed ? (
        <img
          src={compact ? card.imageUrlSmall || card.imageUrl : card.imageUrl}
          alt={card.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-b ${frameStyle.bg} p-2 flex flex-col justify-between text-left`}
        >
          <div className="text-[10px] font-mono text-slate-300 flex items-center justify-between">
            <span>{card.mdRarity}</span>
            <span>{frameStyle.label}</span>
          </div>
          <div className="text-xs font-semibold text-slate-100 leading-snug line-clamp-3">
            {card.name}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-400">
            {typeof card.atk === 'number' ? `ATK ${card.atk}` : card.race}
          </div>
        </div>
      )}

      {/* Top Scrim for Rarity & Banlist Status */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-1.5 pt-1 pb-2 flex items-center justify-between text-[10px] font-mono tabular-nums">
        <span className={`font-semibold tracking-tight ${rarityColor}`}>{card.mdRarity}</span>
        {card.banlistStatus !== 'Unlimited' && (
          <span
            className={`font-semibold ${
              card.banlistStatus === 'Forbidden'
                ? 'text-red-400'
                : card.banlistStatus === 'Limited'
                ? 'text-amber-300'
                : 'text-orange-300'
            }`}
          >
            {card.banlistStatus === 'Forbidden'
              ? 'BAN'
              : card.banlistStatus === 'Limited'
              ? 'LIM 1'
              : 'SEMI 2'}
          </span>
        )}
      </div>

      {/* Bottom Scrim with Quantity */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-1.5 pb-1 pt-3 flex items-end justify-between">
        <span className="text-[10px] text-slate-200 font-medium truncate max-w-[72%]">
          {card.name}
        </span>
        {typeof quantity === 'number' && (
          <span className="text-xs font-mono font-bold tabular-nums text-amber-300">
            {quantity}x
          </span>
        )}
      </div>

      {/* Desktop Hover Quick-Adjust Controls (hidden on mobile touch where tapping opens the Inspector Sheet) */}
      {(onAdd || onRemove) && (
        <div className="hidden sm:flex absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity duration-150 items-center justify-center gap-1.5">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove 1 copy"
              className="w-8 h-8 rounded bg-slate-900/95 border border-slate-700 text-slate-200 hover:border-red-400 hover:text-red-300 font-mono text-sm flex items-center justify-center transition-colors"
            >
              -
            </button>
          )}
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              title="Add 1 copy"
              className="w-8 h-8 rounded bg-slate-900/95 border border-slate-700 text-slate-200 hover:border-amber-400 hover:text-amber-300 font-mono text-sm flex items-center justify-center transition-colors"
            >
              +
            </button>
          )}
        </div>
      )}
    </div>
  );
};
