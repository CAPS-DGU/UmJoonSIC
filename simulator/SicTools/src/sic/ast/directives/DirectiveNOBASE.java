package sic.ast.directives;

import sic.asm.Location;
import sic.ast.Program;
import sic.common.Mnemonic;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class DirectiveNOBASE extends Directive {

    public DirectiveNOBASE(Location loc, String label, Location labelLoc,
                           Mnemonic mnemonic, Location mnemonicLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc);
    }

    @Override
    public void enter(Program program) {
        program.section().disableBaseAddressing();
    }

}
