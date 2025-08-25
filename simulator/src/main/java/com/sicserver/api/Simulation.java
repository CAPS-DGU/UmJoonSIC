package com.sicserver.api;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sicserver.data.CompileErrors;
import com.sicserver.data.Listing;
import com.sicserver.data.Relocations;
import sic.asm.AsmError;
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

import com.sicserver.alternatives.Linker;
import sic.link.Options;
import sic.link.LinkerError;

import static com.sicserver.data.DTO.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;

/**
 * API facade
 */
public class Simulation {
    private final Machine machine;
    private final Executor executor;
    private final Gson gson;

    // last assembled program (only for .asm loads; .obj won’t have Program)
    private Program lastProgram;

    public Simulation() {
        Args processedArgs = new Args(new String[0]);
        machine = new Machine();
        executor = new Executor(machine, processedArgs);
        gson = new GsonBuilder().disableHtmlEscaping().create();
    }

    /* -------------------- Helpers -------------------- */

    private static String baseNameNoExt(File f) {
        String n = f.getName();
        int dot = n.lastIndexOf('.');
        return (dot >= 0 ? n.substring(0, dot) : n);
    }

    private static void ensureDir(File dir) throws IOException {
        if (!dir.exists()) {
            if (!dir.mkdirs()) {
                throw new IOException("Could not create output directory: " + dir);
            }
        } else if (!dir.isDirectory()) {
            throw new IOException("Output path is not a directory: " + dir);
        }
    }

    private static void writeString(File f, String content) throws IOException {
        try (Writer w = new OutputStreamWriter(new FileOutputStream(f), StandardCharsets.UTF_8)) {
            w.write(content);
        }
    }

    private ListingDTO listingToDTO(Listing listing) {
        ListingDTO dto = new ListingDTO();
        dto.codeFileName = listing.codeFileName;
        dto.startAddress = listing.startAddress;
        dto.programLength = listing.programLength;
        dto.rows = listing.rows; // already formatted rows
        // flatten watch
        List<WatchVar> watch = new ArrayList<>();
        if (listing.variableWatch != null) {
            for (Map.Entry<Integer, StorageSymbol> e : listing.variableWatch.entrySet()) {
                StorageSymbol s = e.getValue();
                WatchVar wv = new WatchVar();
                wv.name = s.name; // Symbol.name (public in parent)
                wv.address = e.getKey(); // key is the address in your map
                wv.dataType = (s.getDataType() == null) ? null : s.getDataType().name();
                wv.elementSize = s.getElementSize();
                wv.elementCount = s.getElementCount();
                watch.add(wv);
            }
        }
        dto.watch = watch;
        return dto;
    }

    /* -------------------- JSON-style APIs -------------------- */
    /**
     * Load one or more .asm files.
     * Rules:
     *  - Single input: no linker; returns listing OR compileErrors.
     *  - Multiple inputs: assemble all .asm; if all succeeded, link the generated .obj files.
     *      - On linker failure: per-file results switch to linkerError.
     * Also writes .obj files to outputDirPath for each assembled .asm.
     * Raw .obj inputs are NOT allowed.
     *
     * @param filePaths       array of .asm paths to assemble
     * @param outputDirPath   base output directory ('.' if null)
     * @param outputName      linker output filename (e.g., "out.obj"); defaults to "out.obj" if null/blank
     * @param mainSymbol      optional entry symbol for the linker (applied only when non-blank)
     * @param keep            keep intermediates; default false if null
     * @param graphical       graphical flag; default false if null
     * @param editing         editing flag; default false if null
     * @param force           force flag; default false if null
     * @param verbose         verbose flag; default true if null
     */
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
        // keep actual Listing objects so we can relocate them after link
        Map<String, Listing> builtListings = new HashMap<>();

        LoadResult aggregate = new LoadResult();
        aggregate.files = new ArrayList<>();

        if (filePaths == null || filePaths.length == 0) {
            aggregate.ok = false;
            aggregate.message = "No input files.";
            aggregate.registers = snapshotRegisters();
            return gson.toJson(aggregate);
        }

        // Base output dir for .obj files from assembly
        File outDir = new File(outputDirPath == null ? "." : outputDirPath);
        try {
            ensureDir(outDir);
        } catch (IOException ioe) {
            aggregate.ok = false;
            aggregate.message = "Invalid output directory: " + ioe.getMessage();
            aggregate.registers = snapshotRegisters();
            return gson.toJson(aggregate);
        }

        // Resolve linker output directory: <outDir>/.out/linker/
        File linkerOutDir = new File(outDir, "linker");
        try {
            ensureDir(linkerOutDir);
        } catch (IOException ioe) {
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

        // we'll link ONLY the .obj files we generate from .asm inputs
        List<String> generatedObjPaths = new ArrayList<>();

        // Per-file assemble pass
        for (String path : filePaths) {
            FileLoadResult perFile = new FileLoadResult();
            perFile.fileName = path;
            aggregate.files.add(perFile);

            if (path == null || path.isBlank()) {
                perFile.compileErrors = new ArrayList<>();
                CompileError ce = new CompileError();
                ce.row = 0; ce.col = 0; ce.message = "Missing file path"; ce.nonbreaking = false;
                perFile.compileErrors.add(ce);
                continue;
            }

            File f = new File(path);
            if (!f.exists() || !f.canRead()) {
                perFile.compileErrors = new ArrayList<>();
                CompileError ce = new CompileError();
                ce.row = 0; ce.col = 0; ce.message = "File not found or cannot be read"; ce.nonbreaking = false;
                perFile.compileErrors.add(ce);
                continue;
            }

            String ext = Utils.getFileExtension(f.getName());
            try {
                if ("asm".equalsIgnoreCase(ext)) {
                    // Assemble
                    String source = Files.readString(f.toPath());
                    Assembler assembler = new Assembler();
                    ErrorCatcher catcher = assembler.errorCatcher;

                    Program program = assembler.assemble(source);

                    // Collect compile errors (if any)
                    if (catcher.count() > 0) {
                        CompileErrors ce = new CompileErrors(catcher.errs, source);
                        perFile.compileErrors = ce.errors;
                        this.lastProgram = null;
                        continue; // no listing / obj when there are errors
                    }

                    // Generate .obj text and save next to requested outputDir
                    String objText;
                    {
                        Writer w = new StringWriter();
                        assembler.generateObj(program, w, false);
                        objText = w.toString();
                    }
                    File objOut = new File(outDir, baseNameNoExt(f) + ".obj");
                    writeString(objOut, objText);
                    generatedObjPaths.add(objOut.getAbsolutePath());

                    // Build and remember Listing (assembler-relative for now)
                    Listing listing = new Listing(program, f.getName());
                    builtListings.put(perFile.fileName, listing);

                    // Prelim DTO (will be replaced with relocated one if we link)
                    perFile.listing = listingToDTO(listing);

                    // Optionally load to machine
                    Loader.loadSection(executor.machine, new StringReader(objText));
                    this.lastProgram = program;

                } else if ("obj".equalsIgnoreCase(ext)) {
                    // Raw .obj inputs are not allowed in this API
                    perFile.compileErrors = new ArrayList<>();
                    CompileError ce = new CompileError();
                    ce.row = 0; ce.col = 0; ce.message = ".obj files cannot be loaded directly; include only .asm files.";
                    ce.nonbreaking = false;
                    perFile.compileErrors.add(ce);

                } else {
                    // Unsupported extension -> compile error
                    perFile.compileErrors = new ArrayList<>();
                    CompileError ce = new CompileError();
                    ce.row = 0; ce.col = 0; ce.message = "Unsupported extension: " + ext; ce.nonbreaking = false;
                    perFile.compileErrors.add(ce);
                }
            } catch (Exception e) {
                // Map unexpected exceptions as compileErrors for that file
                perFile.compileErrors = new ArrayList<>();
                CompileError ce = new CompileError();
                ce.row = 0; ce.col = 0; ce.message = "Load failed: " + e.getMessage(); ce.nonbreaking = false;
                perFile.compileErrors.add(ce);
                this.lastProgram = null;
            }
        }

        // If multiple inputs and no compile errors, attempt linking the generated objs
        boolean anyCompileErrors = aggregate.files.stream()
                .anyMatch(fr -> fr.compileErrors != null && !fr.compileErrors.isEmpty());

        if (multi && !anyCompileErrors && !generatedObjPaths.isEmpty()) {
            try {
                Options options = new Options();
                options.setOutputName(resolvedOutputName);
                options.setOutputPath(resolvedOutputPath);

                // Defaults if nulls are passed
                options.setKeep(Boolean.TRUE.equals(keep));
                options.setGraphical(Boolean.TRUE.equals(graphical));
                options.setEditing(Boolean.TRUE.equals(editing));
                options.setForce(Boolean.TRUE.equals(force));
                options.setVerbose(verbose == null ? true : verbose);

                if (mainSymbol != null && !mainSymbol.isBlank()) {
                    options.setMain(mainSymbol);
                }

                Linker linker = new Linker(generatedObjPaths, options);

                // Perform link
                Section linkedSection = linker.link();
                sic.link.utils.Writer writer = new sic.link.utils.Writer(linkedSection, options);
                File file = writer.write();

                // Apply relocations to each Listing and refresh DTOs
                Relocations relocs = linker.relocations; // exposed by your Linker
                if (relocs != null) {
                    for (FileLoadResult fr : aggregate.files) {
                        if (fr.listing != null) {
                            Listing listingObj = builtListings.get(fr.fileName);
                            if (listingObj != null) {
                                System.out.println(fr.fileName + " BEFORE relocation");
                                for(var row : listingObj.rows)
                                    System.out.println(row.toString());
                                listingObj.relocate(relocs);
                                System.out.println(fr.fileName + " AFTER relocation");
                                for(var row : listingObj.rows)
                                    System.out.println(row.toString());
                                fr.listing = listingToDTO(listingObj); // replace with relocated DTO
                            }
                        }
                    }
                }

            } catch (LinkerError le) {
                // For every file that didn't already fail compile, replace listing with linkerError
                for (FileLoadResult fr : aggregate.files) {
                    if (fr.compileErrors == null || fr.compileErrors.isEmpty()) {
                        fr.listing = null;
                        LinkerErrorDto leDto = new LinkerErrorDto();
                        leDto.phase = "linker";
                        leDto.msg = le.getMessage();
                        fr.linkerError = leDto;
                    }
                }
                aggregate.ok = false;
                aggregate.message = "Linking failed.";
                aggregate.registers = snapshotRegisters();
                return gson.toJson(aggregate);
            }
        }

        // Determine overall ok
        boolean okAll = true;
        for (FileLoadResult fr : aggregate.files) {
            boolean okThis = (fr.listing != null) &&
                    (fr.compileErrors == null || fr.compileErrors.isEmpty()) &&
                    (fr.linkerError == null);
            if (!okThis) okAll = false;
        }
        aggregate.ok = okAll;
        if (aggregate.message == null) {
            aggregate.message = okAll ? "OK" : "Completed with errors.";
        }
        aggregate.registers = snapshotRegisters();
        return gson.toJson(aggregate);
    }

    /**
     * Syntax check of in-memory sources (unsaved files).
     * @param texts     array of program sources
     * @param fileNames array of display names (same length as texts)
     * @return JSON SyntaxCheckResult
     */
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
                    CompileErrors ce = new CompileErrors(catcher.errs, src);
                    per.ok = false;
                    per.compileErrors = ce.errors;
                    allOk = false;
                } else {
                    per.ok = true;
                    per.compileErrors = null;
                }
            } catch (Exception e) {
                // Treat unexpected exceptions as a compile error entry
                per.ok = false;
                per.compileErrors = new ArrayList<>();
                CompileError ce = new CompileError();
                ce.row = 0; ce.col = 0; ce.message = "Syntax check failed: " + e.getMessage(); ce.nonbreaking = false;
                per.compileErrors.add(ce);
                allOk = false;
            }

            out.files.add(per);
        }

        out.ok = allOk;
        out.message = allOk ? "OK" : "Errors found.";
        return gson.toJson(out);
    }

    /** Read memory:
     *  - Single address: {"address":A,"value":V}
     *  - Range [start,end] inclusive: {"start":S,"end":E,"values":[...]}
     *  Values are bytes 0..255.
     */
    public String memory(int start) {
        return memory(start, null);
    }

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

    /** Step one instruction; returns:
     *  {"ok":true/false,"message":"...","registers":{A,X,L,S,T,B,SW,PC,F}}
     */
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
        regs.put("F",  String.valueOf(machine.registers.getF())); // keep as String
        out.put("registers", regs);

        return gson.toJson(out);
    }

    private Registers snapshotRegisters() {
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
