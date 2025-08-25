package com.sicserver.alternatives;

import com.sicserver.data.Listing;
import sic.asm.AsmError;
import sic.asm.Assembler;
import sic.asm.ErrorCatcher;
import sic.ast.Program;
import sic.common.Utils;

import java.io.File;
import java.io.StringWriter;
import java.io.Writer;

public class SicAsm {
    Assembler assembler = new Assembler();
    Program program;

    public SicAsm() {

    }

    public Program assemble(String filePath, ErrorCatcher errorCatcher) {
        File file = new File(filePath);

        // Check if the file exists and is readable before proceeding.
        if (!file.exists() || !file.canRead()) {
            if (errorCatcher != null) {
                errorCatcher.add(new AsmError(null, "File not found or cannot be read: " + filePath));
            }
            // Invalidate the last successful program
            this.program = null;
            return null;
        }

        // The assembler will populate its own internal error catcher.
        this.program = assembler.assemble(Utils.readFile(file));

        // After assembling, check the assembler's error catcher for any issues.
        if (assembler.errorCatcher.count() > 0) {
            if (errorCatcher != null) {
                errorCatcher.errs.addAll(assembler.errorCatcher.errs);
            }
            // Invalidate the program on error
            this.program = null;
            return null;
        }

        return this.program;
    }

    public String logFile() {
        if (program == null) return null;
        Writer writer = new StringWriter();
        assembler.generateLog(program, writer);
        return writer.toString();
    }

    /**
     * Generates a listing file string from the last successfully assembled program.
     * @return The listing file content, or null if no program has been assembled.
     */
    public String lisFile() {
        if (program == null) return null;
        // A Writer object is needed to capture the output.
        Writer writer = new StringWriter();
        assembler.generateListing(program, writer);
        return writer.toString();
    }

    /**
     * Generates an object file string from the last successfully assembled program.
     * @return The object file content, or null if no program has been assembled.
     */
    public String objFile() {
        if (program == null) return null;
        // A Writer object is needed to capture the output.
        Writer writer = new StringWriter();
        // The 'false' parameter typically controls formatting options.
        assembler.generateObj(program, writer, false);
        return writer.toString();
    }

}