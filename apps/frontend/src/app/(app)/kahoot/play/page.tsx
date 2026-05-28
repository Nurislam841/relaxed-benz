'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Loader2, Users, CheckCircle2, XCircle, Trophy, Volume2, VolumeX, Sparkles } from 'lucide-react';
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
import { sounds } from '@/lib/kahoot-sounds';
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
  const [phase, setPhase] = useState<'enter-code' | 'lobby' | 'question' | 'finished'>('enter-code');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [question, setQuestion] = useState<QuestionState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
    // correctIndex + explanation drive the instant green/red reveal on
    // the question screen after the student answers.
    correctIndex?: number;
    explanation?: string;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  // Mute toggle reflected in the top-right of the play view. Persists in
  // localStorage via sounds.setMuted() so a student who hates the music
  // doesn't have to mute it every game.
  const [muted, setMuted] = useState<boolean>(sounds.isMuted());

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

  /**
   * Background music while the game is in progress. We only start when a
   * new question arrives (a real user gesture — the prior "Join" click —
   * has already unlocked the AudioContext) and stop on reveal/finished
   * to give the win/lose SFX clear airtime.
   */
  useEffect(() => {
    if (phase === 'question') sounds.startBackground();
    else sounds.stopBackground();
  }, [phase]);

  // ── Socket lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      sounds.stopBackground();
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
      const socket = await createKahootSocket();
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
        // Just update the board — we DON'T flip to a separate 'reveal'
        // phase anymore. The student stays on the question screen so
        // the green/red answer reveal + explanation stay visible until
        // the host advances (which sends a fresh state:question and
        // resets pickedIndex). A compact leaderboard is shown inline.
        setLeaderboard(board);
      });

      socket.on('state:finished', () => {
        setPhase('finished');
        // Triumphant fanfare when the game ends — same on every player's
        // screen so the room hears the end together. Background loop is
        // stopped by the phase-watcher useEffect.
        sounds.playGameOver();
      });

      socket.on(
        'answer:result',
        (r: { isCorrect: boolean; pointsEarned: number; correctIndex?: number; explanation?: string }) => {
          setLastResult(r);
          // SFX feedback (Feature: game bells). Win = bright C-major
          // arpeggio, Lose = short descending minor. Muted users hear
          // nothing — the SFX call is a silent no-op when muted=true.
          if (r.isCorrect) sounds.playWin();
          else sounds.playLose();
        },
      );

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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                sounds.setMuted(next);
                if (!next && phase === 'question') sounds.startBackground();
              }}
              className="rounded-md p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors"
              title={muted ? 'Unmute sounds' : 'Mute sounds'}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
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
        </div>

        <Card padding="lg">
          <h2 className="font-serif text-[22px] leading-tight">{question.question}</h2>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((opt, i) => {
            // Reveal state — only once answer:result arrived with a
            // correctIndex. Until then we just dim the non-picked tiles.
            const revealed = lastResult?.correctIndex !== undefined;
            const isCorrectOpt = revealed && i === lastResult!.correctIndex;
            const isWrongPick = revealed && i === pickedIndex && i !== lastResult!.correctIndex;
            return (
              <button
                key={i}
                type="button"
                onClick={() => submitAnswer(i)}
                disabled={pickedIndex != null}
                className={cn(
                  'rounded-xl text-white font-semibold text-left p-5 transition-all shadow-md',
                  OPTION_COLORS[i % OPTION_COLORS.length],
                  // Pre-reveal: white ring on pick, dim the rest.
                  !revealed && pickedIndex === i && 'ring-4 ring-white/40',
                  !revealed && pickedIndex != null && pickedIndex !== i && 'opacity-40',
                  // Post-reveal: green ring on the correct option, red
                  // ring on the student's wrong pick, dim everything else.
                  isCorrectOpt && 'ring-4 ring-emerald-300',
                  isWrongPick && 'ring-4 ring-rose-300',
                  revealed && !isCorrectOpt && !isWrongPick && 'opacity-40',
                  pickedIndex == null && 'hover:scale-[1.02] active:scale-100',
                  pickedIndex != null && 'cursor-not-allowed',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center text-sm font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {isCorrectOpt && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                  {isWrongPick && <XCircle className="h-5 w-5 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Instant feedback line + explanation, shown the moment the
            answer:result event lands — same educational reveal the
            self-study mode gives. */}
        {lastResult && (
          <div className="space-y-2">
            <p
              className={cn(
                'text-center text-[14px] font-semibold',
                lastResult.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {lastResult.isCorrect ? `✓ Correct! +${lastResult.pointsEarned}` : '✗ Not this time'}
            </p>
            {lastResult.explanation && (
              <Card padding="md" className="bg-[var(--surface-subtle)]">
                <Eyebrow>Explanation</Eyebrow>
                <p className="text-[13px] mt-1 text-[var(--fg)]">{lastResult.explanation}</p>
              </Card>
            )}
            {/* Compact live leaderboard so the student still sees the
                competitive standing without leaving the reveal. */}
            {leaderboard.length > 0 && (
              <Card padding="sm">
                <Eyebrow>Leaderboard</Eyebrow>
                <ol className="mt-2 space-y-1">
                  {leaderboard.slice(0, 5).map((p) => (
                    <li
                      key={p.userId}
                      className={cn(
                        'flex items-center justify-between text-[13px] px-2 py-1 rounded-md',
                        p.userId === user?.id && 'bg-[var(--accent-100)]',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[var(--fg-muted)] w-5 text-right">#{p.rank}</span>
                        <span className={p.userId === user?.id ? 'font-semibold' : ''}>{p.fullName}</span>
                      </span>
                      <span className="font-mono font-semibold">{p.score}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
            <p className="text-center text-[12px] text-[var(--fg-muted)]">Waiting for the host to advance…</p>
          </div>
        )}
        {pickedIndex != null && !lastResult && (
          <p className="text-center text-[13px] text-[var(--fg-muted)]">Answer locked in…</p>
        )}
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
        <div className="flex flex-col gap-2">
          {/* Feature #4: deep-link into the student-facing results page
              with the per-question review + AI plan button. */}
          {lobby?.sessionId && (
            <Button variant="ai" onClick={() => router.push(`/kahoot/me/${lobby.sessionId}/results`)}>
              <Sparkles className="h-3.5 w-3.5" />
              View detailed results + AI plan
            </Button>
          )}
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
