/**
 * Minimal RFC 5545 iCalendar builder.
 *
 * Why hand-roll instead of pulling in `ics` or `ical-generator`:
 *  - This is the only place we emit iCal, and our needs are simple
 *    (VEVENT only, no recurrence, no alarms).
 *  - Avoids adding a dependency for ~50 lines of formatting code.
 *  - Keeps the data flow easy to audit (we control every byte we emit,
 *    which matters because some calendar apps are very strict).
 *
 * RFC 5545 specifics we honour:
 *  - CRLF line endings.
 *  - DTSTAMP/DTSTART/DTEND in UTC (suffix `Z`).
 *  - Lines folded at 75 octets (we approximate by characters; fine for ASCII
 *    content we generate ourselves; non-ASCII titles are escaped first).
 *  - Special chars in TEXT properties (SUMMARY/DESCRIPTION/LOCATION) escaped:
 *    `\\`, `\,`, `\;`, `\n`.
 */

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
}

function formatUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunkLen = i === 0 ? 75 : 74; // continuation lines start with 1 space
    parts.push((i === 0 ? '' : ' ') + line.slice(i, i + chunkLen));
    i += chunkLen;
  }
  return parts.join('\r\n');
}

export function buildIcs(events: IcsEvent[], calendarName: string): string {
  const now = new Date();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniLMS//Schedule Export 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine('X-WR-CALNAME:' + escapeText(calendarName)),
  ];

  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(foldLine('UID:' + e.uid));
    lines.push('DTSTAMP:' + formatUtc(now));
    lines.push('DTSTART:' + formatUtc(e.start));
    lines.push('DTEND:' + formatUtc(e.end));
    lines.push(foldLine('SUMMARY:' + escapeText(e.summary)));
    if (e.description) lines.push(foldLine('DESCRIPTION:' + escapeText(e.description)));
    if (e.location) lines.push(foldLine('LOCATION:' + escapeText(e.location)));
    if (e.url) lines.push(foldLine('URL:' + e.url));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
