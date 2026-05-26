import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';

/**
 * Pull plain text out of a teacher-uploaded lecture file so it can be fed
 * to Claude as quiz-generation context (Feature #1).
 *
 * Supported MIME types — listed in priority order of how often we expect
 * teachers to use them:
 *   - application/pdf                                       → pdf-parse
 *   - application/vnd.openxmlformats-officedocument
 *       .wordprocessingml.document  (.docx)                 → mammoth
 *   - text/plain (.txt, .md)                                → utf-8 decode
 *
 * Out of scope for now:
 *   - .pptx — the PowerPoint XML schema is significantly more involved
 *     than DOCX (slide-by-slide layouts, embedded XML islands). The
 *     teacher can save-as-PDF in PowerPoint and re-upload; the wow is
 *     already there with PDF+DOCX.
 *   - .doc (legacy Word) — virtually nobody still writes new .doc; just
 *     reject with a clear "save as .docx or PDF" message.
 */

const MAX_RAW_BYTES = 25 * 1024 * 1024; // 25MB upload cap

/**
 * After extraction we still cap the text payload before sending to Claude.
 * Hard 200KB so a 200-page PDF doesn't blow our token budget — the AI
 * will see the first 200KB which is ~50 pages of dense text, plenty for
 * a 5-15 question quiz.
 */
export const MAX_EXTRACTED_CHARS = 200_000;

export interface ExtractedMaterial {
  /** Extracted plaintext (truncated to MAX_EXTRACTED_CHARS). */
  text: string;
  /** Raw extraction length before truncation. */
  rawCharCount: number;
  /** Whether the text was truncated to fit the LLM budget. */
  truncated: boolean;
  /** Detected file kind for the UI to display ('pdf' / 'docx' / 'text'). */
  kind: 'pdf' | 'docx' | 'text';
}

export async function extractMaterialText(
  file: Express.Multer.File,
  logger: Logger = new Logger('MaterialExtractor'),
): Promise<ExtractedMaterial> {
  if (!file) throw new BadRequestException('No file provided');
  if (file.size > MAX_RAW_BYTES) {
    throw new BadRequestException(`File too large: ${file.size} bytes (limit ${MAX_RAW_BYTES})`);
  }
  if (!file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Empty file');
  }

  const mime = file.mimetype || '';
  const name = (file.originalname || '').toLowerCase();

  let raw: string;
  let kind: ExtractedMaterial['kind'];

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    raw = await extractPdf(file.buffer, logger);
    kind = 'pdf';
  } else if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    raw = await extractDocx(file.buffer, logger);
    kind = 'docx';
  } else if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    raw = file.buffer.toString('utf-8');
    kind = 'text';
  } else {
    throw new BadRequestException(
      `Unsupported file type: ${mime || 'unknown'}. Upload PDF, DOCX, or plain text. Save PowerPoint as PDF first.`,
    );
  }

  // Normalise whitespace — PDFs in particular drop bizarre runs of spaces
  // and form-feeds from page boundaries that would just eat tokens.
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) {
    throw new BadRequestException('Could not extract any readable text from this file');
  }

  const truncated = cleaned.length > MAX_EXTRACTED_CHARS;
  const text = truncated ? cleaned.slice(0, MAX_EXTRACTED_CHARS) : cleaned;

  return { text, rawCharCount: cleaned.length, truncated, kind };
}

async function extractPdf(buffer: Buffer, logger: Logger): Promise<string> {
  // require() inside the function so missing peer-deps don't crash boot —
  // surfaces as a 500 with a clear "install pdf-parse" message instead.
  let pdfParse: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfParse = require('pdf-parse');
  } catch {
    throw new InternalServerErrorException('pdf-parse not installed — run pnpm install');
  }
  try {
    const result = await pdfParse(buffer);
    return (result.text as string) || '';
  } catch (e: any) {
    logger.warn(`PDF parse failed: ${e?.message ?? e}`);
    throw new BadRequestException('Could not read this PDF — try re-exporting it or save as plain text');
  }
}

async function extractDocx(buffer: Buffer, logger: Logger): Promise<string> {
  let mammoth: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mammoth = require('mammoth');
  } catch {
    throw new InternalServerErrorException('mammoth not installed — run pnpm install');
  }
  try {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value as string) || '';
  } catch (e: any) {
    logger.warn(`DOCX parse failed: ${e?.message ?? e}`);
    throw new BadRequestException('Could not read this .docx — save it again from a recent Word version');
  }
}
