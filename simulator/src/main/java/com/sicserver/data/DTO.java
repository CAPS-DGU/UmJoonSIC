package com.sicserver.data;
import java.util.List;

/**
 * Ideal DTOs for API responses.
 *
 * Load (multi-file):
 *   - Per file: ListingDTO OR compileErrors OR linkerError (exactly one populated).
 *   - No legacy fields.
 *
 * Syntax Check (multi-file):
 *   - Per file: compile errors OR ok=true.
 */
public final class DTO {

    private DTO() {} // no instances

    /* =========================
     * Registers
     * ========================= */
    public static final class Registers {
        public int A;
        public int X;
        public int L;
        public int S;
        public int T;
        public int B;
        public int SW;
        public int PC;
        public String F; // keep as String, same as /step
    }

    /* =========================
     * Errors
     * ========================= */
    public static final class AssemblerError {
        public int row;
        public int col;
        public int length;
        public String message;
        public boolean nonbreaking;
    }

    /** Linker error with phase + message only. */
    public static final class LinkerErrorDto {
        public String phase; // e.g., "linker", "options", "first-pass", "second-pass"
        public String msg;   // human-readable message
    }

    /* =========================
     * Listing (assembled file)
     * ========================= */
    /** Flattened watch variable entry (derived from StorageSymbol). */
    public static final class WatchVar {
        public String name;
        public int address;          // relocated absolute address
        public String dataType;      // BYTE/WORD/FLOAT if available
        public Integer elementSize;  // 1/3/6 if available
        public Integer elementCount; // number of elements if available
    }

    public interface EngineListingDTO {}  // marker

    public static final class SicListingDTO implements EngineListingDTO {
        public String codeFileName;
        public int startAddress;
        public int programLength;
        public List<sic.asm.ujs.Listing.Row> rows;
        public List<WatchVar> watch;
    }

    public static final class SicxeListingDTO implements EngineListingDTO {
        public String codeFileName;
        public int startAddress;
        public int programLength;
        public List<sicxe.asm.ujs.Listing.Row> rows;
        public List<WatchVar> watch;
    }

    public static final class FileLoadResult {
        public String fileName;
        public EngineListingDTO listing;          // can be either
        public List<AssemblerError> assemblerErrors;
        public LinkerErrorDto linkerError;
    }


    /** Aggregated result for a multi-file load. */
    public static final class LoadResult {
        public boolean ok;                 // true iff all files produced a listing and linking (if any) succeeded
        public String message;             // optional human-readable summary
        public List<FileLoadResult> files; // per-file outcomes
        public Registers registers;
    }

    /* =========================
     * SYNTAX CHECK results (multi-file, no linking)
     * ========================= */
    /** Per-file outcome for syntax check. */
    public static final class SyntaxCheckFileResult {
        public String fileName;
        public boolean ok;                        // true if no compile errors
        public List<AssemblerError> assemblerErrors;  // present if not ok
    }

    /** Aggregated result for syntax check. */
    public static final class SyntaxCheckResult {
        public boolean ok;                            // true iff all files are ok
        public String message;                        // optional summary
        public List<SyntaxCheckFileResult> files;     // per-file results
    }
}
