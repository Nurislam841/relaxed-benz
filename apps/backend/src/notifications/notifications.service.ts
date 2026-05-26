import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { getUserFacingBaseUrl, isTelegramSafeUrl } from '../common/public-url';

type NotificationListener = (event: { type: 'refresh'; unreadCount: number }) => void;

@Injectable()
export class NotificationsService {
  private listeners = new Map<string, Set<NotificationListener>>();

  constructor(
    private db: PrismaService,
    private telegram: TelegramService,
  ) {}
  findForUser(uid: string) {
    return this.db.notification.findMany({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  subscribe(uid: string, listener: NotificationListener) {
    const current = this.listeners.get(uid) ?? new Set<NotificationListener>();
    current.add(listener);
    this.listeners.set(uid, current);

    return () => {
      const next = this.listeners.get(uid);
      if (!next) return;
      next.delete(listener);
      if (next.size === 0) this.listeners.delete(uid);
    };
  }

  async create(data: Prisma.NotificationUncheckedCreateInput & { type: NotificationType }) {
    const notification = await this.db.notification.create({ data });
    await this.emitRefresh(notification.userId);
    this.fanOutToTelegram(
      notification.userId,
      notification.id,
      notification.type,
      notification.title ?? '',
      notification.body ?? '',
      notification.link,
    );
    return notification;
  }

  /**
   * Broadcast a single message into any Telegram group chats bound to the
   * given course (Phase 4.2). Called separately by AnnouncementsService when
   * an announcement targets a course — avoids spamming each linked student
   * individually AND posting in the class group.
   *
   * Failure here is silent (group might have removed the bot, etc.) — the
   * per-user DM fan-out from `create()` is the primary delivery path.
   */
  async broadcastToCourseGroup(courseId: string, title: string, body: string, link: string | null) {
    if (!this.telegram.isEnabled) return;
    try {
      const group = await this.db.courseTelegramGroup.findUnique({ where: { courseId } });
      if (!group) return;
      const baseUrl = getUserFacingBaseUrl();
      const rawAbsolute =
        link && !link.startsWith('http') && baseUrl
          ? `${baseUrl.replace(/\/$/, '')}${link.startsWith('/') ? link : '/' + link}`
          : link;
      const absoluteLink = isTelegramSafeUrl(rawAbsolute) ? rawAbsolute : null;
      const buttons = absoluteLink ? [[{ text: '🔗 Open in UniLMS', url: absoluteLink }]] : [];
      const text = `📢 *${title}*\n\n${body}`;
      if (buttons.length > 0) {
        await this.telegram.sendMessageWithButtons(group.chatId, text, buttons);
      } else {
        await this.telegram.sendMessage(group.chatId, text);
      }
    } catch {
      // best-effort
    }
  }

  async createMany(data: Array<Prisma.NotificationCreateManyInput & { type: NotificationType }>) {
    if (!data.length) return { count: 0 };
    const result = await this.db.notification.createMany({ data });
    const affectedUsers = [...new Set(data.map((item) => item.userId))];
    await Promise.all(affectedUsers.map((uid) => this.emitRefresh(uid)));
    // For batch notifications, fan-out only the per-user count so we don't
    // spam a user with N messages from a single grading session.
    for (const uid of affectedUsers) {
      const userItems = data.filter((d) => d.userId === uid);
      if (userItems.length === 1) {
        const item = userItems[0];
        // Single-item batch: we don't have the persisted notification id at
        // hand (createMany doesn't return rows). Pass null — the "mark read"
        // button is just omitted from the buttons row in that case.
        this.fanOutToTelegram(uid, null, item.type, item.title ?? '', item.body ?? '', item.link ?? null);
      } else {
        this.fanOutToTelegram(
          uid,
          null,
          NotificationType.SYSTEM,
          `${userItems.length} new updates`,
          userItems
            .map((i) => `• ${i.title ?? ''}`)
            .join('\n')
            .slice(0, 800),
          null,
        );
      }
    }
    return result;
  }

  async markRead(id: string, uid: string) {
    await this.db.notification.updateMany({ where: { id, userId: uid }, data: { isRead: true } });
    await this.emitRefresh(uid);
    return { ok: true };
  }

  async markAllRead(uid: string) {
    await this.db.notification.updateMany({ where: { userId: uid, isRead: false }, data: { isRead: true } });
    await this.emitRefresh(uid);
    return { ok: true };
  }

  getUnreadCount(uid: string) {
    return this.db.notification.count({ where: { userId: uid, isRead: false } });
  }

  private async emitRefresh(uid: string) {
    const unreadCount = await this.getUnreadCount(uid);
    for (const listener of this.listeners.get(uid) ?? []) {
      listener({ type: 'refresh', unreadCount });
    }
  }

  /**
   * Fan out an in-app notification to the user's linked Telegram chat —
   * with inline buttons appropriate for the notification type. Fire-and-forget:
   * never throws, never blocks the caller, so a Telegram outage cannot delay
   * grading / submission / quiz flows.
   *
   * Notification type → button matrix:
   *   ASSIGNMENT_DUE     → "📝 Open" (web link) + "✅ Mark read"
   *   GRADE_PUBLISHED    → "📊 View" (web link) + "🤖 Ask AI"
   *   ANNOUNCEMENT       → "🔗 Open" (web link) + group-chat broadcast (Phase 4.2)
   *   SYSTEM / batch     → bare text (no buttons)
   *
   * When a CourseTelegramGroup is bound for an ANNOUNCEMENT's course, the
   * message ALSO posts in the group chat so course-wide news lands where the
   * class already chats — no need for every student to be individually linked.
   */
  private fanOutToTelegram(
    userId: string,
    notificationId: string | null,
    type: NotificationType,
    title: string,
    body: string,
    link: string | null,
  ) {
    (async () => {
      if (!this.telegram.isEnabled) return;
      try {
        const user = await this.db.user.findUnique({
          where: { id: userId },
          select: { telegramChatId: true },
        });
        if (!user?.telegramChatId) return;

        const text = `*${title}*\n\n${body}`;
        const buttons = this.buildButtonsFor(type, notificationId, link);

        if (buttons.length > 0) {
          await this.telegram.sendMessageWithButtons(user.telegramChatId, text, buttons);
        } else {
          const linkLine = link ? `\n\nOpen in UniLMS: ${link}` : '';
          await this.telegram.sendMessage(user.telegramChatId, text + linkLine);
        }
      } catch {
        // Swallow — Telegram is best-effort. Service logs its own warnings.
      }
    })();
  }

  /**
   * Map a NotificationType + optional persisted-id + optional in-app link
   * into the right inline-button matrix. Keeping this pure makes it easy to
   * unit-test (no DB) and to extend when new notification types are added.
   *
   * The web link is converted to an absolute URL using BACKEND_PUBLIC_URL
   * (or FRONTEND_URL) — Telegram inline-URL buttons reject relative paths.
   */
  private buildButtonsFor(
    type: NotificationType,
    notificationId: string | null,
    link: string | null,
  ): Array<Array<{ text: string; url?: string; callback_data?: string }>> {
    const baseUrl = getUserFacingBaseUrl();
    const rawAbsolute =
      link && !link.startsWith('http') && baseUrl ? `${baseUrl}${link.startsWith('/') ? link : '/' + link}` : link;
    // Telegram only allows https in inline button URLs. If the deployment
    // target is local (http://localhost) we skip the URL — text-only message.
    const absoluteLink = isTelegramSafeUrl(rawAbsolute) ? rawAbsolute : null;

    switch (type) {
      case NotificationType.ASSIGNMENT_DUE: {
        const row: Array<{ text: string; url?: string; callback_data?: string }> = [];
        if (absoluteLink) row.push({ text: '📝 Open', url: absoluteLink });
        if (notificationId) row.push({ text: '✅ Mark read', callback_data: `markread:${notificationId}` });
        return row.length > 0 ? [row] : [];
      }
      case NotificationType.GRADE_PUBLISHED: {
        const row: Array<{ text: string; url?: string; callback_data?: string }> = [];
        if (absoluteLink) row.push({ text: '📊 View', url: absoluteLink });
        // submissionId is embedded as the last path segment of the link when
        // the grade notification was created — best-effort callback wiring.
        const submissionMatch = link?.match(/\/submissions\/([^/?#]+)/);
        if (submissionMatch) row.push({ text: '🤖 Ask AI', callback_data: `aifeedback:${submissionMatch[1]}` });
        return row.length > 0 ? [row] : [];
      }
      case NotificationType.ANNOUNCEMENT: {
        if (!absoluteLink) return [];
        return [[{ text: '🔗 Open', url: absoluteLink }]];
      }
      case NotificationType.CLASS_REMINDER: {
        if (!absoluteLink) return [];
        return [[{ text: '📅 Open schedule', url: absoluteLink }]];
      }
      case NotificationType.DEADLINE_REMINDER: {
        const row: Array<{ text: string; url?: string; callback_data?: string }> = [];
        if (absoluteLink) row.push({ text: '📝 Open assignment', url: absoluteLink });
        if (notificationId) row.push({ text: '✅ Mark read', callback_data: `markread:${notificationId}` });
        return row.length > 0 ? [row] : [];
      }
      default:
        return [];
    }
  }
}
