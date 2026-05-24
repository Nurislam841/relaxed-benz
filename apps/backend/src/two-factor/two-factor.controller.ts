import { Controller, Post, Get, Body, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TwoFactorService } from './two-factor.service';
import { VerifyTotpDto } from './two-factor.dto';

@ApiTags('2FA')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private svc: TwoFactorService) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether the current user has 2FA enabled' })
  status(@CurrentUser() u: any) {
    return this.svc.status(u.id);
  }

  @Post('setup')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Generate a TOTP secret + QR code data URI for the authenticator app' })
  setup(@CurrentUser() u: any) {
    return this.svc.beginSetup(u.id);
  }

  @Post('enable')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirm setup with a valid code — turns 2FA on for subsequent logins' })
  enable(@Body() dto: VerifyTotpDto, @CurrentUser() u: any) {
    return this.svc.enable(u.id, dto.code);
  }

  @Post('disable')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Disable 2FA — requires a valid current code to defeat XSS abuse' })
  disable(@Body() dto: VerifyTotpDto, @CurrentUser() u: any) {
    return this.svc.disable(u.id, dto.code);
  }
}
