package com.sicserver.data;

import sic.asm.ErrorCatcher;
import sic.asm.visitors.WriteVisitor;
import sic.ast.*;
import sic.common.Conversion;

import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class Listing extends WriteVisitor {
    public String codeFileName;
    public final List<Row> rows = new ArrayList<>();
    public HashMap<Integer, StorageSymbol> variableWatch;
    public int startAddress;
    public int programLength;

    public Listing(Program program, String codeFileName) {
        super(program, new ErrorCatcher(), new StringWriter());
        this.visitCommands();
        this.variableWatch = program.getDataLabels();
        this.startAddress = program.start();
        this.programLength = program.section().size();
        this.codeFileName = codeFileName;
    }

    // Struct-like holder
    public static final class Row {
        public final String addressHex;    // e.g., locctr in hex
        public final String rawCodeHex;    // bytes in hex (nice)
        public final String rawCodeBinary; // bytes in 8-bit binary groups (derived), e.g., "00010111 00100000 00101101"
        public final String label;         // label text (may be null)
        public final String instr;         // mnemonic (may start with '=' or '+')
        public final String instrHex;      // e.g., "0x14" or "" if unknown/missing
        public final String instrBin;      // 6-bit binary string e.g., "010100" or ""
        public final String nixbpe;        // 6 chars "nixbpe" or "" if not available
        public final String operand;       // operand text
        public final String comment;       // trailing comment or full-line comment
        public final int labelWidth;       // for formatting alignment
        public final int nameWidth;        // for formatting alignment
        public final boolean isCommentRow;

        Row(String addressHex,
            String rawCodeHex,
            String rawCodeBinary,
            String label,
            String instr,
            String operand,
            String comment,
            int labelWidth,
            int nameWidth,
            boolean isCommentRow,
            String instrHex,
            String instrBin,
            String nixbpe) {

            this.addressHex     = addressHex;
            this.rawCodeHex     = rawCodeHex;
            this.rawCodeBinary  = rawCodeBinary == null ? "" : rawCodeBinary;
            this.label          = label;
            this.instr          = instr;
            this.operand        = operand;
            this.comment        = comment;
            this.labelWidth     = labelWidth;
            this.nameWidth      = nameWidth;
            this.isCommentRow   = isCommentRow;
            this.instrHex       = instrHex == null ? "" : instrHex;
            this.instrBin       = instrBin == null ? "" : instrBin;
            this.nixbpe         = nixbpe == null ? "" : nixbpe;
        }

        @Override
        public String toString() {
            if (isCommentRow) {
                return "                  " + (comment == null ? "" : comment);
            }
            StringBuilder sb = new StringBuilder();
            sb.append(addressHex).append("  ");
            sb.append(rawCodeHex).append("  ");
            String lbl = label == null ? "" : label;
            sb.append(String.format("%-" + labelWidth + "s", lbl)).append("  ");
            String n = instr == null ? "" : instr;
            sb.append(String.format("%-" + nameWidth + "s", n)).append("  ");
            sb.append(operand == null ? "" : operand);
            sb.append("    ").append(comment == null ? "" : comment);
            return sb.toString();
        }
    }

    // Extract nixbpe as "nixbpe" (6 chars) from raw hex like "17202D  ".
    // Returns "000000" if input is null/too short to contain first two bytes.
    private static String flagsFromCode(String code) {
        if (code == null) return "000000";
        String hex = code.replaceAll("\\s+", "");
        if (hex.length() < 4) return "000000";
        try {
            int b0 = Integer.parseInt(hex.substring(0, 2), 16) & 0xFF;
            int b1 = Integer.parseInt(hex.substring(2, 4), 16) & 0xFF;
            int n = (b0 >> 1) & 0x1;
            int i =  b0       & 0x1;
            int x = (b1 >> 7) & 0x1;
            int b = (b1 >> 6) & 0x1;
            int p = (b1 >> 5) & 0x1;
            int e = (b1 >> 4) & 0x1;
            return new StringBuilder(6).append(n).append(i).append(x).append(b).append(p).append(e).toString();
        } catch (NumberFormatException e) {
            return "000000";
        }
    }

    // Convert a hex string like "17202D  " to spaced 8-bit binary per byte: "00010111 00100000 00101101".
    // Returns "" if input is null/invalid.
    private static String hexToBinaryBytes(String code) {
        if (code == null) return "";
        String hex = code.replaceAll("\\s+", "");
        if (hex.isEmpty() || (hex.length() % 2 != 0)) return "";
        StringBuilder out = new StringBuilder();
        try {
            for (int i = 0; i < hex.length(); i += 2) {
                int b = Integer.parseInt(hex.substring(i, i + 2), 16) & 0xFF;
                String bin = String.format("%8s", Integer.toBinaryString(b)).replace(' ', '0');
                if (out.length() > 0) out.append(' ');
                out.append(bin);
            }
            return out.toString();
        } catch (NumberFormatException e) {
            return "";
        }
    }

    public void visit(Command command) {
        int labelLength = program.maxLabelLength();
        int nameLength  = 6;

        String n = command.nameToString();
        if (n.startsWith("=") || n.startsWith("+")) {
            labelLength--;
            nameLength++;
        }

        String addressHex = Conversion.addrToHex(program.locctr());
        String rawHex     = Conversion.bytesToHexNice(command.emitRawCode(), 4);
        String rawBin     = hexToBinaryBytes(rawHex);     // NEW: derived binary

        // Fill LUT-derived fields IFF instruction mnemonic is present and known
        String lutHex = "";
        String lutBin = "";
        String nixbpe = "";
        if (n != null && !n.isEmpty()) {
            var info = OpcodeLUT.get(n);
            if (info != null) {
                lutHex = info.hexByte;   // e.g., "0x14"
                lutBin = info.binary6;   // e.g., "010100"
            }
            // Only compute nixbpe when an instruction is present
            nixbpe = flagsFromCode(rawHex);
        }

        rows.add(new Row(
                addressHex,
                rawHex,
                rawBin,                 // NEW
                command.label(),
                n,
                command.operandToString(),
                command.comment(),
                labelLength,
                nameLength,
                false,
                lutHex,
                lutBin,
                nixbpe
        ));
    }

    public void visit(Comment comment) {
        rows.add(new Row(
                "",              // address
                "",              // raw code (hex)
                "",              // raw code (binary)
                "",              // label
                "",              // instr
                "",              // operand
                comment.comment(),
                0,               // widths not used for comment-only row
                0,
                true,
                "",              // instrHex
                "",              // instrBin
                ""               // nixbpe
        ));
    }

    public void relocate(Relocations relocations) {
        if (relocations == null || relocations.getControlSections().isEmpty()) return;

        // 1) Find this program's control section to get the relocation base
        String sectionName = program.section().name;
        Relocations.ControlSectionInfo match = null;
        for (Relocations.ControlSectionInfo csi : relocations.getControlSections()) {
            if (csi.name != null && csi.name.equalsIgnoreCase(sectionName)) {
                match = csi;
                break;
            }
        }
        if (match == null) return; // no relocation info for this program

        long base = match.start;

        // 2) Relocate each listing row's address (keep comments as-is)
        List<Row> relocatedRows = new ArrayList<>(rows.size());
        for (Row r : rows) {
            if (r.isCommentRow || r.addressHex == null || r.addressHex.isEmpty()) {
                relocatedRows.add(r);
                continue;
            }
            try {
                int oldAddr = Integer.parseInt(r.addressHex, 16);
                int newAddr = (int) (oldAddr + base);
                String newAddrHex = String.format("%06X", newAddr);

                // Recreate row with adjusted address; keep all other fields identical
                relocatedRows.add(new Row(
                        newAddrHex,
                        r.rawCodeHex,
                        r.rawCodeBinary,
                        r.label,
                        r.instr,
                        r.operand,
                        r.comment,
                        r.labelWidth,
                        r.nameWidth,
                        r.isCommentRow,
                        r.instrHex,
                        r.instrBin,
                        r.nixbpe
                ));
            } catch (NumberFormatException nfe) {
                // If address was malformed, keep original row unchanged
                relocatedRows.add(r);
            }
        }
        rows.clear();
        rows.addAll(relocatedRows);

        // 3) Relocate variableWatch by shifting map KEYS (do NOT mutate StorageSymbol)
        if (variableWatch != null && !variableWatch.isEmpty()) {
            HashMap<Integer, StorageSymbol> shifted = new HashMap<>(variableWatch.size());
            for (var e : variableWatch.entrySet()) {
                int oldKey = e.getKey();
                int newKey = (int) (oldKey + base);
                // The StorageSymbol itself remains the same; its internal value is assembler-relative.
                shifted.put(newKey, e.getValue());
            }
            variableWatch = shifted;
        }

        // 4) Update metadata: start address moves; program length stays the same
        startAddress = (int) (startAddress + base);
        // programLength unchanged
    }


    // Concatenate all formatted lines. (We do NOT print rawCodeBinary/instrHex/instrBin/nixbpe here.)
    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        for (Row r : rows) {
            sb.append(r.toString()).append('\n');
        }
        return sb.toString();
    }
}
