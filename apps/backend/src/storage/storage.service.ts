import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, writeFile, unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, basename } from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Result of an upload — `url` is what the frontend embeds (it is either a
 * relative `/uploads/...` path or a fully-qualified public S3 URL), and `key`
 * is the storage-side identifier we keep around for later delete/getSignedUrl
 * calls. We persist `url` in the DB the same way we always have so existing
 * read paths keep working.
 */
export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Unified storage abstraction.
 *
 * Why this exists: until now file uploads went straight to a local `./uploads`
 * directory via `multer.diskStorage`. That works locally but breaks the moment
 * the app is deployed on an ephemeral container (Render/Railway without a
 * volume) — uploaded files vanish on every restart. To make the system
 * deploy-anywhere we introduce a tiny "storage" port with two adapters:
 *
 *   - `DiskStorage`  — keeps the old `./uploads/<file>` behaviour. Default,
 *     used for local dev and Docker with a mounted volume. Zero deps.
 *   - `S3Storage`    — pushes to any S3-compatible object store. Recommended
 *     for prod (Cloudflare R2 is 10GB free forever with $0 egress).
 *
 * The active mode is selected at bootstrap by `STORAGE_MODE=disk|s3`.
 *
 * Telegram photo submissions (Phase 4.3) go through the same path — they're
 * just an in-memory `Buffer` instead of a multer disk file, and `upload()`
 * accepts that uniformly.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly mode: 'disk' | 's3';
  private readonly diskRoot: string;
  private readonly s3?: S3Client;
  private readonly s3Bucket?: string;
  private readonly s3PublicUrl?: string;

  constructor() {
    this.mode = (process.env.STORAGE_MODE === 's3' ? 's3' : 'disk') as 'disk' | 's3';
    this.diskRoot = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

    if (this.mode === 's3') {
      const endpoint = process.env.S3_ENDPOINT;
      const accessKeyId = process.env.S3_ACCESS_KEY;
      const secretAccessKey = process.env.S3_SECRET_KEY;
      this.s3Bucket = process.env.S3_BUCKET;
      this.s3PublicUrl = process.env.S3_PUBLIC_URL;

      if (!endpoint || !accessKeyId || !secretAccessKey || !this.s3Bucket) {
        // Don't crash the whole app — fall back to disk and warn loudly.
        // This makes "I forgot to set an env var" a runtime warning, not a
        // boot-time outage that takes the whole LMS offline.
        this.logger.error(
          'STORAGE_MODE=s3 but S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY are missing. ' +
            'Falling back to local disk — uploaded files will NOT persist across restarts.',
        );
        this.mode = 'disk';
      } else {
        this.s3 = new S3Client({
          endpoint,
          region: process.env.S3_REGION || 'auto',
          credentials: { accessKeyId, secretAccessKey },
          // R2 / B2 require path-style URLs (vs virtual-hosted bucket subdomains).
          forcePathStyle: true,
        });
      }
    }
  }

  async onModuleInit() {
    if (this.mode === 'disk' && !existsSync(this.diskRoot)) {
      await mkdir(this.diskRoot, { recursive: true });
      this.logger.log(`Created upload directory: ${this.diskRoot}`);
    }
    this.logger.log(
      `Storage initialised in "${this.mode}" mode` +
        (this.mode === 's3' ? ` (bucket=${this.s3Bucket})` : ` (dir=${this.diskRoot})`),
    );
  }

  /**
   * Upload a buffer. Returns `{ key, url }`. The URL is what callers persist —
   * for disk it's a `/uploads/...` path the static handler in `main.ts` serves;
   * for S3 it's the public bucket URL (or a signed URL if `S3_PUBLIC_URL`
   * was left blank — call `getSignedUrl` on read in that case).
   */
  async upload(buffer: Buffer, originalName: string, mimeType: string): Promise<UploadResult> {
    const key = this.generateKey(originalName);

    if (this.mode === 's3' && this.s3 && this.s3Bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ContentLength: buffer.length,
        }),
      );
      const url = this.s3PublicUrl ? `${this.s3PublicUrl.replace(/\/$/, '')}/${key}` : `s3://${this.s3Bucket}/${key}`; // sentinel — caller should resolve via getSignedUrl
      return { key, url };
    }

    // disk fallback
    if (!existsSync(this.diskRoot)) await mkdir(this.diskRoot, { recursive: true });
    const filePath = join(this.diskRoot, key);
    await writeFile(filePath, buffer);
    return { key, url: `/uploads/${key}` };
  }

  /**
   * Generate a short-lived presigned URL for private S3 objects. For disk
   * mode we return the same `/uploads/` path — the static handler is already
   * gated by a JWT check (see [main.ts:19]).
   */
  async getSignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
    if (this.mode === 's3' && this.s3 && this.s3Bucket) {
      return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.s3Bucket, Key: key }), {
        expiresIn: ttlSeconds,
      });
    }
    return `/uploads/${key}`;
  }

  /**
   * Delete by storage key. No-op on missing — that mirrors `fs.unlink` with
   * `force: true` and matches S3's `DeleteObject` semantics (200 on missing).
   */
  async delete(key: string): Promise<void> {
    if (this.mode === 's3' && this.s3 && this.s3Bucket) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.s3Bucket, Key: key })).catch(() => undefined);
      return;
    }
    const filePath = join(this.diskRoot, key);
    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => undefined);
    }
  }

  /**
   * Best-effort read for the migration script (disk → S3). Returns null if
   * the file is missing — caller skips it rather than aborting the run.
   */
  async readDiskFile(key: string): Promise<Buffer | null> {
    const filePath = join(this.diskRoot, key);
    if (!existsSync(filePath)) return null;
    return readFile(filePath);
  }

  /** Whether we'd need a signed URL for reads (i.e. private S3 bucket). */
  get needsSignedReads(): boolean {
    return this.mode === 's3' && !this.s3PublicUrl;
  }

  get currentMode(): 'disk' | 's3' {
    return this.mode;
  }

  /**
   * Same name shape we've been using forever: `<ts>-<rand><ext>`. Keeping the
   * format unchanged so existing DB rows that point to `/uploads/<this>` stay
   * valid alongside fresh ones from this service.
   */
  private generateKey(originalName: string): string {
    const safeBase = basename(originalName);
    const ext = extname(safeBase);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return `${unique}${ext}`;
  }
}
