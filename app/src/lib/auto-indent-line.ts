// -------------------------------------------------------------
// Column layout (Leland SIC/XE style)
// -------------------------------------------------------------
const COL_OPCODE_START = 10;   // Command starts in col 10 (1-based)
const COL_OPERAND_START = 18;  // Operand starts in col 18 (1-based)
const COL_COMMENT_START = 36;  // Comment starts in col 36 (1-based)

// Derived field lengths
const LEN_LABEL_FIELD   = COL_OPCODE_START - 1;                  // 9
const LEN_INSTR_FIELD   = COL_OPERAND_START - COL_OPCODE_START;  // 8
const LEN_OPERAND_FIELD = COL_COMMENT_START - COL_OPERAND_START; // 18

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function is_space(ch: string): boolean {
  return ch === ' ' || ch === '\t';
}
function replace_tabs_with_spaces(s: string): string {
  return s.replace(/\t/g, ' ');
}
function span_spaces(s: string, i: number): number {
  let j = i;
  while (j < s.length && is_space(s[j])) j++;
  return j - i;
}
function span_token(s: string, i: number): [string, number] {
  let j = i;
  while (j < s.length && !is_space(s[j])) j++;
  return [s.slice(i, j), j];
}
// operand can include spaces while quotes are open (outermost only)
// CHANGE: additionally allow exactly one "comma + single space" sequence to be part of operand.
function span_operand(s: string, i: number): [string, number] {
  let j = i;
  let q: "'" | '"' | null = null;
  let allowPostCommaSpace = false; // allow one space right after a comma
  while (j < s.length) {
    const ch = s[j];
    if (q) {
      if (ch === q) q = null;
      j++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      q = ch as "'" | '"';
      j++;
      continue;
    }
    if (ch === ',') {
      allowPostCommaSpace = true;
      j++;
      continue;
    }
    if (is_space(ch)) {
      if (allowPostCommaSpace) {
        // consume exactly one space after a comma as part of operand
        j++;
        allowPostCommaSpace = false;
        continue;
      }
      break; // only splits on space when not inside quotes and not the single post-comma space
    }
    allowPostCommaSpace = false; // reset when a non-space, non-comma char appears
    j++;
  }
  return [s.slice(i, j), j];
}
function first_nonspace_index(s: string): number {
  let i = 0;
  while (i < s.length && is_space(s[i])) i++;
  return i === s.length ? -1 : i;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function stripTrailingSpaces(s: string): string {
  return s.replace(/[ \t]+$/g, '');
}
function log(...args: any[]) {
  console.log('[autoIndentLine]', ...args);
}
function quotesClosed(text: string): boolean {
  const singles = (text.match(/'/g) || []).length;
  const doubles = (text.match(/"/g) || []).length;
  return (singles % 2 === 0) && (doubles % 2 === 0);
}

type SectionName = 'label' | 'command' | 'operand' | 'comment' | 'space' | 'none';
type MaybeStr = string | null;
interface Range { start: number; end: number; } // [start,end)

interface Parsed {
  line: string;
  codePart: string;
  commentPart: MaybeStr;
  commentStartIndex: number; // -1 if none
  label: MaybeStr;     // null: absent
  command: MaybeStr;   // null: absent, "": present-but-empty
  operand: MaybeStr;   // null: absent, "": present-but-empty
  leadingSpaces: Range;
  sp1: Range | null;   // spaces label→command
  sp2: Range | null;   // spaces command→operand
  sp3: Range | null;   // spaces operand→(comment|EOL)
  labelR: Range | null;
  commandR: Range | null;
  operandR: Range | null;
  isCommentLine: boolean; // leading '.' after spaces
  orderValid: boolean;
}

function parseLineStructure(s: string): Parsed {
  // Inline comment is determined by structure, not by '.'
  // We DO NOT pre-slice by column; we preserve the entire original line.
  const fns = first_nonspace_index(s);
  const isCommentLine = fns >= 0 && s[fns] === '.';

  let i = 0;
  const lead = span_spaces(s, i);
  const leadingSpaces: Range = { start: 0, end: lead };
  i += lead;

  let label: MaybeStr = null;
  let command: MaybeStr = null;
  let operand: MaybeStr = null;

  let labelR: Range | null = null;
  let commandR: Range | null = null;
  let operandR: Range | null = null;

  let sp1: Range | null = null;
  let sp2: Range | null = null;
  let sp3: Range | null = null;

  // Start with no comment split
  let commentStartIndex = -1;
  let codePartEnd = s.length;

  if (!isCommentLine) {
    if (lead === 0) {
      if (i < s.length) {
        // LABEL
        const [tokL, nextL] = span_token(s, i);
        label = tokL;
        labelR = { start: i, end: nextL };
        i = nextL;

        const s1 = span_spaces(s, i);
        sp1 = { start: i, end: i + s1 };
        i += s1;

        // COMMAND
        if (i < s.length) {
          const [tokC, nextC] = span_token(s, i);
          command = tokC;
          commandR = { start: i, end: nextC };
          i = nextC;

          const s2 = span_spaces(s, i);
          sp2 = { start: i, end: i + s2 };
          i += s2;

          // OPERAND
          if (i < s.length) {
            const [tokO, nextO] = span_operand(s, i);
            operand = tokO;
            operandR = { start: i, end: nextO };
            i = nextO;

            const s3 = span_spaces(s, i);
            sp3 = { start: i, end: i + s3 };
            i += s3;

            // If there is any non-space left after operand + spaces, that tail is comment
            if (i < s.length) {
              commentStartIndex = i;
              codePartEnd = i;
            } else {
              codePartEnd = s.length;
            }
          } else if (sp2 && sp2.end > sp2.start) {
            // spaces after command but no operand token → operand present-but-empty
            operand = '';
            const s3 = span_spaces(s, i);
            sp3 = { start: i, end: i + s3 };
            i += s3;
            if (i < s.length) {
              commentStartIndex = i;
              codePartEnd = i;
            } else {
              codePartEnd = s.length;
            }
          }
        } else if (sp1 && sp1.end > sp1.start) {
          // spaces after label but no command token → command present-but-empty
          command = '';
          const s3 = span_spaces(s, i);
          sp3 = { start: i, end: i + s3 };
          i += s3;
          if (i < s.length) {
            commentStartIndex = i;
            codePartEnd = i;
          } else {
            codePartEnd = s.length;
          }
        }
      }
    } else {
      // no label → COMMAND first
      if (i < s.length) {
        const [tokC, nextC] = span_token(s, i);
        command = tokC;
        commandR = { start: i, end: nextC };
        i = nextC;

        const s2 = span_spaces(s, i);
        sp2 = { start: i, end: i + s2 };
        i += s2;

        if (i < s.length) {
          const [tokO, nextO] = span_operand(s, i);
          operand = tokO;
          operandR = { start: i, end: nextO };
          i = nextO;

          const s3 = span_spaces(s, i);
          sp3 = { start: i, end: i + s3 };
          i += s3;

          if (i < s.length) {
            commentStartIndex = i;
            codePartEnd = i;
          } else {
            codePartEnd = s.length;
          }
        } else if (sp2 && sp2.end > sp2.start) {
          operand = '';
          const s3 = span_spaces(s, i);
          sp3 = { start: i, end: i + s3 };
          i += s3;
          if (i < s.length) {
            commentStartIndex = i;
            codePartEnd = i;
          } else {
            codePartEnd = s.length;
          }
        }
      }
    }
  }

  const codePart = s.slice(0, codePartEnd);
  const commentPart: MaybeStr = commentStartIndex >= 0 ? s.slice(commentStartIndex) : null;

  // validity: allow comment lines or any line that could be [label]? spaces command? spaces operand?
  let orderValid = true;
  if (!isCommentLine) {
    if (leadingSpaces.end > 0 && label !== null) orderValid = false;
  }

  return {
    line: s,
    codePart,
    commentPart,
    commentStartIndex,
    label, command, operand,
    leadingSpaces,
    sp1, sp2, sp3,
    labelR, commandR, operandR,
    isCommentLine,
    orderValid,
  };
}

function classifyCursor(
  s: string,
  p: Parsed,
  cp: number
): { section: SectionName; whichSpace: 0|1|2|3|9|null; rel: number } {
  const { codePart, leadingSpaces, sp1, sp2, sp3, labelR, commandR, operandR, commentStartIndex } = p;

  if (commentStartIndex >= 0 && cp >= commentStartIndex) {
    return { section: 'comment', whichSpace: null, rel: cp - commentStartIndex };
  }

  if (cp <= codePart.length) {
    // half-open checks [start,end)
    if (labelR && cp >= labelR.start && cp < labelR.end) {
      return { section: 'label', whichSpace: null, rel: cp - labelR.start };
    }
    if (commandR && cp >= commandR.start && cp < commandR.end) {
      return { section: 'command', whichSpace: null, rel: cp - commandR.start };
    }
    if (operandR && cp >= operandR.start && cp < operandR.end) {
      return { section: 'operand', whichSpace: null, rel: cp - operandR.start };
    }
    if (cp >= leadingSpaces.start && cp < leadingSpaces.end) {
      return { section: 'space', whichSpace: 0, rel: cp - leadingSpaces.start };
    }
    if (sp1 && cp >= sp1.start && cp < sp1.end) {
      return { section: 'space', whichSpace: 1, rel: cp - sp1.start };
    }
    if (sp2 && cp >= sp2.start && cp < sp2.end) {
      return { section: 'space', whichSpace: 2, rel: cp - sp2.start };
    }
    if (sp3 && cp >= sp3.start && cp < sp3.end) {
      return { section: 'space', whichSpace: 3, rel: cp - sp3.start };
    }
    if (cp === codePart.length) {
      if (p.command === '' && p.sp1) return { section: 'command', whichSpace: null, rel: 0 };
      if (p.operand === '' && p.sp2) return { section: 'operand', whichSpace: null, rel: 0 };
      return { section: 'space', whichSpace: 9, rel: 0 };
    }
  }
  return { section: 'none', whichSpace: null, rel: 0 };
}

function buildAlignedLine(
  label: MaybeStr,
  command: MaybeStr,
  operand: MaybeStr,
  commentPart: MaybeStr,
  engageCommentColumn: boolean
): { out: string; starts: Record<'label'|'command'|'operand'|'comment', number> } {
  const L = label ?? '';
  const C = command ?? null;   // null = absent, '' = present-but-empty
  const O = operand ?? null;   // null = absent, '' = present-but-empty

  let starts = { label: 0, command: 0, operand: 0, comment: 0 };

  // label → command start
  let line = '';
  if (L.length > 0) {
    const gap1 = Math.max(1, LEN_LABEL_FIELD - L.length);
    line = L + ' '.repeat(gap1);
    starts.label = 0;
    starts.command = line.length;
  } else {
    const needed = Math.max(0, COL_OPCODE_START - 1);
    line = ' '.repeat(needed);
    starts.command = line.length;
    starts.label = 0;
  }

  // command
  if (C !== null) {
    line += C;
    const gap2 = (C.length > 0) ? Math.max(1, LEN_INSTR_FIELD - C.length) : 0; // no push when empty
    line += ' '.repeat(gap2);
  }
  starts.operand = line.length;

  // operand
  if (O !== null) {
    line += O;
    const gap3 = (engageCommentColumn) ? Math.max(1, LEN_OPERAND_FIELD - O.length) : 0;
    line += ' '.repeat(gap3);
  }
  starts.comment = line.length;

  const out = line + (commentPart ?? '');
  log('buildAlignedLine', {
    L, C, O, engageCommentColumn,
    starts,
    outPreview: out.slice(0, 80)
  });
  return { out, starts };
}

// -------------------------------------------------------------
// Public API
// -------------------------------------------------------------
/**
 * Auto-indent a single line of assembly-like code (called AFTER a keystroke).
 *
 * @param line         Current line (may end with '\n')
 * @param backspace    True if the last action was Backspace (already applied by editor)
 * @param space        True if the last action was Space (already applied by editor)
 * @param cursorpos    Cursor index into the CURRENT line (AFTER the edit)
 * @param selStart     (optional) selection start in CURRENT line
 * @param selEnd       (optional) selection end in CURRENT line
 * @param erased       (optional) text that was erased by the edit; null if none
 * @param lineChanged  (optional) true if this keystroke changed line structure (Enter/Backspace join)
 * @param prevPos      (optional) cursor position BEFORE the edit (for context if needed)
 * @returns            { line, cursor } — adjusted line and where the cursor should go
 */
export function autoIndentLine(
  line: string,
  backspace: boolean = false,
  space: boolean = false,
  cursorpos: number = 0,
  selStart?: number,
  selEnd?: number,
  erased: string | null = null,
  lineChanged: boolean = false,
  prevPos?: { lineNumber: number; column: number },
): { line: string; cursor: number } {
  console.group?.('[autoIndentLine] call');

  let had_nl = false;
  let raw = line;
  if (raw.endsWith('\n')) { had_nl = true; raw = raw.slice(0, -1); }

  // 1) SELECTION short-circuit (if provided and non-empty)
  if (typeof selStart === 'number' && typeof selEnd === 'number' && selStart !== selEnd) {
    log('Selection detected — skipping formatting', { selStart, selEnd, backspace, space, erased, lineChanged, prevPos });
    console.groupEnd?.();
    return { line, cursor: cursorpos };
  }

  let cp = clamp(cursorpos, 0, raw.length);
  log('INPUT', { raw, backspace, space, cursorpos, had_nl, erased, lineChanged, prevPos });

  // normalize tabs early
  let s = replace_tabs_with_spaces(raw);

  // ---------------------------------------------------------
  // 0) BACKSPACE handling (post-edit)
  // ---------------------------------------------------------
  if (backspace) {
    const erasedIsSpaces = !!erased && /^[ \t]+$/.test(erased);
    const erasedIsNonspace = !!erased && !/^[ \t]+$/.test(erased);

    // If next char is a space, DO NOT collapse run
    const nextCharIsSpace = cp < s.length && s[cp] === ' ';

    if (erasedIsSpaces && !nextCharIsSpace) {
      // collapse the entire left run
      let k = cp - 1;
      if (k >= 0 && s[k] === ' ') {
        while (k >= 0 && s[k] === ' ') k--;
        const start = k + 1;
        const before = s;
        s = s.slice(0, start) + s.slice(cp);
        const newCp = start;
        log('Backspace collapse(left-run)', { before, after: s, oldCp: cp, newCp, removed: cp - start });
        cp = newCp;
      } else {
        log('Backspace deleted spaces but no left run — nothing to collapse');
      }
    } else if (erasedIsSpaces && nextCharIsSpace) {
      log('Backspace: next char is space → skip collapse (keep structural run)');
    } else if (erasedIsNonspace) {
      log('Backspace deleted non-space token — preserve structural spaces (no trailing strip)');
    } else {
      log('Backspace erased unknown — conservative: do not strip trailing spaces automatically');
    }

    console.groupEnd?.();
    return { line: s + (had_nl ? '\n' : ''), cursor: cp };
  }

  // ---------------------------------------------------------
  // SPACE / general handling (post-edit)
  // ---------------------------------------------------------

  // Compute once
  const isBlank = first_nonspace_index(s) === -1;

  // (A) Blank/empty line + Space → jump to command column
  const justInsertedSingleSpace =
    space && cp > 0 && s[cp - 1] === ' ' && (cp - 2 < 0 || !is_space(s[cp - 2]));
  if (isBlank && justInsertedSingleSpace) {
    const toOpcode = ' '.repeat(COL_OPCODE_START - 1); // col 10 → index 9
    const out = toOpcode + (had_nl ? '\n' : '');
    log('Blank + Space → indent to opcode column', { outPreview: out });
    console.groupEnd?.();
    return { line: out, cursor: toOpcode.length };
  }

  // If not space/backspace and blank line (enter/paste), do nothing
  if (!space && !backspace && isBlank) {
    log('Non-space/backspace on blank line → no reflow');
    console.groupEnd?.();
    return { line: s + (had_nl ? '\n' : ''), cursor: cp };
  }

  // Parse for the rest
  const parsed = parseLineStructure(s);
  log('PARSED', {
    codePart: parsed.codePart,
    commentPart: parsed.commentPart,
    label: parsed.label, command: parsed.command, operand: parsed.operand,
    ranges: {
      leadingSpaces: parsed.leadingSpaces, sp1: parsed.sp1, sp2: parsed.sp2, sp3: parsed.sp3,
      labelR: parsed.labelR, commandR: parsed.commandR, operandR: parsed.operandR,
    },
    isCommentLine: parsed.isCommentLine,
    orderValid: parsed.orderValid,
  });

  const cur = classifyCursor(s, parsed, cp);
  log('CURSOR', { cp, section: cur.section, whichSpace: cur.whichSpace, rel: cur.rel });

  /* If a space was typed inside the comment section, skip all logic */
  if (space && parsed.commentPart !== null && cur.section === 'comment') {
    log('Space inside comment → skip auto-indent / reflow');
    console.groupEnd?.();
    return { line: s + (had_nl ? '\n' : ''), cursor: cp };
  }

  // (B) Comment line → strip spaces before first '.'
  if (parsed.isCommentLine) {
    const dot = s.indexOf('.', first_nonspace_index(s));
    const out = s.slice(dot) + (had_nl ? '\n' : '');
    log('Comment-line -> strip leading before "."', { before: s, after: out });
    console.groupEnd?.();
    return { line: out, cursor: Math.max(0, cp - dot) };
  }

  // (C) If invalid order, don’t reflow
  if (!parsed.orderValid) {
    log('Order invalid -> unchanged');
    console.groupEnd?.();
    return { line: s + (had_nl ? '\n' : ''), cursor: cp };
  }

  // Bail if any section exceeds its field width
  const tooWide =
    (parsed.label !== null && parsed.label.length > LEN_LABEL_FIELD) ||
    (parsed.command !== null && parsed.command.length > LEN_INSTR_FIELD) ||
    (parsed.operand !== null && parsed.operand.length > LEN_OPERAND_FIELD);
  if (tooWide) {
    log('Width overflow → no auto-indent');
    console.groupEnd?.();
    return { line: s + (had_nl ? '\n' : ''), cursor: cp };
  }

  // Guard: only allow stepping to comment when (a) EOL and (b) operand quotes are closed.
  // Otherwise, when there is no real inline comment content, do not correct.
  if (space) {
    const inlineCommentExists = parsed.commentStartIndex >= 0;
    const inlineCommentHasNonspace = inlineCommentExists && /[^ \t]/.test(parsed.commentPart ?? '');

    const inOperand = cur.section === 'operand';
    const afterOperandSpace = cur.section === 'space' && cur.whichSpace === 3;
    const atCodeEnd = cp === s.length;

    const operandText = parsed.operandR ? s.slice(parsed.operandR.start, parsed.operandR.end) : '';
    const opQuotesClosed = quotesClosed(operandText);

    if ((!inlineCommentExists || !inlineCommentHasNonspace) &&
        (inOperand || afterOperandSpace || cp === parsed.codePart.length) &&
        !(atCodeEnd && opQuotesClosed)) {
      log('No inline comment content; not at EOL with closed quotes → no correction');
      console.groupEnd?.();
      return { line: s + (had_nl ? '\n' : ''), cursor: cp };
    }
  }

  // ---------------------------------------------------------
  // D) SPACE → column stepper logic (command → operand → comment)
  // ---------------------------------------------------------
  if (space) {
    // Build a baseline (no comment engagement) so we know exact starts.* positions
    const baseline = buildAlignedLine(
      parsed.label,
      parsed.command,
      parsed.operand,
      parsed.commentPart,
      false // no comment engagement for baseline
    );

    // Decide step target
    let stepTo: 'operand' | 'comment' | null = null;
    const hasComment = !!parsed.commentPart && parsed.commentPart.length > 0;

    // Always boolean
    let engageComment = false;

    // Helper: previous *non-space* index for this event (only reliable when a single space was inserted)
    const prevNonSpaceIdx =
      (cp > 1 && s[cp - 1] === ' ' && !is_space(s[cp - 2])) ? (cp - 2) : -1;

    // 1) If just typed first space right after COMMAND token → go to OPERAND
    if (prevNonSpaceIdx !== -1 && parsed.commandR &&
        prevNonSpaceIdx >= parsed.commandR.start && prevNonSpaceIdx < parsed.commandR.end) {
      stepTo = 'operand';
    }
    // 2) If just typed first space right after OPERAND token → go to COMMENT
    //    BUT ignore the single space immediately following a comma inside operand.
    else if (prevNonSpaceIdx !== -1 && parsed.operandR &&
            prevNonSpaceIdx >= parsed.operandR.start && prevNonSpaceIdx < parsed.operandR.end &&
            s[prevNonSpaceIdx] !== ',') {
      stepTo = 'comment';
    }
    // 3) If cursor is in the space block between COMMAND and OPERAND (sp2) → go to COMMENT
    else if (cur.section === 'space' && cur.whichSpace === 2) {
      stepTo = 'comment';
    }
    // 4) If cursor is in the space block between LABEL and COMMAND (sp1) → go to OPERAND
    else if (cur.section === 'space' && cur.whichSpace === 1) {
      stepTo = 'operand';
    }
    // 5) operand is empty and caret is at/after operand start → go to COMMENT
    else if (parsed.operand === '' && cp >= baseline.starts.operand) {
      stepTo = 'comment';
    }

    // Engage comment column?
    if (hasComment || stepTo === 'comment' ||
        (prevNonSpaceIdx !== -1 && parsed.operandR &&
        prevNonSpaceIdx >= parsed.operandR.start && prevNonSpaceIdx < parsed.operandR.end && s[prevNonSpaceIdx] !== ',')) {
      engageComment = true;
    }

    log('Space → step decision', { stepTo, engageComment });

    const { out, starts } = buildAlignedLine(
      parsed.label,
      parsed.command,   // '' allowed
      parsed.operand,   // '' allowed
      parsed.commentPart,
      engageComment
    );

    // Cursor mapping: snap when we chose a step
    let newCursor = cp;
    if (stepTo === 'operand') newCursor = starts.operand;
    else if (stepTo === 'comment') newCursor = starts.comment;
    else {
      // best-effort default
      if (cur.section === 'label') {
        newCursor = starts.label + clamp(cur.rel, 0, (parsed.label ?? '').length);
      } else if (cur.section === 'command') {
        newCursor = starts.command + clamp(cur.rel, 0, (parsed.command ?? '').length);
      } else if (cur.section === 'operand') {
        newCursor = starts.operand + clamp(cur.rel, 0, (parsed.operand ?? '').length);
      } else if (cur.section === 'comment') {
        newCursor = starts.comment + clamp(cur.rel, 0, (parsed.commentPart ?? '').length);
      } else if (cur.section === 'space') {
        if (cur.whichSpace === 0 || cur.whichSpace === 1) newCursor = starts.command;
        else if (cur.whichSpace === 2) newCursor = starts.operand;
        else if (cur.whichSpace === 3 || cur.whichSpace === 9) {
          newCursor = engageComment ? starts.comment : out.length;
        }
      }
    }

    log('RESULT (space step)', { before: s, after: out, newCursor });
    console.groupEnd?.();
    return { line: out + (had_nl ? '\n' : ''), cursor: newCursor };
  }


  // ---------------------------------------------------------
  // (E) Full re-spacing for non-space & non-backspace (enter/paste)
  // ---------------------------------------------------------
  {
    // Engage comment column if we actually have a comment tail; this preserves all nonspace chars.
    const engageComment = !!(parsed.commentPart && parsed.commentPart.length > 0);

    const { out, starts } = buildAlignedLine(
      parsed.label,
      parsed.command,
      parsed.operand,
      parsed.commentPart,
      engageComment
    );

    // best-effort cursor remap
    let newCursor = cp;
    if (cur.section === 'label') {
      newCursor = starts.label + clamp(cur.rel, 0, (parsed.label ?? '').length);
    } else if (cur.section === 'command') {
      newCursor = starts.command + clamp(cur.rel, 0, (parsed.command ?? '').length);
    } else if (cur.section === 'operand') {
      newCursor = starts.operand + clamp(cur.rel, 0, (parsed.operand ?? '').length);
    } else if (cur.section === 'comment') {
      newCursor = starts.comment + clamp(cur.rel, 0, (parsed.commentPart ?? '').length);
    } else if (cur.section === 'space') {
      if (cur.whichSpace === 0 || cur.whichSpace === 1) newCursor = starts.command;
      else if (cur.whichSpace === 2) newCursor = starts.operand;
      else if (cur.whichSpace === 3 || cur.whichSpace === 9) {
        newCursor = engageComment ? starts.comment : out.length;
      }
    }

    log('RESULT (full respacing for enter/paste/other)', { before: s, after: out, newCursor });
    console.groupEnd?.();
    return { line: out + (had_nl ? '\n' : ''), cursor: newCursor };
  }
}
