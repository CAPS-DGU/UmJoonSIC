package sicxe.asm.visitors;

import sicxe.asm.AsmError;
import sicxe.asm.ErrorCatcher;
import sicxe.ast.Program;
import sicxe.ast.directives.DirectiveEND;
import sicxe.ast.instructions.*;

/**
 * Second pass
 *   resolve symbols
 *   resolve and define program entry (END directive)
 *   manipulate BASE and NOBASE
 *
 * @author jure
 */
public class ResolveSymbols extends Visitor {

    public ResolveSymbols(Program program, ErrorCatcher errorCatcher) {
        super(program, errorCatcher);
    }

    public void visit(InstructionF3m c) throws AsmError {
        c.resolve(program);
    }

    public void visit(InstructionF4m c) throws AsmError {
        c.resolve(program);
    }

    public void visit(DirectiveEND directive) throws AsmError {
        program.setFirst(directive.expr.eval(program));
    }

    public void visit(InstructionLiteral c) throws AsmError {
        visit(c.command);
    }

}
