package sicxe.asm;

/**
 * Location of a token, an error, etc. in the input.
 *
 * @author jure
 */
public class Location {

    public final int pos;
    public final int row;
    public final int col;
    public int length;

    public Location(int pos, int row, int col) {
        this.pos = pos;
        this.row = row;
        this.col = col;
        this.length = -1;
    }

    public Location(int pos, int row, int col, int length) {
        this.pos = pos;
        this.row = row;
        this.col = col;
        this.length = length;
    }

    @Override
    public String toString() {
        return row + ", " + col;
    }

}
