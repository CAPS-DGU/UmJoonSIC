package sic.ast.instructions;

import sic.asm.Location;
import sic.ast.Command;
import sic.common.Mnemonic;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public abstract class Instruction extends Command {

    protected Instruction(Location loc, String label, Location labelLocation,
                          Mnemonic mnemonic, Location mnemonicLocation) {
        super(loc, label, labelLocation, mnemonic, mnemonicLocation);
    }

}
