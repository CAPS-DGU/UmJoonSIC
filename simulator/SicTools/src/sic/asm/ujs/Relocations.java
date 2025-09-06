package sic.asm.ujs;

import sic.link.section.Section;
import sic.link.section.ExtDef;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/**
 * Relocations represents the relocation/logging information produced by the linker.
 * It records all control sections, external symbols, and exact raw-hex patches applied in the 2nd pass.
 */
public class Relocations {

    private final List<ControlSectionInfo> controlSections;
    private final List<ExternalSymbolInfo> externalSymbols;

    // NEW: exact raw-hex patches applied during second pass
    private final List<PatchInfo> patches;

    public Relocations() {
        this.controlSections = new ArrayList<>();
        this.externalSymbols = new ArrayList<>();
        this.patches = new ArrayList<>();
    }

    /* ----------- Data models ----------- */

    public static class ControlSectionInfo {
        public final String name;
        public final long start;
        public final long length;

        public ControlSectionInfo(String name, long start, long length) {
            this.name = name;
            this.start = start;
            this.length = length;
        }

        @Override
        public String toString() {
            return String.format("%6s | 0x%06X | 0x%06X", name, start, length);
        }
    }

    public static class ExternalSymbolInfo {
        public final String name;
        public final long csAddress;
        public final long address;

        public ExternalSymbolInfo(String name, long csAddress, long address) {
            this.name = name;
            this.csAddress = csAddress;
            this.address = address;
        }

        @Override
        public String toString() {
            return String.format("%6s | 0x%06X | 0x%06X", name, csAddress, address);
        }
    }

    /**
     * NEW: Describes a concrete hex patch (half-bytes) applied to a T-record.
     * If a fix spans two T-records, you'll get two PatchInfo entries (one per record).
     */
    public static class PatchInfo {
        /** Control section name where the patch was applied */
        public final String sectionName;
        /** T-record start address (absolute, after 1st pass) */
        public final long tRecordStartAddr;
        /** Offset into the T-record TEXT string, in half-bytes (nibbles) */
        public final int textOffsetHalfBytes;
        /** Number of half-bytes replaced */
        public final int lengthHalfBytes;
        /** Original half-bytes (uppercase hex, length == lengthHalfBytes) */
        public final String beforeHex;
        /** Patched half-bytes (uppercase hex, length == lengthHalfBytes) */
        public final String afterHex;
        /** The external symbol name that drove the modification (or null if not applicable) */
        public final String symbolName;

        public PatchInfo(String sectionName,
                         long tRecordStartAddr,
                         int textOffsetHalfBytes,
                         int lengthHalfBytes,
                         String beforeHex,
                         String afterHex,
                         String symbolName) {
            this.sectionName = sectionName;
            this.tRecordStartAddr = tRecordStartAddr;
            this.textOffsetHalfBytes = textOffsetHalfBytes;
            this.lengthHalfBytes = lengthHalfBytes;
            this.beforeHex = beforeHex != null ? beforeHex.toUpperCase(Locale.ROOT) : null;
            this.afterHex = afterHex != null ? afterHex.toUpperCase(Locale.ROOT) : null;
            this.symbolName = symbolName;
        }

        @Override
        public String toString() {
            return String.format(
                    "Patch[%s] T@0x%06X +%d nibbles len=%d : %s -> %s (sym=%s)",
                    sectionName, tRecordStartAddr, textOffsetHalfBytes, lengthHalfBytes,
                    beforeHex, afterHex, symbolName
            );
        }
    }

    /* ----------- Recording methods ----------- */

    public void recordSections(List<Section> sections) {
        for (Section s : sections) {
            controlSections.add(new ControlSectionInfo(s.getName(), s.getStart(), s.getLength()));
        }
    }

    public void recordSymbols(Collection<ExtDef> extDefs) {
        for (ExtDef d : extDefs) {
            externalSymbols.add(new ExternalSymbolInfo(d.getName(), d.getCsAddress(), d.getAddress()));
        }
    }

    // NEW: record a single patch chunk
    public void recordPatch(String sectionName,
                            long tRecordStartAddr,
                            int textOffsetHalfBytes,
                            int lengthHalfBytes,
                            String beforeHex,
                            String afterHex,
                            String symbolName) {
        patches.add(new PatchInfo(sectionName, tRecordStartAddr, textOffsetHalfBytes,
                lengthHalfBytes, beforeHex, afterHex, symbolName));
    }

    /* ----------- Getters ----------- */

    public List<ControlSectionInfo> getControlSections() {
        return controlSections;
    }

    public List<ExternalSymbolInfo> getExternalSymbols() {
        return externalSymbols;
    }

    // NEW
    public List<PatchInfo> getPatches() {
        return patches;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Control Sections:\n");
        for (ControlSectionInfo c : controlSections) sb.append(c).append("\n");
        sb.append("\nExternal Symbols:\n");
        for (ExternalSymbolInfo e : externalSymbols) sb.append(e).append("\n");

        if (!patches.isEmpty()) {
            sb.append("\nPatches:\n");
            for (PatchInfo p : patches) sb.append(p).append("\n");
        }
        return sb.toString();
    }
}
