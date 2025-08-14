package sic.sim.breakpoints;

import com.google.gwt.user.client.rpc.IsSerializable;

// Note: IsSerializable is a GWT marker interface.
// Alternatively, implementing java.io.Serializable works too.
public abstract class DataBreakpointException extends Exception implements IsSerializable {

    private int address;
    private DataBreakpoint breakpoint;

    /**
     * A public no-argument constructor is required for GWT serialization.
     */
    public DataBreakpointException() {
        // GWT requires this for serialization
    }

    public DataBreakpointException(DataBreakpoint breakpoint, int address) {
        this.address = address;
        this.breakpoint = breakpoint;
    }

    public int getAddress() {
        return address;
    }

    public DataBreakpoint getBreakpoint() {
        return breakpoint;
    }
}