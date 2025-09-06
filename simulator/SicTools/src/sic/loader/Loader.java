package sic.loader;

import sic.asm.Assembler;
import sic.asm.ErrorCatcher;
import sic.ast.Program;
import sic.common.Logger;
import sic.common.Utils;
import sic.sim.vm.Machine;
import sic.sim.vm.Memory;

import java.io.*;

/**
 * @author: jure
 */
public class Loader {

    public static void skipWhitespace(Reader r) throws IOException {
//TODO:        while (Character.isWhitespace((char)r.read()));
    }

    public static String readString(Reader r, int len) throws IOException {
        skipWhitespace(r);
        StringBuilder buf = new StringBuilder();
        while (len-- > 0) buf.append((char) r.read());
        return buf.toString();
    }

    public static int readByte(Reader r) throws IOException {
        skipWhitespace(r);
        return Integer.parseInt(readString(r, 2), 16);
    }

    public static int readWord(Reader r) throws IOException {
        skipWhitespace(r);
        return Integer.parseInt(readString(r, 6), 16);
    }

    public static void loadRawCode(Machine machine, int address, byte[] code) {
        System.arraycopy(code, 0, machine.memory.memory, address, code.length);
        machine.registers.setPC(address);
    }

    /** Back-compat: same behavior as before (always sets PC from E-record). */
    public static boolean loadSection(Machine machine, Reader r) {
        return loadSection(machine, r, null);
    }

    /**
     * Load a single object "control section".
     * If {@code mainProgName} is null: always set PC from the E record (legacy behavior).
     * If non-null: set PC only when program name (from H record) matches (case-insensitive, trimmed).
     */
    public static boolean loadSection(Machine machine, Reader r, String mainProgName) {
        try {
            // Header record
            if (r.read() != 'H') return false;
            String rawName = readString(r, 6);
            String progName = rawName == null ? "" : rawName.trim();
            int start = readWord(r);
            int length = readWord(r);
            if (r.read() == '\r') r.read(); // consume EOL

            Memory mem = machine.memory;

            // Text records
            int ch = r.read();
            while (ch == 'T') {
                int loc = readWord(r);
                int len = readByte(r);
                while (len-- > 0) {
                    if (loc < start || loc >= start + length) return false;
                    byte val = (byte) readByte(r);
                    mem.setByteRaw(loc++, val);
                }
                if (r.read() == '\r') r.read(); // EOL
                ch = r.read();
            }

            // Modification records (ignored for pure SIC, but skip them cleanly)
            while (ch == 'M') {
                readWord(r); // addr
                readByte(r); // len (half-bytes)
                if (r.read() == '\r') r.read(); // EOL
                ch = r.read();
            }

            // End record
            if (ch != 'E') return false;
            int entry = readWord(r);

            // PC policy
            if (mainProgName == null) {
                // Legacy: always set entry point.
                machine.registers.setPC(entry);
            } else {
                // Set PC only if names match
                if (progName.equalsIgnoreCase(mainProgName.trim())) {
                    machine.registers.setPC(entry);
                }
                // else: leave PC unchanged
            }
        } catch (IOException e) {
            return false;
        }
        return true;
    }

    public static boolean loadObj(Machine machine, String filename) {
        try {
            Reader reader = new FileReader(filename);
            Loader.loadSection(machine, reader); // legacy behavior
        } catch (FileNotFoundException e1) {
            Logger.fmterr("Error reading file '%s'.", filename);
            return false;
        }
        return true;
    }

    public static void loadAsm(Machine machine, String filename) {
        Assembler assembler = new Assembler();
        ErrorCatcher errorCatcher = assembler.errorCatcher;
        Program program = assembler.assemble(Utils.readFile(filename));
        if (errorCatcher.count() > 0) {
            errorCatcher.print();
            return;
        }
        Writer writer = new StringWriter();
        assembler.generateObj(program, writer, false);
        Reader reader = new StringReader(writer.toString());
        Loader.loadSection(machine, reader); // legacy behavior
    }
}
