package sic.ast.storage;

import sic.asm.AsmError;
import sic.asm.Key;
import sic.asm.Location;
import sic.ast.Program;
import sic.ast.expression.Expr;
import sic.ast.expression.ExprInt;
import sic.common.Mnemonic;
import sic.common.Opcode;

import java.util.Arrays;

/**
 * Support for storage-reservation directives in pure SIC.
 * Allowed: RESB (bytes), RESW (words).
 * Disallowed (removed): RESF.
 */
public class StorageRes extends Storage {
    public static final Key<String> EXPR = Key.of("expr");
    public final Expr expr;  // must be a decimal integer in pure SIC
    private int count;       // value of expression

    public StorageRes(Location loc, String label, Location labelLoc,
                      Mnemonic mnemonic, Location mnemonicLoc,
                      Expr expr, Location exprLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc);
        this.expr = expr;
        putLoc(EXPR, exprLoc);
    }

    @Override
    public String operandToString() {
        return expr.toString();
    }

    @Override
    public int size() {
        switch (mnemonic.opcode) {
            case Opcode.RESB: return count;
            case Opcode.RESW: return 3 * count;
            // RESF removed in pure SIC; if ever constructed, return 0
            default:          return 0;
        }
    }

    public void resolve(Program program) throws AsmError {
        // Pure SIC: reservation count must be a decimal integer literal.
        if (!(expr instanceof ExprInt)) {
            // use stored location for a good underline span
            Location eloc = locOf(EXPR);
            String shown = expr.toString();
            int span = shown != null ? shown.length() : 1;
            throw new AsmError(eloc, span,
                    "Pure SIC requires a decimal integer for %s (got '%s')", mnemonic.name, shown);
        }

        count = ((ExprInt) expr).value;

        if (count < 0) {
            Location eloc = locOf(EXPR);
            String shown = Integer.toString(count);
            throw new AsmError(eloc, shown.length(),
                    "%s count must be non-negative (got %d)", mnemonic.name, count);
        }
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        int s = size();
        if (s <= 0) return;
        // Fill the reserved region with zeros (exclusive upper bound).
        Arrays.fill(data, loc, loc + s, (byte) 0);
    }

    @Override
    public boolean emitText(StringBuilder buf) {
        return true; // no text emitted, but indicate flush
    }

}
