import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

interface SplitterProps {
  /** 'vertical': a line between two columns (dragged sideways); 'horizontal': between rows. */
  orientation: 'vertical' | 'horizontal';
  /** What it resizes, for assistive technology (e.g. "파일 목록 너비"). */
  label: string;
  /** The size it controls now, and the range it may take. */
  value: number;
  min: number;
  max: number;
  /**
   * The area it resizes lies before it (left or above): moving the divider right or down
   * makes the area smaller.
   */
  invert?: boolean;
  /** A drag or a keyboard change begins (before the first onChange). */
  onStart?: () => void;
  /** A new size, already within min and max. */
  onChange: (size: number) => void;
  /** Called once a drag or a keyboard change is over (to keep the size). */
  onCommit: () => void;
  /** Double click or Enter: back to the default size. */
  onReset: () => void;
  className?: string;
}

/**
 * A divider that is dragged to resize the area beside it. The travel is measured from where
 * the drag began, so the result does not depend on any other element's size.
 */
export default function Splitter({
  orientation,
  label,
  value,
  min,
  max,
  invert = false,
  onStart,
  onChange,
  onCommit,
  onReset,
  className = '',
}: SplitterProps) {
  const drag = useRef<{ pointer: number; start: number } | null>(null);
  const vertical = orientation === 'vertical';
  const position = (e: PointerEvent) => (vertical ? e.clientX : e.clientY);
  /** The size after the divider moved `travel` px (right or down positive) from `from`. */
  const sizeAfter = (from: number, travel: number) =>
    Math.min(Math.max(from + (invert ? -travel : travel), min), max);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onStart?.();
    drag.current = { pointer: position(e), start: value };
    // Keep the cursor and stop text selection while the pointer is elsewhere.
    document.body.style.cursor = vertical ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };
  const resetBody = () => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    resetBody();
    onCommit();
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // The button was released where this element did not hear it (e.g. another window).
    if (!(e.buttons & 1)) {
      endDrag();
      return;
    }
    onChange(sizeAfter(drag.current.start, position(e) - drag.current.pointer));
  };
  // Leaving the page in the middle of a drag must not leave the cursor changed.
  useEffect(() => () => resetBody(), []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // The arrow keys move the divider; Home and End give the smallest and largest size.
    const step = e.shiftKey ? 64 : 16;
    const moves: Record<string, number> = vertical
      ? { ArrowLeft: -step, ArrowRight: step }
      : { ArrowUp: -step, ArrowDown: step };
    const known = e.key in moves || e.key === 'Home' || e.key === 'End' || e.key === 'Enter';
    if (!known) return;
    onStart?.();
    if (e.key in moves) onChange(sizeAfter(value, moves[e.key]));
    else if (e.key === 'Home') onChange(min);
    else if (e.key === 'End') onChange(max);
    else onReset();
    e.preventDefault();
    onCommit();
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      tabIndex={0}
      title={`${label}: 끌어서 조절, 두 번 클릭하면 기본 크기`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={() => {
        onReset();
        onCommit();
      }}
      onKeyDown={onKeyDown}
      className={`${vertical ? 'cursor-col-resize' : 'cursor-row-resize'} touch-none select-none outline-hidden ${className}`}
    />
  );
}
