package sic.ast.directives;

import sic.asm.AsmError;
import sic.asm.Location;
import sic.ast.Program;
import sic.ast.expression.Expr;
import sic.common.Mnemonic;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class DirectiveORG extends DirectiveFe {

    public DirectiveORG(Location loc, String label, Location labelLoc,
                        Mnemonic mnemonic, Location mnemonicLoc,
                        Expr expr, Location exprLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, exprLoc);
    }

    @Override
    public void leave(Program program) throws AsmError {
        if (value == -1) program.block().restoreLocctr();
        else program.block().setOrigin(value);
    }

    @Override
    public boolean emitText(StringBuilder buf) {
        // flush text after ORG
        return true;
    }

}
