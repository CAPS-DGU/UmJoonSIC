package sic.ast.expression;

import sic.asm.*;
import sic.asm.parsing.ExpressionParser;
import sic.ast.Program;

import java.util.Set;

/**
 * Binary (and unary minus) operator node.
 * Enforces strict SIC form via requireSICForm():
 *  - At most one symbol in the entire expression.
 *  - If a symbol appears, only + or - may combine it at this node.
 *
 * Unary minus is represented as (0 - right).
 *
 * @author jure
 */
public class ExprOp extends Expr {

    private Expr left;
    private Expr right;
    public Location leftLoc;
    public Location rightLoc;

    public ExprOp(String name, Location loc, int leftBP) {
        super(name, loc, leftBP);
    }

    @Override
    public String toString() {
        return left + name + right;
    }

    public Expr left() {
        return left;
    }

    public Expr right() {
        return right;
    }

    @Override
    public Expr parse(ExpressionParser parser) throws AsmError {
        if ("*".equals(name)) {
            return new ExprStar(loc);
        }
        if ("+".equals(name)) {
            return parser.parseExpression(leftBP);
        }
        if ("-".equals(name)) {
            this.left = new ExprInt(loc, 0);
            this.leftLoc = left.loc;
            this.right = parser.parseExpression(leftBP);
            this.rightLoc = right.loc;
        }
        return this;
    }

    @Override
    public Expr parseLeft(ExpressionParser parser, Expr left) throws AsmError {
        this.left = left;
        this.leftLoc = left.loc;
        this.right = parser.parseExpression(leftBP);
        this.rightLoc = right.loc;
        return this;
    }

    @Override
    public boolean hasSyms() {
        return left.hasSyms() || right.hasSyms();
    }

    @Override
    public int countAddSub() {
        if ("+".equals(name))
            return left.countSyms() + right.countSyms();
        if ("-".equals(name))
            return left.countSyms() - right.countSyms();
        return Integer.MAX_VALUE;
    }

    @Override
    public Set<String> extractSyms() {
        Set<String> l = left.extractSyms();
        Set<String> r = right.extractSyms();
        if (l == null) return r;
        if (r == null) return l;
        l.addAll(r);
        return l;
    }

    @Override
    public boolean canEval(Program program) {
        return left.canEval(program) && right.canEval(program);
    }

    /**
     * Strict SIC rule:
     *  - If expression contains more than one symbol total -> error.
     *  - If exactly one symbol appears somewhere under this node,
     *    the top-level operator must be '+' or '-'.
     *  - Recursively enforce the same on children.
     */
    @Override
    public void requireSICForm() throws AsmError {
        // First ensure children are themselves SIC-compliant
        if (left != null)  left.requireSICForm();
        if (right != null) right.requireSICForm();

        int lSyms = (left  != null) ? left.countSyms()  : 0;
        int rSyms = (right != null) ? right.countSyms() : 0;
        int totalSyms = lSyms + rSyms;

        if (totalSyms > 1) {
            throw new AsmError(loc, String.valueOf(this).length(),
                    "SIC expression may reference at most one symbol");
        }

        if (totalSyms == 1) {
            if (!"+".equals(name) && !"-".equals(name)) {
                throw new AsmError(loc, String.valueOf(this).length(),
                        "Operator '%s' not allowed with a symbol in SIC (use only + or -)", name);
            }
            // Additionally ensure that the symbol is not combined with another symbol
            // (already guaranteed by totalSyms==1), and the other side can be any constant expression.
        }
    }

    @Override
    public int eval(Program program) throws AsmError {
        // Enforce SIC form before computing result
        requireSICForm();

        if ("+".equals(name))
            return left.eval(program) + right.eval(program);
        if ("-".equals(name))
            return left.eval(program) - right.eval(program);
        if ("*".equals(name))
            return left.eval(program) * right.eval(program);
        if ("/".equals(name))
            return left.eval(program) / right.eval(program);
        if ("%".equals(name))
            return left.eval(program) % right.eval(program);
        return 0;
    }
}
