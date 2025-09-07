package com.sicserver;

import static spark.Spark.*;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sicserver.api.SicSimulation;
import com.sicserver.api.SicxeSimulation;
import com.sicserver.api.Simulation;

import java.util.ArrayList;
import java.util.List;

/**
 * # SIC Server — POST-only HTTP API
 *
 * All endpoints are **POST** and exchange **application/json**.
 * Responses are already JSON strings returned by {@link Simulation}; this class
 * only validates input and translates errors into a common shape: {"ok":false,"message":"..."}.
 *
 * ### Conventions
 * - Request bodies are JSON objects (see each endpoint for schema).
 * - All endpoints return `Content-Type: application/json; charset=UTF-8`.
 * - Numbers that represent addresses may be decimal or hex strings like `"0x1000"`.
 * - On malformed input, you get `{ ok:false, message:"..." }`.
 *
 * ### Server startup
 * - By default the server listens on **127.0.0.1:9090**.
 * - You can override the port by passing it as the first argument:
 *   ```bash
 *   java -jar simulator.jar 8080   # runs on port 8080
 *   java -jar simulator.jar        # runs on default port 9090
 *   ```
 *
 * ---
 * ## Endpoints
 *
 * ### 1) POST /begin
 * **Purpose:** Create a fresh {@link Simulation} instance (resets state).
 *
 * **Request JSON:**
 * ```json
 * { "type": "sic" }                        // or "sicxe"
 * { "type": "sic", "filedevices":[
 *     {"index":0, "filename":"/tmp/in.bin"},
 *     {"index":1, "filename":"/tmp/out.bin"}
 * ]}                                       // optional: map file devices before start
 * ```
 * When `filedevices` is present, the server uses the overloaded simulation
 * constructors with `int[] indices` and `String[] filenames`. If an invalid
 * mapping is supplied, the constructor may throw `IllegalArgumentException`
 * which is returned as `{ ok:false, message:"..." }`.
 *
 * **Response:** `{ ok:true, message:"Simulation initialized (sic)" }`
 *
 * ---
 * ### 2) POST /load
 * **Purpose:** Assemble (and if multi-file, link) one or more `.asm` files; writes `.obj` files.
 *
 * **Request JSON (extended options):**
 * ```json
 * {
 *   "filePaths": ["/abs/foo.asm", "/abs/bar.asm"],
 *   "outputDir": "/abs/out",      // optional; default "."
 *   "outputName": "out.obj",      // optional; default "out.obj"
 *   "main": "ENTRY",              // optional; omit or null if not needed
 *   "keep": false,                // optional; default false
 *   "graphical": false,           // optional; default false
 *   "editing": false,             // optional; default false
 *   "force": false,               // optional; default false
 *   "verbose": true               // optional; default true
 * }
 * ```
 *
 * **Response JSON (from Simulation.load):**
 * ```json
 * {
 *   "ok": true,
 *   "message": "OK",
 *   "files": [
 *     {
 *       "fileName": "...",
 *       "listing": { "codeFileName":"...", "startAddress":4096, "programLength":123,
 *                    "rows":[{...}], "watch":[{"name":"X","address":4096,...}] },
 *       "compileErrors": null,
 *       "linkerError": null
 *     }
 *   ],
 *   "registers": { "A":0, "X":0, "L":0, "S":0, "T":0, "B":0, "SW":0, "PC":4096, "F":"0.0" }
 * }
 * ```
 *
 * **Notes:**
 * - Exactly one of `listing`, `compileErrors`, `linkerError` is populated per file.
 * - `registers` is a snapshot of the machine state **after** loading (and linking, when applicable).
 * - Raw `.obj` inputs are **rejected** by the API (see error in response).
 *
 * ---
 * ### 3) POST /syntax-check
 * **Purpose:** Check syntax of in-memory sources (no linking).
 *
 * **Request JSON:**
 * ```json
 * {
 *   "texts": ["LDX #1\n...", "STA BUF\n..."],
 *   "fileNames": ["main.asm", "util.asm"]
 * }
 * ```
 *
 * **Response JSON (from Simulation.syntaxCheck):**
 * ```json
 * {
 *   "ok": false,
 *   "message": "Errors found.",
 *   "files": [
 *     {"fileName":"main.asm","ok":true},
 *     {"fileName":"util.asm","ok":false,"compileErrors":[{"row":3,"col":5,"message":"...","nonbreaking":false}]}
 *   ]
 * }
 * ```
 *
 * ---
 * ### 4) POST /memory
 * **Purpose:** Read memory from the simulator.
 *
 * **Request JSON:** one of
 * ```json
 * { "addr": "0x1000" }
 * { "addr": 4096 }
 * { "start": "0x1000", "end": "0x10FF" }
 * { "start": 4096, "end": 4351 }
 * ```
 *
 * **Response JSON (from Simulation.memory):**
 * ```json
 * { "address": 4096, "value": 170 }
 * { "start": 4096, "end": 4351, "values": [170, ...] }
 * ```
 *
 * ---
 * ### 5) POST /step
 * **Purpose:** Execute exactly one instruction.
 *
 * **Request:** _empty object_ `{}`
 *
 * **Response JSON (from Simulation.step):**
 * ```json
 * {
 *   "ok": true,
 *   "message": "stepped",
 *   "registers": { "A":0, "X":0, "L":0, "S":0, "T":0, "B":0, "SW":0, "PC":4099, "F":"0.0" }
 * }
 * ```
 */
public class Main {
    private static final Gson gson = new GsonBuilder().disableHtmlEscaping().create();
    // Single Simulation instance (initialized via /begin)
    private static volatile Simulation SIM = null;

    /* Simple result type for errors/acks */
    static final class Msg {
        boolean ok; String message;
        Msg(boolean ok, String message) { this.ok = ok; this.message = message; }
    }

    // ---------- Request DTOs ----------
    static final class BeginReq {
        String type;
        List<FileDev> filedevices; // optional; list of {index, filename}
    }
    static final class FileDev {
        Integer index;
        String filename;
    }
    static final class LoadReq {
        String[] filePaths; String outputDir; String outputName; String main;
        Boolean keep; Boolean graphical; Boolean editing; Boolean force; Boolean verbose;
    }
    static final class SyntaxReq { String[] texts; String[] fileNames; }
    static final class MemoryReq { Object addr; Object start; Object end; }

    public static void main(String[] args) {
        SIM = new SicSimulation(); // default engine before first /begin
        int portNum = 9090;
        if (args != null && args.length > 0) {
            try {
                portNum = Integer.parseInt(args[0]);
            } catch (NumberFormatException e) {
                System.err.println("Invalid port argument \"" + args[0] + "\", using default " + portNum);
            }
        }

        ipAddress("127.0.0.1");
        port(portNum);

        // CORS + default handlers (centralized, overwrite headers to avoid duplicates)
        installJsonDefaultsAndHandlers();
        enableCorsSingleton("*", "POST,OPTIONS", "Content-Type, Authorization, X-Requested-With");

        System.out.println("Server running on http://127.0.0.1:" + portNum);

        // ---------- Routes ----------
        // Health / init simulation
        post("/begin", (req, res) -> {
            BeginReq body = safeFromJson(req.body(), BeginReq.class);
            if (body == null || body.type == null) {
                return gson.toJson(new Msg(false, "Expected JSON body: { \"type\": \"sic\" | \"sicxe\", \"filedevices\":[{index,filename}]? }"));
            }
            String t = body.type.trim().toLowerCase();

            // Optional: build arrays for overloaded constructors
            int[] indices = null;
            String[] filenames = null;
            if (body.filedevices != null && !body.filedevices.isEmpty()) {
                List<Integer> idxTmp = new ArrayList<>();
                List<String> fileTmp = new ArrayList<>();
                int pos = 0;
                for (FileDev fd : body.filedevices) {
                    if (fd == null || fd.index == null || fd.filename == null || fd.filename.isBlank()) {
                        return gson.toJson(new Msg(false, "Invalid filedevices entry at position " + pos + " (require {index, filename})."));
                    }
                    idxTmp.add(fd.index);
                    fileTmp.add(fd.filename);
                    pos++;
                }
                indices = idxTmp.stream().mapToInt(Integer::intValue).toArray();
                filenames = fileTmp.toArray(new String[0]);
            }

            try {
                switch (t) {
                    case "sic" -> {
                        SIM = (indices == null)
                                ? new SicSimulation()
                                : new SicSimulation(indices, filenames);
                    }
                    case "sicxe" -> {
                        SIM = (indices == null)
                                ? new SicxeSimulation()
                                : new SicxeSimulation(indices, filenames);
                    }
                    default -> {
                        return gson.toJson(new Msg(false, "Unknown type: \"" + body.type + "\" (use \"sic\" or \"sicxe\")"));
                    }
                }
            } catch (IllegalArgumentException iae) {
                return gson.toJson(new Msg(false, iae.getMessage()));
            }
            return gson.toJson(new Msg(true, "Simulation initialized (" + t + ")"));
        });

        // Assemble / Link
        post("/load", (req, res) -> {
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            LoadReq body = safeFromJson(req.body(), LoadReq.class);
            if (body == null) return gson.toJson(new Msg(false, "Expected JSON body with filePaths (array)."));
            if (body.filePaths == null || body.filePaths.length == 0)
                return gson.toJson(new Msg(false, "filePaths must be a non-empty array."));
            // main and other options are optional; Simulation.load handles defaults
            return SIM.load(
                    body.filePaths,
                    body.outputDir,
                    body.outputName,
                    body.main,
                    body.keep,
                    body.graphical,
                    body.editing,
                    body.force,
                    body.verbose
            );
        });

        // Syntax check (no link)
        post("/syntax-check", (req, res) -> {
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            SyntaxReq body = safeFromJson(req.body(), SyntaxReq.class);
            if (body == null) return gson.toJson(new Msg(false, "Expected JSON body with texts and fileNames arrays."));
            if (body.texts == null || body.fileNames == null || body.texts.length != body.fileNames.length)
                return gson.toJson(new Msg(false, "texts and fileNames must be non-null and the same length."));
            return SIM.syntaxCheck(body.texts, body.fileNames);
        });

        // Memory read
        post("/memory", (req, res) -> {
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            MemoryReq body = safeFromJson(req.body(), MemoryReq.class);
            if (body == null)
                return gson.toJson(new Msg(false, "Expected JSON body with addr OR start+end."));

            Integer addr = parseIntFlexible(body.addr);
            Integer start = parseIntFlexible(body.start);
            Integer end   = parseIntFlexible(body.end);

            if (addr != null && start == null && end == null) {
                return SIM.memory(addr);
            }
            if (addr == null && start != null && end != null) {
                return SIM.memory(start, end);
            }
            return gson.toJson(new Msg(false,
                    "Provide either {addr} OR {start,end}. Values may be decimal or hex strings like '0x1000'."));
        });

        // One step
        post("/step", (req, res) -> {
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            return SIM.step();
        });
    }

    private static <T> T safeFromJson(String json, Class<T> clazz) {
        try { return gson.fromJson(json, clazz); } catch (Exception e) { return null; }
    }

    /**
     * Accepts Integer, Long, Double, String (decimal or 0xHEX). Returns null if missing/invalid.
     */
    private static Integer parseIntFlexible(Object v) {
        if (v == null) return null;
        try {
            if (v instanceof Number) return ((Number) v).intValue();
            String s = v.toString().trim();
            if (s.isEmpty()) return null;
            if (s.startsWith("0x") || s.startsWith("0X")) return Integer.parseInt(s.substring(2), 16);
            return Integer.parseInt(s);
        } catch (Exception e) {
            return null;
        }
    }

    /** CORS for browsers + preflight (uses setHeader to AVOID duplicates) */
    private static void enableCorsSingleton(String allowOrigin, String allowMethods, String allowHeaders) {
        // Preflight for any path
        options("/*", (req, res) -> {
            String reqHeaders = req.headers("Access-Control-Request-Headers");
            String reqMethod  = req.headers("Access-Control-Request-Method");

            // Overwrite each header once
            res.raw().setHeader("Access-Control-Allow-Origin", allowOrigin);
            res.raw().setHeader("Vary", "Origin");

            if (reqHeaders != null) res.raw().setHeader("Access-Control-Allow-Headers", reqHeaders);
            else res.raw().setHeader("Access-Control-Allow-Headers", allowHeaders);

            if (reqMethod != null) res.raw().setHeader("Access-Control-Allow-Methods", reqMethod);
            else res.raw().setHeader("Access-Control-Allow-Methods", allowMethods);

            res.raw().setHeader("Access-Control-Max-Age", "86400"); // 1 day
            res.status(204); // No Content
            return "";
        });

        // Apply headers to all non-OPTIONS responses (overwrite, don’t append)
        after((req, res) -> {
            if (!"OPTIONS".equalsIgnoreCase(req.requestMethod())) {
                res.raw().setHeader("Access-Control-Allow-Origin", allowOrigin);
                res.raw().setHeader("Access-Control-Allow-Methods", allowMethods);
                res.raw().setHeader("Access-Control-Allow-Headers", allowHeaders);
                res.raw().setHeader("Vary", "Origin");
            }
        });
    }

    /** JSON content-type defaults, unified errors, and sane fallbacks */
    private static void installJsonDefaultsAndHandlers() {
        // Set JSON content-type on every non-OPTIONS response
        after((req, res) -> {
            if (!"OPTIONS".equalsIgnoreCase(req.requestMethod())) {
                res.type("application/json; charset=UTF-8");
                res.raw().setHeader("Cache-Control", "no-store");
            }
        });

        // Return JSON for 404s (e.g., wrong method/path)
        notFound((req, res) -> {
            res.type("application/json; charset=UTF-8");
            return new Gson().toJson(new Msg(false, "Not found: " + req.requestMethod() + " " + req.pathInfo()));
        });

        // Return JSON for 500s (uncaught)
        exception(Exception.class, (e, req, res) -> {
            res.type("application/json; charset=UTF-8");
            res.status(500);
            e.printStackTrace(); // log server-side
            res.body(new Gson().toJson(new Msg(false, "Internal error: " + e.getMessage())));
        });
    }
}
