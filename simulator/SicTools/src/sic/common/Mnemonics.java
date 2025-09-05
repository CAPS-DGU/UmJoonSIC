package sic.common;

import java.util.*;

/**
 * SIC (Leland) only: no SIC/XE features or format 4/2/1 instructions.
 *
 * @author jure
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

    /** Helper for SIC: format 3 (3-byte) memory instructions only. */
    public void put3(String name, int opcode, String hint, String desc) {
        put(new Mnemonic(name, opcode, Format.F3m, hint, desc));
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
            // No extended (+) forms exist anymore, but keep guard in case Mnemonic has other flags
            if (m.isExtended()) continue;
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
        // ===== Directives (SIC) =====
        put("START",   Opcode.START,  Format.De,   "directive", "Define program name and start address.");
        put("END",     Opcode.END,    Format.De,   "directive", "End of program.");

        // Storage directives
        put("RESB",    Opcode.RESB,   Format.Se,   "storage",   "Reserve n bytes.");
        put("RESW",    Opcode.RESW,   Format.Se,   "storage",   "Reserve n words.");
        put("BYTE",    Opcode.BYTE,   Format.Sd,   "storage",   "Initialize bytes.");
        put("WORD",    Opcode.WORD,   Format.Sd,   "storage",   "Initialize words.");

        // ===== SIC instruction set (format 3 only, no format 4/2/1) =====
        // Load / Store
        put3("LDA",    Opcode.LDA,    "A<-(m..m+2)",           "Load accumulator.");
        put3("LDX",    Opcode.LDX,    "X<-(m..m+2)",           "Load index.");
        put3("LDL",    Opcode.LDL,    "L<-(m..m+2)",           "Load link register.");
        put3("STA",    Opcode.STA,    "m..m+2<-(A)",           "Store accumulator.");
        put3("STX",    Opcode.STX,    "m..m+2<-(X)",           "Store index.");
        put3("STL",    Opcode.STL,    "m..m+2<-(L)",           "Store link register.");
        put3("LDCH",   Opcode.LDCH,   "A.1<-(m)",              "Load byte to A.");
        put3("STCH",   Opcode.STCH,   "m<-(A.1)",              "Store byte from A.");
        put3("STSW",   Opcode.STSW,   "m..m+2<-(SW)",          "Store status word.");

        // Integer arithmetic / logic
        put3("ADD",    Opcode.ADD,    "A<-(A)+(m..m+2)",       "Add.");
        put3("SUB",    Opcode.SUB,    "A<-(A)-(m..m+2)",       "Subtract.");
        put3("MUL",    Opcode.MUL,    "A<-(A)*(m..m+2)",       "Multiply.");
        put3("DIV",    Opcode.DIV,    "A<-(A)/(m..m+2)",       "Divide.");
        put3("COMP",   Opcode.COMP,   "A<-(A):(m..m+2)",       "Compare.");
        put3("AND",    Opcode.AND,    "A<-(A)&(m..m+2)",       "Bitwise AND.");
        put3("OR",     Opcode.OR,     "A<-(A)|(m..m+2)",       "Bitwise OR.");

        // Control transfer
        put3("J",      Opcode.J,      "PC<-m",                 "Jump.");
        put3("JEQ",    Opcode.JEQ,    "PC<-m if CC is =",      "Jump if equal.");
        put3("JGT",    Opcode.JGT,    "PC<-m if CC is >",      "Jump if greater.");
        put3("JLT",    Opcode.JLT,    "PC<-m if CC is <",      "Jump if lower.");
        put3("JSUB",   Opcode.JSUB,   "L<-(PC);PC<-m",         "Jump to subroutine.");
        put("RSUB",    Opcode.RSUB,   Format.F3,   "PC<-(L)",  "Return from subroutine.");

        // I/O
        put3("RD",     Opcode.RD,     "A.1<-readdev(m)",       "Read from device.");
        put3("WD",     Opcode.WD,     "writedev(m),A.1",       "Write to device.");
        put3("TD",     Opcode.TD,     "testdev(m)",            "Test device.");

        // ===== EXCLUDED (SIC/XE) =====
        // No: +format4, format1, format2 ops, B/S/T/F registers, floating point,
        // shifts, register-to-register ops, BASE/NOBASE, CSECT/USE, EXTREF/EXTDEF, LTORG, LPS, STI, etc.
    }
}
