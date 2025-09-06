package sic.sim.vm;

import sic.common.*;
import sic.sim.breakpoints.DataBreakpointException;
import sic.sim.breakpoints.ReadDataBreakpointException;
import sic.sim.breakpoints.WriteDataBreakpointException;

import java.util.Stack;

/**
 * Pure SIC machine: only 3-byte instructions with optional ,X indexing.
 * No F1/F2/F4, no immediate/indirect/base/PC-relative, no float ops.
 *
 * @author jure
 */
public class Machine {

    public static final int MAX_ADDRESS = (1 << 20) - 1; // 1048576 - 1
    public static final int MAX_DEVICE = 255;

    // ************ Machine parts

    public final Registers registers;
    public final Memory memory;
    public final Devices devices;

    // ************ Statistics

    private int instructionCount;
    private MemorySpan lastExecAddr;
    private MemorySpan lastExecRead;
    private MemorySpan lastExecWrite;

    private Stack<Integer> addressBelowJSUB = new Stack<>();

    // ************ Constructor

    public Machine() {
        this.registers = new Registers();
        this.memory = new Memory(MAX_ADDRESS + 1);
        this.devices = new Devices(MAX_DEVICE + 1);
        this.lastExecRead = new MemorySpan();
        this.lastExecWrite = new MemorySpan();
        this.lastExecAddr = new MemorySpan();
    }

    // ************ getters/setters

    public int getInstructionCount() {
        return instructionCount;
    }

    public MemorySpan getLastExecAddr() {
        return lastExecAddr;
    }

    public MemorySpan getLastExecRead() {
        return lastExecRead;
    }

    private void setLastExecRead(int startAddress, int spanLength) {
        lastExecWrite.clear();
        lastExecRead.set(startAddress, spanLength);
    }

    public MemorySpan getLastExecWrite() {
        return lastExecWrite;
    }

    private void setLastExecWrite(int startAddress, int spanLength) {
        lastExecRead.clear();
        lastExecWrite.set(startAddress, spanLength);
    }

    public void clearLastExecReadWrite() {
        lastExecWrite.clear();
        lastExecRead.clear();
        lastExecAddr.clear();
    }

    // ********** Execution helpers *********************

    private void notImplemented(String mnemonic) {
        Logger.fmterr("Instruction '%s' not implemented!", mnemonic);
    }

    private void invalidOpcode(int opcode) {
        Logger.fmterr("Invalid opcode '%d'.", opcode);
    }

    // Effective address in pure SIC: absolute 15-bit address plus optional ,X
    private int effectiveAddr(Flags flags, int addr) {
        if (flags.isIndexed()) {
            addr += registers.getXs();
        }
        return addr;
    }

    // loads/stores (pure SIC: always memory operand; no immediate/indirect)
    private int loadWord(Flags flags, int addr15) throws ReadDataBreakpointException {
        int addr = effectiveAddr(flags, addr15);
        setLastExecRead(addr, 3);
        return memory.getWord(addr);
    }

    private int loadByte(Flags flags, int addr15) throws ReadDataBreakpointException {
        int addr = effectiveAddr(flags, addr15);
        setLastExecRead(addr, 1);
        return memory.getByte(addr);
    }

    private void storeWord(Flags flags, int addr15, int word) throws WriteDataBreakpointException {
        int addr = effectiveAddr(flags, addr15);
        setLastExecWrite(addr, 3);
        memory.setWord(addr, word);
    }

    private void storeByte(Flags flags, int addr15, int _byte) throws WriteDataBreakpointException {
        int addr = effectiveAddr(flags, addr15);
        setLastExecWrite(addr, 1);
        memory.setByte(addr, _byte);
    }

    // ********** Fetch/Execute *********************

    public int fetch() {
        int b = memory.getByteRaw(registers.getPC());
        registers.incPC();
        return b;
    }

    public void execute() throws DataBreakpointException {
        instructionCount++;
        lastExecRead.clear();
        lastExecWrite.clear();
        lastExecAddr.setStartAddress(registers.getPC());
        lastExecAddr.setSpanLength(0);

        // Pure SIC: always 3 bytes
        int b0 = fetch(); // opcode (ni=00 already)
        int b1 = fetch(); // x bit in MSB, high 7 bits of address
        int b2 = fetch(); // low 8 bits of address
        lastExecAddr.setSpanLength(3);

        Flags flags = new Flags(b0, b1); // our Flags keeps only X from b1
        int opcode = b0 & 0xFC;
        int addr15 = ((b1 & 0x7F) << 8) | (b2 & 0xFF);

        if (execSIC(opcode, flags, addr15)) {
            return;
        }

        invalidOpcode(b0);
    }

    private boolean execSIC(int opcode, Flags flags, int operandAddr) throws DataBreakpointException {
        switch (opcode) {
            // ***** stores *****
            case Opcode.STA: storeWord(flags, operandAddr, registers.getA()); break;
            case Opcode.STX: storeWord(flags, operandAddr, registers.getX()); break;
            case Opcode.STL: storeWord(flags, operandAddr, registers.getL()); break;
            case Opcode.STCH: storeByte(flags, operandAddr, registers.getA()); break;
            case Opcode.STSW: storeWord(flags, operandAddr, registers.getSW()); break;

            // ***** jumps *****
            case Opcode.JEQ:
                if (registers.isEqual())
                    registers.setPC(effectiveAddr(flags, operandAddr));
                break;
            case Opcode.JGT:
                if (registers.isGreater())
                    registers.setPC(effectiveAddr(flags, operandAddr));
                break;
            case Opcode.JLT:
                if (registers.isLower())
                    registers.setPC(effectiveAddr(flags, operandAddr));
                break;
            case Opcode.J:
                registers.setPC(effectiveAddr(flags, operandAddr));
                break;
            case Opcode.RSUB:
                registers.setPC(registers.getL());
                popJSUB();
                break;
            case Opcode.JSUB:
                registers.setL(registers.getPC());
                pushJSUB();
                registers.setPC(effectiveAddr(flags, operandAddr));
                break;

            // ***** loads *****
            case Opcode.LDA: registers.setA(loadWord(flags, operandAddr)); break;
            case Opcode.LDX: registers.setX(loadWord(flags, operandAddr)); break;
            case Opcode.LDL: registers.setL(loadWord(flags, operandAddr)); break;
            case Opcode.LDCH: registers.setALo(loadByte(flags, operandAddr)); break;

            // ***** arithmetic & logic *****
            case Opcode.ADD:
                registers.setA(registers.getA() + loadWord(flags, operandAddr));
                break;
            case Opcode.SUB:
                registers.setA(registers.getA() - loadWord(flags, operandAddr));
                break;
            case Opcode.MUL:
                registers.setA(registers.getA() * loadWord(flags, operandAddr));
                break;
            case Opcode.DIV: {
                int divisor = SICXE.swordToInt(loadWord(flags, operandAddr));
                if (divisor == 0) {
                    System.out.println("division by zero");
                } else {
                    registers.setA(registers.getAs() / divisor);
                }
                break;
            }
            case Opcode.AND:
                registers.setA(registers.getA() & loadWord(flags, operandAddr));
                break;
            case Opcode.OR:
                registers.setA(registers.getA() | loadWord(flags, operandAddr));
                break;
            case Opcode.COMP:
                registers.setSWAfterCompare(registers.getAs() - SICXE.swordToInt(loadWord(flags, operandAddr)));
                break;
            case Opcode.TIX:
                registers.setX(registers.getX() + 1);
                registers.setSWAfterCompare(registers.getXs() - SICXE.swordToInt(loadWord(flags, operandAddr)));
                break;

            // ***** I/O *****
            case Opcode.RD:
                registers.setALo(devices.read(loadByte(flags, operandAddr)));
                break;
            case Opcode.WD:
                devices.write(loadByte(flags, operandAddr), registers.getALo());
                break;
            case Opcode.TD:
                registers.setSWAfterCompare(devices.test(loadByte(flags, operandAddr)) ? -1 : 0);
                break;

            default:
                return false;
        }
        return true;
    }

    // ********** Step over functionality *****************

    /** Push the address below current JSUB to the stack, so we can step out later. */
    private void pushJSUB() {
        this.addressBelowJSUB.push(this.registers.getPC());
    }

    /** Pop the last address below current JSUB (on RSUB). */
    private void popJSUB() {
        this.addressBelowJSUB.pop();
    }

    /**
     * Get the address below the last JSUB executed, so we can step out.
     * @return null if no item on stack - no JSUB encountered, otherwise last address.
     */
    public Integer getAddressBelowLastJSUB() {
        if (this.addressBelowJSUB.isEmpty()) return null;
        else return this.addressBelowJSUB.peek();
    }
}
