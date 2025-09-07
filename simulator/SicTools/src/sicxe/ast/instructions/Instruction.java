package sicxe.ast.instructions;

import sicxe.asm.Location;
import sicxe.ast.Command;
import sicxe.common.Mnemonic;

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
