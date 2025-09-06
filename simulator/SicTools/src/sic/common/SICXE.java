package sic.common;

/**
 * Pure SIC computer specifications (15-bit address space).
 * Conversions between SIC types and Java types.
 *
 * NOTE: Class name and package kept as-is for compatibility with existing code.
 *       Addresses now adhere to SIC's 15-bit (32KB) memory model.
 *
 * @author jure (modified for pure SIC)
 */
public class SICXE {

    /* SIC types:
     * addr (15-bit):           0 .. 0x7FFF
     * sicaddr (15-bit):        0 .. 0x7FFF   (alias of addr for compatibility)
     * word (24-bit):           0 .. 0xFFFFFF
     * sword (signed 24-bit):   -0x800000 .. 0x7FFFFF
     * disp (12-bit):           0 .. 0xFFF
     * sdisp (signed 12-bit):   -0x800 .. 0x7FF
     * float: (deprecated; SIC has no FPU)
     * data: bytes of data
     */

    // ************ addresses: SIC 15-bit memory (32 KB)

    // Primary memory model now uses SIC limits everywhere:
    public static final int SIZE_MEM  = 1 << 15;   // 32 KB
    public static final int MASK_ADDR = 0x7FFF;
    public static final int MIN_ADDR  = 0;
    public static final int MAX_ADDR  = SIZE_MEM - 1;

    public static int intToAddr(int val) {
        return val & MASK_ADDR;
    }

    public static int addrToInt(int val) {
        return val;
    }

    public static boolean isAddr(int val) {
        return MIN_ADDR <= val && val <= MAX_ADDR;
    }

    // ************ addresses: SIC alias (kept for compatibility)

    // Aliased to the same SIC memory model to avoid divergent limits:
    public static final int SIZE_SICMEM   = SIZE_MEM;          // 32 KB
    public static final int MASK_SICADDR  = MASK_ADDR;         // 0x7FFF
    public static final int MIN_SICADDR   = MIN_ADDR;          // 0
    public static final int MAX_SICADDR   = MAX_ADDR;          // 0x7FFF

    public static int intToSicAddr(int val) {
        return intToAddr(val);
    }

    public static int sicAddrToInt(int val) {
        return addrToInt(val);
    }

    public static boolean isSicAddr(int val) {
        return isAddr(val);
    }

    // ************ words: unsigned and signed (unchanged for SIC)

    public static final int MASK_WORD = 0xFFFFFF;
    public static final int MIN_WORD  = 0;
    public static final int MAX_WORD  = (1 << 24) - 1;

    // if val < 0, returns two's complement within 24 bits
    public static int intToWord(int val) {
        if (val >= 0) return val & MASK_WORD;
        return ~(-val - 1) & MASK_WORD;
    }

    public static int wordToInt(int val) {
        return val;
    }

    public static boolean isWord(int val) {
        return MIN_WORD <= val && val <= MAX_WORD;
    }

    public static final int MASK_SWORD = 0x7FFFFF;
    public static final int MIN_SWORD  = -(1 << 23);
    public static final int MAX_SWORD  = (1 << 23) - 1;

    public static int intToSword(int val) {
        return intToWord(val);
    }

    public static int swordToInt(int val) {
        if (val <= MAX_SWORD) return val;
        return -(~val & MASK_SWORD) - 1;
    }

    public static boolean isSword(int val) {
        return MIN_SWORD <= val && val <= MAX_SWORD;
    }

    // ************ displacement: unsigned and signed (format 3/4 uses 12-bit disp; SIC uses only X indexing)

    public static final int MASK_DISP = 0xFFF;
    public static final int MIN_DISP  = 0;
    public static final int MAX_DISP  = (1 << 12) - 1;

    public static int intToDisp(int val) {
        if (val >= 0) return val & MASK_DISP;
        // Map negative inputs into 12-bit unsigned range.
        return (MAX_DISP + 1 + (val % (MAX_DISP + 1))) & MASK_DISP;
    }

    public static int dispToInt(int val) {
        return val;
    }

    public static boolean isDisp(int val) {
        return MIN_DISP <= val && val <= MAX_DISP;
    }

    public static final int MASK_SDISP = 0x7FF;
    public static final int MIN_SDISP  = -(1 << 11);
    public static final int MAX_SDISP  = (1 << 11) - 1;

    public static int intToSdisp(int val) {
        // Two's complement in 12 bits
        if (val >= 0) return val & MASK_DISP;
        return ((1 << 12) + (val % (1 << 12))) & MASK_DISP;
    }

    public static int sdispToInt(int val) {
        // FIX: use signed 12-bit interpretation (not sword’s bounds/mask)
        if ((val & 0x800) == 0) return val;                    // positive
        return -(((~val) & MASK_SDISP) + 1);                   // negative sign-extend
    }

    public static boolean isSdisp(int val) {
        return MIN_SDISP <= val && val <= MAX_SDISP;
    }

    public static boolean isCdisp(int val) {
        // combined displacement: signed and unsigned
        return MIN_SDISP <= val && val <= MAX_DISP;
    }

    // ************ floats (deprecated in pure SIC; kept for compatibility)

    /**
     * @deprecated Pure SIC has no FPU; these helpers are retained only to avoid
     * breaking existing code paths. Prefer WORD/BYTE storage in pure SIC.
     */
    @Deprecated
    public static long floatToBits(double value) {
        return Double.doubleToLongBits(value) >> 16;
    }

    /**
     * @deprecated See {@link #floatToBits(double)}.
     */
    @Deprecated
    public static double bitsToFloat(long bits) {
        return Double.longBitsToDouble(bits << 16);
    }

    // ************ byte: unsigned and signed

    public static final int MIN_BYTE = 0;
    public static final int MAX_BYTE = (1 << 8) - 1;

    public static final int MIN_SBYTE = -(1 << 7);
    public static final int MAX_SBYTE = (1 << 7) - 1;

    // ************ data (array of bytes) initializers

    public static byte[] intToDataByte(int val) {
        byte[] data = new byte[1];
        data[0] = (byte)(val & 0xFF);
        return data;
    }

    public static byte[] intToDataWord(int val) {
        byte[] data = new byte[3];
        data[0] = (byte)((val >> 16)  & 0xFF);
        data[1] = (byte)((val >> 8)   & 0xFF);
        data[2] = (byte)(val & 0xFF);
        return data;
    }

    /**
     * @deprecated Pure SIC has no float data type. Retained for compatibility only.
     */
    @Deprecated
    public static byte[] doubleToDataFloat(double val) {
        long bits = floatToBits(val);
        byte[] data = new byte[6];
        data[0] = (byte)((bits >> 40) & 0xFF);
        data[1] = (byte)((bits >> 32) & 0xFF);
        data[2] = (byte)((bits >> 24) & 0xFF);
        data[3] = (byte)((bits >> 16) & 0xFF);
        data[4] = (byte)((bits >> 8)  & 0xFF);
        data[5] = (byte)(bits & 0xFF);
        return data;
    }

    // ************ devices (unchanged)
    public static final int DEVICE_COUNT = 256;
    public static final int MIN_DEVICE   = 0;
    public static final int MAX_DEVICE   = DEVICE_COUNT - 1;
    public static final int DEVICE_STDIN  = 0;
    public static final int DEVICE_STDOUT = 1;
    public static final int DEVICE_STDERR = 2;
    public static final int DEVICE_FREE   = 3;
}
