import { describe, expect, it } from 'vitest';
import { autoIndentLine } from '@/features/editor/lib/autoIndentLine';

// Columns (1-based): label 1, opcode 10, operand 18, comment 36.
const enter = (line: string, cursor = 0) => autoIndentLine(line, false, false, cursor);
const space = (line: string, cursor = line.length) => autoIndentLine(line, false, true, cursor);
const backspace = (line: string, cursor: number, erased: string) =>
  autoIndentLine(line, true, false, cursor, undefined, undefined, erased);

describe('Enter / paste: the line is laid out in columns', () => {
  it('aligns label, opcode and operand', () => {
    expect(enter('FIRST STL RETADR', 16)).toEqual({ line: 'FIRST    STL     RETADR', cursor: 23 });
  });

  it('starts a line without a label at the opcode column', () => {
    expect(enter(' LDA ALPHA', 10).line).toBe('         LDA     ALPHA');
  });

  it('puts a comment after the operand in the comment column', () => {
    expect(enter('LOOP LDA BUFFER,X . read').line).toBe(
      'LOOP     LDA     BUFFER,X          . read',
    );
  });

  it('moves a comment line to column 1', () => {
    expect(enter('    . a comment', 6)).toEqual({ line: '. a comment', cursor: 2 });
  });

  it('leaves a line alone when a field is wider than its column', () => {
    expect(enter('TOOLONGLABEL LDA X').line).toBe('TOOLONGLABEL LDA X');
  });

  it('keeps a trailing newline', () => {
    expect(enter('FIRST STL RETADR\n').line).toBe('FIRST    STL     RETADR\n');
  });

  it('turns tabs into spaces, also where the line is not realigned', () => {
    expect(enter('FIRST\tSTL\tRETADR').line).toBe('FIRST    STL     RETADR');
    expect(enter('TOOLONGLABEL\tLDA X').line).toBe('TOOLONGLABEL LDA X');
    expect(enter('A B C . x\ty').line).toBe('A        B       C                 . x y');
  });
});

describe('Space: steps to the next column', () => {
  it('goes to the opcode column on an empty line', () => {
    expect(space(' ')).toEqual({ line: '         ', cursor: 9 });
  });

  it('goes to the opcode column after a label', () => {
    expect(space('FIRST ')).toEqual({ line: 'FIRST    ', cursor: 9 });
  });

  it('goes to the operand column after an opcode', () => {
    expect(space('FIRST STL ')).toEqual({ line: 'FIRST    STL     ', cursor: 17 });
  });

  it('goes to the comment column after an operand', () => {
    expect(space('FIRST    STL     RETADR ')).toEqual({
      line: 'FIRST    STL     RETADR            ',
      cursor: 35,
    });
  });

  it('keeps the space after a comma in the operand', () => {
    expect(space('         LDA     BUFFER, ')).toEqual({
      line: '         LDA     BUFFER, ',
      cursor: 25,
    });
  });

  it('keeps spaces inside quotes and inside a comment', () => {
    expect(space("EOF     BYTE    C'E ").line).toBe("EOF     BYTE    C'E ");
    expect(space('A B C . x y ').line).toBe('A B C . x y ');
  });
});

describe('Backspace', () => {
  it('collapses the padding left of the cursor after deleting a space', () => {
    expect(backspace('FIRST    ', 9, ' ')).toEqual({ line: 'FIRST', cursor: 5 });
  });

  it('keeps padding that a space still follows', () => {
    expect(backspace('FIRST    STL', 6, ' ')).toEqual({ line: 'FIRST    STL', cursor: 6 });
  });

  it('leaves the spacing alone after deleting a letter', () => {
    expect(backspace('FIRS    ', 4, 'T')).toEqual({ line: 'FIRS    ', cursor: 4 });
  });
});

it('leaves the line alone while text is selected', () => {
  expect(autoIndentLine('a  b', false, true, 1, 0, 2)).toEqual({ line: 'a  b', cursor: 1 });
});
