package sic.disasm;

import sic.asm.Location;
import sic.ast.data.Data;
import sic.ast.data.DataHex;
import sic.ast.storage.StorageData;
import sic.common.Flags;
import sic.common.Mnemonic;
import sic.common.Mnemonics;
import sic.common.Opcode;
import sic.common.SICXE;
import sic.ast.Command;
import sic.ast.instructions.Instruction;
import sic.ast.instructions.InstructionF3;
import sic.ast.instructions.InstructionF3m;
import sic.sim.vm.Machine;

/**
 * Pure SIC disassembler:
 * - Always decodes 3-byte format (15-bit address + optional X)
 * - Only F3 (no operand) and F3m (memory operand) mnemonics are produced
 */
public class Disassembler {

    private final Mnemonics mnemonics;
    private final Machine machine;

    private int location;

    public Disassembler(Mnemonics mnemonics, Machine machine) {
        this.mnemonics = mnemonics;
        this.machine = machine;
    }

    public int location() {
        return location;
    }

    public void setLocation(int location) {
        if (location < 0) location = 0;
        if (location > SICXE.MAX_ADDR) location = SICXE.MASK_ADDR;
        this.location = location;
    }

    public void gotoPC() {
        setLocation(machine.registers.getPC());
    }

    public void next() {
        Command cmd = disassemble(location);
        setLocation(location + (cmd == null ? 1 : cmd.size()));
    }

    public void prev() {
        int l = location;
        Command cmd;
        do {
            cmd = disassemble(--l);
        } while (cmd == null || l + cmd.size() > location);
        setLocation(l);
    }

    public void next(int count) {
        while (count-- > 0) next();
    }

    public void prev(int count) {
        while (count-- > 0) prev();
    }

    private int fetchAddr;
    protected int fetch() {
        if (fetchAddr < 0) return 0;
        if (fetchAddr > SICXE.MAX_ADDR) return 0;
        return machine.memory.getByteRaw(fetchAddr++);
    }

    public Instruction disassemble(int addr) {
        this.fetchAddr = addr;

        // Always read 3 bytes (SIC format)
        int b0 = fetch();          // opcode (ni bits are 00 in pure SIC)
        int b1 = fetch();          // x bit in MSB, then high 7 bits of address
        int b2 = fetch();          // low 8 bits of address

        int op = b0 & 0xFC;
        String name = Opcode.getName(op);
        if (name == null) return null;

        Mnemonic mnemonic = mnemonics.get(name);
        if (mnemonic == null) return null;

        // Construct flags from first two bytes — only X is meaningful in pure SIC
        Flags flags = new Flags(b0, b1);
        int addr15 = ((b1 & 0x7F) << 8) | (b2 & 0xFF);

        Location loc = new Location(-1, -1, -1);

        switch (mnemonic.format) {
            case F3:
                // No operand (e.g., RSUB). We already consumed the 2 extra bytes.
                return new InstructionF3(loc, "", null, mnemonic, null);

            case F3m:
                // Memory operand (absolute 15-bit) with optional ,X
                return new InstructionF3m(loc, "", null, mnemonic, null,
                        flags, addr15, null, null);

            default:
                // Any other formats are not part of pure SIC disassembly
                return null;
        }
    }

    public Command disassembleSafe(int loc) {
        Instruction instruction = disassemble(loc);
        if (instruction == null) {
            Data data = new DataHex(mnemonics.get("BYTE").opcode);
            data.setData((byte) machine.memory.getByteRaw(loc));
            return new StorageData(new Location(-1, -1, -1), "", null,
                    mnemonics.get("BYTE"), null,
                    data, null);
        }
        return instruction;
    }

    /**
     * Returns the location after given PC
     * @param location (current) address
     * @return next instruction address
     */
    public int getLocationAfter(int location) {
        Command cmd = disassemble(location);
        return location + (cmd == null ? 1 : cmd.size());
    }

    /**
     * Get the next PC location, ignoring jumps / function calls.
     * @return next instruction address
     */
    public int getNextPCLocation() {
        return getLocationAfter(machine.registers.getPC());
    }
}
