package sicxe.ast.directives;

import sicxe.asm.Location;
import sicxe.ast.Command;
import sicxe.common.Mnemonic;

/**
 * Base class for assembler directives including storage directives.
 *
 * @author jure
 */
public abstract class Directive extends Command {

    public Directive(Location loc, String label, Location labelLoc,
                     Mnemonic mnemonic, Location mnemonicLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc);
    }

    @Override
    public String operandToString() {
        return "";  // default
    }

    @Override
    public int size() {
        return 0;
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        // directives emit no code
    }

}
