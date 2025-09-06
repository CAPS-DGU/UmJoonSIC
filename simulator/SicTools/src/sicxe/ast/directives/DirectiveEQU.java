package sicxe.ast.directives;

import sicxe.asm.AsmError;
import sicxe.asm.Location;
import sicxe.ast.Program;
import sicxe.ast.expression.Expr;
import sicxe.common.Mnemonic;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class DirectiveEQU extends DirectiveFe {

    public DirectiveEQU(Location loc, String label, Location labelLoc,
                        Mnemonic mnemonic, Location mnemonicLoc,
                        Expr expr, Location exprLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, exprLoc);
    }

    @Override
    public void append(Program program) throws AsmError {
        if (!hasLabel()) {
            throw new AsmError(new Location(loc.pos, loc.row, 1, loc.length), 1, "Missing label at EQU");
        }
        super.append(program);


    }

}
