package sic.asm;

public class AsmError extends Exception implements Comparable<AsmError> {

    public final Location loc;
    public final int length;
    private boolean nonBreaking = false;

    public AsmError(Location loc, int length, String msg) {
        super(msg);
        this.loc = loc;
        this.length = length;
    }

    public AsmError(Location loc, int length, String format, Object... objs) {
        this(loc, length, String.format(format, objs));
    }

    public AsmError(String format, Object... objs) {
        this(null, 0, format, objs);
    }

    public AsmError(Location loc, int length, boolean nonBreaking, String format, Object... objs) {
        this(loc, length, String.format(format, objs));
        this.nonBreaking = nonBreaking;
    }

    @Override
    public String toString() {
        String severity = isBreaking() ? "Error" : "Warning";
        String head = severity + (loc != null ? " at " + loc + " (" + loc.pos + ")" : "");
        String message = this.getLocalizedMessage();
        return ((message != null) ? (head + ": " + message) : head) + ".";
    }

    @Override
    public int compareTo(AsmError that) {
        return this.loc.pos - that.loc.pos;
    }

    public boolean isBreaking() {
        return !nonBreaking;
    }
}
