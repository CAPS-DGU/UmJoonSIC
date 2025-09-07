package sicxe.ast.instructions;

import sicxe.asm.AsmError;
import sicxe.asm.Location;
import sicxe.ast.Program;
import sicxe.ast.Symbol;
import sicxe.common.Conversion;
import sicxe.common.Flags;
import sicxe.common.Mnemonic;
import sicxe.common.SICXE;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class InstructionF3m extends InstructionF34Base {

    public InstructionF3m(Location loc,
                          String label, Location labelLocation,
                          Mnemonic mnemonic, Location mnemonicLocation,
                          Flags flags,
                          int operand,
                          String symbol, Location symbolLocation) {
        super(loc, label, labelLocation,
                mnemonic, mnemonicLocation,
                flags, operand,
                symbol, symbolLocation);
    }

    @Override
    public void checkSymbol(Program program, Symbol symbol) throws AsmError {
        if (symbol.isImported())
            throw new AsmError(locOf(SYMBOL), symbol.name.length(), "External symbol '%s' is not allowed here", symbol);
    }

    @Override
    public boolean resolveAddressing(Program program) throws AsmError {
        // if absolute symbol try absolute (direct) addressing
        if (resolvedSymbol == null || resolvedSymbol.isAbsolute()) {
            if (flags.isImmediate() ? SICXE.isCdisp(resolvedValue) : SICXE.isDisp(resolvedValue))
                return true;  // flags bp=0, and no relocation needed since sym is absolute
        }
        // try PC-relative addressing
        if (program.section().isPCRelativeAddressing(resolvedValue)) {
            flags.setPCRelative();
            resolvedValue = SICXE.intToSdisp(program.section().PCDisplacement(resolvedValue));
            return true;
        }
        // try base-relative addressing
        if (program.section().isBaseAddressing(resolvedValue)) {
            flags.setBaseRelative();
            resolvedValue = SICXE.intToDisp(program.section().baseDisplacement(resolvedValue));
            return true;
        }
        // try direct (absolute) addressing, we have relative symbol
        if (flags.isImmediate() ? SICXE.isSdisp(resolvedValue) : SICXE.isDisp(resolvedValue)) {
            // relocate: sym is relative but absolutely addressed
            program.section().addRelocation(program.locctr() + 1, 3);
            return true;  // flags bp=0
        }
        // if simple addressing also try to fallback to old SIC
        if (flags.isSimple() && SICXE.isSicAddr(resolvedValue)) {
            flags.set_ni(Flags.SIC);
            return true;
        }
        return false;
    }

    @Override
    public int size() {
        return 3;
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        data[loc] = flags.combineWithOpcode(mnemonic.opcode);
        data[loc + 1] = flags.isSic() ?
            (byte)(flags.get_x() | (resolvedValue >> 8) & 0x7F)
            :
            (byte)(flags.get_xbpe() | (resolvedValue >> 8) & 0x0F);
        data[loc + 2] = (byte)(resolvedValue & 0xFF);
    }
}
