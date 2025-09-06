package sic.ast;

import sic.asm.Location;
import sic.ast.storage.StorageData;
import sic.ast.storage.StorageRes;

import static sic.common.Opcode.*;

/**
 * Symbol describing storage (BYTE/RESB, WORD/RESW).
 * Pure SIC: no float storage (FLOT/RESF).
 */
public class StorageSymbol extends Symbol {

    public enum DataType {
        BYTE, WORD, FLOAT // keep FLOAT to avoid downstream enum references; never assigned in pure SIC
    }

    private DataType dataType;
    private Integer elementSize; // B=1, W=3 (FLOAT unused in pure SIC)
    private Integer elementCount;

    public StorageSymbol(String name, Location loc, int value, Command command) {
        super(name, loc, value, true);
        bindCommand(command);
    }

    /** Size of a single element (bytes). */
    public Integer getElementSize() {
        return elementSize;
    }

    /** Number of elements (e.g., RESW 20 -> 20). */
    public Integer getElementCount() {
        return elementCount;
    }

    /** Data kind (BYTE/WORD). */
    public DataType getDataType() {
        return dataType;
    }

    /**
     * Extracts info from the following command if it is a storage directive.
     * @return true if command denotes data storage we understand.
     */
    private boolean bindCommand(Command command) {
        if (!(command instanceof StorageRes || command instanceof StorageData)) {
            return false;
        }

        boolean matched = true;
        switch (command.mnemonic.opcode) {
            case BYTE:
            case RESB:
                dataType = DataType.BYTE;
                elementSize = 1;
                break;
            case WORD:
            case RESW:
                dataType = DataType.WORD;
                elementSize = 3;
                break;
            default:
                matched = false; // (FLOT/RESF removed in pure SIC; anything else is unknown)
        }

        if (matched) {
            elementCount = elementSize != null && elementSize > 0 ? (command.size() / elementSize) : null;
        } else {
            dataType = null;
            elementSize = null;
            elementCount = null;
        }

        return matched;
    }

    @Override
    public String toString() {
        return super.name;
    }
}
