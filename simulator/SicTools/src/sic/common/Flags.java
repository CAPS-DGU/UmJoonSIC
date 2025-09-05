package sic.common;

/**
 * Flags ni and xbpe in F3/F4 format.
 * NIXBPE layout:
 *   ni  -> low 2 bits (.. .. .. .. .. .. n i)
 *   XBPE-> high nibble (x b p e ....) == bits 7..4 of the second byte for XE.
 *
 * SIC-only build note:
 * - For SIC, only X may be set; B/P/E are always 0.
 * - Use set_xbpe_nibble(0b1000) if you want to pass the XBPE nibble style.
 * - Or use setOnlyX(boolean).
 *
 * This class also provides a SIC-safe decoder for disassembly.
 */
public class Flags {

    public static final int NONE         = 0x00;

    // ni flags (low 2 bits)
    public static final int MASK_NI      = 0x03;
    public static final int SIC          = 0x00;
    public static final int IMMEDIATE    = 0x01;
    public static final int INDIRECT     = 0x02;
    public static final int SIMPLE       = 0x03;

    // xbpe flags (high nibble)
    public static final int MASK_XBPE    = 0xF0;
    public static final int MASK_XBP     = 0xE0;
    public static final int MASK_BP      = 0x60;
    public static final int INDEXED      = 0x80;
    public static final int BASERELATIVE = 0x40;
    public static final int PCRELATIVE   = 0x20;
    public static final int EXTENDED     = 0x10;

    // flags
    private int ni;    // low 2 bits
    private int xbpe;  // high nibble

    public Flags(int ni, int xbpe) {
        set_ni(ni);
        set_xbpe(xbpe);
    }

    public Flags() {
        this(Flags.NONE, Flags.NONE);
    }

    @Override
    public String toString() {
        String niStr = "--";
        if (is_ni(SIMPLE)) niStr = "ni";
        else if (is_ni(INDIRECT)) niStr = "n-";
        else if (is_ni(IMMEDIATE)) niStr = "-i";
        return niStr +
                (isIndexed()      ? "x" : "-") +
                (isBaseRelative() ? "b" : "-") +
                (isPCRelative()   ? "p" : "-") +
                (isExtended()     ? "e" : "-");
    }

    public String operandToString(String operand) {
        if (isImmediate()) return "#" + operand;
        if (isIndirect())  return "@" + operand;
        if (isIndexed())   return operand + ",X";
        return operand;
    }

    /* ======================== ni ======================== */

    public int  get_ni()          { return ni & MASK_NI; }
    public void set_ni(int what)  { ni = what & MASK_NI; }
    public void clear_ni()        { ni = 0; }

    public boolean is_ni(int what){ return (ni & MASK_NI) == what; }
    public boolean isSic()        { return is_ni(SIC); }
    public boolean isImmediate()  { return is_ni(IMMEDIATE); }
    public boolean isIndirect()   { return is_ni(INDIRECT); }
    public boolean isSimple()     {
        int f = ni & MASK_NI;
        return f == SIMPLE || f == SIC;
    }

    public byte combineWithOpcode(int opcode) {
        return (byte)((opcode & 0xFC) | (ni & MASK_NI));
    }

    /* ======================== xbpe ======================== */

    public int  get_xbpe()       { return xbpe & MASK_XBPE; }
    public void set_xbpe(int x)  { xbpe = x & MASK_XBPE; }
    public void clear_xbpe()     { xbpe = 0; }

    /** Accepts a raw nibble (e.g., 0b1000) and places it into bits 7..4. */
    public void set_xbpe_nibble(int nibble) {
        xbpe = (nibble & 0x0F) << 4;
    }

    public int  get_x()          { return xbpe & INDEXED; }
    public boolean isIndexed()   { return (xbpe & INDEXED) == INDEXED; }
    public void setIndexed()     { xbpe |= INDEXED; }

    public boolean isBaseRelative() { return (xbpe & BASERELATIVE) == BASERELATIVE; }
    public void setBaseRelative()   { xbpe |= BASERELATIVE; }

    public boolean isPCRelative()   { return (xbpe & PCRELATIVE) == PCRELATIVE; }
    public void setPCRelative()     { xbpe |= PCRELATIVE; }

    public boolean isRelative()     { return isPCRelative() || isBaseRelative(); }
    public boolean isAbsolute()     { return (xbpe & MASK_BP) == NONE; }

    public boolean isExtended()     { return (xbpe & EXTENDED) == EXTENDED; }
    public void setExtended()       { xbpe |= EXTENDED; }

    /** SIC helper: set ONLY X (and clear B/P/E). */
    public void setOnlyX(boolean on) {
        xbpe = on ? INDEXED : 0;
    }

    /* ======================== operand helpers ======================== */

    public int operandSic(int a, int b) {
        // 15-bit address
        return ((a & 0x7F) << 8) | (b & 0xFF);
    }

    public int operandF3(int a, int b) {
        // 12-bit address
        return ((a & 0x0F) << 8) | (b & 0xFF);
    }

    public int operandF4(int a, int b, int c) {
        // 20-bit address
        return ((a & 0x0F) << 16) | ((b & 0xFF) << 8) | (c & 0xFF);
    }

    public int operandPCRelative(int op) {
        // 12-bit signed integer
        return op >= 2048 ? op - 4096 : op;
    }

    public int minOperand() {
        if (isExtended()) return SICXE.MIN_ADDR;
        else return isImmediate() ? SICXE.MIN_SDISP : SICXE.MIN_DISP;
    }

    public int maxOperand() {
        if (isExtended()) return SICXE.MAX_ADDR;
        else return SICXE.MAX_DISP;
    }

    /* ======================== SIC-safe decode for disassembly ======================== */

    /**
     * Decode flags from raw bytes in SIC mode:
     *  - ni := SIC (00)
     *  - xbpe := only X bit taken from byte1 bit7; B/P/E cleared
     */
    public static Flags decodeSIC(int opcodeByte, int byte1) {
        Flags f = new Flags(Flags.SIC, Flags.NONE);
        boolean x = (byte1 & 0x80) != 0;
        f.setOnlyX(x);
        return f;
    }
}
