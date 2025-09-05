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
public class InstructionF2rn extends InstructionF2Base {

    public static final Key<Integer> REGISTER = Key.of("register");
    public static final Key<Integer> NUMBER   = Key.of("number");

    public final int register;
    public final int number;

    public InstructionF2rn(Location loc,
                           String label, Location labelLocation,
                           Mnemonic mnemonic, Location mnemonicLocation,
                           int register, Location registerLocation,
                           int number, Location numberLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
        this.register = register;
        this.number = number;
        putLoc(REGISTER, registerLocation);
        putLoc(NUMBER, numberLocation);
    }

    @Override
    public String operandToString() {
        return Conversion.regToName(register) + "," + Integer.toString(number);
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        emitRawCode(data, loc, register, number - 1);
    }

}
