package sic.asm.parsing;

import sic.asm.AsmError;
import sic.ast.expression.Expr;
import sic.ast.expression.ExprInt;
import sic.ast.expression.ExprSym;
import sic.asm.Location;
import sic.common.SICXE;

/**
 * Pure SIC expression parser:
 * - Only a single decimal integer OR a single symbol is allowed.
 * - No operators, no '*' location counter.
 */
public class ExpressionParser {

    private final Parser parser;
    public final boolean allowSymbols;

    public ExpressionParser(Parser parser, boolean allowSymbols) {
        this.parser = parser;
        this.allowSymbols = allowSymbols;
    }

    private Expr readToken() throws AsmError {
        parser.skipWhitespace();
        Location loc = parser.loc();

        char c = parser.peek();

        // Reject anything that would start an expression/operator or location counter
        if (c == '+' || c == '-' || c == '*' || c == '/' || c == '%' || c == '#' || c == '@') {
            throw new AsmError(loc, 1, "Expressions are not allowed in pure SIC (found '%c')", c);
        }

        if (Character.isDigit(c)) {
            // NOTE: numeric base policy is enforced by callers (START hex vs others decimal).
            return new ExprInt(loc, parser.readInt(0, SICXE.MAX_WORD));
        }

        if (allowSymbols && (Character.isLetter(c) || c == '_')) {
            return new ExprSym(loc, parser.readSymbol());
        }

        // no token found
        return null;
    }

    private Expr nextTok;

    public Expr parseExpression() throws AsmError {
        nextTok = readToken();
        if (nextTok == null) return null;
        return parseExpression(0);
    }

    public Expr parseExpression(int rightBP) throws AsmError {
        // In pure SIC we never build infix trees; just return the single token.
        Expr tok = nextTok;
        nextTok = null;
        return tok.parse(this);
    }
}
