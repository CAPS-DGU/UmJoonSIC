package sic.asm.parsing;

import sic.asm.AsmError;
import sic.asm.Location;
import sic.common.Conversion;

/**
 *  * Lexer - source code tokenization (SIC-only defaults)
 *
 * Enforces:
 *  - Decimal-by-default integer parsing (configurable via DEFAULT_INTEGER_RADIX).
 *  - Rejects SIC/XE extended format '+' on mnemonics.
 *  - Provides a helper to reject XE addressing ('#', '@') at operand starts.
 *
 * @author jure
 */
public class Lexer extends Input {

    // ===== Configuration switches (easy to flip later) =====
    /** Default radix for plain integers; set to 16 if professor wants hex-by-default. */
    public static final int DEFAULT_INTEGER_RADIX = 10;

    /** Allow 0b/0o/0x prefixed literals. Keep false for strict SIC. */
    public static final boolean ALLOW_PREFIXED_RADIX = false;

    // ************ isXXX()

    public boolean isWhitespace() {
        return peek() == ' ' || peek() == '\t' || peek() == '\r';
    }

    public boolean isAlpha() {
        return Character.isLetter(peek()) || peek() == '_';
    }

    public boolean isAlphanumeric() {
        return Character.isLetterOrDigit(peek()) || peek() == '_';
    }

    public boolean isNewLine() {
        return peek() == '\n';
    }

    // ************ advance and read

    public void skipWhitespace() {
        while (isWhitespace()) advance();
    }

    public String skipLinesAndComments() throws AsmError {
        StringBuilder comments = new StringBuilder();
        while (isWhitespace() || isNewLine() || peek() == '.') {
            String comment = readIfComment(true, true);
            if (comment != null) {
                comments.append(comment);
                comments.append('\n');
            } else {
                advance();
            }
        }
        return comments.length() > 0 ? comments.toString() : null;
    }

    public void skipAlphanumeric() {
        while (isAlphanumeric()) advance();
    }

    public String readAlphanumeric() {
        int mark = pos;
        skipAlphanumeric();
        return extract(mark);
    }

    public String readDigits(int radix) {
        int mark = pos;
        while (Character.digit(peek(), radix) != -1) advance();
        return extract(mark);
    }

    // ************ SIC/XE if-tokens

    public String readIfComment(boolean requireDot, boolean skipEmptyLines) throws AsmError {
        boolean hasDot = advanceIf('.');
        if ((requireDot || col == 1) && !hasDot) return null;
        String comment = readUntil('\n').trim();
        if (skipEmptyLines && comment.length() == 0) return null;
        return comment;
    }

    public String readIfLabel() {
        if (col == 1 && isAlpha()) return readAlphanumeric();
        return null;
    }

    public String readIfMnemonic() throws AsmError {
        int mark = pos;
        // In pure SIC, '+' (format 4) must not be accepted.
        if (advanceIf('+')) {
            throw new AsmError(loc(), 1, "Extended format '+' is not allowed in SIC");
        }
        skipAlphanumeric();
        if (mark == pos) return null;
        return extract(mark);
    }

    // ************ SIC/XE tokens

    public void skipComma() throws AsmError {
        skipWhitespace();
        advance(',');
        skipWhitespace();
    }

    public boolean skipIfComma() {
        skipWhitespace();
        boolean res = advanceIf(',');
        skipWhitespace();
        return res;
    }

    public boolean skipIfIndexed() throws AsmError {
        if (skipIfComma()) {
            advance('X');  // Only ',X' allowed in SIC
            return true;
        }
        return false;
    }

    public int readRegister() throws AsmError {
        Location prevLoc = loc();
        char ch = advance();
        int reg = Conversion.nameToReg(ch);
        if (reg < 0)
            throw new AsmError(prevLoc, 1, "Invalid register '%c'", ch);
        return reg;
    }

    public String readSymbol() throws AsmError {
        String sym = readAlphanumeric();
        if (sym.length() > 0) return sym;
        throw new AsmError(loc(), 1, "Symbol expected");
    }

    public String readIfSymbol() {
        return readAlphanumeric();
    }

    /**
     * Parse integer using configurable defaults.
     * - Default is decimal (DEFAULT_INTEGER_RADIX = 10).
     * - Optional 0b/0o/0x prefixes are honored only if ALLOW_PREFIXED_RADIX = true.
     * If minus sign is present it must be immediately followed by the number.
     */
    public int readInt(int lo, int hi) throws AsmError {
        Location startLoc = loc();

        // sign
        boolean negative = advanceIf('-');

        int radix = DEFAULT_INTEGER_RADIX;

        // Optional radix prefixes, only if enabled
        if (ALLOW_PREFIXED_RADIX && peek() == '0') {
            switch (peek(1)) {
                case 'b': radix = 2;  break;
                case 'o': radix = 8;  break;
                case 'x': radix = 16; break;
                default:  break;
            }
            if (radix != DEFAULT_INTEGER_RADIX) {
                advance(); // '0'
                advance(); // radix letter
            }
        } else {
            // No prefixes allowed (strict SIC). Ensure next is a digit in chosen radix.
            if (Character.digit(peek(), radix) == -1)
                throw new AsmError(loc(), 1, "Number expected");
        }

        // Read digits
        int num;
        int digitsStartCol = col;
        try {
            String digits = readDigits(radix);
            num = Integer.parseInt(digits, radix);
        } catch (NumberFormatException e) {
            throw new AsmError(startLoc, Math.max(col - digitsStartCol, 1), "Invalid number");
        }

        // number must not be followed by letter or digit
        if (Character.isLetterOrDigit(peek()))
            throw new AsmError(loc(), 1, "invalid digit '%c'", peek());

        if (negative) num = -num;

        if (num < lo || num > hi)
            throw new AsmError(startLoc, Math.max(col - startLoc.col, 1),
                    "Number '%d' out of range [%d..%d]", num, lo, hi);

        return num;
    }

    /**
     * Parse a 48-bit double (kept for compatibility, though SIC dropped FLOT/float usage).
     */
    public double readFloat() throws AsmError {
        Location prevLoc = loc();  // mirror readInt: capture start for error span

        // Check sign
        boolean negative = advanceIf('-');

        // Read numbers before dot
        double num;
        try {
            prevLoc = loc();
            num = Double.parseDouble(readDigits(10));
        } catch (NumberFormatException e) {
            throw new AsmError(prevLoc, Math.max(loc().col - prevLoc.col, 1), "Invalid number");
        }

        // Check for dot
        if (advanceIf('.')) {
            try {
                num += Double.parseDouble("0." + readDigits(10));
            } catch (NumberFormatException e) {
                throw new AsmError(prevLoc, Math.max(loc().col - prevLoc.col, 1), "Invalid number");
            }
        }

        // Number must not be followed by letter or digit
        if (Character.isLetterOrDigit(peek()))
            throw new AsmError(loc(), 1, "invalid digit '%c'", peek());

        // Apply sign
        if (negative) num = -num;

        // Check range (very permissive placeholder)
        double sicDoubleLimit = Math.pow(2, 11 + 36) - 1;
        double lo = -sicDoubleLimit;
        double hi = sicDoubleLimit;
        if (num < lo || num > hi)
            throw new AsmError(prevLoc, Math.max(loc().col - prevLoc.col, 1), "Number '%d' out of range [%d..%d]", num, lo, hi);

        return num;
    }

    public String readEscapedString(char terminator) throws AsmError {
        StringBuilder buf = new StringBuilder();
        Location prevLoc = loc();
        for (char c = advance(); c != terminator; c = advance()) {
            if (!ready() || c == '\n') {
                throw new AsmError(prevLoc, 1, "Unterminated byte string");
            }
            if (c == '\\') {
                c = advance();
                switch (c) {
                    case '\"':
                    case '\\':
                        break;
                    case 'n':
                        c = '\n';
                        break;
                    case 'r':
                        c = '\r';
                        break;
                    case 't':
                        c = '\t';
                        break;
                    case 'b':
                        c = '\b';
                        break;
                    case 'f':
                        c = '\f';
                        break;
                    case '0':
                        c = '\0';
                        break;
                    case 'x':
                        int mark = pos();
                        prevLoc = loc();
                        advance(2);
                        String str = extract(mark);
                        try {
                            c = (char) Integer.parseInt(str, 16);
                        } catch (NumberFormatException e) {
                            throw new AsmError(prevLoc, Math.max(loc().col - prevLoc.col,1), "Hexadecimal byte expected");
                        }
                        break;
                    default:
                        throw new AsmError(prevLoc, 2, "Unknown escape sequence '\\%c'", c);
                }
            }
            buf.append(c);
            prevLoc = loc();
        }
        return buf.toString();
    }

    // ===== Helper for parser: call at start of operand parsing to block XE addressing =====
    public void ensureNotXEAddressingStart() throws AsmError {
        char c = peek();
        if (c == '#' || c == '@') {
            throw new AsmError(loc(), 1, "Immediate/indirect addressing ('%c') is not allowed in SIC", c);
        }
    }
}
