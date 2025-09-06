package sicxe.ast.instructions;

import sicxe.asm.Location;
import sicxe.common.Mnemonic;

/**
 * Instruction in Format 2.
 *
 * @author jure
 */
public abstract class InstructionF2Base extends Instruction {

    public InstructionF2Base(Location loc, String label, Location labelLocation,
                             Mnemonic mnemonic, Location mnemonicLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
    }

    @Override
    public int size() {
        return 2;
    }

    public void emitRawCode(byte[] data, int loc, int op1, int op2) {
        data[loc]     = (byte)(mnemonic.opcode);
        data[loc + 1] = (byte)(op1 << 4 & 0xF0 | op2 & 0x0F);
    }

}
