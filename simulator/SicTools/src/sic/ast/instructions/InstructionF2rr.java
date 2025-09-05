package sic.ast.instructions;

import sic.asm.Key;
import sic.asm.Location;
import sic.common.Mnemonic;
import sic.common.Conversion;

/**
 * Instruction in Format 2.
 *
 * @author jure
 */
public class InstructionF2rr extends InstructionF2Base {

    public static final Key<Integer> REGISTER1 = Key.of("register1");
    public static final Key<Integer> REGISTER2 = Key.of("register2");

    public final int register1;
    public final int register2;

    public InstructionF2rr(Location loc,
                           String label, Location labelLocation,
                           Mnemonic mnemonic, Location mnemonicLocation,
                           int register1, Location register1Location,
                           int register2, Location register2Location) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
        this.register1 = register1;
        this.register2 = register2;
        putLoc(REGISTER1, register1Location);
        putLoc(REGISTER2, register2Location);
    }

    @Override
    public String operandToString() {
        return Conversion.regToName(register1) + "," + Conversion.regToName(register2);
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        emitRawCode(data, loc, register1, register2);
    }

}
