import PDFDocument from 'pdfkit';

/**
 * Thin wrapper over `pdfkit` to keep the report services declarative.
 *
 * Why pdfkit instead of puppeteer or @react-pdf/renderer:
 *  - Pure Node, no headless browser to install in Docker (saves ~200MB image
 *    size and 5+ seconds of cold-start).
 *  - Synchronous stream API works well with Express response objects.
 *  - Embedded fonts are deterministic — no fontconfig juggling between dev
 *    and prod containers.
 *
 * Limitations we accept:
 *  - No CSS, no flexbox; we lay out by absolute coordinates.
 *  - Default font is Helvetica (Latin-only). Cyrillic / Kazakh letters show
 *    as boxes unless an external TTF is loaded. For the defense report we
 *    stick to Latin headers + numeric data; localized student names render
 *    by falling back to identifier characters only if Helvetica lacks them.
 *    A follow-up commit could embed `NotoSans-Regular.ttf` from public/.
 */

export interface ReportHeader {
  /** Big title at the top, e.g. "Gradebook" */
  title: string;
  /** Subtitle line, e.g. "CS101 — Introduction to Programming" */
  subtitle: string;
  /** Right-aligned line with generation metadata, e.g. "Generated 2025-05-22 by alice@uni.kz" */
  generatedFor: string;
}

export interface PdfTableColumn<T> {
  header: string;
  /** Pixel width inside content area. Sum should equal contentWidth (= 515pt at A4 50pt margins). */
  width: number;
  /** Pull text out of one row. */
  get: (row: T) => string;
  /** Override alignment (default: 'left'). */
  align?: 'left' | 'right' | 'center';
}

export class PdfBuilder {
  readonly doc: PDFKit.PDFDocument;
  private readonly margin = 50;

  constructor() {
    this.doc = new PDFDocument({ size: 'A4', margin: this.margin });
  }

  /** A4 = 595 × 842 pt. Usable width at 50pt margins = 495pt. */
  get contentWidth() {
    return this.doc.page.width - 2 * this.margin;
  }

  pipe(stream: NodeJS.WritableStream) {
    this.doc.pipe(stream);
    return this;
  }

  end() {
    this.doc.end();
  }

  // ── Header ────────────────────────────────────────────────────────────

  drawHeader(h: ReportHeader) {
    this.doc.font('Helvetica-Bold').fontSize(20).fillColor('#1a1a1a').text(h.title, this.margin, this.margin);

    this.doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#555555')
      .text(h.subtitle, this.margin, this.doc.y + 2);

    this.doc
      .fontSize(9)
      .fillColor('#888888')
      .text(h.generatedFor, this.margin, this.doc.y + 6, {
        width: this.contentWidth,
        align: 'right',
      });

    // Divider
    const y = this.doc.y + 8;
    this.doc
      .moveTo(this.margin, y)
      .lineTo(this.doc.page.width - this.margin, y)
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .stroke();
    this.doc.moveDown(1);
  }

  // ── Sections ──────────────────────────────────────────────────────────

  drawSectionTitle(title: string) {
    this.doc.font('Helvetica-Bold').fontSize(13).fillColor('#1a1a1a').text(title, this.margin, this.doc.y);
    this.doc.moveDown(0.3);
  }

  drawMutedLine(line: string) {
    this.doc.font('Helvetica').fontSize(10).fillColor('#666666').text(line, this.margin, this.doc.y);
    this.doc.moveDown(0.2);
  }

  // ── Tables ────────────────────────────────────────────────────────────

  drawTable<T>(rows: T[], columns: PdfTableColumn<T>[]) {
    if (rows.length === 0) {
      this.drawMutedLine('No records.');
      return;
    }

    const rowHeight = 18;
    const headerHeight = 22;
    let y = this.doc.y;

    // Header row
    this.doc.rect(this.margin, y, this.contentWidth, headerHeight).fillColor('#f3f4f6').fill();

    let x = this.margin;
    this.doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151');
    for (const col of columns) {
      this.doc.text(col.header, x + 4, y + 7, {
        width: col.width - 8,
        align: col.align ?? 'left',
        lineBreak: false,
      });
      x += col.width;
    }
    y += headerHeight;

    // Body rows
    this.doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
    for (let r = 0; r < rows.length; r++) {
      // Page break if needed
      if (y + rowHeight > this.doc.page.height - this.margin) {
        this.doc.addPage();
        y = this.margin;
        // Re-draw header on new page
        this.doc.rect(this.margin, y, this.contentWidth, headerHeight).fillColor('#f3f4f6').fill();
        let hx = this.margin;
        this.doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151');
        for (const col of columns) {
          this.doc.text(col.header, hx + 4, y + 7, {
            width: col.width - 8,
            align: col.align ?? 'left',
            lineBreak: false,
          });
          hx += col.width;
        }
        y += headerHeight;
        this.doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
      }

      // Zebra striping for legibility
      if (r % 2 === 1) {
        this.doc.rect(this.margin, y, this.contentWidth, rowHeight).fillColor('#fafafa').fill();
      }
      this.doc.fillColor('#1a1a1a');

      let cx = this.margin;
      for (const col of columns) {
        this.doc.text(col.get(rows[r]), cx + 4, y + 5, {
          width: col.width - 8,
          align: col.align ?? 'left',
          lineBreak: false,
          ellipsis: true,
        });
        cx += col.width;
      }
      y += rowHeight;
    }

    // Bottom border
    this.doc
      .moveTo(this.margin, y)
      .lineTo(this.doc.page.width - this.margin, y)
      .lineWidth(0.5)
      .strokeColor('#e5e7eb')
      .stroke();

    this.doc.y = y + 10;
  }

  // ── Footer (called once at the end) ───────────────────────────────────

  drawFooter() {
    const range = this.doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      this.doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#999999')
        .text(
          `Page ${i + 1} of ${range.count} · Generated by UniLMS`,
          this.margin,
          this.doc.page.height - this.margin + 10,
          { width: this.contentWidth, align: 'center', lineBreak: false },
        );
    }
  }
}
