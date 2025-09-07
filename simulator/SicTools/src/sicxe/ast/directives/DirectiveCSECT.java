package sicxe.ast.directives;

import sicxe.asm.AsmError;
import sicxe.asm.Location;
import sicxe.ast.Program;
import sicxe.common.Mnemonic;

/**
 * Directive CSECT: declare control section.
 *
 * @author jure
 */
public class DirectiveCSECT extends Directive {

    public DirectiveCSECT(Location loc, String label, Location labelLoc,
                          Mnemonic mnemonic, Location mnemonicLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc);
    }

    @Override
    public void enter(Program program) {
        program.switchSection(label());
        program.section().reset();
    }

    @Override
    public void append(Program program) throws AsmError {
        if (!hasLabel()) {
            throw new AsmError(new Location(loc.pos, loc.row, 1, loc.length), 1, "Missing label at CSECT");
        }
        super.append(program);
    }

}
