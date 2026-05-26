import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { Role } from '@prisma/client';
import { TwoFactorService } from '../two-factor/two-factor.service';

/**
 * Sentinel exception for the 2FA-required state. The controller catches this
 * (via a normal 401 status with a stable body) so the frontend can show the
 * "enter your 6-digit code" second-step screen without leaking whether the
 * password was correct (it was — only proceed past password check on success).
 */
export class TotpRequiredException extends UnauthorizedException {
  constructor() {
    super({ statusCode: 401, message: 'TOTP_REQUIRED', requires2fa: true });
  }
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private twoFactor: TwoFactorService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (!(await bcrypt.compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Invalid credentials');

    // Enforce 2FA when enabled. The TOTP code is part of the same request so
    // we don't need server-side session state for the "between password and
    // code" step. If the client omits the code, we tell them to re-submit
    // with one; the password was already validated above so the next attempt
    // doesn't cost an extra bcrypt round.
    if (user.totpEnabled && user.totpSecret) {
      if (!dto.totpCode) throw new TotpRequiredException();
      if (!this.twoFactor.verifyForLogin(user.totpSecret, dto.totpCode)) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    return this.issueTokens(user);
  }

  async register(dto: RegisterDto) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } }))
      throw new ConflictException('Email already in use');
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        fullName: dto.fullName,
        role: dto.role ?? Role.STUDENT,
      },
    });
    return this.issueTokens(user);
  }

  /**
   * Telegram Mini App auto-login (Phase 4.1).
   *
   * When the user opens the LMS via the bot's WebApp button, Telegram passes
   * us a query-string-ish `initData` payload with HMAC-SHA256 signature
   * derived from the bot token. Spec:
   * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   *
   * We verify the signature, parse out the Telegram user id, find the
   * matching backend user by `telegramChatId` (the user MUST have linked
   * their account first — we don't auto-provision), and issue the usual
   * JWT pair. The `auth_date` is checked against 24h freshness so an
   * intercepted initData can't be replayed.
   *
   * Returns a `requires_link` flag (no tokens) if the Telegram user hasn't
   * linked yet — the frontend then redirects to the linking flow.
   */
  async loginViaTelegramWebApp(initData: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new UnauthorizedException('Telegram bot not configured');

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('initData missing hash');
    params.delete('hash');
    // Build the data-check-string: key=value lines sorted by key, joined by \n.
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // secret_key = HMAC_SHA256("WebAppData", bot_token)
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computedHash !== hash) throw new UnauthorizedException('initData signature mismatch');

    // Freshness — reject anything older than 24h to limit replay window.
    const authDate = parseInt(params.get('auth_date') ?? '0', 10);
    if (!authDate || Date.now() / 1000 - authDate > 86400) {
      throw new UnauthorizedException('initData expired');
    }

    const userJson = params.get('user');
    if (!userJson) throw new UnauthorizedException('initData missing user payload');
    let tgUser: { id?: number };
    try {
      tgUser = JSON.parse(userJson);
    } catch {
      throw new UnauthorizedException('bad user payload');
    }
    if (!tgUser.id) throw new UnauthorizedException('user.id missing');

    const user = await this.prisma.user.findFirst({
      where: { telegramChatId: String(tgUser.id), deletedAt: null },
    });
    if (!user) {
      // Not linked yet — frontend should prompt the user to link from /profile.
      return { requires_link: true } as const;
    }
    return this.issueTokens(user);
  }

  async refresh(token: string) {
    try {
      const p = this.jwt.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET || 'change-me-super-secret-refresh-key-at-least-32',
      });
      const user = await this.prisma.user.findUnique({ where: { id: p.sub } });
      if (!user) throw new UnauthorizedException();
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private issueTokens(user: { id: string; email: string; fullName: string; role: Role }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwt.sign(payload, { expiresIn: process.env.JWT_EXPIRATION || '15m' }),
      refreshToken: this.jwt.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'change-me-super-secret-refresh-key-at-least-32',
        expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
      }),
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }
}
