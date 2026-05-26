'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, Unlink, MessageCircle, ExternalLink, Zap, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/form-elements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface StatusResponse {
  linked: boolean;
  chatIdHint: string | null;
  botConfigured: boolean;
}

/**
 * Telegram notifications card on the profile page.
 *
 * Three states render:
 *   1. Bot not configured on server      → muted disabled state
 *   2. Bot configured + not linked       → setup flow (instructions + input)
 *   3. Bot configured + linked           → status pill + test/unlink buttons
 */
export function TelegramCard() {
  const qc = useQueryClient();
  const [chatId, setChatId] = useState('');
  // After "Connect in one tap" we keep the freshly-issued code visible so the
  // user can paste it into the bot as `/link 123456` if the deep link's
  // payload was dropped by Telegram (happens for any returning user).
  const [activeCode, setActiveCode] = useState<{
    code: string;
    botUsername: string;
    expiresAt: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: status } = useQuery<StatusResponse>({
    queryKey: ['telegram-status'],
    queryFn: () => api.get('/me/telegram/status'),
  });

  const link = useMutation({
    mutationFn: (id: string) => api.post('/me/telegram/link', { chatId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['telegram-status'] });
      setChatId('');
      toast({
        title: 'Telegram linked',
        description: 'Check your Telegram chat for a confirmation message.',
      });
    },
    onError: (e: Error) => toast({ title: 'Could not link', description: e.message, variant: 'destructive' }),
  });

  const unlink = useMutation({
    mutationFn: () => api.post('/me/telegram/unlink', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['telegram-status'] });
      toast({ title: 'Telegram unlinked' });
    },
  });

  /**
   * One-tap link: backend hands us a short-lived `t.me/<bot>?start=link_<jwt>`
   * URL. We open it; Telegram routes the user into our bot's /start handler
   * with the JWT as payload; the bot verifies and saves telegramChatId.
   *
   * This is the *primary* linking path — the manual chat_id flow below is
   * preserved as a fallback for users who can't open the deep link
   * (e.g. linking from a desktop without Telegram installed).
   */
  const oneTapLink = useMutation({
    mutationFn: () =>
      api.post<{ deepLink: string; code: string; botUsername: string; expiresIn: number }>(
        '/me/telegram/link-token',
        {},
      ),
    onSuccess: (r) => {
      setActiveCode({
        code: r.code,
        botUsername: r.botUsername,
        expiresAt: Date.now() + r.expiresIn * 1000,
      });
      setCopied(false);
      window.open(r.deepLink, '_blank', 'noopener,noreferrer');
      toast({
        title: 'Opening Telegram…',
        description: `If linking doesn't complete automatically, paste the code into @${r.botUsername} as /link ${r.code}.`,
      });
      // Poll status — flips the card to "linked" within ~10s if the user
      // either tapped Start in the deep link OR sent /link <code>.
      const poll = setInterval(() => {
        qc.invalidateQueries({ queryKey: ['telegram-status'] });
      }, 3000);
      setTimeout(() => clearInterval(poll), 5 * 60 * 1000);
    },
    onError: (e: Error) => toast({ title: 'Could not start linking', description: e.message, variant: 'destructive' }),
  });

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Could not copy — please select manually', variant: 'destructive' });
    }
  };

  const test = useMutation({
    mutationFn: () => api.post<{ sent: boolean }>('/me/telegram/test', {}),
    onSuccess: (r) => {
      if (r.sent) {
        toast({ title: 'Test message sent', description: 'Check your Telegram chat.' });
      } else {
        toast({ title: 'Could not deliver', variant: 'destructive' });
      }
    },
    onError: (e: Error) => toast({ title: 'Send failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[var(--accent-700)]" />
          Telegram notifications
          {status?.linked && (
            <span className="ml-1 text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
              ON
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Receive assignment, grade, and announcement notifications directly in your Telegram chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server-side bot not configured */}
        {status && !status.botConfigured && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-3 text-[12px] text-amber-900 dark:text-amber-100">
            The administrator hasn't configured a Telegram bot for this server. Notifications will continue to arrive in
            UniLMS — Telegram delivery is optional and currently unavailable.
          </div>
        )}

        {/* Linked state */}
        {status?.botConfigured && status.linked && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-3">
              <div>
                <p className="text-[12px] text-[var(--fg-muted)]">Linked chat</p>
                <p className="font-mono text-sm tracking-wider">{status.chatIdHint}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}>
                  {test.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Send test
                </Button>
                <Button size="sm" variant="ghost" onClick={() => unlink.mutate()} disabled={unlink.isPending}>
                  <Unlink className="h-3.5 w-3.5" />
                  Unlink
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Not linked: setup flow */}
        {status?.botConfigured && !status.linked && (
          <div className="space-y-4">
            {/* One-tap primary path */}
            <div className="space-y-2">
              <Button onClick={() => oneTapLink.mutate()} disabled={oneTapLink.isPending} size="lg" className="w-full">
                {oneTapLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {activeCode ? 'Generate new code' : 'Connect in one tap'}
              </Button>
              <p className="text-[11px] text-[var(--fg-muted)] text-center">
                Opens Telegram → tap Start. Or paste the code below into the bot if Start doesn't appear.
              </p>
            </div>

            {/* Active code display — primary visible state after click */}
            {activeCode && (
              <div className="rounded-md border border-[var(--accent-300)] dark:border-[var(--accent-500)]/30 bg-[var(--accent-50)] dark:bg-[var(--accent-500)]/10 p-4 space-y-3">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)]">
                    Your linking code (expires in 5 min)
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <code className="font-mono text-3xl font-bold tracking-[0.2em] text-[var(--accent-800)] dark:text-[var(--accent-200)]">
                      {activeCode.code}
                    </code>
                    <Button size="sm" variant="ghost" onClick={() => copyCode(activeCode.code)}>
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <ol className="text-[13px] text-[var(--fg-muted)] space-y-1 leading-relaxed">
                  <li>
                    <span className="font-semibold text-[var(--fg)]">1.</span> Open{' '}
                    <a
                      href={`https://t.me/${activeCode.botUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent-700)] hover:underline inline-flex items-center gap-0.5"
                    >
                      @{activeCode.botUsername}
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    in Telegram
                  </li>
                  <li>
                    <span className="font-semibold text-[var(--fg)]">2.</span> Send{' '}
                    <code className="font-mono px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border-color)]">
                      /link {activeCode.code}
                    </code>
                  </li>
                  <li>
                    <span className="font-semibold text-[var(--fg)]">3.</span> Bot replies "✅ UniLMS linked!" and this
                    card flips to ON
                  </li>
                </ol>
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)] uppercase tracking-wide">
              <div className="h-px flex-1 bg-[var(--border-color)]" />
              or do it manually
              <div className="h-px flex-1 bg-[var(--border-color)]" />
            </div>

            <ol className="space-y-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
              <li>
                <span className="font-semibold text-[var(--fg)]">1.</span> Open Telegram and start a chat with{' '}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-700)] hover:underline inline-flex items-center gap-0.5"
                >
                  @userinfobot
                  <ExternalLink className="h-3 w-3" />
                </a>
                . Send any message — it will reply with your numeric chat ID.
              </li>
              <li>
                <span className="font-semibold text-[var(--fg)]">2.</span> Open the UniLMS bot in Telegram and send{' '}
                <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                  /start
                </code>
                . This unlocks outbound DMs from the bot to your chat.
              </li>
              <li>
                <span className="font-semibold text-[var(--fg)]">3.</span> Paste your chat ID below and click Link.
                You'll get a confirmation message in Telegram.
              </li>
            </ol>
            <div className="space-y-1.5">
              <Label htmlFor="tg-chat-id">Your Telegram chat ID</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tg-chat-id"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456789"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value.replace(/[^\d-]/g, ''))}
                  className="font-mono"
                />
                <Button onClick={() => link.mutate(chatId)} disabled={link.isPending || !/^-?\d{4,20}$/.test(chatId)}>
                  {link.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <Send className="h-3.5 w-3.5" />
                  Link
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
