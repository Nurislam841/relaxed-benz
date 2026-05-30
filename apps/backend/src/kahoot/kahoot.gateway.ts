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

  /**
   * Public hook so the Telegram `/join` path can refresh the host's lobby the
   * instant a bot user joins (the bot is not a WebSocket client, so it can't
   * trigger the normal onJoin → emitLobby flow itself).
   */
  async refreshLobby(sessionId: string) {
    if (!this.server) return;
    await this.emitLobby(sessionId);
  }

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

    // Per-question override takes precedence; fall back to quiz default (30s if unset).
    // This lets teachers give a quick-recall question 10s while a multi-step
    // problem gets 60s in the same quiz.
    const secondsPerQuestion = question.secondsPerQuestion ?? quiz?.secondsPerQuestion ?? 30;
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
      // Fire-and-forget the Telegram fan-out so a Telegram outage or
      // a slow `sendMessage` call doesn't block the host:next ACK and
      // leave the teacher's screen spinning. The host page already
      // got state:finished above; TG delivery is best-effort UX.
      this.notifyTelegramFinished(data.sessionId).catch((e) =>
        this.logger.warn(`TG end-of-game fanout failed for ${data.sessionId}: ${e?.message ?? e}`),
      );
    } else {
      await this.emitCurrentQuestion(data.sessionId);
      await this.emitLeaderboard(data.sessionId);
    }
    return { ok: true };
  }

  /**
   * End-of-game Telegram fan-out (Feature #4 widened).
   *
   * Old behaviour: only students who joined via `/join CODE` in the
   * Telegram bot got a final message — the `KahootTelegramSubscription`
   * table is created on that path. Students who joined via web with a
   * linked Telegram account got nothing, which surprised everyone.
   *
   * New behaviour: send to every distinct player who has a linked
   * `telegramChatId`, regardless of how they joined. We union the
   * /join-ed subscribers with the played-via-web set so each linked
   * student gets exactly one personalised message with their rank +
   * the My-Results deep link.
   */
  private async notifyTelegramFinished(sessionId: string) {
    if (!this.telegram?.isEnabled) return;
    const [subs, attempts, board] = await Promise.all([
      this.db.kahootTelegramSubscription.findMany({ where: { sessionId } }),
      this.db.quizAttempt.findMany({
        where: { sessionId },
        include: { student: { select: { id: true, telegramChatId: true } } },
      }),
      this.kahootSvc.leaderboard(sessionId),
    ]);

    // Dedupe by chatId — same user from both /join and the play
    // attempt table should not get two messages.
    const recipients = new Map<string, { chatId: string; userId: string }>();
    for (const sub of subs) {
      recipients.set(sub.chatId, { chatId: sub.chatId, userId: sub.userId });
    }
    for (const a of attempts) {
      const cid = a.student?.telegramChatId;
      if (cid && !recipients.has(cid)) {
        recipients.set(cid, { chatId: cid, userId: a.student.id });
      }
    }
    if (recipients.size === 0) return;

    const baseUrl = getUserFacingBaseUrl();
    for (const r of recipients.values()) {
      const me = board.find((b: any) => b.userId === r.userId);
      const text = me
        ? `🏁 *Game over!*\n\nYour rank: *#${me.rank}* with *${me.score}* points.\n\nTop 3:\n${board
            .slice(0, 3)
            .map((b: any, i: number) => `${i + 1}\\. ${b.fullName} — ${b.score}`)
            .join('\n')}`
        : '🏁 *Game over!*';
      // Four buttons:
      //   1. View results — student-facing web page (per-Q review).
      //   2. Get AI plan — short strengths/gaps/nextStep summary.
      //   3. Personalized study guide — long focused guide with
      //      lecture excerpts + why-wrong + why-right + examples.
      //      Auto-falls-back to AI-generated mini-lesson if the quiz
      //      has no uploaded material.
      //   4. Full material — raw PDF/DOCX file (only useful for
      //      students who want the entire lecture, not just the
      //      relevant excerpts).
      //
      // URL button is dropped on http://localhost dev (TG refuses
      // non-https). callback_data buttons always work.
      const myUrl = baseUrl ? `${baseUrl}/kahoot/me/${sessionId}/results` : '';
      const buttons: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
      if (isTelegramSafeUrl(myUrl)) {
        buttons.push([{ text: '📊 View my results', url: myUrl }]);
      }
      buttons.push([{ text: '🧠 Get my AI plan', callback_data: `kahplan:${sessionId}` }]);
      buttons.push([{ text: '📖 Personalized study guide', callback_data: `kahguide:${sessionId}` }]);
      buttons.push([{ text: '📚 Full material (raw file)', callback_data: `kahmat:${sessionId}` }]);
      try {
        await this.telegram.sendMessageWithButtons(r.chatId, text, buttons);
      } catch (e: any) {
        // One bad recipient (e.g. blocked the bot) shouldn't drop the
        // rest of the room's notifications.
        this.logger.warn(`TG end-of-game send failed for chat ${r.chatId}: ${e?.message ?? e}`);
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

    // Auto-advance signal: if every joined attempt has answered the
    // current question, broadcast `state:question-complete`. The host
    // page listens and fires host:next after a short grace, so the
    // class doesn't sit through the remaining timer when everyone is
    // already done. The "expected count" is the number of attempts in
    // this session — anyone who joined the lobby gets an attempt row,
    // so leavers and AFK players are still part of the denominator
    // (otherwise a single early answer would jump the round).
    const [attemptCount, answerCount] = await Promise.all([
      this.db.quizAttempt.count({ where: { sessionId: data.sessionId } }),
      this.db.quizAttemptAnswer.count({
        where: { questionId: data.questionId, attempt: { sessionId: data.sessionId } },
      }),
    ]);
    if (attemptCount > 0 && answerCount >= attemptCount) {
      this.server.to(this.room(data.sessionId)).emit('state:question-complete', { questionId: data.questionId });
    }

    return result;
  }

  // ── Host: finish early ────────────────────────────────────────────────

  @SubscribeMessage('host:finish')
  async onHostFinish(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
    const user = this.getUser(client);
    await this.kahootSvc.finish(data.sessionId, user);
    this.server.to(this.room(data.sessionId)).emit('state:finished', null);
    await this.emitLeaderboard(data.sessionId);
    // Manual end-game button — same end-of-game UX as auto-finish on
    // the last question, so linked students get their TG notification
    // regardless of how the host wrapped up. Fire-and-forget so a
    // Telegram outage doesn't block the host:finish ACK.
    this.notifyTelegramFinished(data.sessionId).catch((e) =>
      this.logger.warn(`TG end-of-game fanout failed for ${data.sessionId}: ${e?.message ?? e}`),
    );
    return { ok: true };
  }
}
