package com.sicserver.data;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import sic.asm.AsmError;

import java.util.ArrayList;
import java.util.List;

import static com.sicserver.data.DTO.*;

public class CompileErrors {
    public ArrayList<CompileError> errors;

    public CompileErrors(List<AsmError> asmErrors, String program) {
        this.errors = new ArrayList<>();
        for (AsmError asmError : asmErrors) {
            CompileError compileError = new CompileError();
            String msg = asmError.getMessage();
            compileError.message = msg;
            compileError.row = asmError.loc.row;
            compileError.nonbreaking = !asmError.isBreaking();

            //TODO: delete this
            compileError.col = asmError.loc.col;

            if (msg.equals("START must precede all instructions")) {

            } else if (msg.equals("Multiple STARTs are not allowed")) {

            } else if (msg.equals("Program name too long")) {

            } else if (msg.equals("Missing mnemonic")) {

            } else if (msg.equals("Symbol expected")) {

            } else if (msg.equals("Number expected")) {

            } else if (msg.equals("Invalid number")) {

            } else if (msg.equals("Unterminated byte string")) {

            } else if (msg.equals("Hexadecimal byte expected")) {

            } else if (msg.equals("Indexed addressing not supported here")) {

            } else if (msg.equals("Missing label at CSECT")) {

            } else if (msg.equals("Missing label at EQU")) {

            } else if (msg.equals("Missing label at START")) {

            } else if (msg.equals("Expected quote")) {

                // --- formatted messages: must use startsWith / contains ---
            } else if (msg.startsWith("Empty label")) {

            } else if (msg.startsWith("Invalid mnemonic")) {

            } else if (msg.startsWith("Invalid register")) {

            } else if (msg.startsWith("invalid digit")) {

            } else if (msg.startsWith("Number '")) { // out of range

            } else if (msg.startsWith("Unknown escape sequence")) {

            } else if (msg.startsWith("Invalid length of hex encoding")) {

            } else if (msg.startsWith("Expected '")) {

            } else if (msg.startsWith("unexpected token")) {

            } else if (msg.startsWith("Undefined symbol")) {

            } else if (msg.startsWith("Duplicate symbol")) {

            } else if (msg.startsWith("Cannot export undefined symbol")) {

            } else if (msg.startsWith("Cannot address symbol")) {

            } else if (msg.startsWith("External symbol")) {

            } else if (msg.startsWith("Expression expected")) {

            } else {
                throw new IllegalArgumentException(
                        "Error corrector has encountered unknown type of AsmError: " + msg
                );
            }

            errors.add(compileError);
        }
    }

    public String toJson() {
        Gson gson = new GsonBuilder().disableHtmlEscaping().create();
        return gson.toJson(this.errors);
    }
}
