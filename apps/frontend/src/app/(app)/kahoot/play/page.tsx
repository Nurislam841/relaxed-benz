'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Loader2, Users, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/form-elements';
import { Card } from '@/components/ui/card';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMe } from '@/hooks/use-auth';
import { createKahootSocket } from '@/lib/kahoot-socket';
import type { Socket } from 'socket.io-client';

interface LobbyState {
  sessionId: string;
  joinCode: string;
  status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  currentIndex: number;
  quizTitle: string;
  hostName: string;
  totalQuestions: number;
  secondsPerQuestion: number;
  players: Array<{ userId: string; fullName: string; score: number }>;
}

interface QuestionState {
  id: string;
  index: number;
  total: number;
  question: string;
  options: string[];
  points: number;
  deadline: number;
  secondsPerQuestion: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  score: number;
}

const OPTION_COLORS = [
  'bg-rose-500 hover:bg-rose-600',
  'bg-sky-500 hover:bg-sky-600',
  'bg-amber-500 hover:bg-amber-600',
  'bg-emerald-500 hover:bg-emerald-600',
];

export default function KahootPlayPage() {
  const router = useRouter();
  const { data: user } = useMe();

  const [joinCode, setJoinCode] = useState('');
  const [phase, setPhase] = useState<'enter-code' | 'lobby' | 'question' | 'reveal' | 'finished'>('enter-code');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [question, setQuestion] = useState<QuestionState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; pointsEarned: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const questionStartRef = useRef<number>(0);

  // ── Timer for current question ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'question' || !question) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((question.deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [phase, question]);

  // ── Socket lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const handleJoin = async () => {
    if (!/^[A-Z2-9]{6}$/.test(joinCode.toUpperCase())) {
      toast({ title: 'Code must be 6 characters', variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      // First REST-lookup to translate joinCode → sessionId. This lets us
      // catch a wrong code immediately instead of waiting for the socket to
      // come up and reject.
      const sess = await api.get<{ sessionId: string; quizTitle: string; status: string }>(
        `/kahoot/sessions/by-code/${joinCode.toUpperCase()}`,
      );

      if (sess.status === 'FINISHED' || sess.status === 'CANCELLED') {
        toast({ title: 'This session has already ended', variant: 'destructive' });
        setBusy(false);
        return;
      }

      // Now open the socket
      const socket = createKahootSocket();
      socketRef.current = socket;

      socket.on('connect_error', (err: Error) => {
        toast({ title: 'Connection failed', description: err.message, variant: 'destructive' });
        setBusy(false);
      });

      socket.on('error', (e: { message: string }) => {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      });

      socket.on('state:lobby', (state: LobbyState) => {
        setLobby(state);
        if (state.status === 'LOBBY') {
          setPhase('lobby');
        }
      });

      socket.on('state:question', (q: QuestionState) => {
        setQuestion(q);
        setPickedIndex(null);
        setLastResult(null);
        questionStartRef.current = Date.now();
        setPhase('question');
      });

      socket.on('state:leaderboard', (board: LeaderboardEntry[]) => {
        setLeaderboard(board);
        // If we have a lastResult shown, advance to reveal phase
        if (lastResult || pickedIndex != null) setPhase('reveal');
      });

      socket.on('state:finished', () => {
        setPhase('finished');
      });

      socket.on('answer:result', (r: { isCorrect: boolean; pointsEarned: number }) => {
        setLastResult(r);
      });

      // Now join the session
      socket.emit('join', { sessionId: sess.sessionId }, (ack: { ok?: boolean; isHost?: boolean }) => {
        setBusy(false);
        if (ack?.isHost) {
          // Hosts shouldn't be playing — redirect to host page
          socket.disconnect();
          router.push(`/kahoot/host/${sess.sessionId}`);
        }
      });
    } catch (e: any) {
      toast({ title: 'Could not join', description: e.message, variant: 'destructive' });
      setBusy(false);
    }
  };

  const submitAnswer = (i: number) => {
    if (!question || pickedIndex != null || !socketRef.current) return;
    setPickedIndex(i);
    const responseTimeMs = Date.now() - questionStartRef.current;
    socketRef.current.emit(
      'answer',
      {
        sessionId: lobby?.sessionId,
        questionId: question.id,
        pickedIndex: i,
        responseTimeMs,
      },
      // ack is optional — we'll get the same data via `answer:result`
    );
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (phase === 'enter-code') {
    return (
      <div className="max-w-md mx-auto mt-12 space-y-6">
        <div className="text-center space-y-2">
          <Eyebrow>Live quiz</Eyebrow>
          <HDisplay size="md" as="h1">
            Join a <em>live</em> session
          </HDisplay>
          <p className="text-[14px] text-[var(--fg-muted)]">Enter the 6-character code from your teacher.</p>
        </div>
        <Card padding="lg">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="join-code">Game code</Label>
              <Input
                id="join-code"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z2-9]/g, '')
                      .slice(0, 6),
                  )
                }
                placeholder="ABCD23"
                className="font-mono tracking-[0.4em] text-center text-xl"
                maxLength={6}
                autoFocus
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleJoin}
              disabled={busy || joinCode.length !== 6}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
              Join
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'lobby' && lobby) {
    return (
      <div className="max-w-2xl mx-auto mt-12 space-y-6 text-center">
        <Eyebrow>Waiting for host</Eyebrow>
        <HDisplay size="lg" as="h1">
          You're <em>in</em>!
        </HDisplay>
        <p className="text-[15px] text-[var(--fg-muted)]">
          Hosted by <strong>{lobby.hostName}</strong> · {lobby.quizTitle}
        </p>
        <Card padding="lg">
          <div className="flex items-center justify-center gap-2 text-[var(--fg-muted)] text-sm">
            <Users className="h-4 w-4" />
            <span>
              {lobby.players.length} {lobby.players.length === 1 ? 'player' : 'players'} in lobby
            </span>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {lobby.players.map((p) => (
              <span
                key={p.userId}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[13px] border',
                  p.userId === user?.id
                    ? 'border-[var(--accent-500)] bg-[var(--accent-100)] text-[var(--accent-700)] font-medium'
                    : 'border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--fg-muted)]',
                )}
              >
                {p.fullName}
              </span>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'question' && question) {
    return (
      <div className="max-w-3xl mx-auto mt-8 space-y-5">
        <div className="flex items-center justify-between">
          <Eyebrow>
            Question {question.index + 1} of {question.total}
          </Eyebrow>
          <div
            className={cn(
              'font-mono text-2xl font-bold tabular-nums',
              timeLeft <= 5 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--fg)]',
            )}
            aria-label={`${timeLeft} seconds remaining`}
          >
            {timeLeft}s
          </div>
        </div>

        <Card padding="lg">
          <h2 className="font-serif text-[22px] leading-tight">{question.question}</h2>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => submitAnswer(i)}
              disabled={pickedIndex != null}
              className={cn(
                'rounded-xl text-white font-semibold text-left p-5 transition-all shadow-md',
                OPTION_COLORS[i % OPTION_COLORS.length],
                pickedIndex === i && 'ring-4 ring-white/40',
                pickedIndex != null && pickedIndex !== i && 'opacity-40',
                pickedIndex == null && 'hover:scale-[1.02] active:scale-100',
                pickedIndex != null && 'cursor-not-allowed',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center text-sm font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
              </div>
            </button>
          ))}
        </div>

        {pickedIndex != null && (
          <p className="text-center text-[13px] text-[var(--fg-muted)]">
            Answer locked in. Waiting for the host to advance…
          </p>
        )}
      </div>
    );
  }

  if (phase === 'reveal') {
    return (
      <div className="max-w-2xl mx-auto mt-10 space-y-6">
        {lastResult && (
          <Card padding="lg" className="text-center">
            {lastResult.isCorrect ? (
              <>
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
                <h2 className="font-serif text-2xl mt-3">Correct!</h2>
                <p className="text-[var(--fg-muted)] mt-1">+{lastResult.pointsEarned} points</p>
              </>
            ) : (
              <>
                <XCircle className="h-12 w-12 mx-auto text-rose-500" />
                <h2 className="font-serif text-2xl mt-3">Not this time</h2>
                <p className="text-[var(--fg-muted)] mt-1">Better luck on the next question.</p>
              </>
            )}
          </Card>
        )}

        <Card padding="md">
          <Eyebrow>Leaderboard</Eyebrow>
          <ol className="mt-3 space-y-1.5">
            {leaderboard.slice(0, 5).map((p) => (
              <li
                key={p.userId}
                className={cn(
                  'flex items-center justify-between px-2 py-1.5 rounded-md',
                  p.userId === user?.id && 'bg-[var(--accent-100)]',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-[var(--fg-muted)] w-6 text-right">#{p.rank}</span>
                  <span className={p.userId === user?.id ? 'font-semibold' : ''}>{p.fullName}</span>
                </span>
                <span className="font-mono font-semibold">{p.score}</span>
              </li>
            ))}
          </ol>
        </Card>

        <p className="text-center text-[12px] text-[var(--fg-muted)]">
          Waiting for the host to start the next question…
        </p>
      </div>
    );
  }

  if (phase === 'finished') {
    const me = leaderboard.find((p) => p.userId === user?.id);
    return (
      <div className="max-w-md mx-auto mt-16 space-y-6 text-center">
        <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
        <HDisplay size="md" as="h1">
          Game <em>over</em>
        </HDisplay>
        {me && (
          <p className="text-[16px]">
            You finished <strong>#{me.rank}</strong> with <strong>{me.score}</strong> points.
          </p>
        )}
        <Card padding="md" className="text-left">
          <Eyebrow>Final standings</Eyebrow>
          <ol className="mt-3 space-y-1.5">
            {leaderboard.map((p) => (
              <li
                key={p.userId}
                className={cn(
                  'flex items-center justify-between px-2 py-1.5 rounded-md',
                  p.userId === user?.id && 'bg-[var(--accent-100)]',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-[var(--fg-muted)] w-6 text-right">#{p.rank}</span>
                  <span className={p.userId === user?.id ? 'font-semibold' : ''}>{p.fullName}</span>
                </span>
                <span className="font-mono font-semibold">{p.score}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Button onClick={() => router.push('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }

  return null;
}
