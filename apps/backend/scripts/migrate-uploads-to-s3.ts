/**
 * One-shot migration: copy all existing /uploads/<file> blobs into S3 and
 * rewrite the matching DB rows to point at the new URL.
 *
 * Usage (from apps/backend):
 *   STORAGE_MODE=s3 \
 *   S3_ENDPOINT=https://<acc>.r2.cloudflarestorage.com \
 *   S3_BUCKET=unilms \
 *   S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_PUBLIC_URL=https://pub-xxx.r2.dev \
 *   pnpm exec tsx scripts/migrate-uploads-to-s3.ts
 *
 * Safe to re-run: rows already pointing at the new S3 URL are skipped. The
 * source ./uploads files are NOT deleted — that's intentional so you can
 * roll back by flipping STORAGE_MODE back to `disk` if something looks off.
 *
 * Tables migrated:
 *   - submission_attachments.fileUrl
 *   - assignment_resources.fileUrl
 *
 * If you ever add more upload-bearing tables (course materials, profile
 * avatars, etc.), extend the `JOBS` array below.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

if (process.env.STORAGE_MODE !== 's3') {
  console.error('✗ Set STORAGE_MODE=s3 to run this migration. Aborting to prevent no-op.');
  process.exit(1);
}

const endpoint = requireEnv('S3_ENDPOINT');
const bucket = requireEnv('S3_BUCKET');
const accessKey = requireEnv('S3_ACCESS_KEY');
const secretKey = requireEnv('S3_SECRET_KEY');
const publicUrl = process.env.S3_PUBLIC_URL || '';
const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

const s3 = new S3Client({
  endpoint,
  region: process.env.S3_REGION || 'auto',
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  forcePathStyle: true,
});

function buildPublicUrl(key: string): string {
  return publicUrl ? `${publicUrl.replace(/\/$/, '')}/${key}` : `s3://${bucket}/${key}`;
}

/**
 * Generic per-table migrator. Loads all rows whose `fileUrl` still points at
 * a `/uploads/...` path; for each, reads the local file, uploads to S3,
 * updates the row. Returns counts so the caller can print a summary.
 */
async function migrateTable(
  label: string,
  loadRows: () => Promise<Array<{ id: string; fileUrl: string; fileName?: string | null; mimeType?: string | null }>>,
  updateRow: (id: string, newUrl: string) => Promise<void>,
) {
  console.log(`\n→ ${label}`);
  const rows = await loadRows();
  if (rows.length === 0) {
    console.log(`  (no rows to migrate)`);
    return { ok: 0, missing: 0, failed: 0 };
  }
  console.log(`  ${rows.length} rows`);

  let ok = 0,
    missing = 0,
    failed = 0;
  for (const row of rows) {
    // Strip leading `/uploads/` to get the disk-relative key.
    const localKey = row.fileUrl.replace(/^\/uploads\//, '');
    const localPath = join(uploadDir, localKey);
    if (!existsSync(localPath)) {
      console.warn(`  ⚠️  missing on disk: ${localPath} (id=${row.id})`);
      missing++;
      continue;
    }
    try {
      const buffer = await readFile(localPath);
      const newKey = basename(localKey); // bucket-side key — same filename
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: newKey,
          Body: buffer,
          ContentType: row.mimeType ?? 'application/octet-stream',
          ContentLength: buffer.length,
        }),
      );
      const newUrl = buildPublicUrl(newKey);
      await updateRow(row.id, newUrl);
      ok++;
      if (ok % 10 === 0) process.stdout.write(`  ${ok}/${rows.length}\r`);
    } catch (e: any) {
      console.error(`  ✗ failed for ${row.id}: ${e?.message ?? e}`);
      failed++;
    }
  }
  console.log(`  done: ${ok} migrated, ${missing} missing on disk, ${failed} failed`);
  return { ok, missing, failed };
}

async function main() {
  console.log('UniLMS uploads → S3 migration');
  console.log(`  bucket=${bucket}  endpoint=${endpoint}  publicUrl=${publicUrl || '(signed URLs)'}`);
  console.log(`  reading from disk dir: ${uploadDir}`);

  const results = await Promise.all([
    migrateTable(
      'submission_attachments',
      () =>
        prisma.submissionAttachment.findMany({
          where: { fileUrl: { startsWith: '/uploads/' } },
          select: { id: true, fileUrl: true, fileName: true, mimeType: true },
        }),
      (id, newUrl) =>
        prisma.submissionAttachment.update({ where: { id }, data: { fileUrl: newUrl } }).then(() => undefined),
    ),
    migrateTable(
      'assignment_resources',
      () =>
        prisma.assignmentResource.findMany({
          where: { fileUrl: { startsWith: '/uploads/' } },
          select: { id: true, fileUrl: true, fileName: true, mimeType: true },
        }),
      (id, newUrl) =>
        prisma.assignmentResource.update({ where: { id }, data: { fileUrl: newUrl } }).then(() => undefined),
    ),
  ]);

  const totals = results.reduce(
    (acc, r) => ({ ok: acc.ok + r.ok, missing: acc.missing + r.missing, failed: acc.failed + r.failed }),
    { ok: 0, missing: 0, failed: 0 },
  );

  console.log('\n──────────────────────────');
  console.log(`Total: ${totals.ok} migrated, ${totals.missing} missing on disk, ${totals.failed} failed`);
  if (totals.failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
