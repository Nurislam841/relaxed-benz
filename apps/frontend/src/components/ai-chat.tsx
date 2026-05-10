'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Sparkles } from 'lucide-react';
import { useLanguage, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { AIBubble, AIComposer, ThinkingDots, LiveCaret } from '@/components/ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export function AiChat() {
  const t = useT();
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: trimmed },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: trimmed, lang }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error('Request failed');

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              setMessages((prev) => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = {
                  role: 'assistant',
                  content: msgs[msgs.length - 1].content + parsed.text,
                  streaming: true,
                };
                return msgs;
              });
            }
          } catch {
            /* malformed chunk - ignore */
          }
        }
      }

      setMessages((prev) => {
        const msgs = [...prev];
        if (msgs.length > 0) {
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], streaming: false };
        }
        return msgs;
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages((prev) => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = {
            role: 'assistant',
            content: t.aiChat.error,
            streaming: false,
          };
          return msgs;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t.aiChat.ariaLabel}
        className={cn(
          'fixed bottom-6 right-6 z-50 h-13 w-13 rounded-full',
          'flex items-center justify-center transition-transform duration-ds-base ease-ds-spring',
          'shadow-ds-lg text-white',
          open && 'scale-90'
        )}
        style={{
          width: 52,
          height: 52,
          background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
        }}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-[88px] right-6 z-50 w-[360px] sm:w-[400px] flex flex-col rounded-[16px] border border-[var(--border-color)] bg-[var(--surface-raised)] overflow-hidden"
          style={{ height: 540, boxShadow: 'var(--shadow-xl)' }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-3 text-white"
            style={{
              background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-semibold text-[13px] tracking-tight">
              {t.aiChat.title}
            </span>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] opacity-70">
              UniLMS AI
            </span>
            <button
              onClick={handleClose}
              className="ml-auto opacity-80 hover:opacity-100 p-0.5 rounded"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-subtle)]">
            {messages.length === 0 && (
              <div className="text-center pt-12 space-y-3">
                <div
                  className="mx-auto w-12 h-12 rounded-[12px] flex items-center justify-center text-white"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
                  }}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-[13px] text-[var(--fg-muted)] max-w-[260px] mx-auto leading-snug">
                  {t.aiChat.empty}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <AIBubble key={i} role={msg.role}>
                {msg.content}
                {msg.streaming && (msg.content ? <LiveCaret /> : <ThinkingDots />)}
              </AIBubble>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-[var(--border-color)] bg-[var(--surface)]">
            <AIComposer
              placeholder={t.aiChat.placeholder}
              onSend={sendMessage}
              disabled={streaming}
            />
          </div>
        </div>
      )}
    </>
  );
}
