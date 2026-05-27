/**
 * Build the PDF bodies sent by the end-of-game Telegram callbacks.
 *
 * Used by two TG inline buttons:
 *   - kahplan:<sessionId>   → buildAiPlanPdf  (short personal plan)
 *   - kahguide:<sessionId>  → buildStudyGuidePdf (long focused guide
 *                              with lecture excerpts or AI mini-lesson)
 *
 * Both return a Promise<Buffer> that the bot pipes straight to
 * `bot.api.sendDocument` via `InputFile`. Layout is intentionally
 * simple — no fonts to bundle, no remote assets — because the bot
 * runs without filesystem access on Render.
 *
 * Design choices:
 *   - Single page-flow that auto-flows text into new pages. pdfkit's
 *     default Helvetica covers Latin + Cyrillic adequately for our
 *     en/ru/kk locales without shipping a custom font file.
 *   - Section headers use a colored bar so the document scans well
 *     when a teacher prints it for a student who has no laptop.
 *   - We resolve all pdfkit calls inside a try/catch and reject the
 *     promise on stream error — otherwise a corrupt write hangs the
 *     Telegram callback indefinitely.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');
import { Logger } from '@nestjs/common';

const logger = new Logger('KahootPdfBuilder');

/**
 * Resolve DejaVu Sans TTF files shipped by the `dejavu-fonts-ttf` npm
 * package. DejaVu covers Latin + full Cyrillic + Kazakh-specific
 * letters (ә, ң, қ, ө, ұ, ү, һ) — without this PDFKit's built-in
 * Helvetica replaces Cyrillic glyphs with empty squares.
 *
 * Resolved lazily because Node's module loader on Render can choke
 * on absolute paths if the file is missing for some reason; we'd
 * rather fall back to Helvetica than crash the bot callback.
 */
function resolveDejaVuFont(variant: 'Regular' | 'Bold' | 'Oblique'): string | null {
  const file = variant === 'Regular' ? 'DejaVuSans.ttf' : `DejaVuSans-${variant}.ttf`;
  try {
    return require.resolve(`dejavu-fonts-ttf/ttf/${file}`);
  } catch {
    return null;
  }
}

/**
 * Register the Unicode fonts on a pdfkit document. Returns the font
 * names to use; if registration fails (e.g., package missing) we
 * fall back to the base-14 Helvetica family. Cyrillic text will look
 * wrong in the fallback but the bot doesn't crash.
 */
function registerFonts(doc: PDFKit.PDFDocument): {
  regular: string;
  bold: string;
  italic: string;
  unicode: boolean;
} {
  const regular = resolveDejaVuFont('Regular');
  const bold = resolveDejaVuFont('Bold');
  const italic = resolveDejaVuFont('Oblique');
  if (regular && bold && italic) {
    try {
      doc.registerFont('Sans', regular);
      doc.registerFont('Sans-Bold', bold);
      doc.registerFont('Sans-Italic', italic);
      return { regular: 'Sans', bold: 'Sans-Bold', italic: 'Sans-Italic', unicode: true };
    } catch (e: any) {
      logger.warn(`Failed to register DejaVu fonts: ${e?.message ?? e}. Falling back to Helvetica (no Cyrillic).`);
    }
  } else {
    logger.warn('DejaVu Sans TTFs not found in node_modules — Cyrillic text in PDFs will be unreadable.');
  }
  return { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique', unicode: false };
}

interface AiPlanShape {
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  nextStep?: string;
  _demo?: boolean;
}

interface StudyGuideSection {
  title: string;
  sourceQuote?: string;
  lesson?: string;
  whyWrong: string;
  whyRight: string;
  example: string;
}

interface StudyGuideShape {
  hasMaterial: boolean;
  topLine?: string;
  sections?: StudyGuideSection[];
  mostImportant?: string;
  _demo?: boolean;
}

/**
 * Collect the pdfkit stream into a Buffer. Resolves on `end`, rejects
 * on `error` — without the error path the Telegram callback can hang
 * forever if pdfkit fails to write (eg. invalid embedded font).
 */
function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

type Fonts = ReturnType<typeof registerFonts>;

/** Common header used by both documents. */
function writeHeader(doc: PDFKit.PDFDocument, fonts: Fonts, title: string, subtitle: string) {
  doc.fillColor('#0f172a').font(fonts.bold).fontSize(20).text(title, { align: 'left' });
  doc.moveDown(0.25);
  doc.fillColor('#475569').font(fonts.regular).fontSize(11).text(subtitle, { align: 'left' });
  // Underline bar — gives the document a printed-handout feel.
  const y = doc.y + 6;
  doc.strokeColor('#facc15').lineWidth(2).moveTo(50, y).lineTo(560, y).stroke();
  doc.moveDown(1);
}

function writeSectionLabel(doc: PDFKit.PDFDocument, fonts: Fonts, label: string) {
  doc.fillColor('#0f172a').font(fonts.bold).fontSize(13).text(label.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.25);
}

function writeBody(doc: PDFKit.PDFDocument, fonts: Fonts, text: string) {
  doc.fillColor('#1e293b').font(fonts.regular).fontSize(11).text(text, { align: 'left', lineGap: 2 });
  doc.moveDown(0.5);
}

function writeBullets(doc: PDFKit.PDFDocument, fonts: Fonts, items: string[]) {
  doc.fillColor('#1e293b').font(fonts.regular).fontSize(11);
  for (const item of items) {
    doc.text(`• ${item}`, { indent: 12, lineGap: 2 });
    doc.moveDown(0.1);
  }
  doc.moveDown(0.5);
}

/**
 * Short personal plan — usually 1 page, very compact:
 *   - Summary paragraph
 *   - Strengths bullets
 *   - Gaps bullets
 *   - Next step (highlighted box)
 */
export async function buildAiPlanPdf(plan: AiPlanShape, studentName: string, quizTitle: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, left: 50, right: 50, bottom: 50 } });
  const buffer = streamToBuffer(doc);
  const fonts = registerFonts(doc);

  writeHeader(doc, fonts, 'Personal AI study plan', `${studentName} — ${quizTitle}`);

  if (plan.summary) {
    writeBody(doc, fonts, plan.summary);
  }

  if (plan.strengths && plan.strengths.length) {
    writeSectionLabel(doc, fonts, 'Strengths');
    writeBullets(doc, fonts, plan.strengths);
  }
  if (plan.gaps && plan.gaps.length) {
    writeSectionLabel(doc, fonts, 'Gaps to close');
    writeBullets(doc, fonts, plan.gaps);
  }

  if (plan.nextStep) {
    writeSectionLabel(doc, fonts, 'Most important next step');
    // Highlighted box — measure text height first, then paint the rect
    // behind it. Single-pass to avoid the double-render flicker.
    const startY = doc.y;
    doc.font(fonts.bold).fontSize(11);
    const height = doc.heightOfString(plan.nextStep, { width: 498, lineGap: 3 });
    doc
      .save()
      .fillColor('#fef3c7')
      .rect(50, startY - 4, 510, height + 8)
      .fill()
      .restore();
    doc.fillColor('#92400e').font(fonts.bold).fontSize(11).text(plan.nextStep, 56, startY, {
      width: 498,
      lineGap: 3,
    });
    doc.moveDown(1);
  }

  if (plan._demo) {
    doc.fillColor('#94a3b8').font(fonts.italic).fontSize(9).text('Demo mode — LLM_API_KEY not configured.', {
      align: 'right',
    });
  }

  doc.end();
  return buffer;
}

/**
 * Long focused study guide. Multi-page is expected when there are
 * 3-4 sections plus excerpts.
 */
export async function buildStudyGuidePdf(
  guide: StudyGuideShape,
  studentName: string,
  quizTitle: string,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, left: 50, right: 50, bottom: 50 } });
  const buffer = streamToBuffer(doc);
  const fonts = registerFonts(doc);

  writeHeader(doc, fonts, 'Personalized study guide', `${studentName} — ${quizTitle}`);

  if (guide.topLine) {
    writeBody(doc, fonts, guide.topLine);
  }

  for (let i = 0; i < (guide.sections ?? []).length; i++) {
    const s = guide.sections![i];
    // Section title with index
    doc
      .fillColor('#0f172a')
      .font(fonts.bold)
      .fontSize(14)
      .text(`${i + 1}. ${s.title}`);
    doc.moveDown(0.4);

    // From the lecture (if material) OR a generated lesson (if not).
    if (s.sourceQuote) {
      writeSectionLabel(doc, fonts, 'From your lecture');
      // Quote block — italic + left bar.
      const startY = doc.y;
      doc.fillColor('#475569').font(fonts.italic).fontSize(11).text(`"${s.sourceQuote}"`, 60, startY, {
        width: 490,
        lineGap: 2,
      });
      const endY = doc.y;
      doc.save().strokeColor('#facc15').lineWidth(3).moveTo(50, startY).lineTo(50, endY).stroke().restore();
      doc.moveDown(0.6);
    } else if (s.lesson) {
      writeSectionLabel(doc, fonts, 'Concept');
      writeBody(doc, fonts, s.lesson);
    }

    if (s.whyWrong) {
      doc.fillColor('#b91c1c').font(fonts.bold).fontSize(11).text('Why your pick was wrong');
      doc.moveDown(0.15);
      writeBody(doc, fonts, s.whyWrong);
    }
    if (s.whyRight) {
      doc.fillColor('#15803d').font(fonts.bold).fontSize(11).text('Why the correct answer is right');
      doc.moveDown(0.15);
      writeBody(doc, fonts, s.whyRight);
    }
    if (s.example) {
      doc.fillColor('#7c3aed').font(fonts.bold).fontSize(11).text('Try this');
      doc.moveDown(0.15);
      writeBody(doc, fonts, s.example);
    }

    doc.moveDown(0.5);
  }

  if (guide.mostImportant) {
    writeSectionLabel(doc, fonts, 'Most important next step');
    writeBody(doc, fonts, guide.mostImportant);
  }

  if (guide._demo) {
    doc.fillColor('#94a3b8').font(fonts.italic).fontSize(9).text('Demo mode — LLM_API_KEY not configured.', {
      align: 'right',
    });
  }

  doc.end();
  return buffer;
}
