package sicxe.asm.parsing;

import sicxe.asm.AsmError;
import sicxe.asm.Location;

/**
 * Low-level input representation and manipulation.
 *
 * @author jure
 */
public class Input {

    protected String buf;    // buffer
    protected int pos;       // position in the buffer
    protected int row;       // row
    protected int col;       // column
    protected char prev;     // previous char

    public Input() {
        begin(null);
    }

    public void begin(final String buf) {
        this.buf = buf;
        this.pos = 0;
        this.row = 1;
        this.col = 1;
    }

    // getters

    public int pos() {
        return pos;
    }

    public int row() {
        return row;
    }

    public int col() {
        return col;
    }

    public Location loc() {
        return new Location(pos, row, col);
    }

    public String extract(int from, int to) {
        return buf.substring(from, to);
    }

    public String extract(int from) {
        return buf.substring(from, pos);
    }

    // reading of input

    public int available() {
        return buf.length() - pos;
    }

    public boolean ready(int pos) {
        return pos < buf.length();
    }

    public boolean ready() {
        return ready(pos);
    }

    public char peek(int ahead) {
        if (available() <= ahead) return 0;
        return buf.charAt(pos + ahead);
    }

    public char peek() {
        return peek(0);
    }

    public char prev() {
        return prev;
    }

    // advancers

    public char advance() {
        prev = peek();
        pos++;
        switch (prev) {
            case '\n': row++; col = 1; break;
            case '\t': col = ((col - 1) / 4) * 4 + 5; break;
            default: col++;
        }
        return prev;
    }

    public int advance(int count) {
        int cnt = 0;
        while (ready() && cnt++ < count) advance();
        return cnt;
    }

    public boolean advanceIf(char ch) {
        if (peek() != ch) return false;
        advance();
        return true;
    }

    public void advance(char ch) throws AsmError {
        if (advanceIf(ch)) return;

        String display;
        switch (ch) {
            case '\n': display = "\\n"; break;
            case '\r': display = "\\r"; break;
            case '\t': display = "\\t"; break;
            default:   display = String.valueOf(ch); break;
        }

        throw new AsmError(loc(), 1, "Expected '%s'", display);
    }


    public boolean advanceIf(String str) {
        for (int i = 0; i < str.length(); i++)
            if (peek(i) != str.charAt(i)) return false;
        advance(str.length());
        return true;
    }

    public void advanceUntil(char delimiter) throws AsmError {
        while (ready() && peek() != delimiter) {
            advance();
        }

        if (!ready() && peek() != delimiter && delimiter != '\n' && delimiter != '\r') {
            throw new AsmError(loc(), 1, "Expected character %c not found", delimiter);
        }

        advance();
    }

    public String readUntil(char delimiter) throws AsmError {
        int mark = pos;
        advanceUntil(delimiter);
        return extract(mark, pos - 1);
    }

}
