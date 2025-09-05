package sic.common;

/**
 * SIC computer specifications (SIC-only; XE removed).
 * Kept under the same class name for compatibility with existing code.
 *
 * Types:
 *  - sicaddr (15-bit):        0 .. 0x7FFF
 *  - word (24-bit):           0 .. 0xFFFFFF
 *  - sword (signed 24-bit):   -0x800000 .. 0x7FFFFF
 *  - byte (8-bit):            0 .. 0xFF
 *
 * XE-specific 20-bit addr and 12-bit displacements are not used by SIC,
 * but some helpers remain for compatibility where harmless.
 */
public class SICXE {

    /* ===== SIC addresses: 15-bit memory (32 KiB) ===== */
    public static final int SIZE_SICMEM   = 1 << 15;   // 32768 bytes
    public static final int MASK_SICADDR  = 0x7FFF;
    public static final int MIN_SICADDR   = 0;
    public static final int MAX_SICADDR   = SIZE_SICMEM - 1;

    // Backward-compatibility aliases (old code might reference these XE names)
    public static final int SIZE_MEM      = SIZE_SICMEM;
    public static final int MASK_ADDR     = MASK_SICADDR;
    public static final int MIN_ADDR      = MIN_SICADDR;
    public static final int MAX_ADDR      = MAX_SICADDR;

    public static int intToSicAddr(int val) { return val & MASK_SICADDR; }
    public static int sicAddrToInt(int val) { return val; }
    public static boolean isSicAddr(int val){ return MIN_SICADDR <= val && val <= MAX_SICADDR; }

    // Back-compat wrappers
    public static int intToAddr(int val)    { return intToSicAddr(val); }
    public static int addrToInt(int val)    { return val; }
    public static boolean isAddr(int val)   { return isSicAddr(val); }

    /* ===== Words: unsigned and signed 24-bit ===== */
    public static final int MASK_WORD   = 0xFFFFFF;
    public static final int MIN_WORD    = 0;
    public static final int MAX_WORD    = (1 << 24) - 1;

    public static int intToWord(int val) {
        // Wrap to 24 bits (two's complement if negative)
        if (val >= 0) return val & MASK_WORD;
        return ~(-val - 1) & MASK_WORD;
    }
    public static int wordToInt(int val)  { return val; }
    public static boolean isWord(int val) { return MIN_WORD <= val && val <= MAX_WORD; }

    public static final int MASK_SWORD   = 0x7FFFFF;
    public static final int MIN_SWORD    = -(1 << 23);
    public static final int MAX_SWORD    = (1 << 23) - 1;

    public static int intToSword(int val) { return intToWord(val); }
    public static int swordToInt(int val) {
        if (val <= MAX_SWORD) return val;               // positive or small
        return -(~val & MASK_SWORD) - 1;                // sign-extend 24-bit
    }
    public static boolean isSword(int val){ return MIN_SWORD <= val && val <= MAX_SWORD; }

    /* ===== Displacement helpers (not used by SIC, kept for compatibility) =====
       SIC does not use 12-bit PC/base displacements, but some code may still
       reference these helpers. Leave definitions intact; they won't be used in
       SIC-only assembly, and keeping them avoids widespread refactors.
    */
    public static final int MASK_DISP   = 0x0FFF;
    public static final int MIN_DISP    = 0;
    public static final int MAX_DISP    = (1 << 12) - 1;

    public static int intToDisp(int val) {
        if (val >= 0) return val & MASK_DISP;
        return MAX_DISP + 1 + val; // two's complement wrap to 12 bits
    }
    public static int dispToInt(int val)  { return val; }
    public static boolean isDisp(int val) { return MIN_DISP <= val && val <= MAX_DISP; }

    public static final int MASK_SDISP   = 0x07FF;          // 11 bits
    public static final int MIN_SDISP    = -(1 << 11);      // -2048
    public static final int MAX_SDISP    = (1 << 11) - 1;   //  2047

    public static int intToSdisp(int val) { return intToDisp(val); }

    public static int sdispToInt(int val) {
        // Correct 11-bit sign extension (not MAX_SWORD)
        if (val <= MAX_SDISP) return val;                 // fits positive 11-bit
        // Negative: sign-extend 11-bit two's complement to int
        return val | ~MASK_SDISP;
    }

    public static boolean isSdisp(int val) { return MIN_SDISP <= val && val <= MAX_SDISP; }

    /** Combined displacement (legacy): keep behavior for compatibility. */
    public static boolean isCdisp(int val) { return MIN_SDISP <= val && val <= MAX_DISP; }

    /* ===== Floats (48-bit) — retained for data utilities compatibility ===== */
    public static long floatToBits(double value) { return Double.doubleToLongBits(value) >> 16; }
    public static double bitsToFloat(long bits)  { return Double.longBitsToDouble(bits << 16); }

    /* ===== Byte limits ===== */
    public static final int MIN_BYTE  = 0;
    public static final int MAX_BYTE  = (1 << 8) - 1;

    public static final int MIN_SBYTE = -(1 << 7);
    public static final int MAX_SBYTE = (1 << 7) - 1;

    /* ===== Data helpers ===== */
    public static byte[] intToDataByte(int val) {
        return new byte[] { (byte) (val & 0xFF) };
    }

    public static byte[] intToDataWord(int val) {
        // 24-bit big-endian
        return new byte[] {
                (byte) ((val >> 16) & 0xFF),
                (byte) ((val >> 8)  & 0xFF),
                (byte) (val & 0xFF)
        };
    }

    public static byte[] doubleToDataFloat(double val) {
        long bits = floatToBits(val);
        return new byte[] {
                (byte)((bits >> 40) & 0xFF),
                (byte)((bits >> 32) & 0xFF),
                (byte)((bits >> 24) & 0xFF),
                (byte)((bits >> 16) & 0xFF),
                (byte)((bits >> 8)  & 0xFF),
                (byte)(bits & 0xFF)
        };
    }

    /* ===== Devices (unchanged) ===== */
    public static final int DEVICE_COUNT = 256;
    public static final int MIN_DEVICE   = 0;
    public static final int MAX_DEVICE   = DEVICE_COUNT - 1;
    public static final int DEVICE_STDIN = 0;
    public static final int DEVICE_STDOUT= 1;
    public static final int DEVICE_STDERR= 2;
    public static final int DEVICE_FREE  = 3;
}
