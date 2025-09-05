package sic.common;

/**
 * TODO: write a short description
 *
 * @author jure
 */
public enum Format {

    F3, F3m,
    D, De, De0, Ds0, Ds_,
    Se, Sd, Sd_;

    public String hint() {
        switch (this) {
            case F3:    return "";
            case F3m:   return "([#@]n|s|*)|=l";
            case D:     return "";
            case De:    return "e";
            case De0:   return "e?";
            case Ds0:   return "s";
            case Ds_:   return "s,...";
            case Se:    return "n|s";
            case Sd:    return "(C|X|n)";
            case Sd_:   return "(C|X|n),...";
        }
        return null;
    }

}
