package com.sicserver;

import static spark.Spark.*;
import com.google.gson.Gson;

// Import a class from the SicTools submodule
import sic.VM;

public class Main {
    public static void main(String[] args) {
        // Create a new instance of the SIC Virtual Machine from SicTools
        VM sicVM = new VM();

        Gson gson = new Gson();

        // --- Add these two lines ---
        ipAddress("127.0.0.1"); // Bind to localhost
        port(8080);             // Set the port for your server

        System.out.println("Server running on http://localhost:8080");

        // Define a simple API endpoint
        get("/status", (req, res) -> {
            res.type("application/json");

            // Use a method from the SicTools VM object
            String statusMessage = "SIC VM is running. Machine name: " + sicVM.toString();

            // Return a simple JSON object
            return new StatusResponse(statusMessage);
        }, gson::toJson);
    }

    // A simple helper class to structure our JSON response
    private static class StatusResponse {
        private String status;

        public StatusResponse(String status) {
            this.status = status;
        }
    }
}
