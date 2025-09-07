package sic.ast.instructions;

import sic.asm.AsmError;
import sic.asm.Key;
import sic.asm.Location;
import sic.ast.Program;
import sic.ast.Symbol;
import sic.common.Flags;
import sic.common.Mnemonic;

/**
 * Instruction in Format 3 (pure SIC).
 *
 * XE features (immediate/indirect, PC/base relative, extended) are not supported.
 */
public abstract class InstructionF34Base extends Instruction {

    public static final Key<String> SYMBOL = Key.of("symbol");

    // operand
    protected final Flags flags;        // flags (only X is meaningful in pure SIC)
    protected int value;                // value as literal
    protected String symbol;            // symbolic operand
    protected int resolvedValue;        // resolved value after pass
    protected Symbol resolvedSymbol;    // resolved symbol object

    public InstructionF34Base(Location loc,
                              String label, Location labelLocation,
                              Mnemonic mnemonic, Location mnemonicLocation,
                              Flags flags,
                              int value,
                              String symbol, Location symbolLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
        this.flags = flags;
        this.value = value;
        this.symbol = symbol;

        if (symbol != null) {
            putLoc(SYMBOL, symbolLocation);
        }

        // In pure SIC we do NOT set extended bit (no Format 4).
        // if (mnemonic.isExtended()) { flags.setExtended(); }
    }

    public boolean operandIsValue() {
        return symbol == null;
    }

    @Override
    public String operandToString() {
        // Only plain number/symbol with optional ,X is allowed.
        String op = operandIsValue() ? Integer.toString(value) : symbol;
        return flags.operandToString(op);
    }

    public void setSymbol(String symbol) {
        // used by literals
        this.symbol = symbol;
    }

    protected abstract void checkSymbol(Program program, Symbol symbol) throws AsmError;

    protected abstract boolean resolveAddressing(Program program) throws AsmError;

    public void resolve(Program program) throws AsmError {
        // resolve operand: value or symbol
        if (operandIsValue()) {
            resolvedValue = value;
            resolvedSymbol = null;
        } else {
            resolvedSymbol = program.section().symbols.get(symbol);
            if (resolvedSymbol == null)
                throw new AsmError(locOf(SYMBOL), symbol.length(), "Undefined symbol '%s'", symbol);
            checkSymbol(program, resolvedSymbol);
            resolvedValue = resolvedSymbol.value();
        }
        // resolve addressing
        if (resolveAddressing(program)) return;

        // otherwise no suitable addressing found — build a robust error span
        final boolean isVal = operandIsValue();
        final String what = isVal ? Integer.toString(value) : symbol;
        final Location errLoc = isVal ? this.loc : locOf(SYMBOL);
        final int span = what != null ? what.length() : 1;

        throw new AsmError(errLoc, span,
                "Cannot address %s '%s' in pure SIC", isVal ? "value" : "symbol", what);
    }

    @Override
    public String explain() {
        String nixbpe = "<b>Bits nixbpe:</b> " + flags;
        return super.explain() + "<br>" + nixbpe;
    }

    @Override
    public Integer resolveOperandAddress(int addressPC) {
        // Pure SIC: absolute 15-bit address only; if indexed, we can't return a single address.
        if (!flags.isIndexed()) {
            return resolvedValue;
        } else {
            return null;
        }
    }
}
