'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Play, SkipForward, X, Users, Trophy, Radio, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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

const OPTION_COLORS = ['bg-rose-500', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500'];

export default function KahootHostPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [question, setQuestion] = useState<QuestionState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [phase, setPhase] = useState<'connecting' | 'lobby' | 'question' | 'finished'>('connecting');
  const [timeLeft, setTimeLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  // Tracks whether we've already auto-advanced THIS question, so the
  // timer-expiry effect can't fire `host:next` twice if it rerenders
  // while the round-trip is in flight. Reset on every new question.
  const autoAdvancedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      socket = await createKahootSocket();
      if (cancelled) {
        socket.disconnect();
        return;
      }
      socketRef.current = socket;

      socket.on('connect_error', (err: Error) => {
        toast({ title: 'Connection failed', description: err.message, variant: 'destructive' });
      });

      socket.on('error', (e: { message: string }) => {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      });

      socket.on('state:lobby', (state: LobbyState) => {
        setLobby(state);
        if (state.status === 'LOBBY' && phase === 'connecting') setPhase('lobby');
      });

      socket.on('state:question', (q: QuestionState) => {
        setQuestion(q);
        setPhase('question');
      });

      socket.on('state:leaderboard', (board: LeaderboardEntry[]) => {
        setLeaderboard(board);
      });

      socket.on('state:finished', () => setPhase('finished'));

      /**
       * All players have answered this question. Backend signals this so
       * the host doesn't have to sit through the rest of the timer. We
       * mark the auto-advance ref (same one the timer-expiry effect uses)
       * and fire host:next after a short grace so the room sees the
       * 100%-answered moment before the slide flips.
       */
      socket.on('state:question-complete', (payload: { questionId: string }) => {
        // Defensive: ignore stale events for a question we've already left.
        if (autoAdvancedRef.current) return;
        autoAdvancedRef.current = true;
        setTimeout(() => {
          socketRef.current?.emit('host:next', { sessionId });
        }, 1200);
      });

      socket.emit('join', { sessionId }, (ack: { isHost?: boolean }) => {
        if (!ack?.isHost) {
          toast({ title: 'Not the host of this session', variant: 'destructive' });
          router.push('/dashboard');
        }
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Question timer for host display
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

  /**
   * Auto-advance when the timer expires. Old behaviour: host had to
   * remember to click "Next question" once the 30-second timer hit 0,
   * causing an awkward dead-air pause every round. Now we fire
   * `host:next` automatically after a 1-second grace so:
   *   - late-arriving answers (network latency) still get counted;
   *   - the room sees "0s — Time's up!" briefly before the next slide.
   *
   * Single-fire guard via `autoAdvancedRef`: even if React re-renders
   * (which re-triggers the effect), we only emit `host:next` once per
   * question. The ref resets on every new question payload, when the
   * host manually clicks Next, or on phase changes.
   */
  useEffect(() => {
    // Reset the guard whenever we land on a new question — without this,
    // a manual Next or auto-advance would block all subsequent rounds.
    autoAdvancedRef.current = false;
  }, [question?.id]);

  useEffect(() => {
    if (phase !== 'question' || !question) return;
    if (timeLeft > 0 || autoAdvancedRef.current || busy) return;
    autoAdvancedRef.current = true;
    const t = setTimeout(() => {
      socketRef.current?.emit('host:next', { sessionId });
    }, 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase, question, busy, sessionId]);

  const handleStart = () => {
    if (!socketRef.current) return;
    setBusy(true);
    socketRef.current.emit('host:start', { sessionId }, (ack: { ok?: boolean }) => {
      setBusy(false);
      if (!ack?.ok) toast({ title: 'Could not start', variant: 'destructive' });
    });
  };

  const handleNext = () => {
    if (!socketRef.current) return;
    setBusy(true);
    socketRef.current.emit('host:next', { sessionId }, () => setBusy(false));
  };

  const handleFinish = () => {
    if (!confirm('End the game now? Scores so far will be saved.')) return;
    socketRef.current?.emit('host:finish', { sessionId });
  };

  if (phase === 'connecting' || !lobby) {
    return (
      <div className="flex items-center justify-center mt-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-500)]" />
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="max-w-4xl mx-auto mt-6 space-y-6">
        <div className="text-center space-y-2">
          <Eyebrow>Hosting</Eyebrow>
          <p className="text-[15px] text-[var(--fg-muted)]">{lobby.quizTitle}</p>
        </div>

        <Card
          padding="lg"
          className="text-center bg-gradient-to-br from-[var(--accent-50)] to-[var(--accent-100)] dark:from-[var(--accent-50)] dark:to-[var(--bg-subtle)]"
        >
          <p className="text-[13px] uppercase tracking-wider text-[var(--fg-muted)] font-mono">
            Join at — open <strong>UniLMS / Join live quiz</strong>
          </p>
          <p
            className="font-serif text-[88px] sm:text-[120px] leading-none tracking-[0.04em] font-bold text-[var(--accent-700)] mt-2"
            style={{ letterSpacing: '0.05em' }}
          >
            {lobby.joinCode}
          </p>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--fg-muted)]">
            <Users className="h-4 w-4" />
            <span className="font-medium">
              {lobby.players.length} player{lobby.players.length === 1 ? '' : 's'} in lobby
            </span>
          </div>
          <Button variant="primary" size="lg" onClick={handleStart} disabled={busy || lobby.players.length === 0}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Start game
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {lobby.players.length === 0 ? (
            <p className="text-[14px] text-[var(--fg-muted)] italic mx-auto">
              Waiting for players to join with the code above…
            </p>
          ) : (
            lobby.players.map((p) => (
              <span
                key={p.userId}
                className="px-3 py-1.5 rounded-full text-[14px] border border-[var(--border-color)] bg-[var(--surface)] font-medium"
              >
                {p.fullName}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  if (phase === 'question' && question) {
    const lastQuestion = question.index + 1 >= question.total;
    return (
      <div className="max-w-5xl mx-auto mt-4 space-y-5">
        <div className="flex items-center justify-between">
          <Eyebrow>
            Question {question.index + 1} of {question.total}
          </Eyebrow>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'font-mono text-3xl font-bold tabular-nums',
                timeLeft <= 5 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--fg)]',
              )}
            >
              {timeLeft}s
            </div>
            <Button variant="ghost" size="sm" onClick={handleFinish}>
              <X className="h-3.5 w-3.5" />
              End game
            </Button>
          </div>
        </div>

        <Card padding="lg">
          <h1 className="font-serif text-3xl leading-tight text-[var(--fg)]">{question.question}</h1>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((opt, i) => (
            <div
              key={i}
              className={cn(
                'rounded-xl text-white font-semibold p-5 shadow-md',
                OPTION_COLORS[i % OPTION_COLORS.length],
              )}
            >
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-full bg-white/25 flex items-center justify-center text-base font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 text-lg">{opt}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Card padding="sm" className="flex-1">
            <Eyebrow>Live leaderboard</Eyebrow>
            <ol className="mt-2 space-y-1">
              {leaderboard.slice(0, 5).map((p) => (
                <li key={p.userId} className="flex items-center justify-between text-sm px-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--fg-muted)] w-5 text-right">#{p.rank}</span>
                    {p.fullName}
                  </span>
                  <span className="font-mono font-semibold">{p.score}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Button variant="primary" size="lg" onClick={handleNext} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
            {lastQuestion ? 'Finish game' : 'Next question'}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="max-w-2xl mx-auto mt-12 space-y-6 text-center">
        <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
        <HDisplay size="md" as="h1">
          Game <em>over</em>
        </HDisplay>
        <Card padding="md" className="text-left">
          <Eyebrow>Final standings</Eyebrow>
          <ol className="mt-3 space-y-1.5">
            {leaderboard.map((p) => (
              <li key={p.userId} className="flex items-center justify-between px-2 py-1.5 rounded-md">
                <span className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-[var(--fg-muted)] w-6 text-right">#{p.rank}</span>
                  <span>{p.fullName}</span>
                </span>
                <span className="font-mono font-semibold">{p.score}</span>
              </li>
            ))}
          </ol>
        </Card>
        <div className="flex items-center justify-center gap-2">
          <Button variant="primary" onClick={() => router.push(`/kahoot/host/${sessionId}/report`)}>
            <BarChart3 className="h-3.5 w-3.5" />
            View detailed report
          </Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
