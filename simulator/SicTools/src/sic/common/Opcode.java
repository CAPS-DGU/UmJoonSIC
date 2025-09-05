package sic.common;

/**
 * Instruction operand codes for SIC (Leland only).
 * No SIC/XE opcodes, no extra directives.
 * @author jure
 */
public class Opcode {

    // ************ SIC Instructions (format 3) ****************

    // load and store
    public static final int LDA   = 0x00;
    public static final int LDX   = 0x04;
    public static final int LDL   = 0x08;
    public static final int STA   = 0x0C;
    public static final int STX   = 0x10;
    public static final int STL   = 0x14;

    // fixed point arithmetic
    public static final int ADD   = 0x18;
    public static final int SUB   = 0x1C;
    public static final int MUL   = 0x20;
    public static final int DIV   = 0x24;
    public static final int COMP  = 0x28;
    public static final int TIX   = 0x2C;

    // jumps
    public static final int JEQ   = 0x30;
    public static final int JGT   = 0x34;
    public static final int JLT   = 0x38;
    public static final int J     = 0x3C;

    // bit manipulation
    public static final int AND   = 0x40;
    public static final int OR    = 0x44;

    // jump to subroutine
    public static final int JSUB  = 0x48;
    public static final int RSUB  = 0x4C;

    // load and store int
    public static final int LDCH  = 0x50;
    public static final int STCH  = 0x54;

    // devices
    public static final int RD    = 0xD8;
    public static final int WD    = 0xDC;
    public static final int TD    = 0xE0;

    // store status word
    public static final int STSW  = 0xE8;

    private static final String[] opcodeToNames = {
            "LDA", "LDX", "LDL", "STA", "STX", "STL", "ADD", "SUB",
            "MUL", "DIV", "COMP", "TIX", "JEQ", "JGT", "JLT", "J",
            "AND", "OR", "JSUB", "RSUB", "LDCH", "STCH", null, null,
            null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, "RD", "WD",
            "TD", null, "STSW", null, null, null, null, null
    };

    public static String getName(int opcode) {
        // 0 <= opcode <= 255
        return opcodeToNames[opcode >> 2];
    }

    public static boolean isValid(int opcode) {
        return getName(opcode) != null;
    }

    // ************ Directives (SIC only) ******************

    public static final int START = 0;
    public static final int END   = 1;

    // Storage directives
    public static final int RESB  = 0;
    public static final int RESW  = 1;
    public static final int BYTE  = 2;
    public static final int WORD  = 3;
}
