package sic.common;

/**
 * Instruction operand codes (pure SIC only)
 * Removed all SIC/XE-only ops (F1/F2/format 4, FP, extra regs/IO) and unsupported directives.
 * This intentionally enforces compile-time errors where removed features were referenced.
 *
 * Preserved instructions: LDA, LDX, LDL, STA, STX, STL, ADD, SUB, MUL, DIV, COMP, TIX,
 * JEQ, JGT, JLT, J, AND, OR, JSUB, RSUB, LDCH, STCH, RD, WD, TD, STSW
 * Preserved directives: START, END, RESB, RESW, BYTE, WORD
 */
public class Opcode {

    // ************ Instructions ****************
    // SIC format (all are format 3 in SIC/XE terms, but we keep only SIC semantics)

    // load and store
    public static final int LDA  = 0x00;
    public static final int LDX  = 0x04;
    public static final int LDL  = 0x08;
    public static final int STA  = 0x0C;
    public static final int STX  = 0x10;
    public static final int STL  = 0x14;

    // fixed point arithmetic
    public static final int ADD  = 0x18;
    public static final int SUB  = 0x1C;
    public static final int MUL  = 0x20;
    public static final int DIV  = 0x24;
    public static final int COMP = 0x28;
    public static final int TIX  = 0x2C;

    // jumps
    public static final int JEQ  = 0x30;
    public static final int JGT  = 0x34;
    public static final int JLT  = 0x38;
    public static final int J    = 0x3C;

    // bit/logic
    public static final int AND  = 0x40;
    public static final int OR   = 0x44;

    // subroutines
    public static final int JSUB = 0x48;
    public static final int RSUB = 0x4C;

    // load/store char & status word
    public static final int LDCH = 0x50;
    public static final int STCH = 0x54;
    public static final int STSW = 0xE8;

    // devices (SIC I/O)
    public static final int RD   = 0xD8;
    public static final int WD   = 0xDC;
    public static final int TD   = 0xE0;

    /**
     * Opcode → mnemonic table indexed by (opcode >> 2).
     * Only pure-SIC mnemonics are present; all others are null.
     */
    private static final String[] opcodeToNames = {
            /* 0x00 */ "LDA",   /* 0x04 */ "LDX",   /* 0x08 */ "LDL",   /* 0x0C */ "STA",
            /* 0x10 */ "STX",   /* 0x14 */ "STL",   /* 0x18 */ "ADD",   /* 0x1C */ "SUB",
            /* 0x20 */ "MUL",   /* 0x24 */ "DIV",   /* 0x28 */ "COMP",  /* 0x2C */ "TIX",
            /* 0x30 */ "JEQ",   /* 0x34 */ "JGT",   /* 0x38 */ "JLT",   /* 0x3C */ "J",
            /* 0x40 */ "AND",   /* 0x44 */ "OR",    /* 0x48 */ "JSUB",  /* 0x4C */ "RSUB",
            /* 0x50 */ "LDCH",  /* 0x54 */ "STCH",  /* 0x58 */ null,    /* 0x5C */ null,
            /* 0x60 */ null,    /* 0x64 */ null,    /* 0x68 */ null,    /* 0x6C */ null,
            /* 0x70 */ null,    /* 0x74 */ null,    /* 0x78 */ null,    /* 0x7C */ null,
            /* 0x80 */ null,    /* 0x84 */ null,    /* 0x88 */ null,    /* 0x8C */ null,
            /* 0x90 */ null,    /* 0x94 */ null,    /* 0x98 */ null,    /* 0x9C */ null,
            /* 0xA0 */ null,    /* 0xA4 */ null,    /* 0xA8 */ null,    /* 0xAC */ null,
            /* 0xB0 */ null,    /* 0xB4 */ null,    /* 0xB8 */ null,    /* 0xBC */ null,
            /* 0xC0 */ null,    /* 0xC4 */ null,    /* 0xC8 */ null,    /* 0xCC */ null,
            /* 0xD0 */ null,    /* 0xD4 */ null,    /* 0xD8 */ "RD",    /* 0xDC */ "WD",
            /* 0xE0 */ "TD",    /* 0xE4 */ null,    /* 0xE8 */ "STSW",  /* 0xEC */ null,
            /* 0xF0 */ null,    /* 0xF4 */ null,    /* 0xF8 */ null,    /* 0xFC */ null
    };

    public static String getName(int opcode) {
        // Valid opcodes are multiples of 4 in [0x00..0xFC]; we map via (opcode >> 2).
        int idx = opcode >>> 2;
        return (idx >= 0 && idx < opcodeToNames.length) ? opcodeToNames[idx] : null;
    }

    public static boolean isValid(int opcode) {
        return getName(opcode) != null;
    }

    // ************ Directives ******************
    // Keep only pure SIC directives. Removed ones are intentionally deleted.

    // Assembler directives
    public static final int START = 0;
    public static final int END   = 1;

    // Storage directives
    public static final int RESB  = 0;
    public static final int RESW  = 1;
    public static final int BYTE  = 3;
    public static final int WORD  = 4;

    // Note: RESF and FLOT removed (no floating-point in pure SIC).
    // Note: BASE/NOBASE/ORG/EQU/USE/CSECT/EXTDEF/EXTREF/LTORG/SSK/etc. removed.
}
