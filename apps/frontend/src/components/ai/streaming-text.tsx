'use client';

import * as React from 'react';

interface StreamingTextProps {
  text: string;
  speed?: number;
  onDone?: () => void;
}

/**
 * Animated text reveal — progressively shows `text` with a blinking caret.
 * Use for fake-streaming demo or to highlight just-arrived chunks.
 */
export function StreamingText({ text, speed = 18, onDone }: StreamingTextProps) {
  const [shown, setShown] = React.useState(0);

  React.useEffect(() => {
    setShown(0);
  }, [text]);

  React.useEffect(() => {
    if (shown >= text.length) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => setShown((s) => Math.min(text.length, s + 2)), speed);
    return () => clearTimeout(t);
  }, [shown, text, speed, onDone]);

  const isDone = shown >= text.length;

  return (
    <span>
      {text.slice(0, shown)}
      {!isDone && <span className="ai-caret" />}
    </span>
  );
}

/**
 * Live-streaming caret — appended to a buffer that's growing externally (SSE).
 */
export function LiveCaret() {
  return <span className="ai-caret" />;
}
