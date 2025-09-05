package sic.ast.expression;

import sic.asm.*;
import sic.asm.parsing.ExpressionParser;
import sic.ast.Program;

import java.util.Set;

/**
 * Base class for expression AST nodes.
 * SIC/XE policy is enforced (when desired) via requireSICForm(), which subclasses may override.
 *
 * In strict SIC, callers should do:
 *   expr.requireSICForm();
 *   int value = expr.eval(program);
 *
 * @author jure
 */
public abstract class Expr {

    public final String name;   // name of the token as shown in syntax errors
    public final Location loc;  // location of the token
    public final int leftBP;    // left binding precedence

    public Expr(String name, Location loc, int leftBP) {
        this.name = name;
        this.loc = loc;
        this.leftBP = leftBP;
    }

    public Expr parse(ExpressionParser parser) throws AsmError {
        throw new AsmError(loc, String.format("%s", this).length(), "unexpected token '%s'", this);
    }

    public Expr parseLeft(ExpressionParser parser, Expr left) throws AsmError {
        throw new AsmError(loc, String.format("%s", this).length(), "unexpected token '%s'", this);
    }

    /** Collect all symbol names contained in this expression (may return null for constant-only). */
    public abstract Set<String> extractSyms();

    public int countSyms() {
        Set<String> set = extractSyms();
        return set == null ? 0 : set.size();
    }

    public boolean hasSyms() {
        return countSyms() > 0;
    }

    /** Heuristic helper some subclasses use; not required for SIC enforcement. */
    public abstract int countAddSub();

    public abstract boolean canEval(Program program);

    public abstract int eval(Program program) throws AsmError;

    /**
     * SIC-only validation hook.
     * Default is no-op; nodes that can combine subexpressions (e.g., ExprOp) should override.
     * Callers should invoke this prior to eval() when assembling in SIC-only mode.
     */
    public void requireSICForm() throws AsmError {
        // Default: leaf nodes are fine (ExprInt, ExprSym, ExprStar, etc.)
    }
}
