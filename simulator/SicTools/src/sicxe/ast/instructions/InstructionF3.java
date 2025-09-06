package sicxe.ast.instructions;

import sicxe.asm.Location;
import sicxe.common.Flags;
import sicxe.common.Mnemonic;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class InstructionF3 extends Instruction {

    private final Flags flags;

    public InstructionF3(Location loc, String label, Location labelLocation,
                         Mnemonic mnemonic, Location mnemonicLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
        flags = new Flags(Flags.SIMPLE, Flags.NONE);
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
