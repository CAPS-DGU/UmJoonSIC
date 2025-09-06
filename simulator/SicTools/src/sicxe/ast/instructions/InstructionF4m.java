package sicxe.ast.instructions;

import sicxe.asm.Location;
import sicxe.ast.Program;
import sicxe.ast.Symbol;
import sicxe.common.Flags;
import sicxe.common.Mnemonic;
import sicxe.asm.AsmError;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class InstructionF4m extends InstructionF34Base {

    public InstructionF4m(Location loc,
                          String label, Location labelLocation,
                          Mnemonic mnemonic, Location mnemonicLocation,
                          Flags flags,
                          int operand,
                          String symbol, Location symbolLocation) {
        super(loc, label, labelLocation,
                mnemonic, mnemonicLocation,
                flags, operand,
                symbol, symbolLocation);

        flags.setExtended(); // Format 4 explicitly sets extended bit
    }

    @Override
    protected void checkSymbol(Program program, Symbol symbol) throws AsmError {
    }

    @Override
    protected boolean resolveAddressing(Program program) throws AsmError {
        // relocate only realtive symbols
        if (resolvedSymbol != null) {
            if (resolvedSymbol.isImported())
                program.section().addRelocation(program.locctr() + 1, 5, '+', symbol);
            else
                program.section().addRelocation(program.locctr() + 1, 5);
            return resolvedValue >= flags.minOperand() && resolvedValue <= flags.maxOperand();
        }
        return true;
    }

    @Override
    public int size() {
        return 4;
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        data[loc]     = flags.combineWithOpcode(mnemonic.opcode);
        data[loc + 1] = (byte)(flags.get_xbpe() | (resolvedValue >> 16) & 0x0F);
        data[loc + 2] = (byte)((resolvedValue >> 8) & 0xFF);
        data[loc + 3] = (byte)(resolvedValue & 0xFF);
    }

}
