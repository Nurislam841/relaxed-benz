import { Logger, UseFilters, Optional } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { KahootService } from './kahoot.service';
import { TelegramService } from '../telegram/telegram.service';
import { getUserFacingBaseUrl, isTelegramSafeUrl } from '../common/public-url';
import { QuizSessionStatus, Role } from '@prisma/client';

interface SocketUser {
  id: string;
  role: Role;
  fullName: string;
}

/**
 * Real-time Kahoot gateway.
 *
 * Wire model:
 *   - Each `QuizSession` row is a socket.io room keyed by `sess:${sessionId}`.
 *   - Host and players join the same room; the host is identified by
 *     `session.hostId === socket.user.id`.
 *
 * Auth model:
 *   - Token is read from the `auth` handshake payload OR the `access_token`
 *     cookie (Next.js dev proxy forwards cookies, prod has the same origin).
 *   - We verify the same JWT secret the REST controllers use.
 *   - Anonymous sockets are immediately disconnected — no anonymous play.
 *
 * Event design:
 *   - We DO NOT push the correctIndex to players until the host advances.
 *     The reveal step is the only time players see what the right answer was.
 *   - Score updates use `socket.emit` for the per-player feedback and a
 *     room-wide `state:leaderboard` for the spectator board the host shows.
 *
 * What is intentionally NOT here:
 *   - Reconnect / token refresh handling — sockets are short-lived during
 *     a quiz; a disconnect = the player is out for the rest of that session.
 *   - Server-side question timer enforcement. The timer runs on the host
 *     screen and the host clicks "Next"; this avoids the complexity of
 *     server-driven time and works fine for a teacher-facilitated demo.
 */
@WebSocketGateway({
  namespace: '/kahoot',
  cors: { origin: true, credentials: true },
})
export class KahootGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(KahootGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(
    private jwt: JwtService,
    private db: PrismaService,
    private kahootSvc: KahootService,
    /**
     * Optional Telegram fan-out — when the bot is configured, students who
     * `/join`ed via Telegram (Phase 2.2) get every question as a native quiz
     * poll. Tests that don't load TelegramModule still construct the gateway.
     */
    @Optional() private telegram?: TelegramService,
  ) {}

  // ── Connection lifecycle ──────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticate(client);
      (client.data as { user: SocketUser }).user = user;
      this.logger.log(`socket connected: ${client.id} (user=${user.id})`);
    } catch (e: any) {
      this.logger.warn(`socket auth failed: ${client.id} (${e.message})`);
      client.emit('error', { message: 'Authentication required' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client.data as any).user as SocketUser | undefined;
    this.logger.log(`socket disconnected: ${client.id} (user=${user?.id ?? 'unknown'})`);
  }

  private async authenticate(client: Socket): Promise<SocketUser> {
    // Try handshake auth first (preferred for explicit clients)
    let token: string | undefined =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.headers.authorization?.startsWith('Bearer ')
        ? client.handshake.headers.authorization.slice(7)
        : undefined);

    // Fall back to access_token cookie
    if (!token) {
      const cookieHeader = client.handshake.headers.cookie ?? '';
      const match = cookieHeader.match(/access_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }

    if (!token) throw new Error('no token');

    const payload = this.jwt.verify(token, {
      secret: process.env.JWT_SECRET || 'change-me-super-secret-jwt-key-at-least-32-chars',
    });
    if (!payload?.sub) throw new Error('bad payload');

    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, fullName: true },
    });
    if (!user) throw new Error('user not found');
    return user;
  }

  private getUser(client: Socket): SocketUser {
    const user = (client.data as any).user as SocketUser | undefined;
    if (!user) throw new WsException('Not authenticated');
    return user;
  }

  private room(sessionId: string) {
    return `sess:${sessionId}`;
  }

  // ── Public lobby state — sent on every join/leave/start ───────────────

  private async emitLobby(sessionId: string) {
    const session = await this.db.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: { include: { _count: { select: { questions: true } } } },
        host: { select: { fullName: true } },
        attempts: {
          select: { student: { select: { id: true, fullName: true } }, score: true },
          orderBy: { score: 'desc' },
        },
      },
    });
    if (!session) return;

    this.server.to(this.room(sessionId)).emit('state:lobby', {
      sessionId: session.id,
      joinCode: session.joinCode,
      status: session.status,
      currentIndex: session.currentIndex,
      quizTitle: session.quiz.title,
      hostName: session.host.fullName,
      totalQuestions: session.quiz._count.questions,
      secondsPerQuestion: session.quiz.secondsPerQuestion,
      players: session.attempts.map((a) => ({
        userId: a.student.id,
        fullName: a.student.fullName,
        score: a.score,
      })),
    });
  }

  // ── Question payload (without correctIndex) ───────────────────────────

  private async emitCurrentQuestion(sessionId: string) {
    const session = await this.db.quizSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== QuizSessionStatus.IN_PROGRESS) return;

    const question = await this.db.quizQuestion.findFirst({
      where: { quizId: session.quizId, position: session.currentIndex },
    });
    if (!question) return;

    const total = await this.db.quizQuestion.count({ where: { quizId: session.quizId } });
    const quiz = await this.db.quiz.findUnique({
      where: { id: session.quizId },
      select: { secondsPerQuestion: true },
    });

    const secondsPerQuestion = quiz?.secondsPerQuestion ?? 30;
    this.server.to(this.room(sessionId)).emit('state:question', {
      id: question.id,
      index: session.currentIndex,
      total,
      question: question.question,
      options: question.options,
      points: question.points,
      deadline: Date.now() + secondsPerQuestion * 1000,
      secondsPerQuestion,
    });

    // Telegram bridge (Phase 2.2): if any students joined via `/join CODE`,
    // mirror the question to their Telegram chat as a native quiz poll. The
    // `open_period` makes Telegram auto-close the poll when time's up, so
    // even if the WebSocket player misses the moment the TG view stays
    // synced. poll_answer events come back via TelegramUpdatesService.
    if (this.telegram?.isEnabled) {
      this.fireTelegramPolls(
        sessionId,
        question.id,
        question.question,
        question.options as string[],
        question.correctIndex,
        question.explanation,
        secondsPerQuestion,
      ).catch((e) => this.logger.warn(`TG poll fan-out failed for session ${sessionId}: ${e?.message ?? e}`));
    }
  }

  /**
   * Send the current question as a native Telegram poll to every linked
   * subscriber for this session. Runs in the background — we don't want a
   * Telegram outage to stall the live WebSocket gameplay.
   */
  private async fireTelegramPolls(
    sessionId: string,
    questionId: string,
    question: string,
    options: string[],
    correctIndex: number,
    explanation: string | null,
    secondsPerQuestion: number,
  ) {
    if (!this.telegram) return;
    const subs = await this.db.kahootTelegramSubscription.findMany({ where: { sessionId } });
    for (const sub of subs) {
      const pollId = await this.telegram.sendQuizPoll(sub.chatId, question, options.slice(0, 10), correctIndex, {
        explanation: explanation || undefined,
        openPeriodSeconds: secondsPerQuestion,
        isAnonymous: false,
      });
      if (pollId) {
        await this.db.kahootTelegramPoll
          .create({
            data: {
              pollId,
              sessionId,
              questionId,
              chatId: sub.chatId,
              openPeriodSeconds: secondsPerQuestion,
            },
          })
          .catch(() => undefined);
      }
    }
  }

  private async emitLeaderboard(sessionId: string) {
    const board = await this.kahootSvc.leaderboard(sessionId);
    this.server.to(this.room(sessionId)).emit('state:leaderboard', board);
  }

  // ── Player joins by sessionId ────────────────────────────────────────

  @SubscribeMessage('join')
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
    const user = this.getUser(client);
    if (!data?.sessionId) throw new WsException('sessionId required');

    const session = await this.db.quizSession.findUnique({
      where: { id: data.sessionId },
    });
    if (!session) throw new WsException('Session not found');
    if (session.status === QuizSessionStatus.CANCELLED) {
      throw new WsException('Session was cancelled');
    }

    await client.join(this.room(session.id));

    // Players (not host) get an attempt row so they appear on the leaderboard
    // even before answering anything. Host doesn't get an attempt.
    if (session.hostId !== user.id) {
      const existing = await this.db.quizAttempt.findFirst({
        where: { sessionId: session.id, studentId: user.id },
      });
      if (!existing) {
        await this.db.quizAttempt.create({
          data: { quizId: session.quizId, studentId: user.id, sessionId: session.id },
        });
      }
    }

    await this.emitLobby(session.id);

    // If joining mid-game, also push the current question so they can play along
    if (session.status === QuizSessionStatus.IN_PROGRESS) {
      await this.emitCurrentQuestion(session.id);
    }

    return { ok: true, isHost: session.hostId === user.id };
  }

  // ── Host: start the game ──────────────────────────────────────────────

  @SubscribeMessage('host:start')
  async onHostStart(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
    const user = this.getUser(client);
    await this.kahootSvc.start(data.sessionId, user);
    await this.emitLobby(data.sessionId);
    await this.emitCurrentQuestion(data.sessionId);
    return { ok: true };
  }

  // ── Host: next question (or finish if last) ───────────────────────────

  @SubscribeMessage('host:next')
  async onHostNext(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
    const user = this.getUser(client);
    const result = await this.kahootSvc.next(data.sessionId, user);
    if (result.status === QuizSessionStatus.FINISHED) {
      this.server.to(this.room(data.sessionId)).emit('state:finished', null);
      await this.emitLeaderboard(data.sessionId);
      await this.notifyTelegramFinished(data.sessionId);
    } else {
      await this.emitCurrentQuestion(data.sessionId);
      await this.emitLeaderboard(data.sessionId);
    }
    return { ok: true };
  }

  /**
   * Tell every Telegram subscriber that the game is over and send their
   * personal rank + final score. We also offer a button to view the
   * detailed post-session report.
   */
  private async notifyTelegramFinished(sessionId: string) {
    if (!this.telegram?.isEnabled) return;
    const [subs, board] = await Promise.all([
      this.db.kahootTelegramSubscription.findMany({ where: { sessionId } }),
      this.kahootSvc.leaderboard(sessionId),
    ]);
    if (subs.length === 0) return;
    const baseUrl = getUserFacingBaseUrl();
    for (const sub of subs) {
      const me = board.find((b: any) => b.userId === sub.userId);
      const text = me
        ? `🏁 *Game over!*\n\nYour rank: *#${me.rank}* with *${me.score}* points.\n\nTop 3:\n${board
            .slice(0, 3)
            .map((b: any, i: number) => `${i + 1}\\. ${b.fullName} — ${b.score}`)
            .join('\n')}`
        : '🏁 *Game over!*';
      const reportUrl = baseUrl ? `${baseUrl}/kahoot/host/${sessionId}/report` : '';
      if (isTelegramSafeUrl(reportUrl)) {
        await this.telegram.sendMessageWithButtons(sub.chatId, text, [
          [{ text: '📊 Detailed report', url: reportUrl }],
        ]);
      } else {
        // Local dev with http://localhost — Telegram rejects the URL.
        // Just send the text message without the button.
        await this.telegram.sendMessage(sub.chatId, text);
      }
    }
  }

  // ── Player: submit answer to the current question ─────────────────────

  @SubscribeMessage('answer')
  async onAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; questionId: string; pickedIndex: number; responseTimeMs: number },
  ) {
    const user = this.getUser(client);
    const result = await this.kahootSvc.answer(
      data.sessionId,
      { questionId: data.questionId, pickedIndex: data.pickedIndex, responseTimeMs: data.responseTimeMs },
      user,
    );
    // Private feedback to the player who answered
    client.emit('answer:result', result);
    // Public leaderboard refresh
    await this.emitLeaderboard(data.sessionId);
    return result;
  }

  // ── Host: finish early ────────────────────────────────────────────────

  @SubscribeMessage('host:finish')
  async onHostFinish(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
    const user = this.getUser(client);
    await this.kahootSvc.finish(data.sessionId, user);
    this.server.to(this.room(data.sessionId)).emit('state:finished', null);
    await this.emitLeaderboard(data.sessionId);
    return { ok: true };
  }
}
