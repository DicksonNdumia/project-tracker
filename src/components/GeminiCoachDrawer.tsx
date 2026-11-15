import React, { useEffect, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, Sparkles, X, Zap } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { ChatMessage } from '../types';

interface GeminiCoachDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type CoachRole = 'productivity' | 'interview' | 'architect';

const ROLE_OPTIONS: Array<{ id: CoachRole; label: string; starter: string }> = [
  {
    id: 'productivity',
    label: 'Productivity Coach',
    starter: 'Help me pick my top 3 MITs today based on my current tasks and streak.',
  },
  {
    id: 'interview',
    label: 'Interview Mentor',
    starter: 'Quiz me on a medium system design question and evaluate my approach.',
  },
  {
    id: 'architect',
    label: 'Project Architect',
    starter: 'Suggest realistic next milestones and features for my active projects.',
  },
];

export const GeminiCoachDrawer: React.FC<GeminiCoachDrawerProps> = ({ isOpen, onClose }) => {
  const [role, setRole] = useState<CoachRole>('productivity');
  const [fastMode, setFastMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  if (!isOpen) return null;

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };

    const historyPayload = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setSending(true);
    setError(null);

    try {
      const res = await apiFetch<{ reply: string; model: string }>('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          role,
          fastMode,
        }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: res.reply,
          model: res.model,
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Assistant request failed.');
    } finally {
      setSending(false);
    }
  };

  const activeRoleObj = ROLE_OPTIONS.find((r) => r.id === role)!;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={onClose} />
      <aside className="relative w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Engineering Coach</h2>
              <div className="text-[11px] text-slate-500">
                Multi-turn workspace guidance
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Close coach"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Role & Speed Controls */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRole(opt.id)}
                className={`flex-1 py-1.5 px-2 text-[11px] font-medium rounded-md cursor-pointer transition-colors ${
                  role === opt.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Grounded with your live tasks, streak & projects</span>
            <button
              onClick={() => setFastMode((f) => !f)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer ${
                fastMode
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
              title="Toggle fast lightweight model"
            >
              <Zap className="w-3 h-3" />
              <span>{fastMode ? 'Fast' : 'Standard'}</span>
            </button>
          </div>
        </div>

        {/* Messages Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4 py-6">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Bot className="w-4 h-4 text-emerald-500" />
                  <span>{activeRoleObj.label} Ready</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Ask follow-up questions across multiple turns. Context from your open tasks,
                  streak, projects, and focus hours is included automatically.
                </p>
              </div>
              <button
                onClick={() => sendMessage(activeRoleObj.starter)}
                className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Try: &quot;{activeRoleObj.starter}&quot;
              </button>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="text-xs text-slate-500">Thinking...</div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask your ${activeRoleObj.label.toLowerCase()}...`}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </aside>
    </div>
  );
};
