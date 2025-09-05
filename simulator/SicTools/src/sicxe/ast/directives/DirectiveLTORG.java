package sicxe.ast.directives;

import sicxe.asm.AsmError;
import sicxe.asm.Location;
import sicxe.ast.Program;
import sicxe.common.Mnemonic;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class DirectiveLTORG extends Directive {

    public DirectiveLTORG(Location loc, String label, Location labelLoc,
                          Mnemonic mnemonic, Location mnemonicLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc);
    }

    @Override
    public void append(Program program) throws AsmError {
        super.append(program);
        program.section().literals.flush(program);
    }

}
