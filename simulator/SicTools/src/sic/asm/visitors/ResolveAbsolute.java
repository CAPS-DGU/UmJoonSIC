package sic.asm.visitors;

import sic.asm.AsmError;
import sic.asm.ErrorCatcher;
import sic.ast.Program;
import sic.ast.directives.DirectiveSTART;
import sic.ast.storage.StorageRes;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class ResolveAbsolute extends Visitor {

    public ResolveAbsolute(Program program, ErrorCatcher errorCatcher) {
        super(program, errorCatcher);
    }

    public void visit(DirectiveSTART d) throws AsmError {
        if (program.start() != program.locctr())
            throw new AsmError(d.getMnemonicLocation(), d.mnemonic.name.length(), "START must precede all instructions");
        if (program.name() != null)
            throw new AsmError(d.getMnemonicLocation(), d.mnemonic.name.length(), "Multiple STARTs are not allowed");
        if (d.label().length() > 6)
            throw new AsmError(d.getLabelLocation(), d.label.length(), "Program name too long");
        d.resolve(program);
        program.setName(d.label());
        program.setStart(d.value());
    }

    public void visit(StorageRes s) throws AsmError {
        s.resolve(program);
    }

}
