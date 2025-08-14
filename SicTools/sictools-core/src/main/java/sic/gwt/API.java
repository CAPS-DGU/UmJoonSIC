package sic.gwt;

import jsinterop.annotations.JsMethod;
import jsinterop.annotations.JsType;
import sic.asm.Assembler;
import sic.ast.Program;

/**
 * This class exposes your core SicTools functionality to JavaScript.
 */
@JsType(namespace = "sictools", name = "API")
public class API {

    @JsMethod
    public static String ping() {
        return "pong";
    }

    /**
     * Example of exposing your assembler.
     * I am assuming your Assembler has a constructor and a 'assemble' method.
     * You will need to adjust this to match your actual code.
     *
     * @param sourceCode The SIC assembly source code as a string.
     * @return A string representation of the assembled program or an error.
     */
    @JsMethod
    public static String assembleSource(String sourceCode) {
        try {
            // NOTE: I need information about the Assembler constructor and methods to be sure.
            // This is a likely pattern based on your file names.
            Assembler assembler = new Assembler();
            Program program = assembler.assemble(sourceCode);
            // Assuming the Program object has a useful toString() or another method to get output
            return program.toString();
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }
}