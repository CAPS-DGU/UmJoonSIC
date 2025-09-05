package sic.ast.directives;

import sic.asm.AsmError;
import sic.asm.Location;
import sic.ast.Program;
import sic.common.Mnemonic;

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
        if (!hasLabel())
            throw new AsmError(loc, 1, "Missing label at CSECT");
        super.append(program);
    }

}
