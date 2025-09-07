package sic.asm.ujs;

import sic.asm.ErrorCatcher;
import sic.asm.visitors.WriteVisitor;
import sic.ast.*;
import sic.common.Conversion;

import java.io.StringWriter;
import java.util.*;

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

    // Pure SIC listing flags: show "00x---".
    // - ni: always "00" in SIC (placeholders in opcode low bits)
    // - x : real flag from byte1 bit7
    // - bpe: placeholders that do not exist in SIC encoding → "---"
    private static String flagsFromCode(String code) {
        if (code == null) return "000---"; // ni=00, x=0, bpe=---
        String hex = code.replaceAll("\\s+", "");
        if (hex.length() < 4) return "000---";
        try {
            int b1 = Integer.parseInt(hex.substring(2, 4), 16) & 0xFF;
            int x  = (b1 >> 7) & 0x1;  // only X is meaningful in SIC
            return "00" + x + "---";  // ni + x + bpe
        } catch (NumberFormatException e) {
            return "000---";
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
        if (relocations == null || relocations.getControlSections() == null
                || relocations.getControlSections().isEmpty()) {
            return;
        }

        // Helper
        final java.util.function.Predicate<Row> hasHex = r ->
                r != null && r.rawCodeHex != null && !r.rawCodeHex.trim().isEmpty();

        // ---------- 0) Build name -> base map ----------
        final Map<String, Integer> baseBySection = new HashMap<>();
        for (Relocations.ControlSectionInfo csi : relocations.getControlSections()) {
            if (csi == null || csi.name == null) continue;
            baseBySection.put(csi.name.trim().toLowerCase(Locale.ROOT), (int) csi.start);
        }
        if (baseBySection.isEmpty()) return;

        // ---------- 1) First pass: detect sections & build addr->section index ----------
        final Map<Integer, String> sectionByAsmAddress = new HashMap<>();
        final List<Row> originalRows = new ArrayList<>(rows);

        String currentSection = null;   // canonicalized
        String firstSectionSeen = null;
        for (Row r : originalRows) {
            if (r != null && r.instr != null) {
                String instr = r.instr.trim().toUpperCase(Locale.ROOT);
                if (("START".equals(instr) || "CSECT".equals(instr)) && r.label != null && !r.label.isBlank()) {
                    currentSection = r.label.trim().toLowerCase(Locale.ROOT);
                    if (firstSectionSeen == null) firstSectionSeen = currentSection;
                }
            }
            // Only index addresses for rows that actually carry raw hex
            if (hasHex.test(r) && r.addressHex != null && !r.addressHex.isEmpty()) {
                try {
                    int asmAddr = Integer.parseInt(r.addressHex, 16);
                    if (currentSection != null) {
                        sectionByAsmAddress.putIfAbsent(asmAddr, currentSection);
                    }
                } catch (NumberFormatException ignore) { }
            }
        }

        // Snapshot patches (may be empty)
        final List<Relocations.PatchInfo> patches =
                (relocations.getPatches() != null) ? relocations.getPatches() : List.of();

        // ---------- 2) Second pass: relocate rows and apply raw-hex patches ----------
        final List<Row> relocatedRows = new ArrayList<>(rows.size());
        currentSection = null; // reset and track again during rewrite

        for (Row r : originalRows) {
            if (r == null) { relocatedRows.add(r); continue; }

            // Track section boundaries while rewriting
            if (r.instr != null) {
                String instr = r.instr.trim().toUpperCase(Locale.ROOT);
                if (("START".equals(instr) || "CSECT".equals(instr)) && r.label != null && !r.label.isBlank()) {
                    currentSection = r.label.trim().toLowerCase(Locale.ROOT);
                }
            }

            // Comments: unchanged
            if (r.isCommentRow) { relocatedRows.add(r); continue; }

            // If row has NO raw hex, leave it unchanged — except END (we still relocate END address)
            boolean rowHasHex = hasHex.test(r);
            boolean isEnd = (r.instr != null && "END".equalsIgnoreCase(r.instr.trim()));
            if (!rowHasHex && !isEnd) { relocatedRows.add(r); continue; }

            // If there's no address, we can't relocate/persist patches safely
            if (r.addressHex == null || r.addressHex.isEmpty()) { relocatedRows.add(r); continue; }

            try {
                int oldAddr = Integer.parseInt(r.addressHex, 16);

                // choose base from current section, or infer from first-pass addr map
                String sectKey = currentSection;
                if (sectKey == null) sectKey = sectionByAsmAddress.get(oldAddr);

                int base = 0;
                if (sectKey != null) {
                    Integer b = baseBySection.get(sectKey);
                    if (b != null) base = b;
                }

                // SPECIAL CASE: END uses operand section base if present
                if (isEnd) {
                    String op = (r.operand == null) ? null : r.operand.trim();
                    if (op != null && !op.isEmpty()) {
                        Integer endBase = baseBySection.get(op.toLowerCase(Locale.ROOT));
                        if (endBase != null) base = endBase;
                    }
                }

                int absAddr = oldAddr + base;
                String newAddrHex = String.format("%06X", absAddr);

                // If row has no hex (only END hits this branch), just relocate the address and keep fields as-is
                if (!rowHasHex) {
                    relocatedRows.add(new Row(
                            newAddrHex,
                            r.rawCodeHex,     // stays blank
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
                    continue;
                }

                // -------- Apply raw-hex patches to this row, if any overlap --------
                String newRawHex = r.rawCodeHex;
                String newInstrHex = r.instrHex;

                if (sectKey != null && newRawHex != null && !newRawHex.isEmpty()) {
                    final int rowNibbleStart = absAddr * 2;
                    final int rowNibbleLen   = newRawHex.length(); // nibbles
                    final int rowNibbleEnd   = rowNibbleStart + rowNibbleLen;

                    StringBuilder rawBuilder = new StringBuilder(newRawHex);

                    boolean patchInstrHex = (newInstrHex != null && newInstrHex.length() == newRawHex.length());
                    StringBuilder instrBuilder = patchInstrHex ? new StringBuilder(newInstrHex) : null;

                    for (Relocations.PatchInfo p : patches) {
                        if (p == null) continue;
                        if (p.sectionName == null || !p.sectionName.trim().equalsIgnoreCase(sectKey)) continue;

                        final int patchNibbleStart = (int) (p.tRecordStartAddr * 2L + p.textOffsetHalfBytes);
                        final int patchNibbleEnd   = patchNibbleStart + p.lengthHalfBytes;

                        final int overlapStart = Math.max(rowNibbleStart, patchNibbleStart);
                        final int overlapEnd   = Math.min(rowNibbleEnd,   patchNibbleEnd);
                        if (overlapStart >= overlapEnd) continue;

                        final int rowLocalStart = overlapStart - rowNibbleStart;
                        final int rowLocalLen   = overlapEnd   - overlapStart;

                        final int patchLocalStart = overlapStart - patchNibbleStart;

                        if (rowLocalStart < 0 || rowLocalStart + rowLocalLen > rawBuilder.length()) continue;
                        if (p.afterHex == null) continue;
                        if (patchLocalStart < 0 || patchLocalStart + rowLocalLen > p.afterHex.length()) continue;

                        String replacement = p.afterHex.substring(patchLocalStart, patchLocalStart + rowLocalLen);
                        rawBuilder.replace(rowLocalStart, rowLocalStart + rowLocalLen, replacement);

                        if (patchInstrHex) {
                            instrBuilder.replace(rowLocalStart, rowLocalStart + rowLocalLen, replacement);
                        }
                    }

                    newRawHex = rawBuilder.toString();
                    if (patchInstrHex) newInstrHex = instrBuilder.toString();
                }

                // Recreate row with adjusted address + patched hex
                relocatedRows.add(new Row(
                        newAddrHex,
                        newRawHex,
                        r.rawCodeBinary,
                        r.label,
                        r.instr,
                        r.operand,
                        r.comment,
                        r.labelWidth,
                        r.nameWidth,
                        r.isCommentRow,
                        newInstrHex,
                        r.instrBin,
                        r.nixbpe
                ));
            } catch (NumberFormatException nfe) {
                relocatedRows.add(r);
            }
        }

        rows.clear();
        rows.addAll(relocatedRows);

        // ---------- 3) Relocate variableWatch per section ----------
        if (variableWatch != null && !variableWatch.isEmpty()) {
            HashMap<Integer, StorageSymbol> shifted = new HashMap<>(variableWatch.size());
            for (var e : variableWatch.entrySet()) {
                int asmAddr = e.getKey();
                String sectKey = sectionByAsmAddress.get(asmAddr);
                int base = 0;
                if (sectKey != null) {
                    Integer b = baseBySection.get(sectKey);
                    if (b != null) base = b;
                }
                shifted.put(asmAddr + base, e.getValue());
            }
            variableWatch = shifted;
        }

        // ---------- 4) Update metadata ----------
        if (firstSectionSeen != null) {
            Integer b = baseBySection.get(firstSectionSeen);
            if (b != null) startAddress += b;
        }
        // programLength intentionally unchanged
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
