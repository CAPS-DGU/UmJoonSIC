package com.sicserver.api;

import sic.asm.ujs.Listing;
import sic.asm.ujs.Relocations;
import sic.asm.Assembler;
import sic.asm.ErrorCatcher;
import sic.ast.Program;
import sic.ast.StorageSymbol;
import sic.common.Utils;
import sic.link.section.Section;
import sic.loader.Loader;
import sic.sim.Args;
import sic.sim.Executor;
import sic.sim.vm.Machine;

import sic.link.Linker;
import sic.link.Options;
import sic.link.LinkerError;

import static com.sicserver.data.DTO.*;

import java.io.*;
import java.nio.file.Files;
import java.util.*;

/**
 * SIC implementation that extends the sicxe-based base.
 * We override all engine-touching methods to use sic.*.
 * (Note: super() initializes sicxe.* fields which we ignore here.)
 */
public class SicSimulation extends SicxeSimulation {
    // Own SIC engine state (separate from base's sicxe state)
    private final Machine machineSic;
    private final Executor executorSic;
    private Program lastProgramSic;

    public SicSimulation() {
        super(); // builds sicxe engine; harmless, we won't use those fields
        Args processedArgs = new Args(new String[0]);
        this.machineSic = new Machine();
        this.executorSic = new Executor(machineSic, processedArgs);
    }

    /* --- small helpers specific to SIC types --- */
    private SicListingDTO listingToDTO(Listing listing) {
        SicListingDTO dto = new SicListingDTO();
        dto.codeFileName = listing.codeFileName;
        dto.startAddress = listing.startAddress;
        dto.programLength = listing.programLength;
        dto.rows = listing.rows;
        List<WatchVar> watch = new ArrayList<>();
        if (listing.variableWatch != null) {
            for (Map.Entry<Integer, StorageSymbol> e : listing.variableWatch.entrySet()) {
                StorageSymbol s = e.getValue();
                WatchVar wv = new WatchVar();
                wv.name = s.name;
                wv.address = e.getKey();
                wv.dataType = (s.getDataType() == null) ? null : s.getDataType().name();
                wv.elementSize = s.getElementSize();
                wv.elementCount = s.getElementCount();
                watch.add(wv);
            }
        }
        dto.watch = watch;
        return dto;
    }

    private Registers snapshotRegistersSic() {
        Registers r = new Registers();
        r.A  = machineSic.registers.getA();
        r.X  = machineSic.registers.getX();
        r.L  = machineSic.registers.getL();
        r.S  = machineSic.registers.getS();
        r.T  = machineSic.registers.getT();
        r.B  = machineSic.registers.getB();
        r.SW = machineSic.registers.getSW();
        r.PC = machineSic.registers.getPC();
        r.F  = String.valueOf(machineSic.registers.getF());
        return r;
    }

    /* -------------------- Overrides using sic.* -------------------- */

    @Override
    public String load(
            String[] filePaths,
            String outputDirPath,
            String outputName,
            String mainSymbol,
            Boolean keep,
            Boolean graphical,
            Boolean editing,
            Boolean force,
            Boolean verbose
    ) {
        Map<String, Listing> builtListings = new HashMap<>();

        LoadResult aggregate = new LoadResult();
        aggregate.files = new ArrayList<>();

        if (filePaths == null || filePaths.length == 0) {
            aggregate.ok = false;
            aggregate.message = "No input files.";
            aggregate.registers = snapshotRegistersSic();
            return gson.toJson(aggregate);
        }

        File outDir = new File(outputDirPath == null ? "." : outputDirPath);
        try { ensureDir(outDir); }
        catch (IOException ioe) {
            aggregate.ok = false;
            aggregate.message = "Invalid output directory: " + ioe.getMessage();
            aggregate.registers = snapshotRegistersSic();
            return gson.toJson(aggregate);
        }

        // we keep this directory structure, even though we no longer link
        File linkerOutDir = new File(outDir, "linker");
        try { ensureDir(linkerOutDir); }
        catch (IOException ioe) {
            aggregate.ok = false;
            aggregate.message = "Invalid linker output directory: " + ioe.getMessage();
            aggregate.registers = snapshotRegistersSic();
            return gson.toJson(aggregate);
        }

        final String resolvedOutputName =
                (outputName == null || outputName.isBlank()) ? "out.obj" : outputName;

        final boolean multi = filePaths.length > 1;

        // keep the object text for direct loading (no linker)
        final List<String> builtObjTexts = new ArrayList<>();

        for (String path : filePaths) {
            FileLoadResult perFile = new FileLoadResult();
            perFile.fileName = path;
            aggregate.files.add(perFile);

            if (path == null || path.isBlank()) {
                perFile.assemblerErrors = new ArrayList<>();
                AssemblerError ae = new AssemblerError();
                ae.row = 0; ae.col = 0; ae.length=0; ae.message = "Missing file path"; ae.nonbreaking = false;
                perFile.assemblerErrors.add(ae);
                continue;
            }

            File f = new File(path);
            if (!f.exists() || !f.canRead()) {
                perFile.assemblerErrors = new ArrayList<>();
                AssemblerError ae = new AssemblerError();
                ae.row = 0; ae.col = 0; ae.length=0; ae.message = "File not found or cannot be read"; ae.nonbreaking = false;
                perFile.assemblerErrors.add(ae);
                continue;
            }

            String ext = Utils.getFileExtension(f.getName());
            try {
                if ("asm".equalsIgnoreCase(ext)) {
                    String source = Files.readString(f.toPath());
                    Assembler assembler = new Assembler();
                    ErrorCatcher catcher = assembler.errorCatcher;
                    Program program = assembler.assemble(source);

                    if (catcher.count() > 0) {
                        perFile.assemblerErrors = catcher.errs.stream().map(err -> {
                            AssemblerError ae = new AssemblerError();
                            ae.row = err.loc.row;
                            ae.col = err.loc.col;
                            ae.length = err.length;
                            ae.message = err.getMessage();
                            return ae;
                        }).toList();
                        this.lastProgramSic = null;
                        continue;
                    }

                    // write .obj (same as before) and keep in-memory text for loading
                    String objText;
                    try (Writer w = new StringWriter()) {
                        assembler.generateObj(program, w, false);
                        objText = w.toString();
                    }

                    File objOut = new File(outDir, baseNameNoExt(f) + ".obj");
                    writeString(objOut, objText);
                    builtObjTexts.add(objText);

                    Listing listing = new Listing(program, f.getName());
                    builtListings.put(perFile.fileName, listing);
                    perFile.listing = listingToDTO(listing);

                    if (!multi) {
                        // Single-file: always set PC from this section
                        Loader.loadSection(executorSic.machine, new StringReader(objText), null);
                        this.lastProgramSic = program;
                    }

                } else if ("obj".equalsIgnoreCase(ext)) {
                    perFile.assemblerErrors = new ArrayList<>();
                    AssemblerError ae = new AssemblerError();
                    ae.row = 0; ae.col = 0; ae.length = 0; ae.message = ".obj files cannot be loaded directly; include only .asm files.";
                    ae.nonbreaking = false;
                    perFile.assemblerErrors.add(ae);
                } else {
                    perFile.assemblerErrors = new ArrayList<>();
                    AssemblerError ae = new AssemblerError();
                    ae.row = 0; ae.col = 0; ae.length = 0; ae.message = "Unsupported extension: " + ext; ae.nonbreaking = false;
                    perFile.assemblerErrors.add(ae);
                }
            } catch (Exception e) {
                perFile.assemblerErrors = new ArrayList<>();
                AssemblerError ae = new AssemblerError();
                ae.row = 0; ae.col = 0; ae.length = 0; ae.message = "Load failed: " + e.getMessage(); ae.nonbreaking = false;
                perFile.assemblerErrors.add(ae);
                this.lastProgramSic = null;
            }
        }

        boolean anyCompileErrors = aggregate.files.stream()
                .anyMatch(fr -> fr.assemblerErrors != null && !fr.assemblerErrors.isEmpty());

        // === NO LINKER ===
        if (multi && !anyCompileErrors && !builtObjTexts.isEmpty()) {
            // Load all sections; only set PC for the one whose name matches mainSymbol (if provided)
            for (String objText : builtObjTexts) {
                // When mainSymbol is null, Loader.loadSection will not set PC (because we pass non-null)
                // but the requirement is: in multi-file mode pass 'mainSymbol' (possibly null).
                // If mainSymbol is null here, loader will set PC for EVERY file if we pass null,
                // but the spec says: use mainSymbol parameter. So pass it through.
                Loader.loadSection(executorSic.machine, new StringReader(objText), mainSymbol);
            }
        }

        boolean okAll = true;
        for (FileLoadResult fr : aggregate.files) {
            boolean okThis = (fr.listing != null) &&
                    (fr.assemblerErrors == null || fr.assemblerErrors.isEmpty()) &&
                    (fr.linkerError == null);
            if (!okThis) okAll = false;
        }
        aggregate.ok = okAll;
        if (aggregate.message == null) aggregate.message = okAll ? "OK" : "Completed with errors.";
        aggregate.registers = snapshotRegistersSic();
        return gson.toJson(aggregate);
    }

    @Override
    public String syntaxCheck(String[] texts, String[] fileNames) {
        SyntaxCheckResult out = new SyntaxCheckResult();
        out.files = new ArrayList<>();

        if (texts == null || fileNames == null || texts.length != fileNames.length) {
            out.ok = false;
            out.message = "texts and fileNames must be non-null and the same length.";
            return gson.toJson(out);
        }

        boolean allOk = true;
        for (int i = 0; i < texts.length; i++) {
            String src = texts[i] == null ? "" : texts[i];
            String name = fileNames[i] == null ? ("<file-" + i + ">") : fileNames[i];

            SyntaxCheckFileResult per = new SyntaxCheckFileResult();
            per.fileName = name;

            try {
                Assembler assembler = new Assembler();
                ErrorCatcher catcher = assembler.errorCatcher;
                assembler.assemble(src);

                if (catcher.count() > 0) {
                    per.ok = false;
                    per.assemblerErrors = catcher.errs.stream().map(err -> {
                        AssemblerError ae = new AssemblerError();
                        if (err.loc != null) {
                            ae.row = err.loc.row;
                            ae.col = err.loc.col;
                        } else {
                            ae.row = 0;
                            ae.col = 0;
                        }
                        ae.length = err.length;
                        ae.message = (err.getMessage() != null) ? err.getMessage() : "Unknown Error";
                        return ae;
                    }).toList();
                    allOk = false;
                } else {
                    per.ok = true;
                    per.assemblerErrors = null;
                }
            } catch (Exception e) {
                per.ok = false;
                per.assemblerErrors = new ArrayList<>();
                AssemblerError ce = new AssemblerError();
                ce.row = 0; ce.col = 0; ce.message = "Syntax check failed: " + e.getMessage(); ce.nonbreaking = false;
                per.assemblerErrors.add(ce);
                allOk = false;
            }

            out.files.add(per);
        }

        out.ok = allOk;
        out.message = allOk ? "OK" : "Errors found.";
        return gson.toJson(out);
    }

    @Override
    public String memory(int start) { return memory(start, null); }

    // Dump 0x1000..0x1038 (inclusive) in 16-byte rows, hex
    private void debugDumpWindow1000() {
        final int start = 0x1000;
        final int end   = 0x1038; // inclusive
        int addr = start;

        while (addr <= end) {
            int lineStart = addr;
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("[SIC][memory] DUMP 0x%06X:", lineStart));

            for (int i = 0; i < 16 && addr <= end; i++, addr++) {
                int v = machineSic.memory.getByteRaw(addr) & 0xFF;
                sb.append(' ').append(String.format("%02X", v));
            }
            System.out.println(sb.toString());
        }
    }
    @Override
    public String memory(int start, Integer endInclusive) {
        // --- Debug: log the request ---
        System.out.printf("[SIC][memory] request start=%d (0x%06X), endInclusive=%s%n",
                start, start, (endInclusive == null ? "null" : String.format("%d (0x%06X)", endInclusive, endInclusive)));

        try {
            if (endInclusive == null) {
                int val = machineSic.memory.getByteRaw(start) & 0xFF;

                Map<String, Object> r = new LinkedHashMap<>();
                r.put("address", start);
                r.put("value", val);

                String json = gson.toJson(r);

                // --- Debug: log the response (single byte) ---
                System.out.printf("[SIC][memory] response SINGLE address=%d (0x%06X), value=%d (0x%02X)%n",
                        start, start, val, val);

                // --- Always dump window 0x1000..0x1038 ---
                debugDumpWindow1000();

                return json;
            } else {
                int s = Math.min(start, endInclusive);
                int e = Math.max(start, endInclusive);
                int len = e - s + 1;

                int[] vals = new int[len];
                for (int i = 0; i < len; i++) {
                    vals[i] = machineSic.memory.getByteRaw(s + i) & 0xFF;
                }

                Map<String, Object> r = new LinkedHashMap<>();
                r.put("start", s);
                r.put("end", e);
                r.put("values", vals);

                String json = gson.toJson(r);

                // --- Debug: log the response (range) with a short hex preview ---
                int preview = Math.min(len, 16);
                StringBuilder hexPreview = new StringBuilder();
                for (int i = 0; i < preview; i++) {
                    if (i > 0) hexPreview.append(' ');
                    hexPreview.append(String.format("%02X", vals[i]));
                }
                if (len > preview) hexPreview.append(" ...");

                System.out.printf("[SIC][memory] response RANGE %d..%d (0x%06X..0x%06X), len=%d, first %d bytes (hex)=%s%n",
                        s, e, s, e, len, preview, hexPreview.toString());

                // --- Always dump window 0x1000..0x1038 ---
                debugDumpWindow1000();

                return json;
            }
        } catch (Exception ex) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("ok", false);
            err.put("message", "Memory read failed: " + ex.getMessage());

            String json = gson.toJson(err);

            // --- Debug: log the error and still dump the window for context ---
            System.out.printf("[SIC][memory] ERROR: %s%n", ex.getMessage());
            debugDumpWindow1000();

            return json;
        }
    }


    @Override
    public String step() {
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            executorSic.step();
            out.put("ok", true);
            out.put("message", "stepped");
        } catch (Exception ex) {
            out.put("ok", false);
            out.put("message", "step failed: " + ex.getMessage());
        }

        Map<String, Object> regs = new LinkedHashMap<>();
        regs.put("A",  machineSic.registers.getA());
        regs.put("X",  machineSic.registers.getX());
        regs.put("L",  machineSic.registers.getL());
        regs.put("S",  machineSic.registers.getS());
        regs.put("T",  machineSic.registers.getT());
        regs.put("B",  machineSic.registers.getB());
        regs.put("SW", machineSic.registers.getSW());
        regs.put("PC", machineSic.registers.getPC());
        regs.put("F",  String.valueOf(machineSic.registers.getF()));
        out.put("registers", regs);

        return gson.toJson(out);
    }
}
