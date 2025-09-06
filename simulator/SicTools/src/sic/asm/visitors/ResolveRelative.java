package sic.asm.visitors;

import sic.asm.AsmError;
import sic.asm.ErrorCatcher;
import sic.ast.Program;
import sic.ast.directives.*;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class ResolveRelative extends Visitor {

    public ResolveRelative(Program program, ErrorCatcher errorCatcher) {
        super(program, errorCatcher);
    }

    public void visit(DirectiveBASE d) throws AsmError {
        d.resolve(program);
    }

    public void visit(DirectiveEXTREF d) throws AsmError {
        for (String name : d.names)
            program.section().symbols.importSymbol(name, d.loc);
    }

    public void visit(DirectiveEXTDEF d) throws AsmError {
        for (int i = 0; i < d.names.size(); i++) {
            String name = d.names.get(i);
            program.section().symbols.exportSymbol(
                    name,
                    d.loc,
                    d.nameLocs.get(i)
            );
        }
    }

    public void visit(DirectiveSTART d) throws AsmError {
        program.section().symbols.exportSymbol(d.label(), d.loc, d.getLabelLocation());
    }

    public void visit(DirectiveCSECT d) throws AsmError {
        program.section().symbols.exportSymbol(d.label(), d.loc, d.getLabelLocation());
    }

}