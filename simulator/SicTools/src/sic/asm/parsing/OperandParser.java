package sic.asm.parsing;

import sic.asm.AsmError;
import sic.asm.Location;
import sic.ast.Command;
import sic.ast.data.*;
import sic.ast.directives.*;
import sic.ast.expression.Expr;
import sic.ast.instructions.*;
import sic.ast.storage.StorageData;
import sic.ast.storage.StorageRes;
import sic.common.Flags;
import sic.common.Mnemonic;
import sic.common.Opcode;

import java.util.ArrayList;
import java.util.List;

/**
 * Support for parsing of instruction operands (SIC-only).
 * - No literals (=...), no immediate (#), no indirect (@).
 * - Only ,X indexing is allowed.
 * - Flags must be zeroed except optional X.
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

    private static final class Symbols {
        final List<String> names;
        final List<Location> locs;
        Symbols(List<String> names, List<Location> locs) {
            this.names = names;
            this.locs = locs;
        }
    }

    private Symbols parseSymbols(int maxLength) throws AsmError {
        List<String> names = new ArrayList<>();
        List<Location> locs = new ArrayList<>();

        do {
            Location startLoc = parser.loc();
            String sym = parser.readSymbol();
            Location postLoc = parser.loc();

            if (sym.length() > maxLength) {
                throw new AsmError(startLoc, sym.length(), "Symbol name '%s' too long", sym);
            }

            int len = postLoc.row == startLoc.row
                    ? Math.max(1, postLoc.col - startLoc.col)
                    : Math.max(1, sym.length());

            startLoc.length = len;

            names.add(sym);
            locs.add(startLoc);

        } while (parser.skipIfComma());

        return new Symbols(names, locs);
    }

    private Expr parseExpression(boolean throwIfNull) throws AsmError {
        Expr expr = parser.expressionParser.parseExpression();
        if (throwIfNull && expr == null)
            throw new AsmError(parser.loc(), 1, "Expression expected '%c'", parser.peek());
        return expr;
    }

    /**
     * Data parser for BYTE/WORD (SIC).
     * Accepts: C'..'  X'..'  and numeric (decimal via Lexer).
     */
    public Data parseData(int opcode, boolean allowList) throws AsmError {
        parser.skipWhitespace();  // IMPORTANT for BYTE  C'Z'
        Data data;
        switch (Character.toUpperCase(parser.peek())) {
            case 'C': data = new DataChr(opcode); break;
            case 'X': data = new DataHex(opcode); break;
            default:  data = new DataNum(opcode); break;
        }
        data.parse(parser, allowList);
        return data;
    }

    // ===== Literals are disabled in SIC-only mode =====
    private Mnemonic parseLiteralSpec() throws AsmError {
        throw new AsmError(parser.loc(), 1, "Literals are not allowed in SIC mode");
    }

    private StorageData parseLiteralData() throws AsmError {
        throw new AsmError(parser.loc(), 1, "Literals are not allowed in SIC mode");
    }

    // operand parsing

    private Command parseF3(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) {
        return new InstructionF3(loc, label, labelLoc, mnemonic, mnemonicLoc);
    }

    private Command parseF3m(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        checkWhitespace(mnemonic.name);

        // Start clean: ni=00, xbpe=0000 (we only set X later)
        Flags flags = new Flags(Flags.SIC, Flags.NONE);

        // Block literals outright
        if (parser.peek() == '=') {
            throw new AsmError(parser.loc(), 1, "Literals (=...) are not allowed in SIC mode");
        }

        // Block XE addressing prefixes
        if (parser.peek() == '#' || parser.peek() == '@') {
            char c = parser.peek();
            throw new AsmError(parser.loc(), 1, "Addressing mode '%c' is not allowed in SIC", c);
        }

        int operand;
        String symbol;
        Location symbolLoc = null;

        // Read operand: number, symbol, or '*'
        if (Character.isDigit(parser.peek()) || parser.peek() == '-') {
            operand = parser.readInt(0, Integer.MAX_VALUE);
            symbol = null;
        } else if (Character.isLetter(parser.peek()) || parser.peek() == '_') {
            operand = 0;
            symbolLoc = parser.loc();
            symbol = parser.readSymbol();
        } else if (parser.peek() == '*') {
            operand = 0;
            symbolLoc = parser.loc();
            parser.advance(); // consume '*'
            symbol = "*";
        } else {
            throw new AsmError(parser.loc(), 1, "Invalid character '%c'", parser.peek());
        }

        // Only ',X' indexing is allowed; program ONLY X (no B/P/E) via nibble
        if (parser.skipIfIndexed()) {
            flags.set_xbpe_nibble(0b1000); // X
        }

        return new InstructionF3m(loc, label, labelLoc, mnemonic, mnemonicLoc, flags, operand, symbol, symbolLoc);
    }

    // Unsupported directives in SIC-only mode

    private Command parseD(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        throw new AsmError(mnemonicLoc, mnemonic.name.length(), "Directive '%s' is not supported in SIC", mnemonic.name);
    }

    private Command parseDe(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        Location exprLoc = parser.loc();
        Expr expr = parseExpression(true);
        switch (mnemonic.opcode) {
            case Opcode.START: return new DirectiveSTART(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, exprLoc);
            case Opcode.END:   return new DirectiveEND(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, exprLoc);
            default:
                throw new AsmError(mnemonicLoc, mnemonic.name.length(), "Directive '%s' is not supported in SIC", mnemonic.name);
        }
    }

    private Command parseDe0(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        throw new AsmError(mnemonicLoc, mnemonic.name.length(), "Directive '%s' is not supported in SIC", mnemonic.name);
    }

    private Command parseDs0(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        throw new AsmError(mnemonicLoc, mnemonic.name.length(), "Directive '%s' is not supported in SIC", mnemonic.name);
    }

    private Command parseDs_(Location loc,
                             String label, Location labelLoc,
                             Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        throw new AsmError(mnemonicLoc, mnemonic.name.length(), "Directive '%s' is not supported in SIC", mnemonic.name);
    }

    private Command parseSe(Location loc, String label, Location labelLoc, Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        checkWhitespace(mnemonic.name);
        Location prevLoc = parser.loc();
        Expr expr = parseExpression(true);
        Location postLoc = parser.loc();
        prevLoc.length = Math.max(1, postLoc.col - prevLoc.col);
        return new StorageRes(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, prevLoc);
    }

    private Command parseSd(Location loc,
                            String label, Location labelLoc,
                            Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        checkWhitespace(mnemonic.name);
        Location prevLoc = parser.loc();
        Data data = parseData(mnemonic.opcode, false);
        Location postLoc = parser.loc();
        prevLoc.length = Math.max(1, postLoc.col - prevLoc.col);
        return new StorageData(loc, label, labelLoc, mnemonic, mnemonicLoc, data, prevLoc, false);
    }

    private Command parseSd_(Location loc,
                             String label, Location labelLoc,
                             Mnemonic mnemonic, Location mnemonicLoc) throws AsmError {
        checkWhitespace(mnemonic.name);
        Location prevLoc = parser.loc();
        Data data = parseData(mnemonic.opcode, true);
        Location postLoc = parser.loc();
        prevLoc.length = Math.max(1, postLoc.col - prevLoc.col);
        return new StorageData(loc, label, labelLoc, mnemonic, mnemonicLoc, data, prevLoc, false);
    }

    public Command parse(Location loc, String label, Location labelLocation,
                         Mnemonic mnemonic, Location mnemonicLocation) throws AsmError {
        switch (mnemonic.format) {
            case F3:    return parseF3(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case F3m:   return parseF3m(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case D:     return parseD(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case De:    return parseDe(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case De0:   return parseDe0(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case Ds0:   return parseDs0(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case Ds_:   return parseDs_(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case Se:    return parseSe(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case Sd:    return parseSd(loc, label, labelLocation, mnemonic, mnemonicLocation);
            case Sd_:   return parseSd_(loc, label, labelLocation, mnemonic, mnemonicLocation);
        }
        return null;
    }
}
