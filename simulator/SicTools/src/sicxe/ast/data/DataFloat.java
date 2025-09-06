package sicxe.ast.data;

import sicxe.asm.AsmError;
import sicxe.asm.parsing.Parser;
import sicxe.common.Conversion;
import sicxe.common.Opcode;
import sicxe.common.SICXE;

public class DataFloat extends Data {

    private double num;

    public DataFloat(int opcode) {
        super(opcode);
    }

    @Override
    public String toString() {
        StringBuilder buf = new StringBuilder(data.length + 3);
        buf.append("F'");
        buf.append(Conversion.dataToFloat(data));
        buf.append('\'');
        return buf.toString() + super.toString();
    }

    @Override
    public void parse(Parser parser, boolean allowList) throws AsmError {
        parser.advance('F');
        parser.advance('\'');
        num = parser.readFloat();
        data = SICXE.doubleToDataFloat(num);
        parser.advance('\'');
        if (allowList) super.parse(parser, true);
    }

}
