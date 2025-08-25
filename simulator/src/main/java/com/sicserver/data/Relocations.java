package com.sicserver.data;

import sic.link.section.Section;
import sic.link.section.ExtDef;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Relocations represents the relocation/logging information produced by the linker.
 * It records all control sections and external symbols after linking.
 */
public class Relocations {

    private final List<ControlSectionInfo> controlSections;
    private final List<ExternalSymbolInfo> externalSymbols;

    public Relocations() {
        this.controlSections = new ArrayList<>();
        this.externalSymbols = new ArrayList<>();
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

    /* ----------- Getters ----------- */

    public List<ControlSectionInfo> getControlSections() {
        return controlSections;
    }

    public List<ExternalSymbolInfo> getExternalSymbols() {
        return externalSymbols;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Control Sections:\n");
        for (ControlSectionInfo c : controlSections) {
            sb.append(c).append("\n");
        }
        sb.append("\nExternal Symbols:\n");
        for (ExternalSymbolInfo e : externalSymbols) {
            sb.append(e).append("\n");
        }
        return sb.toString();
    }
}
