package sic.common;

/**
 * Pure SIC formats and operand hints.
 * XE-only formats removed; operands restricted per pure SIC rules.
 */
public enum Format {

    F3,        // 3-byte op without operand (e.g., RSUB)
    F3m,       // 3-byte op with memory operand (symbol/decimal, optional ,X)
    D,         // directive without operand
    De,        // decimal numeric operand (e.g., WORD n, RESB n, RESW n)
    De0,       // optional single symbol (e.g., END [symbol])
    Ds0,       // single symbol
    Ds_,       // symbol list (comma-separated)
    Se,        // START address: hex digits without prefix
    Sd,        // BYTE C'…' or X'…'
    Sd_;       // list: (C'…'|X'…'), ...

    public String hint() {
        switch (this) {
            case F3:    return "";
            case F3m:   return "(n|s)(,X)?";
            case D:     return "";
            case De:    return "n";
            case De0:   return "s?";
            case Ds0:   return "s";
            case Ds_:   return "s,...";
            case Se:    return "hex";
            case Sd:    return "(C|X)";
            case Sd_:   return "(C|X),...";
        }
        return null;
    }

}
