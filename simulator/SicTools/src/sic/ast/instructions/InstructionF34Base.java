package sic.ast.instructions;

import sic.asm.AsmError;
import sic.asm.Key;
import sic.asm.Location;
import sic.ast.Program;
import sic.ast.Symbol;
import sic.common.Flags;
import sic.common.Mnemonic;

/**
 * Common bits for SIC F3-like instructions.
 *  - Extended (+) is illegal.
 *  - Only X in XBPE may be set; others are cleared by concrete class.
 */
public abstract class InstructionF34Base extends Instruction {

    public static final Key<String> SYMBOL = Key.of("symbol");

    protected final Flags flags;        // flags
    protected int value;                // literal operand
    protected String symbol;            // symbolic operand
    protected int resolvedValue;        // resolved absolute address/value
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

        if (symbol != null) putLoc(SYMBOL, symbolLocation);

        if (mnemonic.isExtended()) {
            throw new IllegalStateException("Extended (format 4) mnemonics are not allowed in SIC-only mode");
        }
    }

    public boolean operandIsValue() {
        return symbol == null;
    }

    @Override
    public String operandToString() {
        String op = operandIsValue() ? Integer.toString(value) : symbol;
        return flags.operandToString(op); // adds ",X" when indexed
    }

    public void setSymbol(String symbol) { this.symbol = symbol; }

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

        if (resolveAddressing(program)) return;

        throw new AsmError(locOf(SYMBOL), (symbol == null ? 1 : symbol.length()),
                "Cannot address operand in SIC");
    }

    @Override
    public String explain() {
        String bits = "<b>SIC flags/X:</b> " + flags;
        return super.explain() + "<br>" + bits;
    }

    @Override
    public Integer resolveOperandAddress(int addressPC) {
        if (!flags.isImmediate() && flags.isAbsolute() && !flags.isIndexed()) {
            return resolvedValue;
        }
        return null;
    }
}
