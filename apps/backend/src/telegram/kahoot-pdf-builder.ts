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

/** Common header used by both documents. */
function writeHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(20).text(title, { align: 'left' });
  doc.moveDown(0.25);
  doc.fillColor('#475569').font('Helvetica').fontSize(11).text(subtitle, { align: 'left' });
  // Underline bar — gives the document a printed-handout feel.
  const y = doc.y + 6;
  doc.strokeColor('#facc15').lineWidth(2).moveTo(50, y).lineTo(560, y).stroke();
  doc.moveDown(1);
}

function writeSectionLabel(doc: PDFKit.PDFDocument, label: string) {
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text(label.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.25);
}

function writeBody(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor('#1e293b').font('Helvetica').fontSize(11).text(text, { align: 'left', lineGap: 2 });
  doc.moveDown(0.5);
}

function writeBullets(doc: PDFKit.PDFDocument, items: string[]) {
  doc.fillColor('#1e293b').font('Helvetica').fontSize(11);
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

  writeHeader(doc, 'Personal AI study plan', `${studentName} — ${quizTitle}`);

  if (plan.summary) {
    writeBody(doc, plan.summary);
  }

  if (plan.strengths && plan.strengths.length) {
    writeSectionLabel(doc, 'Strengths');
    writeBullets(doc, plan.strengths);
  }
  if (plan.gaps && plan.gaps.length) {
    writeSectionLabel(doc, 'Gaps to close');
    writeBullets(doc, plan.gaps);
  }

  if (plan.nextStep) {
    writeSectionLabel(doc, 'Most important next step');
    // Highlighted box — drawn manually because pdfkit has no built-in.
    const startY = doc.y;
    doc
      .save()
      .fillColor('#fef3c7')
      .rect(50, startY - 4, 510, 0)
      .fill()
      .restore();
    doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(11).text(plan.nextStep, 56, startY, {
      width: 498,
      lineGap: 3,
    });
    // Re-draw the rect with the correct height now that the text wrapped.
    const endY = doc.y;
    doc
      .save()
      .fillColor('#fef3c7')
      .rect(50, startY - 4, 510, endY - startY + 8)
      .fillOpacity(0.5)
      .fill()
      .restore();
    // Print the text again on top (the fill obscured it).
    doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(11).text(plan.nextStep, 56, startY, {
      width: 498,
      lineGap: 3,
    });
    doc.moveDown(1);
  }

  if (plan._demo) {
    doc.fillColor('#94a3b8').font('Helvetica-Oblique').fontSize(9).text('Demo mode — LLM_API_KEY not configured.', {
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

  writeHeader(doc, 'Personalized study guide', `${studentName} — ${quizTitle}`);

  if (guide.topLine) {
    writeBody(doc, guide.topLine);
  }

  for (let i = 0; i < (guide.sections ?? []).length; i++) {
    const s = guide.sections![i];
    // Section title with index
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(`${i + 1}. ${s.title}`);
    doc.moveDown(0.4);

    // From the lecture (if material) OR a generated lesson (if not).
    if (s.sourceQuote) {
      writeSectionLabel(doc, 'From your lecture');
      // Quote block — italic + left bar.
      const startY = doc.y;
      doc.fillColor('#475569').font('Helvetica-Oblique').fontSize(11).text(`"${s.sourceQuote}"`, 60, startY, {
        width: 490,
        lineGap: 2,
      });
      const endY = doc.y;
      doc.save().strokeColor('#facc15').lineWidth(3).moveTo(50, startY).lineTo(50, endY).stroke().restore();
      doc.moveDown(0.6);
    } else if (s.lesson) {
      writeSectionLabel(doc, 'Concept');
      writeBody(doc, s.lesson);
    }

    if (s.whyWrong) {
      doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(11).text('Why your pick was wrong');
      doc.moveDown(0.15);
      writeBody(doc, s.whyWrong);
    }
    if (s.whyRight) {
      doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(11).text('Why the correct answer is right');
      doc.moveDown(0.15);
      writeBody(doc, s.whyRight);
    }
    if (s.example) {
      doc.fillColor('#7c3aed').font('Helvetica-Bold').fontSize(11).text('Try this');
      doc.moveDown(0.15);
      writeBody(doc, s.example);
    }

    doc.moveDown(0.5);
  }

  if (guide.mostImportant) {
    writeSectionLabel(doc, 'Most important next step');
    writeBody(doc, guide.mostImportant);
  }

  if (guide._demo) {
    doc.fillColor('#94a3b8').font('Helvetica-Oblique').fontSize(9).text('Demo mode — LLM_API_KEY not configured.', {
      align: 'right',
    });
  }

  doc.end();
  return buffer;
}
