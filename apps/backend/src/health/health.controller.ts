import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private db: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe — always 200 if process is running' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — verifies database connectivity' })
  async readiness() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { ready: true, db: 'up' };
    } catch (err) {
      throw new ServiceUnavailableException({ ready: false, db: 'down' });
    }
  }

  @Get('version')
  @ApiOperation({ summary: 'Build/version metadata' })
  @HttpCode(HttpStatus.OK)
  version() {
    return {
      version: process.env.npm_package_version || '0.1.0',
      commit: process.env.GIT_COMMIT || 'unknown',
      node: process.version,
      env: process.env.NODE_ENV || 'development',
    };
  }
}
