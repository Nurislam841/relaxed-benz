import { Controller, Post, Body, Get, Res, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email and password (rate-limited: 5/min per IP)' })
  @ApiResponse({ status: 200, description: 'Returns JWT tokens and user info' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts — try again later' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto);
    this.setCookies(res, r.accessToken, r.refreshToken);
    return r;
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user (rate-limited: 3/min per IP)' })
  @ApiResponse({ status: 201, description: 'User created and tokens returned' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.register(dto);
    this.setCookies(res, r.accessToken, r.refreshToken);
    return r;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'];
    if (!token) return { error: 'No refresh token' };
    const r = await this.auth.refresh(token);
    this.setCookies(res, r.accessToken, r.refreshToken);
    return r;
  }

  @Post('telegram-webapp')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Mini App auto-login: exchange Telegram WebApp initData (HMAC-signed) for JWT cookies',
  })
  @ApiResponse({ status: 200, description: 'Tokens + user OR { requires_link: true } if not yet linked' })
  @ApiResponse({ status: 401, description: 'initData signature invalid or expired' })
  async telegramWebApp(@Body() body: { initData: string }, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.loginViaTelegramWebApp(body.initData);
    if ('requires_link' in r) return r;
    this.setCookies(res, r.accessToken, r.refreshToken);
    return r;
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  me(@CurrentUser() user: any) {
    return user;
  }

  /**
   * Cross-origin auth: when the frontend (Vercel) and backend (Render) live
   * on different eTLD+1 domains, browsers strip the cookie from any request
   * that isn't a same-site top-level navigation. That's fine for `/api/*`
   * (Next.js proxies same-origin), but the Kahoot WebSocket connects
   * **directly** to the backend host — cross-site — so SameSite=Lax silently
   * drops the cookie and the gateway disconnects with "Authentication
   * required". The previous symptom: "Host live doesn't work" on prod.
   *
   * Set `COOKIE_SAMESITE=none` (and the browser will require `Secure=true`,
   * which we wire automatically) on Render. Dev defaults to Lax because
   * `Secure` cookies are refused on http://localhost.
   */
  private cookieOpts() {
    const sameSite = (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none' | undefined) || 'lax';
    return {
      httpOnly: true,
      sameSite,
      secure: sameSite === 'none',
    } as const;
  }

  private setCookies(res: Response, access: string, refresh: string) {
    const base = this.cookieOpts();
    res.cookie('access_token', access, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }
}
