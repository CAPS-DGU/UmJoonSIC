package com.sicserver.api;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import sicxe.asm.ujs.Listing;
import sicxe.asm.ujs.Relocations;
import sicxe.asm.Assembler;
import sicxe.asm.ErrorCatcher;
import sicxe.ast.Program;
import sicxe.ast.StorageSymbol;
import sicxe.common.Utils;
import sicxe.link.section.Section;
import sicxe.loader.Loader;
import sicxe.sim.Args;
import sicxe.sim.Executor;
import sicxe.sim.vm.Machine;

import sicxe.link.Linker;
import sicxe.link.Options;
import sicxe.link.LinkerError;

import static com.sicserver.data.DTO.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;

/**
 * Base implementation backed by sicxe.* engine.
 * SicSimulation can extend this and override methods to use sic.* instead.
 */
public class SicxeSimulation implements Simulation {
    protected final Gson gson;

    // sicxe engine state
    protected final Machine machine;
    protected final Executor executor;
    protected Program lastProgram;

    public SicxeSimulation() {
        this.gson = new GsonBuilder().disableHtmlEscaping().create();
        Args processedArgs = new Args(new String[0]);
        this.machine = new Machine();
        this.executor = new Executor(machine, processedArgs);
    }

    /* ---------- shared file helpers (reused by subclass) ---------- */
    protected static String baseNameNoExt(File f) {
        String n = f.getName();
        int dot = n.lastIndexOf('.');
        return (dot >= 0 ? n.substring(0, dot) : n);
    }

    protected static void ensureDir(File dir) throws IOException {
        if (!dir.exists()) {
            if (!dir.mkdirs()) throw new IOException("Could not create output directory: " + dir);
        } else if (!dir.isDirectory()) {
            throw new IOException("Output path is not a directory: " + dir);
        }
    }

    protected static void writeString(File f, String content) throws IOException {
        try (Writer w = new OutputStreamWriter(new FileOutputStream(f), StandardCharsets.UTF_8)) {
            w.write(content);
        }
    }

    private EngineListingDTO listingToDTO(Listing listing) {
        SicxeListingDTO dto = new SicxeListingDTO();
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

    /* -------------------- API methods (sicxe) -------------------- */

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
            aggregate.registers = snapshotRegisters();
            return gson.toJson(aggregate);
        }

        File outDir = new File(outputDirPath == null ? "." : outputDirPath);
        try { ensureDir(outDir); }
        catch (IOException ioe) {
            aggregate.ok = false;
            aggregate.message = "Invalid output directory: " + ioe.getMessage();
            aggregate.registers = snapshotRegisters();
            return gson.toJson(aggregate);
        }

        File linkerOutDir = new File(outDir, "linker");
        try { ensureDir(linkerOutDir); }
        catch (IOException ioe) {
            aggregate.ok = false;
            aggregate.message = "Invalid linker output directory: " + ioe.getMessage();
            aggregate.registers = snapshotRegisters();
            return gson.toJson(aggregate);
        }

        final String resolvedOutputName =
                (outputName == null || outputName.isBlank()) ? "out.obj" : outputName;
        final String resolvedOutputPath =
                new File(linkerOutDir, resolvedOutputName).getAbsolutePath();

        boolean multi = filePaths.length > 1;
        List<String> generatedObjPaths = new ArrayList<>();

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
                        this.lastProgram = null;
                        continue;
                    }

                    String objText;
                    try (Writer w = new StringWriter()) {
                        assembler.generateObj(program, w, false);
                        objText = w.toString();
                    }
                    File objOut = new File(outDir, baseNameNoExt(f) + ".obj");
                    writeString(objOut, objText);
                    generatedObjPaths.add(objOut.getAbsolutePath());

                    Listing listing = new Listing(program, f.getName());
                    builtListings.put(perFile.fileName, listing);
                    perFile.listing = listingToDTO(listing);

                    if (!multi) {
                        Loader.loadSection(executor.machine, new StringReader(objText));
                        this.lastProgram = program;
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
                this.lastProgram = null;
            }
        }

        boolean anyCompileErrors = aggregate.files.stream()
                .anyMatch(fr -> fr.assemblerErrors != null && !fr.assemblerErrors.isEmpty());

        if (multi && !anyCompileErrors && !generatedObjPaths.isEmpty()) {
            try {
                Options options = new Options();
                options.setOutputName(resolvedOutputName);
                options.setOutputPath(resolvedOutputPath);
                options.setKeep(Boolean.TRUE.equals(keep));
                options.setGraphical(Boolean.TRUE.equals(graphical));
                options.setEditing(Boolean.TRUE.equals(editing));
                options.setForce(Boolean.TRUE.equals(force));
                options.setVerbose(verbose == null ? true : verbose);
                if (mainSymbol != null && !mainSymbol.isBlank()) options.setMain(mainSymbol);

                Linker linker = new Linker(generatedObjPaths, options);
                Section linkedSection = linker.link();
                sicxe.link.utils.Writer writer = new sicxe.link.utils.Writer(linkedSection, options);
                File file = writer.write();

                Relocations relocs = linker.relocations;
                if (relocs != null) {
                    for (FileLoadResult fr : aggregate.files) {
                        if (fr.listing != null) {
                            Listing listingObj = builtListings.get(fr.fileName);
                            if (listingObj != null) {
                                listingObj.relocate(relocs);
                                fr.listing = listingToDTO(listingObj);
                            }
                        }
                    }
                }

                String linkedObjText = Files.readString(file.toPath());
                Loader.loadSection(executor.machine, new StringReader(linkedObjText));

            } catch (LinkerError le) {
                for (FileLoadResult fr : aggregate.files) {
                    if (fr.assemblerErrors == null || fr.assemblerErrors.isEmpty()) {
                        fr.listing = null;
                        LinkerErrorDto leDto = new LinkerErrorDto();
                        leDto.phase = "linker";
                        leDto.msg = le.getMessage();
                        fr.linkerError = leDto;
                    }
                }
                aggregate.ok = false;
                aggregate.message = "Linking failed : " + le.getMessage();
                aggregate.registers = snapshotRegisters();
                return gson.toJson(aggregate);
            } catch (IOException ioe) {
                for (FileLoadResult fr : aggregate.files) {
                    if (fr.assemblerErrors == null || fr.assemblerErrors.isEmpty()) {
                        fr.listing = null;
                        LinkerErrorDto leDto = new LinkerErrorDto();
                        leDto.phase = "iodevices";
                        leDto.msg = ioe.getMessage();
                        fr.linkerError = leDto;
                    }
                }
                aggregate.ok = false;
                aggregate.message = "I/O error during linking: " + ioe.getMessage();
                aggregate.registers = snapshotRegisters();
                return gson.toJson(aggregate);
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
        aggregate.registers = snapshotRegisters();
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

    @Override
    public String memory(int start, Integer endInclusive) {
        try {
            if (endInclusive == null) {
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("address", start);
                r.put("value", machine.memory.getByteRaw(start) & 0xFF);
                return gson.toJson(r);
            } else {
                int s = Math.min(start, endInclusive);
                int e = Math.max(start, endInclusive);
                int len = e - s + 1;
                int[] vals = new int[len];
                for (int i = 0; i < len; i++) {
                    vals[i] = machine.memory.getByteRaw(s + i) & 0xFF;
                }
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("start", s);
                r.put("end", e);
                r.put("values", vals);
                return gson.toJson(r);
            }
        } catch (Exception ex) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("ok", false);
            err.put("message", "Memory read failed: " + ex.getMessage());
            return gson.toJson(err);
        }
    }

    @Override
    public String step() {
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            executor.step();
            out.put("ok", true);
            out.put("message", "stepped");
        } catch (Exception ex) {
            out.put("ok", false);
            out.put("message", "step failed: " + ex.getMessage());
        }

        Map<String, Object> regs = new LinkedHashMap<>();
        regs.put("A",  machine.registers.getA());
        regs.put("X",  machine.registers.getX());
        regs.put("L",  machine.registers.getL());
        regs.put("S",  machine.registers.getS());
        regs.put("T",  machine.registers.getT());
        regs.put("B",  machine.registers.getB());
        regs.put("SW", machine.registers.getSW());
        regs.put("PC", machine.registers.getPC());
        regs.put("F",  String.valueOf(machine.registers.getF()));
        out.put("registers", regs);

        return gson.toJson(out);
    }

    protected Registers snapshotRegisters() {
        Registers r = new Registers();
        r.A  = machine.registers.getA();
        r.X  = machine.registers.getX();
        r.L  = machine.registers.getL();
        r.S  = machine.registers.getS();
        r.T  = machine.registers.getT();
        r.B  = machine.registers.getB();
        r.SW = machine.registers.getSW();
        r.PC = machine.registers.getPC();
        r.F  = String.valueOf(machine.registers.getF());
        return r;
    }
}
