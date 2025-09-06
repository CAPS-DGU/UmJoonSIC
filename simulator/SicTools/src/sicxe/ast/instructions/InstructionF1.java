package sicxe.ast.instructions;

import sicxe.asm.Location;
import sicxe.common.Mnemonic;

/**
 * Instruction in Format 1.
 *
 * @author jure
 */
public class InstructionF1 extends Instruction {

    public InstructionF1(Location loc, String label, Location labelLocation,
                         Mnemonic mnemonic, Location mnemonicLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
    }

    @Override
    public String operandToString() {
        return "";
    }

    @Override
    public int size() {
        return 1;
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        data[loc] = (byte)mnemonic.opcode;
    }

    @Override
    public String explain() {
        return Integer.toBinaryString(mnemonic.opcode);
    }
}
