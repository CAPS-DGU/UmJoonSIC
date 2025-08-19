package com.sicserver;

import static spark.Spark.*;

import com.google.gson.Gson;
import com.sicserver.api.Simulation;

public class Main {
    private static final Gson gson = new Gson();
    // Single Simulation instance (initialized via /begin)
    private static volatile Simulation SIM = null;

    /* Simple result type for errors/acks */
    static final class Msg {
        boolean ok;
        String message;
        Msg(boolean ok, String message) { this.ok = ok; this.message = message; }
    }

    public static void main(String[] args) {
        ipAddress("127.0.0.1");
        port(8080);
        System.out.println("Server running on http://127.0.0.1:8080");

        // ---------- API ----------
        // 1) Initialize a Simulation instance
        post("/begin", (req, res) -> {
            SIM = new Simulation();
            res.type("application/json; charset=UTF-8");
            return gson.toJson(new Msg(true, "Simulation initialized"));
        });

        // 2) Load .asm/.obj, return JSON (registers, watch, listViewArray) or ok/fail
        //    POST /load?filepath=/abs/path/file.asm
        post("/load", (req, res) -> {
            res.type("application/json; charset=UTF-8");
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            String filePath = req.queryParams("filepath");
            if (filePath == null || filePath.isBlank()) return gson.toJson(new Msg(false, "Missing query parameter: filepath"));
            return SIM.load(filePath); // already JSON
        });

        // 3) Toggle breakpoint at address
        //    POST /breakpoint?addr=0x1030  (hex)  or ?addr=4144 (dec)
        post("/breakpoint", (req, res) -> {
            res.type("application/json; charset=UTF-8");
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            Integer addr = parseIntFlexible(req.queryParams("addr"));
            if (addr == null) return gson.toJson(new Msg(false, "Missing/invalid addr (use decimal or 0xHEX)"));
            return SIM.breakpoint(addr); // already JSON
        });

        // 4) Read memory
        //    GET /memory?addr=0x1000                -> single byte
        //    GET /memory?start=0x1000&end=0x10FF    -> inclusive range
        get("/memory", (req, res) -> {
            res.type("application/json; charset=UTF-8");
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            String addrStr  = req.queryParams("addr");
            String startStr = req.queryParams("start");
            String endStr   = req.queryParams("end");

            if (addrStr != null) {
                Integer addr = parseIntFlexible(addrStr);
                if (addr == null) return gson.toJson(new Msg(false, "Invalid addr (use decimal or 0xHEX)"));
                return SIM.memory(addr); // already JSON
            } else if (startStr != null && endStr != null) {
                Integer start = parseIntFlexible(startStr);
                Integer end   = parseIntFlexible(endStr);
                if (start == null || end == null) return gson.toJson(new Msg(false, "Invalid start/end (use decimal or 0xHEX)"));
                return SIM.memory(start, end); // already JSON
            } else {
                return gson.toJson(new Msg(false, "Provide addr OR start&end"));
            }
        });

        // 5) Step one instruction
        //    POST /step
        post("/step", (req, res) -> {
            res.type("application/json; charset=UTF-8");
            if (SIM == null) return gson.toJson(new Msg(false, "Simulation not started. Call /begin first."));
            return SIM.step(); // already JSON
        });
    }

    private static Integer parseIntFlexible(String s) {
        if (s == null) return null;
        s = s.trim();
        try {
            if (s.startsWith("0x") || s.startsWith("0X")) return Integer.parseInt(s.substring(2), 16);
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
