package sic.asm.visitors;

import sic.asm.AsmError;
import sic.asm.ErrorCatcher;
import sic.ast.Program;
import sic.ast.directives.DirectiveEND;
import sic.ast.instructions.InstructionF3m;
import sic.ast.instructions.InstructionLiteral;

/**
 * Second pass:
 *   - resolve instruction operands
 *   - set program entry (END)
 */
public class ResolveSymbols extends Visitor {

    public ResolveSymbols(Program program, ErrorCatcher errorCatcher) {
        super(program, errorCatcher);
    }

    public void visit(InstructionF3m c) throws AsmError {
        c.resolve(program);
    }

    // InstructionF4m removed in pure SIC.

    public void visit(DirectiveEND directive) throws AsmError {
        // Pure SIC: END is empty or a single symbol.
        if (directive.expr == null) {
            program.setFirst(program.start());
        } else {
            program.setFirst(directive.expr.eval(program));
        }
    }

    public void visit(InstructionLiteral c) throws AsmError {
        visit(c.command);
    }
}
