package sicxe.asm.visitors;

import sicxe.asm.AsmError;
import sicxe.asm.ErrorCatcher;
import sicxe.ast.Program;
import sicxe.ast.directives.DirectiveEQU;

/**
 * Define symbols declared with EQU directive.
 *
 * @author jure
 */
public class DefineEQUs extends Visitor {

    public DefineEQUs(Program program, ErrorCatcher errorCatcher) {
        super(program, errorCatcher);
    }

    public void visit(DirectiveEQU d) throws AsmError {
        program.section().symbols.defineEQU(d.label(), d.loc, d.expr);
    }

}