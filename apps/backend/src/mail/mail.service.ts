import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type Lang = 'en' | 'ru' | 'kz' | undefined | null;

function resolveLang(lang: Lang): 'en' | 'ru' | 'kz' {
  if (lang === 'ru' || lang === 'kz') return lang;
  return 'en';
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }

  async sendAssignmentCreated(
    to: string,
    assignmentTitle: string,
    courseName: string,
    dueAt: Date,
    preferredLang?: string | null,
  ) {
    if (!process.env.SMTP_USER) {
      this.logger.debug(`[EMAIL SKIPPED] Assignment created: ${assignmentTitle} → ${to}`);
      return;
    }
    const lang = resolveLang(preferredLang as Lang);
    const T = {
      en: { subject: 'New Assignment', body: 'A new assignment', addedTo: 'has been added to', due: 'Due' },
      ru: { subject: 'Новое задание', body: 'Новое задание', addedTo: 'добавлено в курс', due: 'Срок' },
      kz: { subject: 'Жаңа тапсырма', body: 'Жаңа тапсырма', addedTo: 'қосылды', due: 'Мерзімі' },
    }[lang];
    await this.send(
      to,
      `${T.subject}: ${assignmentTitle}`,
      `<p>${T.body} <strong>${assignmentTitle}</strong> ${T.addedTo} <strong>${courseName}</strong>.</p>
       <p>${T.due}: ${dueAt.toLocaleDateString()}</p>`,
    );
  }

  async sendGradePublished(
    to: string,
    assignmentTitle: string,
    score: number,
    maxScore: number,
    feedback?: string | null,
    preferredLang?: string | null,
  ) {
    if (!process.env.SMTP_USER) {
      this.logger.debug(`[EMAIL SKIPPED] Grade published for ${assignmentTitle} → ${to}`);
      return;
    }
    const lang = resolveLang(preferredLang as Lang);
    const T = {
      en: { subject: 'Grade Published', body: 'Your assignment', graded: 'has been graded', score: 'Score', feedback: 'Feedback' },
      ru: { subject: 'Оценка выставлена', body: 'Ваше задание', graded: 'было оценено', score: 'Балл', feedback: 'Отзыв' },
      kz: { subject: 'Баға қойылды', body: 'Сіздің тапсырмаңыз', graded: 'бағаланды', score: 'Балл', feedback: 'Пікір' },
    }[lang];
    await this.send(
      to,
      `${T.subject}: ${assignmentTitle}`,
      `<p>${T.body} <strong>${assignmentTitle}</strong> ${T.graded}.</p>
       <p>${T.score}: <strong>${score} / ${maxScore}</strong></p>
       ${feedback ? `<p>${T.feedback}: ${feedback}</p>` : ''}`,
    );
  }

  private async send(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@unilms.local',
        to,
        subject,
        html,
      });
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }
}
