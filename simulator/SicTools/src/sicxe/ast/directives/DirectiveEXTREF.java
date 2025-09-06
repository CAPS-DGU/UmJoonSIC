package sicxe.ast.directives;

import sicxe.asm.Location;
import sicxe.common.Mnemonic;

import java.util.List;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class DirectiveEXTREF extends DirectiveEXTDEF {

    public DirectiveEXTREF(Location loc,
                           String label, Location labelLoc,
                           Mnemonic mnemonic, Location mnemonicLoc,
                           List<String> names,
                           List<Location> nameLocs) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc, names, nameLocs);
    }
}
