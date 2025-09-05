package sic.ast.instructions;

import sic.asm.Key;
import sic.asm.Location;
import sic.common.Conversion;
import sic.common.Mnemonic;

/**
 * Instruction in Format 2.
 *
 * @author jure
 */
public class InstructionF2n extends InstructionF2Base {

    public final int number;
    public static final Key<Integer> NUMBER = Key.of("number");

    public InstructionF2n(Location loc,
                          String label, Location labelLocation,
                          Mnemonic mnemonic, Location mnemonicLocation,
                          int number, Location numberLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
        this.number = number;
        putLoc(NUMBER, numberLocation);
    }

    @Override
    public String operandToString() {
        return Integer.toString(number);
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        emitRawCode(data, loc, number, 0);
    }

    @Override
    public String explain() {
        return "<b>Hex:</b> " + Conversion.byteToHex(mnemonic.opcode) + " " + Conversion.byteToHex(number << 4) + "<br>" +
                "<b>Bin:</b> " + Conversion.byteToBin(mnemonic.opcode) + " " + Conversion.byteToBin(number << 4);
    }

}
