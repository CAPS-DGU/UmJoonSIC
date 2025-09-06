package sicxe.ast.expression;

import sicxe.asm.*;
import sicxe.asm.parsing.ExpressionParser;
import sicxe.ast.Program;

import java.util.Set;

/**
 * TODO: write a short description
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

    @Override
    public int eval(Program program) throws AsmError {
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
