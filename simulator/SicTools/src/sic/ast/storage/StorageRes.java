package sic.ast.storage;

import sic.asm.AsmError;
import sic.asm.Key;
import sic.asm.Location;
import sic.ast.Program;
import sic.ast.expression.Expr;
import sic.common.Mnemonic;
import sic.common.Opcode;

import java.util.Arrays;

/**
 * Storage-reservation directives for SIC:
 *  - RESB (bytes)
 *  - RESW (words, 3 bytes each)
 *
 * No RESF in pure SIC.
 */
public class StorageRes extends Storage {
    public static final Key<String> EXPR = Key.of("expr");
    public final Expr expr;      // expression
    private int count;           // evaluated count (number of units)

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
            default:          return 0; // unsupported in SIC
        }
    }

    public void resolve(Program program) throws AsmError {
        // Enforce strict SIC expression form: at most one symbol; if present, only +/- constant
        expr.requireSICForm();

        count = expr.eval(program);

        if (count < 0) {
            throw new AsmError(locOf(EXPR), Math.max(1, operandToString().length()),
                    "Negative count not allowed: %d", count);
        }

        // Optional: sanity check very large reservations to avoid overflow.
        // (SIC address space is 15-bit; loaders/sections may impose tighter limits elsewhere.)
        long bytes = (mnemonic.opcode == Opcode.RESW) ? (long)count * 3L : (long)count;
        if (bytes > 0x7FFF) {
            // Warning or error; choose policy. Using error here:
            throw new AsmError(locOf(EXPR), Math.max(1, operandToString().length()),
                    "Reservation too large for SIC: %d bytes", bytes);
        }
    }

    @Override
    public void emitRawCode(byte[] data, int loc) {
        int s = size();
        if (s <= 0) return;
        // Arrays.fill uses exclusive end index — fill exactly 's' bytes starting at loc
        Arrays.fill(data, loc, loc + s, (byte)0);
    }

    @Override
    public boolean emitText(StringBuilder buf) {
        return true; // no text emitted, but indicate flush
    }
}
