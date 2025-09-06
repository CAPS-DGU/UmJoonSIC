package sicxe.ast.instructions;

import sicxe.asm.AsmError;
import sicxe.asm.Key;
import sicxe.asm.Location;
import sicxe.ast.Program;
import sicxe.ast.Symbol;
import sicxe.common.Flags;
import sicxe.common.Mnemonic;

/**
 * Instruction in Format 3.
 *
 * @author jure
 */
public abstract class InstructionF34Base extends Instruction {

    public static final Key<String> SYMBOL = Key.of("symbol");

    // operand
    protected final Flags flags;        // flags nixbpe — no location
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

        if (mnemonic.isExtended()) {
            this.flags.setExtended();
        }
    }

    public boolean operandIsValue() {
        return symbol == null;
    }

    @Override
    public String operandToString() {
        String op = operandIsValue() ? Integer.toString(value) : symbol;
        if (operandIsValue()) {
            if (flags.isPCRelative()) op = "(PC)" + (value >= 0 ? "+" : "") + op;
            else if (flags.isBaseRelative()) op = "(B)+" + op;
        }
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
        // otherwise no suitable addressing found
        throw new AsmError(locOf(SYMBOL), symbol.length(), "Cannot address symbol '%s'", symbol);
    }

    @Override
    public String explain() {
        String nixbpe = "<b>Bits nixbpe:</b> " + flags;
        return super.explain() + "<br>" + nixbpe;
    }

    @Override
    public Integer resolveOperandAddress(int addressPC) {
        if (flags.isPCRelative()) {
            return addressPC + size() + value;
        } else if (!flags.isImmediate() && flags.isAbsolute() && !flags.isIndexed()) {
            return value;
        } else {
            return null;
        }
    }
}
