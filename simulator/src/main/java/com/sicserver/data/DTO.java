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
     * Errors
     * ========================= */
    public static final class CompileError {
        public int row;
        public int col;
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

    /** Transport form of a Listing (per source file). */
    public static final class ListingDTO {
        public String codeFileName;                            // from Listing.codeFileName
        public int startAddress;                               // relocated start address
        public int programLength;                              // length in bytes
        public List<com.sicserver.data.Listing.Row> rows;      // formatted rows from Listing
        public List<WatchVar> watch;                           // flattened watch view
    }

    /* =========================
     * LOAD results (multi-file)
     * ========================= */
    /** Per-file outcome for load/link. Exactly one of {listing, compileErrors, linkerError} is non-null. */
    public static final class FileLoadResult {
        public String fileName;                      // input file path or display name
        public ListingDTO listing;                   // present if assembly succeeded for this file
        public List<CompileError> compileErrors;     // present if assembly failed for this file
        public LinkerErrorDto linkerError;           // present if linking surfaced an error for this file
    }

    /** Aggregated result for a multi-file load. */
    public static final class LoadResult {
        public boolean ok;                 // true iff all files produced a listing and linking (if any) succeeded
        public String message;             // optional human-readable summary
        public List<FileLoadResult> files; // per-file outcomes
    }

    /* =========================
     * SYNTAX CHECK results (multi-file, no linking)
     * ========================= */
    /** Per-file outcome for syntax check. */
    public static final class SyntaxCheckFileResult {
        public String fileName;
        public boolean ok;                        // true if no compile errors
        public List<CompileError> compileErrors;  // present if not ok
    }

    /** Aggregated result for syntax check. */
    public static final class SyntaxCheckResult {
        public boolean ok;                            // true iff all files are ok
        public String message;                        // optional summary
        public List<SyntaxCheckFileResult> files;     // per-file results
    }
}
