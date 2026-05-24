'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, KeyRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage, useT } from '@/lib/i18n';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AIBubble, AIComposer, ThinkingDots, LiveCaret } from '@/components/ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

type AiStatus =
  | { configured: false; demo: true; reason: 'no_key' }
  | { configured: true; demo: true; reason: 'invalid_key'; keyPrefix: string; hint: string }
  | { configured: true; demo: false };

export function AiChat() {
  const t = useT();
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // AI module status. Only fetch once the panel is opened — no point hitting
  // the endpoint while the floating button sits idle on every authenticated
  // page. Cache for 60s so opening/closing repeatedly doesn't spam the API.
  const { data: aiStatus } = useQuery<AiStatus>({
    queryKey: ['ai-status'],
    queryFn: () => api.get<AiStatus>('/ai/status'),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });

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
          open && 'scale-90',
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
            <span className="font-semibold text-[13px] tracking-tight">{t.aiChat.title}</span>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] opacity-70">UniLMS AI</span>
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
            {/* Demo-mode banner — persistent until admin fixes LLM_API_KEY */}
            {aiStatus?.demo && (
              <div className="flex items-start gap-2.5 p-3 rounded-md border bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:border-amber-500/30">
                <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1 text-[12px] leading-snug">
                  {aiStatus.reason === 'invalid_key' ? (
                    <>
                      <p className="font-semibold">AI is in demo mode</p>
                      <p>
                        Your <code className="font-mono text-[11px]">LLM_API_KEY</code> was rejected by Anthropic (HTTP
                        401). Replace it in <code className="font-mono text-[11px]">apps/backend/.env</code> with a real
                        key (format <code className="font-mono text-[11px]">sk-ant-api03-…</code>) and{' '}
                        <code className="font-mono text-[11px]">docker compose restart backend</code>.
                      </p>
                      {aiStatus.keyPrefix && (
                        <p className="text-[11px] opacity-75">
                          Current prefix: <code className="font-mono">{aiStatus.keyPrefix}…</code> (not a known
                          Anthropic format)
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">LLM_API_KEY not configured</p>
                      <p>
                        AI features are returning demo responses. Get a key at{' '}
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline"
                        >
                          console.anthropic.com
                        </a>{' '}
                        and add it to <code className="font-mono text-[11px]">apps/backend/.env</code>.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {messages.length === 0 && (
              <div className="text-center pt-12 space-y-3">
                <div
                  className="mx-auto w-12 h-12 rounded-[12px] flex items-center justify-center text-white"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
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
            <AIComposer placeholder={t.aiChat.placeholder} onSend={sendMessage} disabled={streaming} />
          </div>
        </div>
      )}
    </>
  );
}
