import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

/**
 * RFC 6238 TOTP — 6 digits, 30-second window, SHA-1.
 * `otplib` defaults match Google Authenticator / Authy / Microsoft Authenticator.
 *
 * We allow a ±1 step skew (90 seconds total) to tolerate clock drift between
 * the server and the user's phone. This is the standard recommended window.
 */
authenticator.options = { window: 1 };

@Injectable()
export class TwoFactorService {
  constructor(private db: PrismaService) {}

  /**
   * Begin enrolment: generate a fresh secret + otpauth URL + QR code data URI.
   * The secret is STAGED in `totpSecret` but `totpEnabled` stays false until
   * the user confirms with a valid code via `enable()`. This avoids locking
   * users out if they close the page mid-setup.
   */
  async beginSetup(userId: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (user.totpEnabled) {
      throw new BadRequestException('2FA is already enabled — disable it first to re-enrol');
    }

    const secret = authenticator.generateSecret();
    const issuer = 'UniLMS';
    const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await this.db.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /** Finalize enrolment: user proved they have the authenticator by entering a code. */
  async enable(userId: string, code: string): Promise<{ enabled: true }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (!user.totpSecret) {
      throw new BadRequestException('Setup not started — call /setup first');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    if (!authenticator.verify({ token: code, secret: user.totpSecret })) {
      throw new UnauthorizedException('Invalid code — try again with the current code from your app');
    }

    await this.db.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
    return { enabled: true };
  }

  /** Turn off 2FA. Requires a valid current code to prevent malicious disable via XSS. */
  async disable(userId: string, code: string): Promise<{ enabled: false }> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA is not enabled');
    }
    if (!authenticator.verify({ token: code, secret: user.totpSecret })) {
      throw new UnauthorizedException('Invalid code');
    }

    await this.db.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    return { enabled: false };
  }

  /**
   * Verify a code against an enrolled user. Used inside the login flow,
   * NOT exposed as a standalone endpoint (would let an attacker brute-force).
   */
  verifyForLogin(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }

  /** Public status — used by frontend to show enabled/disabled state in profile. */
  async status(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { totpEnabled: true },
    });
    return { enabled: !!user?.totpEnabled };
  }
}
