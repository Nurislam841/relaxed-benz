import { StorageService } from './storage.service';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Unit-level coverage of StorageService. We exercise the disk adapter
 * end-to-end (real fs writes into a tmp directory) and the S3 path
 * structurally — instantiating the service in s3 mode with missing env
 * vars should NOT crash boot, it falls back to disk with a logged error.
 *
 * Real S3 round-trip is verified manually via the smoke script
 * (`apps/backend/scripts/migrate-uploads-to-s3.ts`) so this spec stays
 * fast and offline.
 */
describe('StorageService', () => {
  let tmpRoot: string;
  const env = { ...process.env };

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'unilms-storage-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    process.env = { ...env };
  });

  describe('disk mode', () => {
    let svc: StorageService;

    beforeEach(async () => {
      delete process.env.STORAGE_MODE;
      process.env.UPLOAD_DIR = tmpRoot;
      svc = new StorageService();
      await svc.onModuleInit();
    });

    it('reports disk mode and creates the upload directory on init', async () => {
      expect(svc.currentMode).toBe('disk');
      expect(svc.needsSignedReads).toBe(false);
      expect(existsSync(tmpRoot)).toBe(true);
    });

    it('upload → readDiskFile round-trip with intact bytes', async () => {
      const buf = Buffer.from('hello world');
      const { key, url } = await svc.upload(buf, 'note.txt', 'text/plain');

      // Key keeps the original extension so MIME stays consistent across
      // re-uploads of the same logical file.
      expect(key.endsWith('.txt')).toBe(true);
      // url is the public path the frontend embeds.
      expect(url).toBe(`/uploads/${key}`);

      // File actually on disk + bytes match.
      expect(existsSync(join(tmpRoot, key))).toBe(true);
      const roundTrip = await svc.readDiskFile(key);
      expect(roundTrip?.toString('utf-8')).toBe('hello world');
    });

    it('delete removes the file (idempotent on missing)', async () => {
      const { key } = await svc.upload(Buffer.from('x'), 'a.txt', 'text/plain');
      expect(existsSync(join(tmpRoot, key))).toBe(true);
      await svc.delete(key);
      expect(existsSync(join(tmpRoot, key))).toBe(false);
      // Second delete must NOT throw — matches S3 semantics.
      await expect(svc.delete(key)).resolves.toBeUndefined();
    });

    it('getSignedUrl returns the disk path (no signing needed)', async () => {
      const url = await svc.getSignedUrl('1234.txt');
      expect(url).toBe('/uploads/1234.txt');
    });

    it('readDiskFile returns null on missing — used by migration script', async () => {
      const result = await svc.readDiskFile('nonexistent.txt');
      expect(result).toBeNull();
    });

    it('generates unique keys for back-to-back uploads of the same name', async () => {
      const a = await svc.upload(Buffer.from('a'), 'same.txt', 'text/plain');
      const b = await svc.upload(Buffer.from('b'), 'same.txt', 'text/plain');
      expect(a.key).not.toBe(b.key);
      // Both files exist independently — second didn't overwrite first.
      const aBytes = readFileSync(join(tmpRoot, a.key)).toString();
      const bBytes = readFileSync(join(tmpRoot, b.key)).toString();
      expect(aBytes).toBe('a');
      expect(bBytes).toBe('b');
    });
  });

  describe('s3 mode with missing env vars', () => {
    it('falls back to disk + logs error rather than crashing boot', async () => {
      // Mimic the production misconfiguration that previously took us down:
      // STORAGE_MODE=s3 but no credentials. Service must not throw and must
      // serve uploads from local disk instead.
      process.env.STORAGE_MODE = 's3';
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY;
      delete process.env.S3_SECRET_KEY;
      process.env.UPLOAD_DIR = tmpRoot;

      const svc = new StorageService();
      await svc.onModuleInit();
      expect(svc.currentMode).toBe('disk');

      // Still functional in disk mode.
      const { key, url } = await svc.upload(Buffer.from('x'), 't.txt', 'text/plain');
      expect(url).toBe(`/uploads/${key}`);
    });
  });

  describe('s3 mode with full env vars', () => {
    it('initialises without contacting S3 (no network at construction time)', async () => {
      process.env.STORAGE_MODE = 's3';
      process.env.S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
      process.env.S3_BUCKET = 'unilms-test';
      process.env.S3_ACCESS_KEY = 'AKIA-FAKE';
      process.env.S3_SECRET_KEY = 'SECRET-FAKE';
      process.env.S3_PUBLIC_URL = 'https://pub-fake.r2.dev';
      process.env.UPLOAD_DIR = tmpRoot;

      const svc = new StorageService();
      // We deliberately don't call onModuleInit() — that logs the mode but
      // makes no network calls either.
      expect(svc.currentMode).toBe('s3');
      // S3_PUBLIC_URL is set → no signed-URL fallback needed.
      expect(svc.needsSignedReads).toBe(false);
    });

    it('reports needsSignedReads=true when S3_PUBLIC_URL is blank', () => {
      process.env.STORAGE_MODE = 's3';
      process.env.S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
      process.env.S3_BUCKET = 'unilms-test';
      process.env.S3_ACCESS_KEY = 'AKIA-FAKE';
      process.env.S3_SECRET_KEY = 'SECRET-FAKE';
      delete process.env.S3_PUBLIC_URL;
      process.env.UPLOAD_DIR = tmpRoot;

      const svc = new StorageService();
      expect(svc.currentMode).toBe('s3');
      expect(svc.needsSignedReads).toBe(true);
    });
  });
});
