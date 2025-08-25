package com.sicserver;

import static spark.Spark.*;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sicserver.api.Simulation;

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
 * **Request:** _empty object_ `{}`
 *
 * **Response:** `{ ok:true, message:"Simulation initialized" }`
 *
 * ---
 * ### 2) POST /load
 * **Purpose:** Assemble (and if multi-file, link) one or more `.asm` files; writes `.obj` files.
 *
 * **Request JSON:**
 * ```json
 * {
 *   "filePaths": ["/abs/foo.asm", "/abs/bar.asm"],
 *   "outputDir": "/abs/out",      // optional; default "."
 *   "outputName": "out.obj",       // optional; default "out.obj"
 *   "main": "ENTRY",               // optional; omit or null if not needed
 *   "keep": false,                  // optional; default false
 *   "graphical": false,             // optional; default false
 *   "editing": false,               // optional; default false
 *   "force": false,                 // optional; default false
 *   "verbose": true                 // optional; default true
 * }
 * ```json
 * {
 *   "filePaths": ["/abs/foo.asm", "/abs/bar.asm"],
 *   "outputDir": "/abs/out"   // optional; default "."
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
 *                     "rows":[{...}], "watch":[{"name":"X","address":4096,...}] },
 *       "compileErrors": null,
 *       "linkerError": null
 *     }
 *   ]
 * }
 * ```
 *
 * **Notes:**
 * - Exactly one of `listing`, `compileErrors`, `linkerError` is populated per file.
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
 *
 * ---
 * ### Example curl
 * ```bash
 * curl -s -X POST http://127.0.0.1:8080/begin -H 'Content-Type: application/json' -d '{}'
 * curl -s -X POST http://127.0.0.1:8080/load -H 'Content-Type: application/json' \
 *   -d '{"filePaths":["/abs/main.asm"],"outputDir":"/abs/out"}'
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
    static final class LoadReq { String[] filePaths; String outputDir; String outputName; String main; Boolean keep; Boolean graphical; Boolean editing; Boolean force; Boolean verbose; }
    static final class SyntaxReq { String[] texts; String[] fileNames; }
    static final class MemoryReq { Object addr; Object start; Object end; }

    public static void main(String[] args) {
        int portNum = 9090; // default
        if (args != null && args.length > 0) {
            try {
                portNum = Integer.parseInt(args[0]);
            } catch (NumberFormatException e) {
                System.err.println("Invalid port argument \"" + args[0] + "\", using default " + portNum);
            }
        }

        ipAddress("127.0.0.1");
        port(portNum);
        System.out.println("Server running on http://127.0.0.1:" + portNum);

        // Global response type
        after((req, res) -> res.type("application/json; charset=UTF-8"));

        // Health
        post("/begin", (req, res) -> {
            SIM = new Simulation();
            return gson.toJson(new Msg(true, "Simulation initialized"));
        });

        // Assemble / Link
        post("/load", (req, res) -> {
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            LoadReq body = safeFromJson(req.body(), LoadReq.class);
            if (body == null) return gson.toJson(new Msg(false, "Expected JSON body with filePaths (array)."));
            if (body.filePaths == null || body.filePaths.length == 0) return gson.toJson(new Msg(false, "filePaths must be a non-empty array."));
            // main is optional; pass through as-is (Simulation.load handles null/blank)
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
            ); // already JSON
        });

        // Syntax check (no link)
        post("/syntax-check", (req, res) -> {
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            SyntaxReq body = safeFromJson(req.body(), SyntaxReq.class);
            if (body == null) return gson.toJson(new Msg(false, "Expected JSON body with texts and fileNames arrays."));
            if (body.texts == null || body.fileNames == null || body.texts.length != body.fileNames.length)
                return gson.toJson(new Msg(false, "texts and fileNames must be non-null and the same length."));
            return SIM.syntaxCheck(body.texts, body.fileNames); // already JSON
        });

        // Memory read
        post("/memory", (req, res) -> {
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            MemoryReq body = safeFromJson(req.body(), MemoryReq.class);
            if (body == null) return gson.toJson(new Msg(false, "Expected JSON body with addr OR start+end."));

            Integer addr = parseIntFlexible(body.addr);
            Integer start = parseIntFlexible(body.start);
            Integer end   = parseIntFlexible(body.end);

            if (addr != null && start == null && end == null) {
                return SIM.memory(addr); // already JSON
            }
            if (addr == null && start != null && end != null) {
                return SIM.memory(start, end); // already JSON
            }
            return gson.toJson(new Msg(false, "Provide either {addr} OR {start,end}. Values may be decimal or hex strings like '0x1000'."));
        });

        // One step
        post("/step", (req, res) -> {
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            return SIM.step(); // already JSON
        });

        // 404 fallback (POST-only surface)
        post("*", (req, res) -> gson.toJson(new Msg(false, "Unknown endpoint.")));
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
}
