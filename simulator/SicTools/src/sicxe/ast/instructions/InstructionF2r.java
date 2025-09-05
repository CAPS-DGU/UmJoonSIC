package sicxe.ast.instructions;

import sicxe.asm.Key;
import sicxe.asm.Location;
import sicxe.common.Mnemonic;
import sicxe.common.Conversion;

/**
 * Instruction in Format 2.
 *
 * @author jure
 */
public class InstructionF2r extends InstructionF2Base {
    public static final Key<String> REGISTER = Key.of("register");

    public final int register;

    public InstructionF2r(Location loc, String label, Location labelLocation,
                          Mnemonic mnemonic, Location mnemonicLocation,
                          int register, Location registerLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
        this.register = register;
        putLoc(REGISTER, registerLocation);
    }

    @Override
    public String operandToString() {
        return Conversion.regToName(register);
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        emitRawCode(data, loc, register, 0);
    }

}
