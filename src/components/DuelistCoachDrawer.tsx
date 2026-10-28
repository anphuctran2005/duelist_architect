import React, { useEffect, useRef, useState } from 'react';
import { Bot, Check, MessageSquare, PlusCircle, Send, Sparkles, User } from 'lucide-react';
import { useLanguage } from '../i18n/translations';
import {
  ChatMessage,
  ChatPersonaId,
  DeckState,
  GeminiModelTier,
  SuggestedDeckChange,
} from '../types/ygo';
import { sendCoachMessageUnified } from '../utils/clientApiFallback';

interface DuelistCoachDrawerProps {
  deck: DeckState;
  onApplySuggestedChanges: (changes: SuggestedDeckChange[]) => Promise<void>;
}

export const DuelistCoachDrawer: React.FC<DuelistCoachDrawerProps> = ({
  deck,
  onApplySuggestedChanges,
}) => {
  const { lang } = useLanguage();
  const isVi = lang === 'vi';

  const [persona, setPersona] = useState<ChatPersonaId>('combo_strategist');
  const [selectedModel, setSelectedModel] = useState<GeminiModelTier>('gpt-oss-20b-free');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [appliedMessageIds, setAppliedMessageIds] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-coach',
      role: 'model',
      content: isVi
        ? `Chào mừng bạn đến với **Huấn Luyện Viên Chiến Thuật AI Miễn Phí (Duelist Coach 0đ)**. Tôi đã nạp danh sách bộ bài **${deck.name}** (${deck.archetype}) của bạn.\n\nHệ thống sử dụng các mô hình AI mã nguồn mở miễn phí 100% (\`GPT-OSS 20B Free\`, \`Llama 3.3 70B Free\`, \`Qwen 2.5 72B Free\`) kết hợp dữ liệu YGOPRODeck mà không cần thẻ thanh toán hay API trả phí.`
        : `Welcome to the **Free AI Duelist Coach**. I have loaded your active **${deck.name}** (${deck.archetype}) list.\n\nPowered by 100% free open-source AI models (\`GPT-OSS 20B Free\`, \`Llama 3.3 70B Free\`, \`Qwen 2.5 72B Free\`) and live YGOPRODeck data.`,
      timestamp: 'Ready',
      modelUsed: 'GPT-OSS 20B (Free 0đ)',
      persona: 'combo_strategist',
    },
  ]);

  const personaOptions: { id: ChatPersonaId; label: string }[] = [
    {
      id: 'combo_strategist',
      label: isVi ? 'Chiến Thuật & Combo' : 'Combo & Line Strategist',
    },
    {
      id: 'meta_analyst',
      label: isVi ? 'Phân Tích Meta & Banlist' : 'Meta & Banlist Analyst',
    },
    {
      id: 'budget_optimizer',
      label: isVi ? 'Tối Ưu Điểm CP Giá Rẻ' : 'Budget & CP Optimizer',
    },
  ];

  const modelOptions: { id: GeminiModelTier; label: string; badge: string }[] = [
    {
      id: 'gpt-oss-20b-free',
      label: 'GPT-OSS 20B (Free)',
      badge: isVi ? 'Suy Luận 0đ' : 'Free Reasoning',
    },
    {
      id: 'llama-3.3-70b-free',
      label: 'Llama 3.3 70B (Free)',
      badge: isVi ? 'Đa Dụng 0đ' : 'Free Versatile',
    },
    {
      id: 'qwen-2.5-72b-free',
      label: 'Qwen 2.5 72B (Free)',
      badge: isVi ? 'Tốc Độ Cao 0đ' : 'Free Fast',
    },
  ];

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const serializeDeckContext = () => {
    const main = deck.entries
      .filter((e) => e.section === 'main')
      .map((e) => `${e.quantity}x ${e.card.name} [${e.card.mdRarity}]`)
      .join(', ');
    const extra = deck.entries
      .filter((e) => e.section === 'extra')
      .map((e) => `${e.quantity}x ${e.card.name} [${e.card.mdRarity}]`)
      .join(', ');
    return `Deck Name: ${deck.name} (${deck.archetype})\nMain Deck: ${main}\nExtra Deck: ${extra}`;
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: selectedModel,
      persona,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsSending(true);

    try {
      const data = await sendCoachMessageUnified({
        messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        persona,
        model: selectedModel,
        deckSummary: serializeDeckContext(),
        lang,
      });

      const botMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: data.reply || 'Here is my analysis for your Master Duel decklist.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.modelUsed || selectedModel,
        persona,
        suggestedChanges: Array.isArray(data.suggestedChanges) ? data.suggestedChanges : undefined,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          content: isVi
            ? `Không thể kết nối tới máy chủ huấn luyện viên: ${err?.message || 'Lỗi không xác định'}.`
            : `Unable to reach the coaching endpoint: ${err?.message || 'Unknown error'}.`,
          timestamp: 'Error',
          modelUsed: selectedModel,
          persona,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyChanges = async (msgId: string, changes: SuggestedDeckChange[]) => {
    await onApplySuggestedChanges(changes);
    setAppliedMessageIds((prev) => ({ ...prev, [msgId]: true }));
  };

  const quickPrompts = isVi
    ? [
        'Làm sao để đánh vượt qua Maxx "C" và Ash Blossom với bộ bài này?',
        'Gợi ý 3 lá bài SR/R giá rẻ thay thế để giảm chi phí CP UR.',
        'Hướng dẫn chi tiết combo Lượt 1 tối ưu nhất của bộ bài này.',
      ]
    : [
        'How do I play around Maxx "C" and Ash Blossom with this deck?',
        'Suggest 3 budget SR/R replacements to lower my UR Crafting Point cost.',
        'What is the optimal Turn 1 end-board and combo sequence?',
      ];

  return (
    <div className="flex flex-col h-[620px] rounded-xl bg-[#111827] border border-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              {isVi ? 'Cố Vấn Chiến Thuật Gemini' : 'Gemini Duelist Coach'}
            </h3>
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as GeminiModelTier)}
            aria-label="Select Gemini Model Tier"
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
          >
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.badge})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {personaOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPersona(p.id)}
              className={`px-2 py-1.5 rounded text-left border transition-colors ${
                persona === p.id
                  ? 'bg-amber-500/15 border-amber-400/80 text-amber-200'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-[11px] font-semibold truncate">{p.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1">
              {msg.role === 'user' ? (
                <>
                  <span>{isVi ? 'Bạn' : 'You'}</span>
                  <User className="w-3 h-3 text-slate-400" />
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-300">{msg.modelUsed}</span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </>
              )}
            </div>

            <div
              className={`max-w-[92%] rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-amber-400 text-slate-950 font-medium'
                  : 'bg-slate-900/95 border border-slate-800 text-slate-200'
              }`}
            >
              {msg.content}

              {msg.suggestedChanges && msg.suggestedChanges.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-amber-300">
                    {isVi ? 'Đề xuất điều chỉnh bộ bài:' : 'Suggested Deck Modifications:'}
                  </div>
                  <div className="space-y-1">
                    {msg.suggestedChanges.map((chg, idx) => (
                      <div
                        key={`${chg.cardName}-${idx}`}
                        className="text-[11px] font-mono text-slate-300 flex items-center justify-between gap-2"
                      >
                        <span>
                          {chg.action === 'add' ? '+' : '-'}
                          {chg.quantity}x {chg.cardName} ({chg.section})
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!!appliedMessageIds[msg.id]}
                    onClick={() => handleApplyChanges(msg.id, msg.suggestedChanges!)}
                    className="w-full mt-1.5 py-1.5 px-3 rounded bg-amber-400/20 border border-amber-400/60 text-amber-200 hover:bg-amber-400 hover:text-slate-950 font-semibold text-[11px] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {appliedMessageIds[msg.id] ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {isVi ? 'Đã Áp Dụng Vào Bộ Bài' : 'Applied to Active Deck'}
                        </span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>
                          {isVi
                            ? 'Áp Dụng Thay Đổi Này Vào Deck'
                            : 'Apply Suggested Changes to Deck'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs font-mono text-amber-300 p-2">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>
              {isVi
                ? `${selectedModel} đang phân tích chiến thuật bộ bài...`
                : `${selectedModel} is analyzing your deck ratios...`}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {quickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => sendMessage(qp)}
              disabled={isSending}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-[11px] text-slate-300 whitespace-nowrap shrink-0 transition-colors"
            >
              {qp}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isVi
                ? 'Hỏi về combo, cách khắc chế meta, hoặc thay bài giá rẻ...'
                : 'Ask about combos, matchups, or budget swaps...'
            }
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            aria-label="Send message to Duelist Coach"
            className="p-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
