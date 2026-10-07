import { describe, expect, it } from 'vitest';
import {
  classify,
  formatLine,
  formatPasted,
  onBackspace,
  onEnter,
  onShiftTab,
  onSpace,
} from '@/features/editor/lib/sicxeFormat';

// Columns (1-based): label 1, operation 10, operand 18, comment 36.

/**
 * The editor without the editor: keys applied as attachAutoIndentation applies them.
 * Keys: a character is typed; ' ' Space, '⇥' Tab, '⇤' Shift+Tab, '⌫' Backspace, '⏎' Enter,
 * '↓' down a line (the line left is laid out), '⇱' Home. Returns the lines and the cursor.
 */
function typing(keys: string, start: string[] = [''], at: [number, number] = [0, 0]) {
  const lines = [...start];
  let [row, col] = at;
  const edited = new Set<number>();
  const leave = (r: number) => {
    if (edited.delete(r)) lines[r] = formatLine(lines[r]);
  };
  for (const key of keys) {
    const line = lines[row];
    if (key === ' ' || key === '⇥' || key === '⇤') {
      const e = key === '⇤' ? onShiftTab(line, col) : onSpace(line, col, key === '⇥');
      lines[row] = e.line;
      col = e.cursor;
    } else if (key === '⌫') {
      const e = onBackspace(line, col);
      if (e) {
        lines[row] = e.line;
        col = e.cursor;
      } else if (col > 0) {
        lines[row] = line.slice(0, col - 1) + line.slice(col);
        col--;
        edited.add(row);
      }
    } else if (key === '⏎') {
      if (col === 0) {
        lines.splice(row, 0, '');
      } else {
        const e = onEnter(line, col);
        lines.splice(row, 1, e.before, e.after);
        col = e.cursor;
      }
      edited.delete(row);
      row++;
    } else if (key === '↓') {
      leave(row);
      if (row === lines.length - 1) lines.push('');
      row++;
      col = Math.min(col, lines[row].length);
    } else if (key === '⇱') {
      col = 0;
    } else {
      lines[row] = line.slice(0, col) + key + line.slice(col);
      col++;
      edited.add(row);
    }
  }
  return { lines, cursor: [row, col] };
}

describe('fields: what the assembler reads', () => {
  const fields = (line: string) => {
    const f = classify(line);
    const t = (k: 'label' | 'opcode' | 'operand' | 'comment') =>
      f[k] ? line.slice(f[k]!.start, f[k]!.end) : null;
    return [t('label'), t('opcode'), t('operand'), t('comment')];
  };

  it('a word at column 1 is a label, unless it is an operation followed by no operation', () => {
    expect(fields('FIRST STL RETADR')).toEqual(['FIRST', 'STL', 'RETADR', null]);
    expect(fields('LDA ZERO')).toEqual([null, 'LDA', 'ZERO', null]);
    expect(fields('RSUB')).toEqual([null, 'RSUB', null, null]);
    expect(fields('COMP COMP ZERO')).toEqual(['COMP', 'COMP', 'ZERO', null]);
  });

  it('an indented word is a label when an operation follows it', () => {
    expect(fields('    LOOP LDA X')).toEqual(['LOOP', 'LDA', 'X', null]);
    expect(fields('         LOOP')).toEqual([null, 'LOOP', null, null]);
  });

  it('after an operation without operand comes the comment', () => {
    expect(fields(' RSUB return')).toEqual([null, 'RSUB', null, 'return']);
    expect(fields(' RSUB . return')).toEqual([null, 'RSUB', null, '. return']);
    expect(fields('SUB CSECT foo')).toEqual(['SUB', 'CSECT', null, 'foo']);
  });

  it('an operand keeps its spaces in quotes, around commas and operators, in =WORD literals', () => {
    expect(fields("MSG BYTE C'HELLO WORLD' hi")).toEqual(['MSG', 'BYTE', "C'HELLO WORLD'", 'hi']);
    expect(fields(' STCH BUFFER ,X')).toEqual([null, 'STCH', 'BUFFER ,X', null]);
    expect(fields(' EXTREF AA, BB')).toEqual([null, 'EXTREF', 'AA, BB', null]);
    expect(fields('E1 EQU BUF - X1 . c')).toEqual(['E1', 'EQU', 'BUF - X1', '. c']);
    expect(fields(' LDA =WORD 65535')).toEqual([null, 'LDA', '=WORD 65535', null]);
  });
});

describe('formatLine: Enter, paste, Format Document, leaving a line', () => {
  it('lays the fields out at 1, 10, 18, 36', () => {
    expect(formatLine('FIRST STL RETADR')).toBe('FIRST    STL     RETADR');
    expect(formatLine('LOOP LDA BUFFER,X . read')).toBe(
      'LOOP     LDA     BUFFER,X          . read',
    );
  });

  it('puts an instruction typed at column 1 in its column', () => {
    expect(formatLine('LDA ZERO')).toBe('         LDA     ZERO');
    expect(formatLine('RSUB')).toBe('         RSUB');
    expect(formatLine('END FIRST')).toBe('         END     FIRST');
  });

  it('keeps a long field and puts the next one at its column again when it can', () => {
    expect(formatLine('LONGLABEL1 LDA ZERO')).toBe('LONGLABEL1 LDA   ZERO');
    expect(formatLine('X LDA TABLE+LENGTH-1,X . far')).toBe(
      'X        LDA     TABLE+LENGTH-1,X  . far',
    );
  });

  it('corrects what the assembler refuses and can only mean one thing', () => {
    // capitals: operation, C'/X', ",X", registers (not the symbols: they are case-sensitive)
    expect(formatLine('first lda buf,x')).toBe('first    LDA     buf,X');
    expect(formatLine("msg byte c'eof'")).toBe("msg      BYTE    C'eof'");
    expect(formatLine(' clear x')).toBe('         CLEAR   X');
    // the spaces next to a comma, and a run of spaces in an expression
    expect(formatLine(' STCH BUFFER , X')).toBe('         STCH    BUFFER,X');
    expect(formatLine('E1 EQU BUF            - X1')).toBe('E1       EQU     BUF - X1');
    // the comment's dot (the textbook's comments have none)
    expect(formatLine('COPY START 1000 COPY FILE')).toBe(
      'COPY     START   1000              . COPY FILE',
    );
    expect(formatLine(' RSUB return')).toBe('         RSUB                      . return');
  });

  it('does not guess: no dot before what may be data or an operand, nor after an unknown operation', () => {
    expect(formatLine(' LDA ns - small = neg')).toBe('         LDA     ns - small        = neg');
    expect(formatLine(' LDA ZERO 65535')).toBe('         LDA     ZERO              65535');
    expect(formatLine('5 COPY START 1000')).toBe('5        COPY    START             1000');
  });

  it('moves a comment line to column 1, empties a blank line, drops trailing spaces', () => {
    expect(formatLine('    . a comment  ')).toBe('. a comment');
    expect(formatLine('         ')).toBe('');
    expect(formatLine('LOOP     ')).toBe('LOOP');
  });

  it('is idempotent', () => {
    for (const l of ['FIRST STL RETADR', ' RSUB x', "C1 BYTE C'A B'", 'E EQU A - B', '. c']) {
      expect(formatLine(formatLine(l))).toBe(formatLine(l));
    }
  });
});

describe('formatPasted: a block', () => {
  it('drops line numbers in front of every line (textbook figures)', () => {
    expect(
      formatPasted(['5   COPY  START 1000', '10  FIRST STL RETADR', '15', '20        RSUB']),
    ).toEqual(['COPY     START   1000', 'FIRST    STL     RETADR', '', '         RSUB']);
  });

  it('moves an indented block left, so that its labels are labels again', () => {
    expect(formatPasted(['    LOOP', '        LDA ZERO', '    END LOOP'])).toEqual([
      'LOOP',
      '         LDA     ZERO',
      '         END     LOOP',
    ]);
  });

  it('keeps a block that starts at column 1 as it is', () => {
    expect(formatPasted(['FIRST STL RETADR', '\tLDA\tZERO'])).toEqual([
      'FIRST    STL     RETADR',
      '         LDA     ZERO',
    ]);
  });
});

describe('typing', () => {
  it('Space steps to the next column', () => {
    expect(typing('FIRST STL RETADR ')).toEqual({
      lines: ['FIRST    STL     RETADR            '],
      cursor: [0, 35],
    });
  });

  it('an instruction typed at column 1 goes to its column at the first Space', () => {
    expect(typing('lda ')).toEqual({ lines: ['         LDA     '], cursor: [0, 17] });
    expect(typing('RSUB ')).toEqual({
      lines: ['         RSUB                      '],
      cursor: [0, 35],
    });
  });

  it('Enter lays the line out; the next line starts at the operation column', () => {
    expect(typing('FIRST STL RETADR⏎LDA ZERO⏎')).toEqual({
      lines: ['FIRST    STL     RETADR', '         LDA     ZERO', '         '],
      cursor: [2, 9],
    });
  });

  it('a label typed at the operation column moves to column 1 when its operation follows', () => {
    expect(typing('⏎LOOP LDA ZERO⏎', ['FIRST STL RETADR'], [0, 16])).toEqual({
      lines: ['FIRST    STL     RETADR', 'LOOP     LDA     ZERO', '         '],
      cursor: [2, 9],
    });
  });

  it('Backspace at the operation column of a new line goes to column 1, for a label', () => {
    expect(typing('⏎⌫COPY START 0⏎', ['X'], [0, 1])).toEqual({
      lines: ['X', 'COPY     START   0', '         '],
      cursor: [2, 9],
    });
  });

  it('Backspace after a step to the next column takes the step back', () => {
    expect(typing('FIRST ⌫')).toEqual({ lines: ['FIRST'], cursor: [0, 5] });
  });

  it('Backspace in the padding between fields moves back over it', () => {
    expect(typing('⌫', ['FIRST    STL     RETADR'], [0, 7])).toEqual({
      lines: ['FIRST    STL     RETADR'],
      cursor: [0, 5],
    });
  });

  it('Space between fields of a finished line moves to the next field (E01)', () => {
    expect(typing(' ', ['LOOP     LDA     ZERO'], [0, 4])).toEqual({
      lines: ['LOOP     LDA     ZERO'],
      cursor: [0, 9],
    });
  });

  it('a label typed in front of an instruction, then Space: the cursor at the operation', () => {
    expect(typing('⇱LOOP ', ['         LDA     ZERO'], [0, 9])).toEqual({
      lines: ['LOOP     LDA     ZERO'],
      cursor: [0, 9],
    });
  });

  it('a line edited in its middle is laid out when the cursor leaves it', () => {
    // J -> JEQ: the operand shifted right while typing; in its column again afterwards
    expect(typing('EQ↓', ['LOOP     J       LOOP', ''], [0, 10]).lines[0]).toBe(
      'LOOP     JEQ     LOOP',
    );
  });

  it('Space inside quotes, a comment, after a comma is a space', () => {
    expect(typing("MSG BYTE C'A B'").lines).toEqual(["MSG      BYTE    C'A B'"]);
    expect(typing(' LDA ZERO . a b').lines).toEqual(['         LDA     ZERO              . a b']);
    expect(typing(' STCH BUFFER, X⏎').lines[0]).toBe('         STCH    BUFFER,X');
  });

  it('a comment without dot is given one when the line is done', () => {
    expect(typing(' LDA ZERO load it⏎').lines[0]).toBe(
      '         LDA     ZERO              . load it',
    );
  });

  it('Tab steps like Space; Shift+Tab goes back a field', () => {
    expect(typing('FIRST⇥STL⇥RETADR')).toEqual({
      lines: ['FIRST    STL     RETADR'],
      cursor: [0, 23],
    });
    expect(typing('⇤', ['FIRST    STL     RETADR'], [0, 20])).toEqual({
      lines: ['FIRST    STL     RETADR'],
      cursor: [0, 17],
    });
  });

  it('Enter inside a comment continues it on a comment line', () => {
    expect(typing('⏎', ['. first second'], [0, 7]).lines).toEqual(['. first', '. second']);
  });
});
