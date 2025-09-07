package iodevices;

/**
 * Base class for SIC/XE device.
 * @author jure
 */
public class Device {

    public boolean test() {
        // false by default
        return false;
    }

    public int read() {
        return -1;
    }

    public void write(int value) {
    }

    public void reset() {
    }

}
