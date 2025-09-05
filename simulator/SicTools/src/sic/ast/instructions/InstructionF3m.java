package sic.ast.instructions;

import sic.asm.AsmError;
import sic.asm.Location;
import sic.ast.Program;
import sic.ast.Symbol;
import sic.common.Flags;
import sic.common.Mnemonic;

/**
 * SIC-only Format 3 (memory) instruction:
 *  - Only simple addressing (optionally indexed with ,X).
 *  - No immediate/indirect, no PC/base-relative, no extended.
 *  - 15-bit absolute address (0..0x7FFF).
 *  - Only X in XBPE is raisable; B/P/E are always 0.
 */
public class InstructionF3m extends InstructionF34Base {

    public InstructionF3m(Location loc,
                          String label, Location labelLocation,
                          Mnemonic mnemonic, Location mnemonicLocation,
                          Flags flags,
                          int operand,
                          String symbol, Location symbolLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation,
                flags, operand, symbol, symbolLocation);
    }

    @Override
    public void checkSymbol(Program program, Symbol symbol) throws AsmError {
        if (symbol.isImported())
            throw new AsmError(locOf(SYMBOL), symbol.name.length(),
                    "External symbol '%s' is not allowed in SIC", symbol);
    }

    @Override
    public boolean resolveAddressing(Program program) throws AsmError {
        // Ensure no XE modes leaked in
        if (flags.isImmediate() || flags.isIndirect() || flags.isPCRelative()
                || flags.isBaseRelative() || flags.isExtended()) {
            throw new AsmError(loc, 1, "Only simple SIC addressing (optional ,X) is allowed");
        }

        final int addr = resolvedValue;

        if ((addr & ~0x7FFF) != 0) {
            throw new AsmError(locOf(SYMBOL), (symbol == null ? 1 : symbol.length()),
                    "Address 0x%X does not fit in SIC 15-bit address field", addr);
        }

        // SIC ni: 00 (encoding requirement)
        flags.set_ni(Flags.SIC);

        // Enforce ONLY X in XBPE via NIBBLE, as requested (0b1000 -> X)
        flags.set_xbpe_nibble(flags.isIndexed() ? 0b1000 : 0b0000);

        // Relocate if relocatable symbol
        if (resolvedSymbol != null && !resolvedSymbol.isAbsolute()) {
            program.section().addRelocation(program.locctr() + 1, 3);
        }

        resolvedValue = addr;
        return true;
    }

    @Override
    public int size() {
        return 3;
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        // Byte 0: opcode with ni (SIC) combined
        data[loc] = flags.combineWithOpcode(mnemonic.opcode);

        // Byte 1: X in bit 7 (0x80) | addr[14..8]; Byte 2: addr[7..0]
        int xbit = ((flags.get_xbpe() & Flags.INDEXED) != 0) ? 0x80 : 0x00;
        data[loc + 1] = (byte) (xbit | ((resolvedValue >> 8) & 0x7F));
        data[loc + 2] = (byte) (resolvedValue & 0xFF);
    }
}
