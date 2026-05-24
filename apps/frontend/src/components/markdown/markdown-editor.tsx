'use client';

import { useState, useRef } from 'react';
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Code, Quote, Eye, Pencil } from 'lucide-react';
import { Textarea } from '@/components/ui/form-elements';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MarkdownView } from './markdown-view';

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  /** Toggle live preview tab. Off for very short inputs (single-line). */
  enablePreview?: boolean;
  /** Maximum length — soft warning, doesn't truncate. */
  maxLength?: number;
  id?: string;
  className?: string;
}

/**
 * Lightweight Markdown editor: textarea + toolbar + optional Preview tab.
 *
 * Design choices:
 *  - Not a WYSIWYG: students should learn to write Markdown — universities
 *    grade on clarity of communication, and Markdown is the lingua franca
 *    of technical writing.
 *  - Toolbar inserts syntax at the caret rather than rendering toolbars
 *    inline. This keeps the editor a pure controlled textarea (works with
 *    forms, validation, paste handlers).
 *  - Preview shares the same MarkdownView as the read view, so what you
 *    see is what students see.
 *  - No collaborative editing, no upload-on-paste, no autosave — those
 *    cost more complexity than they're worth for a defense-stage project.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  enablePreview = true,
  maxLength,
  id,
  className,
}: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Insert markdown syntax around or at the current selection.
   * `before` and `after` wrap the selection; if no selection, just inserts
   * `before + placeholder + after` and selects the placeholder so the user
   * can immediately overtype.
   */
  const insertAtCaret = (before: string, after = '', placeholder = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newValue);
    // Restore focus + put caret on the newly-inserted text
    requestAnimationFrame(() => {
      ta.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      ta.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const insertLine = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    // Find the beginning of the current line
    const before = value.slice(0, start);
    const lineStart = before.lastIndexOf('\n') + 1;
    const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const overLimit = maxLength != null && charCount > maxLength;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Tab bar */}
      {enablePreview && (
        <div className="flex items-center gap-1 border-b border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
              tab === 'write'
                ? 'border-[var(--accent-500)] text-[var(--fg)]'
                : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]',
            )}
          >
            <Pencil className="h-3 w-3" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
              tab === 'preview'
                ? 'border-[var(--accent-500)] text-[var(--fg)]'
                : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]',
            )}
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>
        </div>
      )}

      {/* Toolbar */}
      {tab === 'write' && (
        <div className="flex items-center gap-0.5 flex-wrap">
          <ToolbarBtn icon={Bold} title="Bold (Ctrl+B)" onClick={() => insertAtCaret('**', '**', 'bold text')} />
          <ToolbarBtn icon={Italic} title="Italic (Ctrl+I)" onClick={() => insertAtCaret('_', '_', 'italic text')} />
          <ToolbarBtn icon={Code} title="Inline code" onClick={() => insertAtCaret('`', '`', 'code')} />
          <ToolbarBtn icon={LinkIcon} title="Link" onClick={() => insertAtCaret('[', '](https://)', 'link text')} />
          <span className="w-px h-4 bg-[var(--border-color)] mx-1" />
          <ToolbarBtn icon={List} title="Bulleted list" onClick={() => insertLine('- ')} />
          <ToolbarBtn icon={ListOrdered} title="Numbered list" onClick={() => insertLine('1. ')} />
          <ToolbarBtn icon={Quote} title="Quote" onClick={() => insertLine('> ')} />
        </div>
      )}

      {/* Body */}
      {tab === 'write' ? (
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ?? 'Supports **bold**, _italic_, `code`, [links](https://), lists, tables, and more.'
          }
          rows={rows}
          className="font-mono text-[13px]"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
              e.preventDefault();
              insertAtCaret('**', '**', 'bold text');
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
              e.preventDefault();
              insertAtCaret('_', '_', 'italic text');
            }
          }}
        />
      ) : (
        <div className="min-h-[140px] rounded-md border border-[var(--border-color)] bg-[var(--bg-subtle)] p-3">
          {value.trim() ? (
            <MarkdownView source={value} />
          ) : (
            <p className="text-[13px] text-[var(--fg-muted)] italic">Nothing to preview yet.</p>
          )}
        </div>
      )}

      {/* Footer: character count */}
      <div className="flex items-center justify-between text-[11px] text-[var(--fg-muted)]">
        <span>
          {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} {charCount === 1 ? 'char' : 'chars'}
          {maxLength != null && ` / ${maxLength}`}
        </span>
        {overLimit && (
          <span className="text-[var(--danger)]">
            Over the {maxLength}-character limit by {charCount - maxLength!}
          </span>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({ icon: Icon, title, onClick }: { icon: React.ElementType; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="h-7 w-7 rounded flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
