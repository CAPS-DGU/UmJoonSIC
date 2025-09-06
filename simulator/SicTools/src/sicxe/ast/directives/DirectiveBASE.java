package sicxe.ast.directives;

import sicxe.asm.*;
import sicxe.ast.Program;
import sicxe.ast.expression.Expr;
import sicxe.common.Mnemonic;

/**
 * Directive BASE: enable base-relative addressing.
 *
 * @author jure
 */
public class DirectiveBASE extends DirectiveFe {

    public DirectiveBASE(Location loc, String label, Location labelLoc,
                         Mnemonic mnemonic, Location mnemonicLoc,
                         Expr expr, Location exprLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc, expr, exprLoc);
    }

    @Override
    public void enter(Program program) throws AsmError {
        program.section().enableBaseAddressing(value);
    }

}
