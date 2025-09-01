package com.sicserver.alternatives;

import com.sicserver.data.Relocations;
import sic.link.LinkerError;
import sic.link.Options;
import sic.link.section.*;
import sic.link.visitors.SectionVisitor;

import java.util.Map;

/*
 * Second pass
 *  changes Text records according to Modification Records
 *  (now also records the exact raw-hex patches into Relocations)
 */
public class SecondPassVisitor extends SectionVisitor {

    private static final String PHASE = "second pass";

    private final Map<String, ExtDef> esTable;
    private final Options options;
    private final String progname;
    private final Relocations relocations; // NEW

    private Section currSection = null;

    public SecondPassVisitor(String progname, Map<String, ExtDef> esTable, Options options, Relocations relocations) {
        this.progname = progname;
        this.esTable = esTable;
        this.options = options;
        this.relocations = relocations; // may be null, we guard uses
    }

    @Override
    public void visit(Section section) throws LinkerError {
        currSection = section;

        // visit all mRecords
        if (section.getMRecords() != null) {
            for (MRecord mRecord : section.getMRecords()) {
                mRecord.accept(this);
            }
        }
    }

    @Override
    public void visit(MRecord mRecord) throws LinkerError {
        if (mRecord.getSymbol() != null && !mRecord.getSymbol().equals(progname)) {

            ExtDef symbol = esTable.get(mRecord.getSymbol());
            if (symbol == null) {
                if (options.isForce()) {
                    if (options.isVerbose())
                        System.out.println(mRecord.getSymbol() + " is not defined in any section, allowing because -force option is set");
                    return;
                } else {
                    throw new LinkerError(PHASE, mRecord.getSymbol() + " is not defined in any section ", mRecord.getLocation());
                }
            }

            long fixAddressStart = mRecord.getStart() + currSection.getStart();
            long fixAddressEnd = fixAddressStart + mRecord.getLength() / 2;

            // find the T-record(s) that have to be fixed
            TRecord fixRecord = null;
            TRecord fixRecordEnd = null;
            int found = 0;
            if (currSection.getTRecords() != null) {
                for (TRecord tRecord : currSection.getTRecords()) {
                    if (tRecord.contains(fixAddressStart)) {
                        found++;
                        fixRecord = tRecord;
                        if (tRecord.contains(fixAddressEnd) || found == 2) break;
                    }
                    if (tRecord.contains(fixAddressEnd)) {
                        found++;
                        fixRecordEnd = tRecord;
                        if (found == 2) break;
                    }
                }
            }

            if (fixRecord == null)
                throw new LinkerError(PHASE, "Address " + fixAddressStart + " is not present in any T Record", mRecord.getLocation());

            // Offset inside first T-record TEXT (in half-bytes)
            int startNibble = (int) (fixAddressStart - fixRecord.getStartAddr()) * 2;
            startNibble += 1;
            // We are patching 'len' half-bytes
            final int len = mRecord.getLength();

            // --- Capture original TEXT(s) BEFORE modification ---
            final String origFirstText = fixRecord.getText();
            final int firstTextLen = origFirstText.length();

            String concatenated = origFirstText;
            String origSecondText = null;
            if (fixRecordEnd != null && fixRecord != fixRecordEnd) {
                origSecondText = fixRecordEnd.getText();
                concatenated = origFirstText + origSecondText;
            }

            // Slice out the original half-bytes to be replaced (may span two T-records)
            String oldHalfBytes;
            {
                int endNibbleGlobal = startNibble + len;
                oldHalfBytes = concatenated.substring(startNibble, endNibbleGlobal);
            }

            // Compute corrected value
            long corrected = Long.decode("0x" + oldHalfBytes); // half-bytes, not necessarily aligned
            corrected += symbol.getCsAddress();
            if (mRecord.isPositive()) corrected += symbol.getAddress();
            else corrected -= symbol.getAddress();

            String newHalfBytes = String.format("%0" + len + "X", corrected);

            // --- Apply the patch back into the (possibly concatenated) string ---
            String newConcat =
                    concatenated.substring(0, startNibble) +
                            newHalfBytes +
                            concatenated.substring(startNibble + len);

            // Split back to the two T-records if needed
            String newFirstText = newConcat.substring(0, firstTextLen);
            String newSecondText = (origSecondText != null) ? newConcat.substring(firstTextLen) : null;

            // --- Record patch details to Relocations (split across records if needed) ---
            if (relocations != null) {
                // First chunk length in first T-record
                int firstChunkLen = Math.min(len, Math.max(0, firstTextLen - startNibble));
                if (firstChunkLen > 0) {
                    String beforeHex = concatenated.substring(startNibble, startNibble + firstChunkLen);
                    String afterHex  = newConcat.substring(startNibble, startNibble + firstChunkLen);
                    relocations.recordPatch(
                            currSection.getName(),
                            fixRecord.getStartAddr(),
                            startNibble,                // offset inside first TEXT
                            firstChunkLen,              // half-bytes
                            beforeHex,
                            afterHex,
                            symbol.getName()
                    );
                }
                // Second chunk (if the patch spills into the next T-record)
                int remaining = len - Math.max(0, Math.min(len, firstTextLen - startNibble));
                if (remaining > 0 && fixRecordEnd != null && origSecondText != null) {
                    // In the second record, offset starts at 0
                    String beforeHex = origSecondText.substring(0, remaining);
                    String afterHex  = newSecondText.substring(0, remaining);
                    relocations.recordPatch(
                            currSection.getName(),
                            fixRecordEnd.getStartAddr(),
                            0,                          // offset inside second TEXT
                            remaining,                   // half-bytes
                            beforeHex,
                            afterHex,
                            symbol.getName()
                    );
                }
            }

            // --- Write the new TEXT back into the T-record(s) ---
            fixRecord.setText(newFirstText);
            if (fixRecordEnd != null && fixRecord != fixRecordEnd) {
                fixRecordEnd.setText(newSecondText);
            }

            if (options.isVerbose()) {
                System.out.println("fixing " + len + " half-bytes from " + oldHalfBytes + " to " + newHalfBytes
                        + "   symbol=" + symbol.getName());
            }

            // mark M-record as processed and make start absolute (to keep your original behavior)
            mRecord.setSymbol(progname);
            mRecord.setStart(mRecord.getStart() + currSection.getStart());
        }
        // else: normal (non-external) M-record — ignore
    }
}
