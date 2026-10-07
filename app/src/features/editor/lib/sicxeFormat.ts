// Column layout of SIC/XE assembly: label from column 1, operation from 10, operand from 18,
// comment from 36 (1-based). One line at a time, without the editor: classify the fields,
// lay them out, and the keys the editor gives a meaning to (Space, Tab, Shift+Tab, Backspace,
// Enter). attachAutoIndentation (autoIndentation.ts) applies these to the editor.
//
// The fields are found the way the assembler (SicTools) finds them, with what it knows about
// the operations:
// - a label is the word at column 1, unless that word is an operation and the next one is not
//   ("LDA ZERO" typed at column 1 is an instruction, not the label LDA);
// - an indented word is a label when the next word is an operation ("  LOOP LDA X");
// - operations without operand (RSUB, LTORG, ...) are followed by the comment;
// - an operand may contain spaces inside quotes (C'A B') and around commas and operators
//   (BUF ,X  /  BUF - X1), as the assembler accepts them;
// - whatever follows the operand is the comment.
// Self-contained (no imports), so that tools and tests outside the app can use it too.

/** Where each field starts (0-based). */
export const OPCODE_COLUMN = 9;
export const OPERAND_COLUMN = 17;
export const COMMENT_COLUMN = 35;
const COLUMNS = [0, OPCODE_COLUMN, OPERAND_COLUMN, COMMENT_COLUMN];

// The SIC/XE operations and directives of the assembler (SicTools, sicxe/common/Mnemonics.java).
const OPERATIONS = new Set(
  (
    'ADD ADDF ADDR AND CLEAR COMP COMPF COMPR DIV DIVF DIVR FIX FLOAT HIO J JEQ JGT JLT JSUB ' +
    'LDA LDB LDCH LDF LDL LDS LDT LDX LPS MUL MULF MULR NORM OR RD RMO RSUB SHIFTL SHIFTR SIO ' +
    'SSK STA STB STCH STF STI STL STS STSW STT STX SUB SUBF SUBR SVC TD TIO TIX TIXR WD ' +
    'START END BYTE WORD RESB RESW RESF FLOT BASE NOBASE LTORG EQU ORG CSECT USE EXTDEF EXTREF'
  ).split(' '),
);
/** Operations that take no operand: the rest of the line is the comment. */
const NO_OPERAND = new Set('FIX FLOAT HIO NORM SIO TIO RSUB LTORG NOBASE CSECT'.split(' '));
/** Operations whose operands are registers (written in capitals: the assembler wants A, X, ...). */
const REGISTER_OPERANDS = new Set(
  'ADDR CLEAR COMPR DIVR MULR RMO SHIFTL SHIFTR SUBR TIXR'.split(' '),
);
const REGISTERS = new Set('A X L B S T F PC SW'.split(' '));

/** An operation of SIC/XE, in any case, with or without '+' (format 4). */
export function isOperation(word: string) {
  return OPERATIONS.has(word.toUpperCase().replace(/^\+/, ''));
}

const isSpace = (ch: string | undefined) => ch === ' ' || ch === '\t';

/** Tabs to spaces, except inside quotes: a tab in C'..' is a byte of the program. */
function detab(s: string) {
  let out = '';
  let quote = false;
  for (const ch of s) {
    if (ch === "'") quote = !quote;
    out += ch === '\t' && !quote ? ' ' : ch;
  }
  return out;
}
const OPERATORS = ',+-*/';

// ---------------------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------------------

/** [start, end) in the line. */
export interface Span {
  start: number;
  end: number;
}

export interface Fields {
  kind: 'blank' | 'comment' | 'code';
  label: Span | null;
  opcode: Span | null;
  operand: Span | null;
  comment: Span | null;
}

/** End of the word starting at `i`. */
function wordEnd(s: string, i: number) {
  while (i < s.length && !isSpace(s[i])) i++;
  return i;
}

function skipSpaces(s: string, i: number) {
  while (i < s.length && isSpace(s[i])) i++;
  return i;
}

/**
 * End of the operand starting at `i`: spaces inside quotes belong to it, and spaces next to
 * a comma or an operator ("BUF ,X", "BUF, X", "BUF - X1"), as the assembler reads them.
 */
function operandEnd(s: string, i: number) {
  let quote = false;
  let end = i;
  while (i < s.length) {
    const ch = s[i];
    if (quote) {
      if (ch === "'") quote = false;
      end = ++i;
    } else if (ch === "'") {
      quote = true;
      end = ++i;
    } else if (isSpace(ch)) {
      const next = skipSpaces(s, i);
      const before = s[end - 1];
      if (next < s.length && (OPERATORS.includes(before) || OPERATORS.includes(s[next]))) {
        i = next;
      } else {
        break;
      }
    } else {
      end = ++i;
    }
  }
  return end;
}

/** Split a line into its fields. */
export function classify(s: string): Fields {
  const f: Fields = { kind: 'code', label: null, opcode: null, operand: null, comment: null };
  const lead = skipSpaces(s, 0);
  if (lead === s.length) return { ...f, kind: 'blank' };
  if (s[lead] === '.') return { ...f, kind: 'comment', comment: { start: lead, end: s.length } };

  const w1 = { start: lead, end: wordEnd(s, lead) };
  const after1 = skipSpaces(s, w1.end);
  const w2 =
    after1 < s.length && s[after1] !== '.' ? { start: after1, end: wordEnd(s, after1) } : null;
  const op1 = isOperation(s.slice(w1.start, w1.end));
  const op2 = !!w2 && isOperation(s.slice(w2.start, w2.end));
  const hasLabel = lead === 0 ? !op1 || op2 : !op1 && op2;

  let i: number;
  if (hasLabel) {
    f.label = w1;
    i = after1;
    if (!w2) {
      if (i < s.length) f.comment = { start: i, end: s.length };
      return f;
    }
  } else {
    i = lead;
  }
  f.opcode = { start: i, end: wordEnd(s, i) };
  i = skipSpaces(s, f.opcode.end);
  if (i >= s.length) return f;
  const opcode = s.slice(f.opcode.start, f.opcode.end).toUpperCase();
  if (s[i] !== '.' && !NO_OPERAND.has(opcode)) {
    // A literal of a storage kind has a space inside: =WORD 65535, =BYTE C'A'.
    const literal = /^=(WORD|BYTE|FLOT)\s+/i.exec(s.slice(i));
    f.operand = { start: i, end: operandEnd(s, literal ? i + literal[0].length : i) };
    i = skipSpaces(s, f.operand.end);
  }
  if (i < s.length) f.comment = { start: i, end: s.length };
  return f;
}

const text = (s: string, span: Span | null) => (span ? s.slice(span.start, span.end) : '');

// ---------------------------------------------------------------------------------------
// Corrections: what the assembler would refuse and can only mean one thing
// ---------------------------------------------------------------------------------------

/** The operation in capitals (the assembler knows "LDA", not "lda"). */
function fixOpcode(opcode: string) {
  return isOperation(opcode) ? opcode.toUpperCase() : opcode;
}

/**
 * The operand with its spaces tidied (outside quotes: none next to a comma, one elsewhere), and in capitals where
 * the assembler only takes capitals: C'..' and X'..', the index ",X", register names.
 */
function fixOperand(operand: string, opcode: string) {
  let out = '';
  let quote = false;
  for (let i = 0; i < operand.length; i++) {
    const ch = operand[i];
    if (ch === "'") quote = !quote;
    if (!quote && isSpace(ch)) {
      // A run of spaces: none next to a comma, one elsewhere ("BUF  -  X1" -> "BUF - X1").
      const next = skipSpaces(operand, i);
      if (!out.endsWith(',') && operand[next] !== ',') out += ' ';
      i = next - 1;
      continue;
    }
    out += ch;
  }
  // C'..' / X'..' (also after '=' of a literal); the text inside the quotes is left alone.
  out = out.replace(
    /^(=?)([cx])'/,
    (_, eq: string, letter: string) => `${eq}${letter.toUpperCase()}'`,
  );
  if (!out.includes("'")) out = out.replace(/,x$/, ',X');
  if (REGISTER_OPERANDS.has(opcode.toUpperCase())) {
    out = out
      .split(',')
      .map(r => (REGISTERS.has(r.toUpperCase()) ? r.toUpperCase() : r))
      .join(',');
  }
  return out;
}

/** A comment starts with '.' (the assembler reads anything else as an operation). */
function fixComment(comment: string) {
  if (comment.startsWith('.')) return comment;
  // Not when it may be a broken operand or data ("- X1", "'B'", "65535", "C'A'"): the error
  // stays visible instead of a meaning that was not written.
  if (/^([,+\-*/=#@'"\d]|[CXcx]')/.test(comment)) return comment;
  return `. ${comment}`;
}

// ---------------------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------------------

export interface Layout {
  line: string;
  /** Where each field starts in `line`; -1 when it is absent. */
  starts: { label: number; opcode: number; operand: number; comment: number };
}

/** Pad `line` to `column`, or one space past its end if it is already there. */
const padTo = (line: string, column: number) =>
  line.length === 0 && column === 0 ? '' : line + ' '.repeat(Math.max(1, column - line.length));

export interface LayoutOptions {
  /** Apply the corrections (capitals, comment dot, commas). */
  fix?: boolean;
}

/**
 * Lay a line out in its columns. A field starts at its column, or one space after the field
 * before when that one is too long. A comment line starts at column 1; tabs become spaces
 * (not inside quotes).
 */
export function layout(raw: string, { fix = false }: LayoutOptions = {}): Layout {
  const s = detab(raw);
  const f = classify(s);
  const starts = { label: -1, opcode: -1, operand: -1, comment: -1 };
  if (f.kind === 'blank') return { line: '', starts };
  if (f.kind === 'comment') {
    starts.comment = 0;
    return { line: text(s, f.comment).trimEnd(), starts };
  }
  let line = '';
  if (f.label) {
    starts.label = 0;
    line = text(s, f.label);
  }
  const opcode = text(s, f.opcode);
  if (f.opcode) {
    line = padTo(line, OPCODE_COLUMN);
    starts.opcode = line.length;
    line += fix ? fixOpcode(opcode) : opcode;
  }
  if (f.operand) {
    line = padTo(line, OPERAND_COLUMN);
    starts.operand = line.length;
    line += fix ? fixOperand(text(s, f.operand), opcode) : text(s, f.operand);
  }
  if (f.comment) {
    line = padTo(line, COMMENT_COLUMN);
    starts.comment = line.length;
    const comment = text(s, f.comment).trimEnd();
    // Only after a known operation: with an unknown one, where its operand ends is a guess.
    line += fix && (!f.opcode || isOperation(opcode)) ? fixComment(comment) : comment;
  }
  return { line, starts };
}

/** A whole line laid out and corrected (Enter, paste, Format Document, leaving a line). */
export const formatLine = (line: string) => layout(line, { fix: true }).line;

/**
 * Lines pasted together: each one formatted, after two repairs of the block as a whole.
 * - Line numbers in front of every line (textbook figures: "5  COPY START 1000") are dropped:
 *   a SIC label never starts with a digit.
 * - A block indented as a whole (copied from a page or a document) is moved left by its
 *   least indentation, so that its labels are at column 1 again.
 */
export function formatPasted(lines: string[]) {
  const nonBlank = (ls: string[]) => ls.filter(l => l.trim() !== '');
  let block = lines.map(detab);
  const numbered = nonBlank(block).filter(l => /^\s*\d+(\s|$)/.test(l));
  if (nonBlank(block).length >= 2 && numbered.length === nonBlank(block).length) {
    block = block.map(l => l.replace(/^(\s*)\d+(\s+|$)/, (_, a: string, b: string) => a + b));
  }
  if (nonBlank(block).length >= 2) {
    const least = Math.min(...nonBlank(block).map(l => l.length - l.trimStart().length));
    if (least > 0)
      block = block.map(l => l.slice(Math.min(least, l.length - l.trimStart().length)));
  }
  return block.map(formatLine);
}

// ---------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------

export interface Edit {
  line: string;
  /** Cursor index in `line`. */
  cursor: number;
}

type FieldName = 'label' | 'opcode' | 'operand' | 'comment';
const FIELD_NAMES: FieldName[] = ['label', 'opcode', 'operand', 'comment'];

/** The fields of a line that are there, in order, with their starts (for Tab and Shift+Tab). */
function presentFields(s: string) {
  const f = classify(s);
  return FIELD_NAMES.filter(name => f[name]).map(name => ({ name, start: f[name]!.start }));
}
const fieldStarts = (s: string) => presentFields(s).map(x => x.start);

/** Inside quotes at `i` (an odd number of quotes before it, outside a comment). */
function inQuotes(s: string, i: number) {
  return (s.slice(0, i).match(/'/g) ?? []).length % 2 === 1;
}

/**
 * Space or Tab with only spaces after the cursor: go to the next column. The line is laid out
 * as far as it is typed (the operation in capitals once it is complete), with the spaces up
 * to the cursor. Space inside quotes, a comment, or right after a comma or an operator, is
 * a space; Tab there goes to the next tab stop (8).
 */
function stepAtEnd(left: string, tab: boolean): Edit {
  const s = detab(left);
  const f = classify(s.trimEnd());
  const plainSpace = () => plainSpaceFor(s, tab);
  if (f.kind === 'blank') return { line: ' '.repeat(OPCODE_COLUMN), cursor: OPCODE_COLUMN };
  // A comment line starts at column 1; in it, a space is a space.
  if (f.kind === 'comment') return plainSpaceFor(s.slice(f.comment!.start), tab);
  if (f.comment) return plainSpace();
  const trimmed = s.trimEnd();
  if (f.operand) {
    const operand = text(trimmed, f.operand);
    if (inQuotes(operand, operand.length) || OPERATORS.includes(operand.at(-1)!)) {
      return plainSpace();
    }
  }
  const a = layout(trimmed, { fix: true });
  // The field typed last decides the next column.
  let column: number;
  if (f.operand) column = COMMENT_COLUMN;
  else if (f.opcode) {
    const opcode = text(trimmed, f.opcode).toUpperCase();
    column = NO_OPERAND.has(opcode) ? COMMENT_COLUMN : OPERAND_COLUMN;
  } else column = OPCODE_COLUMN;
  const line = a.line.trimEnd();
  const padded = line + ' '.repeat(Math.max(1, column - line.length));
  return { line: padded, cursor: padded.length };
}

function plainSpaceFor(s: string, tab: boolean): Edit {
  const n = tab ? 8 - (s.length % 8) : 1;
  return { line: s + ' '.repeat(n), cursor: s.length + n };
}

/**
 * Space or Tab. At the end of the line: the next column (stepAtEnd). In the middle of a line:
 * Space in a word or in quotes or in a comment is a space; elsewhere (between fields) it
 * moves the cursor to the next field, as Tab always does.
 */
export function onSpace(line: string, cursor: number, tab = false): Edit {
  const s = detab(line);
  const cp = Math.max(0, Math.min(cursor, s.length));
  const left = s.slice(0, cp);
  const right = s.slice(cp);
  if (right.trim() === '') return stepAtEnd(left, tab);

  const f = classify(s);
  const inComment = (!!f.comment && cp > f.comment.start) || f.kind === 'comment';
  const insert = (): Edit => {
    const n = tab ? 8 - (cp % 8) : 1;
    return { line: left + ' '.repeat(n) + right, cursor: cp + n };
  };
  if (inComment) return insert();
  const inWord = !isSpace(s[cp - 1]) && cp > 0 && !isSpace(s[cp]);
  if (!tab && (inWord || inQuotes(s, cp))) return insert();
  // Tab inside a word, or Space/Tab between fields: to the next field, the line laid out.
  const next = presentFields(s).find(x => x.start > cp);
  const a = layout(s);
  if (!next) return { line: a.line, cursor: a.line.length };
  return { line: a.line, cursor: a.starts[next.name] };
}

/** Shift+Tab: the cursor goes to the start of the field before it. */
export function onShiftTab(line: string, cursor: number): Edit {
  const starts = fieldStarts(line);
  const previous = [...starts].reverse().find(start => start < cursor) ?? 0;
  return { line, cursor: previous };
}

/**
 * Backspace (no selection), before the editor deletes anything; null leaves it to the editor.
 * - In the spaces in front of an instruction: the cursor goes to column 1 (to type a label);
 *   the instruction stays in its column.
 * - In the spaces between two fields: the cursor goes back to the end of the field before
 *   (the padding is the layout's, not text).
 * - In the spaces at the end of the line (after a step to the next column): they go, back to
 *   the end of the last field.
 */
export function onBackspace(line: string, cursor: number): Edit | null {
  const s = detab(line);
  const cp = Math.max(0, Math.min(cursor, s.length));
  if (cp === 0 || !isSpace(s[cp - 1])) return null;
  let start = cp;
  while (start > 0 && isSpace(s[start - 1])) start--;
  const rest = s.slice(cp);
  if (start === 0) {
    // A blank line, or the indentation of an instruction.
    return rest.trim() === '' ? { line: rest.trimStart(), cursor: 0 } : { line: s, cursor: 0 };
  }
  if (inQuotes(s, cp)) return null;
  const f = classify(s);
  if (f.kind === 'comment' || (f.comment && cp > f.comment.start)) return null;
  if (rest.trim() === '') return { line: s.slice(0, start), cursor: start };
  return { line: s, cursor: start };
}

/**
 * Enter (no selection), at a cursor that is not at column 1. The part before the cursor is
 * laid out and corrected; the new line starts at the operation's column, with the rest of
 * the line (if any) laid out after it.
 */
export function onEnter(
  line: string,
  cursor: number,
): { before: string; after: string; cursor: number } {
  const s = detab(line);
  const cp = Math.max(0, Math.min(cursor, s.length));
  const before = formatLine(s.slice(0, cp));
  const rest = s.slice(cp).trimStart();
  if (rest === '') return { before, after: ' '.repeat(OPCODE_COLUMN), cursor: OPCODE_COLUMN };
  // Splitting a comment: the rest is a comment line of its own.
  const f = classify(s);
  if (f.comment && cp > f.comment.start) {
    return { before, after: `. ${rest}`, cursor: 2 };
  }
  const a = layout(' '.repeat(OPCODE_COLUMN) + rest, { fix: true });
  const first = [a.starts.label, a.starts.opcode, a.starts.operand, a.starts.comment].filter(
    x => x >= 0,
  );
  return { before, after: a.line, cursor: Math.min(...first) };
}

/** The columns, for a ruler or a test. */
export { COLUMNS };
