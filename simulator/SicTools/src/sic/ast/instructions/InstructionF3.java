package sic.ast.instructions;

import sic.asm.Location;
import sic.common.Flags;
import sic.common.Mnemonic;

/**
 * SIC Format-3 instruction without operand (e.g., RSUB).
 * ni must be SIC (00), XBPE must be 0000.
 */
public class InstructionF3 extends Instruction {

    private final Flags flags;

    public InstructionF3(Location loc, String label, Location labelLocation,
                         Mnemonic mnemonic, Location mnemonicLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
        flags = new Flags(Flags.SIC, Flags.NONE);  // ni=00, xbpe=0000
    }

    @Override
    public String operandToString() {
        return "";
    }

    @Override
    public int size() {
        return 3;
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        data[loc]     = flags.combineWithOpcode(mnemonic.opcode);
        data[loc + 1] = 0;
        data[loc + 2] = 0;
    }
}
