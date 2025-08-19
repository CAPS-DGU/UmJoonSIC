package com.sicserver.api;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import sic.asm.AsmError;
import sic.asm.Assembler;
import sic.asm.ErrorCatcher;
import sic.ast.Program;
import sic.ast.StorageSymbol;
import sic.common.Mnemonics;
import sic.common.Utils;
import sic.disasm.Disassembler;
import sic.loader.Loader;
import sic.sim.Args;
import sic.sim.Executor;
import sic.sim.vm.Machine;

import java.io.*;
import java.util.ArrayList;
import java.util.List;

public class Simulation {
    private final Machine machine;
    private final Executor executor;
    private final Disassembler disassembler;
    private final Gson gson;

    // last assembled program (only for .asm loads; .obj won’t have Program)
    private Program lastProgram;

    public Simulation() {
        Args processedArgs = new Args(new String[0]);
        machine = new Machine();
        executor = new Executor(machine, processedArgs);
        disassembler = new Disassembler(new Mnemonics(), machine);
        gson = new GsonBuilder().disableHtmlEscaping().create();
    }

    /* -------------------- DTOs -------------------- */

    private static final class Registers {
        public int A, X, L, S, T, B, SW, PC;
        public String F; // keep as String to be safe across implementations
    }

    private static final class WatchVar {
        public String name;
        public int address;           // symbol value (address)
        public String dataType;       // BYTE/WORD/FLOAT (if available)
        public Integer elementSize;   // 1/3/6 (if available)
        public Integer elementCount;  // count (if available)
    }

    private static final class LoadOk {
        public Registers registers;
        public List<WatchVar> watch;
        public List<Listing.Row> listViewArray;
        public String message;
    }

    private static final class BoolResult {
        public boolean ok;
        public String message;
    }

    private static final class MemSingle {
        public int address;
        public int value; // 0..255
    }

    private static final class MemRange {
        public int start;
        public int end;
        public int[] values; // each 0..255
    }

    private static final class StepResult {
        public boolean ok;
        public String message;
        public Registers registers;
    }

    /* -------------------- Helpers -------------------- */

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

    private List<WatchVar> extractWatchVars(Program p) {
        List<WatchVar> out = new ArrayList<>();
        if (p == null) return out;

        var map = p.getDataLabels(); // HashMap<Integer, StorageSymbol>
        if (map == null) return out;

        for (StorageSymbol s : map.values()) {
            WatchVar w = new WatchVar();

            w.name = s.name;
            w.address = s.value();
            w.dataType = (s.getDataType() == null) ? null : s.getDataType().name();
            w.elementSize = s.getElementSize();
            w.elementCount = s.getElementCount();

            out.add(w);
        }

        return out;
    }

    private String success(Object obj) {
        return gson.toJson(obj);
    }

    private String failure(String message) {
        BoolResult r = new BoolResult();
        r.ok = false;
        r.message = message;
        return gson.toJson(r);
    }

    /* -------------------- JSON-style APIs -------------------- */

    /**
     * Load an .asm or .obj file.
     * - If .asm: assemble, print errors (stderr); on success print logs (stdout),
     *   load to machine, then return JSON with registers, watch variables, and listViewArray.
     * - If .obj: load object to machine and return plain success/failure JSON.
     */
    public String load(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return failure("Missing filePath");
        }

        File file = new File(filePath);
        if (!file.exists() || !file.canRead()) {
            return failure("File not found or cannot be read: " + filePath);
        }

        String ext = Utils.getFileExtension(file.getName());
        try {
            if ("asm".equalsIgnoreCase(ext)) {
                Assembler assembler = new Assembler();
                ErrorCatcher catcher = assembler.errorCatcher;

                Program program = assembler.assemble(Utils.readFile(file));
                // print any assembler errors
                if (catcher.count() > 0) {
                    catcher.print(); // prints to stderr
                    if (catcher.shouldEnd()) {
                        this.lastProgram = null;
                        return failure("Assembly failed");
                    }
                }

                // print log to stdout
                {
                    Writer w = new StringWriter();
                    assembler.generateLog(program, w);
                    System.out.print(w.toString());
                }

                // generate object text and load into machine
                String objText;
                {
                    Writer w = new StringWriter();
                    assembler.generateObj(program, w, false);
                    objText = w.toString();
                }
                Loader.loadSection(executor.machine, new StringReader(objText));

                this.lastProgram = program;

                // Build Listing rows (not printed, but included as JSON array)
                Listing listing = new Listing(program);

                LoadOk ok = new LoadOk();
                ok.registers = snapshotRegisters();
                ok.watch = extractWatchVars(program);
                ok.listViewArray = listing.rows;
                ok.message = "OK (.asm loaded)";

                return success(ok);
            } else if ("obj".equalsIgnoreCase(ext)) {
                // load object directly
                try (Reader reader = new FileReader(file)) {
                    Loader.loadSection(executor.machine, reader);
                }
                this.lastProgram = null; // no program to attach
                BoolResult ok = new BoolResult();
                ok.ok = true;
                ok.message = "OK (.obj loaded)";
                return success(ok);
            } else {
                return failure("Unsupported extension: " + ext);
            }
        } catch (FileNotFoundException e) {
            return failure("File not found: " + e.getMessage());
        } catch (Exception e) {
            e.printStackTrace();
            return failure("Load failed: " + e.getMessage());
        }
    }

    /** Toggle breakpoint at address; return {"ok":true/false,"message":...} plus implicit state in message. */
    public String breakpoint(int addr) {
        try {
            executor.breakpoints.toggleBreakpoint(addr);
            boolean set = executor.breakpoints.has(addr);
            BoolResult r = new BoolResult();
            r.ok = set;
            r.message = set ? "Breakpoint set" : "Breakpoint cleared";
            return success(r);
        } catch (Exception e) {
            return failure("Breakpoint toggle failed: " + e.getMessage());
        }
    }

    /**
     * Read memory:
     * - Single address: returns {"address":A,"value":V}
     * - Range [start,end] inclusive: returns {"start":S,"end":E,"values":[...]}
     * Values are bytes 0..255.
     */
    public String memory(int start) {
        return memory(start, null);
    }
    public String memory(int start, Integer endInclusive) {
        try {
            if (endInclusive == null) {
                MemSingle m = new MemSingle();
                m.address = start;
                m.value = machine.memory.getByteRaw(start) & 0xFF;
                return success(m);
            } else {
                int s = Math.min(start, endInclusive);
                int e = Math.max(start, endInclusive);
                int len = e - s + 1;
                int[] vals = new int[len];
                for (int i = 0; i < len; i++) {
                    vals[i] = machine.memory.getByteRaw(s + i) & 0xFF;
                }
                MemRange mr = new MemRange();
                mr.start = s;
                mr.end = e;
                mr.values = vals;
                return success(mr);
            }
        } catch (Exception e) {
            return failure("Memory read failed: " + e.getMessage());
        }
    }

    /** Step one instruction; returns {"ok":true/false,"message":...,"registers":{...}} */
    public String step() {
        try {
            // If the executor isn't already running, a single step is fine
            executor.step();
            StepResult r = new StepResult();
            r.ok = true;
            r.message = "stepped";
            r.registers = snapshotRegisters();
            return success(r);
        } catch (Exception e) {
            StepResult r = new StepResult();
            r.ok = false;
            r.message = "step failed: " + e.getMessage();
            r.registers = snapshotRegisters();
            return success(r);
        }
    }
}
