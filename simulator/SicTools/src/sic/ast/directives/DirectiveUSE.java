package sic.ast.directives;

import sic.asm.AsmError;
import sic.asm.Key;
import sic.asm.Location;
import sic.ast.Program;
import sic.common.Mnemonic;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class DirectiveUSE extends Directive {

    public static final Key<String> BLOCK = Key.of("block");
    public final String blockName;

    public DirectiveUSE(Location loc, String label, Location labelLoc,
                        Mnemonic mnemonic, Location mnemonicLoc,
                        String blockName, Location blockLoc) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc);
        this.blockName = blockName;
        putLoc(BLOCK, blockLoc);
    }

    @Override
    public String operandToString() {
        return blockName;
    }

    @Override
    public void enter(Program program) throws AsmError {
        program.section().switchBlock(blockName);
        super.enter(program);
    }

}
