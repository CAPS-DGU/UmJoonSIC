// Column positions
const COL_OPCODE_START = 10;
const COL_OPERAND_START = 18;
const COL_COMMENT_START = 36;

// Field lengths
const LEN_LABEL_FIELD = COL_OPCODE_START - 1; // 9
const LEN_INSTR_FIELD = COL_OPERAND_START - COL_OPCODE_START; // 8
const LEN_OPERAND_FIELD = COL_COMMENT_START - COL_OPERAND_START; // 18

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

function first_nonspace_index(s: string): number {
  let i = 0;
  while (i < s.length && is_space(s[i])) i++;
  return i === s.length ? -1 : i;
}

function find_comment_start(s: string): number {
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '.') return k;
  }
  return -1;
}

function in_range(x: number, start: number, end: number): boolean {
  return start <= x && x < end;
}

function correct_space(token: string, token_spaces: string, length: number): string {
  token_spaces = replace_tabs_with_spaces(token_spaces);
  const required = length - token.length;
  if (required <= 1) return ' ';
  return ' '.repeat(required);
}

/**
 * Auto-indent a single line of assembly-like code.
 *
 * @param line       Input line (may end with '\n')
 * @param backspace  If true, and cursorpos is inside a space section, that space section is removed
 * @param cursorpos  0-based cursor index into the original line (before changes)
 */
export function autoIndentLine(
  line: string,
  backspace: boolean = false,
  cursorpos: number = 0,
): string {
  // Handle newline & cursor clamp
  let had_nl = false;
  let raw = line;
  if (line.endsWith('\n')) {
    had_nl = true;
    raw = line.slice(0, -1);
  }

  const cp = Math.max(0, Math.min(cursorpos, raw.length));
  const s = raw;

  const idx = first_nonspace_index(s);
  if (idx === -1) {
    return '' + (had_nl ? '\n' : '');
  }

  const trimmed = s.slice(idx);
  if (/^[\u3131-\uD79D]/.test(trimmed)) {
    return line; // 그냥 원본 반환 (인덴트 안 건드림)
  }

  // Comment line
  if (s[idx] === '.') {
    const out = replace_tabs_with_spaces(s.slice(idx));
    return out + (had_nl ? '\n' : '');
  }

  // Split code vs comment
  const dot = find_comment_start(s);
  const code_part = dot !== -1 ? s.slice(0, dot) : s;
  const comment_part = dot !== -1 ? s.slice(dot) : '';

  // Parse code_part
  let i = 0;

  // LABEL
  const leading = span_spaces(code_part, i);
  i += leading;

  let label = '';
  let spaces_label_raw = '';
  let spaces_label_range: [number, number] = [-1, -1];
  let spaces_inst_range: [number, number] = [-1, -1];
  let spaces_oper_range: [number, number] = [-1, -1];

  if (leading > 0) {
    label = '';
    spaces_label_raw = code_part.slice(0, leading);
    spaces_label_range = [0, leading];
  } else {
    const [tok, next] = span_token(code_part, i);
    label = tok;
    i = next;
    const s_count = span_spaces(code_part, i);
    spaces_label_raw = code_part.slice(i, i + s_count);
    spaces_label_range = [i, i + s_count];
    i += s_count;
  }

  // INSTRUCTION
  let instruction = '';
  let spaces_inst_raw = '';
  if (i < code_part.length) {
    const [tok, next] = span_token(code_part, i);
    instruction = tok;
    i = next;
    const s_count = span_spaces(code_part, i);
    spaces_inst_raw = code_part.slice(i, i + s_count);
    spaces_inst_range = [i, i + s_count];
    i += s_count;
  }

  // OPERAND
  let operand = '';
  let spaces_operand_raw = '';
  if (i < code_part.length) {
    const [tok, next] = span_token(code_part, i);
    operand = tok;
    i = next;
    const s_count = span_spaces(code_part, i);
    spaces_operand_raw = code_part.slice(i, i + s_count);
    spaces_oper_range = [i, i + s_count];
    i += s_count;
  }

  // Backspace behavior
  let remove_spaces_label = false;
  let remove_spaces_inst = false;
  let remove_spaces_oper = false;

  if (backspace) {
    if (
      spaces_label_range[0] !== -1 &&
      in_range(cp, spaces_label_range[0], spaces_label_range[1])
    ) {
      remove_spaces_label = true;
    } else if (
      spaces_inst_range[0] !== -1 &&
      in_range(cp, spaces_inst_range[0], spaces_inst_range[1])
    ) {
      remove_spaces_inst = true;
    } else if (
      spaces_oper_range[0] !== -1 &&
      in_range(cp, spaces_oper_range[0], spaces_oper_range[1])
    ) {
      remove_spaces_oper = true;
    }
  }

  // Correct spacing
  const spaces_label = remove_spaces_label
    ? ''
    : correct_space(label, spaces_label_raw, LEN_LABEL_FIELD);

  const spaces_inst = remove_spaces_inst
    ? ''
    : correct_space(instruction, spaces_inst_raw, LEN_INSTR_FIELD);

  let spaces_operand;
  if (remove_spaces_oper) {
    spaces_operand = '';
  } else if (comment_part.length > 0 || dot !== -1) {
    // 주석이 존재하거나, 주석을 이제 막 입력하려는 경우(`.`)에만 공백을 계산합니다.
    spaces_operand = correct_space(operand, spaces_operand_raw, LEN_OPERAND_FIELD);
  } else {
    // 주석이 없으면, operand 뒤에 추가 공백을 넣지 않습니다.
    spaces_operand =
      operand.length > 0 && code_part.trim().endsWith(operand) ? '' : spaces_operand_raw;
  }

  // Normalize comment
  const comment_norm = comment_part ? replace_tabs_with_spaces(comment_part) : '';

  // Build output
  const out =
    replace_tabs_with_spaces(label) +
    spaces_label +
    replace_tabs_with_spaces(instruction) +
    spaces_inst +
    replace_tabs_with_spaces(operand) +
    spaces_operand +
    comment_norm;

  return out + (had_nl ? '\n' : '');
}
