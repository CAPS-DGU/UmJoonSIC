package sicxe.ast;

import sicxe.asm.AsmError;

/**
 * Abstract class Node.
 *
 * @author jure
 */
public abstract class Node {

    public void enter(Program program) throws AsmError {}

    public void leave(Program program) throws AsmError {}

}
