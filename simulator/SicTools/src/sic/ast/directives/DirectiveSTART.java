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
public class DirectiveSTART extends DirectiveFe {

    public DirectiveSTART(Location loc, String label, Location labelLoc,
                          Mnemonic mnemonic, Location mnemonicLoc,
                          Expr expr, Location exprLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, exprLoc);
    }

    @Override
    public void append(Program program) throws AsmError {
        if (!hasLabel()) {
            throw new AsmError(new Location(loc.pos, loc.row, 1, loc.length), 1, "Missing label at START");
        }
        super.append(program);
    }

}
