import React, { useState } from 'react';
import { AlertTriangle, Ban } from 'lucide-react';
import { CardFrameType, YgoCard } from '../types/ygo';
import { getMaxAllowedCopies } from '../utils/ydk';

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

  const isForbidden = card.banlistStatus === 'Forbidden';
  const isLimited = card.banlistStatus === 'Limited';
  const isSemiLimited = card.banlistStatus === 'Semi-Limited';
  const maxAllowed = getMaxAllowedCopies(card.banlistStatus);
  const isBanlistViolation =
    isForbidden || (typeof quantity === 'number' && quantity > maxAllowed);

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
      title={`${card.name} [${card.mdRarity}] — Master Duel Banlist: ${card.banlistStatus}`}
      className={`group relative aspect-[59/86] w-full rounded-lg sm:rounded-md overflow-hidden border transition-transform duration-150 cursor-pointer select-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        isBanlistViolation
          ? 'border-red-500 ring-2 ring-red-500/70'
          : selected
          ? 'border-amber-400 ring-2 ring-amber-400/40 -translate-y-0.5'
          : isLimited
          ? 'border-red-500/80 sm:hover:-translate-y-0.5 sm:hover:border-red-400'
          : isSemiLimited
          ? 'border-amber-400/80 sm:hover:-translate-y-0.5 sm:hover:border-amber-300'
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
          className={`w-full h-full object-cover ${isForbidden ? 'grayscale-[45%] contrast-125' : ''}`}
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

      {/* Top Scrim for Rarity */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/90 via-black/45 to-transparent px-1.5 pt-1 pb-2.5 flex items-start justify-between pointer-events-none">
        <span className={`text-[10px] font-mono font-bold tracking-tight ${rarityColor}`}>
          {card.mdRarity}
        </span>
      </div>

      {/* Prominent Master Duel Banlist Visual Badge Overlay (Top-Right Corner) */}
      {card.banlistStatus !== 'Unlimited' && (
        <div className="absolute top-1 right-1 z-20 pointer-events-none flex flex-col items-end gap-0.5">
          {isForbidden && (
            <div
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-600 border-2 border-red-200 text-white shadow-md shadow-black/90"
              aria-label="Forbidden Card (Banned in Master Duel)"
            >
              <Ban className="w-3.5 h-3.5 stroke-[2.75]" />
              <span className="text-[9px] font-mono font-extrabold tracking-tighter uppercase">
                CẤM
              </span>
            </div>
          )}

          {isLimited && (
            <div
              className="flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full bg-red-600/95 border-2 border-amber-300 text-white shadow-md shadow-black/90"
              aria-label="Limited to 1 Copy in Master Duel"
            >
              <span className="w-4 h-4 rounded-full bg-slate-950 border border-amber-300 text-amber-300 font-mono text-[10px] font-extrabold tabular-nums flex items-center justify-center leading-none">
                1
              </span>
              <span className="text-[9px] font-mono font-extrabold tracking-tighter uppercase">
                LIM
              </span>
            </div>
          )}

          {isSemiLimited && (
            <div
              className="flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full bg-amber-500/95 border-2 border-yellow-100 text-slate-950 shadow-md shadow-black/90"
              aria-label="Semi-Limited to 2 Copies in Master Duel"
            >
              <span className="w-4 h-4 rounded-full bg-slate-950 text-amber-300 font-mono text-[10px] font-extrabold tabular-nums flex items-center justify-center leading-none">
                2
              </span>
              <span className="text-[9px] font-mono font-extrabold tracking-tighter uppercase">
                SEMI
              </span>
            </div>
          )}
        </div>
      )}

      {/* Center Red Prohibition Stamp if Card is Forbidden or Exceeds Banlist Limit */}
      {isBanlistViolation && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 bg-red-600/90 border-y border-red-300 py-0.5 px-1 flex items-center justify-center gap-1 text-[9px] font-mono font-bold text-white uppercase tracking-wider pointer-events-none shadow">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>{isForbidden ? 'BỊ CẤM (FORBIDDEN)' : `TỐI ĐA ${maxAllowed} LÁ`}</span>
        </div>
      )}

      {/* Bottom Scrim with Card Name & Quantity */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-1.5 pb-1 pt-3.5 flex items-end justify-between pointer-events-none">
        <span className="text-[10px] text-slate-200 font-medium truncate max-w-[72%]">
          {card.name}
        </span>
        {typeof quantity === 'number' && (
          <span
            className={`text-xs font-mono font-bold tabular-nums ${
              isBanlistViolation
                ? 'text-red-400'
                : isLimited
                ? 'text-red-300'
                : 'text-amber-300'
            }`}
          >
            {quantity}x
          </span>
        )}
      </div>

      {/* Desktop Hover Quick-Adjust Controls (hidden on mobile touch where tapping opens the Inspector Sheet) */}
      {(onAdd || onRemove) && (
        <div className="hidden sm:flex absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity duration-150 items-center justify-center gap-1.5 z-30">
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
              title={
                typeof quantity === 'number' && quantity >= maxAllowed
                  ? `Master Duel Banlist Limit: Max ${maxAllowed}`
                  : 'Add 1 copy'
              }
              disabled={typeof quantity === 'number' && quantity >= maxAllowed}
              className="w-8 h-8 rounded bg-slate-900/95 border border-slate-700 text-slate-200 hover:border-amber-400 hover:text-amber-300 disabled:opacity-35 disabled:cursor-not-allowed font-mono text-sm flex items-center justify-center transition-colors"
            >
              +
            </button>
          )}
        </div>
      )}
    </div>
  );
};
