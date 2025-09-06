package sicxe.ast.directives;

import sicxe.asm.AsmError;
import sicxe.asm.Key;
import sicxe.asm.Location;
import sicxe.ast.Program;
import sicxe.common.Mnemonic;
import sicxe.ast.expression.Expr;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public abstract class DirectiveFe extends Directive {

    public static final Key<String> EXPR = Key.of("expr");

    public final Expr expr;     // expression, can be null
    protected int value;        // value of the expression (when evaluated)

    public DirectiveFe(Location loc, String label, Location labelLoc,
                       Mnemonic mnemonic, Location mnemonicLoc,
                       Expr expr, Location exprLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc);
        this.expr = expr;
        putLoc(EXPR, exprLoc);
    }

    @Override
    public String operandToString() {
        return (expr == null) ? "" : expr.toString();
    }

    public int value() {
        return value;
    }

    public void resolve(Program program) throws AsmError {
        value = expr == null ? -1 : expr.eval(program);
    }

}
