package com.sicserver.api;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.*;
import java.nio.charset.StandardCharsets;

/**
 * Common utilities and state for both SicSimulation and SicxeSimulation.
 * Concrete subclasses implement the assembler/linker specifics.
 */
abstract class AbstractSimulation implements Simulation {
    protected final Gson gson;

    protected AbstractSimulation() {
        this.gson = new GsonBuilder().disableHtmlEscaping().create();
    }

    /* -------------------- Helpers (shared) -------------------- */

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
}
