package sicxe.ast;

import sicxe.asm.AsmError;
import sicxe.asm.Key;
import sicxe.asm.Location;
import sicxe.common.Conversion;
import sicxe.common.Mnemonic;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public abstract class Command extends Node {

    public final Location loc;
    public final String label;
    public final Mnemonic mnemonic;
    protected String comment;

    // Type-safe bag of per-field locations
    private final Map<Key<?>, Location> locations = new HashMap<>();

    public static final Key<String>  LABEL    = Key.of("label");
    public static final Key<Mnemonic> MNEM    = Key.of("mnemonic");
    public static final Key<String>  COMMENT  = Key.of("comment");

    protected Command(Location loc, String label, Location labelLoc,
                      Mnemonic mnemonic, Location mnemonicLoc) {
        super();
        this.loc = loc;
        this.label = label;
        this.mnemonic = mnemonic;
        putLoc(LABEL, labelLoc);
        putLoc(MNEM,  mnemonicLoc);
    }

    protected <T> void putLoc(Key<T> key, Location loc) {
        locations.put(key, loc); // null allowed if you want to signal “unknown”
    }

    public <T> Location locOf(Key<T> key) {
        return locations.get(key);
    }

    /** Optional: convenience getters preserving old field usage */
    public Location getLabelLocation()    { return locOf(LABEL); }
    public Location getMnemonicLocation() { return locOf(MNEM);  }
    public Location getCommentLocation()  { return locOf(COMMENT); }

    @Override
    public String toString() {
        return nameToString() + " " + operandToString();
    }

    // visitors

    @Override
    public void enter(Program program) throws AsmError {
        program.step(size());
    }

    public void append(Program program) throws AsmError {
        enter(program);
        program.append(this);       // add command to the current block
        leave(program);
    }

    // getters/setters

    public boolean hasLabel() {
        return label != null;
    }

    public String label() {
        return hasLabel() ? label : "";
    }

    public Mnemonic mnemonic() {
        return mnemonic;
    }

    public boolean hasComment() {
        return comment != null;
    }

    public String geComment() {
        return comment;
    }

    public void setComment(String comment) {
        if (comment != null) comment = comment.trim();
        this.comment = comment;
    }

    public String comment() {
        if (comment == null || comment.length() == 0) return "";
        return (comment.startsWith(".") ? "." : ". ") + comment;
    }

    public String nameToString() {
        return mnemonic.name;
    }

    public abstract String operandToString();

    // code generation

    /**
     * The size of the object code represented by this command.
     * @return size in bytes
     */
    public abstract int size();

    /**
     * Emit raw code.
     * @param data - array to emit to
     * @param loc - position in the data array
     */
    public abstract void emitRawCode(byte[] data, int loc);

    public byte[] emitRawCode() {
        byte[] data = new byte[size()];
        emitRawCode(data, 0);
        return data;
    }

    /**
     * Emit the text (hex encoding) of the ast.
     * @param buf - buf to append to
     */
    public boolean emitText(StringBuilder buf) {
        if (size() > 0) buf.append(Conversion.bytesToHex(emitRawCode()));
        return false;
    }

    /**
     * Generates hex and bin representation. Used in instruction info window.
     * @return explanation
     */
    public String explain() {
        byte[] code = new byte[size()];
        emitRawCode(code, 0);
        String hs = "<b>Hex:</b> ";
        String bs = "<b>Bin:</b> ";
        for (int i = 0; i < size(); i++) {
            hs += Conversion.byteToHex(code[i]) + " ";
            bs += Conversion.byteToBin(code[i]) + " ";
            if (i == 0 && size() == 4) bs += "<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
        }
        String opcode = "<b>Opcode:</b> " + Conversion.byteToHex(code[0] & 0xFC);
        return hs + "<br>" + bs + "<br>" + opcode;
    }

    // -------------------
    // |   DISASSEMBLY   |
    // -------------------
    public Integer resolveOperandAddress(int addressPC) {
        return null;
    }
}
