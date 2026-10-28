import React, { useState } from 'react';
import { Check, Download, Image as ImageIcon, Layers, Sparkles, Wand2 } from 'lucide-react';
import { useLanguage } from '../i18n/translations';
import {
  DeckState,
  GeneratedVisualAsset,
  ImageSizeOption,
  VisualAssetType,
} from '../types/ygo';
import { generateVisualAssetUnified } from '../utils/clientApiFallback';
import { CardArtwork } from './CardArtwork';

interface VisualStudioViewProps {
  deck: DeckState;
  assets: GeneratedVisualAsset[];
  onAddAsset: (asset: GeneratedVisualAsset) => void;
  onApplySleeve: (url: string) => void;
  onApplyPlaymat: (url: string) => void;
}

export const VisualStudioView: React.FC<VisualStudioViewProps> = ({
  deck,
  assets,
  onAddAsset,
  onApplySleeve,
  onApplyPlaymat,
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  const [assetType, setAssetType] = useState<VisualAssetType>('playmat');
  const [imageSize, setImageSize] = useState<ImageSizeOption>('2K');
  const [prompt, setPrompt] = useState(
    `Dark obsidian and golden solar flames tournament playmat inspired by ${deck.archetype}, engraved sacred geometry zone lines, dramatic rim lighting`
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<GeneratedVisualAsset>(assets[0]);
  const [previewShowBacks, setPreviewShowBacks] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const assetTypeOptions: {
    id: VisualAssetType;
    label: string;
    aspectRatio: '3:4' | '16:9' | '1:1';
    desc: string;
  }[] = [
    {
      id: 'sleeve',
      label: isVi ? 'Bọc Bài (Card Sleeve)' : 'Card Sleeve Protector',
      aspectRatio: '3:4',
      desc: isVi
        ? 'Thiết kế mặt lưng lá bài hoa văn hoàng gia (tỉ lệ dọc 3:4)'
        : 'Ornate card back sleeve (3:4 vertical ratio)',
    },
    {
      id: 'playmat',
      label: isVi ? 'Thảm Đấu (Duel Field Playmat)' : 'Duel Field Playmat',
      aspectRatio: '16:9',
      desc: isVi
        ? 'Bàn đấu giải đấu có đường kẻ ô bài (tỉ lệ ngang 16:9)'
        : 'Wide tournament duel field backdrop (16:9 ratio)',
    },
    {
      id: 'card_art',
      label: isVi ? 'Minh Họa Quái Thú Chủ Lực (Card Art)' : 'Boss Monster Concept Art',
      aspectRatio: '1:1',
      desc: isVi
        ? 'Tranh minh họa quái thú chủ lực theo tộc bài (tỉ lệ vuông 1:1)'
        : 'Square archetype & boss monster artwork (1:1 ratio)',
    },
  ];

  const sizeOptions: { id: ImageSizeOption; label: string; pixels: string }[] = [
    { id: '1K', label: '1K Standard', pixels: '1024px Base' },
    { id: '2K', label: '2K High-Res', pixels: '2048px Studio' },
    { id: '4K', label: '4K Ultra-HD', pixels: '3840px Master' },
  ];

  const handleAutoFillPrompt = (targetType: VisualAssetType) => {
    setAssetType(targetType);
    if (targetType === 'sleeve') {
      setPrompt(
        `Ornate royal card back sleeve inspired by ${deck.archetype}, dark obsidian enamel center with gilded gold filigree frame and glowing emblem`
      );
    } else if (targetType === 'playmat') {
      setPrompt(
        `Top-down luxury Master Duel tournament playmat themed around ${deck.archetype}, dark slate sanctuary stone with subtle golden card zone outlines`
      );
    } else {
      setPrompt(
        `Ultimate ${deck.archetype} boss monster surrounded by astral lightning and sacred flames, dynamic trading card game illustration`
      );
    }
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setStatusMessage(null);

    try {
      const data = await generateVisualAssetUnified({
        prompt: prompt.trim(),
        assetType,
        imageSize,
      });
      if (data.imageUrl) {
        const aspectRatio =
          assetType === 'sleeve' ? '3:4' : assetType === 'playmat' ? '16:9' : '1:1';
        const newAsset: GeneratedVisualAsset = {
          id: `studio-${Date.now()}`,
          title: `${deck.archetype} ${
            assetType === 'sleeve'
              ? isVi
                ? 'Bọc Bài'
                : 'Custom Sleeve'
              : assetType === 'playmat'
              ? isVi
                ? 'Thảm Đấu'
                : 'Duel Playmat'
              : isVi
              ? 'Tranh Boss'
              : 'Boss Concept'
          } (${imageSize})`,
          type: assetType,
          prompt: prompt.trim(),
          imageSize,
          aspectRatio,
          imageUrl: data.imageUrl,
          modelUsed: data.modelUsed || 'gemini-3-pro-image-preview',
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        onAddAsset(newAsset);
        setSelectedAsset(newAsset);

        if (assetType === 'sleeve') {
          onApplySleeve(newAsset.imageUrl);
          setPreviewShowBacks(true);
        } else if (assetType === 'playmat') {
          onApplyPlaymat(newAsset.imageUrl);
        }

        if (data.freeTierFallback) {
          setStatusMessage(
            isVi
              ? `Đã tạo thiết kế ${imageSize} từ Vector Studio (Đang dùng API key miễn phí — bạn vẫn có thể trang bị lên bàn đấu và tải về file PNG ${imageSize}).`
              : `Generated ${imageSize} vector studio artwork (Free-tier API key detected — ready to equip and download as ${imageSize} PNG).`
          );
        } else {
          setStatusMessage(
            isVi
              ? `Đã tạo thành công hình ảnh ${imageSize} (${newAsset.aspectRatio}) bằng gemini-3-pro-image-preview và áp dụng lên bàn đấu.`
              : `Generated ${imageSize} (${newAsset.aspectRatio}) asset with gemini-3-pro-image-preview and applied to your deck workbench.`
          );
        }
      }
    } catch (err: any) {
      setStatusMessage(err?.message || 'Could not generate image asset.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadAsset = (asset: GeneratedVisualAsset) => {
    const scaleMap: Record<ImageSizeOption, number> = {
      '1K': 1024,
      '2K': 2048,
      '4K': 3840,
    };
    const baseWidth = scaleMap[asset.imageSize] || 1024;
    const width =
      asset.type === 'playmat'
        ? baseWidth
        : asset.type === 'sleeve'
        ? Math.round(baseWidth * 0.75)
        : baseWidth;
    const height =
      asset.type === 'playmat' ? Math.round((baseWidth * 9) / 16) : baseWidth;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${asset.imageSize}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };
    img.src = asset.imageUrl;
  };

  const sampleMainCards = deck.entries.filter((e) => e.section === 'main').slice(0, 5);

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-[11px] sm:text-xs font-mono text-amber-400 tracking-wide">
            GEMINI-3-PRO-IMAGE-PREVIEW · 1K / 2K / 4K STUDIO
          </div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-100 font-display">
            {isVi
              ? 'Xưởng Thiết Kế Bọc Bài, Thảm Đấu & Tranh Boss (1K / 2K / 4K)'
              : 'Custom Sleeves, Playmats & Archetype Visual Studio'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {isVi ? (
              <>
                Khởi tạo bọc bài (`3:4`), thảm đấu (`16:9`) và tranh minh họa quái thú chủ lực
                (`1:1`) ở độ phân giải <strong>1K, 2K hoặc 4K</strong>, xem trước trực tiếp cùng bộ
                bài <strong>{deck.name}</strong>.
              </>
            ) : (
              <>
                Design bespoke card sleeves (`3:4`), tournament duel playmats (`16:9`), and custom
                archetype boss art (`1:1`) at selectable <strong>1K, 2K, or 4K</strong> resolutions.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-400">
          <span>gemini-3-pro-image-preview</span>
          <span>·</span>
          <span>{imageSize}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        <form
          onSubmit={handleGenerateImage}
          className="lg:col-span-5 p-4 sm:p-6 rounded-2xl sm:rounded-xl bg-[#111827] border border-slate-800 space-y-5"
        >
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-200">
              {isVi
                ? '01. Chọn Loại Phụ Kiện Hoặc Tranh Minh Họa'
                : '01. Select Accessory or Artwork Format'}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {assetTypeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleAutoFillPrompt(opt.id)}
                  className={`min-h-[54px] p-3 rounded-xl border text-left transition-colors flex items-center justify-between ${
                    assetType === opt.id
                      ? 'bg-amber-500/10 border-amber-400 text-slate-100'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-amber-300 ml-2 shrink-0">
                    {opt.aspectRatio}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-200">
              {isVi
                ? '02. Chọn Độ Phân Giải Đầu Ra (1K, 2K hoặc 4K)'
                : '02. Select Image Resolution (1K, 2K, or 4K)'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {sizeOptions.map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => setImageSize(sz.id)}
                  className={`min-h-[52px] py-2.5 px-3 rounded-xl border text-center transition-colors ${
                    imageSize === sz.id
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-mono tabular-nums">{sz.id}</div>
                  <div
                    className={`text-[10px] font-mono ${
                      imageSize === sz.id ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {sz.pixels}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="studio-prompt" className="text-xs font-semibold text-slate-200">
                {isVi ? '03. Mô Tả Phong Cách & Chủ Đề' : '03. Artwork Direction & Motif'}
              </label>
              <button
                type="button"
                onClick={() => handleAutoFillPrompt(assetType)}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 py-1"
              >
                <Wand2 className="w-3 h-3" />
                <span>{isVi ? `Theo ${deck.archetype}` : `Sync ${deck.archetype}`}</span>
              </button>
            </div>
            <textarea
              id="studio-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={
                isVi
                  ? 'Mô tả màu sắc, ánh sáng, họa tiết tộc bài...'
                  : 'Describe the colors, lighting, archetype motif...'
              }
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-semibold text-xs transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isGenerating
                ? isVi
                  ? `Đang kết xuất ảnh ${imageSize}...`
                  : `Rendering ${imageSize} Asset...`
                : isVi
                ? `Tạo ${
                    assetType === 'sleeve'
                      ? 'Bọc Bài'
                      : assetType === 'playmat'
                      ? 'Thảm Đấu'
                      : 'Tranh Quái Thú'
                  } Chuẩn ${imageSize}`
                : `Generate ${imageSize} Asset`}
            </span>
          </button>

          {statusMessage && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              {statusMessage}
            </div>
          )}
        </form>

        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
          <div className="rounded-2xl sm:rounded-xl overflow-hidden border border-slate-800 bg-[#090D16]">
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  {isVi ? 'Xem Trước Bàn Đấu & Bọc Bài' : 'Live Duel Field & Sleeve Preview'}
                </h2>
                <p className="text-xs text-slate-400 font-mono tabular-nums">
                  {selectedAsset.title} · {selectedAsset.imageSize} · {selectedAsset.aspectRatio}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPreviewShowBacks((v) => !v)}
                  className="flex-1 sm:flex-initial min-h-[42px] px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-xl sm:rounded-lg hover:border-amber-400 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {previewShowBacks
                      ? isVi
                        ? 'Hiện Mặt Trước'
                        : 'Card Faces'
                      : isVi
                      ? 'Lật Xem Bọc Bài'
                      : 'Flip Sleeves'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadAsset(selectedAsset)}
                  className="flex-1 sm:flex-initial min-h-[42px] px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl sm:rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isVi
                      ? `Tải PNG ${selectedAsset.imageSize}`
                      : `Download ${selectedAsset.imageSize}`}
                  </span>
                </button>
              </div>
            </div>

            <div className="relative p-4 sm:p-8 min-h-[280px] sm:min-h-[340px] flex flex-col justify-between">
              <img
                src={deck.customPlaymatUrl || selectedAsset.imageUrl}
                alt="Active Duel Field Playmat"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/60" />

              <div className="relative z-10 flex items-center justify-between text-[11px] sm:text-xs text-slate-200 font-mono tabular-nums">
                <span className="truncate max-w-[65%]">FIELD: {deck.name}</span>
                <span>{selectedAsset.imageSize} PREVIEW</span>
              </div>

              <div className="relative z-10 my-4 sm:my-6 grid grid-cols-3 sm:grid-cols-5 gap-2.5 sm:gap-3 max-w-xl mx-auto w-full">
                {sampleMainCards.map((entry, idx) => (
                  <div
                    key={entry.card.id}
                    className={idx >= 3 ? 'hidden sm:block' : 'block'}
                  >
                    <CardArtwork
                      card={entry.card}
                      quantity={entry.quantity}
                      showSleeveBack={previewShowBacks}
                      sleeveUrl={deck.customSleeveUrl}
                      compact
                    />
                  </div>
                ))}
              </div>

              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <span>
                  {previewShowBacks
                    ? isVi
                      ? 'Đang xem mặt lưng Bọc Bài (Card Sleeve)'
                      : 'Viewing Custom Sleeve Backs'
                    : isVi
                    ? 'Đang xem bài trên nền Thảm Đấu (Playmat)'
                    : 'Viewing Cards on Custom Playmat'}
                </span>
                <div className="flex items-center gap-3">
                  {selectedAsset.type === 'sleeve' && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplySleeve(selectedAsset.imageUrl);
                        setPreviewShowBacks(true);
                      }}
                      className="text-amber-300 hover:underline font-medium flex items-center gap-1 py-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Trang Bị Làm Bọc Bài' : 'Equip Sleeve'}</span>
                    </button>
                  )}
                  {selectedAsset.type === 'playmat' && (
                    <button
                      type="button"
                      onClick={() => onApplyPlaymat(selectedAsset.imageUrl)}
                      className="text-amber-300 hover:underline font-medium flex items-center gap-1 py-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Trang Bị Làm Thảm Đấu' : 'Equip Playmat'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-xl bg-[#111827] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>
                  {isVi
                    ? `Bộ Sưu Tập Đã Tạo (${assets.length})`
                    : `Studio Gallery (${assets.length})`}
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {assets.map((asset) => {
                const isSelected = selectedAsset.id === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedAsset(asset);
                    }}
                    className={`group rounded-xl overflow-hidden border bg-slate-950 transition-all cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/30'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="aspect-video w-full overflow-hidden bg-slate-900 relative">
                      <img
                        src={asset.imageUrl}
                        alt={asset.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2.5 space-y-1">
                      <div className="text-xs font-medium text-slate-100 truncate">
                        {asset.title}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400 flex items-center justify-between">
                        <span>{asset.aspectRatio}</span>
                        <span className="text-amber-300 font-semibold">{asset.imageSize}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
