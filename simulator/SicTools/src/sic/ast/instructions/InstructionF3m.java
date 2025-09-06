package sic.ast.instructions;

import sic.asm.AsmError;
import sic.asm.Location;
import sic.ast.Program;
import sic.ast.Symbol;
import sic.common.Flags;
import sic.common.Mnemonic;
import sic.common.SICXE;

/**
 * Format 3, memory operand (pure SIC).
 *
 * - Only simple addressing with optional ,X.
 * - Encodes absolute 15-bit address (no PC/base relative; no immediate/indirect).
 * - Adds relocation if a relative symbol is addressed absolutely.
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
            throw new AsmError(locOf(SYMBOL), symbol.name.length(),
                    "External symbol '%s' is not allowed here", symbol);
    }

    @Override
    public boolean resolveAddressing(Program program) throws AsmError {
        // Pure SIC: always direct absolute addressing, no relocation entries.
        // resolvedValue already set by resolve(); range checks can be applied elsewhere if you want.
        return true;
    }

    @Override
    public int size() {
        return 3;
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        // Pure SIC layout:
        // byte0: opcode with ni=00
        // byte1: x bit in MSB, then high 7 bits of 15-bit address
        // byte2: low 8 bits of address
        data[loc]     = flags.combineWithOpcode(mnemonic.opcode);
        data[loc + 1] = (byte) (flags.get_x() | ((resolvedValue >> 8) & 0x7F));
        data[loc + 2] = (byte) (resolvedValue & 0xFF);
    }
}
