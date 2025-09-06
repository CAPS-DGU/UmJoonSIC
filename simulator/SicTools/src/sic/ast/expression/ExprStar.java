package sic.ast.expression;

import sic.asm.AsmError;
import sic.asm.Location;
import sic.asm.parsing.ExpressionParser;
import sic.ast.Program;

import java.util.Set;

/**
 * The location counter '*' is disallowed in pure SIC operands (no ORG/EQU math).
 * Kept only to throw a friendly error if encountered.
 */
public class ExprStar extends Expr {

    public ExprStar(Location loc) {
        super("*", loc, 0);
    }

    @Override
    public String toString() {
        return "*";
    }

    @Override
    public Expr parse(ExpressionParser parser) throws AsmError {
        throw new AsmError(loc, 1,
                "Location counter '*' is not allowed in pure SIC operands");
    }

    @Override
    public boolean hasSyms() {
        return false;
    }

    @Override
    public int countAddSub() {
        return 0;
    }

    @Override
    public Set<String> extractSyms() {
        return null;
    }

    @Override
    public boolean canEval(Program program) {
        return false;
    }

    @Override
    public int eval(Program program) throws AsmError {
        throw new AsmError(loc, 1,
                "Location counter '*' is not allowed in pure SIC operands");
    }
}
