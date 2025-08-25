package com.sicserver.data;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Opcode LUT: String mnemonic -> { byte: "0xHH", binary6: "bbbbbb" }
 * - "byte"  : 8-bit opcode in hex (as in object code, low 2 bits are 0).
 * - "binary": 6-bit opcode (opcode >> 2), left-padded with zeros.
 *
 * Covers all valid SIC/SIC-XE opcodes from sic.common.Opcode.
 */
public final class OpcodeLUT {

    public static final class Info {
        public final String mnemonic; // e.g., "LDA"
        public final String hexByte;  // e.g., "0x00"
        public final String binary6;  // e.g., "000000"

        private Info(String mnemonic, int byteValue) {
            this.mnemonic = mnemonic;
            this.hexByte  = String.format("0x%02X", byteValue & 0xFF);
            this.binary6  = to6BitBinary(byteValue >>> 2);
        }

        private static String to6BitBinary(int v) {
            String s = Integer.toBinaryString(v & 0x3F);
            return ("000000" + s).substring(s.length());
        }

        @Override public String toString() {
            return mnemonic + " => { byte: \"" + hexByte + "\", binary: \"" + binary6 + "\" }";
        }
    }

    private static final Map<String, Info> OPS;

    static {
        LinkedHashMap<String, Info> m = new LinkedHashMap<>();

        // ***** SIC format, SIC/XE format 3, and SIC/XE format 4 *****
        add(m, "LDA",   0x00);
        add(m, "LDX",   0x04);
        add(m, "LDL",   0x08);
        add(m, "STA",   0x0C);
        add(m, "STX",   0x10);
        add(m, "STL",   0x14);
        add(m, "ADD",   0x18);
        add(m, "SUB",   0x1C);
        add(m, "MUL",   0x20);
        add(m, "DIV",   0x24);
        add(m, "COMP",  0x28);
        add(m, "TIX",   0x2C);
        add(m, "JEQ",   0x30);
        add(m, "JGT",   0x34);
        add(m, "JLT",   0x38);
        add(m, "J",     0x3C);
        add(m, "AND",   0x40);
        add(m, "OR",    0x44);
        add(m, "JSUB",  0x48);
        add(m, "RSUB",  0x4C);
        add(m, "LDCH",  0x50);
        add(m, "STCH",  0x54);

        // ***** SIC/XE Format 3 and 4 *****
        add(m, "ADDF",  0x58);
        add(m, "SUBF",  0x5C);
        add(m, "MULF",  0x60);
        add(m, "DIVF",  0x64);
        add(m, "COMPF", 0x88);
        add(m, "LDB",   0x68);
        add(m, "LDS",   0x6C);
        add(m, "LDF",   0x70);
        add(m, "LDT",   0x74);
        add(m, "STB",   0x78);
        add(m, "STS",   0x7C);
        add(m, "STF",   0x80);
        add(m, "STT",   0x84);
        add(m, "LPS",   0xD0);
        add(m, "STI",   0xD4);
        add(m, "STSW",  0xE8);
        add(m, "RD",    0xD8);
        add(m, "WD",    0xDC);
        add(m, "TD",    0xE0);
        add(m, "SSK",   0xEC);

        // ***** SIC/XE Format 1 *****
        add(m, "FLOAT", 0xC0);
        add(m, "FIX",   0xC4);
        add(m, "NORM",  0xC8);
        add(m, "SIO",   0xF0);
        add(m, "HIO",   0xF4);
        add(m, "TIO",   0xF8);

        // ***** SIC/XE Format 2 *****
        add(m, "ADDR",  0x90);
        add(m, "SUBR",  0x94);
        add(m, "MULR",  0x98);
        add(m, "DIVR",  0x9C);
        add(m, "COMPR", 0xA0);
        add(m, "SHIFTL",0xA4);
        add(m, "SHIFTR",0xA8);
        add(m, "RMO",   0xAC);
        add(m, "SVC",   0xB0);
        add(m, "CLEAR", 0xB4);
        add(m, "TIXR",  0xB8);

        OPS = Collections.unmodifiableMap(m);
    }

    private static void add(Map<String, Info> m, String name, int byteVal) {
        m.put(name, new Info(name, byteVal));
    }

    /** Unmodifiable view of the LUT. Key = mnemonic (e.g., "LDA"). */
    public static Map<String, Info> all() { return OPS; }

    /** Lookup by mnemonic. Returns null if not present. */
    public static Info get(String mnemonic) { return OPS.get(mnemonic); }

    private OpcodeLUT() {}
}
