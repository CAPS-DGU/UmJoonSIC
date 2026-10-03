// Column alignment of one line of SIC/XE assembly (label / opcode / operand / comment), as
// the user types. Called after the editor has applied a key; returns the realigned line and
// where the cursor goes. useAutoIndentation decides when to call it.
//
// Layout (1-based columns): label from 1, opcode from 10, operand from 18, comment from 36.
// A field that does not fit pushes the next one right by at least one space.

const OPCODE_COLUMN = 10;
const OPERAND_COLUMN = 18;
const COMMENT_COLUMN = 36;

const LABEL_WIDTH = OPCODE_COLUMN - 1; // 9
const OPCODE_WIDTH = OPERAND_COLUMN - OPCODE_COLUMN; // 8
const OPERAND_WIDTH = COMMENT_COLUMN - OPERAND_COLUMN; // 18

// ---------------------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------------------

const isSpace = (ch: string) => ch === ' ' || ch === '\t';

/** Number of spaces (or tabs) starting at `i`. */
function spacesAt(s: string, i: number): number {
  let j = i;
  while (j < s.length && isSpace(s[j])) j++;
  return j - i;
}

/** End of the run of non-spaces starting at `i`. */
function tokenEnd(s: string, i: number): number {
  let j = i;
  while (j < s.length && !isSpace(s[j])) j++;
  return j;
}

/**
 * End of the operand starting at `i`. An operand may contain spaces inside quotes
 * (C'A B'), and one space right after a comma (BUFFER, X).
 */
function operandEnd(s: string, i: number): number {
  let j = i;
  let quote: string | null = null;
  // Set by a comma; cleared by any character other than a quote or another comma.
  let spaceAllowed = false;
  for (; j < s.length; j++) {
    const ch = s[j];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === ',') {
      spaceAllowed = true;
    } else if (isSpace(ch)) {
      if (!spaceAllowed) break;
      spaceAllowed = false;
    } else {
      spaceAllowed = false;
    }
  }
  return j;
}

function firstNonSpace(s: string): number {
  const i = spacesAt(s, 0);
  return i === s.length ? -1 : i;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const quotesClosed = (text: string) =>
  (text.match(/'/g) || []).length % 2 === 0 && (text.match(/"/g) || []).length % 2 === 0;

// ---------------------------------------------------------------------------------------
// Parsing a line into fields
// ---------------------------------------------------------------------------------------

/** [start, end) */
interface Span {
  start: number;
  end: number;
}

/** Where each part of a line is. A field is null when absent, '' when only its spaces are there. */
interface Fields {
  label: string | null;
  opcode: string | null;
  operand: string | null;
  /** Everything after the operand and its spaces; null when there is nothing. */
  comment: string | null;
  labelSpan: Span | null;
  opcodeSpan: Span | null;
  operandSpan: Span | null;
  commentStart: number; // -1 when there is no comment
  /** The spaces before the label/opcode, and after the label, opcode and operand. */
  leadingSpaces: Span;
  afterLabel: Span | null;
  afterOpcode: Span | null;
  afterOperand: Span | null;
  /** The line up to the comment. */
  codeEnd: number;
  /** A comment line: the first non-space character is '.'. */
  isCommentLine: boolean;
}

/**
 * Split a line into fields. A line that starts with a space has no label. Whatever follows
 * the operand (after its spaces) is the comment: the comment is found by position, not by '.'.
 */
function parseFields(s: string): Fields {
  const lead = spacesAt(s, 0);
  const fns = firstNonSpace(s);
  const f: Fields = {
    label: null,
    opcode: null,
    operand: null,
    comment: null,
    labelSpan: null,
    opcodeSpan: null,
    operandSpan: null,
    commentStart: -1,
    leadingSpaces: { start: 0, end: lead },
    afterLabel: null,
    afterOpcode: null,
    afterOperand: null,
    codeEnd: s.length,
    isCommentLine: fns >= 0 && s[fns] === '.',
  };
  if (f.isCommentLine) return f;

  let i = lead;
  const spacesFrom = (start: number): Span => {
    const end = start + spacesAt(s, start);
    i = end;
    return { start, end };
  };
  /** The line ends after spaces that open an (empty) field. */
  const emptyFieldAtEnd = () => {
    f.afterOperand = { start: s.length, end: s.length };
  };

  if (i >= s.length) return f;
  if (lead === 0) {
    const end = tokenEnd(s, i);
    f.labelSpan = { start: i, end };
    f.label = s.slice(i, end);
    f.afterLabel = spacesFrom(end);
    if (i >= s.length) {
      if (f.afterLabel.end > f.afterLabel.start) {
        f.opcode = '';
        emptyFieldAtEnd();
      }
      return f;
    }
  }

  const opcodeEnd = tokenEnd(s, i);
  f.opcodeSpan = { start: i, end: opcodeEnd };
  f.opcode = s.slice(i, opcodeEnd);
  f.afterOpcode = spacesFrom(opcodeEnd);
  if (i >= s.length) {
    if (f.afterOpcode.end > f.afterOpcode.start) {
      f.operand = '';
      emptyFieldAtEnd();
    }
    return f;
  }

  const end = operandEnd(s, i);
  f.operandSpan = { start: i, end };
  f.operand = s.slice(i, end);
  f.afterOperand = spacesFrom(end);
  if (i < s.length) {
    f.commentStart = i;
    f.codeEnd = i;
    f.comment = s.slice(i);
  }
  return f;
}

// ---------------------------------------------------------------------------------------
// Where the cursor is
// ---------------------------------------------------------------------------------------

type CursorPlace =
  | { in: 'label' | 'opcode' | 'operand' | 'comment'; offset: number }
  /** In the spaces before the line's first field, or after the label, opcode or operand. */
  | { in: 'spaces'; after: 'start' | 'label' | 'opcode' | 'operand' }
  /** At the end of the code, after its last field. */
  | { in: 'end' }
  | { in: 'nowhere' };

const within = (span: Span | null, i: number) => !!span && i >= span.start && i < span.end;

function cursorPlace(f: Fields, cp: number): CursorPlace {
  if (f.commentStart >= 0 && cp >= f.commentStart) {
    return { in: 'comment', offset: cp - f.commentStart };
  }
  if (cp > f.codeEnd) return { in: 'nowhere' };
  if (within(f.labelSpan, cp)) return { in: 'label', offset: cp - f.labelSpan!.start };
  if (within(f.opcodeSpan, cp)) return { in: 'opcode', offset: cp - f.opcodeSpan!.start };
  if (within(f.operandSpan, cp)) return { in: 'operand', offset: cp - f.operandSpan!.start };
  if (within(f.leadingSpaces, cp)) return { in: 'spaces', after: 'start' };
  if (within(f.afterLabel, cp)) return { in: 'spaces', after: 'label' };
  if (within(f.afterOpcode, cp)) return { in: 'spaces', after: 'opcode' };
  if (within(f.afterOperand, cp)) return { in: 'spaces', after: 'operand' };
  if (cp === f.codeEnd) {
    // Spaces typed after a field open the next one, which is still empty.
    if (f.opcode === '' && f.afterLabel) return { in: 'opcode', offset: 0 };
    if (f.operand === '' && f.afterOpcode) return { in: 'operand', offset: 0 };
    return { in: 'end' };
  }
  return { in: 'nowhere' };
}

// ---------------------------------------------------------------------------------------
// Aligning
// ---------------------------------------------------------------------------------------

interface Aligned {
  line: string;
  /** Where each field starts in `line`. */
  starts: { label: number; opcode: number; operand: number; comment: number };
}

/**
 * Lay the fields out in their columns. The operand is padded to the comment column only
 * with `toCommentColumn`; otherwise the comment (if any) follows the operand directly.
 */
function align(f: Fields, toCommentColumn: boolean): Aligned {
  const label = f.label ?? '';
  let line =
    label.length > 0
      ? label + ' '.repeat(Math.max(1, LABEL_WIDTH - label.length))
      : ' '.repeat(OPCODE_COLUMN - 1);
  const starts = { label: 0, opcode: line.length, operand: 0, comment: 0 };

  if (f.opcode !== null) {
    // An empty opcode adds no padding.
    line += f.opcode + (f.opcode ? ' '.repeat(Math.max(1, OPCODE_WIDTH - f.opcode.length)) : '');
  }
  starts.operand = line.length;

  if (f.operand !== null) {
    line += f.operand;
    if (toCommentColumn) line += ' '.repeat(Math.max(1, OPERAND_WIDTH - f.operand.length));
  }
  starts.comment = line.length;

  return { line: line + (f.comment ?? ''), starts };
}

/** Where the cursor goes in the aligned line: the same place in the same field. */
function mapCursor(
  f: Fields,
  place: CursorPlace,
  a: Aligned,
  toCommentColumn: boolean,
  cp: number,
) {
  switch (place.in) {
    case 'label':
      return a.starts.label + clamp(place.offset, 0, (f.label ?? '').length);
    case 'opcode':
      return a.starts.opcode + clamp(place.offset, 0, (f.opcode ?? '').length);
    case 'operand':
      return a.starts.operand + clamp(place.offset, 0, (f.operand ?? '').length);
    case 'comment':
      return a.starts.comment + clamp(place.offset, 0, (f.comment ?? '').length);
    case 'spaces':
      if (place.after === 'start' || place.after === 'label') return a.starts.opcode;
      if (place.after === 'opcode') return a.starts.operand;
      return toCommentColumn ? a.starts.comment : a.line.length;
    case 'end':
      return toCommentColumn ? a.starts.comment : a.line.length;
    case 'nowhere':
      return cp;
  }
}

// ---------------------------------------------------------------------------------------
// The three kinds of edit
// ---------------------------------------------------------------------------------------

interface Result {
  line: string;
  cursor: number;
}

/**
 * After Backspace: deleting a space collapses the whole run of spaces left of the cursor,
 * unless a space follows (then the run is column padding and stays). Deleting anything
 * else leaves the spacing alone.
 */
function afterBackspace(s: string, cp: number, erased: string | null): Result {
  const erasedSpaces = !!erased && /^[ \t]+$/.test(erased);
  const spaceFollows = cp < s.length && s[cp] === ' ';
  if (erasedSpaces && !spaceFollows && cp > 0 && s[cp - 1] === ' ') {
    let start = cp - 1;
    while (start > 0 && s[start - 1] === ' ') start--;
    return { line: s.slice(0, start) + s.slice(cp), cursor: start };
  }
  return { line: s, cursor: cp };
}

/**
 * After Space (or Tab): step to the next column. The first space after the opcode goes to
 * the operand column, the first space after the operand to the comment column.
 */
function afterSpace(s: string, cp: number, f: Fields, place: CursorPlace): Result {
  // Moving on from the operand needs the operand to be finished: the cursor at the end of
  // the line and its quotes closed (a space inside C'A B' is text). Unless there is already
  // a comment, a space typed anywhere else around the operand changes nothing.
  const hasCommentText = f.commentStart >= 0 && /[^ \t]/.test(f.comment ?? '');
  const aroundOperand =
    place.in === 'operand' ||
    (place.in === 'spaces' && place.after === 'operand') ||
    cp === f.codeEnd;
  const operandText = f.operandSpan ? s.slice(f.operandSpan.start, f.operandSpan.end) : '';
  if (!hasCommentText && aroundOperand && !(cp === s.length && quotesClosed(operandText))) {
    return { line: s, cursor: cp };
  }

  // The character before the space just typed (when exactly one was typed).
  const typedAfter = cp > 1 && s[cp - 1] === ' ' && !isSpace(s[cp - 2]) ? cp - 2 : -1;
  const typedAfterOpcode = typedAfter !== -1 && within(f.opcodeSpan, typedAfter);
  // ...but the space after a comma belongs to the operand (BUFFER, X).
  const typedAfterOperand =
    typedAfter !== -1 && within(f.operandSpan, typedAfter) && s[typedAfter] !== ',';

  let stepTo: 'operand' | 'comment' | null = null;
  if (typedAfterOpcode) stepTo = 'operand';
  else if (typedAfterOperand) stepTo = 'comment';
  else if (place.in === 'spaces' && place.after === 'opcode') stepTo = 'comment';
  else if (place.in === 'spaces' && place.after === 'label') stepTo = 'operand';
  else if (f.operand === '' && cp >= align(f, false).starts.operand) stepTo = 'comment';

  const toCommentColumn = !!f.comment || stepTo === 'comment';
  const aligned = align(f, toCommentColumn);
  const cursor =
    stepTo === 'operand'
      ? aligned.starts.operand
      : stepTo === 'comment'
        ? aligned.starts.comment
        : mapCursor(f, place, aligned, toCommentColumn, cp);
  return { line: aligned.line, cursor };
}

/** After Enter or a paste: lay the line out again, keeping the cursor in its field. */
function reflow(f: Fields, place: CursorPlace, cp: number): Result {
  const toCommentColumn = !!f.comment;
  const aligned = align(f, toCommentColumn);
  return { line: aligned.line, cursor: mapCursor(f, place, aligned, toCommentColumn, cp) };
}

// ---------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------

/**
 * Realign one line after a key has been applied.
 *
 * @param line       the line, possibly ending with '\n' (kept)
 * @param backspace  the key was Backspace
 * @param space      the key was Space or Tab
 * @param cursorPos  cursor index in the line, after the edit
 * @param selStart   selection start; with a selection, the line is left as it is
 * @param selEnd     selection end
 * @param erased     what Backspace removed
 */
export function autoIndentLine(
  line: string,
  backspace: boolean = false,
  space: boolean = false,
  cursorPos: number = 0,
  selStart?: number,
  selEnd?: number,
  erased: string | null = null,
): Result {
  if (typeof selStart === 'number' && typeof selEnd === 'number' && selStart !== selEnd) {
    return { line, cursor: cursorPos };
  }

  const newline = line.endsWith('\n') ? '\n' : '';
  const raw = newline ? line.slice(0, -1) : line;
  const cp = clamp(cursorPos, 0, raw.length);
  const s = raw.replace(/\t/g, ' ');
  const withNewline = (r: Result): Result => ({ line: r.line + newline, cursor: r.cursor });

  if (backspace) return withNewline(afterBackspace(s, cp, erased));

  const isBlank = firstNonSpace(s) === -1;
  if (isBlank) {
    // The first space on an empty line jumps to the opcode column.
    const typedOneSpace = space && cp > 0 && s[cp - 1] === ' ' && (cp < 2 || !isSpace(s[cp - 2]));
    if (typedOneSpace) {
      return withNewline({ line: ' '.repeat(OPCODE_COLUMN - 1), cursor: OPCODE_COLUMN - 1 });
    }
    if (!space) return withNewline({ line: s, cursor: cp });
  }

  const f = parseFields(s);
  const place = cursorPlace(f, cp);

  // Spaces inside a comment are text.
  if (space && f.comment !== null && place.in === 'comment')
    return withNewline({ line: s, cursor: cp });

  // A comment line starts at column 1.
  if (f.isCommentLine) {
    const dot = s.indexOf('.', firstNonSpace(s));
    return withNewline({ line: s.slice(dot), cursor: Math.max(0, cp - dot) });
  }

  // A field wider than its column is left as typed.
  const tooWide =
    (f.label !== null && f.label.length > LABEL_WIDTH) ||
    (f.opcode !== null && f.opcode.length > OPCODE_WIDTH) ||
    (f.operand !== null && f.operand.length > OPERAND_WIDTH);
  if (tooWide) return withNewline({ line: s, cursor: cp });

  return withNewline(space ? afterSpace(s, cp, f, place) : reflow(f, place, cp));
}
