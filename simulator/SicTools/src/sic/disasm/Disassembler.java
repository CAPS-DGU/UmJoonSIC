package sic.disasm;

import sic.asm.Location;
import sic.ast.data.Data;
import sic.ast.data.DataHex;
import sic.ast.storage.StorageData;
import sic.common.Mnemonics;
import sic.common.Opcode;
import sic.common.Flags;
import sic.ast.Command;
import sic.ast.instructions.Instruction;
import sic.ast.instructions.InstructionF3;
import sic.ast.instructions.InstructionF3m;
import sic.sim.vm.Machine;
import sic.common.SICXE;

/**
 * Disassembler (SIC-only).
 * Decodes:
 *  - F3  : 3-byte opcode-only (e.g., RSUB)
 *  - F3m : 3-byte memory form with optional ,X
 *
 * XE formats (F1/F2/F4), immediate/indirect, PC/base relative are not supported.
 * IMPORTANT: For SIC we DO NOT read B/P/E from byte1; only X is extracted.
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
        int opbyte = fetch();

        int opcode = (opbyte & 0xFC);
        String name = Opcode.getName(opcode);
        if (name == null) return null;

        var mnemonic = mnemonics.get(name);
        if (mnemonic == null) return null;

        Location loc = new Location(-1, -1, -1);

        switch (mnemonic.format) {
            case F3: {
                // Consume next two bytes
                fetch(); fetch();
                return new InstructionF3(loc, "", null, mnemonic, null);
            }
            case F3m: {
                int b1 = fetch();
                int b2 = fetch();

                // SIC decode: only X from bit7, ignore B/P/E completely
                Flags flags = Flags.decodeSIC(opbyte, b1);

                int addr15 = ((b1 & 0x7F) << 8) | (b2 & 0xFF);

                return new InstructionF3m(loc, "", null, mnemonic, null,
                        flags, addr15, null, null);
            }
            default:
                return null;
        }
    }

    public Command disassembleSafe(int loc) {
        Instruction instruction = disassemble(loc);
        if (instruction == null) {
            Data data = new DataHex(mnemonics.get("BYTE").opcode);
            data.setData((byte)machine.memory.getByteRaw(loc));
            return new StorageData(new Location(-1,-1,-1), "", null,
                    mnemonics.get("BYTE"), null,
                    data, null);
        }
        return instruction;
    }

    public int getLocationAfter(int location) {
        Command cmd = disassemble(location);
        return location + (cmd == null ? 1 : cmd.size());
    }

    public int getNextPCLocation() {
        return getLocationAfter(machine.registers.getPC());
    }
}
