package sic.common;

import java.util.*;

/**
 * Pure SIC mnemonic table (no XE).
 * - Only format 3 (no format 1/2/4).
 * - Only X indexing is allowed elsewhere in the assembler; this table
 *   just enumerates legal mnemonics for pure SIC.
 */
public class Mnemonics {

    public final Map<String, Mnemonic> map;

    public Mnemonics() {
        this.map = new HashMap<String, Mnemonic>();
        initMnemonics();
    }

    public Mnemonic get(String name) {
        if (map.containsKey(name)) return map.get(name);
        return null;
    }

    public void put(Mnemonic mnemonic) {
        map.put(mnemonic.name, mnemonic);
    }

    public void put(String name, int opcode, Format format, String hint, String desc) {
        put(new Mnemonic(name, opcode, format, hint, desc));
    }

    public void put(String name, Format format, String hint, String desc) {
        put(new Mnemonic(name, (byte)0, format, hint, desc));
    }

    /**
     * In pure SIC there is no Format 4. Keep this method name so callers
     * don’t need to change, but only register the F3 variant.
     */
    public void put34(String name, int opcode, String hint, String desc) {
        put(new Mnemonic(name, opcode, Format.F3m, hint, desc));
        // NO "+name" / Format.F4m in pure SIC
    }

    public List<Mnemonic> sortByKindName() {
        List<Mnemonic> list = new ArrayList<Mnemonic>(map.values());
        Collections.sort(list, new Comparator<Mnemonic>() {
            public int compare(Mnemonic o1, Mnemonic o2) {
                String n1 = o1.getClass().getName();
                String n2 = o2.getClass().getName();
                int r = n1.compareTo(n2);
                if (r != 0) return r;
                return o1.name.compareTo(o2.name);
            }
        });
        return list;
    }

    public List<Mnemonic> sortByName() {
        List<Mnemonic> list = new ArrayList<Mnemonic>(map.values());
        Collections.sort(list, new Comparator<Mnemonic>() {
            public int compare(Mnemonic o1, Mnemonic o2) {
                return o1.name.compareTo(o2.name);
            }
        });
        return list;
    }

    public List<String> getReferenceShort() {
        final String formatRef = "%-6s  %-10s";
        List<String> list = new ArrayList<String>();
        for (Mnemonic m : sortByKindName()) {
            if (m.isExtended()) continue; // harmless, none will be extended now
            list.add(String.format(formatRef, m.name, m.format.hint()));
        }
        return list;
    }

    public void printReferenceShort() {
        List<String> list = getReferenceShort();
        int half = list.size() / 2;
        int odd = list.size() % 2;
        for (int i = 0; i < half; i++) {
            String s1 = list.get(i);
            String s2 = list.get(half + odd + i);
            System.out.println(s1 + "\t" + s2);
        }
        if (odd > 0) System.out.println(list.get(half));
    }

    public void printReferenceLong() {
        final String formatRef = "%-6s  %-10s  %-16s  %s";
        for (Mnemonic m : sortByKindName()) {
            if (m.isExtended()) continue;
            System.out.println(String.format(formatRef, m.name, m.format.hint(), m.hint, m.desc));
        }
    }

    public void initMnemonics() {
        // ===== Directives (pure SIC only) =====
        put("START",   Opcode.START,  Format.De, "directive", "Define program name and start address (hex).");
        put("END",     Opcode.END,    Format.De, "directive", "End of program.");
        put("RESB",    Opcode.RESB,   Format.Se, "storage",   "Reserve n bytes.");
        put("RESW",    Opcode.RESW,   Format.Se, "storage",   "Reserve n words.");
        put("BYTE",    Opcode.BYTE,   Format.Sd, "storage",   "Initialize bytes (C'..' or X'..').");
        put("WORD",    Opcode.WORD,   Format.Sd, "storage",   "Initialize words.");

        // ===== Load & Store =====
        put34("LDA",   Opcode.LDA,  "A<-(m..m+2)",         "Load A from memory.");
        put34("LDCH",  Opcode.LDCH, "A.1<-(m)",            "Load byte to A from memory.");
        put34("LDL",   Opcode.LDL,  "L<-(m..m+2)",         "Load L from memory.");
        put34("LDX",   Opcode.LDX,  "X<-(m..m+2)",         "Load X from memory.");
        put34("STA",   Opcode.STA,  "m..m+2<-(A)",         "Store A to memory.");
        put34("STCH",  Opcode.STCH, "m<-(A.1)",            "Store byte from A to memory.");
        put34("STL",   Opcode.STL,  "m..m+2<-(L)",         "Store L to memory.");
        put34("STX",   Opcode.STX,  "m..m+2<-(X)",         "Store X to memory.");
        put34("STSW",  Opcode.STSW, "m..m+2<-(SW)",        "Store status word.");

        // ===== Fixed-point & Logic (mem) =====
        put34("ADD",   Opcode.ADD,  "A<-(A)+(m..m+2)",     "Add to accumulator.");
        put34("SUB",   Opcode.SUB,  "A<-(A)-(m..m+2)",     "Subtract from accumulator.");
        put34("MUL",   Opcode.MUL,  "A<-(A)*(m..m+2)",     "Multiply accumulator.");
        put34("DIV",   Opcode.DIV,  "A<-(A)/(m..m+2)",     "Divide accumulator.");
        put34("COMP",  Opcode.COMP, "A<-(A):(m..m+2)",     "Compare accumulator.");
        put34("AND",   Opcode.AND,  "A<-(A)&(m..m+2)",     "Bitwise AND accumulator.");
        put34("OR",    Opcode.OR,   "A<-(A)|(m..m+2)",     "Bitwise OR accumulator.");
        put34("TIX",   Opcode.TIX,  "X<-(X)+1;(X):(m..m+2)", "Increment X and compare.");

        // ===== Jumps & Subroutines =====
        put34("J",     Opcode.J,    "PC<-m",               "Unconditional jump.");
        put34("JEQ",   Opcode.JEQ,  "PC<-m if CC is =",    "Jump if equal.");
        put34("JGT",   Opcode.JGT,  "PC<-m if CC is >",    "Jump if greater.");
        put34("JLT",   Opcode.JLT,  "PC<-m if CC is <",    "Jump if lower.");
        put34("JSUB",  Opcode.JSUB, "L<-(PC);PC<-m",       "Jump to subroutine.");
        put("RSUB",    Opcode.RSUB, Format.F3, "PC<-(L)",  "Return from subroutine.");

        // ===== I/O =====
        put34("RD",    Opcode.RD,   "A.1<-readdev(m)",     "Read from device.");
        put34("WD",    Opcode.WD,   "writedev(m),A.1",     "Write to device.");
        put34("TD",    Opcode.TD,   "testdev(m)",          "Test device.");

        // NOTE: Everything else (F1/F2 ops, floating point ops, BASE/ORG/EXT*, etc.) intentionally omitted for pure SIC.
    }
}
