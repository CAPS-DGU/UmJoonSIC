package sicxe.ast.directives;

import sicxe.asm.Location;
import sicxe.common.Mnemonic;

import java.util.List;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public class DirectiveEXTDEF extends Directive {

    public final List<String> names;
    public final List<Location> nameLocs; // aligned 1:1 with names

    public DirectiveEXTDEF(Location loc,
                           String label, Location labelLoc,
                           Mnemonic mnemonic, Location mnemonicLoc,
                           List<String> names,
                           List<Location> nameLocs) {
        super(loc, label, labelLoc, mnemonic, mnemonicLoc);
        this.names = List.copyOf(names);
        this.nameLocs = List.copyOf(nameLocs);
    }

    @Override
    public String operandToString() {
        StringBuilder buf = new StringBuilder();
        buf.append(names.get(0));
        for (int i = 1; i < names.size(); i++) {
            buf.append(',');
            buf.append(names.get(i));
        }
        return buf.toString();
    }
}
