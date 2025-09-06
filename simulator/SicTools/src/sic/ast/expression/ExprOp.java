package sic.ast.expression;

import sic.asm.*;
import sic.asm.parsing.ExpressionParser;
import sic.ast.Program;

import java.util.Set;

/**
 * Operators are not allowed in pure SIC operands.
 * This node is kept only to produce a clear error if the parser ever reaches it.
 */
public class ExprOp extends Expr {

    public ExprOp(String name, Location loc, int leftBP) {
        super(name, loc, leftBP);
    }

    @Override
    public String toString() {
        return name;
    }

    @Override
    public Expr parse(ExpressionParser parser) throws AsmError {
        throw new AsmError(loc, name.length(),
                "Expressions are not allowed in pure SIC (found operator '%s')", name);
    }

    @Override
    public Expr parseLeft(ExpressionParser parser, Expr left) throws AsmError {
        throw new AsmError(loc, name.length(),
                "Expressions are not allowed in pure SIC (found operator '%s')", name);
    }

    @Override
    public Set<String> extractSyms() {
        return null;
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
    public boolean canEval(Program program) {
        return false;
    }

    @Override
    public int eval(Program program) throws AsmError {
        throw new AsmError(loc, name.length(),
                "Expressions are not allowed in pure SIC (found operator '%s')", name);
    }
}
