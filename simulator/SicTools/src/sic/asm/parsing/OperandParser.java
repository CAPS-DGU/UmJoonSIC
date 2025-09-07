package sic.asm.parsing;

import sic.asm.AsmError;
import sic.asm.Location;
import sic.ast.Command;
import sic.ast.data.*;
import sic.ast.directives.*;
import sic.ast.expression.Expr;
import sic.ast.expression.ExprInt;
import sic.ast.expression.ExprSym;
import sic.ast.instructions.*;
import sic.ast.storage.StorageData;
import sic.ast.storage.StorageRes;
import sic.common.Flags;
import sic.common.Mnemonic;
import sic.common.Opcode;
import sic.common.SICXE;

import java.util.ArrayList;
import java.util.List;

/**
 * Operand parsing for pure SIC.
 * Supported:
 *   - F3 (no operand) and F3m (mem, optional ,X)
 *   - Directives: START (hex digits), END (empty or one symbol), RESB/RESW, BYTE, WORD
 * Not supported (removed):
 *   - F1, F2*, F4m
 *   - BASE/NOBASE/ORG/LTORG/EQU/USE/CSECT/EXTDEF/EXTREF
 *   - '#' '@' immediate/indirect, '*' location counter
 */
public class OperandParser {

    private final Parser parser;

    public OperandParser(Parser parser) {
        this.parser = parser;
    }

    // helpers

    private void checkWhitespace(String name) throws AsmError {
        parser.checkWhitespace("Missing whitespace after mnemonic '%s'", name);
    }

    // Helper tuple to return names + locations together (kept in case other callers rely)
    private static final class Symbols {
        final List<String> names;
        final List<Location> locs;
        Symbols(List<String> names, List<Location> locs) {
            this.names = names;
            this.locs = locs;
        }
    }

    // ===== PURE-SIC helpers =====

    private static boolean isHexDigit(char c) {
        return (c >= '0' && c <= '9') ||
                (c >= 'A' && c <= 'F') ||
                (c >= 'a' && c <= 'f');
    }

    /** START operand: plain HEX digits (no 0x prefix). */
    private Expr parseStartHexExprRequired() throws AsmError {
        parser.skipWhitespace();
        Location start = parser.loc();
        StringBuilder sb = new StringBuilder();

        while (isHexDigit(parser.peek())) {
            char ch = parser.peek();
            // consume this character
            parser.advanceIf(ch);
            sb.append(ch);
        }

        if (sb.length() == 0) {
            throw new AsmError(start, 1, "HEX address expected for START");
        }

        int value;
        try {
            value = Integer.parseInt(sb.toString(), 16);
        } catch (NumberFormatException e) {
            throw new AsmError(start, sb.length(), "Invalid HEX address '%s' for START", sb);
        }

        Location end = parser.loc();
        start.length = Math.max(1, end.col - start.col);
        return new ExprInt(start, value);
    }

    /** END operand: empty or a single symbol (entry point). */
    private Expr parseEndOperand() throws AsmError {
        parser.skipWhitespace();
        // allow empty
        if (!Character.isLetter(parser.peek()) && parser.peek() != '_') {
            return null;
        }
        Location loc = parser.loc();
        String sym = parser.readSymbol();
        loc.length = Math.max(1, parser.loc().col - loc.col);
        return new ExprSym(loc, sym);
    }

    private Expr parseExpression(boolean throwIfNull) throws AsmError {
        Expr expr = parser.expressionParser.parseExpression();
        if (throwIfNull && expr == null)
            throw new AsmError(parser.loc(), 1, "Expression expected '%c'", parser.peek());
        return expr;
    }

    public Data parseData(int opcode, boolean allowList) throws AsmError {
        Data data;

        if (opcode == Opcode.BYTE) {
            // BYTE: only C'..' or X'..'
            char c = parser.peek();
            if (c == 'C') {
                data = new DataChr(opcode);
            } else if (c == 'X') {
                data = new DataHex(opcode);
            } else {
                throw new AsmError(parser.loc(), 1, "BYTE requires C'..' or X'..'");
            }
        } else if (opcode == Opcode.WORD) {
            data = new DataNum(opcode);
        } else {
            // Should not happen for pure SIC StorageData
            data = new DataNum(opcode);
        }

        data.parse(parser, allowList);
        return data;
    }

    private Mnemonic parseLiteralSpec() {
        // Pure SIC literals: only BYTE (default). No WORD/FLOT.
        if (parser.advanceIf("BYTE") || parser.advanceIf('B')) {
            return parser.mnemonics.get("BYTE");
        }
        // default to BYTE if no keyword
        return parser.mnemonics.get("BYTE");
    }

    private StorageData parseLiteralData() throws AsmError {
        Location loc = parser.loc();

        Location mnemonicStart = parser.loc();
        Mnemonic mnm = parseLiteralSpec();
        Location mnemonicEnd = parser.loc();
        mnemonicStart.length = Math.max(1, mnemonicEnd.col - mnemonicStart.col);
        Location mnemonicLoc = mnemonicStart;

        parser.skipWhitespace();

        Location dataStart = parser.loc();
        Data data = parseData(mnm.opcode, false);
        Location dataEnd = parser.loc();
        dataStart.length = Math.max(1, dataEnd.col - dataStart.col);
        Location dataLoc = dataStart;

        String lbl = parser.program.section().literals.makeUniqLabel();
        Location labelLoc = null;

        return new StorageData(loc, lbl, labelLoc,
                mnm, mnemonicLoc,
                data, dataLoc);
    }

    // ===== instruction formats we keep =====

    private Command parseF3(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) {
        return new InstructionF3(loc, label, labelLoc, mnemonic, mnemonicLoc);
    }

    private Command parseF3m(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        checkWhitespace(mnemonic.name);
        Flags flags = new Flags(Flags.SIMPLE, Flags.NONE);

        // literal?
        if (parser.advanceIf('=')) {
            InstructionF34Base cmd = new InstructionF3m(
                    loc, label, labelLoc, mnemonic, mnemonicLoc,
                    new Flags(Flags.SIMPLE, Flags.NONE), 0, null, null);
            StorageData lit = parseLiteralData();
            return new InstructionLiteral(cmd, lit);
        }

        int operand = 0;
        String symbol = null;
        Location symbolLoc = null;

        Location operandLoc = parser.loc();

        // read operand: number (decimal) OR symbol
        if (Character.isDigit(parser.peek())) {
            operand = parser.readInt(0, SICXE.MAX_ADDR);
        } else if (Character.isLetter(parser.peek()) || parser.peek() == '_') {
            symbolLoc = parser.loc();
            symbol = parser.readSymbol();
        } else {
            throw new AsmError(parser.loc(), 1, "Invalid character '%c'", parser.peek());
        }

        // Only optional ,X indexing
        if (parser.skipIfIndexed()) {
            flags.setIndexed();
        }

        return new InstructionF3m(loc, label, labelLoc, mnemonic, mnemonicLoc, flags, operand, symbol, symbolLoc);
    }

    // ===== directives we keep =====

    private Command parseDe(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        switch (mnemonic.opcode) {
            case Opcode.START: {
                Location exprLoc = parser.loc();
                Expr expr = parseStartHexExprRequired();
                // adjust stored span (already set inside helper)
                return new DirectiveSTART(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, exprLoc);
            }
            case Opcode.END: {
                Location exprLoc = parser.loc();
                Expr expr = parseEndOperand(); // may be null
                // If present, must be a symbol
                if (expr != null && !(expr instanceof ExprSym)) {
                    throw new AsmError(expr.loc, expr.toString().length(),
                            "END operand must be a single symbol (or empty)");
                }
                return new DirectiveEND(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, exprLoc);
            }
            default:
                return null;
        }
    }

    private Command parseSe(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        Location prevLoc = parser.loc();
        Expr expr = parseExpression(true);
        Location postLoc = parser.loc();
        prevLoc.length = postLoc.col - prevLoc.col;
        return new StorageRes(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, prevLoc);
    }

    private Command parseSd(Location loc,
                            String label, Location labelLoc,
                            Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        Location prevLoc = parser.loc();
        Data data = parseData(mnemonic.opcode, false);
        Location postLoc = parser.loc();
        prevLoc.length = postLoc.col - prevLoc.col;
        return new StorageData(loc, label, labelLoc, mnemonic, mnemonicLoc, data, prevLoc, false);
    }

    private Command parseSd_(Location loc,
                             String label, Location labelLoc,
                             Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        Location prevLoc = parser.loc();
        Data data = parseData(mnemonic.opcode, true);
        Location postLoc = parser.loc();
        prevLoc.length = postLoc.col - prevLoc.col;
        return new StorageData(loc, label, labelLoc, mnemonic, mnemonicLoc, data, prevLoc, false);
    }

    // ===== top-level dispatcher (pure SIC) =====

    public Command parse(Location loc, String label, Location labelLocation,
                         Mnemonic mnemonic, Location mnemonicLocation) throws AsmError {
        switch (mnemonic.format) {
            case F3:   return parseF3(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case F3m:  return parseF3m(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case De:   return parseDe(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case Se:   return parseSe(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case Sd:   return parseSd(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case Sd_:  return parseSd_(loc, label, labelLocation, mnemonic, mnemonicLocation);
            default:   return null;
        }
    }
}
