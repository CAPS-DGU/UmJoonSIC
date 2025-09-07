package sic.common;

/**
 * Flags for pure SIC (no XE features).
 *
 * Rules enforced here:
 * - Only simple/SIC addressing; no immediate '#' or indirect '@'.
 * - Only X indexing is allowed; no BASE/PC relative; no EXTENDED.
 * - Instruction encoding must zero ni bits and use SIC 15-bit address field.
 *
 * Notes:
 * - Methods/constants for IMMEDIATE/INDIRECT, BASE/PC/EXTENDED and F4 helpers
 *   have been removed intentionally to cause compile errors if referenced.
 * - Use operandSic(...) for 15-bit addresses in pure SIC.
 *
 * @author jure (modified for pure SIC)
 */
public class Flags {

    public static final int NONE       = 0x00;

    // ---- ni (pure SIC: only simple/SIC; no immediate/indirect) ----
    public static final int MASK_NI    = 0x03;
    public static final int SIC        = 0x00;
    public static final int SIMPLE     = 0x03; // kept for compatibility; always treated as simple

    // ---- xbpe (pure SIC: only X allowed; no B/P/E) ----
    public static final int MASK_XBPE  = 0xF0; // kept for compatibility
    public static final int INDEXED    = 0x80;

    // flags
    private int ni;         // kept for compatibility; always coerced to SIC/simple
    private int xbpe;       // only X bit is meaningful in pure SIC

    public Flags(int ni, int xbpe) {
        // Enforce pure-SIC semantics regardless of inputs.
        this.ni = SIC;
        this.xbpe = xbpe & INDEXED;
    }

    public Flags() {
        this(SIC, NONE);
    }

    @Override
    public String toString() {
        // Represent pure SIC ("si"), plus only X in xbpe; no b/p/e.
        return "si" + (isIndexed() ? "x" : "-") + "---";
    }

    /**
     * Stringify an operand with optional ,X.
     * (#/@ are not allowed in pure SIC)
     */
    public String operandToString(String operand) {
        return isIndexed() ? (operand + ",X") : operand;
    }

    // ************ ni (pure SIC only) ************

    public int get_ni() {
        return SIC;
    }

    public void set_ni(int what) {
        // ignore; pure SIC has no immediate/indirect variants
        this.ni = SIC;
    }

    public boolean is_ni(int what) {
        // Only SIMPLE/SIC are considered "true" in pure SIC.
        return what == SIMPLE || what == SIC;
    }

    public boolean isSic() {
        return true;
    }

    public boolean isSimple() {
        return true;
    }

    /**
     * In pure SIC, the lower two bits are always 0.
     */
    public byte combineWithOpcode(int opcode) {
        return (byte) (opcode & 0xFC);
    }

    // ************ xbpe (only X) ************

    public int get_xbpe() {
        return xbpe & INDEXED;
    }

    public void set_xbpe(int xbpe) {
        this.xbpe = xbpe & INDEXED;
    }

    public int get_x() {
        return xbpe & INDEXED;
    }

    public boolean isIndexed() {
        return (xbpe & INDEXED) == INDEXED;
    }

    public void setIndexed() {
        xbpe |= INDEXED;
    }

    // ************ operands (pure SIC addressing field) ************

    /**
     * Pure SIC 15-bit address (no PC/base relative).
     */
    public int operandSic(int a, int b) {
        // 15-bit address: (a7..a1 as high bits) and full b as low 8 bits
        return ((a & 0x7F) << 8) | (b & 0xFF);
    }

    // =========================
    // Removed (by design, to enforce pure SIC):
    // - public static final int IMMEDIATE, INDIRECT
    // - public static final int BASERELATIVE, PCRELATIVE, EXTENDED
    // - public static final int MASK_XBP, MASK_BP
    // - boolean isImmediate(), isIndirect()
    // - boolean isBaseRelative(), setBaseRelative()
    // - boolean isPCRelative(), setPCRelative()
    // - boolean isRelative(), isAbsolute()
    // - boolean isExtended(), setExtended()
    // - int operandF3(int a, int b)        // 12-bit disp (XE)
    // - int operandF4(int a, int b, int c) // 20-bit addr (XE)
    // - int operandPCRelative(int op)
    // - int minOperand(), int maxOperand()
    // =========================
}
