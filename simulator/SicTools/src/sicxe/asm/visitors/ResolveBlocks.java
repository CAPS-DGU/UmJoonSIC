package sicxe.asm.visitors;

import sicxe.asm.AsmError;
import sicxe.asm.ErrorCatcher;
import sicxe.ast.Block;
import sicxe.ast.Command;
import sicxe.ast.Program;
import sicxe.ast.Section;
import sicxe.ast.directives.DirectiveEQU;
import sicxe.ast.directives.DirectiveORG;
import sicxe.ast.storage.StorageData;
import sicxe.ast.storage.StorageRes;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class ResolveBlocks extends Visitor {

    public ResolveBlocks(Program program, ErrorCatcher errorCatcher) {
        super(program, errorCatcher);
    }

    public void visit(Program program) {
        visitSections(program.sections);
    }

    public void visit(Section section) {
        int blockStart = program.section().isDefault() ? program.start() : 0;
        int size = 0;
        for (Block block : section.blocks) {
            block.setStart(blockStart);
            try {
                block.enter(program);
                visit(block);
                block.leave(program);
            } catch (AsmError err) {
                errorCatcher.add(err);
            }
            blockStart += block.size();
            size += block.size();
        }
        section.setSize(size);
    }

    public void visit(Block block) {
        visitCommands(block.commands);
    }

    public void visit(Command c) throws AsmError {
        program.section().symbols.defineLabel(c.label(), c.loc, program.locctr(), c);
    }

    public void visit(DirectiveEQU d) {
        // do nothing: since EQUs should already be defined
    }

    public void visit(DirectiveORG d) throws AsmError {
        d.resolve(program);
    }

}
