package sicxe.ast.storage;

import sicxe.asm.Location;
import sicxe.ast.Command;
import sicxe.common.Mnemonic;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public abstract class Storage extends Command {

    public Storage(Location loc, String label, Location labelLoc,
                   Mnemonic mnemonic, Location mnemonicLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc);
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        // most of the directives emit no code
    }

}
